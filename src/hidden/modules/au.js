import { win } from '../../core/env.js';
import AU_CODE from '../../../au.js?raw';

export default {
    id: 'au',
    name: 'AU',
    description: 'Auto ucieczka Groli.',

    run() {
        win.eval(AU_CODE);
    },
};
