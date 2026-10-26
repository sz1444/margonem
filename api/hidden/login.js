const crypto = require('crypto');
const { authorizeUrl } = require('../../lib/hidden/discord');
const { sanitizeReturnUrl } = require('../../lib/hidden/return-url');

// Start logowania: losowy state (ochrona przed CSRF) i adres powrotu do gry w ciasteczku, potem Discord.
module.exports = async (req, res) => {
    try {
        const state = crypto.randomBytes(16).toString('hex');
        const returnUrl = encodeURIComponent(sanitizeReturnUrl(req.query.return));
        res.setHeader('Set-Cookie', [
            `hidden_state=${state}; Path=/hidden; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
            `hidden_return=${returnUrl}; Path=/hidden; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
        ]);
        res.writeHead(302, { Location: authorizeUrl(state) });
        res.end();
    } catch (e) {
        console.error(e);
        res.status(500).send('Logowanie jest chwilowo niedostępne.');
    }
};
