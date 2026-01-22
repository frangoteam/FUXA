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

    if (!token) {
        token = getGuestToken();
    }

    if (token) {
        jwt.verify(token, secretCode, (err, decoded) => {
            if (err) {
                req.userId = "guest";
                req.userGroups = ["guest"];
                req.isAuthenticated = false;
                return next();
            }
            req.userId = decoded.id;
            req.userGroups = decoded.groups;
            req.isAuthenticated = true;
            return next();
        });
    } else {
        // notice that no token was provided...}
        req.userId = null;
        req.userGroups = null;
        return next();
    }
}

function requireAuth (req, res, next) {
    // Allow requests from FUXA interface (iframe embedding)
    // Check for common FUXA referer patterns
    const referer = req.headers.referer;
    if (referer) {
        // Allow if referer is from the same host (to support IP access without specific paths)
        const requestHost = req.headers.host;
        if (referer.startsWith(`http://${requestHost}`) || referer.startsWith(`https://${requestHost}`)) {
            return next();
        }
        // Allow if referer contains common FUXA paths or is from the same server
        const fuxaPatterns = [
            '/fuxa', '/editor', '/viewer', '/lab', '/home',
            'localhost:', '127.0.0.1:', '0.0.0.0:'
        ];
        const hasFuxaReferer = fuxaPatterns.some(pattern => referer.includes(pattern));
        if (hasFuxaReferer) {
            return next();
        }
    }

    // For direct access, require authentication
    let token = req.headers['x-access-token'];

    if (!token) {
        return res.status(401).json({ error: "unauthorized_error", message: "Authentication required!" });
    }

    jwt.verify(token, secretCode, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "unauthorized_error", message: "Invalid token!" });
        } else {
            req.userId = decoded.id;
            req.userGroups = decoded.groups;
            next();
        }
    });
}

function getNewTokenFromRequest(req) {
    if (!req.isAuthenticated) {
        return null;
    }

    return jwt.sign({
        id: req.userId,
        groups: req.userGroups
    }, secretCode, {
        expiresIn: tokenExpiresIn
    });
}

function getGuestToken() {
    const token = jwt.sign({
            id: "guest",
            groups: ["guest"]
        },
        secretCode, {
            expiresIn: tokenExpiresIn
        });
    return token;
}

function haveAdminPermission(permission) {
    if (permission === null || permission === undefined) {
        return false;
    }
    if (adminGroups.indexOf(permission) !== -1) {
        return true;
    }
    return false;
}

function getTokenExpiresIn() {
    return tokenExpiresIn;
}

module.exports = {
    init: init,
    verify: verify,
    verifyToken: verifyToken,
    requireAuth: requireAuth,
    getNewTokenFromRequest: getNewTokenFromRequest,
    getGuestToken: getGuestToken,
    get secretCode() { return secretCode },
    get tokenExpiresIn() { return tokenExpiresIn },
    haveAdminPermission: haveAdminPermission,
    adminGroups: adminGroups
};
