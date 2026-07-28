FROM node:20-alpine

WORKDIR /workspace

ARG NODE_ENV=development
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GA_MEASUREMENT_ID
ENV NODE_ENV=$NODE_ENV
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID

# Debug: Print environment variables (key prefix only, never full value)
RUN echo "Building with VITE_GOOGLE_MAPS_API_KEY: ${VITE_GOOGLE_MAPS_API_KEY:0:10}..."

# Copy backend assets first (needed for frontend build)
COPY backend/attached_assets ./backend/attached_assets

# Setup frontend
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm install --include=dev --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5

COPY frontend/. .

# Build only in production mode
RUN if [ "$NODE_ENV" = "production" ]; then npm run build; fi

EXPOSE 5173

# Dev: npm install first — compose mounts an anonymous volume over node_modules, so new
# deps from the host package.json are not present until install runs in the container.
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then npm run preview -- --host 0.0.0.0 --port 5173; else npm install && npm run dev -- --host 0.0.0.0 --port 5173; fi"]
