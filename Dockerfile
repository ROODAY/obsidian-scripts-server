FROM node:18

WORKDIR /usr/src/app

# Install exact dependency versions from the lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the entire src directory
COPY ./src ./src

ENV NODE_ENV=production

# Expose the application port
EXPOSE 3000

# Run the server
CMD ["node", "./src/server.js"]
