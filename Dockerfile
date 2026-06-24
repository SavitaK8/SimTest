# Use an official Node runtime as a parent image
FROM node:20-bullseye

# Set the working directory
WORKDIR /app

# Copy the core package files
COPY simtest-core/package*.json ./simtest-core/

# Install dependencies
RUN cd simtest-core && npm install

# Install Playwright browsers and OS dependencies
RUN cd simtest-core && npx playwright install --with-deps chromium

# Copy all source
COPY . .

# Setup environment variables
ENV NODE_ENV=production
ENV HEADLESS=true

# Command to run SimTest headlessly
WORKDIR /app/simtest-core
CMD ["node", "src/index.js"]
