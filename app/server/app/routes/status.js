const express = require("express");
// ---
const {
  axiosFormio,
  formioProjectUrl,
  formioFormName,
} = require("../config/formio");
const { getSamData } = require("../utilities/bap");

const router = express.Router();

router.get("/app", (req, res) => {
  res.json({ status: true });
});

router.get("/bap", (req, res) => {
  getSamData("CleanSchoolBus@erg.com", req)
    .then(() => {
      res.json({ status: true });
    })
    .catch(() => {
      res.json({ status: false });
    });
});

router.get("/form", (req, res) => {
  axiosFormio(req)
    .get(`${formioProjectUrl}/${formioFormName}`)
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
