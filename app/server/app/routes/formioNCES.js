const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default || require("axios"); // TODO: https://github.com/axios/axios/issues/5011
// ---
const { s3BucketUrl } = require("../utilities/s3");
const log = require("../utilities/logger");

const { NODE_ENV, FORMIO_NCES_API_KEY } = process.env;

const router = express.Router();

// --- Search the NCES data with the provided NCES ID and return a match
router.get("/:searchText?", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", true);

  const { searchText } = req.params;
  const apiKey = req.headers["x-api-key"];

  if (apiKey !== FORMIO_NCES_API_KEY) {
    const message = `Incorrect or missing Formio NCES API key provided.`;
    log({ level: "error", message, req });

    const errorStatus = 400;
    return res.status(errorStatus).json({ message });
  }

  if (!searchText) {
    const logMessage = `No NCES ID passed to NCES data lookup.`;
    log({ level: "info", message: logMessage, req });

    return res.json({});
  }

  if (searchText.length !== 7) {
    const logMessage = `Invalid NCES ID '${searchText}' passed to NCES data lookup.`;
    log({ level: "info", message: logMessage, req });

    return res.json({});
  }

  const localFilePath = resolve(__dirname, "../content", "nces.json");
  const s3FileUrl = `${s3BucketUrl}/content/nces.json`;
  const logMessage = `Fetching NCES.json from S3 bucket.`;

  Promise.resolve(
    /**
     * local development: read file directly from disk
     * Cloud.gov: fetch file from the public s3 bucket
     */
    NODE_ENV === "development"
      ? readFile(localFilePath, "utf8").then((string) => JSON.parse(string))
      : (log({ level: "info", message: logMessage, req }),
        axios.get(s3FileUrl).then((res) => res.data)),
  )
    .then((data) => {
      const result = data.find((item) => item["NCES ID"] === searchText);

      const logMessage =
        `NCES data searched with NCES ID '${searchText}' resulting in ` +
        `${result ? "a match" : "no matches"}.`;
      log({ level: "info", message: logMessage, req });

      return res.json({ ...result });
    })
    .catch((error) => {
      const errorStatus = error.response?.status || 500;
      const errorMethod = error.response?.config?.method?.toUpperCase();
      const errorUrl = error.response?.config?.url;

      const logMessage = `S3 Error: ${errorStatus} ${errorMethod} ${errorUrl}`;
      log({ level: "error", message: logMessage, req });

      const errorMessage = `Error getting NCES.json data from S3 bucket.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

module.exports = router;
