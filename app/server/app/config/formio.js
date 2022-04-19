const axios = require("axios").default;

const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const formioApiKey = process.env.FORMIO_API_KEY;

const axiosFormio = axios.create();

axiosFormio.interceptors.request.use((config) => {
  config.headers["x-token"] = formioApiKey;
  return config;
});

axiosFormio.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof error.toJSON === "function") log.debug(error.toJSON());
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
