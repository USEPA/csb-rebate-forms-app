const express = require("express");

const router = express.Router();

router.use("/", require("./auth"));
router.use("/api/content", require("./content"));
router.use("/api/formio/nces", require("./formioNCES"));
router.use("/api/user", require("./user"));
router.use("/api/config", require("./config"));
router.use("/api/bap", require("./bap"));
router.use("/api/formio/2022", require("./formio2022"));
router.use("/api/formio/2023", require("./formio2023"));
router.use("/api/help", require("./help"));
router.use("/api/status", require("./status"));

module.exports = router;
