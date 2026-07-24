module.exports = (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405.end('Method Not Allowed');
    }

    const nick = req.body.nick;
    if (!nick) return res.status(400).send('Brak nicku');

    console.log(`NOWY_NICK: ${nick}`);
    res.send('OK');
};
