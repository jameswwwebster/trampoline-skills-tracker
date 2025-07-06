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

const app = express();
const prisma = new PrismaClient();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  trustProxy: false // Since we're not behind a proxy in development
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