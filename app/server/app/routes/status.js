const express = require("express");
// ---
const { getSamData } = require("../utilities/getSamData");
const logger = require("../utilities/logger");
const { default: axios } = require("axios");
const log = logger.logger;

const router = express.Router();

const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const formioApiKey = process.env.FORMIO_API_KEY;

const formioHeaders = { headers: { "x-token": formioApiKey } };

router.get("/app", (req, res) => {
  res.json({ status: true });
});

router.get("/bap", (req, res) => {
  getSamData("CleanSchoolBus@erg.com")
    .then(() => {
      res.json({ status: true });
    })
    .catch(() => {
      res.json({ status: false });
    });
});

router.get("/form", (req, res) => {
  axios
    .get(`${formioProjectUrl}/${formioFormId}`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((schema) =>
      // Verify that schema has type of form and a title exists (confirming formio returned a valid schema)
      res.json({ status: schema.type === "form" && !!schema.title })
    )
    .catch((error) => {
      log.error(error);
      res.json({ status: false });
    });
});

module.exports = router;
