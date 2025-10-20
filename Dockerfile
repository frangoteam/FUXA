FROM node:18-bookworm

ARG NODE_SNAP=false

RUN apt-get update && apt-get install -y dos2unix

# Change working directory
WORKDIR /usr/src/app

# Clone FUXA repository
RUN git clone https://github.com/frangoteam/FUXA.git

# Install build dependencies for node-odbc
RUN apt-get update && apt-get install -y build-essential unixodbc unixodbc-dev

# Convert the script to Unix format and make it executable
RUN dos2unix FUXA/odbc/install_odbc_drivers.sh && chmod +x FUXA/odbc/install_odbc_drivers.sh

WORKDIR /usr/src/app/FUXA/odbc
RUN ./install_odbc_drivers.sh

# Change working directory
WORKDIR /usr/src/app

# Copy odbcinst.ini to /etc
RUN cp FUXA/odbc/odbcinst.ini /etc/odbcinst.ini

# Install Fuxa server
WORKDIR /usr/src/app/FUXA/server

# More tolerant npm config
ENV NODE_OPTIONS=--dns-result-order=ipv4first
RUN npm config set registry https://registry.npmjs.org/ \
 && npm config set fetch-retries 8 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 30000 \
 && npm config set fetch-retry-maxtimeout 300000 \
 && npm config set audit false \
 && npm config set fund false

# Retry loop con backoff + timeout alto
RUN bash -lc '\
  for i in 1 2 3 4 5 6 7 8; do \
    echo "npm install - attempt $i/8"; \
    npm install --no-audit --no-fund --prefer-offline --network-timeout=600000 && exit 0; \
    echo "Failed, wait $((10*i))s and try again..."; \
    sleep $((10*i)); \
  done; \
  echo "npm install failed after 8 attempts"; \
  exit 1'


# Install options snap7
RUN if [ "$NODE_SNAP" = "true" ]; then \
    npm install node-snap7; \
    fi

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
