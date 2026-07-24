module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).send('Method Not Allowed');
    }

    let body = req.body;
    if (!body || typeof body === 'string') {
        try {
            body = JSON.parse(body || '{}');
        } catch {
            body = {};
        }
    }

    const nick = body.nick;
    if (!nick) return res.status(400).send('Brak nicku');

    console.log(`NOWY_NICK: ${nick}`);
    res.status(200).send('OK');
};
