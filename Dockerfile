# Multi-stage build for production
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Build the client
FROM base AS client-builder
WORKDIR /app/client

# Copy client source
COPY client/package*.json ./
COPY client/vite.config.ts ./
COPY client/tailwind.config.js ./
COPY client/postcss.config.js ./
COPY client/tsconfig*.json ./
COPY client/src ./src
COPY client/index.html ./

# Install client dependencies and build
RUN npm ci
RUN npm run build

# Build the server
FROM base AS server-builder
WORKDIR /app/server

# Copy server source
COPY server/package*.json ./
COPY server/index.js ./
COPY server/middleware ./middleware
COPY server/services ./services

# Install server dependencies
RUN npm ci --only=production

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built client
COPY --from=client-builder --chown=nextjs:nodejs /app/client/dist ./client/dist

# Copy server
COPY --from=server-builder --chown=nextjs:nodejs /app/server ./server

# Copy root package.json
COPY --chown=nextjs:nodejs package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000

# Expose port
EXPOSE 4000

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the server
CMD ["node", "server/index.js"] 