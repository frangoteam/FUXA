'use strict';

const authJwt = require('../jwt-helper');

/**
 * Middleware that accepts either JWT (x-access-token) or API key (x-api-key).
 * It is active only when security is enabled.
 */
module.exports = function verifyApiOrToken(runtime) {
    return async function (req, res, next) {
        if (!runtime?.settings?.secureEnabled) {
            return next();
        }

        const apiKey = req.headers['x-api-key'];
        if (apiKey) {
            try {
                const stored = await runtime.apiKeys.getApiKeys();
                const now = Date.now();
                const validKey = stored.find(k => {
                    if (!k || k.key !== apiKey || k.enabled === false) {
                        return false;
                    }
                    if (!k.expires) {
                        return true;
                    }
                    const expiresAt = new Date(k.expires).getTime();
                    return !isNaN(expiresAt) && expiresAt > now;
                });

                if (validKey) {
                    req.apiKey = validKey;
                    // Grant admin group to match existing authorization checks.
                    req.userId = validKey.id || `apikey:${apiKey}`;
                    req.userGroups = authJwt.adminGroups[0];
                    return next();
                }
            } catch (err) {
                runtime.logger.error(`api-key validation failed: ${err}`);
                return res.status(500).json({ error: 'unexpected_error', message: 'ApiKey validation failed' });
            }
            return res.status(401).json({ error: 'unauthorized_error', message: 'Invalid API Key' });
        }

        return authJwt.verifyToken(req, res, next);
    };
};
