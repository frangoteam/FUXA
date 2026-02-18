'use strict';

const localProvider = require('./providers/local.provider');
const adLdapProvider = require('./providers/ad-ldap.provider');

var runtime;
var settings;
var logger;
var providers;

function init(_runtime, _settings, _logger) {
    runtime = _runtime;
    settings = _settings;
    logger = _logger;
    const adProvider = adLdapProvider.create({ runtime, settings, logger });
    providers = {
        local: localProvider.create({ runtime, settings, logger }),
        ad: adProvider,
        'ad-ldap': adProvider
    };
    return Promise.resolve();
}

function getSelectedProviderName() {
    const providerName = settings && settings.auth && settings.auth.provider;
    return providerName || 'local';
}

function getProviderOrFallback() {
    const selected = getSelectedProviderName();
    if (providers[selected]) {
        return providers[selected];
    }
    if (logger) {
        logger.warn(`auth provider "${selected}" not found, fallback to local`);
    }
    return providers.local;
}

function normalizeIdentity(identity) {
    const normalized = { ...identity };
    const info = normalizeInfo(normalized.info);
    const roles = normalizeRoles(normalized.roles, info);
    info.roles = roles;
    normalized.info = JSON.stringify(info);
    normalized.groups = normalizeLegacyGroups(normalized.groups, roles);
    normalized.roles = roles;
    return normalized;
}

function normalizeInfo(info) {
    if (!info) {
        return {};
    }
    if (typeof info === 'string') {
        try {
            return JSON.parse(info);
        } catch (err) {
            return {};
        }
    }
    if (typeof info === 'object') {
        return { ...info };
    }
    return {};
}

function normalizeRoles(roles, info) {
    let baseRoles = roles;
    if (!Array.isArray(baseRoles) && info && Array.isArray(info.roles)) {
        baseRoles = info.roles;
    }
    if (!Array.isArray(baseRoles)) {
        return [];
    }
    const uniq = Array.from(new Set(baseRoles.filter(role => typeof role === 'string' && role.trim().length > 0).map(role => role.trim())));
    return uniq;
}

function normalizeLegacyGroups(groups, roles) {
    if (typeof groups === 'string' && groups.trim().length) {
        const parsed = Number(groups);
        if (Number.isFinite(parsed)) {
            groups = parsed;
        }
    }
    if (typeof groups === 'number' && Number.isFinite(groups)) {
        return groups;
    }
    const adminRoleNames = getAdminRoleNames();
    const hasAdminRole = roles.some(role => adminRoleNames.includes(role.toLowerCase()));
    if (hasAdminRole) {
        return -1;
    }
    if (settings && settings.userRole) {
        // Preserve legacy assumptions: authenticated non-admin user in role mode gets a non-admin group mask.
        return 1;
    }
    return 0;
}

function getAdminRoleNames() {
    const configured = settings && settings.auth && settings.auth.adminRoleNames;
    const names = Array.isArray(configured) && configured.length ? configured : ['admin', 'administrator'];
    return names.map(name => String(name).toLowerCase());
}

async function authenticate(credentials) {
    const selected = getSelectedProviderName();
    const provider = getProviderOrFallback();
    try {
        const identity = await provider.authenticate(credentials);
        return normalizeIdentity(identity);
    } catch (err) {
        if (shouldTryLocalFallback(selected, err)) {
            const identity = await providers.local.authenticate(credentials);
            return normalizeIdentity(identity);
        }
        throw err;
    }
}

async function refreshIdentity(context) {
    const selected = getSelectedProviderName();
    const provider = getProviderOrFallback();
    try {
        if (typeof provider.refreshIdentity === 'function') {
            const identity = await provider.refreshIdentity(context);
            if (identity) {
                return normalizeIdentity(identity);
            }
        }
        if (shouldTryLocalFallback(selected)) {
            const identity = await providers.local.refreshIdentity(context);
            if (identity) {
                return normalizeIdentity(identity);
            }
        }
    } catch (err) {
        if (shouldTryLocalFallback(selected, err)) {
            const identity = await providers.local.refreshIdentity(context);
            if (identity) {
                return normalizeIdentity(identity);
            }
        } else {
            throw err;
        }
    }
    return null;
}

function shouldTryLocalFallback(selectedProvider, err) {
    if (!providers || !providers.local || selectedProvider === 'local') {
        return false;
    }
    const enabled = settings && settings.auth && settings.auth.fallbackLocal;
    if (enabled === false) {
        return false;
    }
    if (!err) {
        return true;
    }
    if (err.status === 401 || err.status === 404) {
        return true;
    }
    if (typeof err.code === 'string' && err.code.startsWith('ad_')) {
        return true;
    }
    return false;
}

module.exports = {
    init: init,
    authenticate: authenticate,
    refreshIdentity: refreshIdentity
};
