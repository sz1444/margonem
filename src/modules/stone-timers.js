import { getInventoryItems, getItemElement } from '../core/game.js';
import { parseStats } from '../core/items.js';
import { getBossTimers } from '../core/lootlog.js';
import { formatHMS } from '../core/format.js';

// id mapy z teleportu → bossowie z timerów LootLoga
const BOSS_MAP = {
    "125": ["Razuglag Oklash"], "177": ["Agar"], "580": ["Mushita"], "632": ["Kotołak Tropiciel"],
    "727": ["Władca rzek"], "7701": ["Mysiur Myświórowy Król"], "1142": ["Arachniregina Colosseus"],
    "1150": ["Goplana"], "1322": ["Adariel"], "1324": ["Leśne Widmo"], "1463": ["Pancerny Maddok"],
    "7843": ["Mocny Maddoks"], "1526": ["Henry Kaprawe Oko"], "1527": ["Helga Opiekunka Rumu"],
    "7369": ["Krab pustelnik"], "1741": ["Krab pustelnik (wyspa)"], "1912": ["Czempion Furboli"], "2063": ["Breheret Żelazny Łeb"],
    "2308": ["Szczęt alias Gładki"], "2353": ["Artenius"], "2354": ["Zorin"], "2356": ["Furion"],
    "2532": ["Zorg Jednooki Baron"], "333": ["Vari Kruger"], "2729": ["Foverk Turrim"],
    "7864": ["Marlloth Malignitas"], "3035": ["Chopesz"], "3039": ["Neferkar Set"],
    "3149": ["Gobbos"], "3327": ["Terrozaur (urwisko)"], "3335": ["Terrozaur (jaskiniea)"],
    "3340": ["Vaenra Charkhaam"], "3341": ["Chaegd Agnrakh"], "3409": ["Młody Jack Truciciel"],
    "3437": ["Furruk Kozug"], "3466": ["Żelazoręki Ohydziarz"], "1204": ["Wielka Stopa"],
    "3597": ["Dendroculus"], "3628": ["Silvanasus"], "3765": ["Centaur Zyfryd"],
    "4056": ["Pogardliwa Sybilla"], "4157": ["Tyrtajos"], "229": ["Kambion"],
    "5293": ["Tollok Shimger"], "5395": ["Owadzia Matka"], "5660": ["Tolypeutes"],
    "1901": ["Cuaitl Citlalin"], "5684": ["Quetzalcoatl"], "5694": ["Yaotl"],
    "5738": ["Shae Phu"], "5851": ["Shakkru", "Sheba Orcza Szamanka"], "5856": ["Burkog Lorulk"],
    "5861": ["Bragarth Myśliwy Dusz", "Fursharag Pożeracz Umysłów", "Ziuggrael Strażnik Królowej"],
    "5862": ["Lusgrathera Królowa Pramatka"], "5872": ["Duch Władcy Klanów"],
    "5940": ["Sadolia Nadzorczyni Hurys"], "5941": ["Annaniel Wysysacz Marzeń", "Gothardus Kolekcjoner Głów"],
    "7694": ["Sataniel Skrytobójca"], "5943": ["Zufulus Smakosz Serc"], "5945": ["Bergermona Krwawa Hrabina"],
    "6053": ["Torunia Ankelwald"], "7689": ["Cerasus"], "6064": ["Nymphemonia"],
    "6537": ["Jotun"], "6615": ["Podły zbrojmistrz"], "6623": ["Grabarz świątynny"],
    "6625": ["Lisz"], "6632": ["Tollok Atamatu"], "6633": ["Tollok Utumutu"],
    "6634": ["Choukker (p1)"], "6636": ["Choukker (p3)"], "6772": ["Nadzorczyni krasnoludów"], "6774": ["Morthen"],
    "6781": ["Gnom Figlid"], "6938": ["Jertek Moxos"], "6944": ["Miłośnik rycerzy"],
    "6945": ["Miłośnik łowców"], "6946": ["Miłośnik magii"], "6955": ["Grubber Ochlaj"],
    "7057": ["Ifryt"], "7066": ["Łowca czaszek"], "7069": ["Ozirus Władca Hieroglifów"],
    "351": ["Teściowa Rumcajsa"], "7339": ["Wójt Fistuła"], "7345": ["Królowa Śniegu"],
    "7352": ["Eol"], "7357": ["Morski potwór"], "7368": ["Borgoros Garamir III"],
    "7375": ["Stworzyciel"], "7441": ["Fodug Zolash"], "7454": ["Berserker Amuno"],
    "7466": ["Mistrz Worundriel"], "7474": ["Goons Asterus"], "4185": ["Pięknotka Mięsożerna"],
    "6055": ["Wrzosera", "Chryzoprenia", "Cantedewia"], "7693": ["Ogr Stalowy Pazur"],
    "7859": ["Al'diphrin Ilythirahel"], "1159": ["Arachniregina Colosseus"],
    "7827": ["Arytodam olbrzymi"], "8181": ["Fangaj"], "8187": ["Wabicielka"], "8532": ["Mazurnik Przybrzeżny"], "8554": ["Fovos"], "8556": ["Luna", "Noumenia"], "8541": ["Wysłannik Tellarów"]
};

const BOSS_TIMER_TTL = 1000;
const FADED = 'rgba(255, 255, 255, 0.4)';

function createTextOverlay() {
    const el = document.createElement('span');
    el.classList.add('tp-live-timer');
    Object.assign(el.style, {
        position: 'absolute', top: '1px', left: '0', width: '100%',
        fontSize: '10px', fontWeight: '800', color: '#00ffea',
        textAlign: 'center', pointerEvents: 'none', zIndex: '10',
        textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
        whiteSpace: 'nowrap', lineHeight: '10px',
    });
    return el;
}

export default {
    id: 'stone_timers',
    name: 'Stone Timers',
    description: 'Informacja o timerze na kamyku teleportacyjnym.',

    run() {
        let bossTimerCache = {};
        let lastBossTimerUpdate = 0;
        let activeStones = [];

        function syncInventory() {
            try {
                activeStones = getInventoryItems().flatMap(item => {
                    const stats = parseStats(item);
                    const tp = (stats.teleport || stats.custom_teleport || '').split(',')[0];
                    const bosses = BOSS_MAP[tp];
                    const el = bosses && getItemElement(item);
                    if (!el) return [];

                    let overlay = el.querySelector('.tp-live-timer');
                    if (!overlay) {
                        overlay = createTextOverlay();
                        el.appendChild(overlay);
                    }
                    return [{ dom: overlay, bosses }];
                });
            } catch (e) {
                console.error('[Stone Timers] syncInventory:', e);
            }
        }

        function refreshBossTimerCache() {
            const now = Date.now();
            const cache = {};
            getBossTimers().forEach(({ name, minTime, maxTime }) => {
                const remaining = Math.floor((maxTime - now) / 1000);
                cache[name] = remaining <= 0
                    ? { time: 'brak', color: FADED }
                    : { time: formatHMS(remaining).slice(3), color: now >= minTime ? 'orange' : '#fff' };
            });
            bossTimerCache = cache;
        }

        function render(stone) {
            if (!document.body.contains(stone.dom)) return;

            let found = null;
            stone.bosses.forEach(boss => { if (bossTimerCache[boss]) found = bossTimerCache[boss]; });

            const text = found ? found.time : 'brak';
            const color = found ? found.color : FADED;
            if (stone.dom.innerText !== text) stone.dom.innerText = text;
            if (stone.dom.style.color !== color) stone.dom.style.color = color;
        }

        function tick(timestamp) {
            try {
                if (timestamp - lastBossTimerUpdate > BOSS_TIMER_TTL) {
                    refreshBossTimerCache();
                    lastBossTimerUpdate = timestamp;
                }
                activeStones.forEach(render);
            } catch (e) {
                console.error('[Stone Timers] tick:', e);
            }
            requestAnimationFrame(tick);
        }

        setTimeout(syncInventory, 1000);
        setInterval(syncInventory, 3000);
        requestAnimationFrame(tick);
    },
};
