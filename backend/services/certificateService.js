const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { PrismaClient } = require('@prisma/client');

class CertificateService {
  constructor() {
    this.prisma = new PrismaClient();
    this.fontPath = path.join(__dirname, '../fonts/LilitaOne-Regular.ttf');
    this.certificatesDir = path.join(__dirname, '../generated-certificates');
    
    // Register custom font
    try {
      registerFont(this.fontPath, { family: 'Lilita One' });
    } catch (error) {
      console.log('⚠️ Failed to register Lilita One font:', error.message);
    }
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
          console.log('⚠️ No custom templates found, generating basic certificate');
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
      console.log('🔄 Falling back to basic certificate generation...');
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
    } catch (error) {
      console.error('Error deleting certificate files:', error);
    }
  }
}

module.exports = new CertificateService(); 