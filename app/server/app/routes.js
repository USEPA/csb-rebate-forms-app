const express = require("express");

const router = express.Router();

router.use((req, res, next) => {
  // TODO: apply any route specific middleware here as needed
  next();
});

router.get("/status", (req, res, next) => {
  res.json({ running: true });
});

module.exports = router;
