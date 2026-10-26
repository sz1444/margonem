import { injectStyle } from '../core/dom.js';
import { loadJSON } from '../core/storage.js';
import { makeDraggable } from '../core/drag.js';

const DEFAULT_OPTIONS = { id: 'hub', title: 'DODATKI GROLI', posKey: 'hubPos', storagePrefix: 'hub_' };

const css = id => `
    #${id}Main { position: fixed; z-index: 30000; font-family: 'Verdana', sans-serif; user-select: none; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
    #${id}Icon { width: 32px; height: 32px; background: rgba(10, 10, 10, 0.8); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: move; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: transform 0.2s; }
    #${id}Icon:hover { transform: scale(1.05); border-color: rgba(255,255,255,0.3); }
    #${id}Menu { display: none; background: rgba(10, 10, 10, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); max-width: 360px; border-radius: 10px; padding: 12px; min-width: 180px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); }
    .hub-title { color: #666; font-size: 9px; margin-bottom: 12px; font-weight: bold; border-bottom: 1px solid #222; padding-bottom: 6px; letter-spacing: 1px; }
    .hub-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 15px; border-bottom: 1px solid #222222; }
    .hub-desc { padding-bottom: 5px; width: 100%; font-size: 8px; font-weight: 300; line-height: 1.2; text-transform: none; color: #adadad; margin-top: 2px; }
    .hub-label { display: flex; flex-wrap: wrap; gap: 2px; align-items: center; color: #eee; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; }
    .hub-toggle { min-width: 30px; height: 16px; background: #333; border-radius: 10px; position: relative; cursor: pointer; transition: background 0.3s; border: 1px solid rgba(255,255,255,0.05); }
    .hub-toggle.active { background: #2ecc71; box-shadow: 0 0 8px rgba(46, 204, 113, 0.4); }
    .hub-circle { width: 12px; height: 12px; background: white; border-radius: 50%; position: absolute; top: 1.5px; left: 2px; transition: all 0.2s; }
    .hub-toggle.active .hub-circle { left: 18px; }
    #${id}Menu .hub-save-btn {
        display: none; width: 100%; margin-top: 10px; padding: 8px;
        background: #2ecc71; color: white; border: none; border-radius: 4px;
        font-size: 10px; font-weight: bold; cursor: pointer;
        text-align: center; transition: background 0.2s;
    }
    #${id}Menu .hub-save-btn:hover { background: #27ae60; }
`;

const ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;

const storageKey = (module, prefix = DEFAULT_OPTIONS.storagePrefix) => prefix + module.id;

export const isEnabled = (module, prefix) => localStorage.getItem(storageKey(module, prefix)) === 'true';

function createRow(module, prefix, onToggle) {
    const row = document.createElement('div');
    row.className = 'hub-row';
    row.innerHTML = `
        <span class="hub-label">
            ${module.name}
            <p class="hub-desc">${module.description}</p>
        </span>
        <div class="hub-toggle ${isEnabled(module, prefix) ? 'active' : ''}"><div class="hub-circle"></div></div>
    `;

    const toggle = row.querySelector('.hub-toggle');
    toggle.onclick = () => {
        const nowActive = toggle.classList.toggle('active');
        localStorage.setItem(storageKey(module, prefix), nowActive);
        onToggle();
    };

    if (isEnabled(module, prefix) && module.settings) module.settings(row.querySelector('.hub-label'));
    return row;
}

/**
 * Ramka panelu: przeciągalna ikona + rozwijane menu z tytułem. Zwraca { hub, menu }.
 * options: id (prefiks id elementów), title, posKey — osobne dla każdego hubu, żeby się nie gryzły.
 */
export function createHubFrame(options = {}) {
    const { id, title, posKey } = { ...DEFAULT_OPTIONS, ...options };
    injectStyle(css(id));

    const savedPos = loadJSON(posKey, { top: '80%', left: '20px' });

    const hub = document.createElement('div');
    hub.id = `${id}Main`;
    hub.style.top = savedPos.top;
    hub.style.left = savedPos.left;
    hub.innerHTML = `<div id="${id}Icon">${ICON_SVG}</div><div id="${id}Menu"><div class="hub-title">${title}</div></div>`;
    document.body.appendChild(hub);

    const icon = hub.querySelector(`#${id}Icon`);
    const menu = hub.querySelector(`#${id}Menu`);

    makeDraggable(hub, {
        handle: icon,
        storageKey: posKey,
        threshold: 7,
        onDragStart: () => icon.style.opacity = '0.7',
        onDragEnd: () => icon.style.opacity = '1',
        onClick: () => menu.style.display = menu.style.display === 'block' ? 'none' : 'block',
    });

    return { hub, menu };
}

/** Wiersze z przełącznikami dodatków + przycisk odświeżenia. Zmiany wymagają odświeżenia strony. */
export function renderModuleRows(container, modules, storagePrefix = DEFAULT_OPTIONS.storagePrefix) {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'hub-save-btn';
    saveBtn.innerText = 'ODŚWIEŻ';
    saveBtn.onclick = () => location.reload();

    modules.forEach(module => container.appendChild(createRow(module, storagePrefix, () => saveBtn.style.display = 'block')));
    container.appendChild(saveBtn);
}

export function renderHub(modules, options = {}) {
    const { menu } = createHubFrame(options);
    renderModuleRows(menu, modules, options.storagePrefix);
}
