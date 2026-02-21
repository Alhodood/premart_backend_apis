const morgan  = require('morgan');
const logger  = require('./logger');

// Morgan streams every HTTP request into Winston
const stream = {
  write: (message) => logger.http(message.trim()),
};

// 'combined' = Apache-style: IP, method, route, status, response time
const morganMiddleware = morgan('combined', { stream });

module.exports = morganMiddleware;