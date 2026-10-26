import { clamp } from './dom.js';
import { saveJSON } from './storage.js';

/**
 * Przeciąganie elementu za `handle` (mysz + dotyk), z ograniczeniem do okna.
 *
 * - storageKey: zapisuje { top, left } po upuszczeniu
 * - threshold:  ile px trzeba przesunąć, żeby uznać to za drag, a nie klik
 * - ignore:     selektor elementów wewnątrz handle, które nie zaczynają dragu
 * - onClick:    wywoływane, gdy wciśnięto i puszczono bez przeciągania
 * - onDragEnd:  wywoływane po przeciągnięciu
 */
export function makeDraggable(target, {
    handle = target,
    storageKey,
    threshold = 3,
    ignore,
    onClick,
    onDragStart,
    onDragEnd,
} = {}) {
    handle.style.touchAction = 'none';

    handle.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        if (ignore && e.target.closest(ignore)) return;
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const offsetX = startX - target.offsetLeft;
        const offsetY = startY - target.offsetTop;
        let dragged = false;

        const onMove = ev => {
            if (!dragged) {
                if (Math.abs(ev.clientX - startX) <= threshold && Math.abs(ev.clientY - startY) <= threshold) return;
                dragged = true;
                onDragStart?.();
            }
            ev.preventDefault();
            target.style.left = clamp(ev.clientX - offsetX, 0, window.innerWidth - target.offsetWidth) + 'px';
            target.style.top = clamp(ev.clientY - offsetY, 0, window.innerHeight - target.offsetHeight) + 'px';
            target.style.right = 'auto';
            target.style.bottom = 'auto';
        };

        const onUp = ev => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);

            if (!dragged) return onClick?.(ev);
            if (storageKey) saveJSON(storageKey, { top: target.style.top, left: target.style.left });
            onDragEnd?.();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    });
}

/**
 * Zmiana rozmiaru elementu za uchwyt (np. prawy dolny róg).
 * lockHeight: () => true, gdy wysokość ma zostać (np. zwinięte okno).
 */
export function makeResizable(target, handle, {
    minWidth = 0,
    minHeight = 0,
    lockHeight,
    onEnd,
} = {}) {
    handle.style.touchAction = 'none';

    handle.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startW = target.offsetWidth;
        const startH = target.offsetHeight;

        const onMove = ev => {
            target.style.width = Math.max(minWidth, startW + ev.clientX - startX) + 'px';
            if (!lockHeight?.()) target.style.height = Math.max(minHeight, startH + ev.clientY - startY) + 'px';
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            onEnd?.({ width: target.style.width, height: target.style.height });
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    });
}
