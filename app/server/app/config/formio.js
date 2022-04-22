const axios = require("axios").default;
// ---
const log = require("../utilities/logger");

const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const formioApiKey = process.env.FORMIO_API_KEY;

function axiosFormio(req) {
  const instance = axios.create();

  // NOTE: thanks to https://github.com/softonic/axios-retry for the retry logic
  instance.interceptors.request.use((config) => {
    config.csb = config.csb || {};
    config.csb.retryCount = config.csb.retryCount || 0;
    config.headers["x-token"] = formioApiKey;
    config.headers["b3"] = req.headers["b3"] || "";
    config.headers["x-b3-traceid"] = req.headers["x-b3-traceid"] || "";
    config.headers["x-b3-spanid"] = req.headers["x-b3-spanid"] || "";
    config.headers["x_b3_parentspanid"] =
      req.headers["x_b3_parentspanid"] || "";
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (typeof error.toJSON === "function") {
        log({ level: "debug", message: error.toJSON() });
      }

      // attempt to retry a failed request two more times, and log the attempts
      const { config } = error;
      const { status } = error.response;

      if (config.csb.retryCount < 2) {
        config.csb.retryCount += 1;

        log({
          level: "warn",
          message:
            `Formio Error: ` +
            `${status} ${config.method.toUpperCase()} ${config.url} ` +
            `– Retrying (${config.csb.retryCount} of 2)...`,
          req: config,
        });

        return new Promise((resolve) =>
          setTimeout(() => resolve(instance.request(config)), 1000)
        );
      }

      log({
        level: "error",
        message: `Formio Error: ${status} ${config.method.toUpperCase()} ${
          config.url
        }`,
        req: config,
      });

      return Promise.reject(error);
    }
  );

  return instance;
}

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
