const express = require("express");
const axios = require("axios").default;
// ---
const {
  formioProjectUrl,
  formioFormId,
  formioHeaders,
} = require("../config/formio");
const {
  ensureAuthenticated,
  ensureHelpdesk,
  verifyMongoObjectId,
} = require("../middleware");
const logger = require("../utilities/logger");

const log = logger.logger;

const router = express.Router();

// Confirm user is both authenticated and authorized with valid helpdesk roles
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

// --- get an existing rebate form's submission data from Forms.gov
router.get("/rebate-form-submission/:id", verifyMongoObjectId, (req, res) => {
  const id = req.params.id;

  axios
    .get(`${formioProjectUrl}/${formioFormId}/submission/${id}`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => {
      res.json(submission);
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        log.debug(error.toJSON());
      }

      res.status(error?.response?.status || 500).json({
        message: `Error getting Forms.gov rebate form submission ${id}`,
      });
    });
});

// --- change a submitted Forms.gov rebate form's submission back to 'draft'
router.post("/rebate-form-submission/:id", verifyMongoObjectId, (req, res) => {
  const id = req.params.id;
  const formioSubmissionUrl = `${formioProjectUrl}/${formioFormId}/submission/${id}`;

  axios
    .get(formioSubmissionUrl, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => {
      axios
        .put(formioSubmissionUrl, req.body, formioHeaders)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => {
          log.info(
            `User with email ${req.user.mail} updated rebate form submission ${id} from submitted to draft.`
          );

          res.json(submission);
        });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        log.debug(error.toJSON());
      }

      res.status(error?.response?.status || 500).json({
        message: `Error updating Forms.gov rebate form submission ${id}`,
      });
    });
});

module.exports = router;
