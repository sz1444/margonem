// Sesja ukrytych dodatków w GM storage (wspólna dla wszystkich kart).
// { accessToken, expiresAt, refreshToken, user } — wydaje ją api/hidden/callback.js, odnawia api/hidden/refresh.js.
import { gmRequest } from '../core/env.js';

export const BASE_URL = 'https://margonem.vercel.app';
const SESSION_KEY = 'hidden_session';
const AUTH_HASH_PREFIX = '#hidden=';

// Odświeżamy access token chwilę przed wygaśnięciem.
const REFRESH_MARGIN = 60 * 1000;

export const ERRORS = {
    cancelled: 'Logowanie anulowane.',
    state: 'Sesja logowania wygasła. Spróbuj ponownie.',
    not_member: 'Nie jesteś na serwerze Discord.',
    no_role: 'Nie masz wymaganej roli na Discordzie.',
    revoked: 'Sesja wygasła. Zaloguj się ponownie.',
    server: 'Błąd serwera. Spróbuj ponownie za chwilę.',
    config: 'Błąd konfiguracji serwera (brak zmiennych DISCORD_* w Vercelu).',
    discord_token: 'Discord odrzucił logowanie (sprawdź DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET).',
    discord_member: 'Nie udało się sprawdzić roli (sprawdź DISCORD_GUILD_ID).',
    modules: 'Nie udało się pobrać dodatków z serwera.',
};

/**
 * Wynik logowania (#hidden=...) doklejony przez api/hidden/callback.js przy powrocie do gry.
 * Zapisuje sesję, czyści adres i zwraca { error }, jeśli logowanie się nie udało.
 */
export function consumeAuthResult() {
    const hash = location.hash;
    if (!hash.startsWith(AUTH_HASH_PREFIX)) return {};
    history.replaceState(null, '', location.pathname + location.search);

    try {
        const base64 = hash.slice(AUTH_HASH_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
        const result = JSON.parse(decodeURIComponent(escape(atob(base64))));
        if (result.session) GM_setValue(SESSION_KEY, result.session);
        return { error: result.error };
    } catch {
        return { error: 'server' };
    }
}

export function redirectToLogin() {
    location.href = `${BASE_URL}/hidden/login?return=${encodeURIComponent(location.origin + location.pathname)}`;
}

export function logout() {
    GM_deleteValue(SESSION_KEY);
}

async function refreshSession(session) {
    let res;
    try {
        res = await gmRequest({
            method: 'POST',
            url: `${BASE_URL}/hidden/refresh`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ refreshToken: session.refreshToken }),
        });
    } catch {
        return { error: 'server' };
    }

    if (res.status === 200) {
        const fresh = JSON.parse(res.responseText);
        GM_setValue(SESSION_KEY, fresh);
        return { session: fresh };
    }

    if (res.status === 401 || res.status === 403) {
        // Inna karta mogła już odświeżyć sesję (Discord rotuje refresh tokeny) — wtedy bierzemy jej wynik.
        const current = GM_getValue(SESSION_KEY);
        if (current && current.refreshToken !== session.refreshToken) return { session: current };

        let error = 'revoked';
        try { if (JSON.parse(res.responseText).error === 'no_role') error = 'no_role'; } catch {}
        logout();
        return { error };
    }

    // Chwilowy błąd serwera — nie wylogowujemy, spróbujemy przy następnym wejściu.
    return { error: 'server' };
}

/** { session } albo { error } (brak sesji = {}). force: odśwież nawet ważny token. */
export async function getSession({ force = false } = {}) {
    const session = GM_getValue(SESSION_KEY);
    if (!session) return {};
    if (!force && session.expiresAt - Date.now() > REFRESH_MARGIN) return { session };
    return refreshSession(session);
}

// Bundle dodatków wykonujemy z jawnie przekazanym API Tampermonkeya (eval w hidden.user.js daje je tylko w zasięgu).
function evaluateModules(code) {
    const factory = new Function(
        'GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue', 'GM_deleteValue', 'unsafeWindow',
        `${code}\n;return hiddenModules.default;`,
    );
    return factory(GM_xmlhttpRequest, GM_getValue, GM_setValue, GM_deleteValue, unsafeWindow);
}

/** Pobiera chronione dodatki. Zwraca { modules } albo { error }. */
export async function fetchModules(session, retried = false) {
    let res;
    try {
        res = await gmRequest({
            method: 'GET',
            url: `${BASE_URL}/hidden/modules.js?t=${Date.now()}`,
            headers: { Authorization: `Bearer ${session.accessToken}` },
        });
    } catch {
        return { error: 'server' };
    }

    if (res.status === 401 && !retried) {
        const result = await getSession({ force: true });
        return result.session ? fetchModules(result.session, true) : { error: result.error || 'revoked' };
    }
    if (res.status !== 200) return { error: 'modules' };

    try {
        return { modules: evaluateModules(res.responseText) };
    } catch (e) {
        console.error('❌ Błąd ukrytych dodatków:', e);
        return { error: 'modules' };
    }
}
