import { createQuickParty } from '../../modules/party-quick-invite.js';
import { injectStyle } from '../../core/dom.js';
import { gmRequest } from '../../core/env.js';
import { BASE_URL, getSession } from '../auth.js';

// Serwer trzyma odpowiedź godzinę (api/hidden/titan-hour.js) — częściej nie ma sensu pytać.
const REFRESH_INTERVAL = 60 * 60 * 1000;

const CSS = `
    #tpqPanel .tpq-hours { color: #f1c40f; font-size: 10px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
    #tpqPanel .tpq-hours.empty { color: #777; }
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

/** „2/1” przy nicku: godziny w tym i poprzednim miesiącu. */
function hoursHtml(p) {
    if (!hoursByAccount) return '';
    const entry = hoursByAccount.get(Number(p.account));
    const current = entry?.current?.hours ?? 0;
    const previous = entry?.previous?.hours ?? 0;
    const title = `Godziny: ${months.current} — ${current}h, ${months.previous} — ${previous}h`;
    return `<div class="tpq-hours${entry ? '' : ' empty'}" title="${title}">${current}/${previous}h</div>`;
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
