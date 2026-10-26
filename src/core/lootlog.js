import { win } from './env.js';
import { getWorldName } from './game.js';

export function getLootlogTimers() {
    const api = win.lootlogGameClientApi;
    if (!api || typeof api.getTimers !== 'function') return [];
    return api.getTimers({ world: getWorldName() }) || [];
}

/** Ujednolicony timer: { key, name, minTime, maxTime } (ms) albo null, gdy brak nazwy NPC. */
export function normalizeTimer(item) {
    const name = item?.npc?.name;
    if (!name) return null;
    const maxTime = new Date(item.maxSpawnTime).getTime();
    const minTime = item.minSpawnTime ? new Date(item.minSpawnTime).getTime() : maxTime;
    return { key: item.timerKey || `${item.npcId}:${name}`, name, minTime, maxTime };
}

export function getBossTimers() {
    return getLootlogTimers().map(normalizeTimer).filter(Boolean);
}
