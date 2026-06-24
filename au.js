(function() {
    'use strict';

    const win = (typeof unsafewin !== 'undefined') ? unsafewin : window;
    const titanMapsIds = [1800, 1745, 6950, 7061, 7478, 6058, 5947, 7849, 5710, 3313, 2758, 4238];
    const currentAttack = [];

    const savedPos = JSON.parse(localStorage.getItem('fleeHubPos')) || { top: "80%", left: "20px" };
    let isScriptEnabled = localStorage.getItem('flee_script_enabled') !== 'false';

    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        #fleeMain { position: fixed; z-index: 30000; font-family: 'Verdana', sans-serif; user-select: none; display: flex; align-items: center; gap: 10px; background: rgba(10, 10, 10, 0.85); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); cursor: move; transition: border-color 0.2s; }
        #fleeMain:hover { border-color: rgba(255,255,255,0.3); }
        .flee-label { color: #eee; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }
        .flee-toggle { min-width: 30px; height: 16px; background: #333; border-radius: 10px; position: relative; cursor: pointer; transition: background 0.3s; border: 1px solid rgba(255,255,255,0.05); }
        .flee-toggle.active { background: #2ecc71; box-shadow: 0 0 8px rgba(46, 204, 113, 0.4); }
        .flee-circle { width: 12px; height: 12px; background: white; border-radius: 50%; position: absolute; top: 1.5px; left: 2px; transition: all 0.2s; }
        .flee-toggle.active .flee-circle { left: 14px; }
    `;
    document.head.appendChild(styleSheet);

    const hub = document.createElement('div');
    hub.id = "fleeMain";
    hub.style.top = savedPos.top;
    hub.style.left = savedPos.left;
    hub.innerHTML = `
        <span class="flee-label">AU</span>
        <div id="fleeToggleBtn" class="flee-toggle ${isScriptEnabled ? 'active' : ''}">
            <div class="flee-circle"></div>
        </div>
    `;
    document.body.appendChild(hub);

    const toggleBtn = hub.querySelector('#fleeToggleBtn');
    toggleBtn.onclick = () => {
        if (wasDragged) return;
        isScriptEnabled = !toggleBtn.classList.contains('active');
        toggleBtn.classList.toggle('active');
        localStorage.setItem('flee_script_enabled', isScriptEnabled);

        if (!isScriptEnabled) currentAttack.length = 0;
    };

    let wasDragged = false;
    const dragThreshold = 5;
    let startCoords = { x: 0, y: 0 };
    let startPos = { x: 0, y: 0 };

    hub.addEventListener('mousedown', (e) => {
        if (e.target.closest('.flee-toggle')) wasDragged = false;
        startCoords = { x: e.clientX, y: e.clientY };
        startPos = { x: e.clientX - hub.offsetLeft, y: e.clientY - hub.offsetTop };
        hub.style.opacity = "0.7";

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startCoords.x;
            const dy = moveEvent.clientY - startCoords.y;
            if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) wasDragged = true;

            if (wasDragged) {
                let newLeft = moveEvent.clientX - startPos.x;
                let newTop = moveEvent.clientY - startPos.y;
                newLeft = Math.max(0, Math.min(newLeft, win.innerWidth - hub.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, win.innerHeight - hub.offsetHeight));
                hub.style.left = newLeft + "px";
                hub.style.top = newTop + "px";
            }
        };

        const onMouseUp = () => {
            win.removeEventListener('mousemove', onMouseMove);
            win.removeEventListener('mouseup', onMouseUp);
            hub.style.opacity = "1";
            if (wasDragged) {
                localStorage.setItem('fleeHubPos', JSON.stringify({ top: hub.style.top, left: hub.style.left }));
                setTimeout(() => { wasDragged = false; }, 50);
            }
        };
        win.addEventListener('mousemove', onMouseMove);
        win.addEventListener('mouseup', onMouseUp);
    });

    function isTitanMap() {
        return titanMapsIds.includes(win.Engine?.map?.d?.id);
    }

    function parseStats(item) {
        const res = {};
        (item.stat || "").split(";").forEach(entry => {
            if (!entry) return;
            const [key, val] = entry.split("=");
            if (key) res[key] = val ?? "true";
        });
        return res;
    }

    function parseTimelimit(raw) {
        if (!raw) return null;
        const parts = raw.split(",");
        if (parts.length === 2) {
            return { maxSec: parseInt(parts[0]), endTs: parseInt(parts[1]) };
        }
        return null;
    }

    function getCooldownProgress(item) {
        if (!item || typeof item.getItemStat !== 'function') return 0;
        const raw = item.getItemStat("timelimit") || item.getItemStat("custom_timelimit") || "";
        const tl = parseTimelimit(raw);
        if (!tl) return 0;
        const currentTs = Math.floor(Date.now() / 1000);
        const remaining = tl.endTs - currentTs;
        return remaining <= 0 ? 0 : Math.min(remaining / tl.maxSec, 1);
    }

    function useFlee() {
        if (!isScriptEnabled || currentAttack.length === 0) return false;

        const items = win.Engine?.items?.fetchLocationItems("g");
        const isPvP = !Object.keys(win.Engine?.battle?.warriorsList || {}).some(id => Number(id) < 0);

        const noBattle = !!win.Engine?.battle?.warriorsList;

        if (!items || !isPvP || noBattle) return false;

        let targetItemId = null;
        for (const item of items) {
            const itemParse = parseStats(item);
            if (itemParse?.action === 'flee' && !getCooldownProgress(item)) {
                targetItemId = item.id;
                break;
            }
        }

        if (targetItemId) {
            win._g('moveitem&st=1&id=' + targetItemId);
            return true;
        }
        return false;
    }

    function initFlee() {
        if (!isScriptEnabled || !isTitanMap()) return;

        const startTime = parseFloat(win.Engine.getEv());
        const targetTime = startTime + 1.80;

        function checkTimeFrame() {
            // if (!isScriptEnabled || currentAttack.length === 0) return;
            if (!win.Engine || typeof win.Engine.getEv !== 'function') return;

            const currentServerTime = parseFloat(win.Engine.getEv());

            if (currentServerTime >= targetTime) {
                if (!useFlee()) {
                    requestAnimationFrame(checkTimeFrame);
                }
            } else {
                requestAnimationFrame(checkTimeFrame);
            }
        }
        requestAnimationFrame(checkTimeFrame);
    }

    function intercept(obj, key, cb) {
        const original = obj[key];
        obj[key] = (...args) => cb(...args) ?? original.apply(obj, args);
    }

    intercept(win.Engine.communication, 'parseJSON', (data) => {
        if (data && data.emo && Array.isArray(data.emo)) {
            const partyMembers = win.Engine.party?.getMembers();

            if (partyMembers) {
                const validIds = currentAttack.filter(id => partyMembers.has(id));
                currentAttack.length = 0;
                currentAttack.push(...validIds);
            }

            data.emo.forEach(efekt => {
                const id = efekt.source_id;

                if (partyMembers && partyMembers.has(id)) {
                    if (efekt.name === 'frnd') {
                                                    initFlee();

                        if (!currentAttack.includes(id)) {
                            currentAttack.push(id);
                            initFlee();
                        }
                    }

                    if (efekt.name === 'noemo') {
                        const index = currentAttack.indexOf(id);
                        if (index !== -1) {
                            currentAttack.splice(index, 1);
                        }
                    }
                }
            });
        }
    });
})();
