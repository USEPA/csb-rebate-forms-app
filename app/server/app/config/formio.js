const axios = require("axios").default;
// ---
const logger = require("../utilities/logger");

const log = logger.logger;

const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const formioApiKey = process.env.FORMIO_API_KEY;

const axiosFormio = axios.create();

// NOTE: thanks to https://github.com/softonic/axios-retry for the retry logic
axiosFormio.interceptors.request.use((config) => {
  config.csb = config.csb || {};
  config.csb.retryCount = config.csb.retryCount || 0;
  config.headers["x-token"] = formioApiKey;
  return config;
});

axiosFormio.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof error.toJSON === "function") {
      log.debug(error.toJSON());
    }

    // attempt to retry a failed request two more times, and log the attempts
    const { config } = error;

    if (config.csb.retryCount < 2) {
      config.csb.retryCount += 1;

      log.warn(
        `${error.response.status} ${config.method.toUpperCase()} ${
          config.url
        } – Retrying (${config.csb.retryCount} of 2)...`
      );

      return new Promise((resolve) =>
        setTimeout(() => resolve(axiosFormio.request(config)), 1000)
      );
    }

    return Promise.reject(error);
  }
);

const formioCsbMetadata = {
  "csb-app-cloud-space": `env-${process.env.CLOUD_SPACE || "local"}`,
  "csb-app-cloud-origin": process.env.SERVER_URL || "localhost",
};

module.exports = {
  axiosFormio,
  formioProjectUrl,
  formioFormId,
  formioCsbMetadata,
};
