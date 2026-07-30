// ==UserScript==
// @name         Margonem Mobile style
// @namespace    http://tampermonkey.net/
// @version      2026-03-18
// @description  Nowoczesny interfejs mobilny z dynamicznymi ikonami
// @author       You
// @match        https://nubes.margonem.pl/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=margonem.pl
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const isMobile = (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0) ||
        (window.innerWidth <= 1024)
    );

    if (!isMobile) return;

    const ICON_FULLSCREEN = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>`;

    const ICON_MINISCREEN = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 14h6v6M20 10h-6V4M3 21l7-7M21 3l-7 7"/>
        </svg>`;

    setTimeout(function() {
        const canvas = document.getElementById('GAME_CANVAS');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.shadowBlur = 0;
            ctx.shadowColor = "rgba(0,0,0,0)";
        }
    }, 50);

    const style = document.createElement('style');
    style.innerHTML = `
        .widget-button.green.widget-in-interface-bar.widget-auto-fight-near-mob.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .widget-button.green.widget-in-interface-bar.widget-npc-talk-icon.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .widget-button.green.widget-in-interface-bar.widget-attack-near-player.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .custom-g-button,
        .custom-full-button {
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

        .widget-button.green.widget-in-interface-bar.widget-npc-talk-icon.ui-draggable.ui-draggable-handle.ui-draggable-disabled {
            bottom: 170px !important;
            right: 280px !important;
        }

        .widget-button.green.widget-in-interface-bar.widget-auto-fight-near-mob.ui-draggable.ui-draggable-handle.ui-draggable-disabled{
            bottom: 80px !important;
            right: 280px !important;
         }

        .widget-button.green.widget-in-interface-bar.widget-attack-near-player.ui-draggable.ui-draggable-handle.ui-draggable-disabled {
            bottom: 80px !important;
            right: 370px !important;
        }

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

        .eq-column-size-0 .widget-button.green.widget-in-interface-bar.widget-npc-talk-icon.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .eq-column-size-0 .widget-button.green.widget-in-interface-bar.widget-auto-fight-near-mob.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .eq-column-size-0 .custom-g-button,
        .eq-column-size-0 .custom-full-button {
            right: 170px !important;
        }
        .eq-column-size-0 .widget-button.green.widget-in-interface-bar.widget-attack-near-player.ui-draggable.ui-draggable-handle.ui-draggable-disabled {
           right: 260px !important;
        }

        .custom-g-button:active, .custom-full-button:active {
            opacity: 1 !important;
            transform: scale(0.9);
        }

        .widget-button:before { display:none !important; }

        .window-full .top.positioner { display: none !important; }
        .window-full.game-window-positioner.classic-interface .game-layer { top: 0 !important; }
    `;

    document.head.appendChild(style);

    const positioner = document.querySelector('.game-window-positioner');

    const gBtn = document.createElement('div');
    gBtn.className = 'custom-g-button widget-button green widget-in-interface-bar';
    gBtn.innerText = 'G';
    positioner.appendChild(gBtn);

    // Tworzenie przycisku FULL
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
        const isCurrentlyFull = positioner.classList.contains('window-full');

        if (!isCurrentlyFull) {
            positioner.classList.remove('chat-size-1', 'eq-column-size-1');
            positioner.classList.add('chat-size-0', 'eq-column-size-0', 'game-window-compact', 'window-full');
            fullBtn.innerHTML = ICON_MINISCREEN;
            fullBtn.style.filter = "hue-rotate(90deg)"; // Wizualny akcent aktywacji
        } else {
            positioner.classList.remove('chat-size-0', 'eq-column-size-0', 'game-window-compact', 'window-full');
            positioner.classList.add('chat-size-1', 'eq-column-size-1');
            fullBtn.innerHTML = ICON_FULLSCREEN;
            fullBtn.style.filter = "none";
        }
        window.dispatchEvent(new Event('resize'));
    };

    gBtn.addEventListener('click', (e) => { e.preventDefault(); triggerG(); });
    gBtn.addEventListener('touchstart', (e) => { e.preventDefault(); triggerG(); });

    fullBtn.addEventListener('click', (e) => { e.preventDefault(); toggleInterface(); });
    fullBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleInterface(); });

})();
