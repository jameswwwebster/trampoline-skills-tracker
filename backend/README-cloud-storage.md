# Cloud Storage Integration Guide

## Problem: Ephemeral File Systems in Cloud Hosting

Railway (and most cloud hosting platforms) use **ephemeral file systems**. This means:

- Files uploaded to the local filesystem are **lost when containers restart**
- Container restarts happen regularly during deployments, scaling, or maintenance
- Database records persist, but the actual files disappear
- Result: "Template image file not found" errors

## Solutions

### 1. AWS S3 Integration (Recommended)

#### Install Dependencies
```bash
npm install aws-sdk multer-s3 @aws-sdk/client-s3 @aws-sdk/lib-storage
```

#### Environment Variables
Add to Railway environment variables:
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

#### Implementation Example
```javascript
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Update multer configuration
const storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_S3_BUCKET,
  key: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `certificate-templates/${uniqueSuffix}-${originalName}`);
  },
  contentType: multerS3.AUTO_CONTENT_TYPE
});

// Update file serving
router.get('/:id/pdf', auth, async (req, res) => {
  const template = await prisma.certificateTemplate.findFirst({
    where: { id: req.params.id, clubId: req.user.clubId }
  });
  
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  // Redirect to S3 URL or stream from S3
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: template.filePath
  };
  
  try {
    const stream = s3.getObject(params).createReadStream();
    stream.pipe(res);
  } catch (error) {
    return res.status(404).json({ error: 'Template file not found in S3' });
  }
});
```

### 2. Google Cloud Storage Integration

#### Install Dependencies
```bash
npm install @google-cloud/storage multer-google-storage
```

#### Environment Variables
```
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEYFILE=path/to/keyfile.json
GOOGLE_CLOUD_BUCKET=your-bucket-name
```

#### Implementation Example
```javascript
const { Storage } = require('@google-cloud/storage');
const multerGoogleStorage = require('multer-google-storage');

const storage = multerGoogleStorage.storageEngine({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
  bucket: process.env.GOOGLE_CLOUD_BUCKET,
  destination: 'certificate-templates/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${originalName}`);
  }
});
```

### 3. Cloudinary Integration (For Images)

#### Install Dependencies
```bash
npm install cloudinary multer-storage-cloudinary
```

#### Environment Variables
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

#### Implementation Example
```javascript
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
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
```

### 4. Railway Volumes (If Available)

Railway may offer persistent volumes in the future. Check their documentation for updates.

## Migration Strategy

### Phase 1: Immediate Fix (Current)
1. ✅ Improved error handling and user messaging
2. ✅ Automatic template deactivation when files are missing
3. ✅ Clear guidance to users about re-uploading

### Phase 2: Cloud Storage Implementation
1. Choose a cloud storage provider (AWS S3 recommended)
2. Set up cloud storage bucket and credentials
3. Update multer configuration to use cloud storage
4. Update file serving routes to stream from cloud storage
5. Test thoroughly in development

### Phase 3: Migration of Existing Data
1. Create a migration script to upload existing files to cloud storage
2. Update database records with new file paths
3. Test migration thoroughly
4. Deploy to production

## Temporary Workarounds

### 1. User Education
- Inform users that templates may need to be re-uploaded after deployments
- Provide clear error messages explaining the situation
- Consider adding a notification about the temporary nature of file storage

### 2. Backup Strategy
- Implement a backup system that periodically saves template files
- Consider storing templates in the database as base64 (for small files only)
- Create an export/import feature for templates

### 3. Development Environment
- Use local storage for development
- Use cloud storage for production
- Environment-based configuration

## Implementation Priority

1. **High Priority**: AWS S3 or Google Cloud Storage integration
2. **Medium Priority**: Cloudinary for image optimization
3. **Low Priority**: Other cloud storage providers

## Cost Considerations

- **AWS S3**: Very low cost for small files, pay-per-use
- **Google Cloud Storage**: Similar pricing to S3
- **Cloudinary**: Free tier available, good for image optimization
- **Railway Volumes**: Pricing depends on Railway's offering

## Security Considerations

- Use IAM roles with minimal required permissions
- Enable versioning for accidental deletion protection
- Consider encryption at rest
- Implement proper access controls

## Testing Strategy

1. Test file upload and retrieval
2. Test error handling for missing files
3. Test migration from local to cloud storage
4. Load testing for concurrent uploads
5. Disaster recovery testing

## Monitoring and Maintenance

- Monitor cloud storage usage and costs
- Set up alerts for failed uploads
- Regular backup verification
- Performance monitoring for file serving

## Next Steps

1. Choose your preferred cloud storage solution
2. Set up the cloud storage bucket and credentials
3. Implement the storage integration
4. Test thoroughly in a development environment
5. Deploy to production with proper monitoring

This will solve the ephemeral file system issue and provide a robust, scalable solution for file storage in your Railway-hosted application. 