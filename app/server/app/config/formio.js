const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const formioApiKey = process.env.FORMIO_API_KEY;

const formioHeaders = { headers: { "x-token": formioApiKey } };

module.exports = {
  formioProjectUrl,
  formioFormId,
  formioApiKey,
  formioHeaders,
};
