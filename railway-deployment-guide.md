# Railway Deployment Troubleshooting Guide

## 🚨 Critical Issues to Check

### 1. **Environment Variables** (Most Common Issue)

**Backend Service Required:**
```bash
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key-here
FRONTEND_URL=https://your-frontend-url.railway.app
NODE_ENV=production
```

**Frontend Service Required:**
```bash
REACT_APP_API_URL=https://your-backend-url.railway.app
```

**Optional Email Configuration:**
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@trampolinetracker.com
```

### 2. **Database Setup**

1. **Create PostgreSQL Database:**
   - In Railway dashboard, add PostgreSQL service
   - Note the DATABASE_URL from the database service
   - Add this to your backend service environment variables

2. **Migration Issues:**
   - Backend now runs `npx prisma migrate deploy` during build
   - This should apply all migrations automatically
   - If migrations fail, check DATABASE_URL format

### 3. **Service Configuration**

**Backend Service:**
- Build Command: `npm install && npm run build && npx prisma migrate deploy`
- Start Command: `npm start`
- Health Check: `/api/health`
- Port: Automatically assigned by Railway

**Frontend Service:**
- Build Command: `npm install && npm install -g serve && npm run build`
- Start Command: `npx serve -s build -l $PORT`
- Port: Automatically assigned by Railway

### 4. **Common Deployment Errors**

**Error: "listen EADDRINUSE"**
- Solution: Remove hardcoded PORT in environment variables
- Railway automatically assigns ports

**Error: "JWT_SECRET is not defined"**
- Solution: Add JWT_SECRET environment variable
- Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

**Error: "Database connection failed"**
- Solution: Check DATABASE_URL format
- Ensure PostgreSQL service is running
- Check database service connectivity

**Error: "Prisma migrations failed"**
- Solution: Check if DATABASE_URL is accessible
- Manually run: `npx prisma migrate deploy`
- Check for migration conflicts

**Error: "CORS policy"**
- Solution: Set FRONTEND_URL in backend environment
- Set REACT_APP_API_URL in frontend environment
- Ensure URLs match Railway service URLs

### 5. **Deployment Steps**

1. **Prepare Environment Variables:**
   ```bash
   # Generate JWT secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Deploy Backend:**
   - Create Railway service from backend folder
   - Add PostgreSQL database service
   - Set environment variables
   - Deploy and check logs

3. **Deploy Frontend:**
   - Create Railway service from frontend folder
   - Set REACT_APP_API_URL to backend service URL
   - Deploy and check logs

4. **Update CORS:**
   - Update backend FRONTEND_URL to match frontend service URL
   - Redeploy backend

### 6. **Testing Deployment**

**Backend Health Check:**
```bash
curl https://your-backend-url.railway.app/api/health
```

**Frontend Access:**
```bash
curl -I https://your-frontend-url.railway.app
```

## 🔄 Quick Fix Checklist

- [ ] PostgreSQL service created and running
- [ ] DATABASE_URL set in backend environment
- [ ] JWT_SECRET set in backend environment
- [ ] FRONTEND_URL set in backend environment
- [ ] REACT_APP_API_URL set in frontend environment
- [ ] No hardcoded ports in environment variables
- [ ] Database migrations applied
- [ ] Both services deployed and running
- [ ] Health check endpoint responding
- [ ] CORS configuration updated

## 📞 Common Railway Commands

```bash
# Check service logs
railway logs

# Connect to database
railway connect postgres

# Deploy specific service
railway up --service backend
railway up --service frontend

# Check environment variables
railway variables
```

## 🆘 If Still Failing

1. Check Railway service logs for specific error messages
2. Verify all environment variables are set correctly
3. Test database connectivity manually
4. Check if migrations are applied correctly
5. Verify health check endpoint is accessible
6. Test CORS configuration with browser dev tools 