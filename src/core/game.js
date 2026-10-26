import { win } from './env.js';

export const isNewInterface = () => typeof win.Engine !== 'undefined';

export function isGameReady() {
    const heroLoaded = win.Engine?.hero?.d?.id || win.hero?.id || win.g?.hero?.id;
    return !!heroLoaded && typeof win._g === 'function';
}

export function getHeroName(fallback = null) {
    return win.Engine?.hero?.d?.nick || win.hero?.nick || fallback;
}

export function getHeroId() {
    return win.Engine?.hero?.d?.id ?? win.hero?.id ?? win.g?.hero?.id ?? null;
}

export function getClanId() {
    return win.Engine?.hero?.d?.clan?.id || win.hero?.clan?.id || null;
}

export function getMapName(fallback = '???') {
    return win.Engine?.map?.d?.name || win.map?.name || fallback;
}

export function getWorldName() {
    if (win.Engine?.worldConfig?.getWorldName) return win.Engine.worldConfig.getWorldName();
    if (win.g?.worldname) return win.g.worldname;
    const host = location.hostname.split('.');
    return host.length > 2 ? host[0] : '';
}

/** Wysyła komendę do serwera gry, np. "party&a=disband". */
export function sendRequest(query) {
    if (typeof win._g === 'function') return win._g(query);
    if (typeof win.Engine?.sendRequest === 'function') return win.Engine.sendRequest(query);
}

// --- ekwipunek ---

export function getInventoryItems() {
    if (isNewInterface()) return win.Engine?.items?.fetchLocationItems('g') ?? [];
    return Object.values(win.g?.item ?? {}).filter(i => i && i.loc === 'g');
}

export function getItemElement(item) {
    return document.querySelector(isNewInterface() ? `.item-id-${item.id}` : `#item${item.id}`);
}

// --- walka ---

export function isInBattle() {
    if (win.Engine?.lock) return win.Engine.lock.check('battle');
    if (win.g?.battle) return Object.keys(win.g.battle).length > 0;
    return !!document.querySelector('.battle-window, #battle');
}

/** Walka z potworami (NPC mają ujemne id w warriorsList). */
export function isPvEBattle() {
    if (!win.Engine?.battle?.show) return false;
    const warriors = win.Engine.battle.warriorsList || {};
    return Object.keys(warriors).some(id => Number(id) < 0);
}

// --- grupa ---

export function isInParty() {
    try {
        if (win.Engine?.party) {
            const members = win.Engine.party.getMembers();
            return !!members && members.size > 0;
        }
        if (win.g?.party) return Object.keys(win.g.party).length > 0;
    } catch {}
    return false;
}

export function isPartyLeader() {
    try {
        const myId = getHeroId();
        if (win.Engine?.party) {
            const members = win.Engine.party.getMembers();
            if (members) for (const [, m] of members) if (m.leader) return m.id === myId;
        }
        if (win.g?.party) {
            for (const [id, m] of Object.entries(win.g.party)) if (m.leader) return +id === myId;
        }
    } catch {}
    return false;
}

/** Członkowie grupy jako [{ id, nick }] (z bohaterem włącznie). */
export function getPartyMembers() {
    try {
        if (win.Engine?.party) {
            const members = win.Engine.party.getMembers();
            return members ? [...members.values()].map(m => ({ id: +m.id, nick: m.nick ?? m.name ?? String(m.id) })) : [];
        }
        if (win.g?.party) return Object.entries(win.g.party).map(([id, m]) => ({ id: +id, nick: m.nick ?? String(id) }));
    } catch {}
    return [];
}

/**
 * Inni gracze na mapie jako [{ id, nick, lvl, relation, clanId }].
 * relation z serwera: '' | 'fr' (przyjaciel) | 'en' (wróg) | 'cl' (klan) | 'cl-fr' (sojusz) | 'cl-en'.
 */
export function getMapPlayers() {
    try {
        const list = win.Engine?.others ? win.Engine.others.check() : win.g?.other;
        return Object.values(list ?? {}).map(o => {
            const d = o?.d ?? o;
            return {
                id: +d.id,
                nick: d.nick,
                lvl: d.lvl,
                relation: d.relation ?? '',
                clanId: d.clan?.id ?? d.clan ?? null,
            };
        }).filter(p => p.id && p.nick);
    } catch {}
    return [];
}

export function inviteToParty(id) {
    sendRequest(`party&a=inv&id=${id}`);
}

export function disbandParty() {
    sendRequest('party&a=disband');
}

export function leaveParty() {
    const id = getHeroId();
    if (id) sendRequest(`party&a=rm&id=${id}`);
}
