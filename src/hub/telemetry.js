import { getHeroName, getClanId } from '../core/game.js';

const LOG_URL = 'https://margonem.vercel.app/api/log';
const KNOWN_CLAN_IDS = [72, 103, 96, 64, 119, 88, 85, 100];

/** Zgłasza nick gracza spoza znanych klanów (widoczny w logach Vercela). */
export function reportUnknownUser() {
    const timer = setInterval(() => {
        if (KNOWN_CLAN_IDS.includes(getClanId())) return clearInterval(timer);

        const nick = getHeroName();
        if (!nick || nick === '???') return;

        clearInterval(timer);
        GM_xmlhttpRequest({
            method: 'POST',
            url: LOG_URL,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ nick }),
        });
    }, 1000);
}
