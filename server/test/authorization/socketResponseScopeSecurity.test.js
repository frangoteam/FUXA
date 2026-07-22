'use strict';

const fs = require('fs');
const path = require('path');

describe('Security - Socket.IO admin response scoping', () => {
    let expect;
    let source;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
        source = fs.readFileSync(path.join(__dirname, '..', '..', 'runtime', 'index.js'), 'utf8');
    });

    function getHandlerSource(eventName) {
        const start = source.indexOf(`socket.on(Events.IoEventTypes.${eventName}`);
        expect(start).to.be.greaterThan(-1);

        const nextHandler = source.indexOf('socket.on(Events.IoEventTypes.', start + 1);
        return source.slice(start, nextHandler === -1 ? source.length : nextHandler);
    }

    [
        'DEVICE_BROWSE',
        'DEVICE_NODE_ATTRIBUTE',
        'HOST_INTERFACES',
        'DEVICE_TAGS_REQUEST'
    ].forEach(eventName => {
        it(`scopes ${eventName} responses to the requesting socket`, () => {
            const handler = getHandlerSource(eventName);

            expect(handler).to.contain('isSocketAdminAuthorized(socket)');
            expect(handler).to.not.contain(`io.emit(Events.IoEventTypes.${eventName}`);
            expect(handler).to.contain(`socket.emit(Events.IoEventTypes.${eventName}`);
        });
    });
});
