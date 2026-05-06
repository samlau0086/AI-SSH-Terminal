FROM node:20-alpine

# Install SQLite and python3 for node-gyp if needed (some dependencies might need it)
RUN apk add --no-cache python3 py3-setuptools make g++ sqlite

WORKDIR /app

# Copy package info and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Expose the default port
EXPOSE 3000

# Set production environment variables
ENV NODE_ENV=production
ENV APP_PORT=3000
ENV DB_PATH=/app/data/database.sqlite

# Create data directory for volume mapping
RUN mkdir -p /app/data

# Start the application
CMD ["npm", "start"]
