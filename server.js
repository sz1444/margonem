const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const VALID_TOKEN = process.env.SECRET_TOKEN;
const PORT = 3000;
const SCRIPT_PATH = path.join(__dirname, 'au.js');

if (!VALID_TOKEN) {
    console.error("BŁĄD: Zmienna środowiskowa SECRET_TOKEN nie została ustawiona!");
    process.exit(1);
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/au') {
        const userToken = parsedUrl.query.token;

        if (!userToken || userToken !== VALID_TOKEN) {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'Brak dostępu.' }));
        }

        fs.readFile(SCRIPT_PATH, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify({ error: 'Błąd serwera przy odczycie pliku.' }));
            }

            res.writeHead(200, { 
                'Content-Type': 'application/javascript; charset=utf-8',
                'Access-Control-Allow-Origin': '*' // Zezwala na zapytania z innych domen (CORS)
            });
            res.end(data);
        });
        return;
    }

    // Domyślny błąd dla innych ścieżek
    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(`Serwer wystartował na porcie ${PORT}`);
    console.log(`Oczekiwany URL: http://localhost:${PORT}/pobierz-skrypt?token=${VALID_TOKEN}`);
});
