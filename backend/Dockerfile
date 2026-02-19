FROM node:18-bullseye

# Install system deps for node-canvas
RUN apt-get update && apt-get install -y \
  build-essential \
  python3 \
  pkg-config \
  libcairo2 \
  libcairo2-dev \
  libpango-1.0-0 \
  libpango1.0-dev \
  libjpeg62-turbo \
  libjpeg62-turbo-dev \
  libgif7 \
  libgif-dev \
  librsvg2-2 \
  librsvg2-dev \
  fonts-dejavu-core \
  fontconfig \
  libpixman-1-dev \
  libpixman-1-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# When build context is repo root (render.yaml dockerContext: .), copy from backend/ and resources/
COPY backend/package*.json ./
RUN npm install canvas@^2.11.2 --verbose
RUN npm ci --ignore-scripts
COPY backend/ .
COPY resources ./resources
RUN echo "Cheatsheet files:" && ls -la resources/requirement-cheatsheets/ && \
    (test -f resources/requirement-cheatsheets/2026-Requirements.pdf && echo "2026-Requirements.pdf OK" || echo "WARNING: 2026-Requirements.pdf not found")

# Rebuild canvas native module to ensure it's properly compiled
RUN npm rebuild canvas --verbose

# Verify canvas installation
RUN node -e "try { const canvas = require('canvas'); console.log('Canvas version:', canvas.version); } catch(e) { console.error('Canvas verification failed:', e.message); process.exit(1); }"

# Build prisma client
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000
CMD ["npm", "start"]
