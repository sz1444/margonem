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
    /* Godziny po prawej: każdy okres w ramce — na górze liczba, pod nią okres (wrz / paź / dziś). */
    #tpqPanel .tpq-hours { display: flex; align-items: stretch; gap: 1px; flex-shrink: 0; }
    #tpqPanel .tpq-cell {
        display: flex; flex-direction: column; align-items: center; justify-content: center; width: 26px; padding: 0;
        border: 1px solid rgba(255,255,255,0.18); border-radius: 2px; background: rgba(0,0,0,0.3);
        color: #e06c6c; white-space: nowrap;
    }
    #tpqPanel .tpq-cell b { font-size: 10px; line-height: 10px; font-weight: 600; font-variant-numeric: tabular-nums; }
    #tpqPanel .tpq-cell i { font-size: 7px; line-height: 7px; font-style: normal; color: rgba(255,255,255,0.45); }
    #tpqPanel .tpq-cell.high { color: #5fd88a; }
    #tpqPanel .tpq-cell.mid { color: #e8d25a; }
    #tpqPanel .tpq-cell.today { color: #7fc8f0; }
    #tpqPanel .pqi-row { padding: 0 2px; }
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

/** Czy pokazujemy kolumnę „dziś” (mapa tytana, dane z dzisiaj) — tytan albo null. */
function todayTitan() {
    if (hoursDay !== localDay()) return null;
    return currentMapTitan();
}

/** „2026-10” → „paź”. */
const MONTH_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const monthShort = month => MONTH_SHORT[Number(String(month ?? '').split('-')[1]) - 1] ?? '?';

/** Ramka: liczba godzin na górze, okres pod nią. */
const cellHtml = (cls, hours, period, title) =>
    `<span class="tpq-cell ${cls}" title="${title}"><b>${hours}h</b><i>${period}</i></span>`;

/** „1.5h” — dzisiejsze godziny na tytanie z bieżącej mapy; poza mapą tytana (albo gdy dane są z innego dnia) nic. */
function todayHtml(entry, titan) {
    if (!titan) return '';
    const hours = Number(entry?.today?.byTitan?.find(t => t.name === titan)?.hours) || 0;
    const title = `Godziny na tytanie ${titan} — dziś: ${Math.round(hours * 10) / 10}h`;
    return cellHtml('today', Math.round(hours * 10) / 10, 'dziś', title);
}

/** Ramki po prawej: godziny w poprzednim i tym miesiącu (na mapie tytana także dziś); po najechaniu — pełny opis. */
function hoursHtml(p) {
    if (!hoursByAccount) return '';
    const entry = hoursByAccount.get(Number(p.account));
    const current = fullHours(entry?.current?.hours);
    const previous = fullHours(entry?.previous?.hours);
    const currentTitle = `Godziny na tytanach — ${monthLabel(months.current)} (ten miesiąc): ${current}h`;
    const previousTitle = `Godziny na tytanach — ${monthLabel(months.previous)} (poprzedni miesiąc): ${previous}h`;
    return '<div class="tpq-hours">'
        + cellHtml(levelClass(previous), previous, monthShort(months.previous), previousTitle)
        + cellHtml(levelClass(current), current, monthShort(months.current), currentTitle)
        + `${todayHtml(entry, todayTitan())}</div>`;
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
