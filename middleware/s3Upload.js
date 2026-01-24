const multer = require("multer");
const multerS3 = require("multer-s3");
const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME, // must exist
    acl: "public-read",
    key: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    },
  }),
});

module.exports = upload;