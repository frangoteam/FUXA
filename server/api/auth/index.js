/**
 * 'api/auth': Authentication API to Sign In/Out users
 */

var express = require('express');
const jwt = require('jsonwebtoken');
const authJwt = require('../jwt-helper');

var runtime;
var secretCode;
var tokenExpiresIn;
var enableRefreshCookieAuth = false;
var refreshTokenExpiresIn = '7d';
const refreshCookieName = 'fuxa_refresh';

function parseExpiresToMs(expiresIn) {
    if (expiresIn === undefined || expiresIn === null) {
        return null;
    }
    if (typeof expiresIn === 'number') {
        return expiresIn * 1000;
    }
    if (typeof expiresIn !== 'string') {
        return null;
    }
    const match = expiresIn.trim().match(/^(\d+)\s*([smhd])?$/i);
    if (!match) {
        return null;
    }
    const value = Number(match[1]);
    const unit = (match[2] || 's').toLowerCase();
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] || 1000);
}

function getCookieValue(req, name) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [key, ...rest] = cookie.trim().split('=');
        if (key === name) {
            return decodeURIComponent(rest.join('='));
        }
    }
    return null;
}

function buildAccessToken(user) {
    return jwt.sign({ id: user.username, groups: user.groups, roles: extractRoles(user.info) }, secretCode, { expiresIn: tokenExpiresIn });
}

function buildRefreshToken(user) {
    return jwt.sign({ id: user.username, groups: user.groups, roles: extractRoles(user.info), type: 'refresh' }, secretCode, { expiresIn: refreshTokenExpiresIn });
}

function extractRoles(info) {
    if (!info) {
        return [];
    }
    if (typeof info === 'string') {
        try {
            const parsed = JSON.parse(info);
            return Array.isArray(parsed.roles) ? parsed.roles : [];
        } catch (err) {
            return [];
        }
    }
    if (typeof info === 'object') {
        return Array.isArray(info.roles) ? info.roles : [];
    }
    return [];
}

function setRefreshCookie(res, token) {
    const maxAge = parseExpiresToMs(refreshTokenExpiresIn);
    const options = {
        httpOnly: true,
        sameSite: 'lax',
        secure: !!runtime?.settings?.https,
        path: '/api/refresh'
    };
    if (maxAge) {
        options.maxAge = maxAge;
    }
    res.cookie(refreshCookieName, token, options);
}

function clearRefreshCookie(res) {
    res.clearCookie(refreshCookieName, { path: '/api/refresh' });
}

module.exports = {
    init: function (_runtime, _secretCode, _tokenExpires, _enableRefreshCookieAuth, _refreshTokenExpires) {
        runtime = _runtime;
        secretCode = _secretCode;
        tokenExpiresIn = _tokenExpires;
        enableRefreshCookieAuth = !!_enableRefreshCookieAuth;
        if (_refreshTokenExpires) {
            refreshTokenExpiresIn = _refreshTokenExpires;
        }
    },
    app: function () {
        var authApp = express();
        authApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * POST SignIn
         * Sign In with User credentials
         */
        authApp.post('/api/signin', async function (req, res, next) {
            try {
                const userInfo = await runtime.auth.authenticate(req.body);
                const token = buildAccessToken(userInfo);
                if (enableRefreshCookieAuth) {
                    const refreshToken = buildRefreshToken(userInfo);
                    setRefreshCookie(res, refreshToken);
                }
                res.json({
                    status: 'success',
                    message: 'user found!!!',
                    data: {
                        username: userInfo.username,
                        fullname: userInfo.fullname,
                        groups: userInfo.groups,
                        info: userInfo.info,
                        token: token
                    }
                });
                runtime.logger.info('api-signin: ' + userInfo.username + ' ' + userInfo.fullname + ' ' + userInfo.groups);
            } catch (err) {
                if (err.status === 401) {
                    res.status(401).json({ status: 'error', message: 'Invalid email/password!!!', data: null });
                    runtime.logger.error('api post signin: Invalid email/password!!!');
                    return;
                }
                if (err.status === 404) {
                    res.status(404).end();
                    runtime.logger.error('api post signin: Not Found!');
                    return;
                }
                if (err.code) {
                    res.status(400).json({ error: err.code, message: err.message });
                } else {
                    res.status(400).json({ error: 'unexpected_error', message: err.toString() });
                }
                runtime.logger.error('api post signin: ' + err.message);
            }
        });

        /**
         * POST Refresh
         * Refresh access token using HttpOnly refresh cookie
         */
        authApp.post('/api/refresh', async function (req, res, next) {
            if (!runtime?.settings?.secureEnabled || !enableRefreshCookieAuth) {
                return res.status(204).end();
            }
            const refreshToken = getCookieValue(req, refreshCookieName);
            if (!refreshToken) {
                return res.status(401).json({ status: 'error', message: 'Refresh token missing' });
            }
            try {
                const decoded = jwt.verify(refreshToken, secretCode);
                if (decoded?.type !== 'refresh') {
                    clearRefreshCookie(res);
                    return res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
                }

                let userData = null;
                try {
                    userData = await runtime.auth.refreshIdentity({ username: decoded.id, groups: decoded.groups, roles: decoded.roles });
                } catch (err) {
                    runtime.logger.error(`api refresh: user lookup failed ${err}`);
                }

                const user = {
                    username: decoded.id,
                    fullname: userData?.fullname,
                    groups: userData?.groups ?? decoded.groups,
                    info: userData?.info || JSON.stringify({ roles: Array.isArray(decoded.roles) ? decoded.roles : [] })
                };

                const newAccessToken = buildAccessToken(user);
                const newRefreshToken = buildRefreshToken(user);
                setRefreshCookie(res, newRefreshToken);

                res.json({
                    status: 'success',
                    message: 'token refreshed',
                    data: {
                        username: user.username,
                        fullname: user.fullname,
                        groups: user.groups,
                        info: user.info,
                        token: newAccessToken
                    }
                });
            } catch (err) {
                clearRefreshCookie(res);
                res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
            }
        });

        /**
         * POST SignOut
         * Clear refresh cookie
         */
        authApp.post('/api/signout', function (req, res, next) {
            if (enableRefreshCookieAuth) {
                clearRefreshCookie(res);
            }
            res.status(204).end();
        });

        return authApp;
    }
}
