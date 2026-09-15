(function() {
    'use strict';

    const css = `
        .party__list .party-member .table-wrapper .avatar {
        display: none;
        }

        .party__list .party-member .table-wrapper{
        padding:3px 5px !important;}

        .party__list .party-member .table-wrapper .info-wrapper {
        flex-direction: row;
        justify-content: space-between;
        }
  .party__list .i-gateway {
        display: none !important;
        }

        .party-window .party__list .party-member .member-hp-bar {
         display: none !important;
        }

 .party__list .party-member .table-wrapper .bottom-row {

    flex-direction: row-reverse;
    gap: 2px;
}
.party__list .party-member .table-wrapper .bottom-row .hp-percent {
width: 32px;
text-align: right;
    margin-left: 2px;
}
    `;

    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
})();
