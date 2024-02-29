const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const { axiosFormio, formUrl } = require("../config/formio");
const { ensureAuthenticated, storeBapComboKeys } = require("../middleware");
const log = require("../utilities/logger");

const router = express.Router();

router.use(ensureAuthenticated);

// --- Download a PDF of a submission
router.get("/:formId/:mongoId", storeBapComboKeys, (req, res) => {
  const { formId, mongoId } = req.params;

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(formId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${formId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(mongoId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  // TODO – get download token and download PDF
  res.json({ formId, mongoId });
});

module.exports = router;
