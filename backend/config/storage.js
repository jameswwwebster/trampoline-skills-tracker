const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Storage configuration factory
 * Switches between local and cloud storage based on environment
 */
function createStorageConfig() {
  // Simplified to local storage only
  return createLocalStorage();
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
// Removed S3 and Cloudinary storage implementations for a local-only setup

/**
 * File serving configuration
 * Handles serving files from different storage types
 */
function createFileServer() {
  return {
    async serveFile(req, res, filePath) {
      return this.serveLocalFile(req, res, filePath);
    },

    async serveLocalFile(req, res, filePath) {
      try {
        await fs.access(filePath);
        res.sendFile(path.resolve(filePath));
      } catch (error) {
        throw new Error('File not found');
      }
    }
  };
}

/**
 * Utility function to test S3 connection
 */
module.exports = {
  createStorageConfig,
  createFileServer
};