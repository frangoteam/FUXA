FROM node:17

# Create app directory 
WORKDIR /usr/src/app
#RUN git clone https://github.com/frangoteam/FUXA.git
#RUN git clone https://github.com/superkalt/FUXA.git

# copy from local
WORKDIR /usr/src/app
COPY client /usr/src/app/FUXA/client
COPY server /usr/src/app/FUXA/server

# Install server
WORKDIR /usr/src/app/FUXA/server
RUN npm install

# persistent storage of application data
volume /usr/src/app/FUXA/server/_appdata
volume /usr/src/app/FUXA/server/_db 
#volume /usr/src/app/FUXA/server/_logs
#volume /usr/src/app/FUXA/server/_images
#volume /usr/src/app/FUXA/client/dist/assets/lib/svgeditor/_shapes

EXPOSE 1881
CMD [ "npm", "start" ]