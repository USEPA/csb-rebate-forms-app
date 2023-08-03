const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default || require("axios"); // TODO: https://github.com/axios/axios/issues/5011
// ---
const { submissionPeriodOpen } = require("../config/formio");
const { ensureAuthenticated, storeBapComboKeys } = require("../middleware");
const {
  getSamEntities,
  getBapFormSubmissionsStatuses,
} = require("../utilities/bap");
const log = require("../utilities/logger");

const { NODE_ENV, S3_PUBLIC_BUCKET, S3_PUBLIC_REGION } = process.env;

const router = express.Router();

// --- get static content from S3
router.get("/content", (req, res) => {
  /** NOTE: static content files found in `app/server/app/content/` directory. */
  const filenames = [
    "site-alert.md",
    "helpdesk-intro.md",
    "all-rebates-intro.md",
    "all-rebates-outro.md",
    "new-frf-dialog.md",
    "draft-frf-intro.md",
    "submitted-frf-intro.md",
    "draft-prf-intro.md",
    "submitted-prf-intro.md",
    "draft-crf-intro.md",
    "submitted-crf-intro.md",
  ];

  const s3BucketUrl = `https://${S3_PUBLIC_BUCKET}.s3-${S3_PUBLIC_REGION}.amazonaws.com`;

  Promise.all(
    filenames.map((filename) => {
      /**
       * local development: read files directly from disk
       * Cloud.gov: fetch files from the public s3 bucket
       */
      return NODE_ENV === "development"
        ? readFile(resolve(__dirname, "../content", filename), "utf8")
        : axios.get(`${s3BucketUrl}/content/${filename}`);
    })
  )
    .then((stringsOrResponses) => {
      /**
       * local development: no further processing of strings needed
       * Cloud.gov: get data from responses
       */
      return NODE_ENV === "development"
        ? stringsOrResponses
        : stringsOrResponses.map((axiosRes) => axiosRes.data);
    })
    .then((data) => {
      return res.json({
        siteAlert: data[0],
        helpdeskIntro: data[1],
        allRebatesIntro: data[2],
        allRebatesOutro: data[3],
        newFRFDialog: data[4],
        draftFRFIntro: data[5],
        submittedFRFIntro: data[6],
        draftPRFIntro: data[7],
        submittedPRFIntro: data[8],
        draftCRFIntro: data[9],
        submittedCRFIntro: data[10],
      });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        const logMessage = error.toJSON();
        log({ level: "debug", message: logMessage, req });
      }

      const errorStatus = error.response?.status || 500;
      const errorMethod = error.response?.config?.method?.toUpperCase();
      const errorUrl = error.response?.config?.url;

      const logMessage = `S3 Error: ${errorStatus} ${errorMethod} ${errorUrl}`;
      log({ level: "error", message: logMessage, req });

      const errorMessage = `Error getting static content from S3 bucket.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

router.use(ensureAuthenticated);

// --- get user data from EPA Gateway/Login.gov
router.get("/user", (req, res) => {
  const { mail, memberof, exp } = req.user;
  return res.json({ mail, memberof, exp });
});

// --- get CSB app specific configuration (form open enrollment status, etc.)
router.get("/config", (req, res) => {
  return res.json({ submissionPeriodOpen });
});

// --- get user's SAM.gov data from EPA's Business Automation Platform (BAP)
router.get("/bap-sam-data", (req, res) => {
  const { mail, memberof } = req.user;
  const userRoles = memberof.split(",");
  const adminOrHelpdeskUser =
    userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk");

  getSamEntities(req, mail)
    .then((entities) => {
      /**
       * NOTE: allow admin or helpdesk users access to the app, even without
       * SAM.gov data.
       */
      if (!adminOrHelpdeskUser && entities?.length === 0) {
        const logMessage =
          `User with email '${mail}' tried to use app ` +
          `without any associated SAM.gov records.`;
        log({ level: "error", message: logMessage, req });

        return res.json({
          results: false,
          entities: [],
        });
      }

      return res.json({
        results: true,
        entities,
      });
    })
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting SAM.gov data from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get user's form submissions statuses from EPA's BAP
router.get("/bap-form-submissions", storeBapComboKeys, (req, res) => {
  const { bapComboKeys } = req;

  return getBapFormSubmissionsStatuses(req, bapComboKeys)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting form submissions statuses from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

module.exports = router;
