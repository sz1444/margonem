import { injectStyle, isolateWheel } from '../core/dom.js';
import { win } from '../core/env.js';
import { loadJSON, saveJSON, loadFlag, saveFlag } from '../core/storage.js';
import {
    getHeroId, getClanId, getWorldName, getMapPlayers, getPartyMembers, inviteToParty,
    isInParty, isPartyLeader, kickFromParty, leaveParty,
} from '../core/game.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton } from '../core/ui.js';

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
    #${panelId} .pqi-add {
        flex-shrink: 0; width: 12px; height: 12px; margin-left: 2px;
        display: flex; align-items: center; justify-content: center;
        color: #eaeaea; font-size: 11px; font-weight: 700; line-height: 1;
        border: 1px solid rgba(255,255,255,0.3); border-radius: 2px; background: rgba(0,0,0,0.3);
    }
    /* „+” widoczny dopiero po najechaniu na wiersz — przy wielu graczach lista zostaje czysta. */
    #${panelId} .pqi-row:not(:hover) .pqi-add { opacity: 0; }
    #${panelId} .pqi-add:hover { color: #fff; border-color: #fff; background: rgba(255,255,255,0.15); }
    #${panelId} .pqi-add.pqi-kick { color: #fc3e40; }
    #${panelId} .pqi-add.pqi-kick:hover { color: #fff; border-color: #fc3e40; background: rgba(252,62,64,0.35); }
    /* Podmiana: dymek po najechaniu (w body — panel ucina overflow). Wiersze jak w panelu, klik w wiersz = podmiana. */
    #${panelId}Swap { position: fixed; display: none; z-index: 99999; min-width: 200px; max-width: 340px; }
    #${panelId}Swap .content { position: relative; z-index: 2; padding: 4px; }
    #${panelId}Swap .pqi-swap-head { color: #eaeaea; font-size: 11px; padding: 0 2px 3px; white-space: nowrap; }
    #${panelId}Swap .pqi-swap-head b { color: #fff; }
    #${panelId}Swap .pqi-swap-list { max-height: 260px; overflow-y: auto; }
    #${panelId}Swap .pqi-row { display: flex; align-items: center; width: 100%; box-sizing: border-box; min-height: 20px; padding: 1px 3px; margin: 0 0 2px; cursor: pointer; }
    #${panelId}Swap .pqi-row:hover { box-shadow: inset 0 0 0 1px #7fc8f0; background: rgba(127,200,240,0.2); }
    #${panelId}Swap .pqi-row-inner { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 3px; }
    #${panelId}Swap .pqi-nick { font-weight: 600; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; margin-right: 4px; }
    #${panelId}Swap .pqi-lvl { color: rgba(255,255,255,0.55); font-size: 10px; font-weight: 400; }
    #${panelId}Swap .pqi-status { font-size: 10px; }
    #${panelId}Swap .pqi-status.battle { color: #fc3e40; }
    #${panelId}Swap .pqi-swap-icon {
        flex-shrink: 0; width: 14px; height: 12px; display: flex; align-items: center; justify-content: center;
        color: #7fc8f0; font-size: 11px; font-weight: 700; line-height: 1;
        border: 1px solid rgba(255,255,255,0.3); border-radius: 2px; background: rgba(0,0,0,0.3);
    }
    #${panelId}Swap .pqi-row:hover .pqi-swap-icon { color: #fff; border-color: #7fc8f0; }
    #${panelId}Swap .pqi-swap-empty { color: #eaeaea; font-style: italic; font-size: 11px; padding: 2px; }
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
function openPlayerMenu(p, e, { canKick = false } = {}) {
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
    if (canKick) items.push(['Wyrzuć z grupy', () => kickFromParty(p.id)]);
    else items.push([t('team_invite', 'Zaproś do grupy', 'menu'), () => inviteToParty(p.id)]);
    engine.interface.showPopupMenu(items, e, { header: escapeHtml(p.nick) });
}

/**
 * Quick Party jako dodatek. Kopie (np. w ukrytych dodatkach) podają własne id, panelId i storagePrefix,
 * żeby nie kolidować z oryginałem; szersze wiersze → większe columnBreakpoints. extension: { setup(rerender), rowExtraHtml(p), rowClass(p), comparePlayers(a, b) } —
 * dodatkowa treść za poziomem i własna kolejność (przy remisie: rodzaj relacji, nick).
 * allowKick: dowódca grupy widzi przy jej członkach „−” (wyrzuć) zamiast „+”.
 * allowSwap: dowódca po najechaniu na gracza widzi dymek z podmianą: na członku grupy „Podmień na” (gracze spoza grupy),
 * na graczu spoza grupy „Podmień za” (członkowie grupy). Klik w wiersz: członek wylatuje, ten spoza grupy dostaje zaproszenie.
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
            /** Czy dla gracza da się pokazać podmianę: jesteśmy dowódcą, a grupa ma kogo wymienić. */
            const canSwap = p => allowSwap && !!p && isPartyLeader() && getPartyMembers().length > 1;

            const actionHtml = (p, inSwap) => {
                if (inSwap) return '<div class="pqi-swap-icon">⇄</div>';
                return canKick(p)
                    ? '<div class="pqi-add pqi-kick" title="Wyrzuć z grupy">−</div>'
                    : '<div class="pqi-add" title="Zaproś do grupy">+</div>';
            };

            /** Wiersz gracza — w panelu albo (inSwap) w dymku podmiany. */
            const rowHtml = (p, inSwap = false) => {
                const color = kindColor(p.inParty ? 'group' : p.kind);
                return `
                <div class="one-other tw-list-item pqi-row${!inSwap && selected.has(p.id) ? ' checked' : ''}${p.afk ? ' is-afk' : ''}${extension.rowClass?.(p) ? ` ${extension.rowClass(p)}` : ''}" data-id="${p.id}">
                    <div class="pqi-row-inner">
                        <div class="pqi-nick" style="color: ${color};">${escapeHtml(p.nick)}${p.lvl ? ` <span class="pqi-lvl">(${p.lvl}${p.prof ?? ''})</span>` : ''}${p.afk ? ' <span class="pqi-status" title="AFK (duch)">👻</span>' : ''}${p.inBattle ? ' <span class="pqi-status battle" title="W walce">⚔</span>' : ''}</div>
                        ${extension.rowExtraHtml?.(p) ?? ''}
                        ${actionHtml(p, inSwap)}
                    </div>
                </div>
            `;
            };

            function render(force = false) {
                const players = collectPlayers();
                // Gracz z dymka zszedł z mapy albo straciliśmy dowódcę — dymek znika.
                if (swapAnchor && !canSwap(players.find(p => p.id === swapAnchor))) hideSwap();
                const signature = `${(allowKick || allowSwap) && isPartyLeader()}#`
                    + players.map(p => `${p.id}:${selected.has(p.id)}:${p.afk}:${p.inBattle}:${p.inParty}`).join('|');
                if (!force && signature === lastSignature) return;
                lastSignature = signature;

                headerText.textContent = `${title} (${selected.size}/${MAX_SELECTED})`;

                // Nieznana profesja ląduje w pierwszej kolumnie, żeby nikt nie zniknął.
                const columns = PROFS.map(prof => players.filter(p => p.prof === prof.code));
                columns[0].push(...players.filter(p => !PROFS.some(x => x.code === p.prof)));

                listEl.innerHTML = `<div class="pqi-grid">${PROFS.map((prof, i) => `
                    <div class="pqi-section${columns[i].length ? '' : ' empty'}">
                        <div class="pqi-section-head"><span class="pqi-title">${prof.name}</span> <span class="pqi-count">${columns[i].length}</span></div>
                        ${columns[i].map(p => rowHtml(p)).join('')}
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

                // „−” = wyrzuć tę osobę z grupy (tylko dowódca), bez zaznaczania.
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
                if (p) openPlayerMenu(p, e, { canKick: canKick(p) });
            });

            // Dymek podmiany: gracz, nad którym go otwarto (swapAnchor), i timery opóźnionego pokazania / chowania.
            let swapEl = null;
            let swapAnchor = null;
            let swapShowTimer = null;
            let swapHideTimer = null;
            const SWAP_SHOW_DELAY = 300;
            const SWAP_HIDE_DELAY = 250;

            function getSwapEl() {
                if (swapEl) return swapEl;
                swapEl = document.createElement('div');
                swapEl.id = `${panelId}Swap`;
                swapEl.className = 'c-window border-window transparent';
                swapEl.innerHTML = '<div class="border-image"></div><div class="content"></div>';
                document.body.appendChild(swapEl);
                isolateWheel(swapEl);
                swapEl.addEventListener('mouseenter', () => clearTimeout(swapHideTimer));
                swapEl.addEventListener('mouseleave', scheduleHideSwap);
                swapEl.addEventListener('click', e => {
                    const row = e.target.closest('.pqi-row');
                    if (!row || !swapAnchor) return;
                    e.stopPropagation();
                    const other = +row.dataset.id;
                    // Wiersze w dymku są zawsze „drugą stroną”: członkowie grupy albo gracze spoza niej.
                    if (swapEl.dataset.mode === 'out') swapPlayers(swapAnchor, other);
                    else swapPlayers(other, swapAnchor);
                    hideSwap();
                });
                return swapEl;
            }

            function hideSwap() {
                clearTimeout(swapShowTimer);
                clearTimeout(swapHideTimer);
                swapAnchor = null;
                if (swapEl) swapEl.style.display = 'none';
            }

            function scheduleHideSwap() {
                clearTimeout(swapShowTimer);
                clearTimeout(swapHideTimer);
                swapHideTimer = setTimeout(hideSwap, SWAP_HIDE_DELAY);
            }

            /** Członkowie grupy (bez nas) — z pełnymi danymi, gdy są na mapie; inaczej sam nick. */
            function partyMembers(players) {
                const myId = getHeroId();
                return getPartyMembers().filter(m => m.id !== myId).map(m =>
                    players.find(p => p.id === m.id) ?? { id: m.id, nick: m.nick, kind: 'group', inParty: true });
            }

            /**
             * Na członku grupy (mode 'out'): „Podmień X na” — lista graczy spoza grupy.
             * Na graczu spoza grupy (mode 'in'): „Podmień X za” — lista członków grupy.
             */
            function showSwap(row, p, players) {
                swapAnchor = p.id;
                const el = getSwapEl();
                const mode = p.inParty ? 'out' : 'in';
                const others = mode === 'out' ? players.filter(x => !x.inParty) : partyMembers(players);
                el.dataset.mode = mode;
                el.querySelector('.content').innerHTML = `
                    <div class="pqi-swap-head">Podmień <b>${escapeHtml(p.nick)}</b> ${mode === 'out' ? 'na' : 'za'}:</div>
                    <div class="pqi-swap-list">${others.length
                        ? others.map(x => rowHtml(x, true)).join('')
                        : `<div class="pqi-swap-empty">${mode === 'out' ? 'Brak graczy spoza grupy' : 'Grupa jest pusta'}</div>`}</div>`;
                el.style.display = 'block';

                // Obok panelu (po prawej, a gdy brak miejsca — po lewej), na wysokości wiersza.
                const rowRect = row.getBoundingClientRect();
                const panelRect = panel.getBoundingClientRect();
                let x = panelRect.right + 4;
                if (x + el.offsetWidth > window.innerWidth) x = Math.max(5, panelRect.left - el.offsetWidth - 4);
                const y = Math.max(5, Math.min(rowRect.top, window.innerHeight - el.offsetHeight - 5));
                el.style.left = x + 'px';
                el.style.top = y + 'px';
            }

            if (allowSwap) {
                // Delegacja na liście (wiersze są przerysowywane). Dymek pokazuje się po chwili zatrzymania myszki na wierszu.
                listEl.addEventListener('mouseover', e => {
                    const row = e.target.closest('.pqi-row');
                    if (!row) return;
                    const id = +row.dataset.id;
                    clearTimeout(swapHideTimer);
                    if (id === swapAnchor) return;
                    clearTimeout(swapShowTimer);
                    swapShowTimer = setTimeout(() => {
                        if (!row.isConnected) return;
                        const players = collectPlayers();
                        const p = players.find(x => x.id === id);
                        if (canSwap(p)) showSwap(row, p, players);
                        else hideSwap();
                    }, swapAnchor ? SWAP_HIDE_DELAY : SWAP_SHOW_DELAY);
                });
                listEl.addEventListener('mouseleave', scheduleHideSwap);
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
