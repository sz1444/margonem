const fs = require('fs');
const path = require('path');
const { verifyAccessToken } = require('../../lib/hidden/tokens');

// Bundle ukrytych dodatków budowany przez `npm run build` poza public/, żeby nie był dostępny bez logowania.
const MODULES_PATH = path.join(process.cwd(), 'private', 'hidden-modules.js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Headers', 'Authorization');
        return res.status(204).end();
    }

    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!verifyAccessToken(token)) return res.status(401).json({ error: 'unauthorized' });

    try {
        const data = fs.readFileSync(MODULES_PATH, 'utf8');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Błąd odczytu dodatków na serwerze.' });
    }
};
