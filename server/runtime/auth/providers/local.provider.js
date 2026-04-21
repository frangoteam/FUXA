'use strict';

const bcrypt = require('bcryptjs');

function create(context) {
    const runtime = context.runtime;

    async function authenticate(credentials) {
        const username = credentials && credentials.username;
        const password = credentials && credentials.password;
        const userInfo = await runtime.users.findOne({ username });
        if (!userInfo || !userInfo.length || !userInfo[0].password) {
            throw createAuthError(404, 'Not Found!');
        }
        if (!bcrypt.compareSync(password, userInfo[0].password)) {
            throw createAuthError(401, 'Invalid email/password!!!');
        }
        return {
            username: userInfo[0].username,
            fullname: userInfo[0].fullname,
            groups: userInfo[0].groups,
            info: userInfo[0].info
        };
    }

    async function refreshIdentity(context) {
        const username = context && context.username;
        if (!username) {
            return null;
        }
        const users = await runtime.users.getUsers({ username: username });
        if (users && users.length) {
            return {
                username: users[0].username,
                fullname: users[0].fullname,
                groups: users[0].groups,
                info: users[0].info
            };
        }
        return null;
    }

    return {
        authenticate: authenticate,
        refreshIdentity: refreshIdentity
    };
}

function createAuthError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

module.exports = {
    create: create
};
