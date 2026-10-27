import { createQuickParty } from '../../modules/party-quick-invite.js';
import { injectStyle } from '../../core/dom.js';
import { gmRequest } from '../../core/env.js';
import { BASE_URL, getSession } from '../auth.js';

// Serwer trzyma odpowiedź godzinę (api/hidden/titan-hour.js) — częściej nie ma sensu pytać.
const REFRESH_INTERVAL = 60 * 60 * 1000;
// Ostatnia odpowiedź w GM storage (wspólna dla kart): po odświeżeniu gry godziny są od razu.
const CACHE_KEY = 'hidden_titan_hours';
const STALE_CHECK_INTERVAL = 5 * 60 * 1000;

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

function applyHours(data) {
    if (!data?.accounts) return false;
    hoursByAccount = new Map(data.accounts.map(a => [a.accountId, a]));
    months = { current: data.currentMonth, previous: data.previousMonth };
    return true;
}

/** Dane z GM storage: { data, fetchedAt } albo null. */
function loadCached() {
    const cached = GM_getValue(CACHE_KEY);
    return cached?.data ? cached : null;
}

async function loadHours() {
    const data = await fetchTitanHours();
    if (!applyHours(data)) return false;
    GM_setValue(CACHE_KEY, { data, fetchedAt: Date.now() });
    return true;
}

const isStale = () => Date.now() - (loadCached()?.fetchedAt ?? 0) > REFRESH_INTERVAL;

/** Tylko pełne godziny. */
const fullHours = h => Math.max(0, Math.floor(Number(h) || 0));

/** Suma pełnych godzin z obu miesięcy — do sortowania. */
function totalHours(p) {
    const entry = hoursByAccount?.get(Number(p.account));
    return fullHours(entry?.current?.hours) + fullHours(entry?.previous?.hours);
}

/** Kolor progu: 30h+ zielony, 20h+ żółty, poniżej czerwony. */
const levelClass = h => (h >= 30 ? 'high' : h >= 20 ? 'mid' : '');

const MONTH_NAMES = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
    'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

/** „2026-10” → „październik 2026”. */
function monthLabel(month) {
    const [year, m] = String(month ?? '').split('-').map(Number);
    return MONTH_NAMES[m - 1] ? `${MONTH_NAMES[m - 1]} ${year}` : '?';
}

/** „1h │ 2h” przed poziomem: godziny w poprzednim i tym miesiącu; po najechaniu — którego miesiąca dotyczą. */
function hoursHtml(p) {
    if (!hoursByAccount) return '';
    const entry = hoursByAccount.get(Number(p.account));
    const current = fullHours(entry?.current?.hours);
    const previous = fullHours(entry?.previous?.hours);
    const currentTitle = `Godziny na tytanach — ${monthLabel(months.current)} (ten miesiąc): ${current}h`;
    const previousTitle = `Godziny na tytanach — ${monthLabel(months.previous)} (poprzedni miesiąc): ${previous}h`;
    return `<div class="tpq-hours" title="${previousTitle}\n${currentTitle}">`
        + `<span class="prev ${levelClass(previous)}" title="${previousTitle}">${previous}h</span><span class="sep">│</span>`
        + `<span class="cur ${levelClass(current)}" title="${currentTitle}">${current}h</span></div>`;
}

export default createQuickParty({
    id: 'titan-party',
    name: 'Quick Party (tytani)',
    description: 'Quick Party z godzinami na tytanach (ten / poprzedni miesiąc) przy nicku.',
    title: 'Quick Party T',
    panelId: 'tpqPanel',
    storagePrefix: 'tpq',
    // Plakietka z godzinami poszerza wiersz — więcej kolumn dopiero w szerszym oknie.
    columnBreakpoints: [400, 620, 1200],
    extension: {
        setup(rerender) {
            injectStyle(CSS);
            if (applyHours(loadCached()?.data)) rerender();
            // Pobieramy tylko, gdy zapis jest starszy niż godzina (inna karta mogła już go odświeżyć).
            const refresh = async () => {
                if (!isStale()) {
                    if (applyHours(loadCached().data)) rerender();
                    return;
                }
                if (await loadHours()) rerender();
            };
            refresh();
            setInterval(refresh, STALE_CHECK_INTERVAL);
        },
        rowExtraHtml: hoursHtml,
        // Najwięcej godzin (ten + poprzedni miesiąc) na górze.
        comparePlayers: (a, b) => totalHours(b) - totalHours(a),
    },
});
