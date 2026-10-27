import { createQuickParty } from '../../modules/party-quick-invite.js';
import { injectStyle } from '../../core/dom.js';
import { gmRequest } from '../../core/env.js';
import { BASE_URL, getSession } from '../auth.js';

// Serwer trzyma odpowiedź godzinę (api/hidden/titan-hour.js) — częściej nie ma sensu pytać.
const REFRESH_INTERVAL = 60 * 60 * 1000;

const CSS = `
    /* Godziny jako mała plakietka przed poziomem. */
    #tpqPanel .tpq-hours {
        display: flex; align-items: center; gap: 2px; flex-shrink: 0;
        padding: 0 3px; border-radius: 3px; line-height: 12px;
        background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.15);
        font-size: 10px; font-weight: 700; white-space: nowrap; color: #ff4d4d;
    }
    /* Stała szerokość liczb — plakietki w każdym wierszu równe (do „999h”). */
    #tpqPanel .tpq-hours .cur, #tpqPanel .tpq-hours .prev { width: 24px; text-align: center; font-variant-numeric: tabular-nums; }
    #tpqPanel .tpq-hours .sep { color: rgba(255,255,255,0.3); font-weight: 400; }
    #tpqPanel .tpq-hours .high { color: #4dff8f; }
    #tpqPanel .tpq-hours .mid { color: #ffe23d; }
    #tpqPanel .pqi-row { padding: 1px 2px; }
    /* Pełne nicki: zamiast ucinać „…” zawijamy je w komórce. */
    #tpqPanel .pqi-nick { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; line-height: 13px; }
`;

// accountId → { current, previous } z /hidden/titan-hour; null, dopóki nie przyjdą dane.
let hoursByAccount = null;
let months = {};

/** Odpowiedź /hidden/titan-hour albo null. Przy 401 raz odświeża sesję i ponawia. */
async function fetchTitanHours(retried = false) {
    const { session } = await getSession({ force: retried });
    if (!session) return null;

    let res;
    try {
        res = await gmRequest({
            method: 'GET',
            url: `${BASE_URL}/hidden/titan-hour`,
            headers: { Authorization: `Bearer ${session.accessToken}` },
        });
    } catch {
        return null;
    }

    if (res.status === 401 && !retried) return fetchTitanHours(true);
    if (res.status !== 200) return null;
    try {
        return JSON.parse(res.responseText);
    } catch {
        return null;
    }
}

async function loadHours() {
    const data = await fetchTitanHours();
    if (!data?.accounts) return false;
    hoursByAccount = new Map(data.accounts.map(a => [a.accountId, a]));
    months = { current: data.currentMonth, previous: data.previousMonth };
    return true;
}

/** Tylko pełne godziny. */
const fullHours = h => Math.max(0, Math.floor(Number(h) || 0));

/** Suma pełnych godzin z obu miesięcy — do sortowania. */
function totalHours(p) {
    const entry = hoursByAccount?.get(Number(p.account));
    return fullHours(entry?.current?.hours) + fullHours(entry?.previous?.hours);
}

/** Kolor progu: 30h+ zielony, 20h+ żółty, poniżej czerwony. */
const levelClass = h => (h >= 30 ? 'high' : h >= 20 ? 'mid' : '');

/** „2h │ 1h” przy nicku: godziny w tym i poprzednim miesiącu. */
function hoursHtml(p) {
    if (!hoursByAccount) return '';
    const entry = hoursByAccount.get(Number(p.account));
    const current = fullHours(entry?.current?.hours);
    const previous = fullHours(entry?.previous?.hours);
    const title = `Tytani — ten miesiąc (${months.current}): ${current}h, poprzedni (${months.previous}): ${previous}h`;
    return `<div class="tpq-hours" title="${title}">`
        + `<span class="cur ${levelClass(current)}">${current}h</span><span class="sep">│</span><span class="prev ${levelClass(previous)}">${previous}h</span></div>`;
}

export default createQuickParty({
    id: 'titan-party',
    name: 'Quick Party (tytani)',
    description: 'Quick Party z godzinami na tytanach (ten / poprzedni miesiąc) przy nicku.',
    title: 'Quick Party T',
    panelId: 'tpqPanel',
    storagePrefix: 'tpq',
    extension: {
        setup(rerender) {
            injectStyle(CSS);
            const refresh = async () => { if (await loadHours()) rerender(); };
            refresh();
            setInterval(refresh, REFRESH_INTERVAL);
        },
        rowExtraHtml: hoursHtml,
        // Najwięcej godzin (ten + poprzedni miesiąc) na górze.
        comparePlayers: (a, b) => totalHours(b) - totalHours(a),
    },
});
