const express = require("express");
// ---
const { submissionPeriodOpen } = require("../config/formio");
const { ensureAuthenticated } = require("../middleware");

const router = express.Router();

router.use(ensureAuthenticated);

// --- get CSB app specific configuration (form open enrollment status, etc.)
router.get("/", (req, res) => {
  return res.json({ submissionPeriodOpen });
});

module.exports = router;
