// Okno strony (a nie sandbox Tampermonkeya) — tu żyją Engine, _g, lootlogGameClientApi itd.
export const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

export function gmRequest(options) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            ...options,
            onload: resolve,
            onerror: reject,
            ontimeout: reject,
        });
    });
}
