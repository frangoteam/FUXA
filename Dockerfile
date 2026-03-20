# --- STAGE 1: Angular Client Builder ---
FROM node:18-bookworm AS client-builder
WORKDIR /usr/src/app/client
COPY client/package*.json ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build -- --configuration production

# --- STAGE 2: Server & Native Dependencies Builder ---
FROM node:18-bookworm AS server-builder
# Define build arguments with defaults
ARG NODE_SNAP=false
ARG INSTALL_ODBC=true

WORKDIR /usr/src/app/FUXA

# Base build tools
RUN apt-get update && apt-get install -y \
    python3 build-essential libsqlite3-dev dos2unix \
    $( [ "$INSTALL_ODBC" = "true" ] && echo "unixodbc-dev" ) \
    && rm -rf /var/lib/apt/lists/*

# Install Server dependencies
COPY server/package*.json ./server/
WORKDIR /usr/src/app/FUXA/server
RUN npm install --no-audit --no-fund
RUN npm prune --production

# Optional Snap7 installation
RUN if [ "$NODE_SNAP" = "true" ]; then npm install node-snap7; fi

# Force rebuild of SQLite for the container
RUN npm install --build-from-source --sqlite=/usr/bin sqlite3

# Optional ODBC driver preparation
WORKDIR /usr/src/app/FUXA/odbc
COPY odbc/ ./
RUN if [ "$INSTALL_ODBC" = "true" ]; then \
    dos2unix install_odbc_drivers.sh && chmod +x install_odbc_drivers.sh && ./install_odbc_drivers.sh; \
    fi

# 3. Copy server source, build, then cleanup
WORKDIR /usr/src/app/FUXA/server
COPY server/ ./
RUN rm -rf test
RUN npm run build

# --- STAGE 3: Runner ---
FROM node:18-bookworm-slim
ARG INSTALL_ODBC=true
WORKDIR /usr/src/app/FUXA

# Install ONLY runtime libraries
RUN apt-get update && apt-get install -y \
    sqlite3 libsqlite3-0 \
    $( [ "$INSTALL_ODBC" = "true" ] && echo "unixodbc" ) \
    && rm -rf /var/lib/apt/lists/*

# 1. Copy Server
COPY --from=server-builder /usr/src/app/FUXA/server ./server

# 2. Copy Client
COPY --from=client-builder /usr/src/app/client/dist ./client/dist

# 3. Conditional ODBC Config
COPY --from=server-builder /usr/src/app/FUXA/odbc ./odbc
RUN if [ "$INSTALL_ODBC" = "true" ]; then cp odbc/odbcinst.ini /etc/odbcinst.ini; fi

# 4. Copy static app files
COPY node-red/ ./node-red/

# Final cleanup
WORKDIR /usr/src/app/FUXA/server

ENV NODE_ENV=production
EXPOSE 1881
CMD [ "node", "main.js" ]
