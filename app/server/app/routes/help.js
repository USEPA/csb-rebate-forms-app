const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const { axiosFormio, formioProjectUrl, formUrl } = require("../config/formio");
const { ensureAuthenticated, ensureHelpdesk } = require("../middleware");
const { getBapFormSubmissionData } = require("../utilities/bap");

const router = express.Router();

/** Confirm user is both authenticated and authorized with valid helpdesk roles. */
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

// --- get an existing form's submission data from Formio
router.get("/formio/submission/:rebateYear/:formType/:id", (req, res) => {
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

  return getBapFormSubmissionData({
    rebateYear,
    formType,
    rebateId,
    mongoId,
    req,
  }).then((bapSubmission) => {
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
            status: Record_Type_Name__c.startsWith("CSB Funding Request")
              ? Parent_CSB_Rebate__r?.CSB_Funding_Request_Status__c
              : Record_Type_Name__c.startsWith("CSB Payment Request")
              ? Parent_CSB_Rebate__r?.CSB_Payment_Request_Status__c
              : Record_Type_Name__c.startsWith("CSB Close Out Request")
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
  });
});

// --- get all actions associated with a form's submission from Formio
router.get("/formio/actions/:formId/:mongoId", (req, res) => {
  const { formId, mongoId } = req.params;

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(formId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${formId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(mongoId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  axiosFormio(req)
    .get(`${formioProjectUrl}/action?form=${formId}&submission=${mongoId}`)
    .then((axiosRes) => axiosRes.data)
    .then((actions) => res.json(actions))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio submission actions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get a PDF of an existing form's submission from Formio
router.get("/formio/pdf/:formId/:mongoId", (req, res) => {
  const { formId, mongoId } = req.params;

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(formId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${formId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(mongoId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  axiosFormio(req)
    .get(formioProjectUrl)
    .then((axiosRes) => axiosRes.data)
    .then((project) => {
      const headers = {
        "x-allow": `GET:/project/${project._id}/form/${formId}/submission/${mongoId}/download`,
        "x-expire": 3600,
      };

      axiosFormio(req)
        .get(`${formioProjectUrl}/token`, { headers })
        .then((axiosRes) => axiosRes.data)
        .then((json) => {
          const url = `${formioProjectUrl}/form/${formId}/submission/${mongoId}/download?token=${json.key}`;

          axiosFormio(req)
            .get(url, { responseType: "arraybuffer" })
            .then((axiosRes) => axiosRes.data)
            .then((fileData) => {
              const base64String = Buffer.from(fileData).toString("base64");
              res.attachment(`${mongoId}.pdf`);
              res.type("application/pdf");
              res.send(base64String);
            })
            .catch((error) => {
              // NOTE: error is logged in axiosFormio response interceptor
              const errorStatus = error.response?.status || 500;
              const errorMessage = `Error getting Formio submission PDF.`;
              return res.status(errorStatus).json({ message: errorMessage });
            });
        })
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error getting Formio download token.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio project data.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

module.exports = router;
