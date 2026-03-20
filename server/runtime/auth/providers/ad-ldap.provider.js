'use strict';

function create(context) {
    const settings = context.settings;

    async function authenticate(credentials) {
        const username = credentials && credentials.username ? String(credentials.username).trim() : '';
        const password = credentials && credentials.password ? String(credentials.password) : '';
        if (!username || !password) {
            throw createAuthError(401, 'Invalid email/password!!!');
        }

        const ad = getAdConfig(settings);
        if (!ad || ad.enabled === false) {
            throw createProviderError('ad_disabled', 'AD provider is disabled');
        }

        const LdapClient = getLdapClientClass();
        const client = new LdapClient(buildClientOptions(ad));

        try {
            if (ad.bindDN && ad.bindPassword) {
                await bindAsync(client, ad.bindDN, ad.bindPassword, true);
            }

            const filter = buildUserFilter(ad, username);
            const user = await findSingleUser(client, ad.baseDN, filter, ad.userAttributes);
            if (!user) {
                throw createAuthError(404, 'Not Found!');
            }

            const userDN = user.dn || user.distinguishedName;
            if (!userDN) {
                throw createProviderError('ad_user_dn_missing', 'User DN missing from LDAP response');
            }

            // Verify password by binding with user DN.
            await bindAsync(client, userDN, password, false);

            const groupAttribute = ad.groupAttribute || 'memberOf';
            const rawGroups = normalizeStringArray(user[groupAttribute] || user.memberOf || []);
            const usernameResolved = user.sAMAccountName || user.userPrincipalName || username;
            const fullnameResolved = user.displayName || user.cn || user.name || usernameResolved;
            const roles = resolveRolesFromGroups(ad, rawGroups);
            const groups = resolveLegacyMaskFromGroups(ad, rawGroups);

            return {
                username: usernameResolved,
                fullname: fullnameResolved,
                groups: groups,
                roles: roles,
                info: {
                    roles: roles,
                    source: 'ad',
                    ad: {
                        dn: userDN,
                        userPrincipalName: user.userPrincipalName,
                        mail: user.mail,
                        groups: rawGroups
                    }
                }
            };
        } finally {
            await unbindSafe(client);
        }
    }

    async function refreshIdentity(context) {
        const username = context && context.username ? String(context.username).trim() : '';
        if (!username) {
            return null;
        }
        const ad = getAdConfig(settings);
        if (!ad || ad.enabled === false || ad.refreshIdentity !== true) {
            return null;
        }

        const LdapClient = getLdapClientClass();
        const client = new LdapClient(buildClientOptions(ad));

        try {
            if (!(ad.bindDN && ad.bindPassword)) {
                return null;
            }
            await bindAsync(client, ad.bindDN, ad.bindPassword, true);
            const filter = buildUserFilter(ad, username);
            const user = await findSingleUser(client, ad.baseDN, filter, ad.userAttributes);
            if (!user) {
                return null;
            }
            const groupAttribute = ad.groupAttribute || 'memberOf';
            const rawGroups = normalizeStringArray(user[groupAttribute] || user.memberOf || []);
            const roles = resolveRolesFromGroups(ad, rawGroups);
            const groups = resolveLegacyMaskFromGroups(ad, rawGroups);
            return {
                username: user.sAMAccountName || user.userPrincipalName || username,
                fullname: user.displayName || user.cn || user.name || username,
                groups: groups,
                roles: roles,
                info: {
                    roles: roles,
                    source: 'ad',
                    ad: {
                        dn: user.dn || user.distinguishedName,
                        userPrincipalName: user.userPrincipalName,
                        mail: user.mail,
                        groups: rawGroups
                    }
                }
            };
        } finally {
            await unbindSafe(client);
        }
    }

    return {
        authenticate: authenticate,
        refreshIdentity: refreshIdentity
    };
}

function getAdConfig(settings) {
    if (!settings || !settings.auth) {
        return null;
    }
    return settings.auth.ad || null;
}

function getLdapClientClass() {
    try {
        const ldapts = require('ldapts');
        return ldapts.Client;
    } catch (err) {
        throw createProviderError('ad_ldapts_missing', 'Missing dependency ldapts. Run npm install in server folder.');
    }
}

function buildClientOptions(ad) {
    const options = {
        url: ad.url,
        timeout: ad.timeoutMs || 5000,
        connectTimeout: ad.connectTimeoutMs || 5000
    };
    // Apply TLS options only for ldaps:// URLs.
    if (typeof ad.url === 'string' && ad.url.toLowerCase().startsWith('ldaps://')) {
        options.tlsOptions = {
            rejectUnauthorized: ad.rejectUnauthorized !== false
        };
    }
    return options;
}

function buildUserFilter(ad, username) {
    const tpl = ad.userFilter || '(&(objectClass=user)(|(sAMAccountName={{username}})(userPrincipalName={{username}})))';
    const escaped = escapeFilterValue(username);
    return tpl.replace(/\{\{\s*username\s*\}\}/g, escaped);
}

async function findSingleUser(client, baseDN, filter, userAttributes) {
    try {
        const result = await client.search(baseDN, {
            scope: 'sub',
            filter: filter,
            sizeLimit: 2,
            attributes: Array.isArray(userAttributes) && userAttributes.length
                ? userAttributes
                : ['dn', 'cn', 'displayName', 'memberOf', 'mail', 'userPrincipalName', 'sAMAccountName']
        });
        const entries = result && Array.isArray(result.searchEntries) ? result.searchEntries : [];
        return entries[0] || null;
    } catch (err) {
        throw createProviderError('ad_search_failed', err.message || String(err));
    }
}

async function bindAsync(client, dn, password, isServiceBind) {
    try {
        await client.bind(dn, password);
    } catch (err) {
        const code = extractLdapCode(err);
        if (!isServiceBind && code === 49) {
            throw createAuthError(401, 'Invalid email/password!!!');
        }
        if (!isServiceBind && /invalid credentials/i.test(err.message || '')) {
            throw createAuthError(401, 'Invalid email/password!!!');
        }
        throw createProviderError('ad_bind_failed', err.message || String(err));
    }
}

async function unbindSafe(client) {
    if (!client || typeof client.unbind !== 'function') {
        return;
    }
    try {
        await client.unbind();
    } catch (err) {
    }
}

function extractLdapCode(err) {
    if (!err) {
        return null;
    }
    if (Number.isFinite(err.code)) {
        return Number(err.code);
    }
    if (err?.lde_message) {
        const match = String(err.lde_message).match(/data\s+(\d+)/i);
        if (match) {
            const num = Number(match[1]);
            if (Number.isFinite(num)) {
                return num;
            }
        }
    }
    return null;
}

function resolveRolesFromGroups(ad, rawGroups) {
    const roles = [];
    const groupToRoles = (ad && ad.groupToRoles) || {};
    const normalizedMap = normalizeMapping(groupToRoles);
    for (const group of rawGroups) {
        const keys = buildGroupLookupKeys(group);
        for (const key of keys) {
            if (normalizedMap[key]) {
                roles.push(...normalizedMap[key]);
            }
        }
    }
    const defaultRoles = Array.isArray(ad.defaultRoles) ? ad.defaultRoles : [];
    roles.push(...defaultRoles);
    return Array.from(new Set(roles.map(v => String(v).trim()).filter(Boolean)));
}

function resolveLegacyMaskFromGroups(ad, rawGroups) {
    const groupToMask = (ad && ad.groupToMask) || {};
    const normalizedMap = normalizeMapping(groupToMask);
    let mask = 0;
    for (const group of rawGroups) {
        const keys = buildGroupLookupKeys(group);
        for (const key of keys) {
            const values = normalizedMap[key] || [];
            for (const value of values) {
                const n = Number(value);
                if (Number.isFinite(n)) {
                    mask |= n;
                }
            }
        }
    }
    if (!mask) {
        const fallback = Number(ad.defaultGroup);
        if (Number.isFinite(fallback)) {
            return fallback;
        }
    }
    return mask;
}

function normalizeMapping(map) {
    const result = {};
    const entries = Object.entries(map || {});
    for (const [rawKey, rawValue] of entries) {
        const keys = buildGroupLookupKeys(rawKey);
        const values = Array.isArray(rawValue) ? rawValue : [rawValue];
        for (const key of keys) {
            if (!result[key]) {
                result[key] = [];
            }
            result[key].push(...values);
        }
    }
    return result;
}

function buildGroupLookupKeys(value) {
    const group = String(value || '').trim();
    if (!group) {
        return [];
    }
    const keys = [group.toLowerCase()];
    const cn = extractCnFromDn(group);
    if (cn) {
        keys.push(cn.toLowerCase());
    }
    return Array.from(new Set(keys));
}

function extractCnFromDn(dn) {
    const match = String(dn).match(/(?:^|,)CN=([^,]+)/i);
    return match ? match[1].trim() : '';
}

function normalizeStringArray(value) {
    if (Array.isArray(value)) {
        return value.map(v => String(v)).filter(Boolean);
    }
    if (value === null || value === undefined) {
        return [];
    }
    return [String(value)];
}

function escapeFilterValue(value) {
    return String(value)
        .replace(/\\/g, '\\5c')
        .replace(/\*/g, '\\2a')
        .replace(/\(/g, '\\28')
        .replace(/\)/g, '\\29')
        .replace(/\0/g, '\\00');
}

function createProviderError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function createAuthError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

module.exports = {
    create: create
};
