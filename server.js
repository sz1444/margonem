require('dotenv').config(); // Ładowanie zmiennych z pliku .env
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.database();

const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;

async function hasDiscordRole(accessToken) {
    try {
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const userId = userRes.data.id;

        const res = await axios.get(`https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });
        
        const hasRole = res.data.roles.includes(ROLE_ID);
        console.log(`Użytkownik ${userRes.data.username} próbuje wejść. Ranga: ${hasRole}`);
        return hasRole;
    } catch (e) { 
        console.error("Błąd autoryzacji Discord:", e.response?.data || e.message);
        return false; 
    }
}

io.on('connection', async (socket) => {
    const token = socket.handshake.auth.token;

    if (!token || !await hasDiscordRole(token)) {
        console.log("Nieautoryzowane połączenie - odrzucam.");
        socket.disconnect();
        return;
    }

    console.log("Zalogowano pomyślnie. Wysyłam dane.");

    const snapshot = await db.ref('/').once('value');
    socket.emit('init_data', snapshot.val());

    socket.on('update_cell', async (payload) => {
        if (!payload.id) return;
        await db.ref(payload.id).set(payload.val);
        io.emit('cell_updated', payload);
    });

    socket.on('send_alert', async (data) => {
        io.emit('global_alert', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));