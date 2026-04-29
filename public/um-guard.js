(function() {
    'use strict';

    const mapActiveModal = ['Katakumby Antycznego Gniewu - przedsionek', 'Przejście Władców Mrozu', 'Sekretne Przejście Kapłanów', 'Bandyckie Chowisko', 'Wulkan Politraki - przedsionek', 'Lokum Złych Goblinów p.4', 'Jaskinia Ulotnych Wspomnień', 'Więzienie Demonów', 'Nora Jaszczurzych Koszmarów p.1 - sala 2', 'Teotihuacan - przedsionek',];
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const STORAGE_KEY = 'umguard_modal_pos';
    const AUTOCLOSE_KEY = 'umguard_autoclose';

    function loadPosition() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    }

    function savePosition(x, y) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
        } catch {}
    }

    function loadAutoClose() {
        try {
            const saved = localStorage.getItem(AUTOCLOSE_KEY);
            // domyślnie włączone (true), jeśli nic nie zapisano
            return saved === null ? true : JSON.parse(saved);
        } catch { return true; }
    }

    function saveAutoClose(value) {
        try {
            localStorage.setItem(AUTOCLOSE_KEY, JSON.stringify(value));
        } catch {}
    }

    function applyPosition(modal, x, y) {
        const maxX = window.innerWidth - modal.offsetWidth;
        const maxY = window.innerHeight - modal.offsetHeight;
        const clampedX = Math.max(0, Math.min(x, maxX));
        const clampedY = Math.max(0, Math.min(y, maxY));
        modal.style.left = clampedX + 'px';
        modal.style.top = clampedY + 'px';
        modal.style.transform = 'none';
    }

    function makeDraggable(modal) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        modal.style.cursor = 'grab';

        modal.addEventListener('mousedown', (e) => {
            if (e.target.id === 'closeGlobalAlert' || e.target.dataset.id || e.target.id === 'umguardAutocloseToggle' || e.target.closest('#umguardAutocloseToggle')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = modal.offsetLeft;
            startTop = modal.offsetTop;
            modal.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const newX = startLeft + (e.clientX - startX);
            const newY = startTop + (e.clientY - startY);
            applyPosition(modal, newX, newY);
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            modal.style.cursor = 'grab';
            savePosition(modal.offsetLeft, modal.offsetTop);
        });
    }

    function init() {
        const skillsList = win.Engine.buildsManager.getBuildsCommons().getBuildsName();

        const mapNameElement = document.querySelector(".location");

        if (!mapNameElement) {
            console.error("Nie znaleziono elementu interfejsu z nazwą mapy.");
            return;
        }

        const observer = new MutationObserver(() => {
            checkShowModal();
        });

        function checkShowModal() {
            const mapName = getMapName();
            if (mapActiveModal.includes(mapName)) return showModal();
        }

        function getMapName() {
            return win.Engine?.map?.d?.name || win.map?.name || "???";
        }

        observer.observe(mapNameElement, {
            characterData: true,
            childList: true,
            subtree: true
        });

        function setSkills(id) {
            return _g(`builds&action=updateCurrent&id=${id}`);
        }

        function showModal() {
            const modalExist = document.querySelector('#alertUmChange');
            if (modalExist) return;

            const modal = document.createElement('div');
            const activeSkill = win.Engine.buildsManager.getBuildsCommons().getCurrentId();
            let autoCloseEnabled = loadAutoClose();

            modal.id = "alertUmChange";
            modal.style.cssText = `
                position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
                background: rgba(20, 20, 20, 0.9); color: white; padding: 16px 25px;
                z-index: 30000; border-radius: 4px; font-family: 'Verdana', sans-serif;
                text-align: center;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px);
                border: 1px solid rgba(255,255,255,0.1); min-width: 320px;
            `;

            const entries = Object.entries(skillsList);
            const rows = [];
            for (let i = 0; i < entries.length; i += 3) {
                rows.push(entries.slice(i, i + 3));
            }

            const buttonsHTML = rows.map(row => `
                <div style="display: flex; gap: 6px; margin: 6px 0;">
                    ${row.map(([id, skill]) => `
                        <div data-id="${id}" style="
                            cursor: pointer; padding: 2px 10px; flex: 1;
                            border-radius: 3px; background: rgba(255,255,255,0.08);
                            font-size: 9px; letter-spacing: 0.5px; white-space: nowrap;
                            overflow: hidden; text-overflow: ellipsis; border: 2px solid;
                            ${id == activeSkill ? "border-color: rgba(231,76,60,0.4);" : "border-color: rgba(255,255,255,0.08)"}
                        " onmouseover="this.style.background='rgba(231,76,60,0.4)'"
                           onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                            ${skill.name}
                        </div>
                    `).join('')}
                </div>
            `).join('');

            modal.innerHTML = `
                <div style="position: absolute; top: 2px; right: 6px; cursor: pointer;
                            font-size: 14px; opacity: 0.5;" id="closeGlobalAlert">×</div>
                <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">
                    <span style="color: #e74c3c;">Jesteś na mapie z Tytanem/Kolosem!</span> Wybierz UM!
                </div>
                ${buttonsHTML}
                <div style="margin-top: 10px; display: flex; align-items: center; gap: 7px; opacity: 0.7;">
                    <label id="umguardAutocloseToggle" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 9px; letter-spacing: 0.5px; user-select: none;">
                        <div id="umguardToggleTrack" style="
                            position: relative; width: 28px; height: 15px; border-radius: 8px;
                            background: ${autoCloseEnabled ? 'rgba(231,76,60,0.7)' : 'rgba(255,255,255,0.15)'};
                            transition: background 0.2s; flex-shrink: 0;
                        ">
                            <div id="umguardToggleThumb" style="
                                position: absolute; top: 2px;
                                left: ${autoCloseEnabled ? '15px' : '2px'};
                                width: 11px; height: 11px; border-radius: 50%;
                                background: white; transition: left 0.2s;
                            "></div>
                        </div>
                        Auto zamykanie (60s)
                    </label>
                </div>
            `;

            document.body.appendChild(modal);

            const savedPos = loadPosition();
            if (savedPos) {
                applyPosition(modal, savedPos.x, savedPos.y);
            }

            makeDraggable(modal);

            let autoCloseTimer = null;

            function startAutoClose() {
                clearTimeout(autoCloseTimer);
                if (autoCloseEnabled) {
                    autoCloseTimer = setTimeout(() => modal.remove(), 60000);
                }
            }

            startAutoClose();

            document.getElementById('umguardAutocloseToggle').addEventListener('click', () => {
                autoCloseEnabled = !autoCloseEnabled;
                saveAutoClose(autoCloseEnabled);

                const track = document.getElementById('umguardToggleTrack');
                const thumb = document.getElementById('umguardToggleThumb');
                track.style.background = autoCloseEnabled ? 'rgba(231,76,60,0.7)' : 'rgba(255,255,255,0.15)';
                thumb.style.left = autoCloseEnabled ? '15px' : '2px';

                if (autoCloseEnabled) {
                    startAutoClose();
                } else {
                    clearTimeout(autoCloseTimer);
                }
            });

            document.getElementById('closeGlobalAlert').onclick = () => {
                clearTimeout(autoCloseTimer);
                modal.remove();
            };

            modal.querySelectorAll('[data-id]').forEach(el => {
                el.onclick = () => {
                    setSkills(el.dataset.id);
                    clearTimeout(autoCloseTimer);
                    modal.remove();
                };
            });
        }

        checkShowModal();
    }

    function isNotEmpty(obj) {
        return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
    }

    const interval = setInterval(() => {
        try {
            if (
                win.Engine &&
                win.Engine.buildsManager &&
                isNotEmpty(win.Engine.buildsManager.getBuildsCommons().getBuildsName())
            ) {
                clearInterval(interval);
                init();
            }
        } catch (e) {}
    }, 200);

})();
