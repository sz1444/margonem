const { verifyAccessToken } = require('../../lib/hidden/tokens');

// Proxy do zewnętrznego API — klucz zostaje na serwerze, dostęp tylko po zalogowaniu przez Discorda.
// URL i klucz w zmiennych środowiskowych Vercela: GRINLAB_URL, GRINLAB_TOKEN.
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Headers', 'Authorization');
        return res.status(204).end();
    }

    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!verifyAccessToken(token)) return res.status(401).json({ error: 'unauthorized' });

    const { GRINLAB_URL, GRINLAB_TOKEN } = process.env;
    if (!GRINLAB_URL || !GRINLAB_TOKEN) return res.status(500).json({ error: 'config' });

    try {
        const upstream = await fetch(GRINLAB_URL, { headers: { 'X-API-Key': GRINLAB_TOKEN } });
        const body = await upstream.text();
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.status(upstream.status).send(body);
    } catch (e) {
        console.error(e);
        res.status(502).json({ error: 'server' });
    }
};
