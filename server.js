require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

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
        console.log(`[Auth] Użytkownik ${userRes.data.username}: ${hasRole ? 'DOSTĘP' : 'BRAK RANGI'}`);
        return hasRole;
    } catch (e) { 
        console.error("Błąd autoryzacji Discord:", e.response?.data || e.message);
        return false; 
    }
}

wss.on('connection', async (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const token = urlParams.get('token');

    if (!token || !await hasDiscordRole(token)) {
        console.log("[WS] Odrzucono nieautoryzowane połączenie.");
        ws.close(4001, "Unauthorized");
        return;
    }

    console.log("[WS] Nowe połączenie zweryfikowane.");

    try {
        const snapshot = await db.ref('/').once('value');
        ws.send(JSON.stringify({ type: 'init_data', data: snapshot.val() }));
    } catch (err) {
        console.error("Błąd Firebase Init:", err);
    }

    ws.on('message', async (message) => {
        try {
            const payload = JSON.parse(message);

            if (payload.type === 'update_cell') {
                if (!payload.id) return;
                await db.ref(payload.id).set(payload.val);
                
                const broadcastData = JSON.stringify({ 
                    type: 'cell_updated', 
                    id: payload.id, 
                    val: payload.val 
                });

                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(broadcastData);
                    }
                });
            }

            if (payload.type === 'send_alert') {
                const alertData = JSON.stringify({ 
                    type: 'global_alert', 
                    data: payload.data 
                });

                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(alertData);
                    }
                });
            }

        } catch (e) {
            console.error("[WS] Błąd przetwarzania wiadomości:", e.message);
        }
    });

    ws.on('close', () => console.log("[WS] Klient rozłączony."));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Serwer natywny działa na porcie ${PORT}`));