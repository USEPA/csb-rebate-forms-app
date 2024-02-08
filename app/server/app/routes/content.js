const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default || require("axios"); // TODO: https://github.com/axios/axios/issues/5011
// ---
const log = require("../utilities/logger");

const { NODE_ENV, S3_PUBLIC_BUCKET, S3_PUBLIC_REGION } = process.env;

const router = express.Router();

// --- get static content from S3
router.get("/", (req, res) => {
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
    "change-request-intro.md",
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
    }),
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
        changeRequestIntro: data[11],
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

module.exports = router;
