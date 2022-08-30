const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default;
// ---
const {
  axiosFormio,
  formioProjectUrl,
  formioRebateFormPath,
  formioCsbMetadata,
} = require("../config/formio");
const {
  ensureAuthenticated,
  ensureHelpdesk,
  storeBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const { getSamData, getRebateSubmissionsData } = require("../utilities/bap");
const log = require("../utilities/logger");

const enrollmentClosed = process.env.CSB_ENROLLMENT_PERIOD !== "open";

/**
 * Returns a resolved or rejected promise, depending on if the enrollment period
 * is closed (as set via the `CSB_ENROLLMENT_PERIOD` environment variable), and
 * if the form submission has the status of "Edits Requested" or not (as stored
 * in and returned from the BAP).
 * @param {Object} param
 * @param {string} param.id
 * @param {string} param.comboKey
 * @param {express.Request} param.req
 */
function checkEnrollmentPeriodAndBapStatus({ id, comboKey, req }) {
  // continue if enrollment isn't closed
  if (!enrollmentClosed) {
    return Promise.resolve();
  }
  // else, enrollment is closed, so only continue if edits are requested
  return getRebateSubmissionsData([comboKey], req).then((submissions) => {
    const submission = submissions.find((s) => s.CSB_Form_ID__c === id);
    const status = submission?.Parent_CSB_Rebate__r?.CSB_Rebate_Status__c;
    return status === "Edits Requested" ? Promise.resolve() : Promise.reject();
  });
}

const router = express.Router();

// --- get static content from S3
router.get("/content", (req, res) => {
  const s3Bucket = process.env.S3_PUBLIC_BUCKET;
  const s3Region = process.env.S3_PUBLIC_REGION;

  // NOTE: static content files found in `app/server/app/content/` directory
  const filenames = [
    "site-alert.md",
    "helpdesk-intro.md",
    "all-rebates-intro.md",
    "all-rebates-outro.md",
    "new-rebate-dialog.md",
    "draft-rebate-intro.md",
    "submitted-rebate-intro.md",
  ];

  const s3BucketUrl = `https://${s3Bucket}.s3-${s3Region}.amazonaws.com`;

  Promise.all(
    filenames.map((filename) => {
      // local development: read files directly from disk
      // Cloud.gov: fetch files from the public s3 bucket
      return process.env.NODE_ENV === "development"
        ? readFile(resolve(__dirname, "../content", filename), "utf8")
        : axios.get(`${s3BucketUrl}/content/${filename}`);
    })
  )
    .then((stringsOrResponses) => {
      // local development: no further processing of strings needed
      // Cloud.gov: get data from responses
      return process.env.NODE_ENV === "development"
        ? stringsOrResponses
        : stringsOrResponses.map((axiosRes) => axiosRes.data);
    })
    .then((data) => {
      res.json({
        siteAlert: data[0],
        helpdeskIntro: data[1],
        allRebatesIntro: data[2],
        allRebatesOutro: data[3],
        newRebateDialog: data[4],
        draftRebateIntro: data[5],
        submittedRebateIntro: data[6],
      });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        log({ level: "debug", message: error.toJSON(), req });
      }

      const errorStatus = error.response?.status;
      const errorMethod = error.response?.config?.method?.toUpperCase();
      const errorUrl = error.response?.config?.url;
      const message = `S3 Error: ${errorStatus} ${errorMethod} ${errorUrl}`;
      log({ level: "error", message, req });

      res
        .status(error?.response?.status || 500)
        .json({ message: "Error getting static content from S3 bucket" });
    });
});

router.use(ensureAuthenticated);

// --- verification used to check if user has access to the /helpdesk route (using ensureHelpdesk middleware)
router.get("/helpdesk-access", ensureHelpdesk, (req, res) => {
  res.sendStatus(200);
});

// --- get CSB app specific data (open enrollment status, etc.)
router.get("/csb-data", (req, res) => {
  res.json({ enrollmentClosed });
});

// --- get user data from EPA Gateway/Login.gov
router.get("/epa-data", (req, res) => {
  const { mail, memberof, exp } = req.user;
  res.json({ mail, memberof, exp });
});

// --- get data from EPA's Business Automation Platform (BAP)
router.get("/bap-data", (req, res) => {
  getSamData(req.user.mail, req)
    .then((samEntities) => {
      // NOTE: allow admin or helpdesk users access to the app, even without SAM.gov data
      const userRoles = req.user.memberof.split(",");
      const helpdeskUser =
        userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk");

      if (!helpdeskUser && samEntities?.length === 0) {
        const message = `User with email ${req.user.mail} tried to use app without any associated SAM records.`;
        log({ level: "error", message, req });
        return res.json({
          samResults: false,
          samEntities: [],
          rebateSubmissions: [],
        });
      }

      const comboKeys = samEntities.map((e) => e.ENTITY_COMBO_KEY__c);

      getRebateSubmissionsData(comboKeys, req)
        .then((submissions) => {
          res.json({
            samResults: true,
            samEntities,
            rebateSubmissions: submissions,
          });
        })
        .catch((error) => {
          throw error;
        });
    })
    .catch((error) => {
      return res.status(401).json({ message: "Error getting data from BAP" });
    });
});

// --- get all rebate form submissions from Forms.gov
router.get("/rebate-form-submissions", storeBapComboKeys, (req, res) => {
  // NOTE: Helpdesk users might not have any SAM.gov records associated with
  // their email address so we should not return any submissions to those users.
  // The only reason we explicitly need to do this is because there could be
  // some submissions without `bap_hidden_entity_combo_key` field values in the
  // forms.gov database – that will never be the case for submissions created
  // from this app, but there could be submissions created externally if someone
  // is testing posting data (e.g. from a REST client, or the Formio Viewer)
  if (req.bapComboKeys.length === 0) return res.json([]);

  const userSubmissionsUrl =
    `${formioProjectUrl}/${formioRebateFormPath}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `&data.bap_hidden_entity_combo_key=${req.bapComboKeys.join(
      "&data.bap_hidden_entity_combo_key="
    )}`;

  axiosFormio(req)
    .get(userSubmissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      const message = "Error getting Forms.gov rebate form submissions";
      return res.status(error?.response?.status || 500).json({ message });
    });
});

// --- post a new rebate form submission to Forms.gov
router.post("/rebate-form-submission", storeBapComboKeys, (req, res) => {
  const comboKey = req.body.data?.bap_hidden_entity_combo_key;

  if (enrollmentClosed) {
    const message = "CSB enrollment period is closed";
    return res.status(400).json({ message });
  }

  // verify post data includes one of user's BAP combo keys
  if (!req.bapComboKeys.includes(comboKey)) {
    const message = `User with email ${req.user.mail} attempted to post new form without a matching BAP combo key`;
    log({ level: "error", message, req });
    return res.status(401).json({ message: "Unauthorized" });
  }

  // add custom metadata to track formio submissions from wrapper
  req.body.metadata = {
    ...req.body.metadata,
    ...formioCsbMetadata,
  };

  const newSubmissionUrl = `${formioProjectUrl}/${formioRebateFormPath}/submission`;

  axiosFormio(req)
    .post(newSubmissionUrl, req.body)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      const message = "Error posting Forms.gov rebate form submission";
      return res.status(error?.response?.status || 500).json({ message });
    });
});

// --- get an existing rebate form's schema and submission data from Forms.gov
router.get(
  "/rebate-form-submission/:id",
  verifyMongoObjectId,
  storeBapComboKeys,
  async (req, res) => {
    const { id } = req.params;

    const existingSubmissionUrl = `${formioProjectUrl}/${formioRebateFormPath}/submission/${id}`;

    axiosFormio(req)
      .get(existingSubmissionUrl)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => {
        const formUrl = `${formioProjectUrl}/form/${submission.form}`;

        axiosFormio(req)
          .get(formUrl)
          .then((axiosRes) => axiosRes.data)
          .then((schema) => {
            const comboKey = submission.data.bap_hidden_entity_combo_key;

            if (!req.bapComboKeys.includes(comboKey)) {
              const message = `User with email ${req.user.mail} attempted to access submission ${id} that they do not have access to.`;
              log({ level: "warn", message, req });
              res.json({
                userAccess: false,
                formSchema: null,
                submissionData: null,
              });
            } else {
              res.json({
                userAccess: true,
                formSchema: {
                  url: `${formioProjectUrl}/form/${submission.form}`,
                  json: schema,
                },
                submissionData: submission,
              });
            }
          });
      })
      .catch((error) => {
        const message = `Error getting Forms.gov rebate form submission ${id}`;
        res.status(error?.response?.status || 500).json({ message });
      });
  }
);

// --- post an update to an existing draft rebate form submission to Forms.gov
router.post(
  "/rebate-form-submission/:id",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    const { id } = req.params;
    const comboKey = req.body.data?.bap_hidden_entity_combo_key;

    checkEnrollmentPeriodAndBapStatus({ id, comboKey, req })
      .then(() => {
        // verify post data includes one of user's BAP combo keys
        if (!req.bapComboKeys.includes(comboKey)) {
          const message = `User with email ${req.user.mail} attempted to update existing form without a matching BAP combo key`;
          log({ level: "error", message, req });
          return res.status(401).json({ message: "Unauthorized" });
        }

        // add custom metadata to track formio submissions from wrapper
        req.body.metadata = {
          ...req.body.metadata,
          ...formioCsbMetadata,
        };

        const existingSubmissionUrl = `${formioProjectUrl}/${formioRebateFormPath}/submission/${id}`;

        axiosFormio(req)
          .put(existingSubmissionUrl, req.body)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => res.json(submission))
          .catch((error) => {
            const message = "Error updating Forms.gov rebate form submission";
            res.status(error?.response?.status || 500).json({ message });
          });
      })
      .catch((error) => {
        const message = "CSB enrollment period is closed";
        return res.status(400).json({ message });
      });
  }
);

// --- upload s3 file metadata to Forms.gov
router.post("/:id/:comboKey/storage/s3", storeBapComboKeys, (req, res) => {
  const { id, comboKey } = req.params;

  checkEnrollmentPeriodAndBapStatus({ id, comboKey, req })
    .then(() => {
      if (!req.bapComboKeys.includes(comboKey)) {
        const message = `User with email ${req.user.mail} attempted to upload file without a matching BAP combo key`;
        log({ level: "error", message, req });
        return res.status(401).json({ message: "Unauthorized" });
      }

      const storageUrl = `${formioProjectUrl}/${formioRebateFormPath}/storage/s3`;

      axiosFormio(req)
        .post(storageUrl, req.body)
        .then((axiosRes) => axiosRes.data)
        .then((fileMetadata) => res.json(fileMetadata))
        .catch((error) => {
          const message = "Error uploading Forms.gov file";
          return res.status(error?.response?.status || 500).json({ message });
        });
    })
    .catch((error) => {
      const message = "CSB enrollment period is closed";
      return res.status(400).json({ message });
    });
});

// --- download s3 file metadata from Forms.gov
router.get("/:id/:comboKey/storage/s3", storeBapComboKeys, (req, res) => {
  const { comboKey } = req.params;

  if (!req.bapComboKeys.includes(comboKey)) {
    const message = `User with email ${req.user.mail} attempted to download file without a matching BAP combo key`;
    log({ level: "error", message, req });
    return res.status(401).json({ message: "Unauthorized" });
  }

  const storageUrl = `${formioProjectUrl}/${formioRebateFormPath}/storage/s3`;

  axiosFormio(req)
    .get(storageUrl, { params: req.query })
    .then((axiosRes) => axiosRes.data)
    .then((fileMetadata) => res.json(fileMetadata))
    .catch((error) => {
      const message = "Error downloading Forms.gov file";
      return res.status(error?.response?.status || 500).json({ message });
    });
});

module.exports = router;
