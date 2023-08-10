const express = require("express");
// ---
const {
  axiosFormio,
  formUrl,
  submissionPeriodOpen,
  formioCSBMetadata,
} = require("../config/formio");
const { checkFormSubmissionPeriodAndBapStatus } = require("./bap");
const log = require("./logger");

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function uploadS3FileMetadata({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { formType, mongoId, comboKey } = req.params;

  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formType.toUpperCase()}.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType,
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to upload a file ` +
          `without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      axiosFormio(req)
        .post(`${formioFormUrl}/storage/s3`, body)
        .then((axiosRes) => axiosRes.data)
        .then((fileMetadata) => res.json(fileMetadata))
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error uploading file to S3.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      const formName =
        formType === "frf"
          ? "CSB Application"
          : formType === "prf"
          ? "CSB Payment Request"
          : formType === "cof"
          ? "CSB Close Out"
          : "CSB";

      const logMessage =
        `User with email '${mail}' attempted to upload a file when the ` +
        `${rebateYear} ${formName} form enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `${rebateYear} ${formName} form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function downloadS3FileMetadata({ rebateYear, req, res }) {
  const { bapComboKeys, query } = req;
  const { mail } = req.user;
  const { formType, comboKey } = req.params;

  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formType.toUpperCase()}.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to download a file ` +
      `without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  axiosFormio(req)
    .get(`${formioFormUrl}/storage/s3`, { params: query })
    .then((axiosRes) => axiosRes.data)
    .then((fileMetadata) => res.json(fileMetadata))
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error downloading file from S3.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchFRFSubmissions({ rebateYear, req, res }) {
  const { bapComboKeys } = req;

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const submissionsUrl =
    `${formioFormUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `&data.bap_hidden_entity_combo_key=` +
    `${bapComboKeys.join("&data.bap_hidden_entity_combo_key=")}`;

  axiosFormio(req)
    .get(submissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Application form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const comboKey =
    rebateYear === "2022"
      ? body.data?.bap_hidden_entity_combo_key
      : rebateYear === "2023"
      ? body.data?._bap_entity_combo_key
      : null;

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!submissionPeriodOpen[rebateYear].frf) {
    const errorStatus = 400;
    const errorMessage = `${rebateYear} CSB Application form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new ${rebateYear} ` +
      `FRF submission without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** Add custom metadata to track formio submissions from wrapper. */
  body.metadata = { ...formioCSBMetadata };

  axiosFormio(req)
    .post(`${formioFormUrl}/submission`, body)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error posting Formio ${rebateYear} Application form submission.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  Promise.all([
    axiosFormio(req).get(`${formioFormUrl}/submission/${mongoId}`),
    axiosFormio(req).get(formioFormUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submission, schema]) => {
      const comboKey =
        rebateYear === "2022"
          ? submission.data.bap_hidden_entity_combo_key
          : rebateYear === "2023"
          ? submission.data._bap_entity_combo_key
          : null;

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access ${rebateYear} ` +
          `FRF submission '${mongoId}' that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json({
          userAccess: false,
          formSchema: null,
          submission: null,
        });
      }

      return res.json({
        userAccess: true,
        formSchema: { url: formioFormUrl, json: schema },
        submission,
      });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Application form submission '${mongoId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function updateFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;
  const submission = req.body;
  const comboKey =
    rebateYear === "2022"
      ? submission.data?.bap_hidden_entity_combo_key
      : rebateYear === "2023"
      ? submission.data?._bap_entity_combo_key
      : null;

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType: "frf",
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to update ${rebateYear} FRF ` +
          `submission '${mongoId}' without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /** Add custom metadata to track formio submissions from wrapper. */
      submission.metadata = {
        ...submission.metadata,
        ...formioCSBMetadata,
      };

      axiosFormio(req)
        .put(`${formioFormUrl}/submission/${mongoId}`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error updating Formio ${rebateYear} Application form submission '${mongoId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      const logMessage =
        `User with email '${mail}' attempted to update ${rebateYear} FRF ` +
        `submission '${mongoId}' when the CSB FRF enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `${rebateYear} CSB Application form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

module.exports = {
  uploadS3FileMetadata,
  downloadS3FileMetadata,
  fetchFRFSubmissions,
  createFRFSubmission,
  fetchFRFSubmission,
  updateFRFSubmission,
};
