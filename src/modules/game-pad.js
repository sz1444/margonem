import { win } from '../core/env.js';
import { injectStyle } from '../core/dom.js';

const ICON_FULLSCREEN = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
    </svg>`;

const ICON_MINISCREEN = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 14h6v6M20 10h-6V4M3 21l7-7M21 3l-7 7"/>
    </svg>`;

const NPC_TALK = '.widget-button.green.widget-in-interface-bar.widget-npc-talk-icon.ui-draggable.ui-draggable-handle.ui-draggable-disabled';
const AUTO_FIGHT = '.widget-button.green.widget-in-interface-bar.widget-auto-fight-near-mob.ui-draggable.ui-draggable-handle.ui-draggable-disabled';
const ATTACK_PLAYER = '.widget-button.green.widget-in-interface-bar.widget-attack-near-player.ui-draggable.ui-draggable-handle.ui-draggable-disabled';

const CSS = `
    ${AUTO_FIGHT}, ${NPC_TALK}, ${ATTACK_PLAYER}, .custom-g-button, .custom-full-button {
        position: fixed !important;
        border-radius: 100px !important;
        overflow: hidden !important;
        transition: opacity 0.2s ease, right 0.3s ease, transform 0.1s ease;
        width: 80px !important;
        height: 80px !important;
        left: auto !important;
        z-index: 9999;
        background-image: linear-gradient(to top, #12210dad, #396b2947) !important;
        box-shadow: inset 0 0 1px 1px #cecece, inset 0 0 0 3px #0c0d0d !important;
        background-color: transparent !important;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: auto !important;
        user-select: none;
        opacity: 0.7;
    }

    ${NPC_TALK} { bottom: 170px !important; right: 280px !important; }
    ${AUTO_FIGHT} { bottom: 80px !important; right: 280px !important; }
    ${ATTACK_PLAYER} { bottom: 80px !important; right: 370px !important; }

    .custom-g-button {
        bottom: 260px !important;
        right: 280px !important;
        color: #ffd700;
        font-size: 29px;
        font-weight: bold;
        width: 60px !important;
        height: 60px !important;
    }

    .custom-full-button {
        bottom: 330px !important;
        right: 280px !important;
        width: 60px !important;
        height: 60px !important;
    }

    .eq-column-size-0 ${NPC_TALK},
    .eq-column-size-0 ${AUTO_FIGHT},
    .eq-column-size-0 .custom-g-button,
    .eq-column-size-0 .custom-full-button { right: 170px !important; }
    .eq-column-size-0 ${ATTACK_PLAYER} { right: 260px !important; }

    .custom-g-button:active, .custom-full-button:active { opacity: 1 !important; transform: scale(0.9); }

    .widget-button:before { display: none !important; }

    .window-full .top.positioner { display: none !important; }
    .window-full.game-window-positioner.classic-interface .game-layer { top: 0 !important; }
`;

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 1024;
}

function disableCanvasSmoothing() {
    const ctx = document.getElementById('GAME_CANVAS')?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'rgba(0,0,0,0)';
}

function onTap(el, handler) {
    el.addEventListener('click', e => { e.preventDefault(); handler(); });
    el.addEventListener('touchstart', e => { e.preventDefault(); handler(); });
}

export default {
    id: 'game_pad',
    name: 'Game Pad Mobile',
    description: 'Prosty game pad na urządzeniach mobilnych.',

    run() {
        if (!isMobile()) return;

        setTimeout(disableCanvasSmoothing, 50);
        injectStyle(CSS);

        const positioner = document.querySelector('.game-window-positioner');
        if (!positioner) return;

        const gBtn = document.createElement('div');
        gBtn.className = 'custom-g-button widget-button green widget-in-interface-bar';
        gBtn.innerText = 'G';
        positioner.appendChild(gBtn);

        const fullBtn = document.createElement('div');
        fullBtn.className = 'custom-full-button widget-button green widget-in-interface-bar';
        fullBtn.innerHTML = ICON_FULLSCREEN;
        positioner.appendChild(fullBtn);

        const triggerG = () => {
            const options = { key: 'g', keyCode: 71, code: 'KeyG', which: 71, bubbles: true, composed: true };
            document.dispatchEvent(new KeyboardEvent('keydown', options));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', options)), 50);
        };

        const toggleInterface = () => {
            const isFull = positioner.classList.contains('window-full');
            if (!isFull) {
                positioner.classList.remove('chat-size-1', 'eq-column-size-1');
                positioner.classList.add('chat-size-0', 'eq-column-size-0', 'game-window-compact', 'window-full');
                fullBtn.innerHTML = ICON_MINISCREEN;
                fullBtn.style.filter = 'hue-rotate(90deg)';
            } else {
                positioner.classList.remove('chat-size-0', 'eq-column-size-0', 'game-window-compact', 'window-full');
                positioner.classList.add('chat-size-1', 'eq-column-size-1');
                fullBtn.innerHTML = ICON_FULLSCREEN;
                fullBtn.style.filter = 'none';
            }
            win.dispatchEvent(new Event('resize'));
        };

        onTap(gBtn, triggerG);
        onTap(fullBtn, toggleInterface);
    },
};
