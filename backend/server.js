const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
 

const prisma = require('./prisma');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clubRoutes = require('./routes/clubs');
const gymnastRoutes = require('./routes/gymnasts');
const levelRoutes = require('./routes/levels');
const skillRoutes = require('./routes/skills');
const progressRoutes = require('./routes/progress');
const competitionRoutes = require('./routes/competitions');
const dashboardRoutes = require('./routes/dashboard');
const certificateRoutes = require('./routes/certificates');
const certificateTemplateRoutes = require('./routes/certificateTemplates');
const certificateFieldRoutes = require('./routes/certificateFields');
const brandingRoutes = require('./routes/branding');
const systemAdminRoutes = require('./routes/systemAdmin');
const messageRoutes = require('./routes/messages');
const noticeboardRouter = require('./routes/noticeboard');
const recipientGroupsRouter = require('./routes/recipientGroups');
const incidentRoutes = require('./routes/incidents');
const welfareRoutes = require('./routes/welfare');
const guardianInviteRoutes = require('./routes/guardianInvites');
const namedContactRoutes = require('./routes/namedContacts');
const { sendToCoaches, getUKHHMM, getUKDateBounds } = require('./services/pushNotificationService');

const app = express();

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
app.use('/api/competitions', competitionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/certificate-templates', certificateTemplateRoutes);
app.use('/api/certificate-fields', certificateFieldRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/system-admin', systemAdminRoutes);
app.use('/api/super-admin', require('./routes/superAdmin'));
app.use('/api/messages', messageRoutes);
app.use('/api/noticeboard', noticeboardRouter);
app.use('/api/recipient-groups', recipientGroupsRouter);
app.use('/api/incidents', incidentRoutes);
app.use('/api/welfare', welfareRoutes);
app.use('/api/guardian-invites', guardianInviteRoutes);
app.use('/api/named-contacts', namedContactRoutes);
app.use('/api/push', require('./routes/push'));

// Booking routes
app.use('/api/booking/sessions', require('./routes/booking/sessions'));
app.use('/api/booking/bookings', require('./routes/booking/bookings'));
app.use('/api/booking/credits', require('./routes/booking/credits'));
app.use('/api/booking/recurring-credits', require('./routes/booking/recurringCredits'));
app.use('/api/booking/charges', require('./routes/booking/charges'));
app.use('/api/booking/closures', require('./routes/booking/closures'));
app.use('/api/booking/memberships', require('./routes/booking/memberships'));
app.use('/api/commitments', require('./routes/booking/commitments'));
app.use('/api/booking/waitlist', require('./routes/booking/waitlist'));
app.use('/api/booking/admin', require('./routes/booking/admin'));
app.use('/api/booking/admin/payments', require('./routes/booking/payments'));
app.use('/api/booking/templates', require('./routes/booking/templates'));
app.use('/api/booking/attendance', require('./routes/booking/attendance'));
app.use('/api/booking/shop/admin', require('./routes/booking/shopAdmin'));
app.use('/api/booking/shop', require('./routes/booking/shop'));
app.use('/api/booking/competition-events', require('./routes/booking/competitionEvents'));
app.use('/api/booking/competition-entries', require('./routes/booking/competitionEntries'));

// Booking: daily session generation cron
const cron = require('node-cron');
const { generateRollingInstances } = require('./services/sessionGenerator');
const { expireStaleOffers } = require('./services/waitlistService');
const { activateMembership } = require('./services/membershipActivationService');

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

// Activate SCHEDULED memberships due tomorrow or earlier — runs at 23:00 nightly.
// Running the evening before startDate lets activateMembership use trial_end so the
// first full billing period aligns exactly with startDate (no partial-day pro-ration).
cron.schedule('0 23 * * *', async () => {
  try {
    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);
    const due = await prisma.membership.findMany({
      where: { status: 'SCHEDULED', startDate: { lte: tomorrowEnd } },
      select: { id: true },
    });
    for (const m of due) {
      try {
        await activateMembership(m.id, prisma);
      } catch (err) {
        console.error(`Failed to activate membership ${m.id}:`, err);
      }
    }
    if (due.length > 0) console.log(`Activated ${due.length} scheduled membership(s)`);
  } catch (err) {
    console.error('Membership activation cron error:', err);
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

const { sendMessage } = require('./services/messageSender');
const emailService = require('./services/emailService');
const { deleteMember } = require('./services/memberLifecycle');

// Send scheduled messages — runs every minute
cron.schedule('* * * * *', async () => {
  try {
    const due = await prisma.message.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const m of due) {
      await sendMessage(m.id).catch(err => console.error(`Failed to send message ${m.id}:`, err));
    }
  } catch (err) {
    console.error('Scheduled message cron error:', err);
  }
});

// Weekly session reminder — runs every Monday at 08:00
cron.schedule('0 8 * * 1', async () => {
  try {
    // Collect sessions for the next 7 days (Mon–Sun)
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const clubs = await prisma.club.findMany({
      where: { isArchived: false, emailEnabled: true, sessionReminderEnabled: true },
      select: { id: true },
    });

    for (const club of clubs) {
      const instances = await prisma.sessionInstance.findMany({
        where: {
          date: { gte: weekStart, lt: weekEnd },
          cancelledAt: null,
          template: { is: { clubId: club.id } },
        },
        include: {
          template: true,
          bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } },
        },
        orderBy: { date: 'asc' },
      });

      // Only include sessions that still have availability
      const availableSessions = instances
        .map(inst => {
          const bookedCount = inst.bookings.reduce((sum, b) => sum + b.lines.length, 0);
          const capacity = inst.openSlotsOverride ?? inst.template.openSlots;
          const availableSlots = Math.max(0, capacity - bookedCount);
          return { date: inst.date, startTime: inst.template.startTime, endTime: inst.template.endTime, availableSlots };
        })
        .filter(s => s.availableSlots > 0);

      if (availableSessions.length === 0) continue;

      // Exclude guardians only if ALL of their gymnasts are on active memberships.
      // A parent with one member child and one non-member child still needs the reminder.
      const guardianCandidates = await prisma.user.findMany({
        where: { clubId: club.id, isArchived: false, email: { not: null }, weeklySessionReminder: true },
        select: {
          id: true, email: true, firstName: true,
          gymnasts: {
            select: {
              memberships: { where: { status: 'ACTIVE', clubId: club.id }, select: { id: true } },
            },
          },
        },
      });

      const members = guardianCandidates.filter(u => {
        // Include if they have no gymnasts (books for themselves) OR at least one gymnast without an active membership
        if (u.gymnasts.length === 0) return true;
        return u.gymnasts.some(g => g.memberships.length === 0);
      });

      for (const member of members) {
        await emailService.sendWeeklySessionReminderEmail(
          member.email, member.firstName, availableSessions
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Weekly session reminder cron error:', err);
  }
});

// Membership payment reminder — runs daily at 09:00
cron.schedule('0 9 * * *', async () => {
  try {
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    in3Days.setHours(23, 59, 59, 999);

    const memberships = await prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        club: { emailEnabled: true, membershipReminderEnabled: true },
      },
      include: {
        gymnast: { include: { guardians: { select: { id: true, email: true, firstName: true } } } },
        club: true,
      },
    });

    for (const m of memberships) {
      const billingDay = new Date(m.startDate).getDate();
      if (in3Days.getDate() !== billingDay) continue;

      for (const guardian of m.gymnast.guardians) {
        if (!guardian.email) continue;
        await emailService.sendMembershipPaymentReminderEmail(
          guardian.email, guardian.firstName, m.gymnast, m.monthlyAmount, in3Days
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Membership reminder cron error:', err);
  }
});

// Inactivity warning + deletion — runs daily at 02:30
cron.schedule('30 2 * * *', async () => {
  try {
    const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
    const WARNING_MS = SIX_MONTHS_MS - 7 * 24 * 60 * 60 * 1000; // 5 months 3 weeks
    const now = new Date();

    const allUsers = await prisma.user.findMany({
      where: {
        isArchived: false,
        role: { notIn: ['CLUB_ADMIN', 'SUPER_ADMIN'] },
        club: { emailEnabled: true, inactivityWarningEnabled: true },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastLoginAt: true,
        createdAt: true,
        bookings: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    for (const user of allUsers) {
      const lastActivity =
        user.lastLoginAt ||
        (user.bookings[0]?.createdAt) ||
        user.createdAt;

      const idleMs = now - new Date(lastActivity);

      if (idleMs >= SIX_MONTHS_MS) {
        await deleteMember(user.id, 'INACTIVITY', null).catch(err =>
          console.error(`Failed to delete inactive user ${user.id}:`, err)
        );
      } else if (idleMs >= WARNING_MS && user.email) {
        await emailService.sendInactivityWarningEmail(user.email, user.firstName).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Inactivity cron error:', err);
  }
});

// BG number pending digest — runs daily at 07:30
cron.schedule('30 7 * * *', async () => {
  try {
    const pending = await prisma.gymnast.findMany({
      where: { bgNumberStatus: 'PENDING', isArchived: false, club: { emailEnabled: true } },
      include: {
        guardians: { select: { firstName: true, lastName: true } },
        club: { select: { id: true } },
      },
      orderBy: { bgNumberEnteredAt: 'asc' },
    });

    if (pending.length === 0) return;

    // Group by club
    const byClub = {};
    for (const g of pending) {
      if (!byClub[g.club.id]) byClub[g.club.id] = [];
      const guardian = g.guardians[0];
      byClub[g.club.id].push({
        firstName: g.firstName,
        lastName: g.lastName,
        bgNumber: g.bgNumber,
        bgNumberEnteredAt: g.bgNumberEnteredAt,
        guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : '—',
      });
    }

    for (const [clubId, gymnasts] of Object.entries(byClub)) {
      const coaches = await prisma.user.findMany({
        where: { clubId, role: { in: ['CLUB_ADMIN', 'COACH'] }, isArchived: false, email: { not: null } },
        select: { email: true, firstName: true },
      });
      const adminUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/booking/admin/bg-numbers`;
      for (const coach of coaches) {
        await emailService.sendBgNumberPendingDigestEmail(
          coach.email, coach.firstName, gymnasts, adminUrl
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('BG number digest cron error:', err);
  }
});

// New member digest — runs daily at 08:00
cron.schedule('0 8 * * *', async () => {
  try {
    const club = await prisma.club.findFirst();
    if (!club?.emailEnabled) return;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newMembers = await prisma.user.findMany({
      where: { clubId: club.id, createdAt: { gte: since } },
      select: { firstName: true, lastName: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    if (newMembers.length === 0) return;

    const staff = await prisma.user.findMany({
      where: { clubId: club.id, role: { in: ['CLUB_ADMIN', 'COACH'] }, isArchived: false, email: { not: null } },
      select: { email: true, firstName: true },
    });
    for (const member of staff) {
      await emailService.sendNewMemberDigestEmail(
        member.email, member.firstName, newMembers,
      ).catch(() => {});
    }
    console.log(`New member digest: sent to ${staff.length} staff (${newMembers.length} new member(s))`);
  } catch (err) {
    console.error('New member digest cron error:', err);
  }
});

// Recurring credits — runs at 09:00 UTC on the 1st of every month
cron.schedule('0 9 1 * *', async () => {
  try {
    const { processRecurringCredits } = require('./routes/booking/recurringCredits');
    await processRecurringCredits();
  } catch (err) {
    console.error('Recurring credits cron error:', err);
  }
});

// Incident report adult notifications — send 1 hour after report is filed, once per report
cron.schedule('* * * * *', async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const pending = await prisma.incidentReport.findMany({
      where: {
        adultNotifiedAt: null,
        createdAt: { lte: oneHourAgo },
        gymnast: { isNot: null },
        club: { emailEnabled: true },
      },
      include: {
        gymnast: {
          include: {
            guardians: { select: { id: true, email: true, firstName: true } },
            user: { select: { id: true, email: true, firstName: true } },
          },
        },
      },
    });

    for (const incident of pending) {
      const recipients = [];
      if (incident.gymnast) {
        if (incident.gymnast.user?.email) {
          recipients.push({ email: incident.gymnast.user.email, name: incident.gymnast.user.firstName });
        }
        for (const g of incident.gymnast.guardians) {
          if (g.email) recipients.push({ email: g.email, name: g.firstName });
        }
      }

      const reportUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/booking/incidents/${incident.id}`;
      for (const r of recipients) {
        await emailService.sendIncidentAdultNotification(
          r.email, r.name, incident.gymnast, incident, reportUrl,
        ).catch(err => console.error('Incident adult notification failed:', err));
      }

      await prisma.incidentReport.update({
        where: { id: incident.id },
        data: { adultNotifiedAt: new Date() },
      });
    }
  } catch (err) {
    console.error('Incident notification cron error:', err);
  }
});

// Session reminder push notifications — runs every minute
// Sends to all subscribed coaches 5 minutes before a session starts
// TODO: use club.timezone when multi-timezone support is needed
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const in5 = new Date(now.getTime() + 5 * 60 * 1000);
    const targetTime = getUKHHMM(in5);
    const { gte, lt } = getUKDateBounds(in5);

    const instances = await prisma.sessionInstance.findMany({
      where: {
        date: { gte, lt },
        cancelledAt: null,
        template: { startTime: targetTime },
      },
      include: { template: true },
    });

    for (const instance of instances) {
      await sendToCoaches(prisma, instance.template.clubId, 'SESSION_REMINDER', {
        title: 'Session starting in 5 minutes',
        body: "Don't forget to take the register!",
        url: '/booking/admin',
      });
    }
  } catch (err) {
    console.error('Session reminder push error:', err);
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

// Activate any SCHEDULED memberships that are due (catches up after downtime)
(async () => {
  try {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const due = await prisma.membership.findMany({
      where: { status: 'SCHEDULED', startDate: { lte: todayEnd } },
      select: { id: true },
    });
    for (const m of due) {
      try {
        await activateMembership(m.id, prisma);
      } catch (err) {
        console.error(`Startup: failed to activate membership ${m.id}:`, err);
      }
    }
    if (due.length > 0) console.log(`Startup: activated ${due.length} scheduled membership(s)`);
  } catch (err) {
    console.error('Startup membership activation error:', err);
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