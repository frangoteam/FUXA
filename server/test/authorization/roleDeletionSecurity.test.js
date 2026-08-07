'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const users = require('../../runtime/users');
const usrstorage = require('../../runtime/users/usrstorage');

function makeLogger() {
    return {
        info: () => {},
        warn: () => {},
        error: () => {}
    };
}

describe('Security - role deletion cleanup', () => {
    let expect;
    let workDir;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(async () => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-role-delete-'));
        await users.init({ workDir }, makeLogger());
    });

    afterEach(() => {
        usrstorage.close();
        fs.rmSync(workDir, { recursive: true, force: true });
    });

    it('removes deleted role assignments from persisted users and runtime cache', async () => {
        await users.setRoles([
            { id: 'role-delete', name: 'Delete me' },
            { id: 'role-keep', name: 'Keep me' }
        ]);
        await users.setUsers({
            username: 'alice',
            fullname: 'Alice',
            groups: 1,
            info: JSON.stringify({
                roles: ['role-delete', 'role-keep'],
                start: 'view-1'
            })
        });

        await users.removeRoles([{ id: 'role-delete', name: 'Delete me' }]);

        const storedUsers = await users.getUsers({ username: 'alice' });
        const storedInfo = JSON.parse(storedUsers[0].info);
        expect(storedInfo).to.deep.equal({
            roles: ['role-keep'],
            start: 'view-1'
        });
        expect(users.getUserCache('alice')).to.deep.equal({
            groups: 1,
            info: {
                roles: ['role-keep'],
                start: 'view-1'
            }
        });

        const storedRoles = await users.getRoles();
        expect(storedRoles.map(role => role.id)).to.deep.equal(['role-keep']);
    });

    it('does not rewrite users without deleted role assignments', async () => {
        await users.setRoles([{ id: 'role-delete', name: 'Delete me' }]);
        await users.setUsers({
            username: 'bob',
            fullname: 'Bob',
            groups: 2,
            info: JSON.stringify({ roles: ['role-other'] })
        });

        await users.removeRoles([{ id: 'role-delete', name: 'Delete me' }]);

        const storedUsers = await users.getUsers({ username: 'bob' });
        expect(JSON.parse(storedUsers[0].info).roles).to.deep.equal(['role-other']);
        expect(users.getUserCache('bob').info.roles).to.deep.equal(['role-other']);
    });

    it('cleans the runtime cache when persisted user info is invalid', async () => {
        await users.setRoles([{ id: 'role-delete', name: 'Delete me' }]);
        await users.setUsers({
            username: 'alice',
            fullname: 'Alice',
            groups: 1,
            info: JSON.stringify({ roles: ['role-delete'] })
        });
        await usrstorage.setUser('alice', 'Alice', null, 1, '{invalid');

        await users.removeRoles([{ id: 'role-delete', name: 'Delete me' }]);

        const storedUsers = await users.getUsers({ username: 'alice' });
        expect(storedUsers[0].info).to.equal('{invalid');
        expect(users.getUserCache('alice').info.roles).to.deep.equal([]);
        expect(await users.getRoles()).to.deep.equal([]);
    });
});
