const express = require("express");
// ---
const { ensureAuthenticated } = require("../middleware");

const router = express.Router();

router.use(ensureAuthenticated);

// --- get user data from EPA Gateway/Login.gov
router.get("/", (req, res) => {
  const { mail, memberof, exp } = req.user;
  return res.json({ mail, memberof, exp });
});

module.exports = router;
