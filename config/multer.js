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
 
  const imageUpload = multer({
    storage: multerS3({
      s3: s3,
      bucket: "showbookerfiles",      
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        cb(null, Date.now().toString() + "-" + file.originalname); 
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB file size limit
  });
const bannerImage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/bannerImages/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
})
const bannerImageUpload = multer({storage:bannerImage})
module.exports = {
    imageUpload,
    bannerImageUpload,
    
  }