const express = require("express");
// ---
const { ensureAuthenticated, storeBapComboKeys } = require("../middleware");
const {
  checkForBapDuplicates,
  getSamEntities,
  getBapFormSubmissionsStatuses,
} = require("../utilities/bap");
const log = require("../utilities/logger");

const { FORMIO_DUPLICATES_API_KEY } = process.env;

const router = express.Router();

// --- check for duplicate contacts or organizations in the BAP.
router.post("/duplicates", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", true);

  const apiKey = req.headers["x-api-key"];

  if (apiKey !== FORMIO_DUPLICATES_API_KEY) {
    const message = `Incorrect or missing Formio BAP Duplicates API key provided.`;
    log({ level: "error", message, req });

    const errorStatus = 400;
    return res.status(errorStatus).json({ message });
  }

  return checkForBapDuplicates(req)
    .then((duplicates) => res.json(duplicates))
    .catch((_error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error checking duplicates from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

router.use(ensureAuthenticated);

// --- get user's SAM.gov data from the BAP
router.get("/sam", (req, res) => {
  const { mail, memberof } = req.user;
  const userRoles = memberof.split(",");
  const adminOrHelpdeskUser =
    userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk");

  if (!mail) {
    const logMessage = `User with no email address attempted to fetch SAM.gov records.`;
    log({ level: "error", message: logMessage, req });

    return res.json({
      results: false,
      entities: [],
    });
  }

  getSamEntities(req, mail)
    .then((entities) => {
      /**
       * NOTE: allow admin or helpdesk users access to the app, even without
       * SAM.gov data.
       */
      if (!adminOrHelpdeskUser && entities?.length === 0) {
        const logMessage =
          `User with email '${mail}' attempted to use app ` +
          `without any associated SAM.gov records.`;
        log({ level: "error", message: logMessage, req });

        return res.json({
          results: false,
          entities: [],
        });
      }

      return res.json({
        results: true,
        entities,
      });
    })
    .catch((_error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting SAM.gov data from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get user's form submissions statuses from the BAP
router.get("/submissions", storeBapComboKeys, (req, res) => {
  return getBapFormSubmissionsStatuses(req)
    .then((submissions) => res.json(submissions))
    .catch((_error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting form submissions statuses from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

module.exports = router;
