const winston = require('winston');
require('winston-daily-rotate-file');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Rotate log files daily, keep 14 days of history
const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename:      'logs/app-%DATE%.log',
  datePattern:   'YYYY-MM-DD',
  maxFiles:      '14d',       // auto-delete logs older than 14 days
  maxSize:       '20m',       // rotate if file exceeds 20MB
  zippedArchive: true,
});

const errorRotateTransport = new winston.transports.DailyRotateFile({
  filename:   'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles:   '30d',
  level:      'error',        // only errors go here
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),  // captures full stack trace on errors
    logFormat
  ),
  transports: [
    fileRotateTransport,
    errorRotateTransport,
  ],
});

// In development, also print colored logs to terminal
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(colorize(), timestamp(), logFormat),
  }));
}

module.exports = logger;