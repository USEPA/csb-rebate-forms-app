const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formUrl,
  formioCSBMetadata,
  formioExampleRebateId,
  formioNoUserAccess,
} = require("../config/formio");
const {
  ensureAuthenticated,
  storeBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const { checkFormSubmissionPeriodAndBapStatus } = require("../utilities/bap");
const {
  uploadS3FileMetadata,
  downloadS3FileMetadata,
  //
  fetchFRFSubmissions,
  createFRFSubmission,
  fetchFRFSubmission,
  updateFRFSubmission,
  //
  fetchPRFSubmissions,
  createPRFSubmission,
  fetchPRFSubmission,
  updatePRFSubmission,
  deletePRFSubmission,
  //
  fetchCRFSubmissions,
  createCRFSubmission,
  // fetchCRFSubmission,
  // updateCRFSubmission,
} = require("../utilities/formio");
const log = require("../utilities/logger");

const formioCRFUrl = formUrl["2022"].crf;

const rebateYear = "2022";
const router = express.Router();

router.use(ensureAuthenticated);

// --- download Formio S3 file metadata
router.get(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    downloadS3FileMetadata({ rebateYear, req, res });
  },
);

// --- upload Formio S3 file metadata
router.post(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    uploadS3FileMetadata({ rebateYear, req, res });
  },
);

// --- get user's 2022 FRF submissions from Formio
router.get("/frf-submissions", storeBapComboKeys, (req, res) => {
  fetchFRFSubmissions({ rebateYear, req, res });
});

// --- post a new 2022 FRF submission to Formio
router.post("/frf-submission", storeBapComboKeys, (req, res) => {
  createFRFSubmission({ rebateYear, req, res });
});

// --- get an existing 2022 FRF's schema and submission data from Formio
router.get(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    fetchFRFSubmission({ rebateYear, req, res });
  },
);

// --- post an update to an existing draft 2022 FRF submission to Formio
router.post(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    updateFRFSubmission({ rebateYear, req, res });
  },
);

// --- get user's 2022 PRF submissions from Formio
router.get("/prf-submissions", storeBapComboKeys, (req, res) => {
  fetchPRFSubmissions({ rebateYear, req, res });
});

// --- post a new 2022 PRF submission to Formio
router.post("/prf-submission", storeBapComboKeys, (req, res) => {
  createPRFSubmission({ rebateYear, req, res });
});

// --- get an existing 2022 PRF's schema and submission data from Formio
router.get("/prf-submission/:rebateId", storeBapComboKeys, async (req, res) => {
  fetchPRFSubmission({ rebateYear, req, res });
});

// --- post an update to an existing draft 2022 PRF submission to Formio
router.post("/prf-submission/:rebateId", storeBapComboKeys, (req, res) => {
  updatePRFSubmission({ rebateYear, req, res });
});

// --- delete an existing 2022 PRF submission from Formio
router.post("/delete-prf-submission", storeBapComboKeys, (req, res) => {
  deletePRFSubmission({ rebateYear, req, res });
});

// --- get user's 2022 CRF submissions from Formio
router.get("/crf-submissions", storeBapComboKeys, (req, res) => {
  fetchCRFSubmissions({ rebateYear, req, res });
});

// --- post a new 2022 CRF submission to Formio
router.post("/crf-submission", storeBapComboKeys, (req, res) => {
  createCRFSubmission({ rebateYear, req, res });
});

// --- get an existing 2022 CRF's schema and submission data from Formio
router.get("/crf-submission/:rebateId", storeBapComboKeys, async (req, res) => {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)

  // NOTE: included to support EPA API scan
  if (rebateId === formioExampleRebateId) {
    return res.json(formioNoUserAccess);
  }

  const matchedCRFSubmissions =
    `${formioCRFUrl}/submission` +
    `?data.hidden_bap_rebate_id=${rebateId}` +
    `&select=_id,data.bap_hidden_entity_combo_key`;

  Promise.all([
    axiosFormio(req).get(matchedCRFSubmissions),
    axiosFormio(req).get(formioCRFUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submissions, schema]) => {
      if (submissions.length === 0) {
        return res.json(formioNoUserAccess);
      }

      const submission = submissions[0];
      const mongoId = submission._id;
      const comboKey = submission.data.bap_hidden_entity_combo_key;

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access CRF submission '${rebateId}' ` +
          `that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json(formioNoUserAccess);
      }

      /** NOTE: verifyMongoObjectId */
      if (mongoId && !ObjectId.isValid(mongoId)) {
        const errorStatus = 400;
        const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /**
       * NOTE: We can't just use the returned submission data here because
       * Formio returns the string literal 'YES' instead of a base64 encoded
       * image string for signature fields when you query for all submissions
       * matching on a field's value (`/submission?data.hidden_bap_rebate_id=${rebateId}`).
       * We need to query for a specific submission (e.g. `/submission/${mongoId}`),
       * to have Formio return the correct signature field data.
       */
      axiosFormio(req)
        .get(`${formioCRFUrl}/submission/${mongoId}`)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => {
          return res.json({
            userAccess: true,
            formSchema: { url: formioCRFUrl, json: schema },
            submission,
          });
        });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio Close Out form submission '${rebateId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- post an update to an existing draft 2022 CRF submission to Formio
router.post("/crf-submission/:rebateId", storeBapComboKeys, (req, res) => {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)
  const { mongoId, submission } = body;

  // NOTE: included to support EPA API scan
  if (rebateId === formioExampleRebateId) {
    return res.json({});
  }

  if (!mongoId || !submission) {
    const errorStatus = 400;
    const errorMessage = `Missing required data to update ${rebateYear} CRF submission '${rebateId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const comboKey = submission.data?.bap_hidden_entity_combo_key;

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType: "crf",
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to update CRF submission '${rebateId}' ` +
          `without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /** NOTE: verifyMongoObjectId */
      if (mongoId && !ObjectId.isValid(mongoId)) {
        const errorStatus = 400;
        const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /**  Add custom metadata to track formio submissions from wrapper. */
      submission.metadata = {
        ...submission.metadata,
        ...formioCSBMetadata,
      };

      axiosFormio(req)
        .put(`${formioCRFUrl}/submission/${mongoId}`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error updating Formio Close Out form submission '${rebateId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      const logMessage =
        `User with email '${mail}' attempted to update CRF submission '${rebateId}' ` +
        `when the CSB CRF enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `CSB Close Out form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

module.exports = router;
