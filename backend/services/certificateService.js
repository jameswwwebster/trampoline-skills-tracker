const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { PrismaClient } = require('@prisma/client');

class CertificateService {
  constructor() {
    this.prisma = new PrismaClient();
    this.fontPath = path.join(__dirname, '../fonts/LilitaOne-Regular.ttf');
    this.certificatesDir = path.join(__dirname, '../generated-certificates');
    this.cacheDir = path.join(__dirname, '../certificate-cache');
    this.maxCacheSize = 100 * 1024 * 1024; // 100MB cache limit
    this.maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    // Register custom font
    try {
      registerFont(this.fontPath, { family: 'Lilita One' });
    } catch (error) {
      console.log('⚠️ Failed to register Lilita One font:', error.message);
    }
    
    // Initialize cache directory
    this.initializeCacheDirectory();
  }

  async generateCertificate(certificate, templatePath) {
    try {
      // If no custom template, try to get default template for the club
      if (!templatePath || !certificate.templateId) {
        console.log('🔍 No custom template provided, looking for default template...');
        const defaultTemplate = await this.getTemplate(certificate.clubId);
        
        if (defaultTemplate && defaultTemplate.filePath) {
          templatePath = defaultTemplate.filePath;
          // Update certificate object with template data
          certificate.template = defaultTemplate;
          certificate.fields = defaultTemplate.fields;
          certificate.templateId = defaultTemplate.id;
          console.log(`✅ Using default template: ${defaultTemplate.name}`);
        } else {
          console.log('⚠️ No custom templates found for club, falling back to basic certificate');
          return await this.generateBasicCertificate(certificate);
        }
      }
      
      // Check if template is PDF and provide helpful error
      if (templatePath.toLowerCase().endsWith('.pdf')) {
        throw new Error('PDF templates are not currently supported. Please convert your PDF to PNG or JPG format and upload again.');
      }
      
      // Check if template file exists
      try {
        await fs.access(templatePath);
      } catch (fileError) {
        console.log(`⚠️ Template file not found: ${templatePath}, falling back to basic certificate`);
        return await this.generateBasicCertificate(certificate);
      }
      
      // Load template image
      const templateImage = await loadImage(templatePath);
      
      // Create canvas with template dimensions
      const canvas = createCanvas(templateImage.width, templateImage.height);
      const ctx = canvas.getContext('2d');
      
      // Draw template as background
      ctx.drawImage(templateImage, 0, 0);
      
      // Prepare field data
      const fieldData = {
        GYMNAST_NAME: `${certificate.gymnast.firstName} ${certificate.gymnast.lastName}`,
        COACH_NAME: certificate.awardedBy ? `${certificate.awardedBy.firstName} ${certificate.awardedBy.lastName}` : 'Unknown Coach',
        DATE: new Date(certificate.awardedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        LEVEL_NAME: certificate.level.name,
        LEVEL_NUMBER: certificate.level.number ? certificate.level.number.toString() : certificate.level.identifier,
        CLUB_NAME: certificate.club.name
      };
      
      // Get fields from template
      const fields = certificate.template?.fields || certificate.fields || [];
      
      if (fields.length === 0) {
        console.log('⚠️ No certificate fields configured for this template, falling back to basic certificate');
        return await this.generateBasicCertificate(certificate);
      }
      
      await this.renderCustomFields(ctx, fields, fieldData, canvas.width, canvas.height);
      
      // Generate PNG buffer
      const pngBuffer = canvas.toBuffer('image/png');
      
      console.log(`✅ Custom certificate generated successfully using template: ${certificate.template?.name || 'Unknown'}`);
      return pngBuffer;
      
    } catch (error) {
      console.error('Certificate generation error:', error);
      
      // Don't fall back to basic certificate if template is missing
      if (error.message.includes('No certificate template found')) {
        throw error; // Re-throw template errors
      }
      
      console.log('🔄 Falling back to basic certificate generation due to technical error...');
      return await this.generateBasicCertificate(certificate);
    }
  }

  async renderCustomFields(ctx, fields, fieldData, canvasWidth, canvasHeight) {
    for (const field of fields) {
      if (!field.isVisible) continue;
      
      await this.renderField(ctx, field, fieldData, canvasWidth, canvasHeight);
    }
  }

  async renderField(ctx, field, fieldData, canvasWidth, canvasHeight) {
    // Get field content
    let text = '';
    if (field.fieldType === 'CUSTOM_TEXT') {
      text = field.customText || '';
    } else {
      text = fieldData[field.fieldType] || '';
    }
    
    if (!text) {
      return;
    }
    
    // Calculate exact pixel position - field.x and field.y represent the CENTER of the text
    const centerX = field.x * canvasWidth;
    const centerY = field.y * canvasHeight;
    
    // Calculate proportional font size based on template width
    // Use 1000px as reference width for font sizing
    const referenceWidth = 1000;
    const scaleFactor = canvasWidth / referenceWidth;
    const scaledFontSize = Math.round(field.fontSize * scaleFactor);
    
    // Set font properties
    let fontFamily = field.fontFamily;
    if (fontFamily === 'LilitaOne') fontFamily = 'Lilita One';
    
    const fontWeight = field.fontWeight || 'normal';
    ctx.font = `${fontWeight} ${scaledFontSize}px ${fontFamily}`;
    ctx.fillStyle = field.fontColor;
    
    // Use the same text alignment as defined in the field
    ctx.textAlign = field.textAlign || 'center';
    // Always use middle baseline for consistent vertical centering
    ctx.textBaseline = 'middle';
    
    // Apply rotation if needed
    if (field.rotation && field.rotation !== 0) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((field.rotation * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    } else {
      // Draw text at the center position with the specified alignment
      // The Y coordinate represents the vertical center of the text
      ctx.fillText(text, centerX, centerY);
    }
  }

  async generateBasicCertificate(certificate) {
    try {
      // Create a standard certificate size (8.5 x 11 inches at 150 DPI)
      const width = 1275;
      const height = 1650;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      // Get club colors or use defaults
      const primaryColor = certificate.club?.primaryColor || '#2c3e50';
      const secondaryColor = certificate.club?.secondaryColor || '#3498db';
      const accentColor = certificate.club?.accentColor || '#d4af37';
      const textColor = certificate.club?.textColor || '#2c3e50';
      
      // Fill background with white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // Draw decorative border
      const borderWidth = 20;
      const borderRadius = 30;
      
      // Outer border (primary color)
      ctx.fillStyle = primaryColor;
      ctx.fillRect(0, 0, width, height);
      
      // Inner background (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(borderWidth, borderWidth, width - (borderWidth * 2), height - (borderWidth * 2));
      
      // Inner decorative border (accent color)
      const innerBorder = borderWidth + 30;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(innerBorder, innerBorder, width - (innerBorder * 2), height - (innerBorder * 2));
      
      // Certificate title
      ctx.fillStyle = primaryColor;
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CERTIFICATE', width / 2, height * 0.2);
      
      ctx.font = 'bold 48px Arial';
      ctx.fillText('OF ACHIEVEMENT', width / 2, height * 0.25);
      
      // "This certifies that" text
      ctx.fillStyle = textColor;
      ctx.font = '32px Arial';
      ctx.fillText('This certifies that', width / 2, height * 0.35);
      
      // Gymnast name (larger, with accent color)
      const gymnastName = `${certificate.gymnast.firstName} ${certificate.gymnast.lastName}`;
      ctx.fillStyle = primaryColor;
      ctx.font = 'bold 52px Arial';
      ctx.fillText(gymnastName, width / 2, height * 0.45);
      
      // Draw underline for name
      const nameWidth = ctx.measureText(gymnastName).width;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo((width - nameWidth) / 2, height * 0.47);
      ctx.lineTo((width + nameWidth) / 2, height * 0.47);
      ctx.stroke();
      
      // "has successfully completed" text
      ctx.fillStyle = textColor;
      ctx.font = '32px Arial';
      ctx.fillText('has successfully completed', width / 2, height * 0.55);
      
      // Level information
      const levelText = `Level ${certificate.level.identifier}`;
      ctx.fillStyle = accentColor;
      ctx.font = 'bold 72px Arial';
      ctx.fillText(levelText, width / 2, height * 0.65);
      
      // Level name
      ctx.fillStyle = textColor;
      ctx.font = 'bold 36px Arial';
      ctx.fillText(certificate.level.name, width / 2, height * 0.72);
      
      // Date
      const dateText = new Date(certificate.awardedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      ctx.fillStyle = textColor;
      ctx.font = 'italic 28px Arial';
      ctx.fillText(dateText, width / 2, height * 0.85);
      
      // Club name
      if (certificate.club?.name) {
        ctx.fillStyle = secondaryColor;
        ctx.font = 'bold 24px Arial';
        ctx.fillText(certificate.club.name, width / 2, height * 0.92);
      }
      
      // Generate PNG buffer
      const pngBuffer = canvas.toBuffer('image/png');
      
      console.log(`✅ Basic certificate generated successfully for ${gymnastName}`);
      return pngBuffer;
      
    } catch (error) {
      console.error('Basic certificate generation error:', error);
      throw error;
    }
  }



  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async saveCertificate(certificate, pngBuffer) {
    await this.ensureDirectoryExists(this.certificatesDir);
    
    const filename = `certificate-${certificate.id}.png`;
    const filePath = path.join(this.certificatesDir, filename);
    
    await fs.writeFile(filePath, pngBuffer);
    
    return {
      filename,
      path: filePath,
      size: pngBuffer.length
    };
  }

  async getTemplate(clubId, templateId = null) {
    try {
      let template;
      
      if (templateId) {
        // Get specific template
        template = await this.prisma.certificateTemplate.findFirst({
          where: {
            id: templateId,
            clubId: clubId,
            isActive: true
          },
          include: {
            fields: {
              where: { isVisible: true },
              orderBy: { order: 'asc' }
            }
          }
        });
      } else {
        // Get default template for club
        template = await this.prisma.certificateTemplate.findFirst({
          where: {
            clubId: clubId,
            isDefault: true,
            isActive: true
          },
          include: {
            fields: {
              where: { isVisible: true },
              orderBy: { order: 'asc' }
            }
          }
        });
      }

      return template;
    } catch (error) {
      console.error('Error getting template:', error);
      return null;
    }
  }

  async generateAndSaveCertificate(certificateData, outputPath) {
    try {
      const pngBuffer = await this.generateCertificate(certificateData);
      await fs.writeFile(outputPath, pngBuffer);
      console.log(`💾 Certificate saved to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('❌ Failed to save certificate:', error);
      throw error;
    }
  }

  async getCertificatePNG(certificateId) {
    const filename = `certificate-${certificateId}.png`;
    const filePath = path.join(this.certificatesDir, filename);
    
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      console.error('Error reading certificate PNG:', error);
      return null;
    }
  }

  async needsRegeneration(certificate) {
    try {
      // If no template is associated, no regeneration needed
      if (!certificate.template) {
        return false;
      }

      // Get the template with its fields to check for any updates
      const template = await this.prisma.certificateTemplate.findUnique({
        where: { id: certificate.templateId },
        include: {
          fields: true
        }
      });

      if (!template) {
        return false;
      }

      // Check if template was updated after certificate creation
      if (template.updatedAt > certificate.createdAt) {
        return true;
      }

      // Check if any template fields were updated after certificate creation
      const fieldsUpdatedAfterCertificate = template.fields.some(field => 
        field.updatedAt > certificate.createdAt
      );

      return fieldsUpdatedAfterCertificate;
    } catch (error) {
      console.error('Error checking if certificate needs regeneration:', error);
      return false;
    }
  }

  async deleteCertificate(certificateId) {
    try {
      const files = await fs.readdir(this.certificatesDir);
      const matchingFiles = files.filter(file => file.includes(certificateId));
      
      for (const file of matchingFiles) {
        const filePath = path.join(this.certificatesDir, file);
        await fs.unlink(filePath);
      }
      
      // Also invalidate cache
      await this.invalidateCache(certificateId);
    } catch (error) {
      console.error('Error deleting certificate files:', error);
    }
  }

  // Cache management methods
  async initializeCacheDirectory() {
    try {
      await this.ensureDirectoryExists(this.cacheDir);
      // Run initial cleanup on startup
      setImmediate(() => this.cleanupCache());
    } catch (error) {
      console.error('Error initializing cache directory:', error);
    }
  }

  getCacheKey(certificate) {
    // Create cache key based on certificate ID, template version, and certificate data
    const templateVersion = certificate.template?.updatedAt || certificate.updatedAt || 'no-template';
    const certificateVersion = certificate.updatedAt || certificate.createdAt;
    
    return `cert-${certificate.id}-${templateVersion.getTime()}-${certificateVersion.getTime()}`;
  }

  async getCachedCertificate(cacheKey) {
    try {
      const cacheFilePath = path.join(this.cacheDir, `${cacheKey}.png`);
      const metadataPath = path.join(this.cacheDir, `${cacheKey}.meta.json`);
      
      // Check if cache file exists
      try {
        await fs.access(cacheFilePath);
        await fs.access(metadataPath);
      } catch {
        return null; // Cache miss
      }

      // Check cache age
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      const now = Date.now();
      
      if (now - metadata.createdAt > this.maxCacheAge) {
        // Cache expired, remove it
        await this.removeCacheFile(cacheKey);
        return null;
      }

      // Update access time
      metadata.lastAccessedAt = now;
      metadata.accessCount = (metadata.accessCount || 0) + 1;
      await fs.writeFile(metadataPath, JSON.stringify(metadata), 'utf8');
      
      // Return cached certificate
      const pngBuffer = await fs.readFile(cacheFilePath);
      console.log(`💾 Cache HIT for ${cacheKey}`);
      return pngBuffer;
      
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  async setCachedCertificate(cacheKey, pngBuffer) {
    try {
      await this.ensureDirectoryExists(this.cacheDir);
      
      const cacheFilePath = path.join(this.cacheDir, `${cacheKey}.png`);
      const metadataPath = path.join(this.cacheDir, `${cacheKey}.meta.json`);
      
      // Save PNG buffer
      await fs.writeFile(cacheFilePath, pngBuffer);
      
      // Save metadata
      const metadata = {
        cacheKey,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
        fileSize: pngBuffer.length
      };
      
      await fs.writeFile(metadataPath, JSON.stringify(metadata), 'utf8');
      
      console.log(`💾 Cache STORED for ${cacheKey} (${(pngBuffer.length / 1024).toFixed(1)}KB)`);
      
      // Clean up cache if needed
      setImmediate(() => this.cleanupCache());
      
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
  }

  async invalidateCache(certificateId) {
    try {
      const files = await fs.readdir(this.cacheDir);
      const matchingFiles = files.filter(file => file.includes(`cert-${certificateId}-`));
      
      for (const file of matchingFiles) {
        const filePath = path.join(this.cacheDir, file);
        await fs.unlink(filePath);
      }
      
      if (matchingFiles.length > 0) {
        console.log(`🗑️ Invalidated ${matchingFiles.length} cache files for certificate ${certificateId}`);
      }
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  async removeCacheFile(cacheKey) {
    try {
      const cacheFilePath = path.join(this.cacheDir, `${cacheKey}.png`);
      const metadataPath = path.join(this.cacheDir, `${cacheKey}.meta.json`);
      
      await fs.unlink(cacheFilePath).catch(() => {});
      await fs.unlink(metadataPath).catch(() => {});
    } catch (error) {
      console.error('Error removing cache file:', error);
    }
  }

  async cleanupCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const metadataFiles = files.filter(file => file.endsWith('.meta.json'));
      
      let totalSize = 0;
      const cacheItems = [];
      
      // Collect cache metadata
      for (const metaFile of metadataFiles) {
        try {
          const metadataPath = path.join(this.cacheDir, metaFile);
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
          
          const cacheFilePath = path.join(this.cacheDir, `${metadata.cacheKey}.png`);
          const stats = await fs.stat(cacheFilePath);
          
          metadata.actualFileSize = stats.size;
          totalSize += stats.size;
          cacheItems.push(metadata);
        } catch (error) {
          // Remove orphaned metadata file
          await fs.unlink(path.join(this.cacheDir, metaFile)).catch(() => {});
        }
      }
      
      console.log(`💾 Cache status: ${cacheItems.length} items, ${(totalSize / 1024 / 1024).toFixed(1)}MB`);
      
      // Remove expired items
      const now = Date.now();
      let removedExpired = 0;
      
      for (const item of cacheItems) {
        if (now - item.createdAt > this.maxCacheAge) {
          await this.removeCacheFile(item.cacheKey);
          totalSize -= item.actualFileSize;
          removedExpired++;
        }
      }
      
      if (removedExpired > 0) {
        console.log(`🗑️ Removed ${removedExpired} expired cache items`);
      }
      
      // If still over size limit, remove least recently used items
      if (totalSize > this.maxCacheSize) {
        const validItems = cacheItems.filter(item => now - item.createdAt <= this.maxCacheAge);
        
        // Sort by last access time (LRU)
        validItems.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
        
        let removedLRU = 0;
        for (const item of validItems) {
          if (totalSize <= this.maxCacheSize) break;
          
          await this.removeCacheFile(item.cacheKey);
          totalSize -= item.actualFileSize;
          removedLRU++;
        }
        
        if (removedLRU > 0) {
          console.log(`🗑️ Removed ${removedLRU} LRU cache items to stay under size limit`);
        }
      }
      
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }

  async getCertificateWithCache(certificate, templatePath = null) {
    try {
      // Generate cache key
      const cacheKey = this.getCacheKey(certificate);
      
      // Try to get from cache first
      let pngBuffer = await this.getCachedCertificate(cacheKey);
      
      if (!pngBuffer) {
        // Cache miss - generate certificate
        console.log(`💾 Cache MISS for ${cacheKey}, generating certificate...`);
        pngBuffer = await this.generateCertificate(certificate, templatePath);
        
        // Store in cache
        await this.setCachedCertificate(cacheKey, pngBuffer);
      }
      
      return pngBuffer;
    } catch (error) {
      console.error('Error in getCertificateWithCache:', error);
      // Fallback to direct generation if caching fails
      return await this.generateCertificate(certificate, templatePath);
    }
  }
}

module.exports = new CertificateService(); 