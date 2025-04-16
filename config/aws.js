// config/aws.js
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,      // from IAM user
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION                   // e.g., "us-east-1"
});

const s3 = new AWS.S3();
module.exports = s3;
