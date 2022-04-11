const express = require("express");
const ObjectId = require("mongodb").ObjectId;
const axios = require("axios").default;
// ---
const {
  formioProjectUrl,
  formioFormId,
  formioHeaders,
} = require("../config/formio");
const { ensureAuthenticated, ensureHelpdesk } = require("../middleware");
const logger = require("../utilities/logger");

const log = logger.logger;

const router = express.Router();

// Confirm user is both authenticated and authorized with valid helpdesk roles
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

// --- get an existing rebate form's submission data from Forms.gov
router.get("/rebate-form-submission/:id", (req, res) => {
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      message: `MongoDB ObjectId validation error for: ${id}`,
    });
  }

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
router.get("/reopen-rebate-form-submission/:id", (req, res) => {
  const id = req.params.id;
  const userEmail = req.user.mail;
  const formioSubmissionUrl = `${formioProjectUrl}/${formioFormId}/submission/${id}`;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      message: `MongoDB ObjectId validation error for: ${id}`,
    });
  }

  axios
    .get(formioSubmissionUrl, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => {
      axios
        .put(
          formioSubmissionUrl,
          {
            state: "draft",
            data: { ...submission.data, last_updated_by: userEmail },
          },
          formioHeaders
        )
        .then((axiosRes) => axiosRes.data)
        .then((submission) => {
          log.info(
            `User with email ${userEmail} updated rebate form submission ${id} from submitted to draft.`
          );

          res.json(submission);
        });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res.status(error?.response?.status || 500).json({
        message: `Error updating Forms.gov rebate form submission ${id}`,
      });
    });
});

module.exports = router;
