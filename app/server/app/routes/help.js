const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formio2022FRFUrl,
  formio2022PRFUrl,
  formio2022CRFUrl,
} = require("../config/formio");
const { ensureAuthenticated, ensureHelpdesk } = require("../middleware");
const { getBapFormSubmissionData } = require("../utilities/bap");

const router = express.Router();

/** Confirm user is both authenticated and authorized with valid helpdesk roles. */
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

// --- get an existing form's submission data from Formio
router.get("/formio/submission/:formType/:id", (req, res) => {
  const { formType, id } = req.params;

  const rebateId = id.length === 6 ? id : null;
  const mongoId = !rebateId ? id : null;

  /** NOTE: verifyMongoObjectId */
  if (mongoId && !ObjectId.isValid(mongoId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const formName =
    formType === "frf"
      ? "CSB Application"
      : formType === "prf"
      ? "CSB Payment Request"
      : formType === "crf"
      ? "CSB Close Out"
      : "CSB";

  const formUrl =
    formType === "frf"
      ? formio2022FRFUrl
      : formType === "prf"
      ? formio2022PRFUrl
      : formType === "crf"
      ? formio2022CRFUrl
      : null; // fallback

  return getBapFormSubmissionData(req, formType, rebateId, mongoId).then(
    (bapSubmission) => {
      if (!bapSubmission || !formUrl) {
        const logId = rebateId || mongoId;
        const errorStatus = 500;
        const errorMessage = `Error getting ${formName} submission '${logId}' from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      const {
        UEI_EFTI_Combo_Key__c,
        CSB_Form_ID__c,
        CSB_Modified_Full_String__c,
        CSB_Review_Item_ID__c,
        Parent_Rebate_ID__c,
        Record_Type_Name__c,
        Parent_CSB_Rebate__r,
      } = bapSubmission;

      return Promise.all([
        axiosFormio(req).get(`${formUrl}/submission/${CSB_Form_ID__c}`),
        axiosFormio(req).get(formUrl),
      ])
        .then((responses) => responses.map((axiosRes) => axiosRes.data))
        .then(([formioSubmission, schema]) => {
          return res.json({
            formSchema: { url: formUrl, json: schema },
            formio: formioSubmission,
            bap: {
              modified: CSB_Modified_Full_String__c, // ISO 8601 date time string
              comboKey: UEI_EFTI_Combo_Key__c, // UEI + EFTI combo key
              mongoId: CSB_Form_ID__c, // MongoDB Object ID
              rebateId: Parent_Rebate_ID__c, // CSB Rebate ID (6 digits)
              reviewItemId: CSB_Review_Item_ID__c, // CSB Rebate ID with form/version ID (9 digits)
              status:
                Record_Type_Name__c === "CSB Funding Request"
                  ? Parent_CSB_Rebate__r?.CSB_Funding_Request_Status__c
                  : Record_Type_Name__c === "CSB Payment Request"
                  ? Parent_CSB_Rebate__r?.CSB_Payment_Request_Status__c
                  : Record_Type_Name__c === "CSB Closeout Request"
                  ? Parent_CSB_Rebate__r?.CSB_Closeout_Request_Status__c
                  : "",
            },
          });
        })
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error getting ${formName} submission '${CSB_Form_ID__c}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    }
  );
});

module.exports = router;
