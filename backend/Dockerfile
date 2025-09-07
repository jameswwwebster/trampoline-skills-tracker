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
COPY package*.json ./
RUN npm install canvas@^2.11.2 --verbose
RUN npm ci --ignore-scripts
COPY . .

# Canvas will be tested at runtime

# Build prisma client
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000
CMD ["npm", "start"]
