(function() {
    'use strict';

    let isLoading = true;

    function getWorldName() {
        if (window.Engine?.worldConfig?.getWorldName) return window.Engine.worldConfig.getWorldName();
        if (window.g?.worldname) return window.g.worldname;
        const host = window.location.hostname.split('.');
        return host.length > 2 ? host[0] : '';
    }

    function getPinnedNames() {
        try {
            const rawData = localStorage.getItem('ll-timers-state');
            if (!rawData) return [];
            return JSON.parse(rawData)?.state?.pinnedTimers?.global || [];
        } catch (e) {
            return [];
        }
    }

    function getRawTimers() {
        const world = getWorldName();
        if (window.lootlogGameClientApi && typeof window.lootlogGameClientApi.getTimers === 'function') {
            return window.lootlogGameClientApi.getTimers({ world }) || [];
        }
        return [];
    }

    function formatTime(totalSeconds) {
        if (totalSeconds <= 0) return "00:00:00";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    const customStyle = document.createElement('style');
    customStyle.innerHTML = `
        #llPinnedTimersPanel .scroll-pane {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            height: 100% !important;
        }
        #llPinnedTimersPanel .scroll-pane::-webkit-scrollbar { width: 4px !important; }
        #llPinnedTimersPanel .scroll-pane::-webkit-scrollbar-track { background: rgba(0,0,0,0.4) !important; }
        #llPinnedTimersPanel .scroll-pane::-webkit-scrollbar-thumb { background: #5a4734 !important; }
    `;
    document.head.appendChild(customStyle);

    const savedPos = JSON.parse(localStorage.getItem('ll_pinned_widget_pos')) || { top: "493px", left: "391px" };
    const savedSize = JSON.parse(localStorage.getItem('ll_pinned_widget_size')) || { height: "180px", width: "220px" };
    const savedOpacityLvl = localStorage.getItem('ll_pinned_widget_opacity') || "3";

    const panel = document.createElement('div');
    panel.id = "llPinnedTimersPanel";
    panel.className = "c-window border-window ui-draggable transparent elite-timer window-on-peak";
    panel.setAttribute('data-opacity-lvl', savedOpacityLvl);
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

    panel.innerHTML = `
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
    document.body.appendChild(panel);

    const scrollPane = document.getElementById('ll-scroll-pane');
    scrollPane.addEventListener('wheel', (e) => {
        e.stopPropagation();
        scrollPane.scrollTop += e.deltaY;
    }, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
        if (!isCollapsed) {
            const h = panel.style.height;
            const w = panel.style.width;
            if (h && h !== '28px') localStorage.setItem('ll_pinned_widget_size', JSON.stringify({ height: h, width: w }));
        }
    });
    resizeObserver.observe(panel);

    document.getElementById('llWidgetOpacityBtn').onclick = (e) => {
        e.stopPropagation();
        let lvl = (parseInt(panel.getAttribute('data-opacity-lvl')) || 0) + 1;
        panel.setAttribute('data-opacity-lvl', lvl % 6);
        localStorage.setItem('ll_pinned_widget_opacity', lvl % 6);
    };

    const header = document.getElementById('llWidgetHeader');
    let isDragging = false, startX, startY;
    header.onmousedown = (e) => {
        isDragging = true;
        startX = e.clientX - panel.offsetLeft;
        startY = e.clientY - panel.offsetTop;
        e.preventDefault();
    };

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - startX)) + 'px';
        panel.style.top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, e.clientY - startY)) + 'px';
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            localStorage.setItem('ll_pinned_widget_pos', JSON.stringify({ top: panel.style.top, left: panel.style.left }));
        }
    });

    let isCollapsed = localStorage.getItem('ll_widget_collapsed') === 'true';
    const toggleBtn = document.getElementById('llWidgetToggle');
    const contentEl = document.getElementById('llWidgetContent');
    const iconEl = toggleBtn.querySelector('.ie-icon');
    iconEl.style.transition = 'transform 0.3s ease';

    function applyCollapseState() {
        if (isCollapsed) {
            panel.dataset.prevHeight = panel.style.height || savedSize.height;
            panel.style.setProperty('height', '28px', 'important');
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

    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        isCollapsed = !isCollapsed;
        localStorage.setItem('ll_widget_collapsed', isCollapsed);
        applyCollapseState();
    };

    let timerDataMap = new Map();

    function syncAndRender() {
        const pinnedNames = getPinnedNames();
        const rawTimers = getRawTimers();
        const now = Date.now();

        if (rawTimers.length > 0) isLoading = false;

        rawTimers.forEach(item => {
            const npcName = item.npc?.name;
            if (!npcName) return;

            if (!pinnedNames.some(p => p.trim().toLowerCase() === npcName.trim().toLowerCase())) return;

            const maxTime = new Date(item.maxSpawnTime).getTime();
            const minTime = item.minSpawnTime ? new Date(item.minSpawnTime).getTime() : maxTime;

            if (!isNaN(maxTime) && maxTime > now) {
                timerDataMap.set(item.timerKey || `${item.npcId}:${npcName}`, {
                    name: npcName,
                    minTime: minTime,
                    maxTime: maxTime
                });
            }
        });

        updateCountdown();
    }

function updateCountdown() {
        const listEl = document.getElementById('ll-timers-list');
        const emptyEl = document.getElementById('ll-empty-msg');
        const headerText = document.getElementById('llWidgetHeaderText');

        if (isLoading) {
            if (headerText) headerText.innerText = `Przypięte Timery (...)`;
            listEl.innerHTML = `<div style="text-align: center; padding: 10px;">Ładowanie...</div>`;
            return;
        }

        const now = Date.now();
        let activeCount = 0;
        let html = '';

        const sortedTimers = Array.from(timerDataMap.entries()).sort((a, b) => a[1].maxTime - b[1].maxTime);

        sortedTimers.forEach(([key, timer]) => {
            const remainingMax = Math.floor((timer.maxTime - now) / 1000);

            if (remainingMax <= 0) {
                timerDataMap.delete(key);
                return;
            }

            activeCount++;

            const isMinReached = now >= timer.minTime;
            const timerClass = isMinReached ? 'short' : 'long';

            html += `
                <div class="row tw-list-item do-action-cursor ${timerClass}">
                    <div class="col">
                        <div class="name cell">
                            <div class="name-val" title="${timer.name}">${timer.name}</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="time cell">
                            <div class="btn btn-opt disabled" style="display: none;"></div>
                            <div class="btn btn-del ie-icon ie-icon-close" style="display: none;"></div>
                            <div class="time-val">${formatTime(remainingMax)}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        if (headerText) headerText.innerText = `Przypięte Timery (${activeCount})`;

        if (activeCount === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
        } else {
            emptyEl.style.display = 'none';
            listEl.innerHTML = html;
        }
    }
    setTimeout(() => {
        isLoading = false;
        syncAndRender();
    }, 3000);

    setInterval(syncAndRender, 1000);
    setInterval(updateCountdown, 1000);
})();
