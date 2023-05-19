const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formioApplicationFormUrl,
  formioPaymentRequestFormUrl,
  formioCloseOutFormUrl,
} = require("../config/formio");
const { ensureAuthenticated, ensureHelpdesk } = require("../middleware");
const { getBapFormSubmissionData } = require("../utilities/bap");

const router = express.Router();

/** Confirm user is both authenticated and authorized with valid helpdesk roles. */
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

// --- get an existing form's submission data from Formio
router.get("/formio-submission/:formType/:id", (req, res) => {
  const { formType, id } = req.params;

  const rebateId = id.length === 6 ? id : null;
  const mongoId = !rebateId ? id : null;

  /** NOTE: verifyMongoObjectId */
  if (mongoId && !ObjectId.isValid(mongoId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const formName =
    formType === "application"
      ? "CSB Application"
      : formType === "payment-request"
      ? "CSB Payment Request"
      : formType === "close-out"
      ? "CSB Close Out"
      : "CSB";

  const formUrl =
    formType === "application"
      ? formioApplicationFormUrl
      : formType === "payment-request"
      ? formioPaymentRequestFormUrl
      : formType === "close-out"
      ? formioCloseOutFormUrl
      : null; // fallback

  return getBapFormSubmissionData(req, formType, rebateId, mongoId).then(
    (bapSubmission) => {
      if (!bapSubmission || !formUrl) {
        const logId = rebateId || mongoId;
        const errorStatus = 500;
        const errorMessage = `Error getting ${formName} form submission '${logId}' from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      const { CSB_Form_ID__c } = bapSubmission;

      return Promise.all([
        axiosFormio(req).get(`${formUrl}/submission/${CSB_Form_ID__c}`),
        axiosFormio(req).get(formUrl),
      ])
        .then((responses) => responses.map((axiosRes) => axiosRes.data))
        .then(([submission, schema]) => {
          return res.json({
            formSchema: { url: formUrl, json: schema },
            submission,
          });
        })
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error getting ${formName} form submission '${CSB_Form_ID__c}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    }
  );
});

module.exports = router;
