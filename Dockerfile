FROM node:14

# Create app directory
WORKDIR /usr/src/app

RUN git clone https://github.com/frangoteam/FUXA.git
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

ADD . /usr/src/app/FUXA

WORKDIR /usr/src/app/FUXA/server
EXPOSE 1881
CMD [ "npm", "start" ]
