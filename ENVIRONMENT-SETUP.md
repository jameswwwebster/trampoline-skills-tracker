# Environment Variables Setup Guide

## 🔧 Development Setup

### 1. **Backend Environment Variables**

The backend uses a `.env` file to load environment variables. A development `.env` file has been created for you.

**Location**: `backend/.env`

```bash
# Basic development configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/trampoline_tracker"
JWT_SECRET="development-secret-change-in-production"
JWT_EXPIRE="7d"
PORT=5000
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
```

### 2. **Frontend Environment Variables**

The frontend uses environment variables that start with `REACT_APP_`.

**Created**: `frontend/.env`

```bash
# Frontend API endpoint
REACT_APP_API_URL=http://localhost:5000
```

## 🛠️ Testing Environment Variables

**Backend Test:**
```bash
cd backend
node -e "
require('dotenv').config();
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Missing');
console.log('PORT:', process.env.PORT);
"
```

## 🔒 Security

- ✅ .env files are ignored by git
- ✅ Use different secrets for development/production
- ✅ Generate secure JWT secrets for production

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Remember: **Never commit .env files to git!**
