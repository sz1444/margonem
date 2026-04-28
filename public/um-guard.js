(function() {
    'use strict';

    const mapActiveModal = ['Katakumby Antycznego Gniewu - przedsionek', 'Przejście Władców Mrozu', 'Sekretne Przejście Kapłanów', 'Bandyckie Chowisko', 'Wulkan Politraki - przedsionek', 'Lokum Złych Goblinów p.4', 'Jaskinia Ulotnych Wspomnień', 'Więzienie Demonów', 'Nora Jaszczurzych Koszmarów p.1 - sala 2', 'Teotihuacan - przedsionek',];

    function init() {
        const skillsList = window.Engine.buildsManager.getBuildsCommons().getBuildsName();

        const mapNameElement = document.querySelector(".location");

        if (!mapNameElement) {
            console.error("Nie znaleziono elementu interfejsu z nazwą mapy.");
            return;
        }

        const observer = new MutationObserver(() => {
           checkShowModal();
        });

        function checkShowModal()
        {
            const mapName= getMapName();

            if (mapActiveModal.includes(mapName)) return showModal();
        }

         function getMapName() {
             const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
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
            const modal = document.createElement('div');
            const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
            const activeSkill = win.Engine.buildsManager.getBuildsCommons().getCurrentId();
            const modalExist = document.querySelector('#alertUmChange');

         if (modalExist) return;

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
        <div style="font-size: 12px;  font-weight: bold; margin-bottom: 4px; letter-spacing: 0.5px;">
            <span style="color: #e74c3c; ">Jesteś na mapie z Tytanem/Kolosem!</span> Wybierz UM!
        </div>
        ${buttonsHTML}
    `;


            document.body.appendChild(modal);

            const autoCloseTimer = setTimeout(function() { modal.remove(); }, 60000);

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


    // Czeka aż Engine i buildsManager będą gotowe
    const interval = setInterval(() => {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        try {
            if (
                win.Engine &&
                win.Engine.buildsManager &&
                isNotEmpty(win.Engine.buildsManager.getBuildsCommons().getBuildsName())
            ) {
                clearInterval(interval);
                init();
            }
        } catch (e) {
            // jeszcze nie gotowe, czekamy
        }
    }, 200);

})();
