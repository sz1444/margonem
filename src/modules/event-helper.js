import { win } from '../core/env.js';
import { injectStyle, isTypingTarget } from '../core/dom.js';
import { getHeroName, getMapName } from '../core/game.js';
import { loadJSON, saveJSON, loadFlag } from '../core/storage.js';
import { getBossTimers } from '../core/lootlog.js';
import { formatHMS, formatElapsed } from '../core/format.js';
import { makeDraggable, makeResizable } from '../core/drag.js';
import { setupOpacityButton, showTooltip, hideTooltip, tooltipList } from '../core/ui.js';
import { getDiscordToken, clearDiscordToken, redirectToDiscordLogin, openSyncSocket, sendJSON } from '../core/sync.js';

const BACKEND_URL = 'https://margone-api-2.onrender.com';
const DATA_URL = 'https://margonem.vercel.app/data.json';
const DEFAULT_HEIGHT = '380px';
const MIN_HEIGHT = '28px';

const POS_KEY = 'mapSyncPos';
const SIZE_KEY = 'mapSyncSize';
const MINIMIZED_KEY = 'mapSyncIsMin';
const OPACITY_KEY = 'mapSyncOpacityLvl';
const TAB_KEY = 'mapSync_currentTab';
const ALERT_KEY = 'mapsync-userKey';

const ICON_ONE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="#22c55e" style="filter: drop-shadow(0 0 3px rgba(34,197,94,0.6)); vertical-align:middle;" title="1 osoba"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
const ICON_TWO = '<svg width="14" height="12" viewBox="0 0 24 24" fill="#22c55e" style="filter: drop-shadow(0 0 3px rgba(34,197,94,0.6)); vertical-align:middle;" title="2 osoby"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>';

const CSS = `
    #mapSyncContainer .content {
        position: absolute !important; top: 28px !important; bottom: 0 !important; left: 0 !important; right: 0 !important;
        height: auto !important; box-sizing: border-box !important;
    }
    #mapSyncContainer .inner-content {
        position: absolute !important; top: 0 !important; bottom: 0 !important; left: 0 !important; right: 0 !important;
        height: auto !important; box-sizing: border-box !important;
    }
    #mapSyncContainer .tab-content {
        position: absolute !important; top: 6px !important; bottom: 6px !important; left: 6px !important; right: 6px !important;
        height: auto !important; display: flex !important; flex-direction: column !important; box-sizing: border-box !important;
    }
    #mapSyncContainer .scroll-wrapper.small-bar {
        position: relative !important; flex-grow: 1 !important; height: auto !important; overflow: hidden !important; min-height: 0 !important;
    }
    #mapSyncListContainer {
        position: absolute !important; top: 0 !important; bottom: 0 !important; left: 0 !important; right: 0 !important;
        height: auto !important; overflow-y: auto !important; padding-right: 4px !important; box-sizing: border-box !important;
    }
    #mapSyncListContainer::-webkit-scrollbar { width: 4px; }
    #mapSyncListContainer::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
    .map-row { display: flex; justify-content: space-between; align-items: center; padding: 0px 2px; margin-bottom: 3px; border-radius: 3px; font-size: 11px; cursor: help; }
    .m-name-container { display: flex; align-items: center; flex-grow: 1; overflow: hidden; padding-right: 6px; pointer-events: none; }
    .m-occ { width: 16px; display: inline-block; text-align: center; font-size: 10px; margin-right: 4px; }
    .m-name { color: #eaeaea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold; }
    .m-timer { font-family: monospace; font-size: 10px; font-weight: bold; min-width: 32px; text-align: right; }
    .nav-btn { background: transparent; border: 0; color: #8b8b8b; transition: all 0.2s ease; }
    .nav-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .nav-btn.active { color: gold !important; }
    #minBtn { transition: transform 0.3s ease; }
`;

const containerHtml = isMinimized => `
    <div class="header-label-positioner" id="dragHandle" style="cursor: move;">
        <div class="draggable-window-element ui-draggable-handle"></div>
        <div class="header-label">
            <div class="left-decor"></div>
            <div class="right-decor"></div>
            <div class="text" id="windowTitleText" style="display: flex; align-items: center; gap: 4px; justify-content: center;">
                <span id="tabTitleSpan">Event Heros Helper</span>
            </div>
        </div>
    </div>
    <div class="content" id="windowContent">
        <div class="inner-content">
            <div class="tab-content">
                <div style="display: flex; gap: 3px; margin-bottom: 6px; padding: 0;" id="tabsHeader">
                    <button id="filterBtn" class="nav-btn" style="cursor: pointer; padding: 3px 6px; font-size: 10px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 3px;">⌛</button>
                </div>
                <div class="scroll-wrapper small-bar" style="position: relative;">
                    <div class="scroll-pane" id="mapSyncListContainer">
                        <div class="player-list" id="mList"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="close-button-corner-decor">
        <button type="button" class="close-button" id="minBtn" style="transform: ${isMinimized ? 'rotate(45deg)' : 'rotate(0deg)'};"><div class="ie-icon ie-icon-close"></div></button>
    </div>
    <div class="border-image"></div>
    <div class="transparent-window-buttons-menu">
        <div class="increase-opacity" id="opacityBtn"></div>
    </div>
    <div id="resizeHandle" style="position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; z-index: 20;"></div>
`;

/** "Boss (Nazwa)" → "Nazwa" */
const tabNameOf = col => col.boss_name.match(/\((.*?)\)/)?.[1] ?? col.id;

function getMapNameWithXY() {
    const x = Math.floor(win.Engine?.hero?.rx) || '?';
    const y = Math.floor(win.Engine?.hero?.ry) || '?';
    return `${getMapName()} (${x}, ${y})`;
}

function showGlobalModal(data) {
    if (!data?.text) return;
    document.getElementById('globalAlertModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'globalAlertModal';
    modal.style.cssText = `position: fixed; top: 15%; left: 50%; transform: translateX(-50%); background: rgba(18, 18, 18, 0.95); color: #f8fafc; padding: 12px 22px; z-index: 30000; border-radius: 8px; font-family: 'Verdana', sans-serif; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.6); pointer-events: none; border: 1px solid rgba(255,255,255,0.08); border-left: 4px solid #ef4444;`;
    modal.innerHTML = `
        <div class="close-alert" style="position: absolute; top: 4px; right: 8px; cursor: pointer; font-size: 14px; opacity: 0.6; pointer-events: auto;">×</div>
        <div style="font-size: 9px; opacity: 0.5; margin-bottom: 2px; text-transform: uppercase;">${data.sender}</div>
        <div style="font-size: 12px;">${data.text}</div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-alert').onclick = () => modal.remove();
    setTimeout(() => modal.remove(), 5000);
}

export default {
    id: 'map_sync',
    name: 'Event HEROS Helper',
    description: 'Obstawiaj herosa na mapie eventowej, synchronizuj z innymi graczami i sprawdzaj, kto jest na której mapie.',

    run() {
        let socket = null;
        let discordToken = getDiscordToken();
        let cachedData = {};
        let currentMyId = null;
        let filterActive = false;
        let columnsData = [];
        let currentTab = parseInt(localStorage.getItem(TAB_KEY)) || 0;
        let tabButtons = [];
        let loopsStarted = false;

        injectStyle(CSS);

        const savedPos = loadJSON(POS_KEY, { top: '282px', left: '355px' });
        const savedSize = loadJSON(SIZE_KEY, { width: '280px', height: DEFAULT_HEIGHT });
        const isSavedMinimized = loadFlag(MINIMIZED_KEY);

        const container = document.createElement('div');
        container.id = 'mapSyncContainer';
        container.className = 'c-window border-window ui-draggable transparent';
        container.dataset.prevHeight = savedSize.height && savedSize.height !== MIN_HEIGHT ? savedSize.height : DEFAULT_HEIGHT;
        container.style.cssText = `position: absolute; z-index: 19; display: block; left: ${savedPos.left}; top: ${savedPos.top}; width: ${savedSize.width}; height: ${isSavedMinimized ? MIN_HEIGHT : container.dataset.prevHeight};`;
        container.innerHTML = containerHtml(isSavedMinimized);
        document.body.appendChild(container);

        const $ = sel => container.querySelector(sel);
        const mList = $('#mList');
        const tabsHeader = $('#tabsHeader');
        const filterBtn = $('#filterBtn');
        const listContainer = $('#mapSyncListContainer');

        const isMinimized = () => container.style.height === MIN_HEIGHT;

        // --- okno ---

        makeDraggable(container, { handle: $('#dragHandle'), storageKey: POS_KEY, threshold: 0 });
        makeResizable(container, $('#resizeHandle'), {
            minWidth: 200,
            minHeight: 150,
            lockHeight: isMinimized,
            onEnd: size => saveJSON(SIZE_KEY, size),
        });
        setupOpacityButton(container, $('#opacityBtn'), OPACITY_KEY, 4);

        $('#minBtn').onclick = function () {
            if (!isMinimized() && container.offsetHeight > 30) {
                container.dataset.prevHeight = container.style.height;
                container.style.height = MIN_HEIGHT;
                this.style.transform = 'rotate(45deg)';
                localStorage.setItem(MINIMIZED_KEY, 'true');
            } else {
                const restored = container.dataset.prevHeight && container.dataset.prevHeight !== MIN_HEIGHT
                    ? container.dataset.prevHeight
                    : DEFAULT_HEIGHT;
                container.style.height = restored;
                this.style.transform = 'rotate(0deg)';
                localStorage.setItem(MINIMIZED_KEY, 'false');
                saveJSON(SIZE_KEY, { width: container.style.width, height: restored });
            }
        };

        filterBtn.onclick = () => {
            filterActive = !filterActive;
            filterBtn.style.backgroundColor = filterActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent';
            filterBtn.style.borderRadius = '3px';
            if (filterActive) updateMapColors();
            else render();
        };

        listContainer.addEventListener('wheel', e => e.stopPropagation(), { passive: false });

        // --- dane z serwera ---

        function sync(id, val) {
            sendJSON(socket, { type: 'update_cell', id, val, ts: val !== '' ? Date.now() : 0 });
        }

        function sendGlobalAlert(text) {
            sendJSON(socket, { type: 'send_alert', data: { text, sender: getHeroName('???'), ts: Date.now() } });
        }

        function getCell(id) {
            return cachedData[id] || { val: '', ts: 0 };
        }

        function rowCells(row) {
            return JSON.parse(row.getAttribute('data-ids')).map(getCell);
        }

        function showLoginModal() {
            if (document.getElementById('mapSyncLoginOverlay')) return;
            const overlay = document.createElement('div');
            overlay.id = 'mapSyncLoginOverlay';
            overlay.style.cssText = `
                display: flex; position: absolute; flex-direction: column; align-items: center; justify-content: center;
                width: 100%; height: 100%; left: 0; top: 0;
                background-color: rgba(15, 15, 15, 0.85); z-index: 10;
                text-align: center; padding: 10px; box-sizing: border-box;
            `;
            overlay.innerHTML = `
                <div style="color: #e2e8f0; font-size: 12px; font-weight: 500; margin-bottom: 10px;">
                    Zaloguj się przez Discord, aby zobaczyć mapy
                </div>
                <button style="background: #5865f2; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px;">
                    Połącz konto
                </button>
            `;
            overlay.querySelector('button').onclick = redirectToDiscordLogin;
            listContainer.appendChild(overlay);
        }

        function initSocket() {
            if (!discordToken) return showLoginModal();

            socket = openSyncSocket(BACKEND_URL, discordToken);

            socket.onopen = () => {
                document.getElementById('mapSyncLoginOverlay')?.remove();
                if (loopsStarted) return;
                loopsStarted = true;
                setInterval(autoMapCheck, 1000);
                setInterval(() => {
                    if (currentMyId) sendJSON(socket, { type: 'heartbeat', nick: getHeroName('???'), id: currentMyId });
                }, 1000);
            };

            socket.onmessage = event => {
                const msg = JSON.parse(event.data);
                if (msg.type === 'auth_error') {
                    clearDiscordToken();
                    discordToken = null;
                    showLoginModal();
                } else if (msg.type === 'init_data') {
                    cachedData = msg.data || {};
                    render();
                } else if (msg.type === 'cell_updated') {
                    cachedData[msg.id] = { val: msg.val, ts: msg.ts };
                    updateMapColors();
                } else if (msg.type === 'global_alert') {
                    showGlobalModal(msg.data);
                }
            };

            socket.onclose = e => {
                if (e.code === 4001) {
                    clearDiscordToken();
                    showLoginModal();
                } else {
                    setTimeout(initSocket, 5000);
                }
            };
        }

        /** Zajmuje slot na mapie, na której stoi bohater (jeden z dwóch na mapę). */
        function autoMapCheck() {
            const currentMap = getMapName();
            const myNick = getHeroName('???');
            let found = false;

            columnsData.forEach(col => {
                col.maps.forEach((mapData, i) => {
                    if (mapData[0] !== currentMap) return;
                    found = true;

                    const id1 = `${col.id}${i}_1`, id2 = `${col.id}${i}_2`;
                    const d1 = getCell(id1), d2 = getCell(id2);

                    if (d1.val === myNick || d2.val === myNick) {
                        currentMyId = d1.val === myNick ? id1 : id2;
                        cachedData[currentMyId].ts = Date.now();
                        return;
                    }

                    if (!d1.val) currentMyId = id1;
                    else if (!d2.val) currentMyId = id2;
                    else currentMyId = d1.ts <= d2.ts ? id1 : id2;

                    sync(currentMyId, myNick);
                    cachedData[currentMyId] = { val: myNick, ts: Date.now() };
                });
            });

            if (!found) currentMyId = null;
        }

        // --- render ---

        function renderTabs() {
            tabsHeader.innerHTML = '';
            tabButtons = columnsData.map((col, index) => {
                const btn = document.createElement('button');
                btn.className = 'nav-btn';
                btn.dataset.fullBossName = col.boss_name ? col.boss_name.toLowerCase() : '';
                btn.dataset.tabName = tabNameOf(col);
                btn.innerHTML = `
                    <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; letter-spacing: 0.3px;">${tabNameOf(col)}</span>
                    <span class="tab-timer-span" style="font-size: 9.5px; font-weight: 500; line-height: 1.2; margin-top: 1px; color: #64748b; opacity: 0.4;">brak</span>
                `;
                btn.onclick = () => {
                    currentTab = index;
                    localStorage.setItem(TAB_KEY, currentTab);
                    updateTabTimers();
                    render();
                };
                tabsHeader.appendChild(btn);
                return btn;
            });
            tabsHeader.appendChild(filterBtn);
            updateTabTimers();
        }

        function updateTabTimers() {
            const now = Date.now();
            const timers = getBossTimers().filter(t => !isNaN(t.maxTime) && t.maxTime > now);

            tabButtons.forEach((btn, index) => {
                const { fullBossName, tabName } = btn.dataset;
                const timer = timers.find(t => {
                    const key = t.name.trim().toLowerCase();
                    return fullBossName.includes(key) || key.includes(fullBossName) || tabName.toLowerCase().includes(key);
                });

                let text = '';
                let color = '#64748b';
                if (timer && now < timer.minTime) {
                    text = formatHMS(Math.floor((timer.minTime - now) / 1000));
                    color = '#ffffff';
                } else if (timer) {
                    text = formatHMS(Math.floor((timer.maxTime - now) / 1000));
                    color = '#f98509';
                }

                btn.classList.toggle('active', index === currentTab);
                btn.style.cssText = `
                    flex: 1; cursor: pointer; padding: 4px 2px; font-size: 10px;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    overflow: hidden; box-sizing: border-box; border-radius: 4px;
                    background: ${index === currentTab ? 'rgba(100, 116, 139, 0.4)' : 'rgba(0, 0, 0, 0.2)'};
                    transition: all 0.2s ease;
                `;

                const span = btn.querySelector('.tab-timer-span');
                span.style.color = color;
                span.style.opacity = text ? '1' : '0.4';
                span.innerText = text || 'brak';
            });
        }

        function render() {
            mList.innerHTML = '';
            const activeCol = columnsData[currentTab];
            if (!activeCol) return;

            $('#tabTitleSpan').innerText = `Event Heros Helper (${tabNameOf(activeCol)})`;

            (activeCol.maps || []).forEach(([mapName, mapColor], i) => {
                const rowId = `${activeCol.id}${i}`;
                const row = document.createElement('div');
                row.className = 'map-row one-other tw-list-item';
                row.id = `row_${rowId}`;
                row.setAttribute('data-ids', JSON.stringify([`${rowId}_1`, `${rowId}_2`]));
                row.innerHTML = `
                    <div class="m-name-container">
                        <span class="m-occ" id="occ_${rowId}"></span>
                        <span class="m-name" style="color: ${mapColor}">${mapName}</span>
                    </div>
                    <span class="m-timer" id="timer_${rowId}">--:--</span>
                `;

                row.oncontextmenu = e => {
                    e.preventDefault();
                    e.stopPropagation();
                    sendGlobalAlert(`Nikogo nie ma na <b style="color:#ef4444">${mapName}</b>`);
                };
                row.onmouseenter = () => {
                    const occupants = rowCells(row).filter(d => d.val).map(d => ({ left: d.val }));
                    showTooltip(row, `<div>${tooltipList(occupants, 'Brak graczy na mapie')}</div>`);
                };
                row.onmouseleave = hideTooltip;

                mList.appendChild(row);
            });
            updateMapColors();
        }

        function updateMapColors() {
            const now = Date.now();
            const rows = [...mList.querySelectorAll('.map-row')];

            rows.forEach(row => {
                const cells = rowCells(row);
                const lastTs = Math.max(...cells.map(d => d.ts || 0));
                const occupants = cells.filter(d => d.val).length;
                row.setAttribute('data-last-ts', lastTs);

                row.querySelector('.m-occ').innerHTML = occupants >= 2 ? ICON_TWO : occupants === 1 ? ICON_ONE : '';

                const timerSpan = row.querySelector('.m-timer');
                let diff = -1;
                if (lastTs > 0) {
                    diff = Math.max(0, (now - lastTs) / 1000);
                    timerSpan.innerText = formatElapsed(diff);
                    timerSpan.style.color = diff < 90 ? '#22c55e' : diff < 180 ? '#eab308' : '#ef4444';
                } else {
                    timerSpan.innerText = '--:--';
                    timerSpan.style.color = '#475569';
                }

                // Filtr: chowa mapy sprawdzone w ciągu ostatnich 3 minut.
                row.style.display = filterActive && diff !== -1 && diff <= 180 ? 'none' : 'flex';
            });

            if (filterActive) {
                rows.sort((a, b) => parseInt(a.getAttribute('data-last-ts')) - parseInt(b.getAttribute('data-last-ts')))
                    .forEach(row => mList.appendChild(row));
            }
        }

        // --- skrót: wołanie o pomoc ---

        const assignedKey = localStorage.getItem(ALERT_KEY) || 'y';
        window.addEventListener('keydown', e => {
            if (isTypingTarget(e.target)) return;
            if (e.key.toLowerCase() === assignedKey) {
                sendGlobalAlert(`Potrzebna pomoc na: <b style="color:#ef4444">${getMapNameWithXY()}</b>`);
            }
        });

        setInterval(() => {
            updateTabTimers();
            updateMapColors();
        }, 1000);

        fetch(DATA_URL)
            .then(res => res.json())
            .then(config => {
                columnsData = config.columns || [];
                renderTabs();
                render();
                initSocket();
            })
            .catch(e => console.error('[Event Helper] data.json:', e));
    },
};
