const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const s3 = new S3Client({
    region: process.env.S3_BUCKET_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  }); 
  const dotenv = require("dotenv");
 
  const imageUpload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.S3_BUCKET_NAME,      
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        cb(null, Date.now().toString() + "-" + file.originalname); 
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, 
  });
const bannerImageUpload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME, 
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      cb(null, `banners/${Date.now().toString()}-${file.originalname}`); 
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, 
});
module.exports = {
    imageUpload,
    bannerImageUpload,
    
  }