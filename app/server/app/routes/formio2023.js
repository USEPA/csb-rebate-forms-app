const express = require("express");
// ---
const {
  ensureAuthenticated,
  fetchBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const {
  checkVIN,
  searchNcesData,
  getRebateContacts,
  //
  downloadFileFromS3,
  uploadFileToS3,
  deleteFileFromS3,
  //
  fetchSubmissionPDF,
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
  fetchCRFSubmission,
  updateCRFSubmission,
  //
  fetchChangeRequests,
  fetchChangeRequestSchema,
  createChangeRequest,
  fetchChangeRequest,
} = require("../utilities/formio");

const rebateYear = "2023";
const router = express.Router();

router.use(ensureAuthenticated);

// --- check for duplicate VINs in the BAP
router.get("/check-vin{/:vin}", (req, res) => {
  checkVIN({ rebateYear, req, res });
});

// --- search 2023 NCES data with the provided NCES ID and return a match
router.get("/nces{/:searchText}", (req, res) => {
  searchNcesData({ rebateYear, req, res });
});

// --- get contacts associated with a provided CSB Rebate ID
router.get("/contacts{/:rebateId}", (req, res) => {
  getRebateContacts({ rebateYear, req, res });
});

// --- download Formio file attachment from S3
router.get(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  fetchBapComboKeys,
  (req, res) => {
    downloadFileFromS3({ rebateYear, req, res });
  },
);

// --- upload Formio file attachment to S3
router.post(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  fetchBapComboKeys,
  (req, res) => {
    uploadFileToS3({ rebateYear, req, res });
  },
);

// --- delete Formio file attachment from S3
router.delete(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  fetchBapComboKeys,
  (req, res) => {
    deleteFileFromS3({ rebateYear, req, res });
  },
);

// --- get a PDF of a 2023 form submission from Formio
router.get("/pdf/:formType/:mongoId", fetchBapComboKeys, (req, res) => {
  fetchSubmissionPDF({ rebateYear, req, res });
});

// --- get user's 2023 FRF submissions from Formio
router.get("/frf-submissions", fetchBapComboKeys, (req, res) => {
  fetchFRFSubmissions({ rebateYear, req, res });
});

// --- post a new 2023 FRF submission to Formio
router.post("/frf-submission", fetchBapComboKeys, (req, res) => {
  createFRFSubmission({ rebateYear, req, res });
});

// --- get an existing 2023 FRF's schema and submission data from Formio
router.get(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  fetchBapComboKeys,
  (req, res) => {
    fetchFRFSubmission({ rebateYear, req, res });
  },
);

// --- post an update to an existing draft 2023 FRF submission to Formio
router.post(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  fetchBapComboKeys,
  (req, res) => {
    updateFRFSubmission({ rebateYear, req, res });
  },
);

// --- get user's 2023 PRF submissions from Formio
router.get("/prf-submissions", fetchBapComboKeys, (req, res) => {
  fetchPRFSubmissions({ rebateYear, req, res });
});

// --- post a new 2023 PRF submission to Formio
router.post("/prf-submission", fetchBapComboKeys, (req, res) => {
  createPRFSubmission({ rebateYear, req, res });
});

// --- get an existing 2023 PRF's schema and submission data from Formio
router.get("/prf-submission/:rebateId", fetchBapComboKeys, (req, res) => {
  fetchPRFSubmission({ rebateYear, req, res });
});

// --- post an update to an existing draft 2023 PRF submission to Formio
router.post("/prf-submission/:rebateId", fetchBapComboKeys, (req, res) => {
  updatePRFSubmission({ rebateYear, req, res });
});

// --- delete an existing 2023 PRF submission from Formio
router.post("/delete-prf-submission", fetchBapComboKeys, (req, res) => {
  deletePRFSubmission({ rebateYear, req, res });
});

// --- get user's 2023 CRF submissions from Formio
router.get("/crf-submissions", fetchBapComboKeys, (req, res) => {
  fetchCRFSubmissions({ rebateYear, req, res });
});

// --- post a new 2023 CRF submission to Formio
router.post("/crf-submission", fetchBapComboKeys, (req, res) => {
  createCRFSubmission({ rebateYear, req, res });
});

// --- get an existing 2023 CRF's schema and submission data from Formio
router.get("/crf-submission/:rebateId", fetchBapComboKeys, (req, res) => {
  fetchCRFSubmission({ rebateYear, req, res });
});

// --- post an update to an existing draft 2023 CRF submission to Formio
router.post("/crf-submission/:rebateId", fetchBapComboKeys, (req, res) => {
  updateCRFSubmission({ rebateYear, req, res });
});

// --- get user's 2023 Change Request form submissions from Formio
router.get("/changes", fetchBapComboKeys, (req, res) => {
  fetchChangeRequests({ rebateYear, req, res });
});

// --- get the 2023 Change Request form's schema from Formio
router.get("/change", fetchBapComboKeys, (req, res) => {
  fetchChangeRequestSchema({ rebateYear, req, res });
});

// --- post a new 2023 Change Request form submission to Formio
router.post("/change", fetchBapComboKeys, (req, res) => {
  createChangeRequest({ rebateYear, req, res });
});

// --- get an existing 2023 Change Request form's schema and submission data from Formio
router.get("/change/:mongoId", fetchBapComboKeys, (req, res) => {
  fetchChangeRequest({ rebateYear, req, res });
});

module.exports = router;
