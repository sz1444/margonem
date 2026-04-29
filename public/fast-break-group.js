(function () {
    'use strict';

    const SCRIPT_LABEL = 'Fast Break Group';
    const STORAGE_KEY  = 'hub_keybind_fast_brake_group';

    function getBinding() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
        catch { return null; }
    }

    function setBinding(b) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    }

    function keyLabel(b) {
        if (!b) return 'brak';
        const parts = [];
        if (b.ctrl)  parts.push('Ctrl');
        if (b.alt)   parts.push('Alt');
        if (b.shift) parts.push('Shift');
        parts.push(b.key === ' ' ? 'Space' : b.key);
        return parts.join('+');
    }

    function matchesBinding(e, b) {
        if (!b) return false;
        return e.key === b.key &&
               !!e.ctrlKey  === !!b.ctrl &&
               !!e.altKey   === !!b.alt  &&
               !!e.shiftKey === !!b.shift;
    }

    function disbandParty() {
        if (typeof window._g === 'function') {
            window._g('party&a=disband');
        }
    }

    document.addEventListener('keydown', function (e) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return;
        const b = getBinding();
        if (!b) return;
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
        if (matchesBinding(e, b)) {
            e.preventDefault();
            disbandParty();
        }
    });


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
        gearBtn.title = 'Ustaw klawisz';
        gearBtn.style.cssText = 'width:12px;height:12px;background:none;border:none;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;opacity:0.35;transition:opacity 0.2s;vertical-align:middle;margin-left:4px;';
        gearBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>`;

        gearBtn.addEventListener('mouseenter', () => gearBtn.style.opacity = '1');
        gearBtn.addEventListener('mouseleave', () => { if (!popoverOpen) gearBtn.style.opacity = '0.35'; });

        const hubDesc = label.querySelector('.hub-desc');
        label.insertBefore(gearBtn, hubDesc || null);


        let popoverEl = null;
        let popoverOpen = false;
        let isRecording = false;
        let recordCleanup = null;

        function closePopover() {
            if (popoverEl) { popoverEl.remove(); popoverEl = null; }
            if (recordCleanup) { recordCleanup(); recordCleanup = null; }
            popoverOpen = false;
            isRecording = false;
            gearBtn.style.opacity = '0.4';
            document.removeEventListener('mousedown', outsideClick);
        }

        function outsideClick(e) {
            if (popoverEl && !popoverEl.contains(e.target) && e.target !== gearBtn) {
                closePopover();
            }
        }

        function buildPopover() {
            const p = document.createElement('div');
            p.style.cssText = `
                position:fixed; z-index:31000;
                background:rgba(10,10,10,0.98);
                border:1px solid rgba(255,255,255,0.15);
                border-radius:8px; padding:10px 12px;
                min-width:160px;
                box-shadow:0 8px 30px rgba(0,0,0,0.9);
                font-family:Verdana,sans-serif;
            `;

            const lbl = document.createElement('p');
            lbl.textContent = 'Skrót klawiszowy';
            lbl.style.cssText = 'color:#888;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;';

            const disp = document.createElement('div');
            disp.style.cssText = 'font-family:monospace;font-size:11px;color:#eee;background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:4px 8px;text-align:center;margin-bottom:8px;';
            disp.textContent = keyLabel(getBinding());

            const recBtn = document.createElement('button');
            recBtn.style.cssText = 'width:100%;padding:5px;font-size:9px;font-family:Verdana,sans-serif;font-weight:bold;background:#222;color:#eee;border:1px solid #444;border-radius:4px;cursor:pointer;text-align:center;';
            recBtn.textContent = 'Nagraj klawisz';

            const clrBtn = document.createElement('button');
            clrBtn.style.cssText = 'width:100%;margin-top:4px;padding:4px;font-size:9px;font-family:Verdana,sans-serif;background:none;color:#666;border:none;cursor:pointer;text-align:center;';
            clrBtn.textContent = '✕ wyczyść';

            p.appendChild(lbl);
            p.appendChild(disp);
            p.appendChild(recBtn);
            p.appendChild(clrBtn);

            document.body.appendChild(p);
            const gr = gearBtn.getBoundingClientRect();
            const pw = p.offsetWidth;
            const ph = p.offsetHeight;
            let top = gr.bottom + 6;
            let left = gr.left - pw + gr.width;
            if (top + ph > window.innerHeight - 10) top = gr.top - ph - 6;
            if (left < 6) left = 6;
            p.style.top  = top  + 'px';
            p.style.left = left + 'px';

            function startRecording() {
                isRecording = true;
                recBtn.textContent = 'Naciśnij klawisz…';
                recBtn.style.background = '#c0392b';
                recBtn.style.borderColor = '#e74c3c';
                recBtn.style.color = 'white';

                function onKey(e) {
                    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const b = { key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
                    setBinding(b);
                    disp.textContent = keyLabel(b);
                    stopRecording();
                }

                recordCleanup = () => document.removeEventListener('keydown', onKey, true);
                document.addEventListener('keydown', onKey, true);
            }

            function stopRecording() {
                isRecording = false;
                recBtn.textContent = 'Nagraj klawisz';
                recBtn.style.background = '#222';
                recBtn.style.borderColor = '#444';
                recBtn.style.color = '#eee';
                if (recordCleanup) { recordCleanup(); recordCleanup = null; }
            }

            recBtn.addEventListener('click', () => {
                if (isRecording) stopRecording();
                else startRecording();
            });

            clrBtn.addEventListener('click', () => {
                localStorage.removeItem(STORAGE_KEY);
                disp.textContent = 'brak';
                stopRecording();
            });

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
