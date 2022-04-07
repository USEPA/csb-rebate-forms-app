const express = require("express");
const axios = require("axios").default;
// ---
const {
  formioProjectUrl,
  formioFormId,
  formioHeaders,
} = require("../config/formio");
const { ensureAuthenticated } = require("../middleware");
const logger = require("../utilities/logger");

const log = logger.logger;

const router = express.Router();

// TODO: update authentication check to restrict these API calls to users in the correct EPA WAA groups
router.use(ensureAuthenticated);

// --- get an existing rebate form's submission data from Forms.gov
router.get("/rebate-form-submission/:id", (req, res) => {
  const id = req.params.id;

  axios
    .get(`${formioProjectUrl}/${formioFormId}/submission/${id}`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => {
      res.json(submission);
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res.status(error?.response?.status || 500).json({
        message: `Error getting Forms.gov rebate form submission ${id}`,
      });
    });
});

// --- change a submitted Forms.gov rebate form's submission back to 'draft'
router.post("/rebate-form-submission/:id", (req, res) => {
  const id = req.params.id;

  axios
    .put(
      `${formioProjectUrl}/${formioFormId}/submission/${id}`,
      req.body,
      formioHeaders
    )
    .then((axiosRes) => axiosRes.data)
    .then((submission) => {
      log.info(
        `User with email ${req.user.mail} updated rebate form submission ${id} from submitted to draft.`
      );

      res.json(submission);
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res
        .status(error?.response?.status || 500)
        .json({ message: "Error updating Forms.gov rebate form submission" });
    });
});

module.exports = router;
