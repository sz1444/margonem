const pad = n => String(n).padStart(2, '0');

/** 3725 → "01:02:05" */
export function formatHMS(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** 125 → "2:05" (czas od ostatniego odświeżenia) */
export function formatElapsed(totalSeconds) {
    return `${Math.floor(totalSeconds / 60)}:${pad(Math.floor(totalSeconds % 60))}`;
}

export function formatClock(date = new Date()) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
