import { win } from '../core/env.js';
import { injectStyle, isTypingTarget } from '../core/dom.js';
import { getHeroName, getMapName } from '../core/game.js';
import { loadJSON, saveJSON, loadFlag, saveFlag } from '../core/storage.js';
import { formatElapsed } from '../core/format.js';
import { makeDraggable, makeResizable } from '../core/drag.js';
import { captureNextKey } from '../core/keyboard.js';
import { getDiscordToken, clearDiscordToken, redirectToDiscordLogin, openSyncSocket, sendJSON } from '../core/sync.js';

const BACKEND_URL = 'https://margone-api-m207.onrender.com';
const DATA_URL = 'https://margonem.vercel.app/data.json';
const PING_URL = 'https://margonem.vercel.app/ping.mp3';

const POS_KEY = 'mapSyncLite_pos';
const SIZE_KEY = 'msLite_size';
const COLLAPSED_KEY = 'mapSyncLite_collapsed';
const HIDDEN_KEY = 'msLite_hidden';
const MUTED_KEY = 'msLite_muted';
const ALERTS_KEY = 'msLite_customAlerts';

const MAP_CONFIG = [
    { name: "Sala Tronowa", monster: "Tanroth", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/ice_king.gif", fallbackId: "p2758" },
    { name: "Sala Zrujnowanej Świątyni", monster: "Barbatos", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/hebrehoth_smokoludzie.gif", fallbackId: "p238" },
    { name: "Teotihuacan", monster: "Tezcatlipoca", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/tezcatlipoca.gif", fallbackId: "n166" },
    { name: "Nora Jaszczurzych Koszmarów - źródło", monster: "Maddok Magua", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/maddok_magua-1a.gif", fallbackId: "s85" },
    { name: "Komnata Krwawych Obrzędów", monster: "Przyzywacz Demonów", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/przyz_demon_sekta.gif", fallbackId: "p157" },
    { name: "Źródło Wspomnień", monster: "Łowczyni Wspomnień", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/lowcz-wspo-driady.gif", fallbackId: "p211" },
    { name: "Lokum Złych Goblinów - pracownia", monster: "Versus Zoons", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/versus-zoons.gif", fallbackId: "p182" },
    { name: "Wulkan Politraki - Piekielne Czeluście", monster: "Piekielny Arcymag", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/archdemon.gif", fallbackId: "p251" },
    { name: "Bandyckie Chowisko - skarbiec", monster: "Renegat Baulus", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/renegat_baulus.gif", fallbackId: "p172" },
];

const DEFAULT_ALERTS = [
    { code: "Digit1", label: "WOŁAJ", msg: '<b style="color:#e74c3c">Dawać odbijamy!</b>', useAlt: true },
    { code: "Digit2", label: "ŁAPAĆ", msg: '<b style="color:#e74c3c">Łapać ich!</b>', useAlt: true },
    { code: "Digit3", label: "DOBIJAĆ", msg: '<b style="color:#e74c3c">Dobijać!</b>', useAlt: true },
    { code: "Digit4", label: "WCHODZIMY", msg: '<b style="color:#e74c3c">Wchodzimy!</b>', useAlt: true },
    { code: "Digit5", label: "STOP", msg: '<b style="color:#e74c3c">STOP!</b>', useAlt: true },
    { code: "KeyY", label: "POMOC", msg: '<b style="color:#e74c3c">Potrzebuje pomocy na mapie</b> $MAP', useAlt: false },
];

const CSS = `
    #msLiteContainer {
        position: fixed; z-index: 10001; user-select: none;
        display: flex; flex-direction: column; background: rgba(10, 10, 10, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px;
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.6); font-family: 'Verdana', sans-serif;
        overflow: hidden;
        min-width: 150px; min-height: 24px;
    }
    #msLiteHeader {
        display: flex; justify-content: space-between; align-items: center;
        padding: 4px 8px; cursor: grab; background: rgb(18 17 17);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05); flex-shrink: 0;
        height: 24px; box-sizing: border-box;
    }
    #msLiteHeader:active { cursor: grabbing; }
    #msLiteTitle { font-size: 10px; font-weight: bold; color: #fff; text-shadow: 0 0 5px #5865f2; letter-spacing: 0.5px; pointer-events: none; }
    #msLiteControls { display: flex; align-items: center; gap: 8px; }
    #msLiteRestore { cursor: pointer; font-size: 12px; color: #5865f2; display: none; transition: transform 0.2s; }
    #msLiteRestore:hover { transform: scale(1.2); }
    #msLiteToggle { cursor: pointer; font-size: 18px; color: rgba(255,255,255,0.4); font-weight: 300; line-height: 1; transition: color 0.2s; margin-top: -4px; }
    #msLiteToggle:hover { color: #fff; }

    #msLiteContent {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
        align-content: start;
        gap: 4px;
        padding: 6px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
        pointer-events: auto;
    }
    #msLiteContent::-webkit-scrollbar { width: 3px; }
    #msLiteContent::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    #msLiteContent::-webkit-scrollbar-thumb { background: rgba(88, 101, 242, 0.6); border-radius: 10px; }
    #msLiteContent::-webkit-scrollbar-thumb:hover { background: rgba(88, 101, 242, 0.9); }

    .ms-lite-item {
        position: relative; display: flex; flex-direction: column; align-items: center;
        padding: 4px; background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.03); border-radius: 6px; transition: 0.2s;
        cursor: pointer; height: 58px; box-sizing: border-box; justify-content: center;
    }
    .ms-lite-item:hover { background: rgba(255, 255, 255, 0.1); }
    .ms-selected { border-color: #5865f2 !important; background: rgba(88, 101, 242, 0.15) !important; box-shadow: inset 0 0 8px rgba(88, 101, 242, 0.3); }
    .ms-alert-flash { background: rgba(231, 76, 60, 0.4) !important; border-color: rgba(231, 76, 60, 0.8) !important; }
    .ms-lite-img { width: 32px; height: 32px; background-size: contain; background-repeat: no-repeat; background-position: center; filter: drop-shadow(1px 1px 1px #000); }
    .ms-lite-timer { font-size: 10px; font-weight: bold; font-family: monospace; color: #666; text-shadow: 1px 1px 1px #000; margin-top: 2px; z-index: 3; pointer-events: none; }
    .ms-is-not-resping { opacity: 0.4; filter: grayscale(1); }

    #msLiteResizeHandle {
        position: absolute; bottom: 2px; right: 2px; width: 10px; height: 10px;
        cursor: se-resize; z-index: 10002;
        background: repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 4px);
        clip-path: polygon(100% 0, 100% 100%, 0 100%);
    }

    #msLiteCtxMenu {
        position: fixed; display: none; z-index: 20002; background: rgba(20, 20, 20, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 3px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px); min-width: 120px;
        font-family: 'Verdana', sans-serif;
    }
    .ms-ctx-item { padding: 6px 12px; font-size: 10px; font-weight: bold; color: #eee; cursor: pointer; border-radius: 2px; transition: 0.2s; }
    .ms-ctx-item:hover { background: rgba(255, 255, 255, 0.1); color: #5865f2; }
    .ms-ctx-danger { color: #e74c3c !important; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 4px; }
`;

function loadQuickAlerts() {
    const cached = loadJSON(ALERTS_KEY, []);
    return DEFAULT_ALERTS.map(def => {
        const c = cached.find(a => a.label === def.label);
        return {
            ...def,
            code: c ? c.code : def.code,
            useAlt: c && Object.prototype.hasOwnProperty.call(c, 'useAlt') ? c.useAlt : def.useAlt,
        };
    });
}

function isInStasis() {
    return (win.Engine?.hero?.checkStasis && win.Engine.hero.checkStasis() !== 0) || win.hero?.stasis > 0;
}

export default {
    id: 'tytan_helper',
    name: 'Tytan Helper',
    description: 'Obstawiaj tytana, synchronizuj z innymi graczami i sprawdzaj, kto jest na której mapie.',

    run() {
        const quickAlerts = loadQuickAlerts();
        let hiddenMonsters = loadJSON(HIDDEN_KEY, []);
        let isMuted = loadFlag(MUTED_KEY);
        let isCollapsed = loadFlag(COLLAPSED_KEY);
        let discordToken = getDiscordToken();
        let socket = null;
        let cachedData = {};
        let currentMyId = null;
        let mapMapping = {};
        let isInitialized = false;
        let selectedMonster = null;
        let autoCheckStarted = false;

        injectStyle(CSS);

        const savedPos = loadJSON(POS_KEY, { top: '5px', left: 'auto', right: '5px' });
        const savedSize = loadJSON(SIZE_KEY, { width: '164px', height: '200px' });

        const container = document.createElement('div');
        container.id = 'msLiteContainer';
        Object.assign(container.style, {
            top: savedPos.top, left: savedPos.left, right: savedPos.right,
            width: savedSize.width, height: isCollapsed ? 'auto' : savedSize.height,
        });
        container.innerHTML = `
            <div id="msLiteHeader">
                <div id="msLiteTitle">Tytan Helper</div>
                <div id="msLiteControls">
                    <div id="msLiteRestore" title="Pokaż wszystkie ukryte sloty">👁</div>
                    <div id="msLiteMute" title="Wycisz pingi" style="cursor:pointer; font-size:12px; transition: transform 0.2s;"></div>
                    <div id="msLiteToggle"></div>
                </div>
            </div>
            <div id="msLiteContent"></div>
            <div id="msLiteResizeHandle"></div>
        `;
        document.body.appendChild(container);

        const ctxMenu = document.createElement('div');
        ctxMenu.id = 'msLiteCtxMenu';
        document.body.appendChild(ctxMenu);

        const $ = sel => container.querySelector(sel);
        const content = $('#msLiteContent');
        const resizeHandle = $('#msLiteResizeHandle');
        const toggleBtn = $('#msLiteToggle');
        const muteBtn = $('#msLiteMute');
        const restoreBtn = $('#msLiteRestore');

        content.addEventListener('wheel', e => e.stopPropagation());

        // --- menu kontekstowe ---

        function hideCtxMenu() {
            ctxMenu.style.display = 'none';
        }

        function openCtxMenu(x, y, title, items) {
            ctxMenu.innerHTML = `<div style="font-size:9px; color:#888; text-align:center; padding:3px; border-bottom:1px solid rgba(255,255,255,0.1);">${title}</div>`;
            items.forEach(item => ctxMenu.appendChild(item));
            ctxMenu.style.left = Math.min(x, window.innerWidth - 130) + 'px';
            ctxMenu.style.top = Math.min(y, window.innerHeight - 200) + 'px';
            ctxMenu.style.display = 'block';
            setTimeout(() => document.addEventListener('click', hideCtxMenu, { once: true }), 10);
        }

        function ctxItem(text, onClick, className = 'ms-ctx-item') {
            const el = document.createElement('div');
            el.className = className;
            el.innerText = text;
            el.onclick = onClick;
            return el;
        }

        // --- alerty ---

        function playPing() {
            if (isMuted) return;
            const audio = new Audio(PING_URL);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        }

        function flashCardByMonster(monster) {
            content.querySelectorAll(`.ms-lite-item[data-monster="${monster}"]`).forEach(item => {
                item.classList.add('ms-alert-flash');
                setTimeout(() => item.classList.remove('ms-alert-flash'), 1500);
            });
        }

        function sendAlert(monster, message) {
            const text = (monster ? `<b style="color:white">[${monster}]</b> ` : '') +
                message.replace('$MAP', getMapName('nieznanej mapie'));
            const sent = sendJSON(socket, {
                type: 'send_alert',
                data: { text, sender: getHeroName('???'), monster: monster || null, ts: Date.now() },
            });
            if (sent && monster) flashCardByMonster(monster);
            hideCtxMenu();
        }

        function showGlobalAlert(data) {
            if (!data?.text) return;
            if (data.monster && hiddenMonsters.includes(data.monster)) return;
            if (data.monster) flashCardByMonster(data.monster);
            playPing();
            // Event Helper wyświetla te same alerty u siebie.
            if (document.getElementById('globalAlertModal') || document.getElementById('mapSyncContainer')) return;

            const modal = document.createElement('div');
            modal.id = 'globalAlertModal';
            modal.style.cssText = `position: fixed; top: 15%; left: 50%; transform: translateX(-50%); background: rgba(20, 20, 20, 0.9); color: white; padding: 12px 25px; z-index: 30000; border-radius: 4px; font-family: 'Verdana', sans-serif; text-align: center; border-left: 4px solid #e74c3c; box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px); pointer-events: none; border-bottom: 1px solid rgba(255,255,255,0.1);`;
            modal.innerHTML = `
                <div class="close-alert" style="position: absolute; top: 2px; right: 6px; cursor: pointer; font-size: 14px; opacity: 0.5; pointer-events: auto;">×</div>
                <div style="font-size: 10px; opacity: 0.6; margin-bottom: 2px;">${data.sender}</div>
                <div style="font-size: 13px; letter-spacing: 0.5px;">${data.text}</div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('.close-alert').onclick = () => modal.remove();

            setTimeout(() => {
                if (!modal.isConnected) return;
                modal.style.transition = 'opacity 0.8s';
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 800);
            }, 5000);
        }

        window.addEventListener('keydown', e => {
            if (isTypingTarget(e.target)) return;
            const alert = quickAlerts.find(a => a.code === e.code && (a.useAlt ? e.altKey : !e.altKey));
            if (!alert) return;
            e.preventDefault();
            sendAlert(selectedMonster, alert.msg);
        });

        // --- render ---

        function showAllMonsters() {
            hiddenMonsters = [];
            saveJSON(HIDDEN_KEY, []);
            render();
        }

        function showLoginButton() {
            if (document.getElementById('msLiteLogin') || isCollapsed) return;
            const btn = document.createElement('div');
            btn.id = 'msLiteLogin';
            btn.style.cssText = 'grid-column: 1 / -1;font-size: 11px;background: rgb(88, 101, 242);padding: 6px;border-radius: 4px;cursor: pointer;text-align: center;color: white;font-weight: 600;position: absolute;top: 0;bottom: 0;height: 18px;left: 0;right: 0;margin: auto 10px;z-index: 10;';
            btn.innerText = 'Połącz konto';
            btn.onclick = redirectToDiscordLogin;
            content.appendChild(btn);
        }

        function alertMenuItem(alert) {
            const keyName = alert.code.replace('Digit', '').replace('Key', '').toUpperCase();
            const item = ctxItem(`[${alert.useAlt ? 'Alt+' : ''}${keyName}] ${alert.label}`, null);

            // PPM na pozycji = zmiana skrótu
            item.oncontextmenu = ev => {
                ev.preventDefault();
                ev.stopPropagation();
                item.innerText = 'Naciśnij klawisz...';
                item.style.color = '#f1c40f';

                const cancel = captureNextKey(keyEvent => {
                    alert.code = keyEvent.code;
                    alert.useAlt = keyEvent.altKey;
                    saveJSON(ALERTS_KEY, quickAlerts);
                    hideCtxMenu();
                    render();
                });
                setTimeout(() => document.addEventListener('click', () => { cancel(); render(); }, { once: true }), 10);
            };
            return item;
        }

        function render() {
            restoreBtn.style.display = hiddenMonsters.length > 0 ? 'block' : 'none';

            content.innerHTML = MAP_CONFIG.filter(m => !hiddenMonsters.includes(m.monster)).map(map => {
                const id = mapMapping[map.name.toLowerCase()]?.id ?? `wait_${map.monster}`;
                return `<div class="ms-lite-item ${selectedMonster === map.monster ? 'ms-selected' : ''}" data-monster="${map.monster}" id="card_${id}" title="${map.name}"><div class="ms-lite-img" style="background-image: url('${map.icon}');"></div><span class="ms-lite-timer" id="lt_${id}">--:--</span></div>`;
            }).join('');

            content.querySelectorAll('.ms-lite-item').forEach(card => {
                const monster = card.getAttribute('data-monster');
                card.onclick = () => {
                    selectedMonster = selectedMonster === monster ? null : monster;
                    render();
                };
                card.oncontextmenu = e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const items = quickAlerts.map(alert => {
                        const item = alertMenuItem(alert);
                        item.onclick = ev => { ev.stopPropagation(); sendAlert(monster, alert.msg); };
                        return item;
                    });
                    items.push(ctxItem('UKRYJ TYTANA I POWIADOMIENIA', () => {
                        hiddenMonsters.push(monster);
                        saveJSON(HIDDEN_KEY, hiddenMonsters);
                        hideCtxMenu();
                        render();
                    }, 'ms-ctx-item ms-ctx-danger'));
                    openCtxMenu(e.clientX, e.clientY, monster, items);
                };
            });

            if (!discordToken) showLoginButton();
        }

        /** Tytan "na respie", jeśli LootLog podświetla jego timer na pomarańczowo (lub nie ma widgetu). */
        function isRespawning(monster, bossEntries) {
            const block = bossEntries?.find(el => el.textContent.includes(monster));
            if (!block) return true;
            return block.classList.contains('ll:text-orange-400') || !!block.querySelector('.ll\\:text-orange-400');
        }

        function updateUI() {
            const now = Date.now();
            const widget = document.getElementById('ll-timers') || document.querySelector('.bottom-wrapper');
            const bossEntries = widget && [...widget.querySelectorAll('[data-slot="tooltip-trigger"]')];

            MAP_CONFIG.forEach(map => {
                const data = mapMapping[map.name.toLowerCase()];
                if (!data) return;
                const timerEl = document.getElementById(`lt_${data.id}`);
                const cardEl = document.getElementById(`card_${data.id}`);
                if (!timerEl) return;

                if (!isRespawning(map.monster, bossEntries)) {
                    timerEl.innerText = '-';
                    timerEl.style.color = '#666';
                    cardEl?.classList.add('ms-is-not-resping');
                    return;
                }
                cardEl?.classList.remove('ms-is-not-resping');

                const lastTs = Math.max(cachedData[`${data.id}_1`]?.ts || 0, cachedData[`${data.id}_2`]?.ts || 0);
                if (lastTs > 0) {
                    const diff = Math.max(0, (now - lastTs) / 1000);
                    timerEl.innerText = formatElapsed(diff);
                    timerEl.style.color = diff < 300 ? '#2ecc71' : diff < 600 ? '#f1c40f' : '#e74c3c';
                } else {
                    timerEl.innerText = '--:--';
                    timerEl.style.color = '#666';
                }
            });
        }

        // --- synchronizacja ---

        function sync(id, val) {
            sendJSON(socket, { type: 'update_cell', id, val, ts: val ? Date.now() : 0 });
        }

        /** Zajmuje slot tytana, na którego mapie stoi bohater. */
        function autoCheck() {
            if (!isInitialized || socket?.readyState !== WebSocket.OPEN) return;
            if (isInStasis()) {
                currentMyId = null;
                return;
            }

            const mapData = mapMapping[getMapName().toLowerCase()];
            if (!mapData) {
                currentMyId = null;
                return;
            }

            const myNick = getHeroName('???');
            const id1 = `${mapData.id}_1`, id2 = `${mapData.id}_2`;
            const d1 = cachedData[id1] || { val: '' }, d2 = cachedData[id2] || { val: '' };

            if (d1.val === myNick) currentMyId = id1;
            else if (d2.val === myNick) currentMyId = id2;
            else {
                currentMyId = d1.val ? id2 : id1;
                sync(currentMyId, myNick);
            }

            cachedData[currentMyId] = { val: myNick, ts: Date.now() };
            sendJSON(socket, { type: 'heartbeat', nick: myNick, id: currentMyId });
            updateUI();
        }

        function connectWS() {
            if (!discordToken) return;
            socket = openSyncSocket(BACKEND_URL, discordToken);
            socket.onmessage = e => {
                const msg = JSON.parse(e.data);
                if (msg.type === 'init_data') {
                    cachedData = msg.data || {};
                    updateUI();
                } else if (msg.type === 'cell_updated') {
                    cachedData[msg.id] = { val: msg.val, ts: msg.ts };
                    updateUI();
                } else if (msg.type === 'global_alert') {
                    showGlobalAlert(msg.data);
                } else if (msg.type === 'auth_error') {
                    clearDiscordToken();
                    showLoginButton();
                }
            };
            socket.onclose = () => setTimeout(connectWS, 5000);

            if (!autoCheckStarted) {
                autoCheckStarted = true;
                setInterval(autoCheck, 1000);
            }
        }

        /** Mapuje mapy tytanów na id slotów z data.json (z zapasowymi id, gdy brak). */
        async function loadMapMapping() {
            const mapping = {};
            try {
                const config = await (await fetch(DATA_URL)).json();
                config.columns.forEach(col => col.maps.forEach((m, index) => {
                    const name = m[0].toLowerCase().trim();
                    if (MAP_CONFIG.some(mc => mc.name.toLowerCase() === name)) mapping[name] = { id: `${col.id}${index}` };
                }));
            } catch {}
            MAP_CONFIG.forEach(map => {
                mapping[map.name.toLowerCase()] ??= { id: map.fallbackId };
            });
            return mapping;
        }

        // --- okno ---

        function applyCollapsed() {
            content.style.display = isCollapsed ? 'none' : 'grid';
            resizeHandle.style.display = isCollapsed ? 'none' : 'block';
            toggleBtn.innerText = isCollapsed ? '+' : '−';
        }

        toggleBtn.onclick = e => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            saveFlag(COLLAPSED_KEY, isCollapsed);
            applyCollapsed();
            container.style.height = isCollapsed ? 'auto' : loadJSON(SIZE_KEY, savedSize).height;
        };

        restoreBtn.onclick = e => { e.stopPropagation(); showAllMonsters(); };

        const renderMute = () => muteBtn.innerText = isMuted ? '🔕' : '🔔';
        muteBtn.onclick = e => {
            e.stopPropagation();
            isMuted = !isMuted;
            saveFlag(MUTED_KEY, isMuted);
            renderMute();
        };

        $('#msLiteHeader').oncontextmenu = e => {
            e.preventDefault();
            e.stopPropagation();
            openCtxMenu(e.clientX, e.clientY, 'Opcje Panelu', [
                ctxItem('POKAŻ WSZYSTKO', () => { showAllMonsters(); hideCtxMenu(); }),
            ]);
        };

        makeDraggable(container, {
            handle: $('#msLiteHeader'),
            threshold: 0,
            ignore: '#msLiteToggle, #msLiteRestore, #msLiteMute',
            onDragEnd: () => saveJSON(POS_KEY, { left: container.style.left, top: container.style.top, right: 'auto' }),
        });
        makeResizable(container, resizeHandle, {
            minWidth: 150,
            minHeight: 35,
            onEnd: size => saveJSON(SIZE_KEY, size),
        });

        applyCollapsed();
        renderMute();
        render();
        setInterval(updateUI, 1000);

        loadMapMapping().then(mapping => {
            mapMapping = mapping;
            isInitialized = true;
            render();
            if (discordToken) connectWS();
            else showLoginButton();
        });
    },
};
