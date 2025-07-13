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

// Trust proxy for Railway deployment and rate limiting
app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// CORS configuration with debugging
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'https://frontend-production-1d285.up.railway.app'
    ].filter(Boolean);
    
    console.log('CORS check - Origin:', origin);
    console.log('CORS check - Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS rejected origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Switch-Club-Id']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per 15 minutes (reasonable for normal usage)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  trustProxy: true // Trust Railway's proxy headers
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
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
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