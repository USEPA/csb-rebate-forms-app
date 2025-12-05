const express = require("express");

const router = express.Router();

router.use("/", require("./auth"));
router.use("/api/config/public", require("./configPublic"));
router.use("/api/config/private", require("./configPrivate"));
router.use("/api/user", require("./user"));
router.use("/api/bap", require("./bap"));
router.use("/api/formio/2022", require("./formio2022"));
router.use("/api/formio/2023", require("./formio2023"));
router.use("/api/formio/2024", require("./formio2024"));
router.use("/api/help", require("./help"));
router.use("/api/status", require("./status"));

module.exports = router;
