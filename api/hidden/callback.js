const { exchangeCode, fetchMember, createSession } = require('../../lib/hidden/discord');
const { sanitizeReturnUrl } = require('../../lib/hidden/return-url');

function readCookie(req, name) {
    const match = (req.headers.cookie || '').match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

// Powrót do gry z wynikiem we fragmencie URL (#hidden=...) — nie trafia do logów serwera ani nagłówka Referer.
// Odczytuje go ukryty hub (src/hidden/main.js) i zapisuje sesję w GM storage.
function finish(req, res, result) {
    res.setHeader('Set-Cookie', [
        'hidden_state=; Path=/hidden; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
        'hidden_return=; Path=/hidden; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    ]);
    const returnUrl = sanitizeReturnUrl(readCookie(req, 'hidden_return'));
    const hash = Buffer.from(JSON.stringify(result)).toString('base64url');
    res.writeHead(302, { Location: `${returnUrl}#hidden=${hash}` });
    res.end();
}

// Który krok się wysypał — żeby z komunikatu w grze było widać, co poprawić w konfiguracji.
function errorCode(e) {
    if (e.message.startsWith('Brak')) return 'config';
    if (e.message.startsWith('Discord token')) return 'discord_token';
    if (e.message.startsWith('Discord member')) return 'discord_member';
    return 'server';
}

module.exports = async (req, res) => {
    const { code, state, error } = req.query;

    if (error) return finish(req, res, { error: 'cancelled' });
    if (!code || !state || state !== readCookie(req, 'hidden_state')) return finish(req, res, { error: 'state' });

    try {
        const discord = await exchangeCode(code);
        const member = await fetchMember(discord.accessToken);

        if (!member) return finish(req, res, { error: 'not_member' });
        if (!member.hasRole) return finish(req, res, { error: 'no_role' });

        console.log(`HIDDEN_LOGIN: ${member.name} (${member.id})`);
        finish(req, res, { session: createSession(member, discord) });
    } catch (e) {
        console.error(e);
        finish(req, res, { error: errorCode(e) });
    }
};
