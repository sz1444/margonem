import { injectStyle, isolateWheel } from '../core/dom.js';
import { win } from '../core/env.js';
import { loadJSON, loadFlag, saveFlag } from '../core/storage.js';
import {
    getHeroId, getClanId, getWorldName, getMapPlayers, inviteToParty,
    isInParty, isPartyLeader, disbandParty, leaveParty,
} from '../core/game.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton } from '../core/ui.js';

const POS_KEY = 'pqi_widget_pos';
// Grupa ma 10 miejsc: bohater + 9 zaproszonych.
const MAX_SELECTED = 9;
const OPACITY_KEY = 'pqi_widget_opacity';
const COLLAPSED_KEY = 'pqi_widget_collapsed';

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
    #pqiPanel .pqi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    #pqiPanel .pqi-section { min-width: 0; background: rgba(0,0,0,0.25); border: 1px solid rgba(90,71,52,0.5); border-radius: 2px; }
    #pqiPanel .pqi-section-head {
        display: flex; justify-content: space-between;
        color: #c9a35b !important; font: bold 10px/18px Verdana, sans-serif !important;
        padding: 0 4px; border-bottom: 1px solid #5a4734; background: rgba(0,0,0,0.35);
    }
    #pqiPanel .pqi-section-head .pqi-count { color: #ddd; font-weight: normal; }
    #pqiPanel .pqi-section-body { padding: 2px; }
    .popup-menu-layer { z-index: 1000 !important; }
    #pqiPanel .pqi-row {
        display: flex !important; align-items: center; gap: 3px;
        height: 17px !important; min-height: 0 !important; max-height: 17px !important;
        padding: 0 3px !important; margin: 0 !important; box-sizing: border-box;
        position: relative !important; min-width: 0;
        cursor: pointer; border-left: 2px solid transparent; border-radius: 1px;
    }
    #pqiPanel .pqi-row + .pqi-row { border-top: 1px solid rgba(201,163,91,0.25); }
    #pqiPanel .pqi-row:hover { background: rgba(90,71,52,0.3); }
    #pqiPanel .pqi-row.checked { background: rgba(46,204,113,0.22); border-left-color: #2ecc71; }
    #pqiPanel .pqi-nick {
        display: block !important; visibility: visible !important;
        flex: 1 1 auto; min-width: 0; color: #fff !important;
        font: 11px/16px Verdana, sans-serif !important;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #pqiPanel .pqi-row.checked .pqi-nick { color: #4cfa4f !important; }
    #pqiPanel .pqi-status { flex: none; font: bold 9px/16px Verdana, sans-serif !important; padding: 0 2px; border-radius: 2px; }
    #pqiPanel .pqi-status.afk { color: #c7b8ff !important; }
    #pqiPanel .pqi-status.battle { color: #ff6b6b !important; }
    #pqiPanel .pqi-row.is-afk .pqi-nick { opacity: 0.55; font-style: italic !important; }
    #pqiPanel .pqi-lvl { display: block !important; visibility: visible !important; flex: none; color: #ddd !important; font: 10px/16px Verdana, sans-serif !important; }
    #pqiPanel .pqi-dash { color: #666; font: 10px/16px Verdana, sans-serif; padding-left: 4px; }
    #pqiPanel .pqi-actions { display: flex; gap: 3px; margin-top: 4px; }
    #pqiPanel .pqi-btn { flex: 1; padding: 3px; background: #222; color: #ddd; border: 1px solid #444; border-radius: 2px; font: bold 10px Verdana, sans-serif; cursor: pointer; }
    #pqiPanel .pqi-btn:hover { border-color: #8a6d3b; }
    #pqiPanel .pqi-btn.on { background: linear-gradient(180deg, #7a1a1a 0%, #4a0e0e 100%); border-color: #8b0000; color: #fff; box-shadow: 0 0 4px #e74c3c; }
    #pqiPanel .pqi-empty { color: #aaa; font-style: italic; font-size: 10px; padding: 4px; text-align: center; }
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
    <div class="content" id="pqiContent" style="padding: 3px 4px;">
        <div id="pqiList"></div>
        <div class="pqi-actions">
            <button type="button" class="pqi-btn" id="pqiCreate" title="Rozwiąż grupę i zaproś zaznaczonych teraz">Zrób grupę</button>
            <button type="button" class="pqi-btn" id="pqiArm" title="Rozwiąż grupę i zaproś zaznaczonych po najbliższej walce">Zrób grupę po walce</button>
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

// Kolejność na liście: klan, sojusz, przyjaciele.
const KIND_ORDER = ['clan', 'ally', 'friend'];

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
            width: 300px !important;
        `;
        panel.innerHTML = PANEL_HTML;
        document.body.appendChild(panel);

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
            const players = [];
            for (const p of getMapPlayers()) {
                const kind = p.id !== myId && playerKind(p, myClanId);
                if (kind) players.push({ ...p, kind });
            }
            for (const id of selected.keys()) if (!players.some(p => p.id === id)) selected.delete(id);

            return players.sort((a, b) =>
                KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.nick.localeCompare(b.nick));
        }

        const rowHtml = p => `
            <div class="pqi-row${selected.has(p.id) ? ' checked' : ''}${p.afk ? ' is-afk' : ''}" data-id="${p.id}" title="${escapeHtml(p.nick)}${p.afk ? ' — AFK' : ''}${p.inBattle ? ' — w walce' : ''}">
                <div class="pqi-nick">${escapeHtml(p.nick)}</div>
                ${p.afk ? '<div class="pqi-status afk" title="AFK (duch)">👻</div>' : ''}
                ${p.inBattle ? '<div class="pqi-status battle" title="W walce">⚔</div>' : ''}
                <div class="pqi-lvl">${p.lvl ?? ''}${p.prof ?? ''}</div>
            </div>
        `;

        function render(force = false) {
            const players = collectPlayers();
            const signature = players.map(p => `${p.id}:${selected.has(p.id)}:${p.afk}:${p.inBattle}`).join('|');
            if (!force && signature === lastSignature) return;
            lastSignature = signature;

            headerText.textContent = `Quick Party (${selected.size}/${MAX_SELECTED})`;
            if (!players.length) {
                listEl.innerHTML = '<div class="pqi-empty">Brak przyjaciół, klanowiczów i sojuszników na mapie.</div>';
                return;
            }

            // Nieznana profesja ląduje w pierwszej kolumnie, żeby nikt nie zniknął.
            const columns = PROFS.map(prof => players.filter(p => p.prof === prof.code));
            columns[0].push(...players.filter(p => !PROFS.some(x => x.code === p.prof)));

            listEl.innerHTML = `<div class="pqi-grid">${PROFS.map((prof, i) => `
                <div class="pqi-section">
                    <div class="pqi-section-head">${prof.name}<span class="pqi-count">${columns[i].length}</span></div>
                    <div class="pqi-section-body">${columns[i].length ? columns[i].map(rowHtml).join('') : '<div class="pqi-dash">–</div>'}</div>
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
