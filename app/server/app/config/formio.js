const axios = require("axios");
const express = require("express");
// ---
const log = require("../utilities/logger");

const {
  CLOUD_SPACE,
  SERVER_URL,
  CSB_2022_FRF_OPEN,
  CSB_2022_PRF_OPEN,
  CSB_2022_CRF_OPEN,
  CSB_2023_FRF_OPEN,
  CSB_2023_PRF_OPEN,
  CSB_2023_CRF_OPEN,
  FORMIO_BASE_URL,
  FORMIO_PROJECT_NAME,
  FORMIO_API_KEY,
  FORMIO_2022_FRF_PATH,
  FORMIO_2022_PRF_PATH,
  FORMIO_2022_CRF_PATH,
  FORMIO_2023_FRF_PATH,
  FORMIO_2023_PRF_PATH,
  FORMIO_2023_CRF_PATH,
  FORMIO_2023_CHANGE_PATH,
} = process.env;

const formioProjectUrl = `${FORMIO_BASE_URL}/${FORMIO_PROJECT_NAME}`;

/**
 * Stores form url for each form by rebate year.
 */
const formUrl = {
  2022: {
    frf: `${formioProjectUrl}/${FORMIO_2022_FRF_PATH}`,
    prf: `${formioProjectUrl}/${FORMIO_2022_PRF_PATH}`,
    crf: `${formioProjectUrl}/${FORMIO_2022_CRF_PATH}`,
    change: "", // NOTE: Change Request form was added in the 2023 rebate year
  },
  2023: {
    frf: `${formioProjectUrl}/${FORMIO_2023_FRF_PATH}`,
    prf: `${formioProjectUrl}/${FORMIO_2023_PRF_PATH}`,
    crf: `${formioProjectUrl}/${FORMIO_2023_CRF_PATH}`,
    change: `${formioProjectUrl}/${FORMIO_2023_CHANGE_PATH}`,
  },
};

/**
 * Stores whether the submission period is open for each form by rebate year.
 */
const submissionPeriodOpen = {
  2022: {
    frf: CSB_2022_FRF_OPEN === "true",
    prf: CSB_2022_PRF_OPEN === "true",
    crf: CSB_2022_CRF_OPEN === "true",
  },
  2023: {
    frf: CSB_2023_FRF_OPEN === "true",
    prf: CSB_2023_PRF_OPEN === "true",
    crf: CSB_2023_CRF_OPEN === "true",
  },
};

/** @param {express.Request} req */
function axiosFormio(req) {
  const instance = axios.create();

  instance.interceptors.request.use((config) => {
    config.headers["x-token"] = FORMIO_API_KEY;
    config.headers["b3"] = req.headers["b3"] || "";
    config.headers["x-b3-traceid"] = req.headers["x-b3-traceid"] || "";
    config.headers["x-b3-spanid"] = req.headers["x-b3-spanid"] || "";
    config.headers["x-b3-parentspanid"] = req.headers["x-b3-parentspanid"] || ""; // prettier-ignore

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const { config } = error;
      const { status } = error.response;

      const method = config.method.toUpperCase();
      const { url } = config;

      const logMessage =
        `Formio Error: ${status} ${method} ${url}. ` +
        `Response: ${JSON.stringify(error.response.data)}`;
      log({ level: "error", message: logMessage, req: config });

      return Promise.reject(error);
    },
  );

  return instance;
}

const formioCSBMetadata = {
  "csb-app-cloud-space": `env-${CLOUD_SPACE || "local"}`,
  "csb-app-cloud-origin": SERVER_URL || "localhost",
};

module.exports = {
  axiosFormio,
  formioProjectUrl,
  formUrl,
  submissionPeriodOpen,
  formioCSBMetadata,
};
