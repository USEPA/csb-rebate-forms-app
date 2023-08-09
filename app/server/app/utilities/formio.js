const express = require("express");
// ---
const { axiosFormio, formUrl } = require("../config/formio");
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

module.exports = {
  uploadS3FileMetadata,
  downloadS3FileMetadata,
  fetchFRFSubmissions,
};
