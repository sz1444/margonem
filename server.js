const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const VALID_TOKEN = process.env.SECRET_TOKEN;
const SCRIPT_PATH = path.join(__dirname, 'au.js');

app.use(express.json());
app.use(cors());

const loggedUsers = new Set();

// Endpoint logujący nick (widoczny w konsoli Vercela)
app.post('/log', (req, res) => {
    const nick = req.body.nick;
    if (!nick) return res.status(400).send('Brak nicku');

    if (!loggedUsers.has(nick)) {
        loggedUsers.add(nick);
        console.log(`NOWY_NICK: ${nick}`);
    }

    res.send('OK');
});

app.get('/au', (req, res) => {
    const userToken = req.query.token;

    if (!VALID_TOKEN || !userToken || userToken !== VALID_TOKEN) {
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
            'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
    });
});

module.exports = app;
