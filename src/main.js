import allModules from './modules/index.js';
import { renderHub, isEnabled } from './hub/hub.js';
import { reportUnknownUser } from './hub/telemetry.js';
import { waitFor } from './core/dom.js';
import { isGameReady } from './core/game.js';

const GAME_READY_TIMEOUT = 20000;

// __HUB_DEV__ wstawia build: true w bundlu serwowanym pod /hub.js?mode=dev.
// Dodatki z `dev: true` są tylko tam.
const modules = allModules.filter(module => !module.dev || __HUB_DEV__);

async function runModule(module) {
    try {
        await module.run();
    } catch (e) {
        console.error(`❌ Błąd dodatku ${module.name}:`, e);
    }
}

(async function main() {
    reportUnknownUser();
    renderHub(modules, { modal: __HUB_DEV__ });

    await waitFor(isGameReady, { timeout: GAME_READY_TIMEOUT });
    modules.filter(module => isEnabled(module)).forEach(runModule);
})();
