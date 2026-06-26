(function() {
    'use strict';

    const CONFIG_URL = "https://margonem.vercel.app/scripts.json";

    const savedPos = JSON.parse(localStorage.getItem('hubPos')) || { top: "80%", left: "20px" };

    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        #hubMain { position: fixed; z-index: 30000; font-family: 'Verdana', sans-serif; user-select: none; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
        #hubIcon { width: 32px; height: 32px; background: rgba(10, 10, 10, 0.8); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: move; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: transform 0.2s; }
        #hubIcon:hover { transform: scale(1.05); border-color: rgba(255,255,255,0.3); }
        #hubMenu { display: none; background: rgba(10, 10, 10, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); max-width: 360px; border-radius: 10px; padding: 12px; min-width: 180px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); }
        .hub-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 15px; border-bottom: 1px solid #222222; }
        .hub-desc { padding-bottom: 5px; width:100%; font-size: 8px; font-weight: 300; line-height:1.2;  text-transform: none; color: #adadad; margin-top: 2px;}
        .hub-label {display: flex; flex-wrap: wrap; gap: 2px; align-items:center; color: #eee; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }
        .hub-toggle { min-width: 30px; height: 16px; background: #333; border-radius: 10px; position: relative; cursor: pointer; transition: background 0.3s; border: 1px solid rgba(255,255,255,0.05); }
        .hub-toggle.active { background: #2ecc71; box-shadow: 0 0 8px rgba(46, 204, 113, 0.4); }
        .hub-circle { width: 12px; height: 12px; background: white; border-radius: 50%; position: absolute; top: 1.5px; left: 2px; transition: all 0.2s; }
        .hub-toggle.active .hub-circle { left: 18px; }
        #hubSaveBtn {
            display: none; width: 100%; margin-top: 10px; padding: 8px;
            background: #2ecc71; color: white; border: none; border-radius: 4px;
            font-size: 10px; font-weight: bold; cursor: pointer;
            text-align: center; transition: background 0.2s;
        }
        #hubSaveBtn:hover { background: #27ae60; }
    `;
    document.head.appendChild(styleSheet);

    const hub = document.createElement('div');
    hub.id = "hubMain";
    hub.style.top = savedPos.top;
    hub.style.left = savedPos.left;

    const icon = document.createElement('div');
    icon.id = "hubIcon";
    icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;

    const menu = document.createElement('div');
    menu.id = "hubMenu";

    const saveBtn = document.createElement('button');
    saveBtn.id = "hubSaveBtn";
    saveBtn.innerText = "ODŚWIEŻ";
    saveBtn.onclick = () => location.reload();

    hub.appendChild(icon);
    hub.appendChild(menu);
    document.body.appendChild(hub);

    function initHub() {
        GM_xmlhttpRequest({
            method: "GET",
            url: CONFIG_URL + "?t=" + new Date().getTime(),
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    renderMenu(data.scripts);
                } catch (e) {
                    menu.innerHTML = `<div style="color:red; font-size:9px;">Błąd JSON</div>`;
                }
            },
            onerror: function() {
                menu.innerHTML = `<div style="color:red; font-size:9px;">Błąd połączenia</div>`;
            }
        });
    }

    function renderMenu(scripts) {
        menu.innerHTML = `<div style="color:#666; font-size:9px; margin-bottom:12px; font-weight:bold; border-bottom:1px solid #222; padding-bottom:6px; letter-spacing: 1px;">DODATKI GROLI</div>`;

        scripts.forEach(script => {
            const isActive = localStorage.getItem("hub_" + script.id) === "true";
            const row = document.createElement('div');
            row.className = "hub-row";
            row.innerHTML = `<span class="hub-label">
            ${script.name}
            <p class="hub-desc">${script.description}</p>
            </span>`;

            const toggle = document.createElement('div');
            toggle.className = `hub-toggle ${isActive ? 'active' : ''}`;
            toggle.innerHTML = `<div class="hub-circle"></div>`;

            if (isActive) {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: script.url + "?t=" + new Date().getTime(),
                    onload: function(res) {
                        try {
                            if (script.tm_context === true) {
                                eval(res.responseText);
                            } else {
                                const s = document.createElement('script');
                                s.textContent = res.responseText;
                                document.head.appendChild(s);
                            }
                        } catch (e) {
                            console.error(`❌ Błąd ładowania skryptu ${script.name}:`, e);
                        }
                    }
                });
            }

            toggle.onclick = () => {
                const nowActive = !toggle.classList.contains('active');
                toggle.classList.toggle('active');
                localStorage.setItem("hub_" + script.id, nowActive);
                saveBtn.style.display = "block";
            };

            row.appendChild(toggle);
            menu.appendChild(row);
        });

        menu.appendChild(saveBtn);
    }

let wasDragged = false;
    const dragThreshold = 5;
    let startCoords = { x: 0, y: 0 };
    let startPos = { x: 0, y: 0 };

    function startDrag(e) {
        wasDragged = false;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startCoords = { x: clientX, y: clientY };
        startPos = { x: clientX - hub.offsetLeft, y: clientY - hub.offsetTop };
        icon.style.opacity = "0.7";

        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        const onMove = (moveEvent) => {
            const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

            const dx = currentX - startCoords.x;
            const dy = currentY - startCoords.y;

            if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
                wasDragged = true;
            }

            if (wasDragged) {
                let newLeft = currentX - startPos.x;
                let newTop = currentY - startPos.y;

                newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - hub.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, window.innerHeight - hub.offsetHeight));

                hub.style.left = newLeft + "px";
                hub.style.top = newTop + "px";
            }
        };

        const onEnd = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
            icon.style.opacity = "1";

            if (wasDragged) {
                localStorage.setItem('hubPos', JSON.stringify({ top: hub.style.top, left: hub.style.left }));
            }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    }

    icon.addEventListener('mousedown', startDrag);
    icon.addEventListener('touchstart', startDrag, { passive: false });

    icon.addEventListener('click', (e) => {
        if (wasDragged) {
            e.preventDefault();
            return;
        }
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });

    initHub();
})();
