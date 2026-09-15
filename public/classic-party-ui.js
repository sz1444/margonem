(function() {
    'use strict';

    const css = `
        .party__list .party-member .table-wrapper .avatar {
            display: none !important;
        }

        .party__list .party-member .table-wrapper {
            padding: 3px 5px !important;
        }

        .party__list .party-member .table-wrapper .info-wrapper {
            flex-direction: row;
            justify-content: space-between;
        }

        .party__list .i-gateway {
            display: none !important;
        }

        .party-window .party__list .party-member .member-hp-bar {
            width: 60px;
            left: auto;
            right: 8px;
            height: 12px;
            top: 5px;
            background-color: #2e2f31 !important;
            box-shadow: inset 0 0 10px #00000087;
            border-radius: 3px;
            position: absolute;
        }

        .party-window .party__list .party-member .member-hp-bar[bar-horizontal="true"]::after {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: calc(attr(bar-percent type(<number>), 0) * 1%);
            background: #c32922;
            border-radius: 2px;
            box-shadow: inset 0 0 8px #0000005e;
        }

        .party__list .party-member .table-wrapper .bottom-row {
            flex-direction: row-reverse;
            gap: 2px;
        }

        .party__list .party-member .table-wrapper .bottom-row .hp-percent {
            width: 60px;
            text-align: center;
            margin-left: 2px;
        }

.party__list .party-member .table-wrapper .bottom-row .hp-points{
display: none !important;
}
    `;

    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
})();
