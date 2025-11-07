# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.7.1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml package-lock.json* ./

# Install ALL dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code and config files
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine

# Install pnpm and required tools
RUN npm install -g pnpm@10.7.1 && \
    apk add --no-cache wget

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml package-lock.json* ./

# Install ALL dependencies (needed for preview server)
RUN pnpm install --frozen-lockfile

# Copy built application and necessary files from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/static ./static
COPY --from=builder /app/.react-router ./.react-router

# Copy configuration files
COPY react-router.config.ts ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY postcss.config.mjs ./

# Expose port
EXPOSE 5173

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173/ || exit 1

# Start the preview server
CMD ["pnpm", "run", "preview", "--host", "0.0.0.0", "--port", "5173"]

