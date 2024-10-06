# Step 1: Use Node.js image based on Alpine
FROM node:20-alpine

# Step 2: Set the working directory in the container
WORKDIR /usr/src/app

# Step 3: Copy package.json and package-lock.json to the working directory
COPY app*.js ./

# Step 5: Copy the rest of your app's source code to the working directory
COPY . .

# Step 6: Expose the application port (if needed)
EXPOSE 8002

# Step 7: Define the command to run your app
CMD ["node", "app.js"]