import { isInBattle, isInParty, isPartyLeader, disbandParty, leaveParty } from '../core/game.js';

const WIDGET_ID = 'abg-widget';

const STYLE_OFF = {
    background: 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
    color: '#ccc',
    borderColor: '#111',
    dot: '#444',
    dotShadow: '',
};

const STYLE_ON = {
    background: 'linear-gradient(180deg, #7a1a1a 0%, #4a0e0e 100%)',
    boxShadow: '0 2px 8px rgba(180,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
    color: '#fff',
    borderColor: '#8b0000',
    dot: '#e74c3c',
    dotShadow: '0 0 5px #e74c3c',
};

function getAutoFightBtn() {
    return document.querySelector('.battle-window .auto-fight-btn') || document.querySelector('.auto-fight-btn');
}

export default {
    id: 'auto-break-group',
    name: 'Auto Break Group',
    description: 'Automatycznie rozwiązuje lub opuszcza grupę natychmiast po zakończeniu walki (jeśli opcja była włączona w trakcie walki).',

    run() {
        let autoAction = false;
        let widgetEl = null;
        let inBattle = false;

        function doAction() {
            if (isPartyLeader()) disbandParty();
            else leaveParty();
        }

        function injectWidget() {
            if (widgetEl) return;
            const autoFightBtn = getAutoFightBtn();
            if (!autoFightBtn || !isInParty()) return;

            const label = (isPartyLeader() ? 'Rozwiąż grupę' : 'Opuść grupę') + ' po walce';

            const btn = document.createElement('div');
            btn.id = WIDGET_ID;
            Object.assign(btn.style, {
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0 12px',
                height: '36px',
                borderRadius: '6px',
                cursor: 'pointer',
                userSelect: 'none',
                fontFamily: 'inherit',
                fontSize: '10px',
                fontWeight: '300',
                letterSpacing: '0.4px',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s, box-shadow 0.15s',
                border: '1px solid #111',
                zIndex: '9999',
            });
            btn.innerHTML = `
                <span class="abg-label">${label}</span>
                <span class="abg-dot" style="
                    display:inline-block;width:6px;height:6px;border-radius:50%;
                    border:1px solid #333;
                    transition:background 0.15s,box-shadow 0.15s;
                    flex-shrink:0;
                "></span>
            `;
            const dot = btn.querySelector('.abg-dot');

            function updateBtn() {
                const s = autoAction ? STYLE_ON : STYLE_OFF;
                btn.style.background = s.background;
                btn.style.boxShadow = s.boxShadow;
                btn.style.color = s.color;
                btn.style.borderColor = s.borderColor;
                dot.style.background = s.dot;
                dot.style.boxShadow = s.dotShadow;
            }

            btn.addEventListener('mouseenter', () => {
                if (!autoAction) btn.style.background = 'linear-gradient(180deg, #484848 0%, #2a2a2a 100%)';
            });
            btn.addEventListener('mouseleave', updateBtn);
            btn.addEventListener('mouseup', () => {
                autoAction = !autoAction;
                updateBtn();
            });

            (document.querySelector('.battle-window') || autoFightBtn.parentElement).appendChild(btn);
            widgetEl = btn;
            updateBtn();
        }

        function removeWidget() {
            widgetEl?.remove();
            widgetEl = null;
        }

        function checkState() {
            const nowInBattle = isInBattle();
            if (nowInBattle && !inBattle) {
                inBattle = true;
                autoAction = false;
                removeWidget();
            } else if (!nowInBattle && inBattle) {
                inBattle = false;
                if (autoAction) doAction();
                autoAction = false;
                removeWidget();
                return;
            }
            if (nowInBattle && !widgetEl) injectWidget();
        }

        const observeRoot = document.querySelector('#game, #engine') || document.body;
        new MutationObserver(checkState).observe(observeRoot, { childList: true, subtree: true });
        checkState();
    },
};
