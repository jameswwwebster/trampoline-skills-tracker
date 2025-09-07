const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
 

const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clubRoutes = require('./routes/clubs');
const gymnastRoutes = require('./routes/gymnasts');
const levelRoutes = require('./routes/levels');
const skillRoutes = require('./routes/skills');
const progressRoutes = require('./routes/progress');
const inviteRoutes = require('./routes/invites');
const competitionRoutes = require('./routes/competitions');
const dashboardRoutes = require('./routes/dashboard');
const certificateRoutes = require('./routes/certificates');
const certificateTemplateRoutes = require('./routes/certificateTemplates');
const certificateFieldRoutes = require('./routes/certificateFields');
const importRoutes = require('./routes/import');
const brandingRoutes = require('./routes/branding');
const guardianRequestRoutes = require('./routes/guardianRequests');
const userCustomFieldRoutes = require('./routes/userCustomFields');
const systemAdminRoutes = require('./routes/systemAdmin');

const app = express();
const prisma = new PrismaClient();

// Test Canvas availability at startup
console.log('🔍 Testing Canvas availability...');
try {
  const canvas = require('canvas');
  console.log('✅ Canvas loaded successfully at startup');
  console.log('   Canvas version:', canvas.version);
} catch (error) {
  console.log('❌ Canvas failed to load at startup');
  console.log('   Error:', error.message);
  console.log('   Stack:', error.stack);
}

// No proxy-specific trust needed for local/basic hosting
app.set('trust proxy', false);

// Basic security headers (HTTPS-only headers removed)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(helmet());

// CORS configuration for local and Render deployment
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://trampoline-frontend.onrender.com',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/gymnasts', gymnastRoutes);
app.use('/api/levels', levelRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/certificate-templates', certificateTemplateRoutes);
app.use('/api/certificate-fields', certificateFieldRoutes);
app.use('/api/import', importRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/guardian-requests', guardianRequestRoutes);
app.use('/api/user-custom-fields', userCustomFieldRoutes);
app.use('/api/system-admin', systemAdminRoutes);
app.use('/api/super-admin', require('./routes/superAdmin'));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbConnected = false;
  try {
    // Lightweight DB connectivity check
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch (e) {
    dbConnected = false;
  }

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    storage: 'local',
    dbConnected
  });
});

// Canvas test endpoint
app.get('/api/canvas-test', (req, res) => {
  try {
    const canvas = require('canvas');
    const { createCanvas, loadImage, registerFont } = canvas;
    
    // Test basic canvas creation
    const testCanvas = createCanvas(400, 200);
    const ctx = testCanvas.getContext('2d');
    
    // Test basic drawing
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 400, 200);
    
    ctx.fillStyle = '#333';
    ctx.font = '20px Arial';
    ctx.fillText('Canvas Test', 20, 40);
    
    // Test custom font loading
    let fontTest = 'Custom font: Not available';
    try {
      const fontPath = require('path').join(__dirname, 'fonts', 'LilitaOne-Regular.ttf');
      registerFont(fontPath, { family: 'Lilita One' });
      ctx.font = '20px "Lilita One"';
      ctx.fillText('Custom Font Test', 20, 80);
      fontTest = 'Custom font: Available';
    } catch (fontError) {
      ctx.font = '16px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText('Custom font: Not available', 20, 80);
    }
    
    // Test shapes
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(20, 100, 50, 50);
    
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(120, 125, 25, 0, 2 * Math.PI);
    ctx.fill();
    
    // Convert to PNG
    const buffer = testCanvas.toBuffer('image/png');
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="canvas-test.png"');
    res.send(buffer);
    
  } catch (error) {
    res.status(500).json({
      error: 'Canvas test failed',
      message: error.message,
      stack: error.stack
    });
  }
});
// API-only server; no frontend static file serving

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app; 