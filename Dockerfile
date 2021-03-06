############################################################
# Dockerfile to build a node.js development
# Based on Ubuntu
############################################################

# Set the base image to Ubuntu
FROM node

# File Author / Maintainer
LABEL "com.example.vendor"="zameschua"
LABEL version="0.0.1"
LABEL maintainer="zames.chua@gmail.com"


# Since it is just dev we create this with std user
RUN mkdir -p /opt/app

# Start with a WORKDIR
WORKDIR /opt/app

# First take the package.json and install all the modules
COPY package.json .
RUN npm install --quiet

# Install nodemon global - will restart server on changes
RUN npm install nodemon -g --quiet

# Copy the app
COPY . .

# expose port 80
EXPOSE 80

# Start the application when starting the container
CMD nodemon -L --watch . app.js