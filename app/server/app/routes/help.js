const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formioProjectUrl,
  formioApplicationFormPath,
  formioPaymentRequestFormPath,
  formioCsbMetadata,
} = require("../config/formio");
const { ensureAuthenticated, ensureHelpdesk } = require("../middleware");
const log = require("../utilities/logger");

const enrollmentClosed = process.env.CSB_ENROLLMENT_PERIOD !== "open";

const applicationFormApiPath = `${formioProjectUrl}/${formioApplicationFormPath}`;
const paymentRequestFormApiPath = `${formioProjectUrl}/${formioPaymentRequestFormPath}`;

const router = express.Router();

// confirm user is both authenticated and authorized with valid helpdesk roles
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

/**
 * Same functionality as the `verifyMongoObjectId` middleware, but stored in a
 * regular function (vs Express middleware) as it'll be called conditionally.
 * @param {string} mongoId
 * @param {express.Response} res
 */
function handleInvalidMongoObjectId(mongoId, res) {
  if (mongoId && !ObjectId.isValid(mongoId)) {
    const message = `MongoDB ObjectId validation error for: ${mongoId}`;
    return res.status(400).json({ message });
  }
}

// --- get an existing form's submission data from Forms.gov
router.get("/formio-submission/:formType/:id", (req, res) => {
  const { formType, id } = req.params;

  if (formType === "application") {
    const mongoId = id;

    handleInvalidMongoObjectId(mongoId, res);

    Promise.all([
      axiosFormio(req).get(`${applicationFormApiPath}/submission/${mongoId}`),
      axiosFormio(req).get(applicationFormApiPath),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submission, schema]) => {
        return res.json({
          formSchema: { url: applicationFormApiPath, json: schema },
          submission,
        });
      })
      .catch((error) => {
        const message = `Error getting Forms.gov Application form submission ${mongoId}`;
        return res.status(error?.response?.status || 500).json({ message });
      });
  }

  if (formType === "paymentRequest") {
    const rebateId = id;

    const matchedPaymentRequestFormSubmissions =
      `${paymentRequestFormApiPath}/submission` +
      `?data.hidden_bap_rebate_id=${rebateId}` +
      `&select=_id`;

    Promise.all([
      axiosFormio(req).get(matchedPaymentRequestFormSubmissions),
      axiosFormio(req).get(applicationFormApiPath),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submissions, schema]) => {
        const mongoId = submissions[0]._id;

        handleInvalidMongoObjectId(mongoId, res);

        // NOTE: We can't just use the returned submission data here because
        // Formio returns the string literal 'YES' instead of a base64 encoded
        // image string for any signature fields when you query for all
        // submissions matching on a field's value (`/submission?data.hidden_bap_rebate_id=${rebateId}`).
        // We need to query for a specific submission (e.g. `/submission/${mongoId}`),
        // to have Formio return the correct signature field data.
    axiosFormio(req)
          .get(`${paymentRequestFormApiPath}/submission/${mongoId}`)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => {
            return res.json({
              formSchema: { url: paymentRequestFormApiPath, json: schema },
              submission,
            });
          });
      })
      .catch((error) => {
        const message = `Error getting Forms.gov Payment Request form submission ${rebateId}`;
        res.status(error?.response?.status || 500).json({ message });
      });
  }
});

// --- change a submitted Forms.gov Application form's submission state back to draft
router.post(
  "/formio-application-submission/:mongoId",
  verifyMongoObjectId,
  (req, res) => {
    const { mongoId } = req.params;
    const { mail } = req.user;

    if (enrollmentClosed) {
      const message = `CSB enrollment period is closed`;
      return res.status(400).json({ message });
    }

    axiosFormio(req)
      .get(`${applicationFormApiPath}/submission/${mongoId}`)
      .then((axiosRes) => axiosRes.data)
      .then((existingSubmission) => {
        axiosFormio(req)
          .put(`${applicationFormApiPath}/submission/${mongoId}`, {
            state: "draft",
            data: { ...existingSubmission.data, last_updated_by: mail },
            metadata: { ...existingSubmission.metadata, ...formioCsbMetadata },
          })
          .then((axiosRes) => axiosRes.data)
          .then((updatedSubmission) => {
            const message = `User with email ${mail} updated Application form submission ${mongoId} from submitted to draft.`;
            log({ level: "info", message, req });

            axiosFormio(req)
              .get(`${formioProjectUrl}/form/${updatedSubmission.form}`)
              .then((axiosRes) => axiosRes.data)
              .then((schema) => {
                return res.json({
                  formSchema: {
                    url: `${formioProjectUrl}/form/${updatedSubmission.form}`,
                    json: schema,
                  },
                  submission: updatedSubmission,
                });
              });
          });
      })
      .catch((error) => {
        const message = `Error updating Forms.gov Application form submission ${mongoId}`;
        return res.status(error?.response?.status || 500).json({ message });
      });
  }
);

module.exports = router;
