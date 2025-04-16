// // middleware/upload.js
// const multer = require('multer');
// const path = require('path');

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/'); // storage folder
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + '-' + file.originalname); // unique file name
//   }
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|gif/;
//   const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//   const mime = allowedTypes.test(file.mimetype);
//   if (ext && mime) {
//     cb(null, true);
//   } else {
//     cb('Only images are allowed');
//   }
// };

// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter
// });

// module.exports = upload;



// middleware/s3Upload.js
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/aws');

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,           // your bucket name
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const filename = Date.now().toString() + '-' + file.originalname;
      cb(null, filename);
    }
  })
});

module.exports = upload;
