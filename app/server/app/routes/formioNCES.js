// const { resolve } = require("node:path");
// const { readFile } = require("node:fs/promises");
const express = require("express");
// const axios = require("axios").default || require("axios"); // TODO: https://github.com/axios/axios/issues/5011
// ---
const log = require("../utilities/logger");
const data = require("../content/nces.json");

// const { NODE_ENV, S3_PUBLIC_BUCKET, S3_PUBLIC_REGION } = process.env;

const router = express.Router();

// --- Search the NCES data with the provided NCES ID and return a match
router.get("/:searchText", async (req, res) => {
  const { searchText } = req.params;

  // const s3BucketUrl = `https://${S3_PUBLIC_BUCKET}.s3-${S3_PUBLIC_REGION}.amazonaws.com`;

  // const data = JSON.parse(
  //   await (NODE_ENV === "development"
  //     ? readFile(resolve(__dirname, "../content", "nces.json"), "utf8")
  //     : axios.get(`${s3BucketUrl}/content/nces.json`).then((res) => res.data))
  // );

  const result = data.find((item) => item["NCES District ID"] === searchText);

  const logMessage =
    `NCES data searched with NCES ID '${searchText}' resulting in ` +
    `${result ? "a match" : "no results"}.`;
  log({ level: "info", message: logMessage, req });

  return res.json({ ...result });
});

module.exports = router;
