FROM node:20-alpine

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
