import { disbandParty } from '../core/game.js';
import { isTypingTarget } from '../core/dom.js';
import { loadJSON, saveJSON } from '../core/storage.js';
import { keyLabel, matchesBinding, captureNextKey, MODIFIER_KEYS } from '../core/keyboard.js';

const STORAGE_KEY = 'hub_keybind_fast_brake_group';

const GEAR_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</svg>`;

const getBinding = () => loadJSON(STORAGE_KEY);

function createKeybindPopover(anchor) {
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
    p.innerHTML = `
        <p style="color:#888;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Skrót klawiszowy</p>
        <div class="fbg-display" style="font-family:monospace;font-size:11px;color:#eee;background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:4px 8px;text-align:center;margin-bottom:8px;"></div>
        <button class="fbg-record" style="width:100%;padding:5px;font-size:9px;font-family:Verdana,sans-serif;font-weight:bold;background:#222;color:#eee;border:1px solid #444;border-radius:4px;cursor:pointer;text-align:center;">Przypisz klawisz</button>
        <button class="fbg-clear" style="width:100%;margin-top:4px;padding:4px;font-size:9px;font-family:Verdana,sans-serif;background:none;color:#666;border:none;cursor:pointer;text-align:center;">✕ wyczyść</button>
    `;
    document.body.appendChild(p);

    const disp = p.querySelector('.fbg-display');
    const recBtn = p.querySelector('.fbg-record');
    const clrBtn = p.querySelector('.fbg-clear');
    disp.textContent = keyLabel(getBinding());

    const ar = anchor.getBoundingClientRect();
    let top = ar.bottom + 6;
    let left = ar.left - p.offsetWidth + ar.width;
    if (top + p.offsetHeight > window.innerHeight - 10) top = ar.top - p.offsetHeight - 6;
    if (left < 6) left = 6;
    p.style.top = top + 'px';
    p.style.left = left + 'px';

    let cancelRecording = null;

    function stopRecording() {
        cancelRecording?.();
        cancelRecording = null;
        recBtn.textContent = 'Nagraj klawisz';
        Object.assign(recBtn.style, { background: '#222', borderColor: '#444', color: '#eee' });
    }

    function startRecording() {
        recBtn.textContent = 'Naciśnij klawisz…';
        Object.assign(recBtn.style, { background: '#c0392b', borderColor: '#e74c3c', color: 'white' });
        cancelRecording = captureNextKey(e => {
            const binding = { key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
            saveJSON(STORAGE_KEY, binding);
            disp.textContent = keyLabel(binding);
            cancelRecording = null;
            stopRecording();
        });
    }

    recBtn.addEventListener('click', () => cancelRecording ? stopRecording() : startRecording());
    clrBtn.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        disp.textContent = 'brak';
        stopRecording();
    });

    return {
        el: p,
        close() {
            stopRecording();
            p.remove();
        },
    };
}

export default {
    id: 'fast-break-group',
    name: 'Fast Break Group',
    description: 'Rozwiązuje grupę jednym klawiszem.',

    run() {
        document.addEventListener('keydown', e => {
            if (isTypingTarget(document.activeElement)) return;
            if (MODIFIER_KEYS.includes(e.key)) return;
            if (!matchesBinding(e, getBinding())) return;
            e.preventDefault();
            disbandParty();
        });
    },

    /** Zębatka przy nazwie dodatku w panelu — przypisanie klawisza. */
    settings(labelEl) {
        const gearBtn = document.createElement('button');
        gearBtn.title = 'Ustaw klawisz';
        gearBtn.style.cssText = 'width:12px;height:12px;background:none;border:none;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;opacity:0.35;transition:opacity 0.2s;vertical-align:middle;margin-left:4px;';
        gearBtn.innerHTML = GEAR_SVG;
        labelEl.insertBefore(gearBtn, labelEl.querySelector('.hub-desc'));

        let popover = null;

        function close() {
            popover?.close();
            popover = null;
            gearBtn.style.opacity = '0.35';
            document.removeEventListener('mousedown', outsideClick);
        }

        function outsideClick(e) {
            if (popover && !popover.el.contains(e.target) && !gearBtn.contains(e.target)) close();
        }

        gearBtn.addEventListener('mouseenter', () => gearBtn.style.opacity = '1');
        gearBtn.addEventListener('mouseleave', () => { if (!popover) gearBtn.style.opacity = '0.35'; });
        gearBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (popover) return close();
            gearBtn.style.opacity = '1';
            popover = createKeybindPopover(gearBtn);
            setTimeout(() => document.addEventListener('mousedown', outsideClick), 0);
        });
    },
};
