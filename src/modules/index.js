// `dev: true` w dodatku = widoczny tylko w /hub.js?mode=dev.
// Kolejność = kolejność w panelu. `id` to klucz zapisu włączenia (localStorage "hub_<id>") — nie zmieniać.
import quickSale from './quick-sale.js';
import gamePad from './game-pad.js';
import stoneTimers from './stone-timers.js';
import eventHelper from './event-helper.js';
import tytanHelper from './tytan-helper.js';
import umGuard from './um-guard.js';
import stoneCooldown from './stone-cooldown.js';
import fastBreakGroup from './fast-break-group.js';
import autoBreakGroup from './auto-break-group.js';
import routing from './routing/index.js';
import moreDopamine from './more-dopamine.js';
import pinnedTimer from './pinned-timer.js';
import onlineList from './online-list.js';
import fleeGuard from './flee-guard.js';
import classicPartyUi from './classic-party-ui.js';
import partyQuickInvite from './party-quick-invite.js';

export default [
    quickSale,
    gamePad,
    stoneTimers,
    eventHelper,
    tytanHelper,
    umGuard,
    stoneCooldown,
    fastBreakGroup,
    autoBreakGroup,
    routing,
    moreDopamine,
    pinnedTimer,
    onlineList,
    fleeGuard,
    classicPartyUi,
    partyQuickInvite,
];
