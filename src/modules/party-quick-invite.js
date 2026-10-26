import { injectStyle, isolateWheel, waitFor } from '../core/dom.js';
import { loadJSON, loadFlag, saveFlag } from '../core/storage.js';
import {
    getHeroId, getClanId, getMapPlayers, getPartyMembers, inviteToParty,
    isInParty, isPartyLeader, isInBattle, disbandParty, leaveParty,
} from '../core/game.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton } from '../core/ui.js';

const POS_KEY = 'pqi_widget_pos';
const OPACITY_KEY = 'pqi_widget_opacity';
const COLLAPSED_KEY = 'pqi_widget_collapsed';

const INVITE_DELAY = 400;
const TICK = 200;
const LIST_REFRESH = 1000;
const LEAVE_TIMEOUT = 3000;

const FRIEND = 'friend';
const CLAN = 'clan';

const CSS = `
    #pqiPanel .pqi-list { max-height: 240px; overflow-y: auto; overflow-x: hidden; }
    #pqiPanel .pqi-list::-webkit-scrollbar { width: 4px; }
    #pqiPanel .pqi-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.4); }
    #pqiPanel .pqi-list::-webkit-scrollbar-thumb { background: #5a4734; }
    #pqiPanel .pqi-row { display: flex; align-items: center; gap: 5px; padding: 2px 4px; margin-bottom: 2px; cursor: pointer; }
    #pqiPanel .pqi-row.away { opacity: 0.45; }
    #pqiPanel .pqi-row input { margin: 0; cursor: pointer; }
    #pqiPanel .pqi-nick { flex: 1; font-size: 11px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #pqiPanel .pqi-nick.friend { color: #6fd36f; }
    #pqiPanel .pqi-nick.clan { color: #6fb7ff; }
    #pqiPanel .pqi-lvl { color: #aaa; font-size: 10px; }
    #pqiPanel .pqi-actions { display: flex; gap: 4px; margin-top: 4px; }
    #pqiPanel .pqi-btn { flex: 1; background: #222; color: #eee; border: 1px solid #444; border-radius: 3px; font: bold 9px Verdana, sans-serif; padding: 4px; cursor: pointer; }
    #pqiPanel .pqi-btn:hover { border-color: #8a6d3b; }
    #pqiPanel .pqi-btn.on { background: linear-gradient(180deg, #7a1a1a 0%, #4a0e0e 100%); border-color: #8b0000; color: #fff; box-shadow: 0 0 5px #e74c3c; }
    #pqiPanel .pqi-status { color: #ffd76a; font-size: 10px; text-align: center; min-height: 12px; margin-top: 3px; }
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
        <div class="pqi-actions">
            <button type="button" class="pqi-btn" id="pqiArm" title="Po najbliższej walce rozwiąż starą grupę i zaproś zaznaczonych">⚡ Nowa grupa po walce</button>
        </div>
        <div class="pqi-status" id="pqiStatus"></div>
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Przyjaciel / klanowicz / null (pozostałych nie pokazujemy). */
function playerKind(p, myClanId) {
    if (p.relation === 'cl' || (myClanId && p.clanId === myClanId)) return CLAN;
    if (p.relation === 'fr') return FRIEND;
    return null;
}

export default {
    id: 'party-quick-invite',
    name: 'Party Quick Invite',
    description: 'Wybierz przyjaciół i klanowiczów z mapy do nowej grupy. ⚡ = po najbliższej walce rozwiązuje starą grupę i jednorazowo zaprasza wybranych.',
    dev: true,

    run() {
        injectStyle(CSS);

        const savedPos = loadJSON(POS_KEY, { top: '200px', left: '20px' });
        let isCollapsed = loadFlag(COLLAPSED_KEY);
        let inviting = false;
        let armed = false;
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
        const statusEl = panel.querySelector('#pqiStatus');
        const headerText = panel.querySelector('#pqiHeaderText');
        const armBtn = panel.querySelector('#pqiArm');
        const iconEl = panel.querySelector('#pqiToggle .ie-icon');

        isolateWheel(listEl);
        setupOpacityButton(panel, panel.querySelector('#pqiOpacityBtn'), OPACITY_KEY, 3);
        makeDraggable(panel, { handle: panel.querySelector('#pqiHeader'), storageKey: POS_KEY, threshold: 0 });

        let statusTimer = null;
        function setStatus(text, ttl = 3000) {
            statusEl.textContent = text;
            clearTimeout(statusTimer);
            if (ttl) statusTimer = setTimeout(() => statusEl.textContent = '', ttl);
        }

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

        function setArmed(value) {
            armed = value;
            armBtn.classList.toggle('on', armed);
        }

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
                (a.kind === b.kind ? 0 : a.kind === CLAN ? -1 : 1) || a.nick.localeCompare(b.nick));
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
                <label class="pqi-row tw-list-item${p.away ? ' away' : ''}" data-id="${p.id}" title="${p.away ? 'Poza mapą' : ''}">
                    <input type="checkbox"${selected.has(p.id) ? ' checked' : ''}>
                    <span class="pqi-nick ${p.kind}">${escapeHtml(p.nick)}</span>
                    <span class="pqi-lvl">${p.lvl ?? ''}</span>
                </label>
            `).join('');
        }

        listEl.addEventListener('change', e => {
            const row = e.target.closest('.pqi-row');
            if (!row) return;
            const id = +row.dataset.id;
            if (e.target.checked) {
                const p = collectPlayers().find(x => x.id === id);
                if (p) selected.set(id, { id: p.id, nick: p.nick, lvl: p.lvl, kind: p.kind });
            } else {
                selected.delete(id);
            }
            render(true);
        });

        async function inviteSelected() {
            if (inviting) return;
            if (isInParty() && !isPartyLeader()) return setStatus('Tylko lider może zapraszać.');

            const inParty = new Set(getPartyMembers().map(m => m.id));
            const toInvite = [...selected.values()].filter(m => !inParty.has(m.id));
            if (!toInvite.length) return setStatus(selected.size ? 'Wszyscy już są w grupie.' : 'Nikogo nie zaznaczono.');

            inviting = true;
            try {
                for (const [i, m] of toInvite.entries()) {
                    setStatus(`Zapraszam ${m.nick} (${i + 1}/${toInvite.length})…`, 0);
                    inviteToParty(m.id);
                    if (i < toInvite.length - 1) await sleep(INVITE_DELAY);
                }
                setStatus(`Wysłano ${toInvite.length} zaproszeń.`);
            } finally {
                inviting = false;
            }
        }

        /** Rozwiązuje (lider) lub opuszcza starą grupę, czeka aż zniknie i zaprasza zaznaczonych. */
        async function swapParty() {
            if (isInParty()) {
                setStatus('Rozwiązuję starą grupę…', 0);
                if (isPartyLeader()) disbandParty();
                else leaveParty();
                const left = await waitFor(() => !isInParty(), { interval: 100, timeout: LEAVE_TIMEOUT });
                if (!left) return setStatus('Nie udało się wyjść z grupy.');
            }
            await inviteSelected();
        }

        armBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (!armed && !selected.size) return setStatus('Najpierw zaznacz graczy.');
            setArmed(!armed);
            setStatus(armed ? 'Nowa grupa po walce.' : 'Rozbrojono.');
        });

        setInterval(() => {
            const nowInBattle = isInBattle();
            if (inBattle && !nowInBattle && armed) {
                setArmed(false);
                swapParty();
            }
            inBattle = nowInBattle;
        }, TICK);

        setInterval(() => { if (!isCollapsed) render(); }, LIST_REFRESH);
        render(true);
    },
};
