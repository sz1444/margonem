const { signAccessToken, encryptRefreshToken } = require('./tokens');

const API = 'https://discord.com/api/v10';
// Dostęp ma każdy, kto ma choć jedną z tych ról (na serwerze DISCORD_GUILD_ID).
const ALLOWED_ROLE_IDS = [
    '843665045879652352',
];
const SCOPES = 'identify guilds.members.read';

// Musi być identyczny z adresem w Discord Developer Portal → OAuth2 → Redirects.
const REDIRECT_URI = 'https://margonem.vercel.app/hidden/callback';

// Obcinamy spacje i cudzysłowy, które łatwo wkleić razem z wartością w panelu Vercela.
const env = name => (process.env[name] || '').trim().replace(/^["']|["']$/g, '');

function config() {
    const clientId = env('DISCORD_CLIENT_ID');
    const clientSecret = env('DISCORD_CLIENT_SECRET');
    const guildId = env('DISCORD_GUILD_ID');
    if (!clientId || !clientSecret || !guildId) {
        throw new Error('Brak DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / DISCORD_GUILD_ID');
    }
    return { clientId, clientSecret, guildId };
}

function authorizeUrl(state) {
    const params = new URLSearchParams({
        client_id: config().clientId,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        state,
        prompt: 'none',
    });
    return `https://discord.com/oauth2/authorize?${params}`;
}

async function tokenRequest(fields) {
    const { clientId, clientSecret } = config();
    const res = await fetch(`${API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields }),
    });
    if (!res.ok) throw new Error(`Discord token ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    };
}

const exchangeCode = code => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
const refreshDiscord = refreshToken => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

/** Członkostwo na serwerze + rola. Zwraca { id, name, hasRole } albo null, gdy nie jest na serwerze. */
async function fetchMember(accessToken) {
    const res = await fetch(`${API}/users/@me/guilds/${config().guildId}/member`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Discord member ${res.status}`);
    const member = await res.json();
    return {
        id: member.user.id,
        name: member.nick || member.user.global_name || member.user.username,
        hasRole: member.roles.some(role => ALLOWED_ROLE_IDS.includes(role)),
    };
}

/** Sesja dla klienta: nasz access token + zaszyfrowany refresh token z tokenami Discorda. */
function createSession(user, discord) {
    const access = signAccessToken(user);
    return {
        accessToken: access.token,
        expiresAt: Date.now() + access.expiresIn,
        refreshToken: encryptRefreshToken({ sub: user.id, discord }),
        user: { id: user.id, name: user.name },
    };
}

module.exports = { authorizeUrl, exchangeCode, refreshDiscord, fetchMember, createSession };
