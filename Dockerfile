# Multi-stage Dockerfile for Trampoline Skills Tracker
# This builds both frontend and backend in a single container

# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci --only=production

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend

# Install build dependencies for native modules (canvas)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy backend package files
COPY backend/package*.json ./

# Copy backend source (needed for Prisma schema before npm install)
COPY backend/ ./

# Install dependencies (this will also run prisma generate via postinstall)
RUN npm ci --only=production

# Force regenerate Prisma client for the correct OpenSSL version
RUN npx prisma generate

# Stage 3: Production Runtime
FROM node:18-alpine AS runtime

# Set Prisma to use OpenSSL 3.x (available in Alpine 3.21+)
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    openssl \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy backend from builder
COPY --from=backend-builder /app/backend ./backend

# Copy frontend build to backend's public directory
COPY --from=frontend-builder /app/frontend/build ./backend/public

# Create uploads directory
RUN mkdir -p /app/backend/uploads/certificate-templates

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
CMD ["node", "server.js"] 