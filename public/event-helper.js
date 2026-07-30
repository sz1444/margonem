(function() {
    'use strict';

    const BACKEND_URL = "https://margone-api-m207.onrender.com";
    const CLIENT_ID = "1488794373775687782";
    const REDIRECT_URI = encodeURIComponent(window.location.origin + window.location.pathname);
    const DISCORD_AUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=identify%20guilds.members.read`;

    let heartbeatInterval = null;
    let socket = null;
    let cachedData = {};
    let discordToken = localStorage.getItem('mapSync_dcToken');
    let currentMyId = null;
    let filterActive = false;
    let columnsData = [];

    function checkUrlForToken() {
        const hash = window.location.hash;
        if (hash.includes("access_token=")) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get("access_token");
            if (token) {
                localStorage.setItem('mapSync_dcToken', token);
                window.history.replaceState({}, document.title, window.location.pathname);
                return token;
            }
        }
        return null;
    }

    const tokenFromUrl = checkUrlForToken();
    if (tokenFromUrl) discordToken = tokenFromUrl;

    function showLoginModal() {
        const parentId = 'mapSyncListContainer';
        const parent = document.getElementById(parentId);
        if (!parent) return;

        const existing = document.getElementById('mapSyncLoginOverlay');
        if (existing) return;

        const overlay = document.createElement('div');
        overlay.id = "mapSyncLoginOverlay";
        overlay.style = `
            display: flex;
            position: absolute;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            left: 0;
            top: 0;
            background-color: rgba(15, 15, 15, 0.85);
            z-index: 10;
            text-align: center;
            padding: 10px;
            box-sizing: border-box;
        `;

        overlay.innerHTML = `
            <div style="color: #e2e8f0; font-size: 12px; font-weight: 500; margin-bottom: 10px;">
                Zaloguj się przez Discord, aby zobaczyć mapy
            </div>
            <button id="dcLoginBtn" style="
                background: #5865f2;
                color: #fff;
                border: none;
                padding: 6px 14px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                font-size: 11px;
            ">
                Połącz konto
            </button>
        `;

        parent.appendChild(overlay);

        const btn = document.getElementById('dcLoginBtn');
        if (btn) {
            btn.onclick = () => {
                window.location.href = DISCORD_AUTH_URL;
            };
        }
    }

    function initSocket() {
        if (!discordToken) {
            showLoginModal();
            return;
        }

        const wsUrl = BACKEND_URL.replace("http", "ws") + `?token=${discordToken}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            const loginOverlay = document.getElementById('mapSyncLoginOverlay');
            if (loginOverlay) loginOverlay.remove();
            startHeartbeat();
            setInterval(autoMapCheck, 1000);
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            if (msg.type === 'auth_error') {
                localStorage.removeItem('mapSync_dcToken');
                discordToken = null;
                showLoginModal();
                return;
            }

            if (msg.type === 'init_data') {
                cachedData = msg.data || {};
                render();
            }
            else if (msg.type === 'cell_updated') {
                cachedData[msg.id] = { val: msg.val, ts: msg.ts };
                updateMapColors();
            }
            else if (msg.type === 'global_alert') {
                showGlobalModal(msg.data);
            }
        };

        socket.onclose = (e) => {
            if (e.code === 4001) {
                localStorage.removeItem('mapSync_dcToken');
                showLoginModal();
            } else {
                setTimeout(initSocket, 5000);
            }
        };
    }

    async function sync(id, val) {
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'update_cell',
                id: id,
                val: val,
                ts: val !== "" ? Date.now() : 0
            }));
        }
    }

    async function sendGlobalAlert(message) {
        if (socket && socket.readyState === 1) {
            const data = {
                text: message,
                sender: getHeroName(),
                ts: Date.now()
            };
            socket.send(JSON.stringify({ type: 'send_alert', data }));
        }
    }

    let arkusz1 = [];
    let arkusz2 = [];
    let arkusz3 = [];

    async function loadData() {
        try {
            const response = await fetch('https://margonem.vercel.app/data.json');
            const config = await response.json();
            columnsData = config.columns || [];
            renderTabs();
            render();
            initSocket();
        } catch (e) { console.error("JSON error", e); }
    }

    function renderTabs() {
        const tabsHeader = document.getElementById('tabsHeader');
        const filterBtn = document.getElementById('filterBtn');
        tabsHeader.innerHTML = '';

        columnsData.forEach((col, index) => {
            const btn = document.createElement('button');
            btn.className = 'nav-btn';
            btn.style.cssText = 'flex: 1; cursor: pointer; padding: 3px; font-size: 10px;';

            const match = col.boss_name.match(/\((.*?)\)/);
            btn.innerText = match ? match[1] : col.id;

            btn.onclick = () => {
                currentTab = index;
                saveTab();
                updateBtn();
                render();
            };
            tabsHeader.appendChild(btn);
        });
        tabsHeader.appendChild(filterBtn);
        updateBtn();
    }

    function updateBtn() {
        const btns = document.querySelectorAll('#tabsHeader .nav-btn:not(#filterBtn)');
        btns.forEach((btn, idx) => {
            btn.classList.toggle('active', idx === currentTab);
        });
    }

    function showGlobalModal(data) {
        if (!data || !data.text) return;
        const existing = document.getElementById('globalAlertModal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = "globalAlertModal";
        modal.style = `position: fixed; top: 15%; left: 50%; transform: translateX(-50%); background: rgba(18, 18, 18, 0.95); color: #f8fafc; padding: 12px 22px; z-index: 30000; border-radius: 8px; font-family: 'Verdana', sans-serif; text-align: center; border-left: 4px solid #ef4444; box-shadow: 0 10px 25px rgba(0,0,0,0.6); pointer-events: none; border: 1px solid rgba(255,255,255,0.08); border-left-width: 4px;`;
        modal.innerHTML = `
            <div id="closeGlobalAlert" style="position: absolute; top: 4px; right: 8px; cursor: pointer; font-size: 14px; opacity: 0.6; pointer-events: auto;">×</div>
            <div style="font-size: 9px; opacity: 0.5; margin-bottom: 2px; text-transform: uppercase;">${data.sender}</div>
            <div style="font-size: 12px;">${data.text}</div>
        `;
        document.body.appendChild(modal);
        document.getElementById('closeGlobalAlert').onclick = () => modal.remove();
        setTimeout(() => { if(modal.parentNode) modal.remove(); }, 5000);
    }

    function getHeroName() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (win.Engine && win.Engine.hero && win.Engine.hero.d) return win.Engine.hero.d.nick;
        if (win.hero && win.hero.nick) return win.hero.nick;
        return "???";
    }

    const savedPos = JSON.parse(localStorage.getItem('mapSyncPos')) || { top: "282px", left: "355px" };
    const savedSize = JSON.parse(localStorage.getItem('mapSyncSize')) || { width: "280px", height: "380px" };
    const isSavedMinimized = localStorage.getItem('mapSyncIsMin') === 'true';
    let opacityLvl = parseInt(localStorage.getItem('mapSyncOpacityLvl')) || 4;

    const container = document.createElement('div');
    container.id = "mapSyncContainer";
    container.className = `c-window border-window ui-draggable transparent whoishere-window`;
    container.dataset.prevHeight = (savedSize.height && savedSize.height !== '28px') ? savedSize.height : '380px';
    container.setAttribute('data-opacity-lvl', opacityLvl);
    container.style = `position: absolute; z-index: 19; display: block; left: ${savedPos.left}; top: ${savedPos.top}; width: ${savedSize.width}; height: ${isSavedMinimized ? '28px' : container.dataset.prevHeight};`;

    container.innerHTML = `
        <div class="header-label-positioner" id="dragHandle" style="cursor: move;">
            <div class="draggable-window-element ui-draggable-handle"></div>
            <div class="header-label">
                <div class="left-decor"></div>
                <div class="right-decor"></div>
                <div class="text" id="windowTitleText" style="display: flex; align-items: center; gap: 4px; justify-content: center;">
                    <span id="tabTitleSpan">Event Heros Helper (173h)</span>
                </div>
            </div>
        </div>
        <div class="content" id="windowContent">
            <div class="inner-content">
                <div class="tab-content">

                    <div style="display: flex; gap: 4px; margin-bottom: 6px; padding: 0;" id="tabsHeader">
                        <button id="t1" class="nav-btn" style="flex: 1; cursor: pointer; padding: 3px; font-size: 10px;">114p</button>
                        <button id="t2" class="nav-btn" style="flex: 1; cursor: pointer; padding: 3px; font-size: 10px;">165h</button>
                        <button id="t3" class="nav-btn" style="flex: 1; cursor: pointer; padding: 3px; font-size: 10px;">284w</button>
                        <button id="filterBtn" class="nav-btn" style="cursor: pointer; padding: 3px 8px; font-size: 10px;">⌛</button>
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
            <button type="button" class="close-button" id="minBtn" style="transition: transform 0.3s ease; transform: ${isSavedMinimized ? 'rotate(45deg)' : 'rotate(0deg)'};"><div class="ie-icon ie-icon-close"></div></button>
        </div>
        <div class="border-image"></div>
        <div class="transparent-window-buttons-menu">
            <div class="increase-opacity" id="opacityBtn"></div>
        </div>
        <div id="resizeHandle" style="position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; z-index: 20;"></div>
    `;
    document.body.appendChild(container);

    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        #mapSyncContainer .content {
            position: absolute !important;
            top: 28px !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: auto !important;
            box-sizing: border-box !important;
        }
        #mapSyncContainer .inner-content {
            position: absolute !important;
            top: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: auto !important;
            box-sizing: border-box !important;
        }
        #mapSyncContainer .tab-content {
            position: absolute !important;
            top: 6px !important;
            bottom: 6px !important;
            left: 6px !important;
            right: 6px !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
        }
        #mapSyncContainer .scroll-wrapper.small-bar {
            position: relative !important;
            flex-grow: 1 !important;
            height: auto !important;
            overflow: hidden !important;
            min-height: 0 !important;
        }
        #mapSyncListContainer {
            position: absolute !important;
            top: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: auto !important;
            overflow-y: auto !important;
            padding-right: 4px !important;
            box-sizing: border-box !important;
        }
        #mapSyncListContainer::-webkit-scrollbar { width: 4px; }
        #mapSyncListContainer::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
        .map-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0px 2px;
            margin-bottom: 3px;
            border-radius: 3px;
            font-size: 11px;
            cursor: help;
        }
        .m-name-container { display: flex; align-items: center; flex-grow: 1; overflow: hidden; padding-right: 6px; pointer-events: none; }
        .m-occ { width: 16px; display: inline-block; text-align: center; font-size: 10px; margin-right: 4px; }
        .m-name { color: #eaeaea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold; }
        .m-timer { font-family: monospace; font-size: 10px; font-weight: bold; min-width: 32px; text-align: right; }
        .nav-btn { background: transparent; border: 0; color: #8b8b8b; }
        .nav-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .nav-btn.active { color: gold; }

        #minBtn {
           transition: transform 0.3s ease;
        }
    `;
    document.head.appendChild(styleSheet);


    const mList = document.getElementById('mList');
    let currentTab = parseInt(localStorage.getItem('mapSync_currentTab')) || 0;

     function render() {
        mList.innerHTML = "";
        const activeCol = columnsData[currentTab];
        if (!activeCol) return;

        const data = activeCol.maps || [];
        const prefix = activeCol.id;
        const match = activeCol.boss_name.match(/\((.*?)\)/);
        const tabName = match ? match[1] : activeCol.id;

        document.getElementById('tabTitleSpan').innerText = `Event Heros Helper (${tabName})`;

        data.forEach((mapData, i) => {
            const rowId = `${prefix}${i}`;
            const row = document.createElement('div');
            row.className = "map-row one-other tw-list-item";
            row.id = `row_${rowId}`;
            row.setAttribute('data-ids', JSON.stringify([`${rowId}_1`, `${rowId}_2`]));

            row.innerHTML = `
                <div class="m-name-container">
                    <span class="m-occ" id="occ_${rowId}"></span>
                    <span class="m-name" style="color: ${mapData[1]}">${mapData[0]}</span>
                </div>
                <span class="m-timer" id="timer_${rowId}">--:--</span>
            `;

            row.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                sendGlobalAlert(`Nikogo nie ma na <b style="color:#ef4444">${mapData[0]}</b>`);
            };

            row.onmouseenter = () => {
                const occupants = getRowOccupants(row);

                let listHtml = occupants.length > 0
                ? occupants.map(p => `
            <div class="one-other tw-list-item" style="margin-bottom: 2px;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="color: #eaeaea; font-weight: 600; font-size: 11px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${p}</div>
                </div>
            </div>
        `).join('')
                : '<div style="color: #eaeaea; font-style: italic; font-size: 11px; padding: 2px;">Brak graczy na mapie</div>';

                if (!window.mrgCustomTip) {
                    window.mrgCustomTip = document.createElement('div');
                    window.mrgCustomTip.className = 'c-window border-window transparent';
                    window.mrgCustomTip.style.cssText = `
            position: fixed;
            display: none;
            z-index: 100000;
            pointer-events: none;
            min-width: 180px;
            max-width: 240px;
        `;

                    const borderImg = document.createElement('div');
                    borderImg.className = 'border-image';
                    window.mrgCustomTip.appendChild(borderImg);

                    const tipContent = document.createElement('div');
                    tipContent.className = 'content';
                    tipContent.style.cssText = 'position: relative; z-index: 2; padding: 4px;';
                    window.mrgCustomTip.appendChild(tipContent);

                    document.body.appendChild(window.mrgCustomTip);
                }

                const tipContentEl = window.mrgCustomTip.querySelector('.content');
                tipContentEl.innerHTML = `<div>${listHtml}</div>`;
                window.mrgCustomTip.style.display = 'block';

                let rect = row.getBoundingClientRect();
                let tipX = rect.left;
                let tipY = rect.bottom + 4;

                if (tipX + 240 > window.innerWidth) tipX = window.innerWidth - 245;
                if (tipY + window.mrgCustomTip.offsetHeight > window.innerHeight) tipY = rect.top - window.mrgCustomTip.offsetHeight - 4;

                window.mrgCustomTip.style.left = tipX + 'px';
                window.mrgCustomTip.style.top = tipY + 'px';
            };

            row.onmouseleave = () => {
                if (window.mrgCustomTip) {
                    window.mrgCustomTip.style.display = 'none';
                }
            };
            mList.appendChild(row);
        });
        updateMapColors();
    }

    function getRowOccupants(row) {
        const ids = JSON.parse(row.getAttribute('data-ids'));
        const d1 = cachedData[ids[0]] || { val: "" };
        const d2 = cachedData[ids[1]] || { val: "" };
        let occupants = [];
        if (d1.val) occupants.push(d1.val);
        if (d2.val) occupants.push(d2.val);
        return occupants;
    }

    function updateMapColors() {
        const now = Date.now();
        const rows = Array.from(document.querySelectorAll('.map-row'));

        rows.forEach(row => {
            const ids = JSON.parse(row.getAttribute('data-ids'));
            const d1 = cachedData[ids[0]] || { val: "", ts: 0 };
            const d2 = cachedData[ids[1]] || { val: "", ts: 0 };
            const lastTs = Math.max(d1.ts, d2.ts);

            row.setAttribute('data-last-ts', lastTs);

            const timerSpan = row.querySelector('.m-timer');
            const occSpan = row.querySelector('.m-occ');

            let occupants = [];
            if (d1.val) occupants.push(d1.val);
            if (d2.val) occupants.push(d2.val);

            if (occupants.length === 1) occSpan.innerText = "👤";
            else if (occupants.length === 2) occSpan.innerText = "👥";
            else occSpan.innerText = "";

            let diff = -1;
            if (lastTs > 0) {
                diff = Math.max(0, (now - lastTs) / 1000);
                const min = Math.floor(diff / 60);
                const sec = Math.floor(diff % 60).toString().padStart(2, '0');
                timerSpan.innerText = `${min}:${sec}`;

                if (diff < 90) timerSpan.style.color = "#22c55e";
                else if (diff < 180) timerSpan.style.color = "#eab308";
                else timerSpan.style.color = "#ef4444";
            } else {
                timerSpan.innerText = "--:--";
                timerSpan.style.color = "#475569";
            }

            if (filterActive) {
                row.style.display = (diff !== -1 && diff <= 180) ? "none" : "flex";
            } else {
                row.style.display = "flex";
            }
        });

        if (filterActive) {
            rows.sort((a, b) => parseInt(a.getAttribute('data-last-ts')) - parseInt(b.getAttribute('data-last-ts')));
            rows.forEach(row => mList.appendChild(row));
        }
    }

    let isDragging = false, offset = { x: 0, y: 0 };
    const dH = document.getElementById('dragHandle');

    dH.onmousedown = (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        const rect = container.getBoundingClientRect();
        offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    let isResizing = false, startX, startY, startWidth, startHeight;
    const rH = document.getElementById('resizeHandle');

    rH.onmousedown = (e) => {
        if (e.button !== 0) return;
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = container.offsetWidth;
        startHeight = container.offsetHeight;
        e.stopPropagation();
    };

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const vW = window.innerWidth, vH = window.innerHeight;
            const cW = container.offsetWidth, cH = container.offsetHeight;
            let newX = e.clientX - offset.x, newY = e.clientY - offset.y;
            if (newX < 0) newX = 0; if (newY < 0) newY = 0;
            if (newX + cW > vW) newX = vW - cW; if (newY + cH > vH) newY = vH - cH;
            container.style.right = "auto"; container.style.left = newX + "px"; container.style.top = newY + "px";
        }
        else if (isResizing) {
            const width = Math.max(200, startWidth + (e.clientX - startX));
            const height = Math.max(150, startHeight + (e.clientY - startY));
            container.style.width = width + "px";
            if (container.style.height !== '28px') {
                container.style.height = height + "px";
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            localStorage.setItem('mapSyncPos', JSON.stringify({ top: container.style.top, left: container.style.left }));
        }
        if (isResizing) {
            isResizing = false;
            localStorage.setItem('mapSyncSize', JSON.stringify({ width: container.style.width, height: container.style.height }));
        }
    });

    const minBtn = document.getElementById('minBtn');

    if (isSavedMinimized) minBtn.style.transform = 'rotate(45deg)';

    minBtn.onclick = function() {
        const container = document.getElementById('mapSyncContainer');
        const isMin = container.offsetHeight <= 30 || container.style.height === '28px';

        if (!isMin) {
            container.dataset.prevHeight = container.style.height;
            container.style.height = '28px';
            this.style.transform = 'rotate(45deg)';
            localStorage.setItem('mapSyncIsMin', 'true');
        } else {
            const restoredHeight = (container.dataset.prevHeight && container.dataset.prevHeight !== '28px')
            ? container.dataset.prevHeight
            : '380px';

            container.style.height = restoredHeight;
            this.style.transform = 'rotate(0deg)';
            localStorage.setItem('mapSyncIsMin', 'false');
            localStorage.setItem('mapSyncSize', JSON.stringify({ width: container.style.width, height: restoredHeight }));
        }
    };



    document.getElementById('opacityBtn').onclick = () => {
        opacityLvl = opacityLvl >= 5 ? 0 : opacityLvl + 1;
        container.setAttribute('data-opacity-lvl', opacityLvl);
        localStorage.setItem('mapSyncOpacityLvl', opacityLvl);
    };

    function saveTab() {
        localStorage.setItem('mapSync_currentTab', currentTab);
    }

    document.getElementById('filterBtn').onclick = function() {
        filterActive = !filterActive;
        this.style.backgroundColor = filterActive ? "rgba(255, 255, 255, 0.2)" : "transparent";
        this.style.borderRadius = "3px";
        if (!filterActive) render();
        else updateMapColors();
    };

    function autoMapCheck() {
        let currentMap = getMapName();
        const myNick = getHeroName();
        let foundMatch = false;

        columnsData.forEach((col) => {
            const prefix = col.id;
            col.maps.forEach((mapData, i) => {
                if (mapData[0] === currentMap) {
                    foundMatch = true;
                    const id1 = `${prefix}${i}_1`, id2 = `${prefix}${i}_2`;
                    const d1 = cachedData[id1] || { val: "", ts: 0 };
                    const d2 = cachedData[id2] || { val: "", ts: 0 };

                    if (d1.val === myNick) {
                        currentMyId = id1;
                        cachedData[id1].ts = Date.now();
                    } else if (d2.val === myNick) {
                        currentMyId = id2;
                        cachedData[id2].ts = Date.now();
                    } else if (!d1.val || d1.val === "") {
                        currentMyId = id1;
                        sync(id1, myNick);
                        cachedData[id1] = { val: myNick, ts: Date.now() };
                    } else if (!d2.val || d2.val === "") {
                        currentMyId = id2;
                        sync(id2, myNick);
                        cachedData[id2] = { val: myNick, ts: Date.now() };
                    } else {
                        const targetId = (d1.ts <= d2.ts) ? id1 : id2;
                        currentMyId = targetId;
                        sync(targetId, myNick);
                        cachedData[targetId] = { val: myNick, ts: Date.now() };
                    }
                }
            });
        });
        if (!foundMatch) currentMyId = null;
    }

    function startHeartbeat() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (socket && socket.readyState === 1 && currentMyId) {
                socket.send(JSON.stringify({ type: 'heartbeat', nick: getHeroName(), id: currentMyId }));
            }
        }, 1000);
    }

    function getMapName() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        return win.Engine?.map?.d?.name || win.map?.name || "???";
    }

    function getMapNameWithXY() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        const mapName = getMapName();
        return `${mapName} (${Math.floor(win.Engine?.hero?.rx)|| "?"}, ${Math.floor(win.Engine?.hero?.ry) || "?"})`;
    }

    let assignedKey = localStorage.getItem("mapsync-userKey") || "y";

    window.addEventListener("keydown", (event) => {
        const isTyping = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable;;
        if (isTyping) return;
        if (event.key.toLowerCase() === assignedKey) {
            sendGlobalAlert(`Potrzebna pomoc na: <b style="color:#ef4444">${getMapNameWithXY()}</b>`);
        }
    });

    document.getElementById('mapSyncListContainer').addEventListener('wheel', (e) => {
        e.stopPropagation();
    }, { passive: false });

    setInterval(updateMapColors, 1000);
    loadData();
})();
