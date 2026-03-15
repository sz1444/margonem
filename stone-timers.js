
(function () {
    'use strict';

    const BOSS_MAP = {
        "125": ["Razuglag Oklash"], "177": ["Agar"], "580": ["Mushita"], "632": ["Kotołak Tropiciel"],
        "727": ["Władca rzek"], "7701": ["Mysiur Myśliwirowy Król"], "1142": ["Arachniregina Colosseus"],
        "1151": ["Goplana"], "1322": ["Adariel"], "1325": ["Leśne Widmo"], "1463": ["Pancerny Maddok"],
        "7843": ["Mocny Maddoks"], "1526": ["Henry Kaprawe Oko"], "1527": ["Helga Opiekunka Rumu"],
        "1620": ["Krab pustelnik"], "1912": ["Czempion Furboli"], "2063": ["Breheret Żelazny Łeb"],
        "2308": ["Szczęt alias Gładki"], "2353": ["Artenius"], "2354": ["Zorin"], "2356": ["Furion"],
        "2532": ["Zorg Jednooki Baron"], "2646": ["Vari Kruger"], "2729": ["Foverk Turrim"],
        "7864": ["Marlloth Malignitas"], "3035": ["Chopesz"], "3039": ["Neferkar Set"],
        "3149": ["Gobbos"], "3327": ["Terrozaur (urwisko)"], "3335": ["Terrozaur (jaskinia)"],
        "3340": ["Vaenra Charkhaam"], "3341": ["Chaegd Agnrakh"], "3409": ["Młody Jack Truciciel"],
        "3437": ["Furruk Kozug"], "3466": ["Żelazoręki Ohydziarz"], "3530": ["Wielka Stopa"],
        "3597": ["Dendroculus"], "3628": ["Silvanasus"], "3765": ["Centaur Zyfryd"],
        "4056": ["Pogardliwa Sybilla"], "4157": ["Tyrtajos"], "4998": ["Kambion"],
        "5293": ["Tollok Shimger"], "5395": ["Owadzia Matka"], "5662": ["Tolypeutes"],
        "5672": ["Cuaitl Citlalin"], "5685": ["Quetzalcoatl"], "5695": ["Yaotl"],
        "5738": ["Shae Phu"], "5851": ["Shakkru", "Sheba Orcza Szamanka"], "5856": ["Burkog Lorulk"],
        "5861": ["Bragarth Myśliwy Dusz", "Fursharag Pożeracz Umysłów", "Ziuggrael Strażnik Królowej"],
        "5862": ["Lusgrathera Królowa Pramatka"], "5872": ["Duch Władcy Klanów"],
        "5940": ["Sadolia Nadzorczyni Hurys"], "5941": ["Annaniel Wysysacz Marzeń", "Gothardus Kolekcjoner Głów"],
        "7695": ["Sataniel Skrytobójca"], "5943": ["Zufulus Smakosz Serc"], "5945": ["Bergermona Krwawa Hrabina"],
        "6053": ["Torunia Ankelwald"], "7689": ["Cerasus"], "6064": ["Nymphemonia"],
        "6537": ["Jotun"], "6615": ["Podły zbrojmistrz"], "6623": ["Grabarz świątynny"],
        "6627": ["Lisz"], "6632": ["Tollok Atamatu"], "6633": ["Tollok Utumutu"],
        "6634": ["Choukker"], "6772": ["Nadzorczyni krasnoludów"], "6774": ["Morthen"],
        "6781": ["Gnom Figlid"], "6938": ["Jertek Moxos"], "6944": ["Miłośnik rycerzy"],
        "6945": ["Miłośnik łowców"], "6946": ["Miłośnik magii"], "6956": ["Grubber Ochlaj"],
        "7057": ["Ifryt"], "7066": ["Łowca czaszek"], "7069": ["Ozirus Władca Hieroglifów"],
        "7338": ["Teściowa Rumcajsa"], "7340": ["Wójt Fistuła"], "7345": ["Królowa Śniegu"],
        "7352": ["Eol"], "7357": ["Morski potwór"], "7368": ["Borgoros Garamir III"],
        "7375": ["Stworzyciel"], "7441": ["Fodug Zolash"], "7454": ["Berserker Amuno"],
        "7466": ["Mistrz Worundriel"], "7474": ["Goons Asterus"], "4185": ["Pięknotka Mięsożerna"],
        "6055": ["Wrzosera", "Chryzoprenia", "Cantedewia"], "7693": ["Ogr Stalowy Pazur"],
        "7859": ["Al'diphrin Ilythirahel"], "1159": ["Arachniregina Colosseus"],
        "7827": ["Arytodam olbrzymi"], "8181": ["Fangaj"], "8187": ["Wabicielka"]
    };

    const IS_NEW_INTERFACE = typeof window.Engine !== "undefined";
    const BOSS_TIMER_TTL = 250;

    let bossTimerCache = {};
    let lastBossTimerUpdate = 0;
    let activeStones = [];

    /**
     * Bezpieczne parsowanie statystyk przedmiotu
     */
    function parseStats(item) {
        try {
            if (!item || typeof item !== 'object') return {};
            if (item._cachedStats) return item._cachedStats;

            const res = {};
            const statStr = item.stat || "";
            statStr.split(";").forEach(entry => {
                if (!entry) return;
                const [key, val] = entry.split("=");
                if (key) res[key] = val ?? "true";
            });
            item._cachedStats = res;
            return res;
        } catch (e) {
            console.warn("Błąd podczas parsowania statystyk przedmiotu:", item?.id, e);
            return {};
        }
    }

    function createTextOverlay() {
        const el = document.createElement("span");
        el.classList.add("tp-live-timer");
        Object.assign(el.style, {
            position: "absolute", top: "1px", left: "0", width: "100%",
            fontSize: "10px", fontWeight: "800", color: "#00ffea",
            textAlign: "center", pointerEvents: "none", zIndex: "10",
            textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
            whiteSpace: "nowrap", lineHeight: "10px",
        });
        return el;
    }

    /**
     * Synchronizacja ekwipunku z obsługą błędów DOM
     */
    function syncInventory() {
        try {
            const items = IS_NEW_INTERFACE
                ? (window.Engine?.items?.fetchLocationItems("g") ?? [])
                : Object.values(window.g?.item ?? {}).filter(i => i && i.loc === "g");

            const newStones = [];

            items.forEach(item => {
                const stats = parseStats(item);
                const tpValue = stats.teleport || stats.custom_teleport || "";
                const tp = tpValue.split(",")[0];
                const bossNames = BOSS_MAP[tp];

                if (!bossNames) return;

                const selector = IS_NEW_INTERFACE ? `.item-id-${item.id}` : `#item${item.id}`;
                const el = document.querySelector(selector);

                if (!el) return;

                try {
                    let overlay = el.querySelector(".tp-live-timer");
                    if (!overlay) {
                        overlay = createTextOverlay();
                        el.appendChild(overlay);
                    }
                    newStones.push({ dom: overlay, bosses: bossNames });
                } catch (domErr) {
                    console.error("Błąd manipulacji DOM dla przedmiotu:", item.id, domErr);
                }
            });

            activeStones = newStones;
        } catch (globalErr) {
            console.error("Krytyczny błąd w syncInventory:", globalErr);
        }
    }

    /**
     * Odświeżanie cache timerów z zabezpieczeniem przed brakiem kontenera
     */
    function refreshBossTimerCache() {
        try {
            const cache = {};
            const timerContainer = document.getElementById('ll-timers');
            if (!timerContainer) return;

            const timerNodes = timerContainer.querySelectorAll('[data-slot="tooltip-trigger"] span');
            timerNodes.forEach(span => {
                try {
                    const timerDiv = span.nextElementSibling;
                    if (timerDiv?.tagName === 'DIV') {
                        const parent = span.closest('.ll\\:text-orange-400') ?? span.parentElement;
                        const isActive = parent?.className?.includes('text-orange-400') ?? false;

                        const bossName = span.innerText.trim();
                        if (bossName) {
                            cache[bossName] = {
                                time: timerDiv.innerText.trim() || "--:--",
                                color: isActive ? 'orange' : "#fff"
                            };
                        }
                    }
                } catch (nodeErr) {
                    // Ignoruj błędy pojedynczych węzłów timerów
                }
            });
            bossTimerCache = cache;
        } catch (e) {
            console.error("Błąd podczas odświeżania timerów:", e);
        }
    }

    function formatTime(raw) {
        if (!raw || typeof raw !== 'string') return "??";
        const parts = raw.split(':');
        return parts.length === 3 ? `${parts[1]}:${parts[2]}` : raw;
    }

    /**
     * Główna pętla renderująca z catch-all
     */
    function smoothTick(timestamp) {
        try {
            if (timestamp - lastBossTimerUpdate > BOSS_TIMER_TTL) {
                refreshBossTimerCache();
                lastBossTimerUpdate = timestamp;
            }

            activeStones.forEach(stone => {
                // Sprawdź czy element DOM nadal istnieje w dokumencie
                if (!document.body.contains(stone.dom)) return;

                const cacheKeys = Object.keys(bossTimerCache);
                const found = cacheKeys.find(fullTextFromGame => {
                    return stone.bosses.some(bossName =>
                         fullTextFromGame.includes(bossName)
                    );
                });

                if (found) {
                    const { time, color } = bossTimerCache[found];
                    const formatted = formatTime(time);
                    if (stone.dom.innerText !== formatted) stone.dom.innerText = formatted;
                    if (stone.dom.style.color !== color) stone.dom.style.color = color;
                } else {
                    const fallback = 'brak';
                    if (stone.dom.innerText !== fallback) stone.dom.innerText = fallback;
                    const fadedColor = "rgba(255, 255, 255, 0.4)";
                    if (stone.dom.style.color !== fadedColor) stone.dom.style.color = fadedColor;
                }
            });
        } catch (tickErr) {
            console.error("Błąd w pętli renderującej smoothTick:", tickErr);
        }

        requestAnimationFrame(smoothTick);
    }

    // Bezpieczny start
    try {
        setTimeout(syncInventory, 1000);
        setInterval(syncInventory, 3000);
        requestAnimationFrame(smoothTick);
    } catch (startErr) {
        console.error("Nie udało się zainicjować skryptu:", startErr);
    }
})();
