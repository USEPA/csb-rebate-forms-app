const express = require("express");

const router = express.Router();

router.use("/", require("./auth"));
router.use("/api", require("./api"));
router.use("/api/content", require("./content"));
router.use("/api/formio/2022", require("./formio2022"));
router.use("/help", require("./help"));
router.use("/status", require("./status"));

module.exports = router;
