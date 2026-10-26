import { injectStyle, isolateWheel } from '../core/dom.js';
import { win } from '../core/env.js';
import { loadJSON, loadFlag, saveFlag } from '../core/storage.js';
import {
    getHeroId, getClanId, getWorldName, getMapPlayers, inviteToParty,
    isInParty, isPartyLeader, isInBattle, disbandParty, leaveParty,
} from '../core/game.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton } from '../core/ui.js';

const POS_KEY = 'pqi_widget_pos';
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
    #pqiPanel .pqi-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    #pqiPanel .pqi-table th {
        color: #c9a35b !important; font: bold 10px/18px Verdana, sans-serif !important;
        text-align: left; padding: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        border-bottom: 1px solid #5a4734; background: rgba(0,0,0,0.35);
    }
    #pqiPanel .pqi-table th .pqi-count { color: #ddd; font-weight: normal; }
    #pqiPanel .pqi-table td { vertical-align: top; padding: 2px 2px 0; }
    #pqiPanel .pqi-table td + td, #pqiPanel .pqi-table th + th { border-left: 1px solid rgba(90,71,52,0.5); }
    #pqiPanel .pqi-row {
        display: flex !important; align-items: center; gap: 3px;
        height: 16px !important; min-height: 0 !important; max-height: 16px !important;
        padding: 0 3px !important; margin: 0 0 1px !important; box-sizing: border-box;
        position: relative !important; min-width: 0;
        cursor: pointer; border-left: 2px solid transparent; border-radius: 1px;
    }
    #pqiPanel .pqi-row:hover { background: rgba(90,71,52,0.3); }
    #pqiPanel .pqi-row.checked { background: rgba(46,204,113,0.22); border-left-color: #2ecc71; }
    #pqiPanel .pqi-nick {
        display: block !important; visibility: visible !important;
        flex: 1 1 auto; min-width: 0; color: #fff !important;
        font: 11px/16px Verdana, sans-serif !important;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #pqiPanel .pqi-row.checked .pqi-nick { color: #4cfa4f !important; }
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
            <div class="text" id="pqiHeaderText">Nowa grupa</div>
        </div>
    </div>
    <div class="content" id="pqiContent" style="padding: 3px 4px;">
        <div id="pqiList"></div>
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

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** 'clan' / 'friend' / null (pozostałych nie pokazujemy). */
function playerKind(p, myClanId) {
    if (p.relation === 'cl' || (myClanId && p.clanId === myClanId)) return 'clan';
    if (p.relation === 'fr') return 'friend';
    return null;
}

function openProfile(p) {
    if (win.Engine?.iframeWindowManager?.newPlayerProfile) {
        return win.Engine.iframeWindowManager.newPlayerProfile({ accountId: p.account, characterId: p.id });
    }
    window.open(`https://www.margonem.pl/profile/view,${p.account}#char_${p.id},${getWorldName()}`);
}

/**
 * PPM na graczu: natywne menu gry (to samo co na mapie), a gdy się nie da — własne przez showPopupMenu.
 * Natywne wywołanie podsłuchujemy przez podmianę showPopupMenu, żeby wiedzieć, czy zadziałało.
 */
function openPlayerMenu(p, e, extraItems) {
    const iface = win.Engine?.interface;
    if (!iface?.showPopupMenu) return;
    e.originalEvent = e.originalEvent || e;

    const other = win.Engine.others?.getById?.(p.id);
    if (other && typeof win.Engine.others.createOtherContextMenu === 'function') {
        const original = iface.showPopupMenu;
        let shown = false;
        iface.showPopupMenu = function (items, ...rest) {
            shown = true;
            if (Array.isArray(items)) items.push(...extraItems);
            return original.call(this, items, ...rest);
        };
        try {
            win.Engine.others.createOtherContextMenu(other, e);
        } catch {} finally {
            iface.showPopupMenu = original;
        }
        if (shown) return;
    }

    const items = [
        ['Napisz wiadomość', () => win.Engine.chatController?.getChatInputWrapper?.().setPrivateMessageProcedure(p.nick)],
        ['Zaproś do grupy', () => inviteToParty(p.id)],
        ...extraItems,
    ];
    if (p.account) items.splice(1, 0, ['Profil', () => openProfile(p)]);
    iface.showPopupMenu(items, e);
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
            width: 520px !important;
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

        /** Przyjaciele i klanowicze z mapy. Kto z niej zszedł, wypada też z zaznaczonych. */
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
                (a.kind === b.kind ? 0 : a.kind === 'clan' ? -1 : 1) || a.nick.localeCompare(b.nick));
        }

        const rowHtml = p => `
            <div class="pqi-row${selected.has(p.id) ? ' checked' : ''}" data-id="${p.id}" title="${escapeHtml(p.nick)}">
                <div class="pqi-nick">${escapeHtml(p.nick)}</div>
                <div class="pqi-lvl">${p.lvl ?? ''}</div>
            </div>
        `;

        function render(force = false) {
            const players = collectPlayers();
            const signature = players.map(p => `${p.id}:${selected.has(p.id)}`).join('|');
            if (!force && signature === lastSignature) return;
            lastSignature = signature;

            headerText.textContent = `Nowa grupa (${selected.size})`;
            if (!players.length) {
                listEl.innerHTML = '<div class="pqi-empty">Brak przyjaciół i klanowiczów na mapie.</div>';
                return;
            }

            // Nieznana profesja ląduje w pierwszej kolumnie, żeby nikt nie zniknął.
            const columns = PROFS.map(prof => players.filter(p => p.prof === prof.code));
            columns[0].push(...players.filter(p => !PROFS.some(x => x.code === p.prof)));

            listEl.innerHTML = `
                <table class="pqi-table">
                    <thead><tr>${PROFS.map((prof, i) => `<th title="${prof.name}">${prof.name} <span class="pqi-count">${columns[i].length}</span></th>`).join('')}</tr></thead>
                    <tbody><tr>${columns.map(col => `<td>${col.length ? col.map(rowHtml).join('') : '<div class="pqi-dash">–</div>'}</td>`).join('')}</tr></tbody>
                </table>
            `;
        }

        function toggleSelected(id) {
            if (selected.has(id)) {
                selected.delete(id);
            } else {
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
            const id = +row.dataset.id;
            const p = collectPlayers().find(x => x.id === id);
            if (!p) return;
            const label = selected.has(id) ? 'Usuń z nowej grupy' : 'Dodaj do nowej grupy';
            openPlayerMenu(p, e, [[label, () => toggleSelected(id)]]);
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
