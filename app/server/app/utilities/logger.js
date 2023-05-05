const log4js = require("log4js");
const express = require("express");

const { LOGGER_LEVEL } = process.env;

log4js.configure({
  appenders: {
    stdout: { type: "stdout", layout: { type: "pattern", pattern: "%p - %m" } },
    stdoutFilter: {
      type: "logLevelFilter",
      appender: "stdout",
      level: "TRACE",
      maxLevel: "WARN",
    },
    stderr: { type: "stderr", layout: { type: "pattern", pattern: "%p - %m" } },
    stderrFilter: {
      type: "logLevelFilter",
      appender: "stderr",
      level: "ERROR",
      maxLevel: "FATAL",
    },
  },
  categories: {
    default: { appenders: ["stderrFilter", "stdoutFilter"], level: "all" },
  },
});

const logger = log4js.getLogger();

logger.level = LOGGER_LEVEL ? LOGGER_LEVEL.toUpperCase() : "INFO";
logger.info(`LOGGER_LEVEL = ${logger.level}`);

/**
 * @param {{
 *  level: 'debug' | 'info' | 'warn' | 'error',
 *  message: string,
 *  req: ?express.Request,
 *  otherInfo: any
 * }} options
 */
function log({ level, message, req, otherInfo }) {
  /**
   * If a request is not passed, log as normal message without metadata, else
   * log as JSON object with message and metadata for logging/auditing purposes.
   *
   * See: https://docs.cloudfoundry.org/concepts/http-routing.html#http-headers
   */
  const data = !req
    ? message
    : JSON.stringify({
        app_metadata: {
          b3: req.headers["b3"],
          x_b3_traceid: req.headers["x-b3-traceid"],
          x_b3_spanid: req.headers["x-b3-spanid"],
          x_b3_parentspanid: req.headers["x-b3-parentspanid"],
        },
        app_message: message,
        app_otherinfo: otherInfo,
      });

  logger.log(level, data);
}

module.exports = log;
