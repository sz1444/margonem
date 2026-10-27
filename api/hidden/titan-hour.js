const { verifyAccessToken } = require('../../lib/hidden/tokens');

// Proxy do zewnętrznego API — klucz zostaje na serwerze, dostęp tylko po zalogowaniu przez Discorda.
// URL i klucz w zmiennych środowiskowych Vercela: GRINLAB_URL, GRINLAB_TOKEN.

// Cache w pamięci instancji (nie w CDN, żeby nie omijać sprawdzania tokena). Trzymamy tylko odpowiedzi 200.
const CACHE_TTL = 60 * 60 * 1000;
let cache = null; // { body, contentType, expiresAt }

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Headers', 'Authorization');
        return res.status(204).end();
    }

    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!verifyAccessToken(token)) return res.status(401).json({ error: 'unauthorized' });

    res.setHeader('Cache-Control', 'no-store');

    if (cache && cache.expiresAt > Date.now()) {
        res.setHeader('Content-Type', cache.contentType);
        return res.status(200).send(cache.body);
    }

    const { GRINLAB_URL, GRINLAB_TOKEN } = process.env;
    if (!GRINLAB_URL || !GRINLAB_TOKEN) return res.status(500).json({ error: 'config' });

    try {
        const upstream = await fetch(GRINLAB_URL, { headers: { 'X-API-Key': GRINLAB_TOKEN } });
        const body = await upstream.text();
        const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
        if (upstream.ok) cache = { body, contentType, expiresAt: Date.now() + CACHE_TTL };
        res.setHeader('Content-Type', contentType);
        res.status(upstream.status).send(body);
    } catch (e) {
        console.error(e);
        res.status(502).json({ error: 'server' });
    }
};
