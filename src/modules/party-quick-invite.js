import { injectStyle, isolateWheel } from '../core/dom.js';
import { win } from '../core/env.js';
import { loadJSON, saveJSON, loadFlag, saveFlag } from '../core/storage.js';
import {
    getHeroId, getClanId, getWorldName, getMapPlayers, getPartyMembers, inviteToParty,
    isInParty, isPartyLeader, disbandParty, leaveParty,
} from '../core/game.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton } from '../core/ui.js';

const POS_KEY = 'pqi_widget_pos';
// Grupa ma 10 miejsc: bohater + 9 zaproszonych.
const MAX_SELECTED = 9;
const OPACITY_KEY = 'pqi_widget_opacity';
const COLLAPSED_KEY = 'pqi_widget_collapsed';
const WIDTH_KEY = 'pqi_widget_width';
const MIN_WIDTH = 242;

/** Ile kolumn profesji przy danej szerokości okna (6 profesji → 1, 2, 3 albo 6). */
function columnsForWidth(width) {
    if (width < 300) return 1;
    if (width < 450) return 2;
    if (width < 720) return 3;
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

const CSS = `
    /* Wygląd 1:1 jak kolumny klanów w Online List (.clan-columns / .clan-column / .clan-cell). */
    #pqiPanel .pqi-grid { display: grid; grid-template-columns: repeat(var(--pqi-cols, 2), minmax(0, 1fr)); gap: 2px; box-sizing: border-box; width: 100%; }
    #pqiPanel .pqi-section {
        display: flex; flex-direction: column; gap: 0; min-width: 0;
        padding: 1px 2px; box-sizing: border-box; border-radius: 2px;
        background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.22);
    }
    #pqiPanel .pqi-section-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 1px; padding: 0 2px; font-size: 10px; line-height: 14px; font-weight: bold; }
    #pqiPanel .pqi-section-head .pqi-title { color: #fff; font-weight: 300; }
    #pqiPanel .pqi-section-head .pqi-count { color: #eaeaea; }
    .popup-menu-layer { z-index: 1000 !important; }
    #pqiPanel .pqi-row { display: flex; justify-content: space-between; align-items: center; cursor: pointer; width: 100%; box-sizing: border-box; padding: 0 2px; margin: 0; }
    #pqiPanel .pqi-row:hover { filter: brightness(1.2); }
    #pqiPanel .pqi-row.checked { box-shadow: inset 0 0 0 20px rgba(46,204,113,0.22); }
    #pqiPanel .pqi-row-inner { display: flex; justify-content: space-between; align-items: center; width: 100%; overflow: hidden; gap: 3px; }
    #pqiPanel .pqi-nick { font-weight: 600; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; flex: 1; margin-right: 4px; }
    #pqiPanel .pqi-lvl { color: #eaeaea; font-size: 11px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
    #pqiPanel .pqi-add {
        flex-shrink: 0; width: 12px; height: 12px; margin-left: 2px;
        display: flex; align-items: center; justify-content: center;
        color: #eaeaea; font-size: 11px; font-weight: 700; line-height: 1;
        border: 1px solid rgba(255,255,255,0.3); border-radius: 2px; background: rgba(0,0,0,0.3);
    }
    #pqiPanel .pqi-add:hover { color: #fff; border-color: #fff; background: rgba(255,255,255,0.15); }
    #pqiPanel .pqi-check { color: #2ecc71; font-size: 10px; font-weight: 700; flex-shrink: 0; }
    #pqiPanel .pqi-status { font-size: 10px; flex-shrink: 0; }
    #pqiPanel .pqi-status.battle { color: #fc3e40; }
    #pqiPanel .pqi-row.is-afk .pqi-nick { opacity: 0.55; font-style: italic; }
    #pqiPanel .pqi-dash { color: #666; font-size: 10px; line-height: 14px; text-align: center; }
    /* Stopka: dwa przyciski gry, każdy na pół szerokości. */
    #pqiPanel .pqi-actions { padding: 2px 2px 0; margin-top: 2px; }
    #pqiPanel .pqi-btns { display: flex; gap: 2px; width: 100%; }
    #pqiPanel .pqi-btn { flex: 1 1 0; width: auto !important; min-width: 0; margin: 0; pointer-events: auto; cursor: pointer; }
    #pqiPanel .pqi-btn { display: flex !important; align-items: center; justify-content: center; }
    #pqiPanel .pqi-btn .label { width: 100%; text-align: center; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #pqiPanel .pqi-btn:hover { filter: brightness(1.2); }
    /* Uzbrojone „po walce”: przycisk gry przefarbowany na czerwono. */
    #pqiPanel .pqi-btn.on { filter: hue-rotate(-110deg) saturate(1.6); }
`;

const PANEL_HTML = `
    <div class="header-label-positioner" id="pqiHeader">
        <div class="draggable-window-element ui-draggable-handle"></div>
        <div class="header-label">
            <div class="left-decor"></div>
            <div class="right-decor"></div>
            <div class="text" id="pqiHeaderText">Quick Party</div>
        </div>
    </div>
    <div class="content" id="pqiContent">
        <div class="inner-content">
            <div class="who-is-here">
                <div class="player-list" id="pqiList" style="padding: 2px;"></div>
                <div class="pqi-actions">
                    <div class="pqi-btns">
                        <div class="button green small pqi-btn" id="pqiCreate" title="Rozwiąż grupę i zaproś zaznaczonych teraz"><div class="background"></div><div class="label">Zrób grupę</div></div>
                        <div class="button green small pqi-btn" id="pqiArm" title="Rozwiąż grupę i zaproś zaznaczonych po najbliższej walce"><div class="background"></div><div class="label">Zrób grupę po walce</div></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="c-window__bottom-bar">
        <div class="interface-element-bottom-bar-background-stretch"></div>
    </div>
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

/** PPM na graczu: „Pokaż ekwipunek” i „Zaproś do grupy” — te same akcje, co w menu gracza w grze. */
function openPlayerMenu(p, e) {
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
    items.push([t('team_invite', 'Zaproś do grupy', 'menu'), () => inviteToParty(p.id)]);
    engine.interface.showPopupMenu(items, e, { header: escapeHtml(p.nick) });
}

export default {
    id: 'party-quick-invite',
    name: 'Quick Party',
    description: 'Szybkie tworzenie grupy z listy graczy na mapie.',

    run() {
        injectStyle(CSS);

        const savedPos = loadJSON(POS_KEY, { top: '200px', left: '20px' });
        let isCollapsed = loadFlag(COLLAPSED_KEY);
        // Jednorazowo: po najbliższej walce tworzy nową grupę i się wyłącza.
        let armed = false;
        // Zaznaczeni gracze: id → gracz (tylko obecni na mapie).
        const selected = new Map();
        let lastSignature = '';

        const panel = document.createElement('div');
        panel.id = 'pqiPanel';
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
            panel.style.setProperty('--pqi-cols', columnsForWidth(width));
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
                KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.nick.localeCompare(b.nick));
        }

        const rowHtml = p => {
            const color = kindColor(p.inParty ? 'group' : p.kind);
            return `
            <div class="one-other tw-list-item pqi-row${selected.has(p.id) ? ' checked' : ''}${p.afk ? ' is-afk' : ''}" data-id="${p.id}" title="${escapeHtml(p.nick)}${p.afk ? ' — AFK' : ''}${p.inBattle ? ' — w walce' : ''}">
                <div class="pqi-row-inner">
                    ${selected.has(p.id) ? '<div class="pqi-check">✓</div>' : ''}
                    <div class="pqi-nick" style="color: ${color};">${escapeHtml(p.nick)}</div>
                    ${p.afk ? '<div class="pqi-status" title="AFK (duch)">👻</div>' : ''}
                    ${p.inBattle ? '<div class="pqi-status battle" title="W walce">⚔</div>' : ''}
                    <div class="pqi-lvl" style="color: ${color};">${p.lvl ?? ''}${p.prof ?? ''}</div>
                    <div class="pqi-add" title="Zaproś do grupy">+</div>
                </div>
            </div>
        `;
        };

        function render(force = false) {
            const players = collectPlayers();
            const signature = players.map(p => `${p.id}:${selected.has(p.id)}:${p.afk}:${p.inBattle}:${p.inParty}`).join('|');
            if (!force && signature === lastSignature) return;
            lastSignature = signature;

            headerText.textContent = `Quick Party (${selected.size}/${MAX_SELECTED})`;

            // Nieznana profesja ląduje w pierwszej kolumnie, żeby nikt nie zniknął.
            const columns = PROFS.map(prof => players.filter(p => p.prof === prof.code));
            columns[0].push(...players.filter(p => !PROFS.some(x => x.code === p.prof)));

            listEl.innerHTML = `<div class="pqi-grid">${PROFS.map((prof, i) => `
                <div class="pqi-section">
                    <div class="pqi-section-head"><span class="pqi-title">${prof.name}</span> <span class="pqi-count">${columns[i].length}</span></div>
                    ${columns[i].length ? columns[i].map(rowHtml).join('') : '<div class="pqi-dash">–</div>'}
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
            if (p) openPlayerMenu(p, e);
        });

        /** Rozwiązuje (lider) lub opuszcza starą grupę i zaprasza zaznaczonych — z przycisku albo po walce. */
        function newParty() {
            if (!selected.size) return;
            if (isInParty()) {
                if (isPartyLeader()) disbandParty();
                else leaveParty();
            }
            for (const m of selected.values()) inviteToParty(m.id);
        }

        function setArmed(value) {
            armed = value;
            armBtn.classList.toggle('on', armed);
        }

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
    },
};
