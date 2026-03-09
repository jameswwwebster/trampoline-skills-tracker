const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
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
const guardianInviteRoutes = require('./routes/guardianInvites');
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
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://trampoline-frontend.onrender.com',
    'https://booking.trampoline.life',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
};

console.log('🌐 CORS Configuration:');
console.log('   Allowed origins:', corsOptions.origin);
console.log('   FRONTEND_URL env var:', process.env.FRONTEND_URL);

app.use(cors(corsOptions));

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({ 
    message: 'CORS is working!', 
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Stripe webhook — must be registered before express.json() to receive raw body
app.use('/api/booking/webhook', require('./routes/booking/webhook'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Static file serving for cheatsheets (public access)
// Use backend/resources path directly
const cheatsheetsPath = path.join(__dirname, 'resources/requirement-cheatsheets');
// Static file serving for cheatsheets with proper CORS
app.use('/cheatsheets', (req, res, next) => {
  // Check if the origin is in the allowed list
  const origin = req.headers.origin;
  const allowedOrigin = corsOptions.origin.find(allowed => allowed === origin) || corsOptions.origin[0] || '*';
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  next();
}, express.static(cheatsheetsPath));

// Static file serving for source documents (public access)
const sourcesPath = path.join(__dirname, 'resources/sources');
app.use('/sources', (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = corsOptions.origin.find(allowed => allowed === origin) || corsOptions.origin[0] || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
}, express.static(sourcesPath));

// Test endpoint to verify cheatsheet files are accessible
app.get('/api/cheatsheets/test', (req, res) => {
  const fs = require('fs');
  try {
    const files = fs.readdirSync(cheatsheetsPath);
    const pagesPath = path.join(cheatsheetsPath, 'pages');
    const pagesFiles = fs.existsSync(pagesPath) ? fs.readdirSync(pagesPath) : [];
    res.json({ 
      path: cheatsheetsPath,
      files: files,
      pagesFiles: pagesFiles,
      exists: fs.existsSync(cheatsheetsPath)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
app.use('/api/guardian-invites', guardianInviteRoutes);
app.use('/api/user-custom-fields', userCustomFieldRoutes);
app.use('/api/system-admin', systemAdminRoutes);
app.use('/api/super-admin', require('./routes/superAdmin'));

// Booking routes
app.use('/api/booking/sessions', require('./routes/booking/sessions'));
app.use('/api/booking/bookings', require('./routes/booking/bookings'));
app.use('/api/booking/credits', require('./routes/booking/credits'));
app.use('/api/booking/closures', require('./routes/booking/closures'));
app.use('/api/booking/memberships', require('./routes/booking/memberships'));
app.use('/api/booking/waitlist', require('./routes/booking/waitlist'));
app.use('/api/booking/admin', require('./routes/booking/admin'));
app.use('/api/booking/templates', require('./routes/booking/templates'));

// Booking: daily session generation cron
const cron = require('node-cron');
const { generateRollingInstances } = require('./services/sessionGenerator');
const { expireStaleOffers } = require('./services/waitlistService');

// Run at 02:00 every day
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily session generation...');
  try {
    const clubs = await prisma.club.findMany({
      where: { isArchived: false },
      select: { id: true },
    });
    for (const club of clubs) {
      await generateRollingInstances(club.id);
    }
  } catch (err) {
    console.error('Session generation cron error:', err);
  }
});

// Expire stale waitlist offers every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    await expireStaleOffers();
  } catch (err) {
    console.error('Waitlist expiry cron error:', err);
  }
});

// Cancel stale PENDING bookings every hour (abandoned checkouts)
cron.schedule('0 * * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const stale = await prisma.booking.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
    });
    for (const booking of stale) {
      await prisma.credit.updateMany({
        where: { usedOnBookingId: booking.id },
        data: { usedAt: null, usedOnBookingId: null },
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      });
    }
    if (stale.length > 0) {
      console.log(`Cleaned up ${stale.length} stale PENDING booking(s)`);
    }
  } catch (err) {
    console.error('Stale booking cleanup cron error:', err);
  }
});

// Also run on startup to ensure instances exist immediately after deploy
(async () => {
  try {
    const clubs = await prisma.club.findMany({
      where: { isArchived: false },
      select: { id: true },
    });
    for (const club of clubs) {
      await generateRollingInstances(club.id);
    }
  } catch (err) {
    console.error('Startup session generation error:', err);
  }
})();

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

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