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
  getBapDataForPRF,
  getBapDataForCRF,
  checkFormSubmissionPeriodAndBapStatus,
} = require("../utilities/bap");
const {
  uploadS3FileMetadata,
  downloadS3FileMetadata,
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
  }
);

// --- upload Formio S3 file metadata
router.post(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    uploadS3FileMetadata({ rebateYear: "2023", req, res });
  }
);

module.exports = router;
