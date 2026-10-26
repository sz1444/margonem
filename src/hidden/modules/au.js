import { win } from '../../core/env.js';
// Gotowy, już zaciemniony skrypt AU z katalogu głównego — wstawiany jako tekst, bez ponownej obfuskacji.
import AU_CODE from '../../../au.js?raw';

export default {
    id: 'au',
    name: 'AU',
    description: 'AU Groli.',

    run() {
        // Jak w au.user.js: AU musi działać w oknie strony.
        win.eval(AU_CODE);
    },
};
