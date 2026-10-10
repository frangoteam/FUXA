'use strict';

const sinon = require('sinon');
const nodemailer = require('nodemailer');

const notificator = require('../../runtime/notificator');

let expect;

describe('Notificator - SMTP port', () => {
    let createTransport;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(() => {
        createTransport = sinon.stub(nodemailer, 'createTransport').returns({
            sendMail: sinon.stub().resolves({ messageId: 'test-message' })
        });
        sinon.stub(console, 'log');
    });

    afterEach(() => {
        sinon.restore();
    });

    function createManager() {
        return notificator.create({
            events: { on() {} },
            settings: {},
            logger: { info() {}, warn() {}, error() {} }
        });
    }

    function smtp(port) {
        return { host: 'smtp.example.com', port: port, username: 'user', password: 'secret' };
    }

    async function transportOptions(port) {
        await createManager().sendMail({ to: 'to@example.com' }, smtp(port));
        return createTransport.firstCall.args[0];
    }

    it('uses implicit TLS when port 465 is saved as text', async () => {
        const options = await transportOptions('465');
        expect(options.port).to.equal(465);
        expect(options.secure).to.equal(true);
    });

    it('uses implicit TLS when port 465 is a number', async () => {
        const options = await transportOptions(465);
        expect(options.port).to.equal(465);
        expect(options.secure).to.equal(true);
    });

    it('does not force TLS on port 587 saved as text', async () => {
        const options = await transportOptions('587');
        expect(options.port).to.equal(587);
        expect(options.secure).to.equal(false);
    });
});
