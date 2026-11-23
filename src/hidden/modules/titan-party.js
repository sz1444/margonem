import { createQuickParty } from '../../modules/party-quick-invite.js';
import { MAP_CONFIG } from '../../modules/tytan-helper.js';
import { injectStyle } from '../../core/dom.js';
import { showTooltip, hideTooltip } from '../../core/ui.js';
import { gmRequest } from '../../core/env.js';
import { getMapName } from '../../core/game.js';
import { BASE_URL, getSession } from '../auth.js';

// Serwer trzyma odpowiedź godzinę (api/hidden/titan-hour.js) — częściej nie ma sensu pytać.
const REFRESH_INTERVAL = 60 * 60 * 1000;
// Ostatnia odpowiedź w GM storage (wspólna dla kart): po odświeżeniu gry godziny są od razu.
const CACHE_KEY = 'hidden_titan_hours_v2';
const STALE_CHECK_INTERVAL = 5 * 60 * 1000;

const CSS = `
    /* Grupy profesji bez ramki — samo lekkie tło; wiersze graczy bez zmian. */
    #tpqPanel .pqi-grid { gap: 4px; }
    #tpqPanel .pqi-grid .pqi-section {
        border: none; border-radius: 3px; background: rgba(0,0,0,0.25); padding: 2px 3px 3px;
    }
    #tpqPanel .pqi-grid .pqi-section-head { border-bottom: none; margin-bottom: 1px; padding: 0 3px; }
    #tpqPanel .pqi-grid .pqi-section-head .pqi-title { color: rgba(255,255,255,0.7); font-weight: 600; }
    #tpqPanel .pqi-grid .pqi-section-head .pqi-count { color: rgba(255,255,255,0.5); }
    /* Bez 30h w żadnym z dwóch miesięcy — lekko wyszarzone; z duchem (AFK) — mocno. Zaznaczony wiersz zawsze w pełnych kolorach. */
    #tpqPanel .pqi-row.tpq-low:not(.checked) { opacity: 0.7; filter: grayscale(0.6); }
    #tpqPanel .pqi-row.is-afk:not(.checked) { opacity: 0.35; filter: grayscale(1); }
    #tpqPanel .pqi-row.is-afk .pqi-nick { opacity: 1; }
    /* Godziny po prawej: każdy okres w ramce, sama liczba; okres (miesiąc / dziś) w tooltipie po najechaniu. */
    #tpqPanel .tpq-hours { display: flex; align-items: stretch; gap: 1px; flex-shrink: 0; }
    #tpqPanel .tpq-cell {
        display: flex; align-items: center; justify-content: center; width: 28px; height: 16px; padding: 0; box-sizing: border-box;
        border: 1px solid rgba(255,255,255,0.18); border-radius: 2px; background: rgba(0,0,0,0.3);
        color: #e06c6c; white-space: nowrap;
    }
    #tpqPanel .tpq-cell b { font-size: 11px; line-height: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
    #tpqPanel .tpq-cell.high { color: #5fd88a; }
    #tpqPanel .tpq-cell.mid { color: #e8d25a; }
    #tpqPanel .tpq-cell.today { color: #7fc8f0; }
    /* Wiersze jak w liście „Gracze na mapie” z gry: wyższe, z przerwą pod każdym. */
    #tpqPanel .pqi-row { min-height: 20px; padding: 1px 3px; margin: 0 0 2px; }
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

/** Czy gracz ma 30h+ w poprzednim albo w tym miesiącu. */
function isRegular(p) {
    const entry = hoursByAccount?.get(Number(p.account));
    return fullHours(entry?.current?.hours) >= 30 || fullHours(entry?.previous?.hours) >= 30;
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

/** Ramka z liczbą godzin; opis okresu trafia do tooltipa (data-tip, HTML). */
const escapeAttr = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const tipHtml = (period, text) =>
    `<div style="font-size: 11px; color: #ddd; white-space: nowrap;"><b style="color: #fff;">${period}</b><br>${text}</div>`;
const cellHtml = (cls, hours, tip) =>
    `<span class="tpq-cell ${cls}" data-tip="${escapeAttr(tip)}"><b>${hours}h</b></span>`;

/** Tooltip gry nad ramkami godzin — delegacja, bo wiersze są przerysowywane. */
function setupHoursTooltip() {
    let current = null;
    document.addEventListener('mouseover', e => {
        const cell = e.target.closest?.('#tpqPanel .tpq-cell[data-tip]') ?? null;
        if (cell === current) return;
        current = cell;
        if (cell) showTooltip(cell, cell.dataset.tip, { minWidth: 0, maxWidth: 420, padding: '6px' });
        else hideTooltip();
    });
}

/** „1.5h” — dzisiejsze godziny na tytanie z bieżącej mapy; poza mapą tytana (albo gdy dane są z innego dnia) nic. */
function todayHtml(entry, titan) {
    if (!titan) return '';
    const hours = Number(entry?.today?.byTitan?.find(t => t.name === titan)?.hours) || 0;
    const rounded = Math.round(hours * 10) / 10;
    return cellHtml('today', rounded, tipHtml('Dziś', `Godziny na tytanie ${titan}: ${rounded}h`));
}

/** Ramki po prawej: godziny w poprzednim i tym miesiącu (na mapie tytana także dziś); po najechaniu — pełny opis. */
function hoursHtml(p) {
    if (!hoursByAccount) return '';
    const entry = hoursByAccount.get(Number(p.account));
    const current = fullHours(entry?.current?.hours);
    const previous = fullHours(entry?.previous?.hours);
    const currentTip = tipHtml(`${monthLabel(months.current)} (ten miesiąc)`, `Godziny na tytanach: ${current}h`);
    const previousTip = tipHtml(`${monthLabel(months.previous)} (poprzedni miesiąc)`, `Godziny na tytanach: ${previous}h`);
    return '<div class="tpq-hours">'
        + cellHtml(levelClass(previous), previous, previousTip)
        + cellHtml(levelClass(current), current, currentTip)
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
    allowKick: true,
    extension: {
        setup(rerender) {
            injectStyle(CSS);
            setupHoursTooltip();
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
        rowClass: p => (hoursByAccount && !isRegular(p) ? 'tpq-low' : ''),
        // Najwięcej godzin (ten + poprzedni miesiąc) na górze.
        comparePlayers: (a, b) => totalHours(b) - totalHours(a),
    },
});
