(function() {
    'use strict';

    const DB_BASE_URL = "https://margonem-b79f0-default-rtdb.europe-west1.firebasedatabase.app/";
    let eventSource = null;
    let cachedData = {};

    const arkusz1 = [
        ["Chodniki Mrinding p.1 - s.1", "blue"], ["Chodniki Mrinding p.1 - s.2", "blue"],
        ["Chodniki Mrinding p.2 - s.1", "blue"], ["Chodniki Mrinding p.2 - s.2", "blue"],
        ["Ścieżki Erebeth p.2 - s.1", "green"], ["Ścieżki Erebeth p.2 - s.2", "green"], ["Ścieżki Erebeth p.3", "green"],
        ["Kuźnia Worundriela p.1", "red"], ["Kuźnia Worundriela p.2", "red"], ["Kuźnia Worundriela p.3", "red"],
        ["Ognista Studnia p.1", "red"], ["Ognista Studnia p.2", "red"], ["Ognista Studnia p.3", "red"],
        ["Zaginiona Dolina", "purple"], ["Opuszczona Twierdza", "purple"], ["Mała Twierdza - wejście", "purple"],
        ["Mała Twierdza - magazyn", "purple"], ["Mała Twierdza - kor. zach.", "purple"],
        ["Mała Twierdza - mury zach.", "purple"], ["Mała Twierdza p.1", "purple"],
        ["Mała Twierdza - mury wsch.", "purple"], ["Czarcie Oparzeliska", "purple"],
        ["Grobowiec Przodków", "purple"], ["Cenotaf Berserkerów", "purple"]
    ];

    const arkusz2 = [
        ["Przejście Władców", "orange"], ["Korytarz Marzeń", "orange"], ["Sala Lodowej Magii", "orange"], ["Sala Szeptów", "orange"], ["Sala Strzał", "orange"],
        ["Rozlewisko Kai", "cyan"], ["Gvar Hamryd", "cyan"], ["Matecznik Szelestu", "cyan"], ["Suchy Pęd s.4", "cyan"], ["Suchy Pęd s.3", "cyan"], ["Suchy Pęd s.2", "cyan"], ["Suchy Pęd s.1", "cyan"],
        ["Pustynia - zachód", "magenta"], ["Pustynia - wschód", "magenta"], ["Skały Umarłych", "magenta"], ["Smocze Skalisko", "magenta"], ["Urwisko Vapora", "magenta"]
    ];

    function initLiveSync() {
        if (eventSource) eventSource.close();
        eventSource = new EventSource(`${DB_BASE_URL}.json`);
        eventSource.addEventListener('put', (e) => {
            const response = JSON.parse(e.data);
            const path = response.path;
            const data = response.data;
            if (path === "/") {
                cachedData = data || {};
                Object.keys(cachedData).forEach(id => {
                    const cell = document.getElementById(id);
                    if (cell) updateCellText(cell, cachedData[id] || "");
                });
            } else {
                const id = path.replace('/', '');
                cachedData[id] = data;
                const cell = document.getElementById(id);
                if (cell) updateCellText(cell, data || "");
            }
        });
        eventSource.onerror = () => setTimeout(initLiveSync, 3000);
    }

    async function sync(id, val, oldVal) {
        try {
            const res = await fetch(`${DB_BASE_URL}${id}.json`, {
                method: 'PUT',
                body: JSON.stringify(val)
            });
            if (!res.ok) throw new Error();
        } catch(e) {
            // Revert w razie błędu (Rollback)
            console.error("Błąd synchronizacji! Cofanie zmian...");
            cachedData[id] = oldVal;
            const cell = document.getElementById(id);
            if (cell) updateCellText(cell, oldVal || "");
        }
    }

    function getHeroName() {
        if (typeof window.Engine !== "undefined" && Engine.hero?.d) return Engine.hero.d.nick;
        if (typeof window.hero !== "undefined") return hero.nick;
        return "???";
    }

    const savedPos = JSON.parse(localStorage.getItem('mapSyncPos')) || { top: "5px", right: "5px", left: "auto" };
    const savedSize = JSON.parse(localStorage.getItem('mapSyncSize')) || { width: "330px", height: "400px" };

    const container = document.createElement('div');
    container.id = "mapSyncContainer";

    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        #mapSyncScroll::-webkit-scrollbar { width: 4px !important; }
        #mapSyncScroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2) !important; }
        #mapSyncScroll::-webkit-scrollbar-thumb { background: #333 !important; border-radius: 10px !important; }
        #mapSyncContainer.minimized { width: 178px !important; min-width: 150px !important; height: 28px !important; resize: none !important; border-color: #444 !important; }
        .nav-btn { cursor:pointer; background:none; border:none; font-size:10px; font-weight:bold; color: #666; padding: 4px 8px; transition: all 0.2s; position: relative; letter-spacing: 0.5px; }
        .nav-btn.active { color: #fff; }
        .nav-btn.active::after { content: ''; position: absolute; bottom: -2px; left: 8px; right: 8px; height: 2px; background: #fff; border-radius: 2px; }
        .sync-cell { transition: border-color 0.2s, color 0.2s; box-shadow: inset 0 0 5px rgba(0,0,0,0.5); }
        .map-name { text-shadow: 1px 1px 1px rgba(0,0,0,0.8); }
    `;
    document.head.appendChild(styleSheet);

    container.style = `
        position: fixed; top: ${savedPos.top}; right: ${savedPos.right}; left: ${savedPos.left};
        width: ${savedSize.width}; height: ${savedSize.height};
        min-width: 280px; min-height: 28px;
        z-index: 10000; background: rgba(10, 10, 10, 0.85);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        color: #fff; padding: 6px; border: 1px solid #222;
        border-radius: 8px; font-family: 'Verdana', sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6); user-select: none;
        resize: both; overflow: hidden; display: flex; flex-direction: column;
    `;

    container.innerHTML = `
        <div id="dragHandle" style="display:flex; margin-bottom:8px; justify-content:space-between; cursor: move; flex-shrink: 0; align-items: center; padding: 2px 4px;">
            <div id="tabsHeader" style="display:flex; gap:4px;">
                <button id="t1" class="nav-btn active">ELANCJA (143p)</button>
                <button id="t2" class="nav-btn">BARBARZYŃCA (300m)</button>
            </div>
            <div style="font-weight: bold; color: #fff; font-size: 10px; pointer-events:none; display:none; letter-spacing: 1px;" id="miniTitle">EVENT HEROS HELPER</div>
            <button id="min" style="background:rgba(255,255,255,0.05); color:#fff; border:none; width: 22px; height: 22px; border-radius: 4px; cursor:pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;">−</button>
        </div>
        <div id="mapSyncScroll" style="flex-grow: 1; overflow-y: auto; overflow-x: hidden; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;">
            <table style="width:100%; border-collapse: separate; border-spacing: 3px; table-layout: fixed;">
                <tbody id="mBody"></tbody>
            </table>
        </div>
    `;
    document.body.appendChild(container);

    const scrollArea = document.getElementById('mapSyncScroll');
    const mBody = document.getElementById('mBody');
    let currentTab = 1;

    const handleScroll = (e) => {
        const delta = e.deltaY || (e.wheelDelta ? -e.wheelDelta : e.detail);
        scrollArea.scrollTop += delta;
        e.preventDefault();
        e.stopPropagation();
    };
    scrollArea.addEventListener('wheel', handleScroll, { passive: false });

    function render() {
        mBody.innerHTML = "";
        const data = currentTab === 1 ? arkusz1 : arkusz2;
        const prefix = currentTab === 1 ? "e" : "b";
        data.forEach((mapData, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="map-name" style="padding:4px; color:#ddd; border: 1px solid #1a1a1a; background: rgba(30,30,30,0.3); font-size: 10px; border-left: 3px solid ${mapData[1]}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-radius: 2px;">${mapData[0]}</td>
                <td class="sync-cell" id="${prefix}${i}_1" style="line-height: 1.2; position:relative; width:80px; background:#050505; text-align:center; color:#444; border: 1px solid #1a1a1a; height:18px; font-size:10px; border-radius: 3px;"></td>
                <td class="sync-cell" id="${prefix}${i}_2" style="line-height: 1.2; position:relative; width:80px; background:#050505; text-align:center; color:#444; border: 1px solid #1a1a1a; height:18px; font-size:10px; border-radius: 3px;"></td>
            `;
            mBody.appendChild(tr);
            ["_1", "_2"].forEach(os => {
                const id = `${prefix}${i}${os}`;
                const cell = document.getElementById(id);
                if (cachedData[id]) updateCellText(cell, cachedData[id]);

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
                    cachedData[id] = newVal;

                    sync(id, newVal, oldVal);
                };
            });
        });
    }

    function getCellText(cell) {
        let text = "";
        for (let node of cell.childNodes) if (node.nodeType === 3) text += node.nodeValue;
        return text.trim();
    }

    function applyStyle(cell, text) {
        const myNick = getHeroName();
        if (text === myNick && text !== "") {
            cell.style.color = "#2ecc71"; cell.style.fontWeight = "bold"; cell.style.borderColor = "#27ae60";
            cell.style.background = "rgba(46, 204, 113, 0.05)";
        } else if (text !== "") {
            cell.style.color = "#fff"; cell.style.fontWeight = "normal"; cell.style.borderColor = "#fff";
            cell.style.background = "rgba(243, 156, 18, 0.05)";
        } else {
            cell.style.color = "#444"; cell.style.borderColor = "#1a1a1a"; cell.style.background = "#050505";
        }
    }

    function updateCellText(cell, text) {
        let textNode = Array.from(cell.childNodes).find(n => n.nodeType === 3);
        if (textNode) textNode.nodeValue = text;
        else cell.prepend(document.createTextNode(text));
        applyStyle(cell, text);
    }

    const resizeObserver = new ResizeObserver(() => {
        if (!container.classList.contains('minimized')) {
            localStorage.setItem('mapSyncSize', JSON.stringify({ width: container.style.width, height: container.style.height }));
        }
    });
    resizeObserver.observe(container);

    let isDragging = false, offset = { x: 0, y: 0 };
    document.getElementById('dragHandle').onmousedown = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        offset = { x: container.offsetLeft - e.clientX, y: container.offsetTop - e.clientY };
    };
    document.onmousemove = (e) => {
        if (!isDragging) return;
        container.style.top = (e.clientY + offset.y) + "px";
        container.style.left = (e.clientX + offset.x) + "px";
        container.style.right = "auto";
    };
    document.onmouseup = () => {
        if (isDragging) {
            isDragging = false;
            localStorage.setItem('mapSyncPos', JSON.stringify({ top: container.style.top, left: container.style.left, right: "auto" }));
        }
    };

    const toggleMin = () => {
        const isMin = container.classList.toggle('minimized');
        scrollArea.style.display = isMin ? 'none' : 'block';
        document.getElementById('miniTitle').style.display = isMin ? 'block' : 'none';
        document.getElementById('tabsHeader').style.display = isMin ? 'none' : 'flex';
        document.getElementById('min').innerText = isMin ? "+" : "−";
        if (!isMin) {
            const sSize = JSON.parse(localStorage.getItem('mapSyncSize'));
            container.style.width = sSize ? sSize.width : "330px";
            container.style.height = sSize ? sSize.height : "400px";
        }
    };

    document.getElementById('t1').onclick = () => { currentTab = 1; render(); updateBtn(); };
    document.getElementById('t2').onclick = () => { currentTab = 2; render(); updateBtn(); };
    document.getElementById('min').onclick = toggleMin;

    function updateBtn() {
        document.getElementById('t1').classList.toggle('active', currentTab === 1);
        document.getElementById('t2').classList.toggle('active', currentTab === 2);
    }

    render();
    updateBtn();
    toggleMin();
    initLiveSync();
})();
