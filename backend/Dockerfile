FROM node:20-alpine

WORKDIR /workspace/backend

# Install curl (required for ECS health check)
RUN apk add --no-cache curl

COPY backend/package*.json ./

# Install all dependencies (including devDependencies for development)
RUN npm install

COPY backend/. .

# Entrypoint lives outside /workspace so volume mount (.:/workspace) doesn't overwrite it
COPY backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN apk add --no-cache dos2unix && dos2unix /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 5000

# Container-level health check (Docker / local)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Set entrypoint to run migrations before starting the app
ENTRYPOINT ["/docker-entrypoint.sh"]

# Use dev mode with tsx for hot-reload in development
CMD ["npm", "run", "dev"]
