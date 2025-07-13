const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// AWS S3 configuration (uncomment when ready to use)
// const AWS = require('aws-sdk');
// const multerS3 = require('multer-s3');

// Cloudinary configuration (uncomment when ready to use)
// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');

/**
 * Storage configuration factory
 * Switches between local and cloud storage based on environment
 */
function createStorageConfig() {
  const storageType = process.env.STORAGE_TYPE || 'local';
  
  switch (storageType) {
    case 'local':
      return createLocalStorage();
    case 's3':
      return createS3Storage();
    case 'cloudinary':
      return createCloudinaryStorage();
    default:
      console.warn(`Unknown storage type: ${storageType}, falling back to local`);
      return createLocalStorage();
  }
}

/**
 * Local storage configuration (current implementation)
 */
function createLocalStorage() {
  return multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(__dirname, '..', 'uploads', 'certificate-templates');
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, uniqueSuffix + '-' + originalName);
    }
  });
}

/**
 * AWS S3 storage configuration
 * Uncomment and configure when ready to use
 */
function createS3Storage() {
  // Uncomment when ready to implement S3
  throw new Error('S3 storage not implemented yet. Please implement AWS S3 configuration.');
  
  /*
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });

  return multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    key: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `certificate-templates/${uniqueSuffix}-${originalName}`);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE
  });
  */
}

/**
 * Cloudinary storage configuration
 * Uncomment and configure when ready to use
 */
function createCloudinaryStorage() {
  // Uncomment when ready to implement Cloudinary
  throw new Error('Cloudinary storage not implemented yet. Please implement Cloudinary configuration.');
  
  /*
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'certificate-templates',
      format: async (req, file) => 'png',
      public_id: (req, file) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        return `template-${uniqueSuffix}`;
      }
    }
  });
  */
}

/**
 * File serving configuration
 * Handles serving files from different storage types
 */
function createFileServer() {
  const storageType = process.env.STORAGE_TYPE || 'local';
  
  return {
    storageType,
    
    async serveFile(req, res, filePath) {
      switch (storageType) {
        case 'local':
          return this.serveLocalFile(req, res, filePath);
        case 's3':
          return this.serveS3File(req, res, filePath);
        case 'cloudinary':
          return this.serveCloudinaryFile(req, res, filePath);
        default:
          throw new Error(`Unknown storage type: ${storageType}`);
      }
    },
    
    async serveLocalFile(req, res, filePath) {
      try {
        await fs.access(filePath);
        res.sendFile(path.resolve(filePath));
      } catch (error) {
        throw new Error('File not found');
      }
    },
    
    async serveS3File(req, res, filePath) {
      // Implement S3 file serving
      throw new Error('S3 file serving not implemented yet');
    },
    
    async serveCloudinaryFile(req, res, filePath) {
      // Implement Cloudinary file serving
      throw new Error('Cloudinary file serving not implemented yet');
    }
  };
}

module.exports = {
  createStorageConfig,
  createFileServer
}; 