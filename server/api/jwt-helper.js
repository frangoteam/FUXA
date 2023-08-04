'use strict';

const jwt = require('jsonwebtoken');

var secureEnabled = false;
var secretCode = 'frangoteam751';
var tokenExpiresIn = 60 * 60;   // 60 minutes
const adminGroups = [-1, 255];


function init(_secureEnabled, _secretCode, _tokenExpires) {
    secureEnabled = _secureEnabled;
    if (_secretCode) {
        secretCode = _secretCode;
    }
    if (_tokenExpires) {
        tokenExpiresIn = _tokenExpires;
    }
}

/**
 * Verify token
 * @param {*} token 
 */
function verify (token) {
    return new Promise ((resolve, reject) => {
        jwt.verify(token, secretCode, (err, decoded) => {
            if (err) {
                console.error(`verify token error: ${err}`);
                reject(false);
            } else {
                resolve(true);
            }
        });    
    });
}

/**
 * Verify WebAPI token (take from header)
 * @param {*} req 
 * @param {*} res
 * @param {*} next
 */
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
        // if (secureEnabled) {
        //     res.status(401).json({ error: "unauthorized_error", message: "Token missing!" });
        // }
        next();
    }
}

function getNewToken(headers) {
    const authUser = (headers['x-auth-user']) ? JSON.parse(headers['x-auth-user']) : null;
    if (authUser) {
        return jwt.sign({
            id: authUser.user,
            groups: authUser.groups
        },
        secretCode, { 
            expiresIn: tokenExpiresIn 
        });
    }
    return null;
}

function getTokenExpiresIn() {
    return tokenExpiresIn;
}

module.exports = {
    init: init,
    verify: verify,
    verifyToken: verifyToken,
    getNewToken: getNewToken,
    get secretCode() { return secretCode },
    get tokenExpiresIn() { return tokenExpiresIn },
    adminGroups: adminGroups
};
