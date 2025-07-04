# Trampoline Tracker

A web application for tracking gymnast progress through trampoline skill levels and routines.

## Features

- **Multi-role Authentication**: Club Admin, Coach, Gymnast, and Parent/Guardian roles
- **Club Management**: Create and manage gymnastics clubs
- **Gymnast Tracking**: Track multiple gymnasts and their progress
- **Skill Levels**: 10 sequential levels plus side paths for specialized training
- **Progress Monitoring**: Track skill and routine completion
- **Guardian Access**: Parents can request access to view their child's progress
- **Role-based Permissions**: Different access levels for different user types

## Tech Stack

- **Frontend**: React 18, React Router, Axios
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: JWT tokens
- **Deployment**: Railway (recommended)

## Project Structure

```
trampoline-tracker/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── routes/
│   │   ├── auth.js
│   │   ├── clubs.js
│   │   ├── gymnasts.js
│   │   ├── levels.js
│   │   ├── skills.js
│   │   └── progress.js
│   ├── middleware/
│   │   └── auth.js
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   └── App.js
│   ├── public/
│   └── package.json
└── package.json
```

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd trampoline-tracker

# Install all dependencies
npm run setup
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
```

### 3. Database Setup

```bash
# Generate Prisma client
cd backend
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database with trampoline skills and levels
npm run db:seed

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

### 4. Development

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run server  # Backend only
npm run client  # Frontend only
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## User Roles

### Club Admin
- Create and manage club settings
- Full access to all club data
- Can create coaches and manage all gymnasts
- Can mark progress for any gymnast

### Coach
- Can create and manage gymnasts
- Can mark skill and level progress
- Can approve guardian access requests
- View all gymnasts in their club

### Gymnast
- Can view their own progress
- Read-only access to their skill and level data

### Parent/Guardian
- Can request access to view their child's progress
- Read-only access to approved gymnast data
- Must be approved by coaches for access

## Database Schema

The application uses these main entities:

- **User**: Authentication and role management
- **Club**: Organization management
- **Gymnast**: Athlete profiles
- **Level**: Skill progression levels (1-10 + side paths)
- **Skill**: Individual skills within levels
- **Routine**: Required routines for levels
- **SkillProgress**: Tracks skill completion
- **LevelProgress**: Tracks level completion
- **GuardianRequest**: Manages parent access requests

## Deployment

### Railway Deployment (Recommended)

1. **Create Railway Account**: Sign up at [railway.app](https://railway.app)

2. **Connect Repository**: Link your GitHub repository

3. **Add Database**: Add a PostgreSQL database service

4. **Environment Variables**: Set the following in Railway:
   ```
   DATABASE_URL (automatically set by Railway)
   JWT_SECRET=your-secret-key
   NODE_ENV=production
   FRONTEND_URL=https://your-app.railway.app
   ```

5. **Deploy**: Railway will automatically deploy your application

### Manual Deployment Steps

1. **Build Frontend**:
   ```bash
   npm run build
   ```

2. **Set Environment Variables**: Configure production environment variables

3. **Run Database Migrations**:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

4. **Start Production Server**:
   ```bash
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Clubs
- `GET /api/clubs` - List all clubs
- `POST /api/clubs` - Create new club
- `GET /api/clubs/:id` - Get club details

### Gymnasts
- `GET /api/gymnasts` - List club gymnasts
- `POST /api/gymnasts` - Create new gymnast

### Levels & Skills
- `GET /api/levels` - List all levels and skills
- `GET /api/skills` - List all skills

### Progress
- `GET /api/progress/gymnast/:id` - Get gymnast progress

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please open an issue in the repository. 