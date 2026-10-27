import { createQuickParty } from '../../modules/party-quick-invite.js';
import { injectStyle } from '../../core/dom.js';
import { gmRequest } from '../../core/env.js';
import { BASE_URL, getSession } from '../auth.js';

// Serwer trzyma odpowiedź godzinę (api/hidden/titan-hour.js) — częściej nie ma sensu pytać.
const REFRESH_INTERVAL = 60 * 60 * 1000;

const CSS = `
    #tpqPanel .tpq-hours {
        display: flex; align-items: center; gap: 3px; flex-shrink: 0;
        padding: 0 4px; border-radius: 6px; line-height: 12px;
        background: rgba(241,196,15,0.12); border: 1px solid rgba(241,196,15,0.35);
        font-size: 10px; font-weight: 700; white-space: nowrap;
    }
    #tpqPanel .tpq-hours .cur { color: #f1c40f; }
    #tpqPanel .tpq-hours .prev { color: #b8a35a; font-weight: 400; }
    #tpqPanel .tpq-hours .sep { color: rgba(255,255,255,0.3); font-weight: 400; }
    #tpqPanel .tpq-hours.empty { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }
    #tpqPanel .tpq-hours.empty span { color: #777; }
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

/** „2h │ 1h” przy nicku: godziny w tym i poprzednim miesiącu. */
function hoursHtml(p) {
    if (!hoursByAccount) return '';
    const entry = hoursByAccount.get(Number(p.account));
    const current = fullHours(entry?.current?.hours);
    const previous = fullHours(entry?.previous?.hours);
    const title = `Tytani — ten miesiąc (${months.current}): ${current}h, poprzedni (${months.previous}): ${previous}h`;
    return `<div class="tpq-hours${current || previous ? '' : ' empty'}" title="${title}">`
        + `<span class="cur">${current}h</span><span class="sep">│</span><span class="prev">${previous}h</span></div>`;
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
