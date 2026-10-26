import { injectStyle, isolateWheel, waitFor } from '../core/dom.js';
import { loadJSON, saveJSON, loadFlag, saveFlag } from '../core/storage.js';
import {
    getHeroId, getWorldName, getPartyMembers, inviteToParty,
    isInParty, isPartyLeader, isInBattle, disbandParty, leaveParty,
} from '../core/game.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton, showTooltip, hideTooltip, tooltipList } from '../core/ui.js';

const POS_KEY = 'pqi_widget_pos';
const OPACITY_KEY = 'pqi_widget_opacity';
const COLLAPSED_KEY = 'pqi_widget_collapsed';
// Id graczy są per świat, więc składy też.
const presetsKey = () => `pqi_presets_${getWorldName()}`;

const INVITE_DELAY = 400;
const BATTLE_POLL = 200;
const LEAVE_TIMEOUT = 3000;

const CSS = `
    #pqiPanel .pqi-list { max-height: 220px; overflow-y: auto; overflow-x: hidden; }
    #pqiPanel .pqi-list::-webkit-scrollbar { width: 4px; }
    #pqiPanel .pqi-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.4); }
    #pqiPanel .pqi-list::-webkit-scrollbar-thumb { background: #5a4734; }
    #pqiPanel .pqi-row { display: flex; align-items: center; gap: 6px; padding: 3px 4px; margin-bottom: 2px; }
    #pqiPanel .pqi-name { flex: 1; color: #eaeaea; font-size: 11px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
    #pqiPanel .pqi-name:hover { color: #ffd76a; }
    #pqiPanel .pqi-count { color: #aaa; font-size: 10px; }
    #pqiPanel .pqi-btn { background: #222; color: #eee; border: 1px solid #444; border-radius: 3px; font: bold 9px Verdana, sans-serif; padding: 2px 6px; cursor: pointer; }
    #pqiPanel .pqi-btn:hover { border-color: #8a6d3b; }
    #pqiPanel .pqi-btn.pqi-del { color: #c0392b; padding: 2px 5px; }
    #pqiPanel .pqi-btn.pqi-arm { padding: 2px 5px; color: #777; }
    #pqiPanel .pqi-btn.pqi-arm.on { background: linear-gradient(180deg, #7a1a1a 0%, #4a0e0e 100%); border-color: #8b0000; color: #fff; box-shadow: 0 0 5px #e74c3c; }
    #pqiPanel .pqi-save { width: 100%; margin-top: 4px; padding: 4px; }
    #pqiPanel .pqi-status { color: #ffd76a; font-size: 10px; text-align: center; min-height: 12px; margin-top: 3px; }
    #pqiPanel .pqi-empty { color: #eaeaea; font-style: italic; font-size: 11px; padding: 4px; text-align: center; }
`;

const PANEL_HTML = `
    <div class="header-label-positioner" id="pqiHeader">
        <div class="draggable-window-element ui-draggable-handle"></div>
        <div class="header-label">
            <div class="left-decor"></div>
            <div class="right-decor"></div>
            <div class="text">Składy</div>
        </div>
    </div>
    <div class="content" id="pqiContent" style="padding: 4px 6px;">
        <div class="pqi-list" id="pqiList"></div>
        <button type="button" class="pqi-btn pqi-save" id="pqiSave">+ Zapisz obecną grupę</button>
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

const loadPresets = () => loadJSON(presetsKey(), []);
const savePresets = presets => saveJSON(presetsKey(), presets);

export default {
    id: 'party-quick-invite',
    name: 'Party Quick Invite',
    description: 'Zapisane składy grupy — zaproszenie całej ekipy jednym kliknięciem. ⚡ = po najbliższej walce rozwiązuje starą grupę i zaprasza skład.',

    run() {
        injectStyle(CSS);

        const savedPos = loadJSON(POS_KEY, { top: '200px', left: '20px' });
        let isCollapsed = loadFlag(COLLAPSED_KEY);
        let inviting = false;
        // Indeks składu uzbrojonego na „po walce” (jednorazowo, nie zapisywany).
        let armedIndex = null;
        let inBattle = isInBattle();

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

        function render() {
            const presets = loadPresets();
            if (!presets.length) {
                listEl.innerHTML = '<div class="pqi-empty">Brak składów — zbierz grupę i zapisz ją.</div>';
                return;
            }
            listEl.innerHTML = presets.map((p, i) => `
                <div class="pqi-row tw-list-item" data-i="${i}">
                    <div class="pqi-name" data-act="rename" title="Kliknij, by zmienić nazwę">${escapeHtml(p.name)}</div>
                    <span class="pqi-count">${p.members.length}</span>
                    <button type="button" class="pqi-btn pqi-arm${armedIndex === i ? ' on' : ''}" data-act="arm" title="Po walce: rozwiąż grupę i zaproś ten skład">⚡</button>
                    <button type="button" class="pqi-btn" data-act="invite">Zaproś</button>
                    <button type="button" class="pqi-btn pqi-del" data-act="delete" title="Usuń skład">✕</button>
                </div>
            `).join('');
        }

        function saveCurrentParty() {
            const myId = getHeroId();
            const members = getPartyMembers().filter(m => m.id !== myId);
            if (!members.length) return setStatus('Nie jesteś w grupie.');

            const name = prompt('Nazwa składu:', `Skład ${loadPresets().length + 1}`);
            if (!name?.trim()) return;

            const presets = loadPresets();
            presets.push({ name: name.trim(), members });
            savePresets(presets);
            render();
            setStatus(`Zapisano (${members.length}).`);
        }

        async function invitePreset(preset) {
            if (inviting) return;
            if (isInParty() && !isPartyLeader()) return setStatus('Tylko lider może zapraszać.');

            const myId = getHeroId();
            const inParty = new Set(getPartyMembers().map(m => m.id));
            const toInvite = preset.members.filter(m => m.id !== myId && !inParty.has(m.id));
            if (!toInvite.length) return setStatus('Wszyscy już są w grupie.');

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

        /** Rozwiązuje (lider) lub opuszcza starą grupę, czeka aż zniknie i zaprasza skład. */
        async function swapToPreset(preset) {
            if (isInParty()) {
                setStatus('Rozwiązuję starą grupę…', 0);
                if (isPartyLeader()) disbandParty();
                else leaveParty();
                const left = await waitFor(() => !isInParty(), { interval: 100, timeout: LEAVE_TIMEOUT });
                if (!left) return setStatus('Nie udało się wyjść z grupy.');
            }
            await invitePreset(preset);
        }

        setInterval(() => {
            const nowInBattle = isInBattle();
            if (inBattle && !nowInBattle && armedIndex !== null) {
                const preset = loadPresets()[armedIndex];
                armedIndex = null;
                render();
                if (preset) swapToPreset(preset);
            }
            inBattle = nowInBattle;
        }, BATTLE_POLL);

        listEl.addEventListener('click', e => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            const row = e.target.closest('.pqi-row');
            if (!act || !row) return;
            e.stopPropagation();

            const presets = loadPresets();
            const i = +row.dataset.i;
            const preset = presets[i];
            if (!preset) return;

            if (act === 'invite') return invitePreset(preset);
            if (act === 'arm') {
                armedIndex = armedIndex === i ? null : i;
                setStatus(armedIndex === null ? 'Rozbrojono.' : `Po walce: ${preset.name}`);
                return render();
            }
            if (act === 'delete') {
                if (!confirm(`Usunąć skład "${preset.name}"?`)) return;
                presets.splice(i, 1);
                if (armedIndex === i) armedIndex = null;
                else if (armedIndex > i) armedIndex--;
            } else if (act === 'rename') {
                const name = prompt('Nowa nazwa składu:', preset.name);
                if (!name?.trim()) return;
                preset.name = name.trim();
            }
            savePresets(presets);
            render();
        });

        listEl.addEventListener('mouseover', e => {
            const row = e.target.closest('.pqi-row');
            const preset = row && loadPresets()[+row.dataset.i];
            if (!preset) return;
            showTooltip(row, tooltipList(preset.members.map(m => ({ left: escapeHtml(m.nick) })), 'Pusty skład'));
        });
        listEl.addEventListener('mouseleave', hideTooltip);

        panel.querySelector('#pqiSave').addEventListener('click', e => {
            e.stopPropagation();
            saveCurrentParty();
        });

        render();
    },
};
