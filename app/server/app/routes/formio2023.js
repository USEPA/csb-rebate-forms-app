const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formUrl,
  submissionPeriodOpen,
  formioCSBMetadata,
} = require("../config/formio");
const {
  ensureAuthenticated,
  storeBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const {
  getBapFormSubmissionsStatuses,
  getBapDataForCRF,
  checkFormSubmissionPeriodAndBapStatus,
} = require("../utilities/bap");
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
} = require("../utilities/formio");
const log = require("../utilities/logger");

const router = express.Router();

router.use(ensureAuthenticated);

// --- download Formio S3 file metadata
router.get(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    downloadS3FileMetadata({ rebateYear: "2023", req, res });
  },
);

// --- upload Formio S3 file metadata
router.post(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    uploadS3FileMetadata({ rebateYear: "2023", req, res });
  },
);

// --- get user's 2023 FRF submissions from Formio
router.get("/frf-submissions", storeBapComboKeys, (req, res) => {
  fetchFRFSubmissions({ rebateYear: "2023", req, res });
});

// --- post a new 2023 FRF submission to Formio
router.post("/frf-submission", storeBapComboKeys, (req, res) => {
  createFRFSubmission({ rebateYear: "2023", req, res });
});

// --- get an existing 2023 FRF's schema and submission data from Formio
router.get(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    fetchFRFSubmission({ rebateYear: "2023", req, res });
  },
);

// --- post an update to an existing draft 2023 FRF submission to Formio
router.post(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    updateFRFSubmission({ rebateYear: "2023", req, res });
  },
);

// --- get user's 2023 PRF submissions from Formio
router.get("/prf-submissions", storeBapComboKeys, (req, res) => {
  fetchPRFSubmissions({ rebateYear: "2023", req, res });
});

// --- post a new 2023 PRF submission to Formio
router.post("/prf-submission", storeBapComboKeys, (req, res) => {
  createPRFSubmission({ rebateYear: "2023", req, res });
});

// --- get an existing 2023 PRF's schema and submission data from Formio

// --- post an update to an existing draft 2023 PRF submission to Formio

// --- delete an existing 2023 PRF submission from Formio
router.post("/delete-prf-submission", storeBapComboKeys, (req, res) => {
  // TODO
});

// --- get user's 2022 CRF submissions from Formio
router.get("/crf-submissions", storeBapComboKeys, (req, res) => {
  // TODO
  res.json([]);
});

// --- post a new 2022 CRF submission to Formio

// --- get an existing 2022 CRF's schema and submission data from Formio

// --- post an update to an existing draft 2022 CRF submission to Formio

module.exports = router;
