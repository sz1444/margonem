(function() {
    'use strict';

    const SWIAT = "Nubes";
    const ONLINE_URL = `https://staticinfo.margonem.pl/online/${SWIAT.toLowerCase()}.json`;
    const PULSE_THRESHOLD = 10;

    const CACHE_TTL = 4 * 60 * 60 * 1000;

    const KLANES = [
        { id: 72, name: "300 ", color: "#4cfa4f", type: "friend" },
        { id: 86, name: "300", color: "#fc3e40", type: "enemy" },
        { id: 103, name: "271 ", color: "#4cfa4f", type: "friend" },
        { id: 79, name: "271", color: "#fc3e40", type: "enemy" },
        { id: 103, name: "244 ", color: "#4cfa4f", type: "friend" },
        { id: 79, name: "244", color: "#fc3e40", type: "enemy" },
        { id: 96, name: "217 ", color: "#4cfa4f", type: "friend" },
        { id: 52, name: "217", color: "#fc3e40", type: "enemy" },
        { id: 64, name: "190 ", color: "#4cfa4f", type: "friend" },
        { id: 116, name: "190", color: "#fc3e40", type: "enemy" },
        { id: 64, name: "167 ", color: "#4cfa4f", type: "friend" },
        { id: 116, name: "167", color: "#fc3e40", type: "enemy" },
        { id: 105, name: "144 ", color: "#fc3e40", type: "enemy" },
        { id: 119, name: "144", color: "#4cfa4f", type: "friend" },
        { id: 88, name: "114 ", color: "#4cfa4f", type: "friend" },
        { id: 80, name: "114", color: "#fc3e40", type: "enemy" },
    ];

    let klanMembers = {};
    let suroweDane = [];

    const savedPos = JSON.parse(localStorage.getItem('mrg_online_pos')) || { top: "50px", left: "50px" };
    const savedOpacityLvl = localStorage.getItem('mrg_online_opacity_lvl') || "0";

    const panel = document.createElement('div');
    panel.id = "mrgOnlinePanel";
    panel.className = "c-window border-window ui-draggable transparent whoishere-window window-on-peak";
    panel.setAttribute('data-opacity-lvl', savedOpacityLvl);
    panel.style.cssText = `
        position: absolute;
        z-index: 18;
        left: ${savedPos.left};
        top: ${savedPos.top};
        width: 242px;
        height: 310px;
        display: flex;
        flex-direction: column;
    `;

    panel.innerHTML = `
        <div class="header-label-positioner" id="mrgOnlineHeader">
            <div class="draggable-window-element ui-draggable-handle"></div>
            <div class="header-label">
                <div class="left-decor"></div>
                <div class="right-decor"></div>
                <div class="text" name="Online" id="mrgHeaderText">Online (0)</div>
            </div>
        </div>
        <div class="content" id="mrgContentArea">
            <div class="inner-content" style="display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
                <div class="who-is-here" style="display: flex; flex-direction: column; height: 100%;">
                    <div class="scroll-wrapper small-bar" style="flex: 1; height: auto;">
                        <div class="scroll-pane" style="position: relative; width: 100%; height: 100%;">
                            <div class="player-list" id="mrg-players" style="padding: 4px;">
                                <div style="color: #eaeaea; text-align: center; padding-top: 15px; font-size: 11px;">Ładowanie...</div>
                            </div>
                        </div>
                    </div>
                    <div id="mrg-footer-info" style="font-size: 9px; color: #eaeaea; text-align: center; padding-top: 2px; border-top: 1px solid rgba(255, 255, 255, 0.05); margin-top: 2px; flex-shrink: 0; letter-spacing: 0.3px;">Dane z: --:--:--</div>
                </div>
            </div>
        </div>
        <div class="close-button-corner-decor">
            <button type="button" class="close-button" id="mrgOnlineToggle"><div class="ie-icon ie-icon-close"></div></button>
        </div>
        <div class="border-image" id="mrgBorderImage"></div>
        <div class="transparent-window-buttons-menu" id="mrgButtonsMenu" >
            <div class="manage-hamburger-button" id="mrgRefreshBtn" title="Odśwież"><div class="ie-icon ie-icon-menu"></div></div>
            <div class="increase-opacity" id="mrgOpacityBtn" title="Zmień przezroczystość"></div>
        </div>
    `;
    document.body.appendChild(panel);

    const style = document.createElement('style');
    style.innerText = `
        .clan-columns { display: flex; gap: 3px; box-sizing: border-box; width: 100%; }
        .clan-column { flex: 1; display: flex; flex-direction: column; gap: 0px; min-width: 0; }
        .clan-cell { display: flex; justify-content: space-between; align-items: center; cursor: default; width: 100%; box-sizing: border-box; padding: 0px 3px; }
        .clan-cell:hover { filter: brightness(1.2); }
        #mrgRefreshBtn:hover, #mrgOpacityBtn:hover { filter: brightness(1.2); cursor: pointer; }
        @keyframes mrgPulseRed {
   0%, 100% { box-shadow: inset 0 0 0 20px rgba(252, 62, 64, 0.1); }
    50% { box-shadow: inset 0 0 0 20px rgba(252, 62, 64, 0.2); }
}
.mrg-pulse-red {
    animation: mrgPulseRed 1.5s infinite;
}
    `;
    document.head.appendChild(style);

    const opacityBtn = document.getElementById('mrgOpacityBtn');
    opacityBtn.onclick = (e) => {
        e.stopPropagation();
        let currentLvl = parseInt(panel.getAttribute('data-opacity-lvl')) || 0;
        let nextLvl = currentLvl + 1;
        if (nextLvl > 5) {
            nextLvl = 0;
        }
        panel.setAttribute('data-opacity-lvl', nextLvl);
        localStorage.setItem('mrg_online_opacity_lvl', nextLvl);
    };

    const header = document.getElementById('mrgOnlineHeader');
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
            localStorage.setItem('mrg_online_pos', JSON.stringify({ top: panel.style.top, left: panel.style.left }));
        }
    });

    let isCollapsed = false;
    const toggleBtn = document.getElementById('mrgOnlineToggle');
    const contentEl = document.getElementById('mrgContentArea');
    const bottomBarEl = document.getElementById('mrgBottomBar');
    const borderImageEl = document.getElementById('mrgBorderImage');
    const buttonsMenuEl = document.getElementById('mrgButtonsMenu');

    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        isCollapsed = !isCollapsed;

        if (isCollapsed) {
            panel.dataset.prevHeight = '310px';
            panel.style.height = '28px';
            contentEl.style.display = 'none';
            bottomBarEl.style.display = 'none';
            borderImageEl.style.display = 'none';
            buttonsMenuEl.style.display = 'none';
            toggleBtn.querySelector('.ie-icon').className = 'ie-icon ie-icon-plus';
        } else {
            panel.style.height = panel.dataset.prevHeight || '310px';
            contentEl.style.display = 'flex';
            bottomBarEl.style.display = 'block';
            borderImageEl.style.display = 'block';
            buttonsMenuEl.style.display = 'flex';
            toggleBtn.querySelector('.ie-icon').className = 'ie-icon ie-icon-close';
        }
    };

    function pobierzKlanyIZaładuj() {
        const cachedData = localStorage.getItem(`mrg_clan_cache_${SWIAT}`);
        const cachedTime = localStorage.getItem(`mrg_clan_time_${SWIAT}`);
        const now = Date.now();

        if (cachedData && cachedTime && (now - parseInt(cachedTime) < CACHE_TTL)) {
            try {
                klanMembers = JSON.parse(cachedData);
                zaplanujPobieranieOnline();
                return;
            } catch (e) {}
        }

        klanMembers = {};
        const unikalneIdKlans = [...new Set(KLANES.map(k => k.id))];
        let index = 0;

        function pobierzKolejny() {
            if (index >= unikalneIdKlans.length) {
                try {
                    localStorage.setItem(`mrg_clan_cache_${SWIAT}`, JSON.stringify(klanMembers));
                    localStorage.setItem(`mrg_clan_time_${SWIAT}`, Date.now().toString());
                } catch(e) {}
                zaplanujPobieranieOnline();
                return;
            }

            let klanId = unikalneIdKlans[index];

            index++;

            GM_xmlhttpRequest({
                method: "GET",
                url: `https://www.margonem.pl/guilds/view,${SWIAT},${klanId}`,
                headers: {
                    "User-Agent": navigator.userAgent,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                },
                onload: function(kRes) {
                    try {
                        const parser = new DOMParser();
                        const kDoc = parser.parseFromString(kRes.responseText, "text/html");

                        kDoc.querySelectorAll('a').forEach(a => {
                            let href = a.getAttribute('href');
                            let nick = a.textContent.trim();

                            if (href && (href.includes('profile') || href.includes('player') || href.includes('avatar') || a.closest('table'))) {
                                try {
                                    let decodedHref = decodeURIComponent(href);
                                    let parts = decodedHref.split(',');
                                    let possibleNick = parts[parts.length - 1].trim();
                                    if (possibleNick && possibleNick.length > 1 && !possibleNick.includes('/')) {
                                        klanMembers[possibleNick.toLowerCase()] = klanId;
                                    }
                                } catch(err) {}

                                if (nick && nick.length > 1 && !nick.includes('\n')) {
                                    klanMembers[nick.toLowerCase()] = klanId;
                                }
                            }
                        });
                    } catch(e) {}

                    setTimeout(pobierzKolejny, 700);
                },
                onerror: function() {
                    setTimeout(pobierzKolejny, 700);
                }
            });
        }

        pobierzKolejny();
    }

    function pobierzOnline() {
        GM_xmlhttpRequest({
            method: "GET",
            url: ONLINE_URL,
            onload: function(res) {
                try {
                    suroweDane = JSON.parse(res.responseText);

                    const headerText = document.getElementById('mrgHeaderText');
                    if (headerText) {
                        headerText.innerText = `Online (${suroweDane.length})`;
                    }

                    const now = new Date();
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const seconds = String(now.getSeconds()).padStart(2, '0');

                    const footerInfo = document.getElementById('mrg-footer-info');
                    if (footerInfo) {
                        footerInfo.innerText = `Dane z: ${hours}:${minutes}:${seconds}`;
                    }

                    wyswietl(suroweDane);
                } catch(e) {
                    document.getElementById('mrg-players').innerText = "Błąd JSON.";
                }
            },
            onerror: () => {
                document.getElementById('mrg-players').innerText = "Błąd sieci.";
            }
        });
    }

    let isIntervalStarted = false;
    function zaplanujPobieranieOnline() {
        pobierzOnline();

        if (!isIntervalStarted) {
            isIntervalStarted = true;

            function obliczKolejneOpóźnienie() {
                const now = new Date();
                let delay = (62 - now.getSeconds()) * 1000 - now.getMilliseconds();
                if (delay < 1000) delay += 60000;

                setTimeout(() => {
                    pobierzOnline();
                    obliczKolejneOpóźnienie();
                }, delay);
            }

            obliczKolejneOpóźnienie();
        }
    }

    document.getElementById('mrgRefreshBtn').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('mrg-players').innerHTML = '<div style="color: #eaeaea; text-align: center; padding-top: 15px; font-size: 11px;">Odświeżanie...</div>';
        localStorage.removeItem(`mrg_clan_cache_${SWIAT}`);
        localStorage.removeItem(`mrg_clan_time_${SWIAT}`);
        pobierzKlanyIZaładuj();
    };

    function wyswietl(gracze) {
        const kontener = document.getElementById('mrg-players');
        let grupowane = {};

        KLANES.forEach(item => {
            if (!grupowane[item.name]) grupowane[item.name] = [];
        });
        grupowane["Pozostali"] = [];

        gracze.forEach(g => {
            let klanId = klanMembers[g.n.toLowerCase()];
            let przypisany = false;

            if (klanId !== undefined) {
                for (let item of KLANES) {
                    if (item.id === klanId) {
                        let targetVal = item.name.trim();
                        let match = false;
                        let playerLvl = parseInt(g.l);

                        if (targetVal === "271" && playerLvl === 271) match = true;
                        if (targetVal === "244" && playerLvl === 244) match = true;
                        if (targetVal === "190" && playerLvl === 190) match = true;
                        if (targetVal === "167" && playerLvl === 167) match = true;
                        if (["300", "217", "144", "114"].includes(targetVal)) match = true;

                        if (match) {
                            if (!grupowane[item.name]) grupowane[item.name] = [];
                            grupowane[item.name].push(g);
                            przypisany = true;
                            break;
                        }
                    }
                }
            }

            if (!przypisany) {
                grupowane["Pozostali"].push(g);
            }
        });

        let friends = KLANES.filter(k => k.type === 'friend');
        let enemies = KLANES.filter(k => k.type === 'enemy');
        let pozostali = { name: "Pozostali", color: "#eaeaea" };

        let sumaFriends = friends.reduce((sum, k) => sum + (grupowane[k.name] ? grupowane[k.name].length : 0), 0);
        let sumaEnemies = enemies.reduce((sum, k) => sum + (grupowane[k.name] ? grupowane[k.name].length : 0), 0);

        let renderCell = (klanObj) => {
            let klan = klanObj.name;
            let kolorKlanu = klanObj.color;
            if (!grupowane[klan]) grupowane[klan] = [];
            let count = grupowane[klan].length;
            let playersArr = count > 0 ? grupowane[klan] : [];
            let cleanKlanName = klan.trim();

            let isPulse = (klanObj.type === 'enemy' && count >= PULSE_THRESHOLD);
            let countColor = isPulse ? '#fc3e40' : '#eaeaea';
            let pulseClass = isPulse ? ' mrg-pulse-red' : '';

            return `
        <div class="one-other tw-list-item clan-cell${pulseClass}" data-klan="${klan}" data-players='${JSON.stringify(playersArr).replace(/'/g, "&#39;")}'>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; overflow: hidden;">
                <div style="color:${kolorKlanu}; font-weight:600; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; flex: 1; margin-right: 4px;">${cleanKlanName}</div>
                <div style="color:${countColor}; font-size: 11px; font-weight: 700; white-space: nowrap; flex-shrink: 0;">(${count})</div>
            </div>
        </div>
    `;
        };

        let html = `<div class="clan-columns"><div class="clan-column">`;
        html += `<div style="border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 4px; padding-bottom: 2px; font-size: 11px; text-align: center; font-weight: bold;"><span style="color: #aaaaaa; font-weight: 300;">Jeże</span> <span style="color: #4cfa4f;">${sumaFriends}</span></div>`;
        friends.forEach(k => { html += renderCell(k); });
        html += `</div><div class="clan-column">`;
        html += `<div style="border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 4px; padding-bottom: 2px; font-size: 11px; text-align: center; font-weight: bold;"><span style="color: #aaaaaa; font-weight: 300;">Warzywa</span> <span style="color: #fc3e40;">${sumaEnemies}</span></div>`;

        enemies.forEach(k => { html += renderCell(k); });
        html += `</div></div>`;

        html += `<div style="margin-top: 0px; padding-top: 2px; border-top: 1px dashed rgba(255,255,255,0.1); width: 100%;">`;
        html += renderCell(pozostali);
        html += `</div>`;

        kontener.innerHTML = html;

        kontener.querySelectorAll('.clan-cell').forEach(cell => {
            cell.addEventListener('mouseenter', (e) => {
                let players = JSON.parse(cell.getAttribute('data-players'));

                let listHtml = players.length > 0
                    ? players.map(p => `
                        <div class="one-other tw-list-item" style="margin-bottom: 2px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <div style="color: #eaeaea; font-weight: 600; font-size: 11px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px;">${p.n}</div>
                                <div style="color: #eaeaea; font-size: 11px; font-weight: 700; text-align: right; white-space: nowrap; flex-shrink: 0;">(${p.l || ''}${p.p || ''})</div>
                            </div>
                        </div>
                    `).join('')
                    : '<div style="color: #eaeaea; font-style: italic; font-size: 11px; padding: 2px;">Brak graczy online</div>';

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

                let rect = cell.getBoundingClientRect();
                let tipX = rect.left;
                let tipY = rect.bottom + 4;

                if (tipX + 240 > window.innerWidth) tipX = window.innerWidth - 245;
                if (tipY + window.mrgCustomTip.offsetHeight > window.innerHeight) tipY = rect.top - window.mrgCustomTip.offsetHeight - 4;

                window.mrgCustomTip.style.left = tipX + 'px';
                window.mrgCustomTip.style.top = tipY + 'px';
            });

            cell.addEventListener('mouseleave', () => {
                if (window.mrgCustomTip) {
                    window.mrgCustomTip.style.display = 'none';
                }
            });
        });
    }

    pobierzKlanyIZaładuj();
})();
