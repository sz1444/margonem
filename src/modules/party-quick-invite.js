import { injectStyle, isolateWheel } from '../core/dom.js';
import { loadJSON, loadFlag, saveFlag } from '../core/storage.js';
import {
    getHeroId, getClanId, getMapPlayers, inviteToParty,
    isInParty, isPartyLeader, isInBattle, disbandParty, leaveParty,
} from '../core/game.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton } from '../core/ui.js';

const POS_KEY = 'pqi_widget_pos';
const OPACITY_KEY = 'pqi_widget_opacity';
const COLLAPSED_KEY = 'pqi_widget_collapsed';

const CSS = `
    #pqiPanel .pqi-list { max-height: 240px; overflow-y: auto; overflow-x: hidden; }
    #pqiPanel .pqi-list::-webkit-scrollbar { width: 4px; }
    #pqiPanel .pqi-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.4); }
    #pqiPanel .pqi-list::-webkit-scrollbar-thumb { background: #5a4734; }
    #pqiPanel .pqi-row {
        display: flex !important; align-items: center; gap: 6px;
        height: 20px !important; min-height: 0 !important; max-height: 20px !important;
        padding: 0 4px !important; margin: 0 0 2px !important; box-sizing: border-box;
        position: relative !important; flex: none !important;
        cursor: pointer; background: rgba(0,0,0,0.35); border-radius: 2px;
    }
    #pqiPanel .pqi-row:hover { background: rgba(90,71,52,0.35); }
    #pqiPanel .pqi-row.away { opacity: 0.45; }
    #pqiPanel .pqi-check {
        flex: none; width: 11px; height: 11px; box-sizing: border-box;
        border: 1px solid #5a4734; background: #111; border-radius: 2px;
        display: flex; align-items: center; justify-content: center;
        color: #ffd76a; font-size: 9px; line-height: 1;
    }
    #pqiPanel .pqi-row.checked .pqi-check { border-color: #c9a35b; background: #3a2c1c; }
    #pqiPanel .pqi-row.checked .pqi-check::after { content: '✓'; }
    #pqiPanel .pqi-nick { flex: 1; font-size: 11px; line-height: 20px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #pqiPanel .pqi-nick.friend { color: #6fd36f; }
    #pqiPanel .pqi-nick.clan { color: #6fb7ff; }
    #pqiPanel .pqi-lvl { color: #aaa; font-size: 10px; }
    #pqiPanel .pqi-empty { color: #eaeaea; font-style: italic; font-size: 11px; padding: 4px; text-align: center; }
`;

const PANEL_HTML = `
    <div class="header-label-positioner" id="pqiHeader">
        <div class="draggable-window-element ui-draggable-handle"></div>
        <div class="header-label">
            <div class="left-decor"></div>
            <div class="right-decor"></div>
            <div class="text" id="pqiHeaderText">Nowa grupa</div>
        </div>
    </div>
    <div class="content" id="pqiContent" style="padding: 4px 6px;">
        <div class="pqi-list" id="pqiList"></div>
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

/** 'clan' / 'friend' / null (pozostałych nie pokazujemy). */
function playerKind(p, myClanId) {
    if (p.relation === 'cl' || (myClanId && p.clanId === myClanId)) return 'clan';
    if (p.relation === 'fr') return 'friend';
    return null;
}

export default {
    id: 'party-quick-invite',
    name: 'Party Quick Invite',
    description: 'Zaznacz przyjaciół i klanowiczów z mapy — po walce rozwiązuje grupę i tworzy nową z zaznaczonych.',
    dev: true,

    run() {
        injectStyle(CSS);

        const savedPos = loadJSON(POS_KEY, { top: '200px', left: '20px' });
        let isCollapsed = loadFlag(COLLAPSED_KEY);
        let inBattle = isInBattle();
        // Zaznaczeni gracze: id → { id, nick, lvl, kind }. Zostają, nawet gdy zejdą z mapy.
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
            width: 200px !important;
        `;
        panel.innerHTML = PANEL_HTML;
        document.body.appendChild(panel);

        const listEl = panel.querySelector('#pqiList');
        const contentEl = panel.querySelector('#pqiContent');
        const headerText = panel.querySelector('#pqiHeaderText');
        const iconEl = panel.querySelector('#pqiToggle .ie-icon');

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

        /** Przyjaciele i klanowicze z mapy + zaznaczeni, którzy z niej zeszli. */
        function collectPlayers() {
            const myId = getHeroId();
            const myClanId = getClanId();
            const onMap = new Map();
            for (const p of getMapPlayers()) {
                const kind = p.id !== myId && playerKind(p, myClanId);
                if (kind) onMap.set(p.id, { id: p.id, nick: p.nick, lvl: p.lvl, kind });
            }
            const players = [...onMap.values()].map(p => ({ ...p, away: false }));
            for (const p of selected.values()) if (!onMap.has(p.id)) players.push({ ...p, away: true });

            return players.sort((a, b) =>
                (a.kind === b.kind ? 0 : a.kind === 'clan' ? -1 : 1) || a.nick.localeCompare(b.nick));
        }

        function render(force = false) {
            const players = collectPlayers();
            const signature = players.map(p => `${p.id}:${p.away}:${selected.has(p.id)}`).join('|');
            if (!force && signature === lastSignature) return;
            lastSignature = signature;

            headerText.textContent = `Nowa grupa (${selected.size})`;
            if (!players.length) {
                listEl.innerHTML = '<div class="pqi-empty">Brak przyjaciół i klanowiczów na mapie.</div>';
                return;
            }
            listEl.innerHTML = players.map(p => `
                <div class="pqi-row${p.away ? ' away' : ''}${selected.has(p.id) ? ' checked' : ''}" data-id="${p.id}" title="${p.away ? 'Poza mapą' : ''}">
                    <span class="pqi-check"></span>
                    <span class="pqi-nick ${p.kind}">${escapeHtml(p.nick)}</span>
                    <span class="pqi-lvl">${p.lvl ?? ''}</span>
                </div>
            `).join('');
        }

        listEl.addEventListener('click', e => {
            const row = e.target.closest('.pqi-row');
            if (!row) return;
            e.stopPropagation();
            const id = +row.dataset.id;
            if (selected.has(id)) {
                selected.delete(id);
            } else {
                const p = collectPlayers().find(x => x.id === id);
                if (p) selected.set(id, { id: p.id, nick: p.nick, lvl: p.lvl, kind: p.kind });
            }
            render(true);
        });

        /** Po walce: rozwiązuje (lider) lub opuszcza starą grupę i zaprasza zaznaczonych. */
        function newPartyAfterBattle() {
            if (!selected.size) return;
            if (isInParty()) {
                if (isPartyLeader()) disbandParty();
                else leaveParty();
            }
            for (const m of selected.values()) inviteToParty(m.id);
        }

        setInterval(() => {
            const nowInBattle = isInBattle();
            if (inBattle && !nowInBattle) newPartyAfterBattle();
            inBattle = nowInBattle;
            if (!isCollapsed) render();
        }, 500);

        render(true);
    },
};
