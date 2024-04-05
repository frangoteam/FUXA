FROM node:14

# Copy odbcinst.ini file and installation script
COPY odbc/odbcinst.ini /etc/odbcinst.ini
COPY odbc/install_odbc_drivers.sh /usr/src/app/

# Change working directory
WORKDIR /usr/src/app

# Make installation script executable and run it
RUN chmod +x install_odbc_drivers.sh && \
    ./install_odbc_drivers.sh

# Clone FUXA repository
RUN git clone https://github.com/frangoteam/FUXA.git

# Change working directory to FUXA
WORKDIR /usr/src/app/FUXA

# Install server
WORKDIR /usr/src/app/FUXA/server
RUN npm install

# Workaround for sqlite3 https://stackoverflow.com/questions/71894884/sqlite3-err-dlopen-failed-version-glibc-2-29-not-found
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
