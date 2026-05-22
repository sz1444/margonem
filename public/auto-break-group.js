(function () {
    'use strict';

    const INJECT_ID = 'abg-widget';
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    function sendRequest(url) {
        if (typeof win._g === 'function') win._g(url);
        else if (win.Engine && typeof win.Engine.sendRequest === 'function') win.Engine.sendRequest(url);
    }

    function getMyId() {
        if (win.Engine && win.Engine.hero && win.Engine.hero.d) return win.Engine.hero.d.id;
        if (win.hero) return win.hero.id;
        if (win.g && win.g.hero) return win.g.hero.id;
        return null;
    }

    function isPartyLeader() {
        try {
            if (win.Engine && win.Engine.party) {
                const members = win.Engine.party.getMembers();
                if (members) for (const [, m] of members) if (m.leader) return m.id === getMyId();
            }
            if (win.g && win.g.party) {
                const myId = getMyId();
                for (const [id, m] of Object.entries(win.g.party)) if (m.leader) return +id === myId;
            }
        } catch {}
        return false;
    }

    function isInParty() {
        try {
            if (win.Engine && win.Engine.party) {
                const members = win.Engine.party.getMembers();
                return members && members.size > 0;
            }
            if (win.g && win.g.party) return Object.keys(win.g.party).length > 0;
        } catch {}
        return false;
    }

    function doAction() {
        if (isPartyLeader()) sendRequest('party&a=disband');
        else { const id = getMyId(); if (id) sendRequest(`party&a=rm&id=${id}`); }
    }

    // --- widget ---

    let autoAction = false;
    let widgetEl = null;

    function getAutoFightBtn() {
        return document.querySelector('.battle-window .auto-fight-btn')
            || document.querySelector('.auto-fight-btn');
    }

    function injectWidget() {
        if (widgetEl) return;

        const autoFightBtn = getAutoFightBtn();
        if (!autoFightBtn) return;
        if (!isInParty()) return;

        const label = (isPartyLeader() ? 'Rozwiąż grupę' : 'Opuść grupę') + ' po walce';

        const btn = document.createElement('div');
        btn.id = INJECT_ID;

        Object.assign(btn.style, {
            position: 'absolute',
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
            background: 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)',
            color: '#ccc',
            boxShadow: '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
            border: '1px solid #111',
            zIndex: '9999',
        });

        btn.innerHTML = `
            <span class="abg-label">${label}</span>
            <span class="abg-dot" style="
                display:inline-block;width:6px;height:6px;border-radius:50%;
                background:#444;border:1px solid #333;
                transition:background 0.15s,box-shadow 0.15s;
                flex-shrink:0;
            "></span>
        `;

        function updateBtn() {
            const dot = btn.querySelector('.abg-dot');
            if (autoAction) {
                btn.style.background  = 'linear-gradient(180deg, #7a1a1a 0%, #4a0e0e 100%)';
                btn.style.boxShadow   = '0 2px 8px rgba(180,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)';
                btn.style.color       = '#fff';
                btn.style.borderColor = '#8b0000';
                dot.style.background  = '#e74c3c';
                dot.style.boxShadow   = '0 0 5px #e74c3c';
            } else {
                btn.style.background  = 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)';
                btn.style.boxShadow   = '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)';
                btn.style.color       = '#ccc';
                btn.style.borderColor = '#111';
                dot.style.background  = '#444';
                dot.style.boxShadow   = '';
            }
        }

        btn.addEventListener('mouseenter', () => {
            if (!autoAction) btn.style.background = 'linear-gradient(180deg, #484848 0%, #2a2a2a 100%)';
        });
        btn.addEventListener('mouseleave', () => updateBtn());

        btn.addEventListener('mouseup', () => {
            autoAction = !autoAction;
            updateBtn();
        });

        const parent = document.querySelector('.battle-window') || autoFightBtn.parentElement;

        btn.style.bottom = '8px';
        btn.style.right  = '8px';
        btn.style.left   = '';
        btn.style.top    = '';

        parent.appendChild(btn);
        widgetEl = btn;
        updateBtn();
    }

    function removeWidget() {
        if (widgetEl) { widgetEl.remove(); widgetEl = null; }
    }

    function isInBattle() {
        if (win.Engine && win.Engine.lock) return win.Engine.lock.check('battle');
        if (win.g && win.g.battle) return Object.keys(win.g.battle).length > 0;
        return !!document.querySelector('.battle-window, #battle');
    }

    function onBattleStart() {
        autoAction = false;
        removeWidget();
    }

    function onBattleEnd() {
        if (autoAction) doAction();
        removeWidget();
        autoAction = false;
    }

    let inBattle = false;

    function checkState() {
        const nowInBattle = isInBattle();
        if (nowInBattle && !inBattle) { inBattle = true; onBattleStart(); }
        else if (!nowInBattle && inBattle) { inBattle = false; onBattleEnd(); return; }
        if (nowInBattle && !widgetEl) injectWidget();
    }

    const observeRoot = document.querySelector('#game, #engine') || document.body;
    new MutationObserver(checkState).observe(observeRoot, { childList: true, subtree: true });
    checkState();
})();
