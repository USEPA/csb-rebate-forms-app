const express = require("express");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({ running: true });
});

router.use("/", require("./auth"));
router.use("/api/v1", require("./api"));

module.exports = router;
