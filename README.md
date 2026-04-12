# Trampoline Tracker

A web application for managing a gymnastics club — bookings, payments, skill progression, competitions, and communications, all under one roof.

## Features

- **Multi-role authentication** — Club Admin, Coach, Adult (guardian), and Gymnast roles with fine-grained permissions
- **Club management** — branding, theming, custom fields, email settings
- **Member & gymnast management** — profiles, guardian relationships, co-guardians, named contacts, BG membership numbers, health notes, photo consents
- **Skill levels & progress tracking** — 10+ sequential levels with side paths, skills with FIG difficulty scores and notation, routines, completion tracking, certificates
- **Booking system** — session templates, calendar, multi-gymnast checkout, Stripe payments, credits, waitlist, closures
- **Memberships (recurring billing)** — Stripe subscriptions, standing slots, pause/resume/cancel, pro-rata first payment
- **Competition management** — invite gymnasts (individual or synchro pairs), category and price selection, accept/decline flow, payment invoicing, entry submission tracking
- **Shop** — product variants, cart checkout, order fulfilment workflow
- **Communications** — noticeboard (pinned posts with priority), email messaging with recipient groups and scheduled delivery
- **Incident & welfare reporting** — first aid incident records and welfare concern reports, visible to coaches and admins
- **Audit logging** — all admin actions logged with actor and metadata
- **Transactional emails** — 15+ email types gated by club email settings

## Tech Stack

- **Frontend**: React 18, React Router, Axios
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL
- **Payments**: Stripe (Payment Intents, Subscriptions, Webhooks)
- **Authentication**: JWT tokens
- **Email**: Nodemailer (Gmail SMTP)

## Project Structure

```
trampoline-tracker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── clubs.js
│   │   ├── gymnasts.js
│   │   ├── levels.js
│   │   ├── skills.js
│   │   ├── progress.js
│   │   └── booking/
│   │       ├── sessions.js
│   │       ├── bookings.js
│   │       ├── charges.js
│   │       ├── credits.js
│   │       ├── memberships.js
│   │       ├── competitionEvents.js
│   │       ├── competitionEntries.js
│   │       └── ...
│   ├── services/
│   │   ├── emailService.js
│   │   ├── stripeService.js
│   │   └── ...
│   ├── middleware/
│   │   └── auth.js
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   │   ├── booking/
│   │   │   │   └── admin/
│   │   │   └── public/
│   │   └── App.js
│   ├── public/
│   └── package.json
└── package.json
```

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd trampoline-tracker
cd backend && npm install && cd ../frontend && npm install && cd ..
```

### 2. Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/trampoline_tracker"

# JWT
JWT_SECRET="your-super-secure-jwt-secret-key-here"
JWT_EXPIRE="7d"

# Server
PORT=5000
NODE_ENV="development"

# CORS
FRONTEND_URL="http://localhost:3000"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (Gmail SMTP)
GMAIL_USER="your@gmail.com"
GMAIL_PASS="your-app-password"
```

### 3. Database Setup

```bash
cd backend

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed the database with trampoline skills and levels
npm run db:seed

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

### 4. Development

```bash
# Start backend
cd backend && npm run dev

# In a second terminal, start frontend
cd frontend && npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## User Roles

### Club Admin
- Full access to all club data and configuration
- Create and manage members, gymnasts, sessions, closures, competitions
- Manage memberships, credits, charges, and shop products
- Send messages and manage noticeboard
- View audit log and incident/welfare reports

### Coach
- All admin tools except creating/deleting closures and full system configuration
- Mark skill and level progress for gymnasts
- Verify BG membership numbers
- Create and manage competitions, invite gymnasts
- View and file incident and welfare reports

### Adult (Parent/Guardian)
- Book sessions for linked gymnasts, manage cancellations
- View and pay charges and memberships
- Accept or decline competition invitations on behalf of gymnasts
- View gymnast skill progress (read-only)
- Read noticeboard and account information

### Gymnast
- View own progress (skills, levels, certificates)
- Access via share code or direct login

## Database Schema

Key entities:

- **User** — authentication, roles, and guardian relationships
- **Club** — organisation settings and branding
- **Gymnast** — athlete profiles with health, consent, and BG membership data
- **Level / Skill / Routine** — skill progression hierarchy with FIG data
- **SkillProgress / LevelProgress** — completion tracking per gymnast
- **Certificate** — awarded certificates with template-based PDF generation
- **SessionTemplate / Session** — recurring schedule and individual instances
- **Booking** — session bookings with Stripe payment tracking
- **Membership** — Stripe subscription records with standing slots
- **Credit / Charge** — account balance adjustments
- **CompetitionEvent / CompetitionEntry** — competition management and entry tracking
- **IncidentReport / WelfareReport** — safeguarding and first aid records
- **Noticeboard / Message** — club communications

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
