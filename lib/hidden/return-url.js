// Dokąd wrócić po logowaniu: tylko strony gry (https://*.margonem.pl), żeby nie dało się
// przekierować sesji na obcą domenę. Bez query i hasha — na końcu doklejamy własny #hidden=...
const DEFAULT_RETURN_URL = 'https://nubes.margonem.pl/';

function sanitizeReturnUrl(value) {
    try {
        const url = new URL(value);
        const isGame = url.protocol === 'https:' && (url.hostname === 'margonem.pl' || url.hostname.endsWith('.margonem.pl'));
        return isGame ? url.origin + url.pathname : DEFAULT_RETURN_URL;
    } catch {
        return DEFAULT_RETURN_URL;
    }
}

module.exports = { sanitizeReturnUrl };
