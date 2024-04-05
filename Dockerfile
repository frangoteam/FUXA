FROM node:18

# Copy odbcinst.ini file and installation script
COPY odbc/odbcinst.ini /etc/odbcinst.ini
COPY odbc/install_odbc_drivers.sh /usr/src/app/

# Change working directory
WORKDIR /usr/src/app

# Make installation script executable and run it
RUN chmod +x install_odbc_drivers.sh && \
    ./install_odbc_drivers.sh

# Install build dependencies for node-odbc
RUN apt-get update && apt-get install -y build-essential unixodbc unixodbc-dev

# Clone node-odbc repository
RUN git clone https://github.com/markdirish/node-odbc.git

# Change working directory to node-odbc
WORKDIR /usr/src/app/node-odbc

# Remove the package-lock.json file for new install
RUN rm package-lock.json

# Build and install node-odbc
RUN npm install

# Change working directory
WORKDIR /usr/src/app

# Clone FUXA repository
RUN git clone -b odbc https://github.com/frangoteam/FUXA.git

# Change working directory to FUXA
WORKDIR /usr/src/app/FUXA

# Install server
WORKDIR /usr/src/app/FUXA/server

# Workaround for sqlite3
RUN apt-get update && apt-get install -y sqlite3 libsqlite3-dev && \
    apt-get autoremove -yqq --purge && \
    apt-get clean  && \
    rm -rf /var/lib/apt/lists/*  && \
    npm install --build-from-source --sqlite=/usr/bin sqlite3

# Add project files
ADD . /usr/src/app/FUXA

# Set working directory
WORKDIR /usr/src/app/FUXA/server

# Expose port
EXPOSE 1881

# Start the server
CMD [ "npm", "start" ]
