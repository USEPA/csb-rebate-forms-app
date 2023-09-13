const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const { axiosFormio, formUrl } = require("../config/formio");
const { ensureAuthenticated, ensureHelpdesk } = require("../middleware");
const { getBapFormSubmissionData } = require("../utilities/bap");

const router = express.Router();

/** Confirm user is both authenticated and authorized with valid helpdesk roles. */
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

// --- get an existing form's submission data from Formio
router.get("/formio/:rebateYear/:formType/:id", (req, res) => {
  const { rebateYear, formType, id } = req.params;

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

  const formioFormUrl = formUrl[rebateYear][formType];

  /**
   * TODO: revisit `getBapFormSubmissionData()` to include rebateYear once BAP
   * supports 2023 FRF
   */
  if (rebateYear === "2023") {
    if (rebateId && !mongoId) {
      const errorStatus = 500;
      const errorMessage = `Error getting 2023 ${formName} submission '${rebateId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    }

    return Promise.all([
      axiosFormio(req).get(`${formioFormUrl}/submission/${mongoId}`),
      axiosFormio(req).get(formioFormUrl),
    ])
      .then((responses) => responses.map((axiosRes) => axiosRes.data))
      .then(([formioSubmission, schema]) => {
        return res.json({
          formSchema: { url: formioFormUrl, json: schema },
          formio: formioSubmission,
          bap: {
            modified: null,
            comboKey: null,
            mongoId: null,
            rebateId: null,
            reviewItemId: null,
            status: null,
          },
        });
      })
      .catch((error) => {
        // NOTE: error is logged in axiosFormio response interceptor
        const errorStatus = error.response?.status || 500;
        const errorMessage = `Error getting ${rebateYear} ${formName} submission '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }

  return getBapFormSubmissionData(req, formType, rebateId, mongoId).then(
    (bapSubmission) => {
      if (!bapSubmission || !formioFormUrl) {
        const logId = rebateId || mongoId;
        const errorStatus = 500;
        const errorMessage = `Error getting ${rebateYear} ${formName} submission '${logId}' from the BAP.`;
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
        axiosFormio(req).get(`${formioFormUrl}/submission/${CSB_Form_ID__c}`),
        axiosFormio(req).get(formioFormUrl),
      ])
        .then((responses) => responses.map((axiosRes) => axiosRes.data))
        .then(([formioSubmission, schema]) => {
          return res.json({
            formSchema: { url: formioFormUrl, json: schema },
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
                  : Record_Type_Name__c === "CSB Close Out Request"
                  ? Parent_CSB_Rebate__r?.CSB_Closeout_Request_Status__c
                  : "",
            },
          });
        })
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error getting ${rebateYear} ${formName} submission '${CSB_Form_ID__c}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    },
  );
});

module.exports = router;
