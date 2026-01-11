/**
 * Script to convert PDF pages to JPG images
 * Run this once to convert the cheatsheet PDF to individual page images
 * 
 * Usage: node scripts/convert-pdf-to-images.js
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const sharp = require('sharp');

// For PDF to image conversion, we'll use pdf-poppler or pdf2pic
// Since we have sharp, let's check if we can use pdfjs-dist or need another library
// Actually, for this we might need pdf-poppler or use a different approach

// Use pdfjs-dist to render pages to canvas, then convert to image
const pdfjsLib = require('pdfjs-dist');
const { createCanvas } = require('canvas');

// Set up PDF.js worker (not needed for server-side, but prevents warnings)
pdfjsLib.GlobalWorkerOptions.workerSrc = false; // Disable worker in Node.js

async function convertPDFToImages(pdfPath, outputDir) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read PDF file
    const dataBuffer = fs.readFileSync(pdfPath);
    const uint8Array = new Uint8Array(dataBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDoc = await loadingTask.promise;
    
    console.log(`PDF has ${pdfDoc.numPages} pages`);

    // Convert each page to an image
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      console.log(`Converting page ${pageNum}...`);
      
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // High DPI for quality
      
      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Convert canvas to buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Convert PNG to JPG using sharp (smaller file size)
      const jpgBuffer = await sharp(buffer)
        .jpeg({ quality: 90 })
        .toBuffer();
      
      // Save as JPG
      const outputPath = path.join(outputDir, `page-${pageNum}.jpg`);
      fs.writeFileSync(outputPath, jpgBuffer);
      
      console.log(`✓ Saved page ${pageNum} to ${outputPath}`);
    }
    
    console.log(`\n✅ Conversion complete! ${pdfDoc.numPages} pages converted.`);
  } catch (error) {
    console.error('Error converting PDF:', error);
    process.exit(1);
  }
}

// Main execution
const pdfPath = path.join(__dirname, '../../resources/requirement-cheatsheets/2026 Requirements (1).pdf');
const outputDir = path.join(__dirname, '../../resources/requirement-cheatsheets/pages');

convertPDFToImages(pdfPath, outputDir)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

