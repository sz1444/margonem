// Ukryte dodatki: panel jest publiczny (public/hidden.js), w nim logowanie przez Discord.
// Same dodatki (private/hidden-modules.js) pobieramy dopiero po zalogowaniu.
import { createHubFrame, renderModuleRows, isEnabled } from '../hub/hub.js';
import { injectStyle, waitFor } from '../core/dom.js';
import { isGameReady } from '../core/game.js';
import { ERRORS, consumeAuthResult, redirectToLogin, logout, getSession, fetchModules } from './auth.js';

const GAME_READY_TIMEOUT = 20000;
const STORAGE_PREFIX = 'hidden_';

const CSS = `
    .hidden-auth { margin-bottom: 10px; color: #adadad; font-size: 9px; line-height: 1.4; }
    .hidden-auth-error { color: #e74c3c; margin-bottom: 6px; }
    .hidden-login-btn {
        display: block; width: 100%; padding: 8px; border: none; border-radius: 4px;
        background: #5865F2; color: white; font-size: 10px; font-weight: bold; cursor: pointer;
    }
    .hidden-login-btn:hover { background: #4752c4; }
    .hidden-user { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid #222; padding-bottom: 6px; }
    .hidden-logout { color: #888; cursor: pointer; text-decoration: underline; }
    .hidden-logout:hover { color: #eee; }
`;

async function runModule(module) {
    try {
        await module.run();
    } catch (e) {
        console.error(`❌ Błąd dodatku ${module.name}:`, e);
    }
}

function renderLogin(box, error) {
    box.innerHTML = `
        ${error ? `<div class="hidden-auth-error">${ERRORS[error] || ERRORS.server}</div>` : ''}
        <div style="margin-bottom: 8px">Zaloguj się przez Discord, żeby zobaczyć dodatki.</div>
        <button class="hidden-login-btn">ZALOGUJ PRZEZ DISCORD</button>
    `;
    box.querySelector('.hidden-login-btn').onclick = redirectToLogin;
}

function renderUser(box, session) {
    box.innerHTML = `<div class="hidden-user"><span>Zalogowano: ${session.user?.name ?? '?'}</span><span class="hidden-logout">wyloguj</span></div>`;
    box.querySelector('.hidden-logout').onclick = () => {
        logout();
        location.reload();
    };
}

(async function main() {
    // Najpierw — zanim cokolwiek ruszy adres — zabieramy wynik powrotu z logowania.
    const authResult = consumeAuthResult();

    injectStyle(CSS);
    const { menu } = createHubFrame({ id: 'hiddenHub', title: 'UKRYTE DODATKI', posKey: 'hiddenHubPos' });

    const box = document.createElement('div');
    box.className = 'hidden-auth';
    const rows = document.createElement('div');
    menu.append(box, rows);

    const { session, error } = await getSession();
    if (!session) {
        renderLogin(box, authResult.error || error);
        // Po nieudanym logowaniu od razu pokazujemy powód.
        if (authResult.error) menu.style.display = 'block';
        return;
    }

    renderUser(box, session);
    box.insertAdjacentText('beforeend', 'Ładowanie…');

    const result = await fetchModules(session);
    if (result.error) return renderLogin(box, result.error);

    renderUser(box, session);
    renderModuleRows(rows, result.modules, STORAGE_PREFIX);

    await waitFor(isGameReady, { timeout: GAME_READY_TIMEOUT });
    result.modules.filter(module => isEnabled(module, STORAGE_PREFIX)).forEach(runModule);
})();
