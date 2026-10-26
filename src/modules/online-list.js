import { gmRequest } from '../core/env.js';
import { injectStyle } from '../core/dom.js';
import { loadJSON, saveJSON, loadFlag, saveFlag } from '../core/storage.js';
import { formatClock } from '../core/format.js';
import { makeDraggable } from '../core/drag.js';
import { setupOpacityButton, showTooltip, hideTooltip, tooltipList } from '../core/ui.js';

const WORLD = 'Nubes';
const ONLINE_URL = `https://staticinfo.margonem.pl/online/${WORLD.toLowerCase()}.json`;
const PULSE_THRESHOLD = 10;
const CLAN_CACHE_TTL = 4 * 60 * 60 * 1000;
const CLAN_FETCH_DELAY = 700;
const PANEL_HEIGHT = '360px';

const CACHE_KEY = `mrg_clan_cache_${WORLD}`;
const CACHE_TIME_KEY = `mrg_clan_time_${WORLD}`;
const POS_KEY = 'mrg_online_pos';
const OPACITY_KEY = 'mrg_online_opacity_lvl';
const COLLAPSED_KEY = 'mrg_online_collapsed';

// Nazwy ze spacją na końcu odróżniają kolumnę "friend" od "enemy" o tym samym przedziale.
const CLANS = [
    { id: 72, name: "300 ", color: "#4cfa4f", type: "friend" },
    { id: 86, name: "300", color: "#fc3e40", type: "enemy" },
    { id: 103, name: "271 ", color: "#4cfa4f", type: "friend" },
    { id: 79, name: "271", color: "#fc3e40", type: "enemy" },
    { id: 103, name: "244 ", color: "#4cfa4f", type: "friend" },
    { id: 79, name: "244", color: "#fc3e40", type: "enemy" },
    { id: 96, name: "217 ", color: "#4cfa4f", type: "friend" },
    { id: 52, name: "217", color: "#fc3e40", type: "enemy" },
    { id: 64, name: "190 ", color: "#4cfa4f", type: "friend" },
    { id: 116, name: "190", color: "#fc3e40", type: "enemy" },
    { id: 64, name: "167 ", color: "#4cfa4f", type: "friend" },
    { id: 116, name: "167", color: "#fc3e40", type: "enemy" },
    { id: 105, name: "144 ", color: "#fc3e40", type: "enemy" },
    { id: 119, name: "144", color: "#4cfa4f", type: "friend" },
    { id: 88, name: "114 ", color: "#4cfa4f", type: "friend" },
    { id: 80, name: "114", color: "#fc3e40", type: "enemy" },
    { id: 85, name: "83 ", color: "#4cfa4f", type: "friend" },
    { id: 75, name: "83", color: "#fc3e40", type: "enemy" },
    { id: 100, name: "64 ", color: "#4cfa4f", type: "friend" },
    { id: 108, name: "64", color: "#fc3e40", type: "enemy" },
];
// Klany dzielone między dwa przedziały — gracz trafia do przedziału po dokładnym levelu.
const EXACT_LEVEL_GROUPS = ['271', '244', '190', '167'];
const OTHERS = { name: 'Pozostali', color: '#eaeaea' };

const CSS = `
    .clan-columns { display: flex; gap: 3px; box-sizing: border-box; width: 100%; }
    .clan-column { flex: 1; display: flex; flex-direction: column; gap: 0px; min-width: 0; }
    .clan-cell { display: flex; justify-content: space-between; align-items: center; cursor: default; width: 100%; box-sizing: border-box; padding: 0px 3px; }
    .clan-cell:hover { filter: brightness(1.2); }
    #mrgRefreshBtn:hover, #mrgOpacityBtn:hover { filter: brightness(1.2); cursor: pointer; }
    @keyframes mrgPulseRed {
        0%, 100% { box-shadow: inset 0 0 0 20px rgba(252, 62, 64, 0.1); }
        50% { box-shadow: inset 0 0 0 20px rgba(252, 62, 64, 0.2); }
    }
    .mrg-pulse-red { animation: mrgPulseRed 1.5s infinite; }
`;

const PANEL_HTML = `
    <div class="header-label-positioner" id="mrgOnlineHeader">
        <div class="draggable-window-element ui-draggable-handle"></div>
        <div class="header-label">
            <div class="left-decor"></div>
            <div class="right-decor"></div>
            <div class="text" name="Online" id="mrgHeaderText">Online (0)</div>
        </div>
    </div>
    <div class="content" id="mrgContentArea">
        <div class="inner-content" style="display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
            <div class="who-is-here" style="display: flex; flex-direction: column; height: 100%;">
                <div class="scroll-wrapper small-bar" style="flex: 1; height: auto;">
                    <div class="scroll-pane" style="position: relative; width: 100%; height: 100%;">
                        <div class="player-list" id="mrg-players" style="padding: 4px;">
                            <div style="color: #eaeaea; text-align: center; padding-top: 15px; font-size: 11px;">Ładowanie...</div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0px 4px; border-top: 1px solid rgba(255, 255, 255, 0.05); margin-top: -3px; flex-shrink: 0;">
                    <div id="mrg-footer-info" style="font-size: 9px; color: #eaeaea; letter-spacing: 0.3px;">Dane z: --:--:--</div>
                    <div id="mrgRefreshBtn" class="button green small" style="margin: 0; pointer-events: auto; transform: scale(0.85); transform-origin: right center;">
                        <div class="background"></div>
                        <div class="label">Napraw listę</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="close-button-corner-decor">
        <button type="button" class="close-button" id="mrgOnlineToggle"><div class="ie-icon ie-icon-close"></div></button>
    </div>
    <div class="border-image"></div>
    <div class="transparent-window-buttons-menu">
        <div class="increase-opacity" id="mrgOpacityBtn" title="Zmień przezroczystość"></div>
    </div>
`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Parsuje stronę klanu i zwraca nicki członków (lowercase). */
function parseClanMembers(html) {
    const nicks = new Set();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (!href || !(href.includes('profile') || href.includes('player') || href.includes('avatar') || a.closest('table'))) return;

        try {
            const possibleNick = decodeURIComponent(href).split(',').pop().trim();
            if (possibleNick.length > 1 && !possibleNick.includes('/')) nicks.add(possibleNick.toLowerCase());
        } catch {}

        const nick = a.textContent.trim();
        if (nick.length > 1 && !nick.includes('\n')) nicks.add(nick.toLowerCase());
    });
    return nicks;
}

/** { nick: clanId } — z cache (4h) albo pobrane ze stron klanów. */
async function loadClanMembers({ force = false } = {}) {
    const cachedTime = parseInt(localStorage.getItem(CACHE_TIME_KEY));
    if (!force && cachedTime && Date.now() - cachedTime < CLAN_CACHE_TTL) {
        const cached = loadJSON(CACHE_KEY);
        if (cached) return cached;
    }

    const members = {};
    for (const clanId of new Set(CLANS.map(c => c.id))) {
        try {
            const res = await gmRequest({
                method: 'GET',
                url: `https://www.margonem.pl/guilds/view,${WORLD},${clanId}`,
                headers: {
                    'User-Agent': navigator.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });
            parseClanMembers(res.responseText).forEach(nick => { members[nick] = clanId; });
        } catch {}
        await sleep(CLAN_FETCH_DELAY);
    }

    saveJSON(CACHE_KEY, members);
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    return members;
}

function groupPlayers(players, clanMembers) {
    const groups = Object.fromEntries([...CLANS, OTHERS].map(c => [c.name, []]));

    players.forEach(player => {
        const clanId = clanMembers[player.n.toLowerCase()];
        const level = parseInt(player.l);
        const clan = clanId !== undefined && CLANS.find(c => {
            if (c.id !== clanId) return false;
            const group = c.name.trim();
            return !EXACT_LEVEL_GROUPS.includes(group) || level === Number(group);
        });
        groups[clan ? clan.name : OTHERS.name].push(player);
    });
    return groups;
}

function renderCell(clan, players) {
    const isPulse = clan.type === 'enemy' && players.length >= PULSE_THRESHOLD;
    return `
        <div class="one-other tw-list-item clan-cell${isPulse ? ' mrg-pulse-red' : ''}" data-klan="${clan.name}">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; overflow: hidden;">
                <div style="color:${clan.color}; font-weight:600; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; flex: 1; margin-right: 4px;">${clan.name.trim()}</div>
                <div style="color:${isPulse ? '#fc3e40' : '#eaeaea'}; font-size: 11px; font-weight: 700; white-space: nowrap; flex-shrink: 0;">(${players.length})</div>
            </div>
        </div>
    `;
}

function renderColumn(title, color, clans, groups) {
    const total = clans.reduce((sum, c) => sum + groups[c.name].length, 0);
    return `
        <div class="clan-column">
            <div style="border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 4px; padding-bottom: 2px; font-size: 11px; text-align: center; font-weight: bold;"><span style="color: #aaaaaa; font-weight: 300;">${title}</span> <span style="color: ${color};">${total}</span></div>
            ${clans.map(c => renderCell(c, groups[c.name])).join('')}
        </div>
    `;
}

export default {
    id: 'online-list',
    name: 'Online List',
    description: 'Dodatek pokazuje graczy online, pogrupowanych według przedziału levelowego.',

    async run() {
        injectStyle(CSS);

        const savedPos = loadJSON(POS_KEY, { top: '50px', left: '50px' });
        let isCollapsed = loadFlag(COLLAPSED_KEY);
        let clanMembers = {};

        const panel = document.createElement('div');
        panel.id = 'mrgOnlinePanel';
        panel.className = 'c-window border-window ui-draggable transparent window-on-peak';
        panel.style.cssText = `
            position: absolute;
            z-index: 18;
            left: ${savedPos.left};
            top: ${savedPos.top};
            width: 242px;
            height: ${PANEL_HEIGHT};
            display: flex;
            flex-direction: column;
        `;
        panel.innerHTML = PANEL_HTML;
        document.body.appendChild(panel);

        const playersEl = panel.querySelector('#mrg-players');
        const headerText = panel.querySelector('#mrgHeaderText');
        const footerInfo = panel.querySelector('#mrg-footer-info');
        const toggleBtn = panel.querySelector('#mrgOnlineToggle');
        const iconEl = toggleBtn.querySelector('.ie-icon');

        setupOpacityButton(panel, panel.querySelector('#mrgOpacityBtn'), OPACITY_KEY, 0);
        makeDraggable(panel, { handle: panel.querySelector('#mrgOnlineHeader'), storageKey: POS_KEY, threshold: 0 });

        iconEl.style.display = 'inline-block';
        iconEl.style.transition = 'transform 0.3s ease';

        function applyCollapseState() {
            panel.style.height = isCollapsed ? '28px' : PANEL_HEIGHT;
            panel.style.overflow = isCollapsed ? 'hidden' : '';
            iconEl.style.transform = isCollapsed ? 'rotate(45deg)' : 'rotate(0deg)';
        }
        applyCollapseState();

        toggleBtn.onclick = e => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            saveFlag(COLLAPSED_KEY, isCollapsed);
            applyCollapseState();
        };

        function render(players) {
            const groups = groupPlayers(players, clanMembers);
            playersEl.innerHTML = `
                <div class="clan-columns">
                    ${renderColumn('Jeże', '#4cfa4f', CLANS.filter(c => c.type === 'friend'), groups)}
                    ${renderColumn('Warzywa', '#fc3e40', CLANS.filter(c => c.type === 'enemy'), groups)}
                </div>
                <div style="margin-top: 0px; padding-top: 2px; border-top: 1px dashed rgba(255,255,255,0.1); width: 100%;">
                    ${renderCell(OTHERS, groups[OTHERS.name])}
                </div>
            `;

            playersEl.querySelectorAll('.clan-cell').forEach(cell => {
                const rows = groups[cell.dataset.klan].map(p => ({ left: p.n, right: `(${p.l || ''}${p.p || ''})` }));
                cell.addEventListener('mouseenter', () => showTooltip(cell, `<div>${tooltipList(rows, 'Brak graczy online')}</div>`));
                cell.addEventListener('mouseleave', hideTooltip);
            });
        }

        async function fetchOnline() {
            try {
                const res = await gmRequest({ method: 'GET', url: ONLINE_URL });
                let players;
                try {
                    players = JSON.parse(res.responseText);
                } catch {
                    playersEl.innerText = 'Błąd JSON.';
                    return;
                }
                headerText.innerText = `Online (${players.length})`;
                footerInfo.innerText = `Dane z: ${formatClock()}`;
                render(players);
            } catch {
                playersEl.innerText = 'Błąd sieci.';
            }
        }

        // Lista online odświeża się po pełnej minucie — pobieramy ~2s po niej.
        function scheduleNextFetch() {
            const now = new Date();
            let delay = (62 - now.getSeconds()) * 1000 - now.getMilliseconds();
            if (delay < 1000) delay += 60000;
            setTimeout(() => {
                fetchOnline();
                scheduleNextFetch();
            }, delay);
        }

        panel.querySelector('#mrgRefreshBtn').onclick = async e => {
            e.stopPropagation();
            playersEl.innerHTML = '<div style="color: #eaeaea; text-align: center; padding-top: 15px; font-size: 11px;">Odświeżanie...</div>';
            clanMembers = await loadClanMembers({ force: true });
            fetchOnline();
        };

        clanMembers = await loadClanMembers();
        fetchOnline();
        scheduleNextFetch();
    },
};
