import modules from './modules/index.js';
import { renderHub, isEnabled } from './hub/hub.js';
import { reportUnknownUser } from './hub/telemetry.js';
import { waitFor } from './core/dom.js';
import { isGameReady } from './core/game.js';

const GAME_READY_TIMEOUT = 20000;

async function runModule(module) {
    try {
        await module.run();
    } catch (e) {
        console.error(`❌ Błąd dodatku ${module.name}:`, e);
    }
}

(async function main() {
    reportUnknownUser();
    renderHub(modules);

    await waitFor(isGameReady, { timeout: GAME_READY_TIMEOUT });
    modules.filter(isEnabled).forEach(runModule);
})();
