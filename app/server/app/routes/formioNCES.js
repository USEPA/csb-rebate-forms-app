// const { resolve } = require("node:path");
// const { readFile } = require("node:fs/promises");
const express = require("express");
// const axios = require("axios").default || require("axios"); // TODO: https://github.com/axios/axios/issues/5011
// ---
const log = require("../utilities/logger");
const data = require("../content/nces.json");

const { FORMIO_NCES_API_KEY } = process.env;

// const { NODE_ENV, S3_PUBLIC_BUCKET, S3_PUBLIC_REGION } = process.env;

const router = express.Router();

// --- Search the NCES data with the provided NCES ID and return a match
router.get("/:searchText?", async (req, res) => {
  const { searchText } = req.params;
  const apiKey = req.headers["x-api-key"];

  if (apiKey !== FORMIO_NCES_API_KEY) {
    const message = `Incorrect or missing Formio NCES API key provided.`;
    log({ level: "error", message, req });

    const errorStatus = 400;
    return res.status(errorStatus).json({ message });
  }

  // const s3BucketUrl = `https://${S3_PUBLIC_BUCKET}.s3-${S3_PUBLIC_REGION}.amazonaws.com`;

  // const data = JSON.parse(
  //   await (NODE_ENV === "development"
  //     ? readFile(resolve(__dirname, "../content", "nces.json"), "utf8")
  //     : axios.get(`${s3BucketUrl}/content/nces.json`).then((res) => res.data))
  // );

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

  const result = data.find((item) => item["NCES District ID"] === searchText);

  const logMessage =
    `NCES data searched with NCES ID '${searchText}' resulting in ` +
    `${result ? "a match" : "no matches"}.`;
  log({ level: "info", message: logMessage, req });

  return res.json({ ...result });
});

module.exports = router;
