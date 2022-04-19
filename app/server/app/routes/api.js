const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default;
// ---
const {
  formioProjectUrl,
  formioFormId,
  formioHeaders,
} = require("../config/formio");
const {
  ensureAuthenticated,
  ensureHelpdesk,
  checkBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const { getSamData } = require("../utilities/getSamData");
const logger = require("../utilities/logger");

const log = logger.logger;

const router = express.Router();

// --- get static content from S3
router.get("/content", (req, res) => {
  const s3Bucket = process.env.S3_PUBLIC_BUCKET;
  const s3Region = process.env.S3_PUBLIC_REGION;

  // NOTE: static content files found in `app/server/app/config/` directory
  const filenames = [
    "site-alert.md",
    "helpdesk-intro.md",
    "all-rebate-forms-intro.md",
    "all-rebate-forms-outro.md",
    "new-rebate-form-dialog.md",
    "existing-draft-rebate-form-intro.md",
    "existing-submitted-rebate-form-intro.md",
  ];

  const s3BucketUrl = `https://${s3Bucket}.s3-${s3Region}.amazonaws.com`;

  Promise.all(
    filenames.map((filename) => {
      // local development: read files directly from disk
      // production: fetch files from the public s3 bucket
      return process.env.NODE_ENV === "development"
        ? readFile(resolve(__dirname, "../content", filename), "utf8")
        : axios.get(`${s3BucketUrl}/content/${filename}`);
    })
  )
    .then((stringsOrResponses) => {
      // local development: no further processing of strings needed
      // production: get data from responses
      return process.env.NODE_ENV === "development"
        ? stringsOrResponses
        : stringsOrResponses.map((axiosRes) => axiosRes.data);
    })
    .then((data) => {
      res.json({
        siteAlert: data[0],
        helpdeskIntro: data[1],
        allRebateFormsIntro: data[2],
        allRebateFormsOutro: data[3],
        newRebateFormDialog: data[4],
        existingDraftRebateFormIntro: data[5],
        existingSubmittedRebateFormIntro: data[6],
      });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        log.debug(error.toJSON());
      }

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
  getSamData(req.user.mail)
    .then((samUserData) => {
      const userRoles = req.user.memberof.split(",");
      const helpdeskUser =
        userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk");

      // First check if user has at least one associated UEI before completing login process
      // If user has admin or helpdesk role, return empty array but still allow app use
      if (!helpdeskUser && samUserData?.length === 0) {
        log.error(
          `User with email ${req.user.mail} tried to use app without any associated SAM records.`
        );

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
    .catch((err) => {
      log.error(err);
      res.status(401).json({ message: "Error getting SAM.gov data" });
    });
});

// --- get the rebate form schema from Forms.gov
router.get("/rebate-form-schema", (req, res) => {
  axios
    .get(`${formioProjectUrl}/${formioFormId}`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((schema) =>
      res.json({
        url: `${formioProjectUrl}/${formioFormId}`,
        json: schema,
      })
    )
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        log.debug(error.toJSON());
      }

      res
        .status(error?.response?.status || 500)
        .json({ message: "Error getting Forms.gov rebate form schema" });
    });
});

// --- get an existing rebate form's schema and submission data from Forms.gov
router.get(
  "/rebate-form-submission/:id",
  verifyMongoObjectId,
  checkBapComboKeys,
  async (req, res) => {
    const id = req.params.id;

    axios
      .get(
        `${formioProjectUrl}/${formioFormId}/submission/${id}`,
        formioHeaders
      )
      .then((axiosRes) => axiosRes.data)
      .then((submission) => {
        axios
          .get(`${formioProjectUrl}/form/${submission.form}`, formioHeaders)
          .then((axiosRes) => axiosRes.data)
          .then((schema) => {
            const { bap_hidden_entity_combo_key } = submission.data;

            if (!req.bapComboKeys.includes(bap_hidden_entity_combo_key)) {
              log.warn(
                `User with email ${req.user.mail} attempted to access submission ${id} that they do not have access to.`
              );

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
        if (typeof error.toJSON === "function") {
          log.debug(error.toJSON());
        }

        log.error(
          `User with email ${req.user.mail} attempted to access submission ${id} that does not exist.`
        );

        res.status(error?.response?.status || 500).json({
          message: `Error getting Forms.gov rebate form submission ${id}`,
        });
      });
  }
);

// --- post an update to an existing draft rebate form submission to Forms.gov
router.post(
  "/rebate-form-submission/:id",
  verifyMongoObjectId,
  checkBapComboKeys,
  (req, res) => {
    const id = req.params.id;

    // Verify post data includes one of user's BAP combo keys
    if (
      !req.bapComboKeys.includes(req.body.data?.bap_hidden_entity_combo_key)
    ) {
      log.error(
        `User with email ${req.user.mail} attempted to update existing form without a matching BAP combo key`
      );
      return res.status(401).json({ message: "Unauthorized" });
    }

    axios
      .put(
        `${formioProjectUrl}/${formioFormId}/submission/${id}`,
        req.body,
        formioHeaders
      )
      .then((axiosRes) => axiosRes.data)
      .then((submission) => res.json(submission))
      .catch((error) => {
        if (typeof error.toJSON === "function") {
          log.debug(error.toJSON());
        }

        res
          .status(error?.response?.status || 500)
          .json({ message: "Error updating Forms.gov rebate form submission" });
      });
  }
);

// --- post a new rebate form submission to Forms.gov
router.post("/rebate-form-submission", checkBapComboKeys, (req, res) => {
  // Verify post data includes one of user's BAP combo keys
  if (!req.bapComboKeys.includes(req.body.data?.bap_hidden_entity_combo_key)) {
    log.error(
      `User with email ${req.user.mail} attempted to post new form without a matching BAP combo key`
    );
    return res.status(401).json({ message: "Unauthorized" });
  }

  axios
    .post(
      `${formioProjectUrl}/${formioFormId}/submission`,
      req.body,
      formioHeaders
    )
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        log.debug(error.toJSON());
      }

      res
        .status(error?.response?.status || 500)
        .json({ message: "Error posting Forms.gov rebate form submission" });
    });
});

// --- get all rebate form submissions from Forms.gov
router.get("/rebate-form-submissions", checkBapComboKeys, (req, res) => {
  const formioUserSubmissionsUrl =
    `${formioProjectUrl}/${formioFormId}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `&data.bap_hidden_entity_combo_key=${req.bapComboKeys.join(
      "&data.bap_hidden_entity_combo_key="
    )}`;

  axios
    .get(formioUserSubmissionsUrl, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        log.debug(error.toJSON());
      }

      res.status(error?.response?.status || 500).json({
        message: "Error getting Forms.gov rebate form submissions",
      });
    });
});

module.exports = router;
