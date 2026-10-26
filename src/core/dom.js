export function injectStyle(css, id) {
    if (id && document.getElementById(id)) return null;
    const style = document.createElement('style');
    if (id) style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    return style;
}

/** Odpytuje `check` co `interval` ms, aż zwróci truthy (lub minie `timeout`, wtedy null). */
export function waitFor(check, { interval = 200, timeout = 0 } = {}) {
    return new Promise(resolve => {
        const started = Date.now();
        const poll = () => {
            let result;
            try { result = check(); } catch {}
            if (result) return resolve(result);
            if (timeout && Date.now() - started >= timeout) return resolve(null);
            setTimeout(poll, interval);
        };
        poll();
    });
}

export function isTypingTarget(target) {
    if (!target) return false;
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/** Przewijanie kółkiem wewnątrz panelu bez przewijania/zoomu gry pod spodem. */
export function isolateWheel(el) {
    el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}
