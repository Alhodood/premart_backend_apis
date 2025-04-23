const AWS = require('aws-sdk');

// Load credentials and region from environment variables
// (make sure you’ve run npm install aws-sdk and 
// have AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION in your env)
AWS.config.update({
  region: process.env.AWS_REGION,             // e.g. "eu-north-1"
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Create an S3 client instance
const s3 = new AWS.S3();

module.exports = s3;