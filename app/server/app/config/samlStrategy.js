const { Strategy } = require("passport-saml");

const {
  SERVER_URL,
  SAML_LOGIN_URL,
  SAML_LOGOUT_URL,
  SAML_ENTITY_ID,
  SAML_IDP_CERT,
  SAML_PRIVATE_KEY,
  SAML_CLOCK_SKEW,
} = process.env;

const samlStrategy = new Strategy(
  {
    entryPoint: SAML_LOGIN_URL,
    logoutUrl: SAML_LOGOUT_URL,
    callbackUrl: `${SERVER_URL}/login/assert`,
    logoutCallbackUrl: `${SERVER_URL}/logout/callback`,
    issuer: SAML_ENTITY_ID,
    cert: SAML_IDP_CERT,
    privateKey: SAML_PRIVATE_KEY || null,
    signatureAlgorithm: "sha256",
    acceptedClockSkewMs: SAML_CLOCK_SKEW || 0,
    identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
    disableRequestedAuthnContext: true,
  },
  // login
  function (profile, done) {
    return done(null, profile);
  }
);

module.exports = samlStrategy;
