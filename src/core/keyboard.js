export const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta'];

/** { key, ctrl, alt, shift } → "Ctrl+Shift+X" */
export function keyLabel(binding) {
    if (!binding) return 'brak';
    const parts = [];
    if (binding.ctrl) parts.push('Ctrl');
    if (binding.alt) parts.push('Alt');
    if (binding.shift) parts.push('Shift');
    parts.push(binding.key === ' ' ? 'Space' : binding.key);
    return parts.join('+');
}

export function matchesBinding(e, binding) {
    if (!binding) return false;
    return e.key === binding.key &&
        !!e.ctrlKey === !!binding.ctrl &&
        !!e.altKey === !!binding.alt &&
        !!e.shiftKey === !!binding.shift;
}

/**
 * Przechwytuje następne naciśnięcie (bez samych modyfikatorów) i oddaje event do `onKey`.
 * Zwraca funkcję anulującą nasłuch.
 */
export function captureNextKey(onKey) {
    const listener = e => {
        if (MODIFIER_KEYS.includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        cancel();
        onKey(e);
    };
    const cancel = () => window.removeEventListener('keydown', listener, true);
    window.addEventListener('keydown', listener, true);
    return cancel;
}
