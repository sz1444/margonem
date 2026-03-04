(function() {
'use strict';

    const isMobile = (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0) ||
        (window.innerWidth <= 1024)
    );

    if (!isMobile) return;

   setTimeout(function() {

        const ctx = document.getElementById('GAME_CANVAS').getContext('2d');

        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;

        ctx.shadowBlur = 0;
        ctx.shadowColor = "rgba(0,0,0,0)";
    }, 50);


    const style = document.createElement('style');
    style.innerHTML = `
        .widget-button.green.widget-in-interface-bar.widget-auto-fight-near-mob.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .widget-button.green.widget-in-interface-bar.widget-npc-talk-icon.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .widget-button.green.widget-in-interface-bar.widget-attack-near-player.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .custom-g-button {
           position: fixed !important;
           border-radius: 100px !important;
           overflow: hidden !important;
           transition: opacity 0.2s ease;
           width: 80px !important;
           height: 80px !important;
           left: auto !important;
           z-index: 9999;
    background-image: linear-gradient(to top, #12210dad, #396b2947) !important;
    box-shadow: inset 0 0 1px 1px #cecece, inset 0 0 0 3px #0c0d0d !important;
    background-color: transparent !important;
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

        /* Styl dla nowego przycisku G */
        .custom-g-button {
            bottom: 260px !important;
            right: 280px !important;
            color: #ffd700;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 29px;
            font-weight: bold;
            cursor: pointer;
            pointer-events: auto !important;
            user-select: none;
            width: 60px !important;
            height:60px !important;
        }

        .eq-column-size-0 .widget-button.green.widget-in-interface-bar.widget-npc-talk-icon.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .eq-column-size-0 .widget-button.green.widget-in-interface-bar.widget-auto-fight-near-mob.ui-draggable.ui-draggable-handle.ui-draggable-disabled,
        .eq-column-size-0 .custom-g-button {
            right: 170px !important;
        }
        .eq-column-size-0 .widget-button.green.widget-in-interface-bar.widget-attack-near-player.ui-draggable.ui-draggable-handle.ui-draggable-disabled {
           right: 260px !important;
        }

        .widget-button.green.widget-in-interface-bar.widget-npc-talk-icon:hover,
        .custom-g-button:hover {
            opacity: 1 !important;
        }

        .widget-button:before { display:none;}
    `;
    document.head.appendChild(style);

    const gBtn = document.createElement('div');
    gBtn.className = 'custom-g-button widget-button green widget-in-interface-bar';
    gBtn.innerText = 'G';
    document.querySelector('.game-window-positioner').appendChild(gBtn);

      const triggerG = () => {
        const options = {
            key: 'g',
            keyCode: 71,
            code: 'KeyG',
            which: 71,
            bubbles: true,
            composed: true
        };

        const down = new KeyboardEvent('keydown', options);
        const up = new KeyboardEvent('keyup', options);

        document.dispatchEvent(down);

        setTimeout(() => {
            document.dispatchEvent(up);
        }, 50);

         document.body.dispatchEvent(down);
    };

    gBtn.addEventListener('click', (e) => {
        e.preventDefault();
        triggerG();

        gBtn.style.opacity = '1';
        setTimeout(() => { gBtn.style.opacity = '0.7'; }, 100);
    });

    gBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        triggerG();
    });
})();
