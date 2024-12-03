FROM node:18

WORKDIR /usr/src/app

# Copy package files for efficient caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend files
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the application with nodemon for development
CMD ["npm", "run", "dev"]