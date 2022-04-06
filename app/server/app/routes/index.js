const express = require("express");

const router = express.Router();

router.use("/", require("./auth"));
router.use("/api", require("./api"));
router.use("/status", require("./status"));

module.exports = router;
