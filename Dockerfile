# --- STAGE 1: The Builder ---
FROM node:18-bookworm AS builder

ARG NODE_SNAP=false
WORKDIR /usr/src/app/FUXA

# Install ONLY what is needed to compile
RUN apt-get update && apt-get install -y \
    dos2unix build-essential unixodbc-dev sqlite3 libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only dependency files first to leverage caching
COPY server/package*.json ./server/
WORKDIR /usr/src/app/FUXA/server

# Optimized NPM for speed
RUN npm config set audit false && npm config set fund false
RUN npm install --no-audit --no-fund --network-timeout=600000

# Install snap7 if requested
RUN if [ "$NODE_SNAP" = "true" ]; then npm install node-snap7; fi

# Rebuild sqlite3 for the container architecture
RUN npm install --build-from-source --sqlite=/usr/bin sqlite3

# Now copy the rest of the source code
WORKDIR /usr/src/app/FUXA
COPY . .

# Run the driver scripts (only needed for the setup files they generate)
RUN dos2unix odbc/install_odbc_drivers.sh && \
    chmod +x odbc/install_odbc_drivers.sh

# --- STAGE 2: The Runner (Final Image) ---
FROM node:18-bookworm-slim

WORKDIR /usr/src/app/FUXA

# Install ONLY the runtime libraries (no compilers/build-essential)
RUN apt-get update && apt-get install -y \
    unixodbc sqlite3 libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy ONLY the necessary artifacts from the builder
COPY --from=builder /usr/src/app/FUXA/server ./server
COPY --from=builder /usr/src/app/FUXA/app ./app
COPY --from=builder /usr/src/app/FUXA/client ./client
COPY --from=builder /usr/src/app/FUXA/node-red ./node-red
COPY --from=builder /usr/src/app/FUXA/odbc ./odbc
COPY --from=builder /usr/src/app/FUXA/odbc/odbcinst.ini /etc/odbcinst.ini

# Set environment and expose
WORKDIR /usr/src/app/FUXA/server
ENV NODE_ENV=production
EXPOSE 1881

CMD [ "npm", "start" ]
