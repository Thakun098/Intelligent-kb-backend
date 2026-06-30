FROM node:20-alpine

# Install system ffmpeg fallback
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package dependencies configurations
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts

# Copy source code and config folders
COPY src/ ./src
COPY server.js .

EXPOSE 3001

CMD ["node", "server.js"]
