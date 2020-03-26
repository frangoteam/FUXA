'use strict';

const jwt = require('jsonwebtoken');

var secretCode = 'frangoteam751';
var tokenExpiresIn = 60 * 15;   // 15 minutes
const adminGroups = [-1, 255];


function init(_secretCode, _tokenExpires) {
    if (_secretCode) {
        secretCode = _secretCode;
    }
    if (_tokenExpires) {
        tokenExpiresIn = _tokenExpires;
    }
}

function verifyToken (req, res, next) {
    let token = req.headers['x-access-token'];

    if (token) {
        jwt.verify(token, secretCode, (err, decoded) => {
            if (err) {
                req.userId = null;
                req.userGroups = null;
                if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
                    req.tokenExpired = true;
                    res.status(403).json({error:"unauthorized_error", message: "Token Expired!"});
                }
                next();
                // return res.status(500).send({
                //     auth: false,
                //     message: 'Fail to Authentication. Error -> ' + err
                // });
            } else {
                req.userId = decoded.id;
                req.userGroups = decoded.groups;
                if (req.headers['x-auth-user']) {
                    let user = JSON.parse(req.headers['x-auth-user']);
                    if (user && user.groups != req.userGroups) {
                        res.status(403).json({ error: "unauthorized_error", message: "User Profile Corrupted!" });
                    }
                }
                next();
            }
        });
    } else {
        // notice that no token was provided...}
        req.userId = null;
        req.userGroups = null;
        next();
    }
}

function getTokenExpiresIn() {
    return tokenExpiresIn;
}

module.exports = {
    init: init,
    verifyToken: verifyToken,
    get secretCode() { return secretCode },
    get tokenExpiresIn() { return tokenExpiresIn },
    adminGroups: adminGroups
};
