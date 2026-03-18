// ==UserScript==
// @name         Margonem Mobile style
// @namespace    http://tampermonkey.net/
// @version      2026-02-17
// @description  try to take over the world!
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
           transition: opacity 0.2s ease, right 0.3s ease;
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

        /* Styl dla przycisku G */
        .custom-g-button {
            bottom: 260px !important;
            right: 280px !important;
            color: #ffd700;
            font-size: 29px;
            font-weight: bold;
            width: 60px !important;
            height: 60px !important;
        }

        /* Styl dla przycisku FULL (nad G) */
        .custom-full-button {
            bottom: 330px !important;
            right: 280px !important;
            color: #ffffff;
            font-size: 14px;
            font-weight: bold;
            width: 60px !important;
            height: 60px !important;
            text-shadow: 1px 1px 2px #000;
        }

        /* Responsywność przy schowanym EQ */
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
            transform: scale(0.95);
        }

        .widget-button:before { display:none !important; }

        .game-window-compact .layer.interface-layer .positioner.top { display: none; }
        .game-window-positioner.game-window-compact.classic-interface .game-layer { top: 0; }
    `;

    document.head.appendChild(style);

    const positioner = document.querySelector('.game-window-positioner');

    // Tworzenie przycisku G
    const gBtn = document.createElement('div');
    gBtn.className = 'custom-g-button widget-button green widget-in-interface-bar';
    gBtn.innerText = 'G';
    positioner.appendChild(gBtn);

    // Tworzenie przycisku FULL
    const fullBtn = document.createElement('div');
    fullBtn.className = 'custom-full-button widget-button green widget-in-interface-bar';
    fullBtn.innerText = 'FULL';
    positioner.appendChild(fullBtn);

    // Logika przycisku G
    const triggerG = () => {
        const options = { key: 'g', keyCode: 71, code: 'KeyG', which: 71, bubbles: true, composed: true };
        const down = new KeyboardEvent('keydown', options);
        const up = new KeyboardEvent('keyup', options);
        document.dispatchEvent(down);
        setTimeout(() => document.dispatchEvent(up), 50);
    };

    // Logika przycisku FULL
    const toggleInterface = () => {
        const isHidden = positioner.classList.contains('chat-size-0');
        if (!isHidden) {
            positioner.classList.remove('chat-size-1', 'eq-column-size-1');
            positioner.classList.add('chat-size-0', 'eq-column-size-0', 'game-window-compact');

        } else {
            positioner.classList.remove('chat-size-0', 'eq-column-size-0', 'game-window-compact');
            positioner.classList.add('chat-size-1', 'eq-column-size-1');
        }
        window.dispatchEvent(new Event('resize'));
    };

    // Eventy dla G
    gBtn.addEventListener('click', (e) => { e.preventDefault(); triggerG(); });
    gBtn.addEventListener('touchstart', (e) => { e.preventDefault(); triggerG(); });

    // Eventy dla FULL
    fullBtn.addEventListener('click', (e) => { e.preventDefault(); toggleInterface(); });
    fullBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleInterface(); });

})();
