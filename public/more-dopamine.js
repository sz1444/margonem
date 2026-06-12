(function() {
    'use strict';

    const SCRIPT_LABEL = 'More dopamine';
    const STORAGE_KEY = 'hub_loot_heroic_only';
    const styleId = 'custom-loot-styles';
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    function isHeroicOnly() {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    }

    function setHeroicOnly(val) {
        localStorage.setItem(STORAGE_KEY, val);
    }

    function injectStyles() {
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            /* BLUE GLOW (Heroic) */
            .alerts-layer[data-loot-rarity="heroic"] .loot-wnd { position: absolute !important; }
            .alerts-layer[data-loot-rarity="heroic"] .loot-wnd::after {
                content: ''; position: absolute; top: -34px; left: -20px;
                width: calc(100% + 40px); height: calc(100% + 68px);
                pointer-events: none; z-index: -1; border-radius: 10px;
                border: 1px solid #00a2eb;
                box-shadow: 0 0 calc(var(--ln-size) * 2) var(--ln-size) #00a2eb;
                opacity: calc(var(--ln-opacity) / 100);
            }
            .alerts-layer[data-loot-rarity="heroic"] .loot-wnd::before {
                content: ""; position: absolute; top: -34px; left: -20px;
                width: calc(100% + 40px); height: calc(100% + 68px);
                opacity: 0.75; border: 5px solid #00a2eb;
                border-radius: 10px; box-sizing: border-box; z-index: -1;
            }

            /* YELLOW GLOW (Unique) */
            .alerts-layer[data-loot-rarity="unique"] .loot-wnd { position: absolute !important; }
            .alerts-layer[data-loot-rarity="unique"] .loot-wnd::after {
                content: ''; position: absolute; top: -34px; left: -20px;
                width: calc(100% + 40px); height: calc(100% + 68px);
                pointer-events: none; z-index: -1; border-radius: 10px;
                border: 1px solid #ffb703;
                box-shadow: 0 0 calc(var(--ln-size) * 2) var(--ln-size) #ffb703;
                opacity: calc(var(--ln-opacity) / 100);
            }
            .alerts-layer[data-loot-rarity="unique"] .loot-wnd::before {
                content: ""; position: absolute; top: -34px; left: -20px;
                width: calc(100% + 40px); height: calc(100% + 68px);
                opacity: 0.75; border: 5px solid #ffb703;
                border-radius: 10px; box-sizing: border-box; z-index: -1;
            }

            /* ITEMS GLOW */
            .epic-blue-glow { position: relative !important; }
            .epic-blue-glow::before {
                content: ""; position: absolute; left: 0; top: 0; right: 0; bottom: 0;
                z-index: 99999 !important; transition: all 0.3s ease;
                border: 1px solid #00a2eb;
                box-shadow: 0 0 var(--ln-size) calc(var(--ln-size) / 2) #00a2eb;
                opacity: calc(var(--ln-opacity) / 100);
            }
            .epic-yellow-glow { position: relative !important; }
            .epic-yellow-glow::before {
                content: ""; position: absolute; left: 0; top: 0; right: 0; bottom: 0;
                z-index: 99999 !important; transition: all 0.3s ease;
                border: 1px solid #ffb703;
                box-shadow: 0 0 var(--ln-size) calc(var(--ln-size) / 2) #ffb703;
                opacity: calc(var(--ln-opacity) / 100);
            }

            .game-layer.layer-blue-glow::after { box-shadow: inset 0 0 calc(var(--ln-size) * 2) var(--ln-size) #00a2eb !important; }
            .game-layer.layer-yellow-glow::after { box-shadow: inset 0 0 calc(var(--ln-size) * 2) var(--ln-size) #ffb703 !important; }

            /* STYLOWANIE PRZEŁĄCZNIKA (TOGGLE SWITCH) w Popoverze */
            .dopamine-switch {
                position: relative; display: inline-block;
                width: 28px; height: 16px; margin-right: 8px; flex-shrink: 0;
            }
            .dopamine-switch input { opacity: 0; width: 0; height: 0; }
            .dopamine-slider {
                position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
                background-color: #333; transition: .3s; border-radius: 16px;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .dopamine-slider:before {
                position: absolute; content: ""; height: 10px; width: 10px;
                left: 2px; bottom: 2px; background-color: #888;
                transition: .3s; border-radius: 50%;
            }
            .dopamine-switch input:checked + .dopamine-slider { background-color: #2ecc71; border-color: #2ecc71; }
            .dopamine-switch input:checked + .dopamine-slider:before { transform: translateX(12px); background-color: white; }

            /* Efekt hover na włączonym przełączniku */
            .dopamine-switch input:checked + .dopamine-slider:hover { box-shadow: 0 0 8px rgba(0, 162, 235, 0.6); }
        `;
        document.head.appendChild(style);
    }
    injectStyles();

    function intercept(obj, key, cb) {
        const original = obj[key];
        obj[key] = (...args) => cb(...args) ?? original.apply(obj, args);
    }

    const initLoop = setInterval(() => {
        if (window.Engine && window.Engine.communication && window.Engine.communication.parseJSON) {
            clearInterval(initLoop);

            intercept(window.Engine.communication, 'parseJSON', (data) => {
                if (data && data.loot && data.loot.source && data.item) {
                    let highestRarity = null;
                    const processedItems = [];
                    let hasLootItems = false;
                    const heroicOnlyActive = isHeroicOnly();

                    Object.values(data.item).forEach(i => {
                        if (i && i.stat && i.loc === "l") {
                            hasLootItems = true;
                            const stats = Object.fromEntries(
                                i.stat.split(';').map(param => param.split('='))
                            );

                            const rarity = stats.rarity;

                            if (heroicOnlyActive && rarity !== "heroic") return;

                            processedItems.push({ item: i, rarity: rarity });

                            if (rarity === "heroic" && highestRarity !== "legendary") {
                                highestRarity = "heroic";
                            } else if (rarity === "unique" && !highestRarity) {
                                highestRarity = "unique";
                            } else if (rarity === "legendary") {
                                highestRarity = "legendary";
                            }
                        }
                    });

                    if (!hasLootItems || (!highestRarity && heroicOnlyActive)) return;

                    // 1. Alerty ramki
                    const alertsLayer = document.querySelector('.alerts-layer') || document.getElementById('alerts-layer');
                    if (alertsLayer) {
                        if (highestRarity && highestRarity !== "legendary") {
                            alertsLayer.setAttribute('data-loot-rarity', highestRarity);
                        } else {
                            alertsLayer.removeAttribute('data-loot-rarity');
                        }
                    }

                    const gameLayer = document.getElementById('game-layer') || document.querySelector('.game-layer');
                    if (gameLayer && highestRarity && highestRarity !== "legendary") {
                        const flashClass = highestRarity === 'heroic' ? 'layer-blue-glow' : 'layer-yellow-glow';
                        gameLayer.classList.remove('layer-blue-glow', 'layer-yellow-glow');
                        gameLayer.classList.add(flashClass);
                        setTimeout(() => { gameLayer.classList.remove(flashClass); }, 5000);
                    }

                    if (window.confetti && highestRarity) {
                        const colors = highestRarity === "heroic"
                            ? ['#00a2eb', '#2563eb', '#60a5fa', '#93c5fd', '#fbbf24']
                            : (highestRarity === "legendary"
                                ? ['#ff3333', '#ff6666', '#cc0000', '#ff0000', '#ffffff']
                                : ['#ffb703', '#fb8500', '#ffb703', '#ffea00', '#ffffff']);
                        window.confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: colors });
                    }

                    setTimeout(() => {
                        processedItems.forEach(({ item, rarity }) => {
                            const lootContainer = document.querySelector(`.loot-window [loot-id="${item.id}"]`);
                            if (!lootContainer) return;

                            const innerItem = lootContainer.querySelector(`.item-id-${item.id}`);
                            if (innerItem) {
                                if (rarity === "heroic") innerItem.classList.add('epic-blue-glow');
                                if (rarity === "unique") innerItem.classList.add('epic-yellow-glow');
                            }
                        });
                    }, 60);
                }
            });
        }
    }, 100);

    function injectGear() {
        const rows = document.querySelectorAll('#hubMenu .hub-row');
        let targetRow = null;
        for (const row of rows) {
            const label = row.querySelector('.hub-label');
            if (label && label.textContent.trim().toUpperCase().includes(SCRIPT_LABEL.toUpperCase())) {
                targetRow = row;
                break;
            }
        }
        if (!targetRow) return false;
        if (targetRow.querySelector('.fbg-gear-btn')) return true;

        const label = targetRow.querySelector('.hub-label');
        if (!label) return true;

        const gearBtn = document.createElement('button');
        gearBtn.className = 'fbg-gear-btn';
        gearBtn.title = 'Ustawienia lootu';
        gearBtn.style.cssText = 'width:12px;height:12px;background:none;border:none;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;opacity:0.35;transition:opacity 0.2s;vertical-align:middle;margin-left:4px;';
        gearBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

        gearBtn.addEventListener('mouseenter', () => gearBtn.style.opacity = '1');
        gearBtn.addEventListener('mouseleave', () => { if (!popoverOpen) gearBtn.style.opacity = '0.35'; });

        const hubDesc = label.querySelector('.hub-desc');
        label.insertBefore(gearBtn, hubDesc || null);

        let popoverEl = null;
        let popoverOpen = false;

        function closePopover() {
            if (popoverEl) { popoverEl.remove(); popoverEl = null; }
            popoverOpen = false;
            gearBtn.style.opacity = '0.35';
            document.removeEventListener('mousedown', outsideClick);
        }

        function outsideClick(e) {
            if (popoverEl && !popoverEl.contains(e.target) && e.target !== gearBtn) {
                closePopover();
            }
        }

        function buildPopover() {
            const p = document.createElement('div');
            p.style.cssText = 'position:fixed; z-index:31000; background:rgba(10,10,10,0.98); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:10px 12px; min-width:180px; box-shadow:0 8px 30px rgba(0,0,0,0.9); font-family:Verdana,sans-serif;';

            const lbl = document.createElement('p');
            lbl.textContent = 'Konfiguracja efektów';
            lbl.style.cssText = 'color:#888;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px;';

            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#eee;font-size:11px;user-select:none;margin:4px 0;';

            const textSpan = document.createElement('span');
            textSpan.textContent = 'Tylko przy hero';
            textSpan.title = 'Włącz, aby pokazywać efekty tylko dla przedmiotów Heroic';

            const switchLabel = document.createElement('label');
            switchLabel.className = 'dopamine-switch';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = isHeroicOnly();

            const slider = document.createElement('span');
            slider.className = 'dopamine-slider';

            chk.addEventListener('change', () => {
                setHeroicOnly(chk.checked);
            });

            switchLabel.appendChild(chk);
            switchLabel.appendChild(slider);

            row.appendChild(textSpan);
            row.appendChild(switchLabel);

            p.appendChild(lbl);
            p.appendChild(row);

            document.body.appendChild(p);
            const gr = gearBtn.getBoundingClientRect();
            const pw = p.offsetWidth;
            const ph = p.offsetHeight;
            let top = gr.bottom + 6;
            let left = gr.left - pw + gr.width;
            if (top + ph > win.innerHeight - 10) top = gr.top - ph - 6;
            if (left < 6) left = 6;
            p.style.top = top + 'px';
            p.style.left = left + 'px';

            return p;
        }

        gearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popoverOpen) {
                closePopover();
                return;
            }
            popoverOpen = true;
            gearBtn.style.opacity = '1';
            popoverEl = buildPopover();
            setTimeout(() => document.addEventListener('mousedown', outsideClick), 0);
        });

        return true;
    }

    function tryInject(attempts) {
        if (injectGear()) return;
        if (attempts > 0) setTimeout(() => tryInject(attempts - 1), 300);
    }

    setTimeout(() => tryInject(20), 500);

    const hubMenu = document.getElementById('hubMenu');
    if (hubMenu) {
        const obs = new MutationObserver(() => tryInject(5));
        obs.observe(hubMenu, { childList: true, subtree: true });
    } else {
        const bodyObs = new MutationObserver(() => {
            const m = document.getElementById('hubMenu');
            if (m) {
                bodyObs.disconnect();
                const obs = new MutationObserver(() => tryInject(5));
                obs.observe(m, { childList: true, subtree: true });
                tryInject(10);
            }
        });
        bodyObs.observe(document.body, { childList: true, subtree: true });
    }
})();
