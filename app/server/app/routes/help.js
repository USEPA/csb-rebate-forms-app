const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formioProjectUrl,
  formUrl,
  formioExampleMongoId,
  formioExampleRebateId,
} = require("../config/formio");
const { ensureAuthenticated, ensureHelpdesk } = require("../middleware");
const { getBapFormSubmissionData } = require("../utilities/bap");

/**
 * @typedef {'2022' | '2023' | '2024'} RebateYear
 */

/**
 * @typedef {'frf' | 'prf' | 'crf'} FormType
 */

const router = express.Router();

/** Confirm user is both authenticated and authorized with valid helpdesk roles. */
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

/** @type {Map<FormType, 'CSB Application' | 'CSB Payment Request' | 'CSB Close Out'} */
const formioFormNameMap = new Map()
  .set("frf", "CSB Application")
  .set("prf", "CSB Payment Request")
  .set("crf", "CSB Close Out");

/**
 * Fetches data associated with a provided form submission from Formio.
 *
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {FormType} param.formType
 * @param {string} param.mongoId
 * @param {{
 *  modified: string | null
 *  comboKey: string | null
 *  mongoId: string | null
 *  rebateId: string | null
 *  reviewItemId: string | null
 *  status: string | null
 * }} param.bap
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchFormioSubmission({
  rebateYear,
  formType,
  mongoId,
  bap,
  req,
  res,
}) {
  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(mongoId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const formName = formioFormNameMap.get(formType) || "CSB";
  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formName}.`;
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
        bap,
      });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} ${formName} form submission '${mongoId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

// --- get an existing form's submission data from Formio
router.get("/formio/submission/:rebateYear/:formType/:id", (req, res) => {
  const { rebateYear, formType, id } = req.params;

  // NOTE: included to support EPA API scan
  if (id === formioExampleRebateId) {
    return res.json({});
  }

  const rebateId = id.length === 6 ? id : null;
  const mongoId = !rebateId ? id : null;

  return getBapFormSubmissionData({
    rebateYear,
    formType,
    rebateId,
    mongoId,
    req,
  }).then((bapSubmission) => {
    /**
     * NOTE: Some submissions will not be returned from the BAP (e.g., drafts or
     * submissions not yet picked up by the BAP ETLs).
     */
    if (!bapSubmission && !mongoId) {
      const errorStatus = 400;
      const errorMessage = `A valid MongoDB ObjectId must be provided for submissions not yet picked up by the BAP.`;
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
    } = bapSubmission ?? {};

    /**
     * NOTE: For submissions not in the BAP, each property of the bap object
     * parameter will be null.
     */
    return fetchFormioSubmission({
      rebateYear,
      formType,
      mongoId: CSB_Form_ID__c || mongoId,
      bap: {
        modified: CSB_Modified_Full_String__c || null, // ISO 8601 date time string
        comboKey: UEI_EFTI_Combo_Key__c || null, // UEI + EFTI combo key
        mongoId: CSB_Form_ID__c || null, // MongoDB Object ID
        rebateId: Parent_Rebate_ID__c || null, // CSB Rebate ID (6 digits)
        reviewItemId: CSB_Review_Item_ID__c || null, // CSB Rebate ID with form/version ID (9 digits)
        status:
          (Record_Type_Name__c?.startsWith("CSB Funding Request")
            ? Parent_CSB_Rebate__r?.CSB_Funding_Request_Status__c
            : Record_Type_Name__c?.startsWith("CSB Payment Request")
              ? Parent_CSB_Rebate__r?.CSB_Payment_Request_Status__c
              : Record_Type_Name__c?.startsWith("CSB Close Out Request")
                ? Parent_CSB_Rebate__r?.CSB_Closeout_Request_Status__c
                : "") || null,
      },
      req,
      res,
    });
  });
});

// --- post an update to an existing form submission to Formio (change submission to 'draft')
router.post("/formio/submission/:rebateYear/:formType/:mongoId", (req, res) => {
  const { body } = req;
  const { rebateYear, formType, mongoId } = req.params;

  // NOTE: included to support EPA API scan
  if (mongoId === formioExampleMongoId) {
    return res.json({});
  }

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(mongoId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const formName = formioFormNameMap.get(formType) || "CSB";
  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formName}.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  axiosFormio(req)
    .put(`${formioFormUrl}/submission/${mongoId}`, body)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error updating Formio ${rebateYear} ${formName} form submission '${mongoId}' to 'Draft'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get all actions associated with a form's submission from Formio
router.get("/formio/actions/:formId/:mongoId", (req, res) => {
  const { formId, mongoId } = req.params;

  // NOTE: included to support EPA API scan
  if (mongoId === formioExampleMongoId) {
    return res.json({});
  }

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

  // NOTE: included to support EPA API scan
  if (mongoId === formioExampleMongoId) {
    return res.json({});
  }

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
