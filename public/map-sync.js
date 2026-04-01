(function() {
    'use strict';

    const BACKEND_URL = "https://margone-api.onrender.com";
    const CLIENT_ID = "1488794373775687782";
    const REDIRECT_URI = encodeURIComponent(window.location.origin + window.location.pathname);
    const DISCORD_AUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=identify%20guilds.members.read`;
    
    let lastMapName = "";
    let heartbeatInterval = null;
    let socket = null;
    let cachedData = {};
    let discordToken = localStorage.getItem('mapSync_dcToken');
    let currentMyId = null;

    function checkUrlForToken() {
        const hash = window.location.hash;e
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
        const existing = document.getElementById('mapSyncLoginOverlay');
        if (existing) return;
        const overlay = document.createElement('div');
        overlay.id = "mapSyncLoginOverlay";
        overlay.style = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px); font-family:Verdana,sans-serif;`;
        overlay.innerHTML = `
            <div style="background:#2f3136; padding:30px; border-radius:12px; text-align:center; border:1px solid #5865f2; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <div style="color:#fff; font-size:20px; margin-bottom:15px; font-weight:bold;">Wymagana Autoryzacja</div>
                <p style="color:#b9bbbe; font-size:13px; margin-bottom:25px;">Zaloguj się przez Discord, aby uzyskać dostęp do map grupy.</p>
                <button id="dcLoginBtn" style="background:#5865f2; color:#fff; border:none; padding:12px 25px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:14px; transition:0.2s;">
                    Połącz z Discordem
                </button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('dcLoginBtn').onclick = () => { window.location.href = DISCORD_AUTH_URL; };
    }

    function initSocket() {
        if (!discordToken) {
            showLoginModal();
            return;
        }

        const wsUrl = BACKEND_URL.replace("http", "ws") + `?token=${discordToken}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log("%c[Mapy Sync] Połączono pomyślnie!", "color:#2ecc71; font-weight:bold;");
            const loginOverlay = document.getElementById('mapSyncLoginOverlay');
            if (loginOverlay) loginOverlay.remove();
            startHeartbeat();
            setInterval(autoMapCheck, 1000);
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'init_data') {
                cachedData = msg.data || {};
                render();
            } 
            else if (msg.type === 'cell_updated') {
                cachedData[msg.id] = { val: msg.val, ts: msg.ts };
                const cell = document.getElementById(msg.id);
                if (cell) updateCellText(cell, msg.val);
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

        socket.onerror = (err) => console.error("[Mapy Sync] Błąd połączenia:", err);
    }

    async function sync(id, val) {
        if (socket && socket.readyState === 1) {
            const data = {
                type: 'update_cell',
                id: id,
                val: val,
                ts: val !== "" ? Date.now() : 0
            };
            socket.send(JSON.stringify(data));
        }
    }

    async function sendGlobalAlert(mapName) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            const data = { 
                text: `Potrzebna pomoc na mapie: <b style="color:red">${mapName}</b>`, 
                sender: getHeroName(), 
                ts: Date.now() 
            };
            socket.send(JSON.stringify({ type: 'send_alert', data }));
        }
    }

    const arkusz1 = [["Ruiny Tass Zhil", "blue"], ["Błota Sham Al", "blue"], ["Głusza Świstu", "blue"], ["Las Porywów Wiatru", "blue"], ["Kwieciste Kresy", "blue"], ["Grań Gawronich Piór", "blue"], ["Nawiedzone Komnaty - przedsionek", "orange"], ["Nawiedzone Kazamaty p.1 s.1", "orange"], ["Nawiedzone Kazamaty p.1 s.2", "orange"], ["Nawiedzone Kazamaty p.2 s.1", "orange"], ["Nawiedzone Kazamaty p.2 s.2", "orange"], ["Nawiedzone Kazamaty p.3 s.1", "orange"], ["Nawiedzone Kazamaty p.3 s.2", "orange"], ["Nawiedzone Kazamaty p.4", "orange"], ["Sala Dowódcy Orków", "orange"], ["Nawiedzone Komnaty - zachód", "orange"], ["Nawiedzone Komnaty - wschód", "orange"], ["Sala Rady Orków", "orange"], ["Sala Królewska", "orange"], ["Komnaty Czarnej Gwardii - wschód", "orange"], ["Komnata Czarnej Perły", "orange"], ["Komnaty Czarnej Gwardii - zachód", "orange"]];
    const arkusz2 = [["Gęste Sploty", "green"], ["Zmurszały Łęg", "green"], ["Garb Połamanych Konarów", "green"], ["Zalesiony Step", "green"], ["Głusza Srebrnego Rogu", "green"], ["Knieja Lunarnych Głazów", "green"], ["Szepty Menhirów", "green"], ["Gaj Księżycowego Blasku", "green"], ["Zakątek Nocnych Szelestów", "green"], ["Zarosłe Szczeliny p.1 - sala 1", "green"], ["Zarosłe Szczeliny p.1 - sala 2", "green"], ["Zarosłe Szczeliny p.1 - sala 3", "green"], ["Gardziel Podgnitych Mchów p.1", "green"], ["Gardziel Podgnitych Mchów p.2", "green"], ["Zacienione Wnęki p.1 - sala 1", "green"], ["Zacienione Wnęki p.1 - sala 2", "green"], ["Zacienione Wnęki p.2 - sala 1", "green"], ["Zacienione Wnęki p.2 - sala 2", "green"], ["Skryty Azyl", "blue"], ["Dolina Potoku Śmierci", "blue"], ["Złota Dąbrowa", "blue"], ["Strumienie Szemrzących Wód", "blue"], ["Zawodzące Kaskady", "blue"], ["Jaszczurze Korytarze p.1 - sala 1", "blue"], ["Jaszczurze Korytarze p.1 - sala 2", "blue"], ["Jaszczurze Korytarze p.1 - sala 3", "blue"], ["Jaszczurze Korytarze p.1 - sala 4", "blue"], ["Jaszczurze Korytarze p.2 - sala 1", "blue"], ["Jaszczurze Korytarze p.2 - sala 2", "blue"], ["Jaszczurze Korytarze p.2 - sala 3", "blue"], ["Jaszczurze Korytarze p.2 - sala 4", "blue"]];
    const arkusz3 = [["Potępione Zamczysko", "cyan"], ["Potępione Zamczysko - lochy zach. p.1", "cyan"], ["Potępione Zamczysko - lochy zach. p.2", "cyan"], ["Potępione Zamczysko - głębokie lochy", "cyan"], ["Potępione Zamczysko - lochy wsch. p.2", "cyan"], ["Potępione Zamczysko - lochy wsch. p.1", "cyan"], ["Potępione Zamczysko - korytarz zachodni", "cyan"], ["Potępione Zamczysko - korytarz wschodni", "cyan"], ["Potępione Zamczysko - zachodnia komnata", "cyan"], ["Potępione Zamczysko - wschodnia komnata", "cyan"], ["Potępione Zamczysko - sala ofiarna", "cyan"], ["Potępione Zamczysko - łącznik zachodni", "cyan"], ["Potępione Zamczysko - łącznik wschodni", "cyan"], ["Potępione Zamczysko - północna komnata", "cyan"], ["Zachodnie Zbocze", "cyan"], ["Plugawe Pustkowie", "cyan"], ["Jęczywąwóz", "cyan"], ["Pogranicze Wisielców", "cyan"], ["Skalisty Styk", "cyan"], ["Zacisze Zimnych Wiatrów", "cyan"], ["Pustynne Katakumby", "magenta"], ["Pustynne Katakumby - sala 1", "magenta"], ["Pustynne Katakumby - sala 2", "magenta"], ["Komnaty Bezdusznych - sala 1", "magenta"], ["Komnaty Bezdusznych - sala 2", "magenta"], ["Katakumby Odnalezionych Skrytobójców", "magenta"], ["Katakumby Opętanych Dusz", "magenta"], ["Korytarz Porzuconych Marzeń", "magenta"], ["Katakumby Gwałtownej Śmierci", "magenta"]];

    function showGlobalModal(data) {
        if (!data || !data.text) return;
        const existing = document.getElementById('globalAlertModal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = "globalAlertModal";
        modal.style = `position: fixed; top: 15%; left: 50%; transform: translateX(-50%); background: rgba(20, 20, 20, 0.9); color: white; padding: 12px 25px; z-index: 30000; border-radius: 4px; font-family: 'Verdana', sans-serif; text-align: center; border-left: 4px solid #e74c3c; box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px); pointer-events: none; border-bottom: 1px solid rgba(255,255,255,0.1);`;
        modal.innerHTML = `<div style="font-size: 10px; opacity: 0.6; margin-bottom: 2px;">WEZWANIE: ${data.sender}</div><div style="font-size: 13px; letter-spacing: 0.5px;">${data.text}</div>`;
        document.body.appendChild(modal);
        setTimeout(() => { modal.style.transition = "opacity 0.8s"; modal.style.opacity = "0"; setTimeout(() => modal.remove(), 800); }, 5000);
    }

    function getHeroName() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (win.Engine && win.Engine.hero && win.Engine.hero.d) return win.Engine.hero.d.nick;
        if (win.hero && win.hero.nick) return win.hero.nick;
        return "???";
    }

    const savedPos = JSON.parse(localStorage.getItem('mapSyncPos')) || { top: "5px", left: "auto", right: "5px" };
    const savedSize = JSON.parse(localStorage.getItem('mapSyncSize')) || { width: "330px", height: "400px" };

    const container = document.createElement('div');
    container.id = "mapSyncContainer";
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `#mapSyncScroll::-webkit-scrollbar { width: 4px !important; } #mapSyncScroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2) !important; } #mapSyncScroll::-webkit-scrollbar-thumb { background: #333 !important; border-radius: 10px !important; } #mapSyncContainer.minimized { width: 58px !important; min-width: 150px !important; height: 28px !important; resize: none !important; border-color: #444 !important; } .nav-btn { cursor:pointer; background:none; border:none; font-size:10px; font-weight:bold; color: #666; padding: 4px 8px; transition: all 0.2s; position: relative; letter-spacing: 0.5px; } .nav-btn.active { color: #fff; } .nav-btn.active::after { content: ''; position: absolute; bottom: -2px; left: 8px; right: 8px; height: 2px; background: #fff; border-radius: 2px; } .sync-cell { transition: border-color 0.2s, color 0.2s; box-shadow: inset 0 0 5px rgba(0,0,0,0.5); } .map-name { text-shadow: 1px 1px 1px rgba(0,0,0,0.8); cursor: pointer; }`;
    document.head.appendChild(styleSheet);

    container.style = `position: fixed; top: ${savedPos.top}; right: ${savedPos.right}; left: ${savedPos.left}; width: ${savedSize.width}; height: ${savedSize.height}; min-width: 280px; min-height: 28px; z-index: 10000; background: rgba(10, 10, 10, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color: #fff; padding: 6px; border: 1px solid #222; border-radius: 8px; font-family: 'Verdana', sans-serif; box-shadow: 0 8px 32px rgba(0,0,0,0.6); user-select: none; resize: both; overflow: hidden; display: flex; flex-direction: column;`;
    container.innerHTML = `<div id="dragHandle" style="display:flex; margin-bottom:8px; justify-content:space-between; cursor: move; flex-shrink: 0; align-items: center; padding: 2px 4px;"><div id="tabsHeader" style="display:flex; gap:4px;"><button id="t1" class="nav-btn active">POULET (173h)</button><button id="t2" class="nav-btn">NADWORNY (231p)</button><button id="t3" class="nav-btn">ŚLEPIEC (266b)</button></div><div style="font-weight: bold; color: #fff; font-size: 10px; pointer-events:none; display:none; letter-spacing: 1px;" id="miniTitle">Wielkanoc 2026</div><button id="min" style="background:rgba(255,255,255,0.05); color:#fff; border:none; width: 22px; height: 22px; border-radius: 4px; cursor:pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;">−</button></div><div id="mapSyncScroll" style="flex-grow: 1; overflow-y: auto; overflow-x: hidden; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;"><table style="width:100%; border-collapse: separate; border-spacing: 3px; table-layout: fixed;"><tbody id="mBody"></tbody></table></div>`;
    document.body.appendChild(container);

    const scrollArea = document.getElementById('mapSyncScroll');
    const mBody = document.getElementById('mBody');
    let currentTab = 1;

    function render() {
        mBody.innerHTML = "";
        let data, prefix;
        if (currentTab === 1) { data = arkusz1; prefix = "p"; }
        else if (currentTab === 2) { data = arkusz2; prefix = "n"; }
        else { data = arkusz3; prefix = "s"; }
        data.forEach((mapData, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="map-name" data-base-name="${mapData[0]}" style="padding:4px; color:#ddd; border: 1px solid #1a1a1a; background: rgba(30,30,30,0.3); font-size: 10px; border-left: 3px solid ${mapData[1]}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-radius: 2px;">${mapData[0]}</td><td class="sync-cell" id="${prefix}${i}_1" style="line-height: 1.2; position:relative; width:80px; background:#050505; text-align:center; color:#444; border: 1px solid #1a1a1a; height:18px; font-size:10px; border-radius: 3px;"></td><td class="sync-cell" id="${prefix}${i}_2" style="line-height: 1.2; position:relative; width:80px; background:#050505; text-align:center; color:#444; border: 1px solid #1a1a1a; height:18px; font-size:10px; border-radius: 3px;"></td>`;
            const nameCell = tr.querySelector('.map-name');
            nameCell.oncontextmenu = (e) => { e.preventDefault(); sendGlobalAlert(mapData[0]); };
            mBody.appendChild(tr);

            ["_1", "_2"].forEach(os => {
                const id = `${prefix}${i}${os}`;
                const cell = document.getElementById(id);
                if (cachedData[id]) updateCellText(cell, cachedData[id].val || "");
                
                const btn = document.createElement('div');
                btn.style = "position:absolute; right:0; top:0; bottom:0; width:18px; background:rgba(255,255,255,0.08); color:#fff; cursor:pointer; display:none; align-items:center; justify-content:center; font-size:12px; z-index:5; font-weight:bold; border-radius: 0 2px 2px 0;";
                cell.appendChild(btn);
                
                cell.onmouseenter = () => { 
                    const isMe = getCellText(cell) === getHeroName(); 
                    btn.innerText = isMe ? "×" : "+"; 
                    btn.style.background = isMe ? "rgba(231, 76, 60, 0.3)" : "rgba(46, 204, 113, 0.2)"; 
                    btn.style.display = "flex"; 
                };
                cell.onmouseleave = () => btn.style.display = "none";
                btn.onclick = (e) => { 
                    e.stopPropagation(); 
                    const myNick = getHeroName(); 
                    const oldVal = getCellText(cell); 
                    const newVal = (oldVal !== myNick) ? myNick : ""; 
                    updateCellText(cell, newVal); 
                    sync(id, newVal); 
                };
            });
        });
        updateMapColors();
    }

    function getCellText(cell) { let text = ""; for (let node of cell.childNodes) if (node.nodeType === 3) text += node.nodeValue; return text.trim(); }

    function updateCellText(cell, text) {
        let textNode = Array.from(cell.childNodes).find(n => n.nodeType === 3);
        if (textNode) textNode.nodeValue = text; else cell.prepend(document.createTextNode(text));
        const myNick = getHeroName();
        if (text === myNick && text !== "") { cell.style.color = "#2ecc71"; cell.style.fontWeight = "bold"; cell.style.borderColor = "#27ae60"; cell.style.background = "rgba(46, 204, 113, 0.05)"; }
        else if (text !== "") { cell.style.color = "#fff"; cell.style.fontWeight = "normal"; cell.style.borderColor = "#fff"; cell.style.background = "rgba(243, 156, 18, 0.05)"; }
        else { cell.style.color = "#444"; cell.style.borderColor = "#1a1a1a"; cell.style.background = "#050505"; }
    }

    // Dragging & UI Logic
    let isDragging = false, offset = { x: 0, y: 0 };
    const dH = document.getElementById('dragHandle');
    dH.onmousedown = (e) => { if (e.target.tagName === 'BUTTON') return; isDragging = true; const rect = container.getBoundingClientRect(); offset = { x: e.clientX - rect.left, y: e.clientY - rect.top }; };
    window.onmousemove = (e) => { if (!isDragging) return; const vW = window.innerWidth, vH = window.innerHeight, cW = container.offsetWidth, cH = container.offsetHeight; let newX = e.clientX - offset.x, newY = e.clientY - offset.y; if (newX < 0) newX = 0; if (newX + cW > vW) newX = vW - cW; if (newY < 0) newY = 0; if (newY + cH > vH) newY = vH - cH; container.style.right = "auto"; container.style.left = newX + "px"; container.style.top = newY + "px"; };
    window.onmouseup = () => { if (isDragging) { isDragging = false; localStorage.setItem('mapSyncPos', JSON.stringify({ top: container.style.top, left: container.style.left, right: "auto" })); } };
    new ResizeObserver(() => { if (!container.classList.contains('minimized')) { localStorage.setItem('mapSyncSize', JSON.stringify({ width: container.style.width, height: container.style.height })); } }).observe(container);
    const toggleMin = () => { const isMin = container.classList.toggle('minimized'); scrollArea.style.display = isMin ? 'none' : 'block'; document.getElementById('miniTitle').style.display = isMin ? 'block' : 'none'; document.getElementById('tabsHeader').style.display = isMin ? 'none' : 'flex'; document.getElementById('min').innerText = isMin ? "+" : "−"; };
    scrollArea.addEventListener('wheel', (e) => { const scrollTop = scrollArea.scrollTop, scrollHeight = scrollArea.scrollHeight, height = scrollArea.offsetHeight, delta = e.deltaY; if ((delta > 0 && scrollTop + height >= scrollHeight) || (delta < 0 && scrollTop <= 0)) e.preventDefault(); e.stopPropagation(); }, { passive: false });
    
    document.getElementById('t1').onclick = () => { currentTab = 1; render(); updateBtn(); };
    document.getElementById('t2').onclick = () => { currentTab = 2; render(); updateBtn(); };
    document.getElementById('t3').onclick = () => { currentTab = 3; render(); updateBtn(); };
    document.getElementById('min').onclick = toggleMin;
    function updateBtn() { document.getElementById('t1').classList.toggle('active', currentTab === 1); document.getElementById('t2').classList.toggle('active', currentTab === 2); document.getElementById('t3').classList.toggle('active', currentTab === 3); }

   function autoMapCheck() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        let currentMap = win.Engine?.map?.d?.name || win.map?.name || "???";

        if (currentMap === "???" || currentMap === "") return;
        const myNick = getHeroName();

        let foundMatch = false;
        [arkusz1, arkusz2, arkusz3].forEach((arkusz, idx) => {
            const prefix = ["p", "n", "s"][idx];
            arkusz.forEach((mapData, i) => {
                if (mapData[0] === currentMap) {
                    foundMatch = true;
                    const id1 = `${prefix}${i}_1`, id2 = `${prefix}${i}_2`;
                    
                    const d1 = cachedData[id1] || { val: "", ts: 0 };
                    const d2 = cachedData[id2] || { val: "", ts: 0 };

                    // Jeśli już tu jesteśmy, zapamiętaj ID dla Heartbeata
                    if (d1.val === myNick) currentMyId = id1;
                    else if (d2.val === myNick) currentMyId = id2;
                    // Jeśli nas nie ma, nadpisz najstarszy wpis (największy czas/najstarszy ts)
                    else {
                        const targetId = (d1.ts <= d2.ts) ? id1 : id2;
                        currentMyId = targetId;
                        sync(targetId, myNick);
                    }
                }
            });
        });

        if (!foundMatch) currentMyId = null;
    }

    function updateMapColors() {
        const now = Date.now();
        document.querySelectorAll('.map-name').forEach(nameCell => {
            const row = nameCell.closest('tr');
            if (!row) return;
            const cells = row.querySelectorAll('.sync-cell');
            if (cells.length < 2) return;
            const ts1 = cachedData[cells[0].id]?.ts || 0;
            const ts2 = cachedData[cells[1].id]?.ts || 0;
            const lastTs = Math.max(ts1, ts2);
            if (lastTs > 0) {
                const diff = (now - lastTs) / 1000;
                if (diff < 60) { nameCell.style.color = "#fff"; }
                else if (diff < 120) { nameCell.style.color = "#f1c40f"; }
                else { nameCell.style.color = "#e74c3c"; }
                const minutes = Math.floor(diff / 60), seconds = Math.floor(diff % 60).toString().padStart(2, '0');
                const base = nameCell.getAttribute('data-base-name');
                nameCell.innerText = `(${minutes}:${seconds}) ${base}`;
            }
        });
    }

    function startHeartbeat() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (socket && socket.readyState === 1 && currentMyId) {
                socket.send(JSON.stringify({ 
                    type: 'heartbeat', 
                    nick: getHeroName(), 
                    id: currentMyId 
                }));
            }
        }, 1000); 
    }

    setInterval(updateMapColors, 1000);
    updateBtn();
    toggleMin();
    initSocket();
})();
