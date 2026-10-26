import { injectStyle } from '../core/dom.js';
import { loadJSON, saveJSON, loadFlag, saveFlag } from '../core/storage.js';
import { getBossTimers } from '../core/lootlog.js';
import { formatHMS } from '../core/format.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton } from '../core/ui.js';

const POS_KEY = 'll_pinned_widget_pos';
const SIZE_KEY = 'll_pinned_widget_size';
const OPACITY_KEY = 'll_pinned_widget_opacity';
const COLLAPSED_KEY = 'll_widget_collapsed';
const COLLAPSED_HEIGHT = '28px';

const CSS = `
    #llPinnedTimersPanel .scroll-pane {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        height: 100% !important;
    }
    #llPinnedTimersPanel .scroll-pane::-webkit-scrollbar { width: 4px !important; }
    #llPinnedTimersPanel .scroll-pane::-webkit-scrollbar-track { background: rgba(0,0,0,0.4) !important; }
    #llPinnedTimersPanel .scroll-pane::-webkit-scrollbar-thumb { background: #5a4734 !important; }
`;

const PANEL_HTML = `
    <div class="header-label-positioner" id="llWidgetHeader">
        <div class="draggable-window-element ui-draggable-handle"></div>
        <div class="header-label">
            <div class="left-decor"></div>
            <div class="right-decor"></div>
            <div class="text" id="llWidgetHeaderText" name="Przypięte Timery">Przypięte Timery (...)</div>
        </div>
    </div>
    <div class="content" id="llWidgetContent" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <div class="inner-content" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
            <div class="window-list elite-timer-wnd" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                <div class="open-edit-panel"></div>
                <div class="scroll-wrapper small-bar" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                    <div class="scroll-pane" id="ll-scroll-pane" style="flex: 1; min-height: 0;">
                        <div class="empty" id="ll-empty-msg" style="display: none;">----</div>
                        <div class="list npc-list" id="ll-timers-list"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="window-controlls" style="display: block;">
            <div class="row row-input tw-list-item" style="display: none;"></div>
        </div>
    </div>
    <div class="c-window__bottom-bar">
        <div class="interface-element-bottom-bar-background-stretch"></div>
    </div>
    <div class="close-button-corner-decor">
        <button type="button" class="close-button" id="llWidgetToggle"><div class="ie-icon ie-icon-close"></div></button>
    </div>
    <div class="border-image"></div>
    <div class="transparent-window-buttons-menu">
        <div class="manage-hamburger-button"><div class="ie-icon ie-icon-menu"></div></div>
        <div class="increase-opacity" id="llWidgetOpacityBtn" title="Zmień przezroczystość"></div>
    </div>
`;

/** Nazwy timerów przypiętych w LootLogu. */
function getPinnedNames() {
    return loadJSON('ll-timers-state')?.state?.pinnedTimers?.global || [];
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function timerRow(timer, remaining, now) {
    return `
        <div class="row tw-list-item do-action-cursor ${now >= timer.minTime ? 'short' : 'long'}">
            <div class="col">
                <div class="name cell">
                    <div class="name-val" title="${timer.name}">${timer.name}</div>
                </div>
            </div>
            <div class="col">
                <div class="time cell">
                    <div class="btn btn-opt disabled" style="display: none;"></div>
                    <div class="btn btn-del ie-icon ie-icon-close" style="display: none;"></div>
                    <div class="time-val">${formatHMS(remaining)}</div>
                </div>
            </div>
        </div>
    `;
}

export default {
    id: 'pinned-timer',
    name: 'Pinned timer',
    description: 'Dodatek wyświetla w oddzielnym oknie przypięte timery z LootLoga.',

    run() {
        injectStyle(CSS);

        const savedPos = loadJSON(POS_KEY, { top: '493px', left: '391px' });
        const savedSize = loadJSON(SIZE_KEY, { height: '180px', width: '220px' });
        let isCollapsed = loadFlag(COLLAPSED_KEY);
        let isLoading = true;
        const timers = new Map();

        const panel = document.createElement('div');
        panel.id = 'llPinnedTimersPanel';
        panel.className = 'c-window border-window ui-draggable transparent elite-timer window-on-peak';
        panel.style.cssText = `
            position: absolute !important;
            z-index: 100 !important;
            left: ${savedPos.left};
            top: ${savedPos.top};
            width: ${savedSize.width || '220px'} !important;
            height: ${savedSize.height || '180px'} !important;
            min-width: 242px !important;
            min-height: 28px !important;
            display: flex !important;
            flex-direction: column !important;
            resize: both !important;
            overflow: hidden !important;
        `;
        panel.innerHTML = PANEL_HTML;
        document.body.appendChild(panel);

        const scrollPane = panel.querySelector('#ll-scroll-pane');
        const listEl = panel.querySelector('#ll-timers-list');
        const emptyEl = panel.querySelector('#ll-empty-msg');
        const headerText = panel.querySelector('#llWidgetHeaderText');
        const contentEl = panel.querySelector('#llWidgetContent');
        const toggleBtn = panel.querySelector('#llWidgetToggle');
        const iconEl = toggleBtn.querySelector('.ie-icon');

        scrollPane.addEventListener('wheel', e => {
            e.stopPropagation();
            scrollPane.scrollTop += e.deltaY;
        }, { passive: true });

        new ResizeObserver(() => {
            const { height, width } = panel.style;
            if (!isCollapsed && height && height !== COLLAPSED_HEIGHT) saveJSON(SIZE_KEY, { height, width });
        }).observe(panel);

        setupOpacityButton(panel, panel.querySelector('#llWidgetOpacityBtn'), OPACITY_KEY, 3);
        makeDraggable(panel, { handle: panel.querySelector('#llWidgetHeader'), storageKey: POS_KEY, threshold: 0 });

        iconEl.style.transition = 'transform 0.3s ease';

        function applyCollapseState() {
            if (isCollapsed) {
                panel.dataset.prevHeight = panel.style.height || savedSize.height;
                panel.style.setProperty('height', COLLAPSED_HEIGHT, 'important');
                panel.style.setProperty('resize', 'none', 'important');
                contentEl.style.setProperty('display', 'none', 'important');
                iconEl.style.transform = 'rotate(45deg)';
            } else {
                panel.style.setProperty('height', panel.dataset.prevHeight || savedSize.height, 'important');
                panel.style.setProperty('resize', 'both', 'important');
                contentEl.style.setProperty('display', 'flex', 'important');
                iconEl.style.transform = 'rotate(0deg)';
            }
        }
        applyCollapseState();

        toggleBtn.onclick = e => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            saveFlag(COLLAPSED_KEY, isCollapsed);
            applyCollapseState();
        };

        function updateCountdown() {
            if (isLoading) {
                headerText.innerText = 'Przypięte Timery (...)';
                listEl.innerHTML = '<div style="text-align: center; padding: 10px;">Ładowanie...</div>';
                return;
            }

            const now = Date.now();
            let html = '';
            let activeCount = 0;

            [...timers.entries()]
                .sort((a, b) => a[1].maxTime - b[1].maxTime)
                .forEach(([key, timer]) => {
                    const remaining = Math.floor((timer.maxTime - now) / 1000);
                    if (remaining <= 0) return timers.delete(key);
                    activeCount++;
                    html += timerRow(timer, remaining, now);
                });

            headerText.innerText = `Przypięte Timery (${activeCount})`;
            emptyEl.style.display = activeCount === 0 ? 'block' : 'none';
            listEl.innerHTML = html;
        }

        function syncAndRender() {
            const pinned = getPinnedNames();
            const bossTimers = getBossTimers();
            const now = Date.now();
            if (bossTimers.length > 0) isLoading = false;

            bossTimers.forEach(timer => {
                if (!pinned.some(p => sameName(p, timer.name))) return;
                if (!isNaN(timer.maxTime) && timer.maxTime > now) timers.set(timer.key, timer);
            });
            updateCountdown();
        }

        setTimeout(() => {
            isLoading = false;
            syncAndRender();
        }, 3000);
        setInterval(syncAndRender, 1000);
    },
};
