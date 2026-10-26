/** "rarity=heroic;teleport=123,4,5" → { rarity: "heroic", teleport: "123,4,5" } */
export function parseStats(item) {
    const res = {};
    (item?.stat || '').split(';').forEach(entry => {
        if (!entry) return;
        const [key, val] = entry.split('=');
        if (key) res[key] = val ?? 'true';
    });
    return res;
}

/**
 * timelimit: "minuty,unixTimestamp"
 *   parts[0] = całkowity czas resetu w minutach (60 / 90 / 180)
 *   parts[1] = unix timestamp końca cooldownu (sekundy)
 */
export function parseTimelimit(raw) {
    if (!raw) return null;
    const parts = String(raw).split(',');
    if (parts.length < 2) return null;
    const minutes = parseInt(parts[0], 10);
    const endTs = parseInt(parts[1], 10);
    if (isNaN(minutes) || isNaN(endTs) || endTs < 1_000_000_000) return null;
    return { endTs, maxSec: minutes * 60 };
}

export function getTimelimit(item) {
    const stats = parseStats(item);
    return parseTimelimit(stats.timelimit || stats.custom_timelimit || '');
}

/** 1 = właśnie użyty, 0 = gotowy. */
export function getCooldownProgress(item) {
    const tl = getTimelimit(item);
    if (!tl) return 0;
    const remaining = tl.endTs - Date.now() / 1000;
    if (remaining <= 0) return 0;
    return Math.min(remaining / tl.maxSec, 1);
}
