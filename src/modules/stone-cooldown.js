import { getInventoryItems, getItemElement } from '../core/game.js';
import { parseStats, getTimelimit, getCooldownProgress } from '../core/items.js';

const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.6)';
const SYNC_INTERVAL = 3000;
const SVG_NS = 'http://www.w3.org/2000/svg';

function createOverlay() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('tp-cd-overlay');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    Object.assign(svg.style, {
        position: 'absolute',
        top: '0', left: '0',
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: '8',
        display: 'none',
    });

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', OVERLAY_COLOR);
    svg.appendChild(path);
    return svg;
}

/**
 * Wycinek koła pokrywający `progress` kafelka, od godziny 12 zgodnie ze wskazówkami zegara.
 * Promień większy niż pół przekątnej, żeby zakryć rogi.
 */
function buildSectorPath(progress) {
    const cx = 50, cy = 50, r = 80;
    if (progress >= 1) return 'M0,0 H100 V100 H0 Z';

    const angle = progress * 2 * Math.PI;
    const start = -Math.PI / 2;
    const end = start + angle;

    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = angle > Math.PI ? 1 : 0;

    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
}

function updateOverlay(stone, progress) {
    if (progress <= 0) {
        stone.svg.style.display = 'none';
        return;
    }
    stone.svg.style.display = '';
    stone.path.setAttribute('d', buildSectorPath(progress));
}

export default {
    id: 'stone-cooldown',
    name: 'Stone Cooldown',
    description: 'Nakładka cooldownu na kamieniach teleportu.',

    run() {
        let activeStones = [];

        function syncInventory() {
            try {
                activeStones = getInventoryItems().flatMap(item => {
                    const stats = parseStats(item);
                    if (!(stats.teleport || stats.custom_teleport)) return [];
                    if (!getTimelimit(item)) return [];

                    const el = getItemElement(item);
                    if (!el) return [];
                    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

                    let svg = el.querySelector('.tp-cd-overlay');
                    if (!svg) {
                        svg = createOverlay();
                        el.appendChild(svg);
                    }
                    return [{ svg, path: svg.querySelector('path'), item }];
                });
            } catch (e) {
                console.error('[Stone Cooldown] syncInventory:', e);
            }
        }

        function tick() {
            activeStones.forEach(stone => {
                if (document.body.contains(stone.svg)) updateOverlay(stone, getCooldownProgress(stone.item));
            });
            requestAnimationFrame(tick);
        }

        setTimeout(syncInventory, 1000);
        setInterval(syncInventory, SYNC_INTERVAL);
        requestAnimationFrame(tick);
    },
};
