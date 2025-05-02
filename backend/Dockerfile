FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose the port the app runs on
EXPOSE 9001

# Start the application
CMD ["node", "index.js"]
