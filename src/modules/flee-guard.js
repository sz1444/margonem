import { win } from '../core/env.js';
import { injectStyle } from '../core/dom.js';
import { isPvEBattle } from '../core/game.js';
import { parseStats } from '../core/items.js';
import { loadJSON } from '../core/storage.js';
import { makeDraggable } from '../core/drag.js';
import { showTooltip, hideTooltip } from '../core/ui.js';

const PVP_ONLY_KEY = 'mrg_flee_pvp_only';
const POS_KEY = 'mrg_flee_mini_pos';

function isFleeItem(id) {
    const item = win.Engine?.items?.getItemById?.(id);
    return !!item && parseStats(item).action === 'flee';
}

function isBlockedFlee(query) {
    if (typeof query !== 'string' || !query.includes('moveitem') || !query.includes('st=1')) return false;
    const match = query.match(/id=(\d+)/);
    return !!match && isFleeItem(Number(match[1])) && isPvEBattle();
}

export default {
    id: 'flee-guard',
    name: 'Flee Guard',
    description: 'Blokuje użycie ucieczki w walce PVE',

    run() {
        let pvpOnly = localStorage.getItem(PVP_ONLY_KEY) !== 'false';
        const savedPos = loadJSON(POS_KEY, { top: '80%', left: '20px' });

        injectStyle(`
            #mrgFleeBtn {
                position: fixed;
                z-index: 30000;
                margin: 0;
                pointer-events: auto;
                cursor: pointer;
                user-select: none;
                height: 26px;
                width: 90px;
            }
            #mrgFleeBtn:hover { filter: brightness(1.2); }
        `);

        const btn = document.createElement('div');
        btn.id = 'mrgFleeBtn';
        btn.style.left = savedPos.left;
        btn.style.top = savedPos.top;
        btn.innerHTML = `
            <div class="background"></div>
            <div class="label" style="display:flex; align-items:center; justify-content:center; gap:5px; padding: 0 4px; height: 100%;">
                <img src="https://micc.garmory-cdn.cloud/obrazki/itemy/eve/loteria_uczieczka.gif" style="width:20px; height:20px; object-fit:contain;">
                <span class="mrg-flee-text"></span>
            </div>
        `;
        document.body.appendChild(btn);
        const textEl = btn.querySelector('.mrg-flee-text');

        function updateBtn() {
            btn.className = pvpOnly ? 'button green small' : 'button red small';
            textEl.innerText = pvpOnly ? 'PVP' : 'ALL';
        }
        updateBtn();

        btn.addEventListener('mouseenter', () => {
            const html = pvpOnly
                ? '<b style="color:#8cd9a0;">PVP:</b> Blokuje ucieczkę itemem z potworów (PvE)'
                : '<b style="color:#fc3e40;">ALL:</b> Zezwala na ucieczkę na każdej walce';
            showTooltip(btn, `<div style="font-size: 11px; color: #ddd; white-space: nowrap;">${html}</div>`, { minWidth: 140, padding: '6px' });
        });
        btn.addEventListener('mouseleave', hideTooltip);

        makeDraggable(btn, {
            storageKey: POS_KEY,
            onDragStart: hideTooltip,
            onClick() {
                pvpOnly = !pvpOnly;
                localStorage.setItem(PVP_ONLY_KEY, pvpOnly);
                updateBtn();
            },
        });

        const originalG = win._g;
        if (typeof originalG !== 'function') return;
        win._g = function (query, callback, ...args) {
            if (pvpOnly && isBlockedFlee(query)) {
                win.message?.('Ucieczka z PvE zablokowana');
                return;
            }
            return originalG.apply(this, [query, callback, ...args]);
        };
    },
};
