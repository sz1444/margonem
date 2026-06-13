const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    const VALID_TOKEN = process.env.SECRET_TOKEN;

    if (!VALID_TOKEN) {
        res.status(500).json({ error: "BŁĄD: Zmienna SECRET_TOKEN nie jest ustawiona w panelu Vercel!" });
        return;
    }

    // Pobranie tokenu z query string (?token=...)
    const userToken = req.query.token;

    if (!userToken || userToken !== VALID_TOKEN) {
        res.status(403).json({ error: 'Brak dostępu.' });
        return;
    }

    const SCRIPT_PATH = path.join(process.cwd(), 'au.js');

    try {
        const data = fs.readFileSync(SCRIPT_PATH, 'utf8');
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.status(200).send(data);
    } catch (err) {
        res.status(500).json({ error: 'Błąd odczytu pliku skryptu na serwerze.' });
    }
};