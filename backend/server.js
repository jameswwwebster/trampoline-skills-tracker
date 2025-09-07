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

// Development-friendly CORS for local usage
app.use(cors({
  origin: ['http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean),
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