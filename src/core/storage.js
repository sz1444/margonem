export function loadJSON(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw) ?? fallback;
    } catch {
        return fallback;
    }
}

export function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {}
}

export function loadFlag(key, fallback = false) {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === 'true';
}

export function saveFlag(key, value) {
    localStorage.setItem(key, String(!!value));
}
