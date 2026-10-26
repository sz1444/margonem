import { win } from '../core/env.js';
import { injectStyle, waitFor } from '../core/dom.js';
import { parseStats } from '../core/items.js';

const BLUE = '#00a2eb';
const YELLOW = '#ffb703';

const lootFrameCss = (rarity, color) => `
    /* position: absolute naprawia rozciąganie okna */
    .alerts-layer[data-loot-rarity="${rarity}"] .loot-wnd { position: absolute !important; }
    .alerts-layer[data-loot-rarity="${rarity}"] .loot-wnd::after {
        content: ''; position: absolute; top: -34px; left: -20px;
        width: calc(100% + 40px); height: calc(100% + 68px);
        pointer-events: none; z-index: -1; border-radius: 10px;
        border: 1px solid ${color};
        box-shadow: 0 0 calc(var(--ln-size) * 2) var(--ln-size) ${color};
        opacity: calc(var(--ln-opacity) / 100);
    }
    .alerts-layer[data-loot-rarity="${rarity}"] .loot-wnd::before {
        content: ""; position: absolute; top: -34px; left: -20px;
        width: calc(100% + 40px); height: calc(100% + 68px);
        opacity: 0.75; border: 5px solid ${color};
        border-radius: 10px; box-sizing: border-box; z-index: -1;
    }
`;

const itemGlowCss = (cls, color) => `
    .${cls} { position: relative !important; }
    .${cls}::before {
        content: ""; position: absolute; left: 0; top: 0; right: 0; bottom: 0;
        z-index: 99999 !important; transition: all 0.3s ease;
        border: 1px solid ${color};
        box-shadow: 0 0 var(--ln-size) calc(var(--ln-size) / 2) ${color};
        opacity: calc(var(--ln-opacity) / 100);
    }
`;

const CSS = `
    ${lootFrameCss('heroic', BLUE)}
    ${lootFrameCss('unique', YELLOW)}
    ${itemGlowCss('epic-blue-glow', BLUE)}
    ${itemGlowCss('epic-yellow-glow', YELLOW)}
    .game-layer.layer-blue-glow::after { box-shadow: inset 0 0 calc(var(--ln-size) * 2) var(--ln-size) ${BLUE} !important; }
    .game-layer.layer-yellow-glow::after { box-shadow: inset 0 0 calc(var(--ln-size) * 2) var(--ln-size) ${YELLOW} !important; }
`;

const CONFETTI_COLORS = {
    heroic: ['#00a2eb', '#2563eb', '#60a5fa', '#93c5fd', '#fbbf24'],
    legendary: ['#ff3333', '#ff6666', '#cc0000', '#ff0000', '#ffffff'],
    unique: ['#ffb703', '#fb8500', '#ffb703', '#ffea00', '#ffffff'],
};

/** Podmienia obj[key]; oryginał wołany, gdy `cb` zwróci null/undefined. */
function intercept(obj, key, cb) {
    const original = obj[key];
    obj[key] = (...args) => cb(...args) ?? original.apply(obj, args);
}

function onLoot(data) {
    if (!data?.loot?.source || !data.item) return;

    let highestRarity = null;
    let hasLootItems = false;
    const processedItems = [];

    Object.values(data.item).forEach(item => {
        if (!item?.stat || item.loc !== 'l') return;
        hasLootItems = true;
        const rarity = parseStats(item).rarity;
        processedItems.push({ item, rarity });

        if (rarity === 'legendary') highestRarity = 'legendary';
        else if (rarity === 'heroic' && highestRarity !== 'legendary') highestRarity = 'heroic';
        else if (rarity === 'unique' && !highestRarity) highestRarity = 'unique';
    });

    const glowRarity = highestRarity && highestRarity !== 'legendary' ? highestRarity : null;

    const alertsLayer = document.querySelector('.alerts-layer') || document.getElementById('alerts-layer');
    if (alertsLayer && hasLootItems) {
        if (glowRarity) alertsLayer.setAttribute('data-loot-rarity', glowRarity);
        else alertsLayer.removeAttribute('data-loot-rarity');
    }

    const gameLayer = document.getElementById('game-layer') || document.querySelector('.game-layer');
    if (gameLayer && glowRarity) {
        const flashClass = glowRarity === 'heroic' ? 'layer-blue-glow' : 'layer-yellow-glow';
        gameLayer.classList.remove('layer-blue-glow', 'layer-yellow-glow');
        gameLayer.classList.add(flashClass);
        setTimeout(() => gameLayer.classList.remove(flashClass), 5000);
    }

    if (win.confetti && highestRarity) {
        win.confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: CONFETTI_COLORS[highestRarity] });
    }

    setTimeout(() => {
        processedItems.forEach(({ item, rarity }) => {
            const innerItem = document.querySelector(`.loot-window [loot-id="${item.id}"] .item-id-${item.id}`);
            if (!innerItem) return;
            if (rarity === 'heroic') innerItem.classList.add('epic-blue-glow');
            if (rarity === 'unique') innerItem.classList.add('epic-yellow-glow');
        });
    }, 60);
}

export default {
    id: 'more-dopamine',
    name: 'More Dopamine',
    description: 'Podświetlenie okna łupów dla Uni i Hero. Więcej dopaminki!',

    async run() {
        injectStyle(CSS, 'custom-loot-styles');
        await waitFor(() => win.Engine?.communication?.parseJSON, { interval: 100 });
        intercept(win.Engine.communication, 'parseJSON', data => {
            try { onLoot(data); } catch (e) { console.error('[More Dopamine]', e); }
        });
    },
};
