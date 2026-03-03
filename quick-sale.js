(function() {
    'use strict';

    const style = document.createElement('style');

    style.innerHTML = `.shop-wrapper .shop-content .shop-balance  { bottom: 136px !important } .shop-wrapper .shop-content .great-merchamp { top: auto; bottom: 46px; }`;

    document.head.appendChild(style);

    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            const shopButton = document.querySelector('.shop-wrapper .great-merchamp .button');

            if (shopButton) shopButton.click();
        }
    });
})();
