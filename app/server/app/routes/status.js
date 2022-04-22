const express = require("express");
// ---
const {
  axiosFormio,
  formioProjectUrl,
  formioFormId,
} = require("../config/formio");
const { getSamData } = require("../utilities/getSamData");

const router = express.Router();

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
  axiosFormio
    .get(`${formioProjectUrl}/${formioFormId}`)
    .then((axiosRes) => axiosRes.data)
    .then((schema) =>
      // Verify that schema has type of form and a title exists (confirming formio returned a valid schema)
      res.json({ status: schema.type === "form" && !!schema.title })
    )
    .catch(() => {
      res.json({ status: false });
    });
});

module.exports = router;
