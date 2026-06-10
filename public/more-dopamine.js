(function() {

    'use strict';



    const styleId = 'custom-loot-styles';

    function injectStyles() {

        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');

        style.id = styleId;

        style.innerHTML = `

            .loot-wnd.border-window.epic-blue-glow-after,

            .loot-wnd.border-window.epic-yellow-glow-after {

                position: relative;

            }

            /* BLUE GLOW (Heroic) - Window */

            .loot-wnd.border-window.epic-blue-glow-after::after {

                content: ''; position: absolute; top: -34px; left: -20px;

                width: calc(100% + 40px); height: calc(100% + 68px);

                pointer-events: none; z-index: -1; border-radius: 10px;

                border: 1px solid #00a2eb;

                box-shadow: 0 0 calc(var(--ln-size) * 2) var(--ln-size) #00a2eb;

                opacity: calc(var(--ln-opacity) / 100);

            }

            .loot-wnd.border-window.epic-blue-glow-after::before {

                content: ""; position: absolute; top: -34px; left: -20px;

                width: calc(100% + 40px); height: calc(100% + 68px);

                opacity: 0.75; border: 5px solid #00a2eb;

                border-radius: 10px; box-sizing: border-box; z-index: -1;

            }

            /* YELLOW GLOW (Unique) - Window */

            .loot-wnd.border-window.epic-yellow-glow-after::after {

                content: ''; position: absolute; top: -34px; left: -20px;

                width: calc(100% + 40px); height: calc(100% + 68px);

                pointer-events: none; z-index: -1; border-radius: 10px;

                border: 1px solid #ffb703;

                box-shadow: 0 0 calc(var(--ln-size) * 2) var(--ln-size) #ffb703;

                opacity: calc(var(--ln-opacity) / 100);

            }

            .loot-wnd.border-window.epic-yellow-glow-after::before {

                content: ""; position: absolute; top: -34px; left: -20px;

                width: calc(100% + 40px); height: calc(100% + 68px);

                opacity: 0.75; border: 5px solid #ffb703;

                border-radius: 10px; box-sizing: border-box; z-index: -1;

            }

            /* ITEMS GLOW */

            .epic-blue-glow { position: relative; }

            .epic-blue-glow::before {

                content: ""; position: absolute; left: 0; top: 0; right: 0; bottom: 0;

                z-index: 99999 !important; transition: all 0.3s ease;

                border: 1px solid #00a2eb;

                box-shadow: 0 0 var(--ln-size) calc(var(--ln-size) / 2) #00a2eb;

                opacity: calc(var(--ln-opacity) / 100);

            }

            .epic-yellow-glow { position: relative; }

            .epic-yellow-glow::before {

                content: ""; position: absolute; left: 0; top: 0; right: 0; bottom: 0;

                z-index: 99999 !important; transition: all 0.3s ease;

                border: 1px solid #ffb703;

                box-shadow: 0 0 var(--ln-size) calc(var(--ln-size) / 2) #ffb703;

                opacity: calc(var(--ln-opacity) / 100);

            }





.game-layer.layer-blue-glow::after {

    box-shadow: inset 0 0 calc(var(--ln-size) * 2) var(--ln-size) #00a2eb !important;

}

.game-layer.layer-yellow-glow::after {

    box-shadow: inset 0 0 calc(var(--ln-size) * 2) var(--ln-size) #ffb703 !important;

}

        `;

        document.head.appendChild(style);

    }

    injectStyles();



    function intercept(obj, key, cb) {

        const original = obj[key];

        obj[key] = (...args) => cb(...args) ?? original.apply(obj, args);

    }



    const initLoop = setInterval(() => {

        if (window.Engine && window.Engine.communication && window.Engine.communication.parseJSON) {

            clearInterval(initLoop);



            intercept(window.Engine.communication, 'parseJSON', (data) => {

                if (data && data.loot && data.loot.source && data.item) {

                    let highestRarity = null;

                    const processedItems = [];



                    Object.values(data.item).forEach(i => {

                        if (i && i.stat) {

                            const stats = Object.fromEntries(

                                i.stat.split(';').map(param => param.split('='))

                            );



                            const rarity = stats.rarity;

                            processedItems.push({ item: i, rarity: rarity });



                            if (rarity === "heroic" && highestRarity !== "legendary") {

                                highestRarity = "heroic";

                            } else if (rarity === "unique" && !highestRarity) {

                                highestRarity = "unique";

                            } else if (rarity === "legendary") {

                                highestRarity = "legendary";

                            }

                        }

                    });


                  if (!highestRarity) {
                        setTimeout(function() {
                            const activeLootWnd = document.querySelector('.loot-wnd');
                            if (activeLootWnd) {
                                activeLootWnd.classList.remove('epic-blue-glow-after', 'epic-yellow-glow-after');
                            }
                        }, 50);
                        
                        return;
                    }

                    const gameLayer = document.getElementById('game-layer') || document.querySelector('.game-layer');

                    if (gameLayer && highestRarity !== "legendary") {
                        const targetClass = highestRarity === 'heroic' ? 'layer-blue-glow' : 'layer-yellow-glow';

                        gameLayer.classList.remove('layer-blue-glow', 'layer-yellow-glow');

                        gameLayer.classList.add(targetClass);



                        setTimeout(() => {

                            gameLayer.classList.remove(targetClass);

                        }, 7000);

                    }



                    if (window.confetti) {

                        const colors = highestRarity === "heroic"

                            ? ['#00a2eb', '#2563eb', '#60a5fa', '#93c5fd', '#fbbf24']

                            : (highestRarity === "legendary"

                                ? ['#ff3333', '#ff6666', '#cc0000', '#ff0000', '#ffffff']

                                : ['#ffb703', '#fb8500', '#ffb703', '#ffea00', '#ffffff']);



                        window.confetti({

                            particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: colors

                        });

                    }



                    setTimeout(() => {

                        let wndGlowApplied = false;


                        processedItems.forEach(({ item, rarity }) => {

                            const lootContainer = document.querySelector(`.loot-window [loot-id="${item.id}"]`);

                            if (!lootContainer) return;



                            const innerItem = lootContainer.querySelector(`.item-id-${item.id}`);

                            if (innerItem) {

                                if (rarity === "heroic") {

                                    innerItem.classList.add('epic-blue-glow');

                                } else if (rarity === "unique") {

                                    innerItem.classList.add('epic-yellow-glow');

                                }

                            }


                            if (!wndGlowApplied && rarity === highestRarity && highestRarity !== "legendary") {

                                const lootWnd = lootContainer.closest('.loot-wnd');

                                if (lootWnd) {

                                    lootWnd.classList.add(highestRarity === 'heroic' ? 'epic-blue-glow-after' : 'epic-yellow-glow-after');

                                    wndGlowApplied = true;
                                }

                            }

                        });

                    }, 50);

                }

            });

        }

    }, 100);

})();
