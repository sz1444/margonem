import { win } from '../core/env.js';
import { injectStyle, waitFor, clamp } from '../core/dom.js';
import { getMapName, sendRequest } from '../core/game.js';
import { loadJSON, saveJSON } from '../core/storage.js';
import { makeDraggable, makeResizable } from '../core/drag.js';

const MAPS_WITH_MODAL = [
    'Katakumby Antycznego Gniewu - przedsionek', 'Przejście Władców Mrozu', 'Sekretne Przejście Kapłanów',
    'Bandyckie Chowisko', 'Wulkan Politraki - przedsionek', 'Lokum Złych Goblinów p.4',
    'Jaskinia Ulotnych Wspomnień', 'Więzienie Demonów', 'Nora Jaszczurzych Koszmarów p.1 - sala 2',
    'Teotihuacan - przedsionek',
];
const POS_KEY = 'umguard_modal_pos';
const AUTOCLOSE_KEY = 'umguard_autoclose';
const AUTOCLOSE_MS = 60000;

const SCROLLBAR_CSS = `
    #umguardScrollContainer::-webkit-scrollbar { width: 4px; }
    #umguardScrollContainer::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.03); border-radius: 2px; }
    #umguardScrollContainer::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
    #umguardScrollContainer::-webkit-scrollbar-thumb:hover { background: rgba(231, 76, 60, 0.6); }
`;

const buildsCommons = () => win.Engine.buildsManager.getBuildsCommons();

function applyDimensions(modal, { x, y, w, h }) {
    modal.style.left = clamp(x, 0, window.innerWidth - (w || modal.offsetWidth)) + 'px';
    modal.style.top = clamp(y, 0, window.innerHeight - (h || modal.offsetHeight)) + 'px';
    if (w) modal.style.width = w + 'px';
    if (h) modal.style.height = h + 'px';
    modal.style.transform = 'none';
}

function saveDimensions(modal) {
    saveJSON(POS_KEY, {
        x: modal.offsetLeft,
        y: modal.offsetTop,
        w: parseInt(modal.style.width),
        h: parseInt(modal.style.height),
    });
}

function renderToggle(track, thumb, enabled) {
    track.style.background = enabled ? 'rgba(231,76,60,0.7)' : 'rgba(255,255,255,0.15)';
    thumb.style.left = enabled ? '11px' : '1px';
}

function showModal() {
    if (document.querySelector('#alertUmChange')) return;

    const skills = buildsCommons().getBuildsName();
    const activeSkill = buildsCommons().getCurrentId();
    let autoCloseEnabled = loadJSON(AUTOCLOSE_KEY, true);

    const modal = document.createElement('div');
    modal.id = 'alertUmChange';
    modal.style.cssText = `
        position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
        background: rgba(20, 20, 20, 0.95); color: white; padding: 12px 14px;
        z-index: 30000; border-radius: 4px; font-family: 'Verdana', sans-serif;
        text-align: center; box-sizing: border-box;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px);
        border: 1px solid rgba(255,255,255,0.1); width: 320px;
        display: flex; flex-direction: column; overflow: hidden;
    `;

    const buttonsHTML = Object.entries(skills).map(([id, skill]) => `
        <div data-id="${id}" style="
            cursor: pointer; padding: 4px 4px; flex: 1; min-width: 70px;
            border-radius: 3px; background: rgba(255,255,255,0.08);
            font-size: 9px; letter-spacing: 0.5px; white-space: nowrap;
            overflow: hidden; text-overflow: ellipsis; border: 2px solid;
            box-sizing: border-box;
            border-color: ${id == activeSkill ? 'rgba(231,76,60,0.4)' : 'rgba(255,255,255,0.08)'};
        " title="${skill.name}">
            ${skill.name}
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="position: absolute; top: 2px; right: 6px; cursor: pointer; font-size: 14px; opacity: 0.5; z-index: 2;" id="closeGlobalAlert">×</div>
        <div style="font-size: 10px; font-weight: bold; margin-bottom: 6px; letter-spacing: 0.5px; flex-shrink: 0; padding-right: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span style="color: #e74c3c;">Wybierz UM!</span>
        </div>
        <div id="umguardScrollContainer" style="flex: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start;">
            ${buttonsHTML}
        </div>
        <div style="margin-top: auto; padding-top: 6px; display: flex; align-items: center; gap: 7px; opacity: 0.7; flex-shrink: 0; overflow: hidden;">
            <label id="umguardAutocloseToggle" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 8px; letter-spacing: 0.5px; user-select: none; white-space: nowrap;">
                <div id="umguardToggleTrack" style="position: relative; width: 22px; height: 12px; border-radius: 6px; transition: background 0.2s; flex-shrink: 0;">
                    <div id="umguardToggleThumb" style="position: absolute; top: 1px; width: 10px; height: 10px; border-radius: 50%; background: white; transition: left 0.2s;"></div>
                </div>
                Auto (60s)
            </label>
        </div>
        <div id="umguardResizeHandle" style="
            position: absolute; bottom: 0; right: 0; width: 12px; height: 12px;
            cursor: nwse-resize; background: linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 30%); z-index: 2;
        "></div>
    `;
    document.body.appendChild(modal);

    const track = modal.querySelector('#umguardToggleTrack');
    const thumb = modal.querySelector('#umguardToggleThumb');
    renderToggle(track, thumb, autoCloseEnabled);

    const saved = loadJSON(POS_KEY);
    if (saved) applyDimensions(modal, saved);

    modal.style.cursor = 'grab';
    makeDraggable(modal, {
        threshold: 0,
        ignore: '#umguardScrollContainer, #closeGlobalAlert, #umguardAutocloseToggle, #umguardResizeHandle',
        onDragStart: () => modal.style.cursor = 'grabbing',
        onDragEnd: () => {
            modal.style.cursor = 'grab';
            modal.style.transform = 'none';
            saveDimensions(modal);
        },
    });
    makeResizable(modal, modal.querySelector('#umguardResizeHandle'), {
        minWidth: 120,
        minHeight: 80,
        onEnd: () => saveDimensions(modal),
    });

    // Gra przechwytuje kółko myszy — przewijamy listę ręcznie.
    const scrollContainer = modal.querySelector('#umguardScrollContainer');
    const onWheel = e => {
        if (!modal.isConnected) return window.removeEventListener('wheel', onWheel, { capture: true });
        if (!scrollContainer.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        scrollContainer.scrollTop += e.deltaY;
    };
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });

    let autoCloseTimer = null;
    const close = () => {
        clearTimeout(autoCloseTimer);
        modal.remove();
    };
    const startAutoClose = () => {
        clearTimeout(autoCloseTimer);
        if (autoCloseEnabled) autoCloseTimer = setTimeout(close, AUTOCLOSE_MS);
    };
    startAutoClose();

    modal.querySelector('#umguardAutocloseToggle').addEventListener('click', () => {
        autoCloseEnabled = !autoCloseEnabled;
        saveJSON(AUTOCLOSE_KEY, autoCloseEnabled);
        renderToggle(track, thumb, autoCloseEnabled);
        if (autoCloseEnabled) startAutoClose();
        else clearTimeout(autoCloseTimer);
    });

    modal.querySelector('#closeGlobalAlert').onclick = close;

    modal.querySelectorAll('[data-id]').forEach(el => {
        el.onmouseover = () => el.style.background = 'rgba(231,76,60,0.4)';
        el.onmouseout = () => el.style.background = 'rgba(255,255,255,0.08)';
        el.onclick = () => {
            sendRequest(`builds&action=updateCurrent&id=${el.dataset.id}`);
            close();
        };
    });
}

export default {
    id: 'um-guard',
    name: 'UMguard',
    description: 'Automatycznie wykrywa mapy z Tytanem/Kolosem i przypomina o zmianie umiejętności.',

    async run() {
        await waitFor(() => {
            const names = win.Engine?.buildsManager && buildsCommons().getBuildsName();
            return names && typeof names === 'object' && Object.keys(names).length > 0;
        });

        const mapNameElement = document.querySelector('.location');
        if (!mapNameElement) {
            console.error('[UMguard] Nie znaleziono elementu interfejsu z nazwą mapy.');
            return;
        }

        injectStyle(SCROLLBAR_CSS, 'umguard-scrollbar-styles');

        const check = () => {
            if (MAPS_WITH_MODAL.includes(getMapName())) showModal();
        };
        new MutationObserver(check).observe(mapNameElement, { characterData: true, childList: true, subtree: true });
        check();
    },
};
