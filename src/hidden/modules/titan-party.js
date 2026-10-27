import { createQuickParty } from '../../modules/party-quick-invite.js';
import { injectStyle } from '../../core/dom.js';
import { gmRequest } from '../../core/env.js';
import { BASE_URL, getSession } from '../auth.js';

// Serwer trzyma odpowiedź godzinę (api/hidden/titan-hour.js) — częściej nie ma sensu pytać.
const REFRESH_INTERVAL = 60 * 60 * 1000;

const CSS = `
    /* Każdy gracz w ramce; godziny jako etykieta na środku górnej krawędzi, do połowy nad ramką. */
    #tpqPanel .pqi-row {
        position: relative; margin-top: 8px; padding: 5px 2px 1px;
        border: 1px solid rgba(255,255,255,0.18); border-radius: 3px;
    }
    #tpqPanel .tpq-hours {
        position: absolute; top: 0; left: 50%; transform: translate(-50%, -50%);
        display: flex; align-items: center; gap: 3px;
        padding: 0 5px; border-radius: 6px; line-height: 11px;
        background: #1b1b1b; border: 1px solid rgba(255,255,255,0.25);
        font-size: 9px; font-weight: 700; white-space: nowrap; color: #aaa;
    }
    #tpqPanel .tpq-hours .prev { opacity: 0.75; }
    #tpqPanel .tpq-hours .sep { color: rgba(255,255,255,0.3); font-weight: 400; }
    #tpqPanel .tpq-hours .high { color: #2ecc71; }
    #tpqPanel .tpq-hours .mid { color: #f1c40f; }
    #tpqPanel .tpq-hours.empty { color: #666; }
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

/** Kolor progu: 30h+ zielony, 20h+ żółty, poniżej domyślny szary. */
const levelClass = h => (h >= 30 ? 'high' : h >= 20 ? 'mid' : '');

/** „2h │ 1h” przy nicku: godziny w tym i poprzednim miesiącu. */
function hoursHtml(p) {
    if (!hoursByAccount) return '';
    const entry = hoursByAccount.get(Number(p.account));
    const current = fullHours(entry?.current?.hours);
    const previous = fullHours(entry?.previous?.hours);
    const title = `Tytani — ten miesiąc (${months.current}): ${current}h, poprzedni (${months.previous}): ${previous}h`;
    return `<div class="tpq-hours${current || previous ? '' : ' empty'}" title="${title}">`
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
    },
});
