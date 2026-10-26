const { decryptRefreshToken } = require('../../lib/hidden/tokens');
const { refreshDiscord, fetchMember, createSession } = require('../../lib/hidden/discord');

// Token Discorda odświeżamy dopiero, gdy wygasa (Discord rotuje refresh tokeny przy użyciu,
// więc rzadsze odświeżanie = mniej wyścigów między kartami).
const DISCORD_REFRESH_MARGIN = 60 * 60 * 1000;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }

    const data = decryptRefreshToken(body?.refreshToken);
    if (!data?.discord) return res.status(401).json({ error: 'invalid' });

    try {
        let discord = data.discord;
        if (discord.expiresAt - Date.now() < DISCORD_REFRESH_MARGIN) discord = await refreshDiscord(discord.refreshToken);

        const member = await fetchMember(discord.accessToken);
        if (!member || member.id !== data.sub) return res.status(401).json({ error: 'not_member' });
        if (!member.hasRole) return res.status(403).json({ error: 'no_role' });

        res.status(200).json(createSession(member, discord));
    } catch (e) {
        // Odrzucony refresh token Discorda = trzeba zalogować się ponownie.
        console.error(e);
        const revoked = /Discord (token|member) 40[01]/.test(e.message);
        res.status(revoked ? 401 : 502).json({ error: revoked ? 'revoked' : 'server' });
    }
};
