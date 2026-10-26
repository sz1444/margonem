// Elementy UI w stylu okien gry (c-window), współdzielone przez dodatki.

let tipEl = null;

function getTooltip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'c-window border-window transparent';
    tipEl.style.cssText = 'position: fixed; display: none; z-index: 100000; pointer-events: none;';
    tipEl.innerHTML = '<div class="border-image"></div><div class="content" style="position: relative; z-index: 2;"></div>';
    document.body.appendChild(tipEl);
    return tipEl;
}

/** Pokazuje tooltip pod `anchor` (lub nad, jeśli brak miejsca). */
export function showTooltip(anchor, html, { minWidth = 180, maxWidth = 240, padding = '4px' } = {}) {
    const tip = getTooltip();
    const content = tip.querySelector('.content');
    tip.style.minWidth = minWidth + 'px';
    tip.style.maxWidth = maxWidth + 'px';
    content.style.padding = padding;
    content.innerHTML = html;
    tip.style.display = 'block';

    const rect = anchor.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 4;
    if (x + maxWidth > window.innerWidth) x = window.innerWidth - maxWidth - 5;
    if (y + tip.offsetHeight > window.innerHeight) y = rect.top - tip.offsetHeight - 4;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
}

export function hideTooltip() {
    if (tipEl) tipEl.style.display = 'none';
}

/** Lista nicków / wierszy w tooltipie, w stylu listy graczy z gry. */
export function tooltipList(rows, emptyText) {
    if (!rows.length) return `<div style="color: #eaeaea; font-style: italic; font-size: 11px; padding: 2px;">${emptyText}</div>`;
    return rows.map(({ left, right = '' }) => `
        <div class="one-other tw-list-item" style="margin-bottom: 2px;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="color: #eaeaea; font-weight: 600; font-size: 11px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px;">${left}</div>
                ${right ? `<div style="color: #eaeaea; font-size: 11px; font-weight: 700; text-align: right; white-space: nowrap; flex-shrink: 0;">${right}</div>` : ''}
            </div>
        </div>
    `).join('');
}

/** Przycisk przezroczystości okna gry (poziomy 0–5, zapamiętywane). */
export function setupOpacityButton(panel, button, storageKey, defaultLevel = 0) {
    panel.setAttribute('data-opacity-lvl', localStorage.getItem(storageKey) ?? defaultLevel);
    button.addEventListener('click', e => {
        e.stopPropagation();
        const next = ((parseInt(panel.getAttribute('data-opacity-lvl')) || 0) + 1) % 6;
        panel.setAttribute('data-opacity-lvl', next);
        localStorage.setItem(storageKey, next);
    });
}
