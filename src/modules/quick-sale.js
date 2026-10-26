import { injectStyle } from '../core/dom.js';

export default {
    id: 'qucik_salce',
    name: 'Quick Sale',
    description: 'Szybsze opróżnianie toreb u handlarza po naciśnięciu spacji. Przeniesienie przycisku do opróżniania toreb.',

    run() {
        injectStyle(`
            .shop-wrapper .shop-content .shop-balance { bottom: 136px !important }
            .shop-wrapper .shop-content .great-merchamp { top: auto; bottom: 46px; }
        `);

        document.addEventListener('keydown', e => {
            if (e.code !== 'Space') return;
            document.querySelector('.shop-wrapper .great-merchamp .button')?.click();
        });
    },
};
