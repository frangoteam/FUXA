'use strict';

const bcrypt = require('bcryptjs');
const auth = require('../../runtime/auth');

let expect;

describe('Security - AD role names map to FUXA role ids', () => {
    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    it('maps role label to role id in userRole mode', async () => {
        const runtime = {
            users: {
                async findOne(query) {
                    return [{
                        username: query.username,
                        fullname: 'Operator User',
                        password: bcrypt.hashSync('secret', 10),
                        groups: 2,
                        info: JSON.stringify({ roles: ['operator'] })
                    }];
                },
                async getRoles() {
                    return [
                        { id: 'r-admin', name: 'admin' },
                        { id: 'r-operator', name: 'operator' }
                    ];
                }
            }
        };
        const settings = {
            userRole: true,
            auth: {
                provider: 'local'
            }
        };

        await auth.init(runtime, settings, { warn: () => {}, error: () => {} });
        const identity = await auth.authenticateByProvider('local', { username: 'op', password: 'secret' }, { allowFallback: false });
        const info = JSON.parse(identity.info);

        expect(identity.roles).to.deep.equal(['r-operator']);
        expect(info.roles).to.deep.equal(['r-operator']);
    });
});
