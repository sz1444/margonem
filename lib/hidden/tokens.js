// Tokeny ukrytych dodatków — bezstanowe (bez bazy):
//  - access token: krótko żyjący, podpisany HMAC, `payload.podpis`
//  - refresh token: zaszyfrowany AES-256-GCM blob z tokenami Discorda; przy odświeżeniu
//    ponownie sprawdzamy rolę na serwerze, więc odebranie roli odcina dostęp najpóźniej po ACCESS_TTL.
const crypto = require('crypto');

const ACCESS_TTL = 6 * 60 * 60 * 1000;

function secret() {
    const value = process.env.HIDDEN_SECRET;
    if (!value) throw new Error('Brak zmiennej HIDDEN_SECRET');
    return value;
}

const deriveKey = label => crypto.createHash('sha256').update(`${label}:${secret()}`).digest();

const b64 = buf => Buffer.from(buf).toString('base64url');
const unb64 = str => Buffer.from(str, 'base64url');

function signAccessToken(user) {
    const payload = b64(JSON.stringify({ sub: user.id, name: user.name, exp: Date.now() + ACCESS_TTL }));
    const sig = b64(crypto.createHmac('sha256', deriveKey('access')).update(payload).digest());
    return { token: `${payload}.${sig}`, expiresIn: ACCESS_TTL };
}

/** Zwraca payload albo null, gdy podpis się nie zgadza / token wygasł. */
function verifyAccessToken(token) {
    if (typeof token !== 'string') return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;

    const expected = crypto.createHmac('sha256', deriveKey('access')).update(payload).digest();
    const given = unb64(sig);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

    try {
        const data = JSON.parse(unb64(payload).toString('utf8'));
        return data.exp > Date.now() ? data : null;
    } catch {
        return null;
    }
}

function encryptRefreshToken(data) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey('refresh'), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    return b64(Buffer.concat([iv, cipher.getAuthTag(), body]));
}

function decryptRefreshToken(token) {
    if (typeof token !== 'string') return null;
    try {
        const raw = unb64(token);
        const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey('refresh'), raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        const body = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
        return JSON.parse(body.toString('utf8'));
    } catch {
        return null;
    }
}

module.exports = { signAccessToken, verifyAccessToken, encryptRefreshToken, decryptRefreshToken };
