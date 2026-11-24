import { injectStyle, isolateWheel } from '../core/dom.js';
import { win } from '../core/env.js';
import { loadJSON, saveJSON, loadFlag, saveFlag } from '../core/storage.js';
import {
    getHeroId, getClanId, getWorldName, getMapPlayers, getPartyMembers, inviteToParty,
    isInParty, isPartyLeader, kickFromParty, leaveParty, givePartyLead,
} from '../core/game.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton, showTooltip, hideTooltip, tooltipList } from '../core/ui.js';

// Grupa ma 10 miejsc: bohater + 9 zaproszonych.
const MAX_SELECTED = 9;
const MIN_WIDTH = 242;

// Od jakiej szerokości okna 2, 3 i 6 kolumn profesji (6 profesji → 1, 2, 3 albo 6).
const COLUMN_BREAKPOINTS = [300, 450, 720];

/** Ile kolumn profesji przy danej szerokości okna. */
function columnsForWidth(width, [two, three, six]) {
    if (width < two) return 1;
    if (width < three) return 2;
    if (width < six) return 3;
    return 6;
}

// Kolumny tabeli, w tej kolejności.
const PROFS = [
    { code: 'w', name: 'Wojownicy' },
    { code: 'p', name: 'Paladyni' },
    { code: 'b', name: 'Tancerze' },
    { code: 'h', name: 'Łowcy' },
    { code: 'm', name: 'Magowie' },
    { code: 't', name: 'Tropiciele' },
];

const css = panelId => `
    /* Wygląd 1:1 jak kolumny klanów w Online List (.clan-columns / .clan-column / .clan-cell). */
    #${panelId} .pqi-grid { display: grid; grid-template-columns: repeat(var(--pqi-cols, 2), minmax(0, 1fr)); gap: 2px; box-sizing: border-box; width: 100%; }
    #${panelId} .pqi-section {
        display: flex; flex-direction: column; gap: 0; min-width: 0;
        padding: 1px 2px; box-sizing: border-box; border-radius: 2px;
        background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.22);
    }
    #${panelId} .pqi-section-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 1px; padding: 0 2px; font-size: 10px; line-height: 14px; font-weight: bold; }
    #${panelId} .pqi-section-head .pqi-title { color: #fff; font-weight: 300; }
    #${panelId} .pqi-section-head .pqi-count { color: #eaeaea; }
    .popup-menu-layer { z-index: 1000 !important; }
    #${panelId} .pqi-row { display: flex; justify-content: space-between; align-items: center; cursor: pointer; width: 100%; box-sizing: border-box; padding: 0 2px; margin: 0; }
    #${panelId} .pqi-row:hover { filter: brightness(1.2); }
    /* Zaznaczenie zmienia tylko tło — bez dodatkowych elementów i ramek, więc układ wiersza zostaje ten sam. */
    /* Jaskrawa zieleń: tło, ramka (inset — nie zmienia rozmiaru) i lekka poświata. */
    #${panelId} .pqi-row.checked {
        background: rgba(57,255,120,0.28); border-color: #39ff78;
        box-shadow: inset 0 0 0 1px #39ff78, inset 0 0 6px rgba(57,255,120,0.7);
    }
    #${panelId} .pqi-row-inner { display: flex; justify-content: space-between; align-items: center; width: 100%; overflow: hidden; gap: 3px; }
    #${panelId} .pqi-nick { font-weight: 600; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; flex: 1; margin-right: 4px; }
    /* Poziom w nawiasie zaraz za nickiem, przygaszony. */
    #${panelId} .pqi-lvl { color: rgba(255,255,255,0.55); font-size: 10px; font-weight: 400; white-space: nowrap; }
    /* Ikonki jak w oknie grupy gry: zawsze widoczne, delikatne, bez ramek; kolor dopiero po najechaniu. */
    #${panelId} .pqi-icons { display: flex; align-items: center; gap: 4px; flex-shrink: 0; margin-right: 2px; }
    #${panelId} .pqi-add {
        flex-shrink: 0; width: 12px; height: 12px; display: flex; align-items: center; justify-content: center;
        color: rgba(255,255,255,0.4); font-size: 11px; line-height: 1; cursor: pointer; transition: color 0.1s;
    }
    #${panelId} .pqi-add:hover { color: #fff; }
    #${panelId} .pqi-add.pqi-kick:hover { color: #fc3e40; }
    #${panelId} .pqi-add.pqi-lead { color: rgba(232,210,90,0.5); }
    #${panelId} .pqi-add.pqi-lead:hover { color: #e8d25a; }
    #${panelId} .pqi-add.pqi-swap:hover, #${panelId} .pqi-add.pqi-swap.target { color: #7fc8f0; }
    /* Podmiana: wybrany na czerwono, przy graczach z drugiej strony „⇄” podświetlone. */
    #${panelId} .pqi-row.swap-src { box-shadow: inset 0 0 0 1px #fc3e40; background: rgba(252,62,64,0.25); }
    #${panelId} .pqi-row.swap-src .pqi-add.pqi-swap { color: #fc3e40; }
    /* Ikonki z gry (gameIcons — klasa pqi-sprites): znak zastępuje wycinek sprite'a party-icons.png. */
    #${panelId}.pqi-sprites .pqi-add { font-size: 0; }
    #${panelId}.pqi-sprites .pqi-add::before {
        content: ''; display: block; background-image: url("${PARTY_ICONS_URL}"); background-repeat: no-repeat;
        opacity: 0.75; transition: opacity 0.1s, filter 0.1s;
    }
    #${panelId}.pqi-sprites .pqi-add:hover::before { opacity: 1; filter: brightness(1.4); }
    #${panelId}.pqi-sprites .pqi-kick::before { width: 14px; height: 14px; background-position: 0 0; }
    #${panelId}.pqi-sprites .pqi-kick:hover::before { filter: brightness(1.2) sepia(1) saturate(5) hue-rotate(-40deg); }
    #${panelId}.pqi-sprites .pqi-lead::before { width: 14px; height: 14px; background-position: -14px 0; }
    #${panelId}.pqi-sprites .pqi-invite::before { width: 11px; height: 10px; background-position: -28px 0; }
    /* Strzałki w arkuszu gry są beżowe — szare jak reszta; podświetlone na niebiesko, wybrany na czerwono. */
    #${panelId}.pqi-sprites .pqi-swap::before { width: 13px; height: 12px; background-position: -39px 0; filter: grayscale(1) brightness(1.1); }
    #${panelId}.pqi-sprites .pqi-swap.target::before, #${panelId}.pqi-sprites .pqi-swap:hover::before {
        opacity: 1; filter: grayscale(1) brightness(0.9) sepia(1) saturate(4) hue-rotate(170deg);
    }
    /* Status przy nicku: miecze (walka, na czerwono) i duch (AFK). */
    #${panelId}.pqi-sprites .pqi-status { font-size: 0; vertical-align: middle; }
    #${panelId}.pqi-sprites .pqi-status::before {
        content: ''; display: inline-block; vertical-align: middle; background: url("${PARTY_ICONS_URL}") no-repeat;
    }
    #${panelId}.pqi-sprites .pqi-status.battle::before {
        width: 15px; height: 12px; background-position: -52px 0; filter: sepia(1) saturate(6) hue-rotate(-50deg) brightness(0.9);
    }
    #${panelId}.pqi-sprites .pqi-status.ghost::before { width: 12px; height: 14px; background-position: -67px 0; }
    #${panelId}.pqi-sprites .pqi-row.swap-src .pqi-swap::before {
        opacity: 1; filter: grayscale(1) brightness(0.9) sepia(1) saturate(6) hue-rotate(-40deg);
    }
    #${panelId} .pqi-status { font-size: 10px; flex-shrink: 0; }
    #${panelId} .pqi-status.battle { color: #fc3e40; }
    #${panelId} .pqi-row.is-afk .pqi-nick { opacity: 0.55; font-style: italic; }
    /* Pusta profesja: sam przygaszony nagłówek, bez wiersza z kreską. */
    #${panelId} .pqi-section.empty { opacity: 0.45; }
    #${panelId} .pqi-section.empty .pqi-section-head { border-bottom: none; margin-bottom: 0; }
    /* Stopka: dwa przyciski gry, każdy na pół szerokości. */
    #${panelId} .pqi-actions { padding: 2px 2px 0; margin-top: 2px; }
    /* Skład grupy wg profesji (partyProfs) — jak na dole okna grupy gry; po najechaniu nicki. */
    #${panelId} .pqi-profs { display: none; justify-content: center; gap: 10px; padding: 1px 0 3px; font-size: 11px; color: #ccc; }
    #${panelId}.pqi-in-party .pqi-profs { display: flex; }
    #${panelId} .pqi-prof { cursor: default; }
    #${panelId} .pqi-prof b { color: #fff; font-weight: 700; }
    #${panelId} .pqi-prof.empty { opacity: 0.4; }
    #${panelId} .pqi-btns { display: flex; gap: 2px; width: 100%; }
    #${panelId} .pqi-btn { flex: 1 1 0; width: auto !important; min-width: 0; margin: 0; pointer-events: auto; cursor: pointer; }
    #${panelId} .pqi-btn { display: flex !important; align-items: center; justify-content: center; }
    #${panelId} .pqi-btn .label { width: 100%; text-align: center; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #${panelId} .pqi-btn:hover { filter: brightness(1.2); }
    /* „Zaznacz grupę” — mały przycisk w prawym górnym rogu, obok zwijania. */
    #${panelId} .pqi-select-party {
        position: absolute; top: 5px; right: 30px; z-index: 2; cursor: pointer;
        width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;
        color: #2ecc71; font-size: 11px; font-weight: 700; line-height: 1;
        border: 1px solid rgba(255,255,255,0.3); border-radius: 2px; background: rgba(0,0,0,0.5);
    }
    #${panelId} .pqi-select-party:hover { color: #fff; border-color: #fff; background: rgba(46,204,113,0.35); }
    /* Uzbrojone „po walce”: przycisk gry przefarbowany na czerwono. */
    #${panelId} .pqi-btn.on { filter: hue-rotate(-110deg) saturate(1.6); }
`;

const PANEL_HTML = `
    <div class="header-label-positioner" id="pqiHeader">
        <div class="draggable-window-element ui-draggable-handle"></div>
        <div class="header-label">
            <div class="left-decor"></div>
            <div class="right-decor"></div>
            <div class="text" id="pqiHeaderText"></div>
        </div>
    </div>
    <div class="content" id="pqiContent">
        <div class="inner-content">
            <div class="">
                <div class="player-list" id="pqiList" style="padding: 2px;"></div>
                <div class="pqi-actions">
                    <div class="pqi-profs" id="pqiProfs"></div>
                    <div class="pqi-btns">
                        <div class="button green small pqi-btn" id="pqiCreate" title="Wyrzuć niezaznaczonych z grupy i zaproś zaznaczonych teraz"><div class="background"></div><div class="label">Zrób grupę</div></div>
                        <div class="button green small pqi-btn" id="pqiArm" title="Wyrzuć niezaznaczonych z grupy i zaproś zaznaczonych po najbliższej walce"><div class="background"></div><div class="label">Zrób grupę po walce</div></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="c-window__bottom-bar">
        <div class="interface-element-bottom-bar-background-stretch"></div>
    </div>
    <div class="pqi-select-party" id="pqiSelectParty" title="Zaznacz / odznacz graczy z obecnej grupy">✓</div>
    <div class="close-button-corner-decor">
        <button type="button" class="close-button" id="pqiToggle"><div class="ie-icon ie-icon-close"></div></button>
    </div>
    <div class="border-image"></div>
    <div class="transparent-window-buttons-menu">
        <div class="manage-hamburger-button"><div class="ie-icon ie-icon-menu"></div></div>
        <div class="increase-opacity" id="pqiOpacityBtn" title="Zmień przezroczystość"></div>
    </div>
`;

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// Relacje z silnika (SocietyData.RELATION) — w starym interfejsie jako tekst.
const RELATION_FRIEND = [2, 'fr'];
const RELATION_CLAN = [4, 'cl'];
const RELATION_CLAN_ALLY = [5, 'cl-fr'];

// Kolejność na liście: klan, sojusz, przyjaciele, reszta obecnej grupy.
const KIND_ORDER = ['clan', 'ally', 'friend', 'group'];

// Domyślne kolory gry (HandHeldMiniMapData) — te same co w „Kto tu jest”; klucz = rodzaj na minimapie.
// Członek obecnej grupy ma w grze kolor grupy niezależnie od relacji.
const KIND_COLORS = {
    clan: { key: 'cl', color: '#4cfa4f' },
    ally: { key: 'cl-fr', color: '#ffba37' },
    friend: { key: 'fr', color: '#46a31d' },
    group: { key: 'group', color: '#b554ff' },
};

/** Kolor relacji z ustawień minimapy gracza, a gdy się nie da — domyślny z gry. */
function kindColor(kind) {
    const { key, color } = KIND_COLORS[kind];
    try {
        const custom = win.Engine?.miniMapController?.handHeldMiniMapController?.getColorByKind?.(key);
        if (typeof custom === 'string' && custom.startsWith('#')) return custom;
    } catch {}
    return color;
}

/** 'clan' / 'ally' / 'friend' / null (pozostałych nie pokazujemy). */
function playerKind(p, myClanId) {
    if (RELATION_CLAN.includes(p.relation) || (myClanId && p.clanId === myClanId)) return 'clan';
    if (RELATION_CLAN_ALLY.includes(p.relation)) return 'ally';
    if (RELATION_FRIEND.includes(p.relation)) return 'friend';
    return null;
}

/**
 * PPM na graczu: „Pokaż ekwipunek” i „Zaproś do grupy” (albo „Wyrzuć z grupy”) — te same akcje, co w menu gracza w grze.
 */
function openPlayerMenu(p, e, { canKick = false, canLead = false } = {}) {
    const engine = win.Engine;
    if (!engine?.interface?.showPopupMenu) return;
    const t = (key, fallback, category) => (typeof win._t === 'function' ? win._t(key, null, category) : fallback);

    const items = [];
    if (engine.showEqManager) {
        items.push([t('show_eq', 'Pokaż ekwipunek'), () => engine.showEqManager.update({
            id: p.id,
            account: p.account,
            lvl: p.lvl,
            nick: p.nick,
            prof: p.prof,
            icon: '',
            world: getWorldName(),
        })]);
    }
    if (canLead) items.push(['Przekaż dowodzenie', () => givePartyLead(p.id)]);
    if (canKick) items.push(['Wyrzuć z grupy', () => kickFromParty(p.id)]);
    else items.push([t('team_invite', 'Zaproś do grupy', 'menu'), () => inviteToParty(p.id)]);
    engine.interface.showPopupMenu(items, e, { header: escapeHtml(p.nick) });
}

// Ikonki wycięte z arkusza gry (/img/gui/buttony.png) i trzymane u nas, obok siebie: ✕, ♛, +, podmień, walka, duch.
const PARTY_ICONS_URL = 'https://margonem.vercel.app/assets/party-icons.png';

/**
 * Quick Party jako dodatek. Kopie (np. w ukrytych dodatkach) podają własne id, panelId i storagePrefix,
 * żeby nie kolidować z oryginałem; szersze wiersze → większe columnBreakpoints. extension: { setup(rerender), rowExtraHtml(p), rowClass(p), comparePlayers(a, b) } —
 * dodatkowa treść za poziomem i własna kolejność (przy remisie: rodzaj relacji, nick).
 * allowKick: dowódca grupy widzi przy jej członkach „−” (wyrzuć) zamiast „+”.
 * partyProfs: pod listą skład grupy wg profesji (0b 1w …), po najechaniu na profesję — nicki.
 * gameIcons: ikonki z arkusza gry zamiast znaków (✕ ♛ ⇄ +).
 * allowLead: dowódca widzi „♛” (przekaż dowodzenie) przy członkach grupy i w PPM.
 * allowSwap: dowódca klika „⇄” przy graczu, potem „⇄” przy graczu z drugiej strony (grupa ↔ spoza grupy) — członek wylatuje, ten spoza grupy dostaje zaproszenie (Esc = anuluj).
 */
export function createQuickParty({
    id = 'party-quick-invite',
    name = 'Quick Party',
    description = 'Szybkie tworzenie grupy z listy graczy na mapie.',
    title = 'Quick Party',
    panelId = 'pqiPanel',
    storagePrefix = 'pqi',
    columnBreakpoints = COLUMN_BREAKPOINTS,
    allowKick = false,
    allowSwap = false,
    allowLead = false,
    gameIcons = false,
    partyProfs = false,
    extension = {},
} = {}) {
    const POS_KEY = `${storagePrefix}_widget_pos`;
    const OPACITY_KEY = `${storagePrefix}_widget_opacity`;
    const COLLAPSED_KEY = `${storagePrefix}_widget_collapsed`;
    const WIDTH_KEY = `${storagePrefix}_widget_width`;

    return {
        id,
        name,
        description,

        run() {
            injectStyle(css(panelId));

            const savedPos = loadJSON(POS_KEY, { top: '200px', left: '20px' });
            let isCollapsed = loadFlag(COLLAPSED_KEY);
            // Jednorazowo: po najbliższej walce tworzy nową grupę i się wyłącza.
            let armed = false;
            // Zaznaczeni gracze: id → gracz (tylko obecni na mapie).
            const selected = new Map();
            let lastSignature = '';

            const panel = document.createElement('div');
            panel.id = panelId;
            panel.className = 'c-window border-window ui-draggable transparent window-on-peak';
            panel.style.cssText = `
                position: absolute !important;
                z-index: 100 !important;
                left: ${savedPos.left};
                top: ${savedPos.top};
                width: ${loadJSON(WIDTH_KEY, 300)}px;
                min-width: ${MIN_WIDTH}px !important;
                resize: horizontal;
                overflow: hidden;
            `;
            panel.innerHTML = PANEL_HTML;
            document.body.appendChild(panel);
            if (gameIcons) panel.classList.add('pqi-sprites');

            // Szerokość okna (przeciągany róg) → liczba kolumn profesji; zapamiętywana.
            new ResizeObserver(() => {
                const width = panel.offsetWidth;
                panel.style.setProperty('--pqi-cols', columnsForWidth(width, columnBreakpoints));
                if (width >= MIN_WIDTH) saveJSON(WIDTH_KEY, width);
            }).observe(panel);

            const listEl = panel.querySelector('#pqiList');
            const contentEl = panel.querySelector('#pqiContent');
            const headerText = panel.querySelector('#pqiHeaderText');
            const iconEl = panel.querySelector('#pqiToggle .ie-icon');
            const armBtn = panel.querySelector('#pqiArm');

            isolateWheel(listEl);
            setupOpacityButton(panel, panel.querySelector('#pqiOpacityBtn'), OPACITY_KEY, 3);
            makeDraggable(panel, { handle: panel.querySelector('#pqiHeader'), storageKey: POS_KEY, threshold: 0 });

            iconEl.style.transition = 'transform 0.3s ease';
            function applyCollapseState() {
                contentEl.style.display = isCollapsed ? 'none' : 'block';
                iconEl.style.transform = isCollapsed ? 'rotate(45deg)' : 'rotate(0deg)';
            }
            applyCollapseState();

            panel.querySelector('#pqiToggle').onclick = e => {
                e.stopPropagation();
                isCollapsed = !isCollapsed;
                saveFlag(COLLAPSED_KEY, isCollapsed);
                applyCollapseState();
            };

            /** Przyjaciele, klanowicze i sojusznicy z mapy. Kto z niej zszedł, wypada też z zaznaczonych. */
            function collectPlayers() {
                const myId = getHeroId();
                const myClanId = getClanId();
                const partyIds = new Set(getPartyMembers().map(m => m.id));
                const players = [];
                for (const p of getMapPlayers()) {
                    if (p.id === myId) continue;
                    const inParty = partyIds.has(p.id);
                    const kind = playerKind(p, myClanId) || (inParty && 'group');
                    if (kind) players.push({ ...p, kind, inParty });
                }
                for (const id of selected.keys()) if (!players.some(p => p.id === id)) selected.delete(id);

                return players.sort((a, b) =>
                    (extension.comparePlayers?.(a, b) || 0)
                    || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.nick.localeCompare(b.nick));
            }

            /** Czy z tego wiersza można wyrzucić gracza: jest w grupie, a my jesteśmy jej dowódcą. */
            const canKick = p => allowKick && p.inParty && isPartyLeader();
            // Podmiana: wybrany gracz { id, inParty } albo null.
            let swapSrc = null;
            const canSwap = () => allowSwap && isPartyLeader();

            const SWAP_ICON = (tip, cls = '') => `<div class="pqi-add pqi-swap${cls}" title="${tip}">⇄</div>`;

            /** Ikonki wiersza: [⇄] [✕ ♛] dla członka grupy (gdy dowodzimy), [⇄] [+] dla reszty. */
            function actionHtml(p) {
                // W trakcie podmiany: tylko „⇄” — na wybranym (anuluj) i na graczach z drugiej strony.
                if (swapSrc) {
                    if (swapSrc.id === p.id) return SWAP_ICON('Anuluj podmianę (Esc)');
                    return swapSrc.inParty !== !!p.inParty ? SWAP_ICON('Podmień', ' target') : '';
                }
                const swap = canSwap() ? SWAP_ICON(p.inParty ? 'Podmień na gracza spoza grupy' : 'Podmień za członka grupy') : '';
                if (canKick(p)) {
                    return `${swap}<div class="pqi-add pqi-kick" title="Wyrzuć z grupy">✕</div>`
                        + (allowLead ? '<div class="pqi-add pqi-lead" title="Przekaż dowodzenie">♛</div>' : '');
                }
                return `${swap}<div class="pqi-add pqi-invite" title="Zaproś do grupy">+</div>`;
            }

            const rowHtml = p => {
                const color = kindColor(p.inParty ? 'group' : p.kind);
                const cls = `${selected.has(p.id) ? ' checked' : ''}${swapSrc?.id === p.id ? ' swap-src' : ''}${p.afk ? ' is-afk' : ''}`
                    + `${extension.rowClass?.(p) ? ` ${extension.rowClass(p)}` : ''}`;
                return `
                <div class="one-other tw-list-item pqi-row${cls}" data-id="${p.id}" data-party="${p.inParty ? 1 : 0}">
                    <div class="pqi-row-inner">
                        <div class="pqi-nick" style="color: ${color};">${escapeHtml(p.nick)}${p.lvl ? ` <span class="pqi-lvl">(${p.lvl}${p.prof ?? ''})</span>` : ''}${p.afk ? ' <span class="pqi-status ghost" title="AFK (duch)">👻</span>' : ''}${p.inBattle ? ' <span class="pqi-status battle" title="W walce">⚔</span>' : ''}</div>
                        <div class="pqi-icons">${actionHtml(p)}</div>
                        ${extension.rowExtraHtml?.(p) ?? ''}
                    </div>
                </div>
            `;
            };

            // Kolejność jak w oknie grupy gry.
            const PARTY_PROF_ORDER = ['b', 'w', 'p', 'm', 't', 'h'];
            // prof → nicki członków grupy (z nami), do tooltipa.
            let partyByProf = {};

            /** Członkowie grupy z profesją: z silnika, a gdy jej nie podaje — z listy graczy na mapie / bohatera. */
            function partyComposition(players) {
                const myId = getHeroId();
                const heroProf = win.Engine?.hero?.d?.prof ?? win.hero?.prof ?? null;
                return getPartyMembers().map(m => ({
                    nick: m.nick,
                    prof: m.prof || players.find(p => p.id === m.id)?.prof || (m.id === myId ? heroProf : null),
                }));
            }

            function renderPartyProfs(players) {
                const members = isInParty() ? partyComposition(players) : [];
                panel.classList.toggle('pqi-in-party', members.length > 0);
                partyByProf = {};
                for (const code of PARTY_PROF_ORDER) partyByProf[code] = members.filter(m => m.prof === code).map(m => m.nick);
                panel.querySelector('#pqiProfs').innerHTML = PARTY_PROF_ORDER.map(code => {
                    const count = partyByProf[code].length;
                    return `<span class="pqi-prof${count ? '' : ' empty'}" data-prof="${code}"><b>${count}${code}</b></span>`;
                }).join('');
            }

            if (partyProfs) {
                // Delegacja — liczniki są przerysowywane.
                let tipFor = null;
                panel.querySelector('#pqiProfs').addEventListener('mouseover', e => {
                    const el = e.target.closest('.pqi-prof');
                    if (!el || el === tipFor) return;
                    tipFor = el;
                    const code = el.dataset.prof;
                    const name = PROFS.find(p => p.code === code)?.name ?? code;
                    const rows = (partyByProf[code] ?? []).map(nick => ({ left: escapeHtml(nick) }));
                    showTooltip(el, `<div style="color: #fff; font-size: 11px; font-weight: 600; padding: 0 2px 3px;">${name}</div>`
                        + tooltipList(rows, 'Brak w grupie'), { minWidth: 120, maxWidth: 220 });
                });
                panel.querySelector('#pqiProfs').addEventListener('mouseleave', () => {
                    tipFor = null;
                    hideTooltip();
                });
            }

            function render(force = false) {
                const players = collectPlayers();
                // Wybrany do podmiany zniknął (z mapy / z grupy / zmienił stronę) albo straciliśmy dowódcę — anuluj.
                if (swapSrc && (!canSwap() || !players.some(p => p.id === swapSrc.id && p.inParty === swapSrc.inParty))) swapSrc = null;
                const partyKey = partyProfs ? getPartyMembers().map(m => `${m.id}${m.prof ?? ''}`).join(',') : '';
                const signature = `${(allowKick || allowSwap) && isPartyLeader()}#${swapSrc?.id}#${partyKey}#`
                    + players.map(p => `${p.id}:${selected.has(p.id)}:${p.afk}:${p.inBattle}:${p.inParty}`).join('|');
                if (!force && signature === lastSignature) return;
                lastSignature = signature;

                headerText.textContent = `${title} (${selected.size}/${MAX_SELECTED})`;
                if (partyProfs) renderPartyProfs(players);

                // Nieznana profesja ląduje w pierwszej kolumnie, żeby nikt nie zniknął.
                const columns = PROFS.map(prof => players.filter(p => p.prof === prof.code));
                columns[0].push(...players.filter(p => !PROFS.some(x => x.code === p.prof)));

                listEl.innerHTML = `<div class="pqi-grid">${PROFS.map((prof, i) => `
                    <div class="pqi-section${columns[i].length ? '' : ' empty'}">
                        <div class="pqi-section-head"><span class="pqi-title">${prof.name}</span> <span class="pqi-count">${columns[i].length}</span></div>
                        ${columns[i].map(rowHtml).join('')}
                    </div>
                `).join('')}</div>`;
            }

            function toggleSelected(id) {
                if (selected.has(id)) {
                    selected.delete(id);
                } else {
                    if (selected.size >= MAX_SELECTED) return;
                    const p = collectPlayers().find(x => x.id === id);
                    if (p) selected.set(id, p);
                }
                render(true);
            }

            listEl.addEventListener('click', e => {
                const row = e.target.closest('.pqi-row');
                if (!row) return;
                e.stopPropagation();

                if (e.target.closest('.pqi-swap')) return onSwapClick(+row.dataset.id, row.dataset.party === '1');

                if (e.target.closest('.pqi-lead')) return givePartyLead(+row.dataset.id);
                // „✕” = wyrzuć tę osobę z grupy (tylko dowódca), bez zaznaczania.
                if (e.target.closest('.pqi-kick')) return kickFromParty(+row.dataset.id);
                // „+” = zaproś tylko tę osobę do obecnej grupy, bez zaznaczania.
                const addBtn = e.target.closest('.pqi-add');
                if (addBtn) return inviteToParty(+row.dataset.id);
                toggleSelected(+row.dataset.id);
            });

            listEl.addEventListener('contextmenu', e => {
                const row = e.target.closest('.pqi-row');
                if (!row) return;
                e.preventDefault();
                e.stopPropagation();
                const p = collectPlayers().find(x => x.id === +row.dataset.id);
                if (p) openPlayerMenu(p, e, { canKick: canKick(p), canLead: allowLead && canKick(p) });
            });

            /** Pierwszy „⇄” wybiera gracza, drugi (po drugiej stronie) podmienia, ponowny na wybranym — anuluje. */
            function onSwapClick(id, inParty) {
                if (!swapSrc) swapSrc = { id, inParty };
                else if (swapSrc.id === id) swapSrc = null;
                else if (swapSrc.inParty !== inParty) {
                    if (swapSrc.inParty) swapPlayers(swapSrc.id, id);
                    else swapPlayers(id, swapSrc.id);
                    swapSrc = null;
                }
                render(true);
            }

            if (allowSwap) {
                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape' && swapSrc) {
                        swapSrc = null;
                        render(true);
                    }
                });
            }

            /** Wyrzuca `outId`, a zaprasza `inId` dopiero, gdy tamten zniknie z grupy (przy pełnej grupie zaproszenie by przepadło). */
            function swapPlayers(outId, inId) {
                kickFromParty(outId);
                const started = Date.now();
                const waitAndInvite = () => {
                    const stillIn = getPartyMembers().some(m => m.id === outId);
                    if (!stillIn || Date.now() - started > 3000) return inviteToParty(inId);
                    setTimeout(waitAndInvite, 150);
                };
                setTimeout(waitAndInvite, 150);
            }

            /**
             * Składa grupę z zaznaczonych — z przycisku albo po walce. Lider nie rozwiązuje grupy: wyrzuca niezaznaczonych
             * i zaprasza tylko brakujących. Kto nie jest liderem, nie może wyrzucać — opuszcza grupę i zaprasza od nowa.
             */
            function newParty() {
                if (!selected.size) return;
                if (isInParty() && isPartyLeader()) {
                    const myId = getHeroId();
                    const memberIds = new Set(getPartyMembers().map(m => m.id));
                    for (const id of memberIds) if (id !== myId && !selected.has(id)) kickFromParty(id);
                    for (const m of selected.values()) if (!memberIds.has(m.id)) inviteToParty(m.id);
                    return;
                }
                if (isInParty()) leaveParty();
                for (const m of selected.values()) inviteToParty(m.id);
            }

            function setArmed(value) {
                armed = value;
                armBtn.classList.toggle('on', armed);
            }

            // „Zaznacz grupę” — przełącznik: dokłada członków obecnej grupy z mapy (do limitu),
            // a gdy wszyscy już są zaznaczeni, odznacza ich.
            panel.querySelector('#pqiSelectParty').addEventListener('click', e => {
                e.stopPropagation();
                const members = collectPlayers().filter(p => p.inParty);
                if (members.length && members.every(p => selected.has(p.id))) {
                    for (const p of members) selected.delete(p.id);
                } else {
                    for (const p of members) {
                        if (selected.size >= MAX_SELECTED) break;
                        selected.set(p.id, p);
                    }
                }
                render(true);
            });

            panel.querySelector('#pqiCreate').addEventListener('click', e => {
                e.stopPropagation();
                newParty();
            });

            armBtn.addEventListener('click', e => {
                e.stopPropagation();
                setArmed(!armed);
            });

            win.API?.addCallbackToEvent(win.Engine.apiData.SHOW_CLOSE_BATTLE, () => {
                if (!armed) return;
                setArmed(false);
                newParty();
            });

            setInterval(() => { if (!isCollapsed) render(); }, 500);

            render(true);
            extension.setup?.(() => render(true));
        },
    };
}

export default createQuickParty();
