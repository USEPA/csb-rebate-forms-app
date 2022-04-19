const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const formioApiKey = process.env.FORMIO_API_KEY;

const formioHeaders = { headers: { "x-token": formioApiKey } };

const formioCsbMetadata = {
  "csb-app-cloud-space": `env-${process.env.CLOUD_SPACE || "local"}`,
  "csb-app-cloud-origin": process.env.SERVER_URL || "localhost",
};

module.exports = {
  formioProjectUrl,
  formioFormId,
  formioApiKey,
  formioHeaders,
  formioCsbMetadata,
};
