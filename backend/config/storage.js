const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// AWS S3 configuration
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

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
 */
function createS3Storage() {
  // Validate required environment variables
  const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required AWS environment variables: ${missingVars.join(', ')}`);
  }

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
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, {
        fieldName: file.fieldname,
        originalName: file.originalname,
        uploadedBy: req.user?.id || 'unknown',
        clubId: req.user?.clubId || 'unknown',
        uploadDate: new Date().toISOString()
      });
    }
  });
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
      try {
        const s3 = new AWS.S3({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION
        });

        const params = {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: filePath
        };

        // Check if file exists
        try {
          await s3.headObject(params).promise();
        } catch (error) {
          if (error.code === 'NotFound') {
            throw new Error('File not found in S3');
          }
          throw error;
        }

        // Stream the file from S3
        const stream = s3.getObject(params).createReadStream();
        
        // Set appropriate headers
        res.setHeader('Content-Type', 'image/png'); // Default to PNG, could be improved
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        
        stream.pipe(res);
        
        stream.on('error', (error) => {
          console.error('Error streaming from S3:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error streaming file from S3' });
          }
        });
        
      } catch (error) {
        console.error('S3 file serving error:', error);
        throw error;
      }
    },
    
    async serveCloudinaryFile(req, res, filePath) {
      // Implement Cloudinary file serving
      throw new Error('Cloudinary file serving not implemented yet');
    }
  };
}

/**
 * Utility function to test S3 connection
 */
async function testS3Connection() {
  try {
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    await s3.headBucket({ Bucket: process.env.AWS_S3_BUCKET }).promise();
    console.log('✅ S3 connection successful');
    return true;
  } catch (error) {
    console.error('❌ S3 connection failed:', error.message);
    return false;
  }
}

module.exports = {
  createStorageConfig,
  createFileServer,
  testS3Connection
}; 