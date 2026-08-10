(function() {
    'use strict';

    let isLoading = true;

    function getWorldName() {
        if (window.Engine?.worldConfig?.getWorldName) {
            return window.Engine.worldConfig.getWorldName();
        }
        if (window.g?.worldname) {
            return window.g.worldname;
        }
        const host = window.location.hostname;
        const parts = host.split('.');
        return parts.length > 2 ? parts[0] : '';
    }

    function getPinnedNames() {
        try {
            const rawData = localStorage.getItem('ll-timers-state');
            if (!rawData) return [];
            const data = JSON.parse(rawData);
            return data?.state?.pinnedTimers?.global || [];
        } catch (e) {
            console.error('Błąd odczytu ll-timers-state:', e);
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
        if (totalSeconds <= 0) return "00:00";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);

        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    const savedPos = JSON.parse(localStorage.getItem('ll_pinned_widget_pos')) || { top: "100px", left: "100px" };
    const savedSize = JSON.parse(localStorage.getItem('ll_pinned_widget_size')) || { width: "250px", height: "300px" };
    const savedOpacityLvl = localStorage.getItem('ll_pinned_widget_opacity') || "0";

    const panel = document.createElement('div');
    panel.id = "llPinnedTimersPanel";
    panel.className = "c-window border-window ui-draggable transparent window-on-peak";
    panel.setAttribute('data-opacity-lvl', savedOpacityLvl);

    panel.style.cssText = `
        position: absolute !important;
        z-index: 100 !important;
        left: ${savedPos.left};
        top: ${savedPos.top};
        width: ${savedSize.width} !important;
        height: ${savedSize.height} !important;
        min-width: 130px !important;
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
                <div class="text" id="llWidgetHeaderText">Przypięte timery (...)</div>
            </div>
        </div>
        <div class="content" id="llWidgetContent" style="flex: 1; height: 100%; min-height: 0;">
            <div class="inner-content" style="display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
                <div class="scroll-wrapper small-bar" style="flex: 1; height: 100%; min-height: 0; overflow-y: auto;">
                    <div class="scroll-pane" style="position: relative; width: 100%;">
                        <div id="ll-timers-grid" style="
                            padding: 2px;
                            display: grid;
                            grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
                            gap: 3px;
                        ">
                            <div style="color: #eaeaea; grid-column: 1 / -1; text-align: center; padding-top: 15px; font-size: 11px;">Ładowanie timerów...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="close-button-corner-decor">
            <button type="button" class="close-button" id="llWidgetToggle"><div class="ie-icon ie-icon-close"></div></button>
        </div>
        <div class="border-image"></div>
        <div class="transparent-window-buttons-menu">
            <div class="increase-opacity" id="llWidgetOpacityBtn" title="Zmień przezroczystość"></div>
        </div>
    `;
    document.body.appendChild(panel);

    const resizeObserver = new ResizeObserver(() => {
        if (!isCollapsed) {
            const w = panel.style.width;
            const h = panel.style.height;
            if (w && h) {
                localStorage.setItem('ll_pinned_widget_size', JSON.stringify({ width: w, height: h }));
            }
        }
    });
    resizeObserver.observe(panel);

    document.getElementById('llWidgetOpacityBtn').onclick = (e) => {
        e.stopPropagation();
        let currentLvl = parseInt(panel.getAttribute('data-opacity-lvl')) || 0;
        let nextLvl = (currentLvl + 1) % 6;
        panel.setAttribute('data-opacity-lvl', nextLvl);
        localStorage.setItem('ll_pinned_widget_opacity', nextLvl);
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
        let newX = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - startX));
        let newY = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, e.clientY - startY));
        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            localStorage.setItem('ll_pinned_widget_pos', JSON.stringify({ top: panel.style.top, left: panel.style.left }));
        }
    });

    let isCollapsed = localStorage.getItem('ll_widget_collapsed') === 'true';
    const toggleBtn = document.getElementById('llWidgetToggle');
    const iconEl = toggleBtn.querySelector('.ie-icon');
    iconEl.style.transition = 'transform 0.3s ease';

    if (isCollapsed) {
        panel.dataset.prevHeight = savedSize.height;
        panel.style.setProperty('height', '28px', 'important');
        panel.style.setProperty('resize', 'none', 'important');
        iconEl.style.transform = 'rotate(45deg)';
    }

    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        isCollapsed = !isCollapsed;
        localStorage.setItem('ll_widget_collapsed', isCollapsed);

        if (isCollapsed) {
            panel.dataset.prevHeight = panel.style.height;
            panel.style.setProperty('height', '28px', 'important');
            panel.style.setProperty('resize', 'none', 'important');
            iconEl.style.transform = 'rotate(45deg)';
        } else {
            const restoredHeight = panel.dataset.prevHeight || '300px';
            panel.style.setProperty('height', restoredHeight, 'important');
            panel.style.setProperty('resize', 'both', 'important');
            iconEl.style.transform = 'rotate(0deg)';
        }
    };

    let timerDataMap = new Map();

    function syncAndRender() {
        const pinnedNames = getPinnedNames();
        const rawTimers = getRawTimers();
        const now = Date.now();

        if (rawTimers.length > 0) {
            isLoading = false;
        }

        rawTimers.forEach(item => {
            const npcName = item.npc?.name;
            if (!npcName) return;

            const isPinned = pinnedNames.some(p => p.trim().toLowerCase() === npcName.trim().toLowerCase());
            if (!isPinned) return;

            const maxTime = new Date(item.maxSpawnTime).getTime();
            const minTime = item.minSpawnTime ? new Date(item.minSpawnTime).getTime() : maxTime;

            if (maxTime - now > 0) {
                timerDataMap.set(item.timerKey || `${item.npcId}:${npcName}`, {
                    name: npcName,
                    lvl: item.npc?.lvl || '',
                    minTime: minTime,
                    maxTime: maxTime
                });
            }
        });

        updateCountdown();
    }

    function updateCountdown() {
        const grid = document.getElementById('ll-timers-grid');
        const headerText = document.getElementById('llWidgetHeaderText');

        if (isLoading) {
            if (headerText) headerText.innerText = `Przypięte timery (...)`;
            grid.innerHTML = `<div style="color: #eaeaea; grid-column: 1 / -1; text-align: center; padding-top: 15px; font-size: 11px;">Ładowanie timerów...</div>`;
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
            const formatted = formatTime(remainingMax);
            const timerColor = isMinReached ? '#ff9800' : '#ffffff';

            html += `
                <div style="
                    background: rgba(86, 86, 86, 0.5);
                    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.23) inset, 0 0 0 1px rgba(0, 0, 0, 0.55);
                    border-radius: 3px;
                    padding: 2px 3px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                    text-align: center;
                    min-width: 0;
                ">
                    <div style="
                        color: #ffffff;
                        font-weight: 300;
                        font-size: 10px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        width: 100%;
                        line-height: 1.1;
                    ">
                        ${timer.name} ${timer.lvl ? `<span style="color: #aaa; font-size: 9px;">(${timer.lvl})</span>` : ''}
                    </div>
                    <div style="
                        color: ${timerColor};
                        font-family: monospace;
                        font-size: 9px;
                        font-weight: 300;
                        line-height: 1.1;
                        margin-top: 1px;
                    ">
                        ${formatted}
                    </div>
                </div>
            `;
        });

        if (headerText) {
            headerText.innerText = `Przypięte timery (${activeCount})`;
        }

        if (activeCount === 0) {
            grid.innerHTML = `<div style="color: #888; grid-column: 1 / -1; text-align: center; padding-top: 15px; font-size: 10px;">Brak aktywnych timerów</div>`;
        } else {
            grid.innerHTML = html;
        }
    }

    setTimeout(() => {
        isLoading = false;
        syncAndRender();
    }, 4000);

    setInterval(syncAndRender, 1000);
    setInterval(updateCountdown, 1000);
})();
