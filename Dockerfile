FROM node:14

RUN mkdir -p /usr/src/app/FUXA/server

ADD server/package.json /usr/src/app/FUXA/server

WORKDIR /usr/src/app/FUXA/server

RUN npm install

ADD . /usr/src/app/FUXA

WORKDIR /usr/src/app/FUXA/server

EXPOSE 1881

CMD [ "npm", "start" ]