const express = require('express');
const cors = require('cors');

const app = express();

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

module.exports = app;
