FROM node:18-alpine

WORKDIR /frontend

# Copy dependencies definitions
COPY package*.json ./

# Install packages
RUN npm install

# Copy code files
COPY . .

EXPOSE 3000

# Run development server exposed to host network
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
