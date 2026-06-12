(function() {

'use strict';



const styleId = 'custom-loot-styles';

function injectStyles() {

if (document.getElementById(styleId)) return;

const style = document.createElement('style');

style.id = styleId;

style.innerHTML = `

/* STYLOWANIE RAMKI PRZEZ ALERTS-LAYER */



/* BLUE GLOW (Heroic) */

/* Zmiana na absolute !important naprawia rozciąganie okna */

.alerts-layer[data-loot-rarity="heroic"] .loot-wnd { position: absolute !important; }

.alerts-layer[data-loot-rarity="heroic"] .loot-wnd::after {

content: ''; position: absolute; top: -34px; left: -20px;

width: calc(100% + 40px); height: calc(100% + 68px);

pointer-events: none; z-index: -1; border-radius: 10px;

border: 1px solid #00a2eb;

box-shadow: 0 0 calc(var(--ln-size) * 2) var(--ln-size) #00a2eb;

opacity: calc(var(--ln-opacity) / 100);

}

.alerts-layer[data-loot-rarity="heroic"] .loot-wnd::before {

content: ""; position: absolute; top: -34px; left: -20px;

width: calc(100% + 40px); height: calc(100% + 68px);

opacity: 0.75; border: 5px solid #00a2eb;

border-radius: 10px; box-sizing: border-box; z-index: -1;

}



/* YELLOW GLOW (Unique) */

/* Zmiana na absolute !important naprawia rozciąganie okna */

.alerts-layer[data-loot-rarity="unique"] .loot-wnd { position: absolute !important; }

.alerts-layer[data-loot-rarity="unique"] .loot-wnd::after {

content: ''; position: absolute; top: -34px; left: -20px;

width: calc(100% + 40px); height: calc(100% + 68px);

pointer-events: none; z-index: -1; border-radius: 10px;

border: 1px solid #ffb703;

box-shadow: 0 0 calc(var(--ln-size) * 2) var(--ln-size) #ffb703;

opacity: calc(var(--ln-opacity) / 100);

}

.alerts-layer[data-loot-rarity="unique"] .loot-wnd::before {

content: ""; position: absolute; top: -34px; left: -20px;

width: calc(100% + 40px); height: calc(100% + 68px);

opacity: 0.75; border: 5px solid #ffb703;

border-radius: 10px; box-sizing: border-box; z-index: -1;

}



/* ITEMS GLOW */

.epic-blue-glow { position: relative !important; }

.epic-blue-glow::before {

content: ""; position: absolute; left: 0; top: 0; right: 0; bottom: 0;

z-index: 99999 !important; transition: all 0.3s ease;

border: 1px solid #00a2eb;

box-shadow: 0 0 var(--ln-size) calc(var(--ln-size) / 2) #00a2eb;

opacity: calc(var(--ln-opacity) / 100);

}

.epic-yellow-glow { position: relative !important; }

.epic-yellow-glow::before {

content: ""; position: absolute; left: 0; top: 0; right: 0; bottom: 0;

z-index: 99999 !important; transition: all 0.3s ease;

border: 1px solid #ffb703;

box-shadow: 0 0 var(--ln-size) calc(var(--ln-size) / 2) #ffb703;

opacity: calc(var(--ln-opacity) / 100);

}



.game-layer.layer-blue-glow::after { box-shadow: inset 0 0 calc(var(--ln-size) * 2) var(--ln-size) #00a2eb !important; }

.game-layer.layer-yellow-glow::after { box-shadow: inset 0 0 calc(var(--ln-size) * 2) var(--ln-size) #ffb703 !important; }

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

let hasLootItems = false;



Object.values(data.item).forEach(i => {

if (i && i.stat && i.loc === "l") {

hasLootItems = true;

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



const alertsLayer = document.querySelector('.alerts-layer') || document.getElementById('alerts-layer');



if (alertsLayer && hasLootItems) {

if (highestRarity && highestRarity !== "legendary") {

alertsLayer.setAttribute('data-loot-rarity', highestRarity);

} else {

alertsLayer.removeAttribute('data-loot-rarity');

}

}



const gameLayer = document.getElementById('game-layer') || document.querySelector('.game-layer');

if (gameLayer && highestRarity && highestRarity !== "legendary") {

const flashClass = highestRarity === 'heroic' ? 'layer-blue-glow' : 'layer-yellow-glow';

gameLayer.classList.remove('layer-blue-glow', 'layer-yellow-glow');

gameLayer.classList.add(flashClass);

setTimeout(() => { gameLayer.classList.remove(flashClass); }, 5000);

}



if (window.confetti && highestRarity) {

const colors = highestRarity === "heroic"

? ['#00a2eb', '#2563eb', '#60a5fa', '#93c5fd', '#fbbf24']

: (highestRarity === "legendary"

? ['#ff3333', '#ff6666', '#cc0000', '#ff0000', '#ffffff']

: ['#ffb703', '#fb8500', '#ffb703', '#ffea00', '#ffffff']);

window.confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: colors });

}



setTimeout(() => {

processedItems.forEach(({ item, rarity }) => {

const lootContainer = document.querySelector(`.loot-window [loot-id="${item.id}"]`);

if (!lootContainer) return;



const innerItem = lootContainer.querySelector(`.item-id-${item.id}`);

if (innerItem) {

if (rarity === "heroic") innerItem.classList.add('epic-blue-glow');

if (rarity === "unique") innerItem.classList.add('epic-yellow-glow');

}

});

}, 60);

}

});

}

}, 100);

})();
