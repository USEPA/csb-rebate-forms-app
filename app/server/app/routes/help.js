const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formioApplicationFormUrl,
  formioPaymentRequestFormUrl,
  formioCloseOutFormUrl,
  formioCsbMetadata,
} = require("../config/formio");
const { ensureAuthenticated, ensureHelpdesk } = require("../middleware");
const log = require("../utilities/logger");

const applicationFormOpen = process.env.CSB_APPLICATION_FORM_OPEN === "true";
const paymentRequestFormOpen =
  process.env.CSB_PAYMENT_REQUEST_FORM_OPEN === "true";
const closeOutFormOpen = process.env.CSB_CLOSE_OUT_FORM_OPEN === "true";

const router = express.Router();

// confirm user is both authenticated and authorized with valid helpdesk roles
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

// --- get an existing form's submission data from Formio
router.get("/formio-submission/:formType/:id", (req, res) => {
  const { formType, id } = req.params;

  if (formType === "application") {
    const mongoId = id;

    // NOTE: verifyMongoObjectId middleware content:
    if (mongoId && !ObjectId.isValid(mongoId)) {
      const message = `MongoDB ObjectId validation error for: ${mongoId}`;
      return res.status(400).json({ message });
    }

    Promise.all([
      axiosFormio(req).get(`${formioApplicationFormUrl}/submission/${mongoId}`),
      axiosFormio(req).get(formioApplicationFormUrl),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submission, schema]) => {
        return res.json({
          formSchema: { url: formioApplicationFormUrl, json: schema },
          submission,
        });
      })
      .catch((error) => {
        const message = `Error getting Formio Application form submission ${mongoId}`;
        return res.status(error?.response?.status || 500).json({ message });
      });
  }

  if (formType === "payment-request") {
    const rebateId = id;

    const matchedPaymentRequestFormSubmissions =
      `${formioPaymentRequestFormUrl}/submission` +
      `?data.hidden_bap_rebate_id=${rebateId}` +
      `&select=_id`;

    Promise.all([
      axiosFormio(req).get(matchedPaymentRequestFormSubmissions),
      axiosFormio(req).get(formioPaymentRequestFormUrl),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submissions, schema]) => {
        const mongoId = submissions[0]._id;

        // NOTE: verifyMongoObjectId middleware content:
        if (mongoId && !ObjectId.isValid(mongoId)) {
          const message = `MongoDB ObjectId validation error for: ${mongoId}`;
          return res.status(400).json({ message });
        }

        // NOTE: We can't just use the returned submission data here because
        // Formio returns the string literal 'YES' instead of a base64 encoded
        // image string for signature fields when you query for all submissions
        // matching on a field's value (`/submission?data.hidden_bap_rebate_id=${rebateId}`).
        // We need to query for a specific submission (e.g. `/submission/${mongoId}`),
        // to have Formio return the correct signature field data.
        axiosFormio(req)
          .get(`${formioPaymentRequestFormUrl}/submission/${mongoId}`)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => {
            return res.json({
              formSchema: { url: formioPaymentRequestFormUrl, json: schema },
              submission,
            });
          });
      })
      .catch((error) => {
        const message = `Error getting Formio Payment Request form submission ${rebateId}`;
        res.status(error?.response?.status || 500).json({ message });
      });
  }

  if (formType === "close-out") {
    // TODO
  }
});

// --- change a submitted Formio form's submission state back to draft
router.post("/formio-submission/:formType/:id", (req, res) => {
  const { formType, id } = req.params;
  const { mail } = req.user;

  if (formType === "application") {
    if (!applicationFormOpen) {
      const message = `CSB Application form enrollment period is closed`;
      return res.status(400).json({ message });
    }

    const mongoId = id;

    // NOTE: verifyMongoObjectId middleware content:
    if (mongoId && !ObjectId.isValid(mongoId)) {
      const message = `MongoDB ObjectId validation error for: ${mongoId}`;
      return res.status(400).json({ message });
    }

    Promise.all([
      axiosFormio(req).get(`${formioApplicationFormUrl}/submission/${mongoId}`),
      axiosFormio(req).get(formioApplicationFormUrl),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submission, schema]) => {
        axiosFormio(req)
          .put(`${formioApplicationFormUrl}/submission/${mongoId}`, {
            state: "draft",
            data: { ...submission.data, last_updated_by: mail },
            metadata: { ...submission.metadata, ...formioCsbMetadata },
          })
          .then((axiosRes) => axiosRes.data)
          .then((updatedSubmission) => {
            const message = `User with email ${mail} updated Application form submission ${mongoId} from submitted to draft.`;
            log({ level: "info", message, req });

            return res.json({
              formSchema: { url: formioApplicationFormUrl, json: schema },
              submission: updatedSubmission,
            });
          });
      })
      .catch((error) => {
        const message = `Error updating Formio Application form submission ${mongoId}`;
        res.status(error?.response?.status || 500).json({ message });
      });
  }

  if (formType === "payment-request") {
    if (!paymentRequestFormOpen) {
      const message = `CSB Payment Request form enrollment period is closed`;
      return res.status(400).json({ message });
    }

    const rebateId = id;

    const matchedPaymentRequestFormSubmissions =
      `${formioPaymentRequestFormUrl}/submission` +
      `?data.hidden_bap_rebate_id=${rebateId}`;

    Promise.all([
      axiosFormio(req).get(matchedPaymentRequestFormSubmissions),
      axiosFormio(req).get(formioPaymentRequestFormUrl),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submissions, schema]) => {
        const submission = submissions[0];
        const mongoId = submission._id;

        // NOTE: verifyMongoObjectId middleware content:
        if (mongoId && !ObjectId.isValid(mongoId)) {
          const message = `MongoDB ObjectId validation error for: ${mongoId}`;
          return res.status(400).json({ message });
        }

        axiosFormio(req)
          .put(`${formioPaymentRequestFormUrl}/submission/${mongoId}`, {
            state: "draft",
            data: { ...submission.data, hidden_current_user_email: mail },
            metadata: { ...submission.metadata, ...formioCsbMetadata },
          })
          .then((axiosRes) => axiosRes.data)
          .then((updatedSubmission) => {
            const message = `User with email ${mail} updated Payment Request form submission ${rebateId} from submitted to draft.`;
            log({ level: "info", message, req });

            return res.json({
              formSchema: { url: formioPaymentRequestFormUrl, json: schema },
              submission: updatedSubmission,
            });
          });
      })
      .catch((error) => {
        const message = `Error getting Formio Payment Request form submission ${rebateId}`;
        res.status(error?.response?.status || 500).json({ message });
      });
  }

  if (formType === "close-out") {
    if (!closeOutFormOpen) {
      const message = `CSB Close Out form enrollment period is closed`;
      return res.status(400).json({ message });
    }

    // TODO
  }
});

module.exports = router;
