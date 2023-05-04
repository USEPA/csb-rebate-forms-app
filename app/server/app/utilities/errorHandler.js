const log = require("./logger");

const { CLIENT_URL, SERVER_URL } = process.env;

function errorHandler(err, req, res, next) {
  const logMessage = typeof err.toString === "function" ? err.toString() : err;
  log({ level: "error", message: logMessage, req });

  const url = CLIENT_URL || SERVER_URL;

  /**
   * If user was trying to log in and an error occurred, return them back to
   * login page to display a message.
   */
  if (req.originalUrl.includes("/login")) {
    return res.redirect(`${url}/welcome?error=saml`);
  }

  /** For API errors, return error message in JSON format */
  if (req.originalUrl.includes("/api")) {
    const errorMessage = `An unknown server error occurred. Please try again or contact support.`;
    return res
      .status(err?.response?.status || 500)
      .json({ message: errorMessage });
  }

  /** For non-login non-API errors, redirect back to base route */
  return res.redirect(`${url}/`);
}

module.exports = errorHandler;
