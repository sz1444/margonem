import { createQuickParty } from '../../modules/party-quick-invite.js';
import { MAP_CONFIG } from '../../modules/tytan-helper.js';
import { injectStyle } from '../../core/dom.js';
import { gmRequest } from '../../core/env.js';
import { getMapName } from '../../core/game.js';
import { BASE_URL, getSession } from '../auth.js';

// Serwer trzyma odpowiedź godzinę (api/hidden/titan-hour.js) — częściej nie ma sensu pytać.
const REFRESH_INTERVAL = 60 * 60 * 1000;
// Ostatnia odpowiedź w GM storage (wspólna dla kart): po odświeżeniu gry godziny są od razu.
const CACHE_KEY = 'hidden_titan_hours_v2';
const STALE_CHECK_INTERVAL = 5 * 60 * 1000;

const CSS = `
    /* Godziny za poziomem: same liczby w równych kolumnach (poprzedni · ten miesiąc · dziś), bez ramek i jednostek. */
    #tpqPanel .tpq-hours {
        display: flex; align-items: center; flex-shrink: 0;
        font-size: 10px; font-weight: 600; line-height: 13px; white-space: nowrap;
        font-variant-numeric: tabular-nums; color: #e06c6c;
    }
    #tpqPanel .tpq-hours > span { width: 22px; text-align: right; }
    #tpqPanel .tpq-hours .prev { opacity: 0.6; }
    #tpqPanel .tpq-hours .high { color: #5fd88a; }
    #tpqPanel .tpq-hours .mid { color: #e8d25a; }
    #tpqPanel .tpq-hours .today { color: #7fc8f0; }
    #tpqPanel .pqi-row { padding: 1px 2px; }
    /* Poziom cienki i biały, żeby nie mylił się z godzinami (kolor relacji ma inline style). */
    #tpqPanel .pqi-lvl { color: #fff !important; font-weight: 400; }
    /* Pełne nicki: zamiast ucinać „…” zawijamy je w komórce. */
    #tpqPanel .pqi-nick { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; line-height: 13px; }
`;

// accountId → { current, previous } z /hidden/titan-hour; null, dopóki nie przyjdą dane.
let hoursByAccount = null;
let months = {};
// Dzień, którego dotyczy `today` w odpowiedzi („2026-10-20”).
let hoursDay = null;

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
    hoursDay = data.today ?? null;
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

/** Dzisiejsza data lokalnie, w formacie API („2026-10-20”). */
const localDay = () => new Date().toLocaleDateString('sv-SE');

/** Tytan z mapy, na której stoi gracz (wg MAP_CONFIG), albo null. */
function currentMapTitan() {
    const mapName = getMapName('').toLowerCase();
    return MAP_CONFIG.find(m => m.name.toLowerCase() === mapName)?.monster ?? null;
}

/** „1.5” — dzisiejsze godziny na tytanie z bieżącej mapy; poza mapą tytana (albo gdy dane są z innego dnia) nic. */
// Na razie tylko w wersji dev (/hidden.js?dev=true).
function todayHtml(entry, titan) {
    if (!__HIDDEN_DEV__ || !titan || hoursDay !== localDay()) return '';
    const hours = Number(entry?.today?.byTitan?.find(t => t.name === titan)?.hours) || 0;
    const label = `${Math.round(hours * 10) / 10}h`;
    const title = `Godziny na tytanie ${titan} — dziś: ${label}`;
    return `<span class="today" title="${title}">${Math.round(hours * 10) / 10}</span>`;
}

/** „1  2” za poziomem: godziny w poprzednim i tym miesiącu; po najechaniu — którego miesiąca dotyczą. Na mapie tytana dochodzi „│ dziś”. */
function hoursHtml(p) {
    if (!hoursByAccount) return '';
    const entry = hoursByAccount.get(Number(p.account));
    const current = fullHours(entry?.current?.hours);
    const previous = fullHours(entry?.previous?.hours);
    const currentTitle = `Godziny na tytanach — ${monthLabel(months.current)} (ten miesiąc): ${current}h`;
    const previousTitle = `Godziny na tytanach — ${monthLabel(months.previous)} (poprzedni miesiąc): ${previous}h`;
    return `<div class="tpq-hours" title="${previousTitle}\n${currentTitle}">`
        + `<span class="prev ${levelClass(previous)}" title="${previousTitle}">${previous}</span>`
        + `<span class="cur ${levelClass(current)}" title="${currentTitle}">${current}</span>`
        + `${todayHtml(entry, currentMapTitan())}</div>`;
}

export default createQuickParty({
    id: 'titan-party',
    name: 'Gracze na mapie',
    description: 'Gracze na mapie z godzinami na tytanach.',
    title: 'Gracze na mapie',
    panelId: 'tpqPanel',
    storagePrefix: 'tpq',
    // Plakietka z godzinami poszerza wiersz — więcej kolumn dopiero w szerszym oknie.
    columnBreakpoints: [400, 620, 1200],
    // Nowe składanie grupy na razie tylko w /hidden.js?dev=true.
    keepParty: __HIDDEN_DEV__,
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
