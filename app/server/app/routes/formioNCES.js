const express = require("express");
// ---
const log = require("../utilities/logger");

const { FORMIO_NCES_API_KEY } = process.env;

const router = express.Router();

// --- Search the NCES data with the provided NCES ID and return a match
router.get("/:searchText?", (req, res) => {
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

  const result = req.app.locals.ncesData.find((item) => {
    return item["NCES ID"] === searchText;
  });

  const logMessage =
    `NCES data searched with NCES ID '${searchText}' resulting in ` +
    `${result ? "a match" : "no matches"}.`;
  log({ level: "info", message: logMessage, req });

  return res.json({ ...result });
});

module.exports = router;
