const axios = require("axios");
const express = require("express");
// ---
const log = require("../utilities/logger");

const {
  CLOUD_SPACE,
  SERVER_URL,
  FORMIO_BASE_URL,
  FORMIO_PROJECT_NAME,
  FORMIO_API_KEY,
  FORMIO_2022_FRF_PATH,
  FORMIO_2022_PRF_PATH,
  FORMIO_2022_CRF_PATH,
  FORMIO_2023_FRF_PATH,
  FORMIO_2023_PRF_PATH,
  FORMIO_2023_CRF_PATH,
} = process.env;

const formioProjectUrl = `${FORMIO_BASE_URL}/${FORMIO_PROJECT_NAME}`;
const formio2022FRFUrl = `${formioProjectUrl}/${FORMIO_2022_FRF_PATH}`;
const formio2022PRFUrl = `${formioProjectUrl}/${FORMIO_2022_PRF_PATH}`;
const formio2022CRFUrl = `${formioProjectUrl}/${FORMIO_2022_CRF_PATH}`;

/** @param {express.Request} req */
function axiosFormio(req) {
  const instance = axios.create();

  /** NOTE: thanks to https://github.com/softonic/axios-retry for the retry logic. */
  instance.interceptors.request.use((config) => {
    config.csb = config.csb ?? {};
    config.csb.retryCount = config.csb.retryCount || 0;

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
      if (typeof error.toJSON === "function") {
        log({ level: "debug", message: error.toJSON() });
      }

      /** Attempt to retry a failed request 3 times, and log the attempts. */
      const { config } = error;
      const { status } = error.response;

      const { retryCount } = config.csb;
      const method = config.method.toUpperCase();
      const url = { config };

      if (retryCount < 3) {
        retryCount += 1;

        const logMessage = `Formio Error: ${status} ${method} ${url} - Retrying (${retryCount} of 3)...`;
        log({ level: "warn", message: logMessage, req: config });

        return new Promise((resolve) =>
          setTimeout(() => resolve(instance.request(config)), 1000)
        );
      }

      const logMessage =
        `Formio Error: ${status} ${method} ${url}. ` +
        `Response: ${JSON.stringify(error.response.data)}`;
      log({ level: "error", message: logMessage, req: config });

      return Promise.reject(error);
    }
  );

  return instance;
}

const formioCSBMetadata = {
  "csb-app-cloud-space": `env-${CLOUD_SPACE || "local"}`,
  "csb-app-cloud-origin": SERVER_URL || "localhost",
};

module.exports = {
  axiosFormio,
  formio2022FRFUrl,
  formio2022PRFUrl,
  formio2022CRFUrl,
  formioCSBMetadata,
};
