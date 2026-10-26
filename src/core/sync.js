// Logowanie przez Discord i WebSocket do backendów synchronizacji map (Event Helper, Tytan Helper).

const TOKEN_KEY = 'mapSync_dcToken';
const CLIENT_ID = '1488794373775687782';

/** Token z hasha po powrocie z OAuth (zapisywany i usuwany z URL) albo z localStorage. */
export function getDiscordToken() {
    const hash = location.hash;
    if (hash.includes('access_token=')) {
        const token = new URLSearchParams(hash.substring(1)).get('access_token');
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
            history.replaceState({}, document.title, location.pathname);
        }
    }
    return localStorage.getItem(TOKEN_KEY);
}

export function clearDiscordToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export function redirectToDiscordLogin() {
    const redirectUri = encodeURIComponent(location.origin + location.pathname);
    location.href = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=identify%20guilds.members.read`;
}

export function openSyncSocket(backendUrl, token) {
    return new WebSocket(backendUrl.replace('http', 'ws') + `?token=${token}`);
}

export function sendJSON(socket, payload) {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
}
