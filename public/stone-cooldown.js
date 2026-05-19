(function () {
    'use strict';

    const OVERLAY_COLOR = "rgba(0, 0, 0, 0.5)"; 
    const SYNC_INTERVAL = 3000;                     

    const IS_NEW_INTERFACE = typeof window.Engine !== "undefined";

    let activeStones = [];


    function parseStats(item) {
        const res = {};
        (item.stat || "").split(";").forEach(entry => {
            if (!entry) return;
            const [key, val] = entry.split("=");
            if (key) res[key] = val ?? "true";
        });
        return res;
    }

    /**
     * timelimit format: "minuty,unixTimestamp"
     *   parts[0] = całkowity czas resetu w minutach (60 / 90 / 180)
     *   parts[1] = unix timestamp końca cooldownu (sekundy)
     */
    function parseTimelimit(raw) {
        if (!raw) return null;
        const parts = String(raw).split(",");
        if (parts.length < 2) return null;
        const minutes = parseInt(parts[0], 10);
        const endTs   = parseInt(parts[1], 10);
        if (isNaN(minutes) || isNaN(endTs) || endTs < 1_000_000_000) return null;
        return { endTs, maxSec: minutes * 60 };
    }

    /**
     * Zwraca progress 0..1:
     *   1 = właśnie użyty (pełna nakładka)
     *   0 = gotowy (brak nakładki)
     */
    function getCooldownProgress(item) {
        const stats = parseStats(item);
        const raw = stats.timelimit || stats.custom_timelimit || "";
        const tl = parseTimelimit(raw);
        if (!tl) return 0;
        const remaining = tl.endTs - Date.now() / 1000;
        if (remaining <= 0) return 0;
        return Math.min(remaining / tl.maxSec, 1);
    }

    // ─── Nakładka SVG (efekt zegara) ──────────────────────────────────────────────

    /**
     * Tworzy nakładkę SVG z trójkątowym wycinkiem obracającym się jak wskazówki zegara.
     * progress=1 → pełne czerwone tło (kamień na cooldownie)
     * progress=0 → brak nakładki (kamień gotowy)
     *
     * Używamy <path> z dużym łukiem. Środek to (50,50), promień 100 (większy niż kafelek).
     * Kąt startowy: -90° (góra), obraca się zgodnie z ruchem wskazówek.
     */
    function createOverlay() {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.classList.add("tp-cd-overlay");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        Object.assign(svg.style, {
            position: "absolute",
            top: "0", left: "0",
            width: "100%", height: "100%",
            pointerEvents: "none",
            zIndex: "8",
            display: "none",
        });

        const path = document.createElementNS(ns, "path");
        path.setAttribute("fill", OVERLAY_COLOR);
        svg.appendChild(path);

        return { svg, path };
    }

    /**
     * Buduje SVG path dla wycinka kołowego pokrywającego `progress` część koła.
     * Zaczyna od góry (12 o'clock), obraca się zgodnie z wskazówkami.
     * progress=1 → pełne koło (cały kafelek zakryty)
     * progress→0 → wycinek znika
     */
    function buildSectorPath(progress) {
        const cx = 50, cy = 50, r = 80; // r większy niż pół przekątnej → pokrywa rogi

        if (progress >= 1) {
            // Pełne koło – prosty rect zamiast arc (unikamy edge case 360°)
            return "M0,0 H100 V100 H0 Z";
        }

        const angle = progress * 2 * Math.PI; // 0..2π
        const startAngle = -Math.PI / 2;       // -90° = góra
        const endAngle   = startAngle + angle;

        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);

        const largeArc = angle > Math.PI ? 1 : 0;

        // Trójkąt: środek → punkt startowy → łuk → środek
        return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
    }

    function updateOverlay(stone, progress) {
        if (progress <= 0) {
            stone.svg.style.display = "none";
            return;
        }
        stone.svg.style.display = "";
        stone.path.setAttribute("d", buildSectorPath(progress));
    }

    // ─── Synchronizacja ekwipunku ─────────────────────────────────────────────────

    function getInventoryItems() {
        if (IS_NEW_INTERFACE) {
            return window.Engine?.items?.fetchLocationItems("g") ?? [];
        }
        return Object.values(window.g?.item ?? {}).filter(i => i && i.loc === "g");
    }

    function syncInventory() {
        try {
            const items = getInventoryItems();
            const newStones = [];

            items.forEach(item => {
                const stats = parseStats(item);
                const tpValue = stats.teleport || stats.custom_teleport || "";
                // Sprawdź czy kamień ma teleport (dowolny) – nakładka dotyczy każdego kamienia z timelimit
                if (!tpValue) return;
                const tl = parseTimelimit(stats.timelimit || stats.custom_timelimit || "");
                if (!tl) return; // brak cooldownu – pomijamy

                const selector = IS_NEW_INTERFACE ? `.item-id-${item.id}` : `#item${item.id}`;
                const el = document.querySelector(selector);
                if (!el) return;

                if (getComputedStyle(el).position === "static") el.style.position = "relative";

                let svg = el.querySelector(".tp-cd-overlay");
                let path;
                if (!svg) {
                    const created = createOverlay();
                    svg  = created.svg;
                    path = created.path;
                    el.appendChild(svg);
                } else {
                    path = svg.querySelector("path");
                }

                newStones.push({ svg, path, item });
            });

            activeStones = newStones;
        } catch (e) {
            console.error("[cd-overlay] syncInventory:", e);
        }
    }

    // ─── Pętla renderująca ────────────────────────────────────────────────────────

    function tick() {
        activeStones.forEach(stone => {
            if (!document.body.contains(stone.svg)) return;
            updateOverlay(stone, getCooldownProgress(stone.item));
        });
        requestAnimationFrame(tick);
    }

    // ─── Init ─────────────────────────────────────────────────────────────────────

    setTimeout(syncInventory, 1000);
    setInterval(syncInventory, SYNC_INTERVAL);
    requestAnimationFrame(tick);

})();
