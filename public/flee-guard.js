(function() {
    'use strict';

    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    let pvpOnly = localStorage.getItem('mrg_flee_pvp_only') !== 'false';
    const savedPos = JSON.parse(localStorage.getItem('mrg_flee_mini_pos')) || { top: "80%", left: "20px" };

    const style = document.createElement('style');
    style.innerText = `
        #mrgFleeBtn {
            position: fixed;
            z-index: 30000;
            margin: 0;
            pointer-events: auto;
            cursor: pointer;
            user-select: none;
            height: 26px;
            width: 90px;
        }
        #mrgFleeBtn:hover {
            filter: brightness(1.2);
        }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('div');
    btn.id = "mrgFleeBtn";
    btn.style.left = savedPos.left;
    btn.style.top = savedPos.top;

    btn.innerHTML = `
        <div class="background"></div>
        <div class="label" style="display:flex; align-items:center; justify-content:center; gap:5px; padding: 0 4px; height: 100%;">
            <img src="https://micc.garmory-cdn.cloud/obrazki/itemy/eve/loteria_uczieczka.gif" style="width:20px; height:20px; object-fit:contain;">
            <span id="mrgFleeText">PVP</span>
        </div>
    `;
    document.body.appendChild(btn);

    const textEl = document.getElementById('mrgFleeText');

    function updateBtn() {
        if (pvpOnly) {
            btn.className = "button green small";
            textEl.innerText = "PVP";
        } else {
            btn.className = "button red small";
            textEl.innerText = "ALL";
        }
    }
    updateBtn();

    // Tooltip
    btn.addEventListener('mouseenter', () => {
        if (!win.mrgCustomTip) {
            win.mrgCustomTip = document.createElement('div');
            win.mrgCustomTip.className = 'c-window border-window transparent';
            win.mrgCustomTip.style.cssText = 'position: fixed; display: none; z-index: 100000; pointer-events: none; min-width: 140px;';
            win.mrgCustomTip.innerHTML = '<div class="border-image"></div><div class="content" style="position: relative; z-index: 2; padding: 6px; font-size: 11px; color: #ddd; white-space: nowrap;"></div>';
            document.body.appendChild(win.mrgCustomTip);
        }
        const tipContent = win.mrgCustomTip.querySelector('.content');
        tipContent.innerHTML = pvpOnly
            ? '<b style="color:#8cd9a0;">PVP:</b> Blokuje ucieczkę itemem z potworów (PvE)'
            : '<b style="color:#fc3e40;">ALL:</b> Zezwala na ucieczkę na każdej walce';

        win.mrgCustomTip.style.display = 'block';
        const rect = btn.getBoundingClientRect();
        win.mrgCustomTip.style.left = rect.left + 'px';
        win.mrgCustomTip.style.top = (rect.bottom + 4) + 'px';
    });

    btn.addEventListener('mouseleave', () => {
        if (win.mrgCustomTip) win.mrgCustomTip.style.display = 'none';
    });

    let isDragging = false;
    let dragStarted = false;
    let offsetX = 0, offsetY = 0;

    btn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = false;
        dragStarted = true;
        offsetX = e.clientX - btn.getBoundingClientRect().left;
        offsetY = e.clientY - btn.getBoundingClientRect().top;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!dragStarted) return;
        isDragging = true;
        if (win.mrgCustomTip) win.mrgCustomTip.style.display = 'none';

        let newX = Math.max(0, Math.min(window.innerWidth - btn.offsetWidth, e.clientX - offsetX));
        let newY = Math.max(0, Math.min(window.innerHeight - btn.offsetHeight, e.clientY - offsetY));

        btn.style.left = newX + 'px';
        btn.style.top = newY + 'px';
    });

    window.addEventListener('mouseup', () => {
        if (!dragStarted) return;
        dragStarted = false;

        if (isDragging) {
            localStorage.setItem('mrg_flee_mini_pos', JSON.stringify({ top: btn.style.top, left: btn.style.left }));
        } else {
            pvpOnly = !pvpOnly;
            localStorage.setItem('mrg_flee_pvp_only', pvpOnly);
            updateBtn();
        }
    });

    function parseStats(item) {
        const res = {};
        (item?.stat || "").split(";").forEach(entry => {
            if (!entry) return;
            const [key, val] = entry.split("=");
            if (key) res[key] = val ?? "true";
        });
        return res;
    }

    function isFleeItem(id) {
        const item = win.Engine?.items?.getItemById?.(id);
        if (!item) return false;
        const stats = parseStats(item);
        return stats.action === 'flee';
    }

    function isPvEBattle() {
        if (!win.Engine?.battle?.show) return false;
        const warriors = win.Engine?.battle?.warriorsList || {};
        return Object.keys(warriors).some(id => Number(id) < 0);
    }

    const originalG = win._g;
    if (typeof originalG === 'function') {
        win._g = function(query, callback, ...args) {
            if (pvpOnly && typeof query === 'string' && query.includes('moveitem') && query.includes('st=1')) {
                const match = query.match(/id=(\d+)/);
                if (match && match[1]) {
                    const itemId = Number(match[1]);
                    if (isFleeItem(itemId) && isPvEBattle()) {
                        if (win.message) win.message("Ucieczka z PvE zablokowana");
                        return;
                    }
                }
            }
            return originalG.apply(this, [query, callback, ...args]);
        };
    }
})();
