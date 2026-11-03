'use strict';

const sinon = require('sinon');
const nodemailer = require('nodemailer');

const notificator = require('../../runtime/notificator');

let expect;

describe('Notificator - SMTP authentication', () => {
    let createTransport;
    let sendMail;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(() => {
        sendMail = sinon.stub().resolves({ messageId: 'test-message' });
        createTransport = sinon.stub(nodemailer, 'createTransport').returns({ sendMail: sendMail });
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

    function smtp(overrides) {
        return Object.assign({ host: 'smtp.example.com', port: '25', mailsender: 'fuxa@example.com' }, overrides);
    }

    async function rejection(server) {
        return createManager().sendMail({ to: 'to@example.com' }, server).then(() => null, err => err);
    }

    it('sends without auth when the relay authenticates by IP address', async () => {
        await createManager().sendMail({ to: 'to@example.com' }, smtp({ username: '', password: '' }));
        const options = createTransport.firstCall.args[0];
        expect(options.host).to.equal('smtp.example.com');
        expect(options.port).to.equal(25);
        expect(options).to.not.have.property('auth');
        expect(sendMail.firstCall.args[0].from).to.equal('fuxa@example.com');
    });

    it('authenticates when username and password are set', async () => {
        await createManager().sendMail({ to: 'to@example.com' }, smtp({ username: 'user', password: 'secret' }));
        const options = createTransport.firstCall.args[0];
        expect(options.auth).to.deep.equal({ user: 'user', pass: 'secret' });
    });

    it('still rejects when host or port is missing', async () => {
        expect(await rejection(smtp({ host: '' }))).to.equal('SMTP data error!');
        expect(await rejection(smtp({ port: '' }))).to.equal('SMTP data error!');
        expect(createTransport.called).to.equal(false);
    });
});
