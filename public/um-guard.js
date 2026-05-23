(function() {
    'use strict';

    const mapActiveModal = ['Katakumby Antycznego Gniewu - przedsionek', 'Przejście Władców Mrozu', 'Sekretne Przejście Kapłanów', 'Bandyckie Chowisko', 'Wulkan Politraki - przedsionek', 'Lokum Złych Goblinów p.4', 'Jaskinia Ulotnych Wspomnień', 'Więzienie Demonów', 'Nora Jaszczurzych Koszmarów p.1 - sala 2', 'Teotihuacan - przedsionek',];
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const STORAGE_KEY = 'umguard_modal_pos';
    const AUTOCLOSE_KEY = 'umguard_autoclose';

    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    }

    function saveState(x, y, w, h) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y, w, h }));
        } catch {}
    }

    function loadAutoClose() {
        try {
            const saved = localStorage.getItem(AUTOCLOSE_KEY);
            return saved === null ? true : JSON.parse(saved);
        } catch { return true; }
    }

    function saveAutoClose(value) {
        try {
            localStorage.setItem(AUTOCLOSE_KEY, JSON.stringify(value));
        } catch {}
    }

    function applyDimensions(modal, x, y, w, h) {
        const maxX = window.innerWidth - (w || modal.offsetWidth);
        const maxY = window.innerHeight - (h || modal.offsetHeight);
        const clampedX = Math.max(0, Math.min(x, maxX));
        const clampedY = Math.max(0, Math.min(y, maxY));
        
        modal.style.left = clampedX + 'px';
        modal.style.top = clampedY + 'px';
        if (w) modal.style.width = w + 'px';
        if (h) modal.style.height = h + 'px';
        modal.style.transform = 'none';
    }

    function makeDraggableAndResizable(modal) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        modal.style.cursor = 'grab';

        modal.addEventListener('mousedown', (e) => {
            if (e.target.closest('#umguardScrollContainer') || e.target.id === 'closeGlobalAlert' || e.target.id === 'umguardAutocloseToggle' || e.target.closest('#umguardAutocloseToggle') || e.target.id === 'umguardResizeHandle') return;
            
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
            applyDimensions(modal, newX, newY, parseInt(modal.style.width), parseInt(modal.style.height));
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            modal.style.cursor = 'grab';
            saveState(modal.offsetLeft, modal.offsetTop, parseInt(modal.style.width), parseInt(modal.style.height));
        });

        const resizeHandle = modal.querySelector('#umguardResizeHandle');
        let isResizing = false;
        let startW, startH;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = modal.offsetWidth;
            startH = modal.offsetHeight;
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newW = Math.max(120, startW + (e.clientX - startX));
            const newH = Math.max(80, startH + (e.clientY - startY));
            modal.style.width = newW + 'px';
            modal.style.height = newH + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!isResizing) return;
            isResizing = false;
            saveState(modal.offsetLeft, modal.offsetTop, parseInt(modal.style.width), parseInt(modal.style.height));
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

        if (!document.getElementById('umguard-scrollbar-styles')) {
            const style = document.createElement('style');
            style.id = 'umguard-scrollbar-styles';
            style.innerHTML = `
                #umguardScrollContainer::-webkit-scrollbar {
                    width: 4px;
                }
                #umguardScrollContainer::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 2px;
                }
                #umguardScrollContainer::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 2px;
                }
                #umguardScrollContainer::-webkit-scrollbar-thumb:hover {
                    background: rgba(231, 76, 60, 0.6);
                }
            `;
            document.head.appendChild(style);
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
                background: rgba(20, 20, 20, 0.95); color: white; padding: 12px 14px;
                z-index: 30000; border-radius: 4px; font-family: 'Verdana', sans-serif;
                text-align: center; box-sizing: border-box;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px);
                border: 1px solid rgba(255,255,255,0.1); width: 320px;
                display: flex; flex-direction: column; overflow: hidden;
            `;

            const entries = Object.entries(skillsList);
            const buttonsHTML = entries.map(([id, skill]) => `
                <div data-id="${id}" style="
                    cursor: pointer; padding: 4px 4px; flex: 1; min-width: 70px;
                    border-radius: 3px; background: rgba(255,255,255,0.08);
                    font-size: 9px; letter-spacing: 0.5px; white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis; border: 2px solid;
                    box-sizing: border-box;
                    ${id == activeSkill ? "border-color: rgba(231,76,60,0.4);" : "border-color: rgba(255,255,255,0.08)"}
                " onmouseover="this.style.background='rgba(231,76,60,0.4)'"
                   onmouseout="this.style.background='rgba(255,255,255,0.08)'" title="${skill.name}">
                    ${skill.name}
                </div>
            `).join('');

            modal.innerHTML = `
                <div style="position: absolute; top: 2px; right: 6px; cursor: pointer;
                            font-size: 14px; opacity: 0.5; z-index: 2;" id="closeGlobalAlert">×</div>
                <div style="font-size: 10px; font-weight: bold; margin-bottom: 6px; letter-spacing: 0.5px; flex-shrink: 0; padding-right: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <span style="color: #e74c3c;">Wybierz UM!</span>
                </div>
                <div id="umguardScrollContainer" style="flex: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start;">
                    ${buttonsHTML}
                </div>
                <div style="margin-top: auto; padding-top: 6px; display: flex; align-items: center; gap: 7px; opacity: 0.7; flex-shrink: 0; overflow: hidden;">
                    <label id="umguardAutocloseToggle" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 8px; letter-spacing: 0.5px; user-select: none; white-space: nowrap;">
                        <div id="umguardToggleTrack" style="
                            position: relative; width: 22px; height: 12px; border-radius: 6px;
                            background: ${autoCloseEnabled ? 'rgba(231,76,60,0.7)' : 'rgba(255,255,255,0.15)'};
                            transition: background 0.2s; flex-shrink: 0;
                        ">
                            <div id="umguardToggleThumb" style="
                                position: absolute; top: 1px;
                                left: ${autoCloseEnabled ? '11px' : '1px'};
                                width: 10px; height: 10px; border-radius: 50%;
                                background: white; transition: left 0.2s;
                            "></div>
                        </div>
                        Auto (60s)
                    </label>
                </div>
                <div id="umguardResizeHandle" style="
                    position: absolute; bottom: 0; right: 0; width: 12px; height: 12px;
                    cursor: nwse-resize; background: linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 30%); z-index: 2;
                "></div>
            `;

            document.body.appendChild(modal);

            const savedState = loadState();
            if (savedState) {
                applyDimensions(modal, savedState.x, savedState.y, savedState.w, savedState.h);
            }

            makeDraggableAndResizable(modal);

            const scrollContainer = document.getElementById('umguardScrollContainer');
            const handleGlobalWheel = (e) => {
                if (!document.getElementById('alertUmChange')) {
                    window.removeEventListener('wheel', handleGlobalWheel, { capture: true });
                    return;
                }
                
                // Jeśli kursor znajduje się nad kontenerem ze scrollem, przewijaj ręcznie
                if (e.target === scrollContainer || scrollContainer.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    scrollContainer.scrollTop += e.deltaY;
                }
            };
            window.addEventListener('wheel', handleGlobalWheel, { capture: true, passive: false });

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
                thumb.style.left = autoCloseEnabled ? '11px' : '1px';

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
