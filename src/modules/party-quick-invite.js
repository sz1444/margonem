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
    #pqiPanel .pqi-list { max-height: 360px; overflow-y: auto; overflow-x: hidden; }
    #pqiPanel .pqi-list::-webkit-scrollbar { width: 3px; }
    #pqiPanel .pqi-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.4); }
    #pqiPanel .pqi-list::-webkit-scrollbar-thumb { background: #5a4734; }
    #pqiPanel .pqi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 3px; }
    #pqiPanel .pqi-row {
        display: flex !important; align-items: center; gap: 3px;
        height: 16px !important; min-height: 0 !important; max-height: 16px !important;
        padding: 0 3px !important; margin: 0 !important; box-sizing: border-box;
        position: relative !important; min-width: 0;
        cursor: pointer; border-left: 2px solid transparent; border-radius: 1px;
    }
    #pqiPanel .pqi-row:hover { background: rgba(90,71,52,0.3); }
    #pqiPanel .pqi-row.checked { background: rgba(46,204,113,0.22); border-left-color: #2ecc71; }
    #pqiPanel .pqi-row.checked .pqi-nick { color: #4cfa4f !important; }
    #pqiPanel .pqi-row.away { opacity: 0.4; }
    #pqiPanel .pqi-nick {
        display: block !important; visibility: visible !important;
        flex: 1 1 auto; min-width: 0; color: #fff !important;
        font: 11px/16px Verdana, sans-serif !important;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #pqiPanel .pqi-lvl { display: block !important; visibility: visible !important; flex: none; color: #ddd !important; font: 10px/16px Verdana, sans-serif !important; }
    #pqiPanel .pqi-group { color: #c9a35b !important; font: bold 9px/13px Verdana, sans-serif !important; letter-spacing: 0.5px; margin: 3px 0 1px; opacity: 0.8; }
    #pqiPanel .pqi-group:first-child { margin-top: 0; }
    #pqiPanel .pqi-actions { display: flex; gap: 3px; margin-top: 4px; }
    #pqiPanel .pqi-btn { flex: 1; padding: 3px; background: #222; color: #ddd; border: 1px solid #444; border-radius: 2px; font: bold 9px Verdana, sans-serif; cursor: pointer; }
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
            <div class="text" id="pqiHeaderText">Nowa grupa</div>
        </div>
    </div>
    <div class="content" id="pqiContent" style="padding: 3px 4px;">
        <div class="pqi-list" id="pqiList"></div>
        <div class="pqi-actions">
            <button type="button" class="pqi-btn" id="pqiCreate" title="Rozwiąż grupę i zaproś zaznaczonych teraz">Teraz</button>
            <button type="button" class="pqi-btn" id="pqiArm" title="Rozwiąż grupę i zaproś zaznaczonych po najbliższej walce">Po walce</button>
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

// Kolejność grup na liście.
const PROFS = [
    { code: 'w', name: 'w' },
    { code: 'p', name: 'p' },
    { code: 'b', name: 'b' },
    { code: 'h', name: 'h' },
    { code: 'm', name: 'm' },
    { code: 't', name: 't' },
];

const escapeHtml =s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** 'clan' / 'friend' / null (pozostałych nie pokazujemy). */
function playerKind(p, myClanId) {
    if (p.relation === 'cl' || (myClanId && p.clanId === myClanId)) return 'clan';
    if (p.relation === 'fr') return 'friend';
    return null;
}

export default {
    id: 'party-quick-invite',
    name: 'Party Quick Invite',
    description: 'Zaznacz przyjaciół i klanowiczów z mapy i utwórz z nich nową grupę — od razu albo po walce.',
    dev: true,

    run() {
        injectStyle(CSS);

        const savedPos = loadJSON(POS_KEY, { top: '200px', left: '20px' });
        let isCollapsed = loadFlag(COLLAPSED_KEY);
        let inBattle = isInBattle();
        // Jednorazowo: po najbliższej walce tworzy nową grupę i się wyłącza.
        let armed = false;
        // Zaznaczeni gracze: id → { id, nick, lvl, prof, kind }. Zostają, nawet gdy zejdą z mapy.
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
            width: 280px !important;
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

        /** Przyjaciele i klanowicze z mapy + zaznaczeni, którzy z niej zeszli. */
        function collectPlayers() {
            const myId = getHeroId();
            const myClanId = getClanId();
            const onMap = new Map();
            for (const p of getMapPlayers()) {
                const kind = p.id !== myId && playerKind(p, myClanId);
                if (kind) onMap.set(p.id, { id: p.id, nick: p.nick, lvl: p.lvl, prof: p.prof, kind });
            }
            const players = [...onMap.values()].map(p => ({ ...p, away: false }));
            for (const p of selected.values()) if (!onMap.has(p.id)) players.push({ ...p, away: true });

            return players.sort((a, b) =>
                (a.kind === b.kind ? 0 : a.kind === 'clan' ? -1 : 1) || a.nick.localeCompare(b.nick));
        }

        const rowHtml = p => `
            <div class="pqi-row${p.away ? ' away' : ''}${selected.has(p.id) ? ' checked' : ''}" data-id="${p.id}" title="${escapeHtml(p.nick)}${p.away ? ' — poza mapą' : ''}">
                <div class="pqi-nick">${escapeHtml(p.nick)}</div>
                <div class="pqi-lvl">${p.lvl ?? ''}${p.prof ?? ''}</div>
            </div>
        `;

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

            const groups = [...PROFS, { code: null, name: '?' }].map(prof => ({
                name: prof.name,
                players: players.filter(p => prof.code ? p.prof === prof.code : !PROFS.some(x => x.code === p.prof)),
            }));
            listEl.innerHTML = groups
                .filter(g => g.players.length)
                .map(g => `<div class="pqi-group">${g.name} · ${g.players.length}</div><div class="pqi-grid">${g.players.map(rowHtml).join('')}</div>`)
                .join('');
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
                if (p) selected.set(id, { id: p.id, nick: p.nick, lvl: p.lvl, prof: p.prof, kind: p.kind });
            }
            render(true);
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

        setInterval(() => {
            const nowInBattle = isInBattle();
            if (inBattle && !nowInBattle && armed) {
                setArmed(false);
                newParty();
            }
            inBattle = nowInBattle;
            if (!isCollapsed) render();
        }, 500);

        render(true);
    },
};
