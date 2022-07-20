const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default;
// ---
const {
  axiosFormio,
  formioProjectUrl,
  formioFormName,
  formioCsbMetadata,
} = require("../config/formio");
const {
  ensureAuthenticated,
  ensureHelpdesk,
  checkCsbEnrollmentPeriod,
  checkBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const { getSamData } = require("../utilities/getSamData");
const log = require("../utilities/logger");

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
      log({
        level: "error",
        message: `S3 Error: ${
          error.response?.status
        } ${error.response?.config?.method?.toUpperCase()} ${
          error.response?.config?.url
        }`,
        req,
      });

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

// --- get EPA data from EPA Gateway/Login.gov
router.get("/epa-data", (req, res) => {
  // Explicitly return only required attributes from user info
  res.json({
    mail: req.user.mail,
    memberof: req.user.memberof,
    exp: req.user.exp,
  });
});

// --- get SAM.gov data from BAP
router.get("/sam-data", (req, res) => {
  getSamData(req.user.mail, req)
    .then((samUserData) => {
      const userRoles = req.user.memberof.split(",");
      const helpdeskUser =
        userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk");

      // First check if user has at least one associated UEI before completing login process
      // If user has admin or helpdesk role, return empty array but still allow app use
      if (!helpdeskUser && samUserData?.length === 0) {
        log({
          level: "error",
          message: `User with email ${req.user.mail} tried to use app without any associated SAM records.`,
          req,
        });

        return res.json({
          results: false,
          records: [],
        });
      }

      res.json({
        results: true,
        records: samUserData,
      });
    })
    .catch(() => {
      res.status(401).json({ message: "Error getting SAM.gov data" });
    });
});

// --- get an existing rebate form's schema and submission data from Forms.gov
router.get(
  "/rebate-form-submission/:id",
  checkCsbEnrollmentPeriod,
  verifyMongoObjectId,
  checkBapComboKeys,
  async (req, res) => {
    const id = req.params.id;

    axiosFormio(req)
      .get(`${formioProjectUrl}/${formioFormName}/submission/${id}`)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => {
        axiosFormio(req)
          .get(`${formioProjectUrl}/form/${submission.form}`)
          .then((axiosRes) => axiosRes.data)
          .then((schema) => {
            const { bap_hidden_entity_combo_key } = submission.data;

            if (!req.bapComboKeys.includes(bap_hidden_entity_combo_key)) {
              log({
                level: "warn",
                message: `User with email ${req.user.mail} attempted to access submission ${id} that they do not have access to.`,
                req,
              });

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
        res.status(error?.response?.status || 500).json({
          message: `Error getting Forms.gov rebate form submission ${id}`,
        });
      });
  }
);

// --- post an update to an existing draft rebate form submission to Forms.gov
router.post(
  "/rebate-form-submission/:id",
  checkCsbEnrollmentPeriod,
  verifyMongoObjectId,
  checkBapComboKeys,
  (req, res) => {
    const id = req.params.id;

    // Verify post data includes one of user's BAP combo keys
    if (
      !req.bapComboKeys.includes(req.body.data?.bap_hidden_entity_combo_key)
    ) {
      log({
        level: "error",
        message: `User with email ${req.user.mail} attempted to update existing form without a matching BAP combo key`,
        req,
      });
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Add custom metadata to track formio submissions from wrapper
    req.body.metadata = {
      ...req.body.metadata,
      ...formioCsbMetadata,
    };

    axiosFormio(req)
      .put(`${formioProjectUrl}/${formioFormName}/submission/${id}`, req.body)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => res.json(submission))
      .catch((error) => {
        res
          .status(error?.response?.status || 500)
          .json({ message: "Error updating Forms.gov rebate form submission" });
      });
  }
);

// --- post a new rebate form submission to Forms.gov
router.post(
  "/rebate-form-submission",
  checkCsbEnrollmentPeriod,
  checkBapComboKeys,
  (req, res) => {
    // Verify post data includes one of user's BAP combo keys
    if (
      !req.bapComboKeys.includes(req.body.data?.bap_hidden_entity_combo_key)
    ) {
      log({
        level: "error",
        message: `User with email ${req.user.mail} attempted to post new form without a matching BAP combo key`,
        req,
      });
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Add custom metadata to track formio submissions from wrapper
    req.body.metadata = {
      ...req.body.metadata,
      ...formioCsbMetadata,
    };

    axiosFormio(req)
      .post(`${formioProjectUrl}/${formioFormName}/submission`, req.body)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => res.json(submission))
      .catch((error) => {
        res
          .status(error?.response?.status || 500)
          .json({ message: "Error posting Forms.gov rebate form submission" });
      });
  }
);

// --- upload s3 file metadata to Forms.gov
router.post(
  "/:bapComboKey/storage/s3",
  checkCsbEnrollmentPeriod,
  checkBapComboKeys,
  (req, res) => {
    if (!req.bapComboKeys.includes(req.params.bapComboKey)) {
      log({
        level: "error",
        message: `User with email ${req.user.mail} attempted to upload file without a matching BAP combo key`,
        req,
      });
      return res.status(401).json({ message: "Unauthorized" });
    }

    axiosFormio(req)
      .post(`${formioProjectUrl}/${formioFormName}/storage/s3`, req.body)
      .then((axiosRes) => axiosRes.data)
      .then((fileMetadata) => res.json(fileMetadata))
      .catch((error) => {
        res
          .status(error?.response?.status || 500)
          .json({ message: "Error uploading Forms.gov file" });
      });
  }
);

// --- download s3 file metadata from Forms.gov
router.get("/:bapComboKey/storage/s3", checkBapComboKeys, (req, res) => {
  if (!req.bapComboKeys.includes(req.params.bapComboKey)) {
    log({
      level: "error",
      message: `User with email ${req.user.mail} attempted to download file without a matching BAP combo key`,
      req,
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  axiosFormio(req)
    .get(`${formioProjectUrl}/${formioFormName}/storage/s3`, {
      params: req.query,
    })
    .then((axiosRes) => axiosRes.data)
    .then((fileMetadata) => res.json(fileMetadata))
    .catch((error) => {
      res
        .status(error?.response?.status || 500)
        .json({ message: "Error downloading Forms.gov file" });
    });
});

// --- get all rebate form submissions from Forms.gov
router.get("/rebate-form-submissions", checkBapComboKeys, (req, res) => {
  // NOTE: Helpdesk users might not have any SAM.gov records associated with
  // their email address so we should not return any submissions to those users.
  // The only reason we explicitly need to do this is because there could be
  // some submissions without `bap_hidden_entity_combo_key` field values in the
  // forms.gov database – that will never be the case for submissions created
  // from this app, but there could be submissions created externally if someone
  // is testing posting data (e.g. from a REST client, or the Formio Viewer)
  if (req.bapComboKeys.length === 0) return res.json([]);

  const formioUserSubmissionsUrl =
    `${formioProjectUrl}/${formioFormName}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `&data.bap_hidden_entity_combo_key=${req.bapComboKeys.join(
      "&data.bap_hidden_entity_combo_key="
    )}`;

  axiosFormio(req)
    .get(formioUserSubmissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      res
        .status(error?.response?.status || 500)
        .json({ message: "Error getting Forms.gov rebate form submissions" });
    });
});

module.exports = router;
