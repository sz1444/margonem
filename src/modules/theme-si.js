import { win } from '../core/env.js';
import THEME_CODE from '../../public/modern-ui.user.js?raw';

export default {
    id: 'theme-si',
    name: 'Thema SI (beta)',
    description: 'Motyw w stylu SI',

    run() {
        win.eval(THEME_CODE);
    },
};
