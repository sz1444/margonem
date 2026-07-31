(function () {
    'use strict';

    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const RARITY_ORDER = {
        'legendary': 1, 'heroic': 2, 'upgraded': 3,
        'unique': 4, 'heroic-unique': 4, 'common': 5, 'trash': 6
    };

    let sort1Type = 'type';
    let sort1Dir = 'asc';
    let sort2Type = 'rarity';
    let sort2Dir = 'asc';

    const style = document.createElement('style');
    style.innerHTML = `
        .depo .filter-section { flex-wrap: wrap !important; }
        #custom-depo-sort { display: flex; align-items: center; gap: 4px; margin-right: 3px; position: relative; }
        #custom-depo-sort .menu-wrapper { position: relative !important; }
        #custom-depo-sort .menu.sort-menu { width: 105px; position: relative; cursor: pointer; }

        /* Strzałka selektów z grafiki buttony.png */
        #custom-depo-sort .menu.sort-menu .bck {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 0 6px !important;
            box-sizing: border-box !important;
        }
        #custom-depo-sort .menu.sort-menu .bck::after {
            content: '';
            display: inline-block;
            width: 18px;
            height: 12px;
            background: url(../img/gui/buttony.png?v=1785244275300) no-repeat -848px -106px;
            margin-left: 2px;
            flex-shrink: 0;
        }
        #custom-depo-sort .menu.sort-menu.open .bck::after {
            transform: rotate(180deg);
        }

        #custom-depo-sort .custom-dropdown {
            position: absolute !important;
            top: 24px !important;
            left: 0 !important;
            z-index: 999999 !important;
            width: 105px !important;
            background: #403b3d;
            border: 1px solid #3c5d2e;
            border-radius: 3px;
            box-sizing: border-box;
            padding: 2px;
        }

        #custom-depo-sort .custom-dropdown .opt-item {
            cursor: pointer;
            padding: 2px 4px;
            color: #ffffff;
            font-size: 11px;
            text-align: center;
            font-weight: bold;
            background: #244518;
            border: 1px solid #396420;
            border-radius: 2px;
            margin-bottom: 2px;
            box-sizing: border-box;
        }

        #custom-depo-sort .custom-dropdown .opt-item:last-child {
            margin-bottom: 0;
        }

        #custom-depo-sort .custom-dropdown .opt-item:hover {
            background: #355f27;
            border-color: #639c4a;
            color: #ffffff;
        }

        /* Przycisk kierunku ze sprajtem */
        #custom-depo-sort .sort-dir-btn {
            min-width: 24px !important;
            width: 24px !important;
            padding: 0 !important;
            text-align: center;
            cursor: pointer;
        }
        #custom-depo-sort .sort-dir-btn .label {
            padding: 0 !important;
            width: 100%;
            height: 100%;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        #custom-depo-sort .sort-dir-btn .dir-icon {
            display: inline-block;
            width: 18px;
            height: 12px;
            background: url(../img/gui/buttony.png?v=1785244275300) no-repeat -848px -106px;
            transform: rotate(180deg);
        }
        #custom-depo-sort .sort-dir-btn.desc .dir-icon {
            transform: rotate(0deg);
        }

        #sort-label { color: #d4c4a8; font-size: 11px; font-weight: bold; margin-left: 4px; }
    `;
    document.head.appendChild(style);

    const htmlToInject = `
    <div class="depo-filter" id="custom-depo-sort">
        <span id="sort-label">Sortuj:</span>
        <div class="menu-wrapper">
            <div class="menu sort-menu menu-list" id="sort1-toggle">
                <div class="bck button small green no-hover">
                    <span class="menu-option" id="sort1-text" value="0">Brak</span>
                </div>
                <div class="custom-dropdown" id="sort1-list" style="display: none;">
                    <div class="opt-item s1-opt" value="0">Brak</div>
                    <div class="opt-item s1-opt" value="type">Typ</div>
                    <div class="opt-item s1-opt" value="rarity">Rzadkość</div>
                    <div class="opt-item s1-opt" value="price">Cena</div>
                    <div class="opt-item s1-opt" value="name">Nazwa</div>
                </div>
            </div>
        </div>
        <div class="button small green sort-dir-btn" id="sort1-dir-toggle">
            <div class="background"></div>
            <div class="label"><span class="dir-icon"></span></div>
        </div>

        <div class="menu-wrapper">
            <div class="menu sort-menu menu-list" id="sort2-toggle">
                <div class="bck button small green no-hover">
                    <span class="menu-option" id="sort2-text" value="0">Brak</span>
                </div>
                <div class="custom-dropdown" id="sort2-list" style="display: none;">
                    <div class="opt-item s2-opt" value="0">Brak</div>
                    <div class="opt-item s2-opt" value="type">Typ</div>
                    <div class="opt-item s2-opt" value="rarity">Rzadkość</div>
                    <div class="opt-item s2-opt" value="price">Cena</div>
                    <div class="opt-item s2-opt" value="name">Nazwa</div>
                </div>
            </div>
        </div>
        <div class="button small green sort-dir-btn" id="sort2-dir-toggle">
            <div class="background"></div>
            <div class="label"><span class="dir-icon"></span></div>
        </div>
        <div class="back"></div>
    </div>`;

    const getStatValue = (item, key) => {
        if (item[key] !== undefined && item[key] !== null) return item[key];
        if (item._cachedStats?.[key] !== undefined) return item._cachedStats[key];
        if (typeof item.stat === 'string') {
            const match = item.stat.split(';').find(s => s.startsWith(key + '='));
            if (match) return match.split('=')[1];
        }
        return null;
    };

    const getItemName = (item) => (item.name || item.itemData?.name || '').toString();

    const getItemEl = (item) => {
        if (item.$el && item.$el[0]) return item.$el[0];
        if (item.$el && item.$el.nodeType) return item.$el;
        if (item.el) return item.el;
        return document.querySelector(`.item-id-${item.id}, [data-id="${item.id}"], #item-${item.id}`);
    };

    const compareSingle = (a, b, criteria) => {
        const nameA = getItemName(a);
        const nameB = getItemName(b);

        if (criteria === 'type') {
            const cA = parseInt(a.cl ?? a.itemData?.cl ?? getStatValue(a, 'cl') ?? 0, 10);
            const cB = parseInt(b.cl ?? b.itemData?.cl ?? getStatValue(b, 'cl') ?? 0, 10);
            if (cA !== cB) return cA - cB;
        } else if (criteria === 'rarity' || criteria === 'rank') {
            const rarityA = getStatValue(a, 'rarity') || a.itemTypeName;
            const rarityB = getStatValue(b, 'rarity') || b.itemTypeName;
            const rA = RARITY_ORDER[rarityA] || 5;
            const rB = RARITY_ORDER[rarityB] || 5;
            if (rA !== rB) return rA - rB;
        } else if (criteria === 'price') {
            const rawA = getStatValue(a, 'pr');
            const rawB = getStatValue(b, 'pr');
            const pA = rawA !== null ? parseInt(rawA, 10) : 0;
            const pB = rawB !== null ? parseInt(rawB, 10) : 0;
            if (pA !== pB) return pB - pA;
        } else if (criteria === 'name') {
            const nameCmp = nameA.localeCompare(nameB);
            if (nameCmp !== 0) return nameCmp;
        }
        return 0;
    };

    function sortDepotVisual() {
        const Engine = win.Engine;
        if (!Engine?.depo) return;

        const COLS = 14;
        const itemTable = Engine.depo.getDepoItemTable ? Engine.depo.getDepoItemTable() : null;
        if (!itemTable) return;

        const tabs = {};

        Object.entries(itemTable).forEach(([colKey, colData]) => {
            const x = parseInt(colKey, 10);
            if (!colData) return;
            const tabIndex = Math.floor(x / COLS);
            if (!tabs[tabIndex]) tabs[tabIndex] = [];

            Object.entries(colData).forEach(([rowKey, slot]) => {
                const y = parseInt(rowKey, 10);
                if (!slot) return;
                const id = Object.keys(slot)[0];
                const itemObj = slot[id];
                if (itemObj) {
                    const data = itemObj.itemData || itemObj;
                    tabs[tabIndex].push({ id, x, y, ...data, rawObj: itemObj });
                }
            });
        });

        Object.values(tabs).flat().forEach(item => {
            const el = getItemEl(item);
            if (!el) return;

            if (!el.dataset.origLeft) {
                el.dataset.origLeft = parseFloat(el.style.left || getComputedStyle(el).left);
                el.dataset.origTop = parseFloat(el.style.top || getComputedStyle(el).top);
            }
        });

        if (sort1Type === '0' && sort2Type === '0') {
            Object.values(tabs).flat().forEach(item => {
                const el = getItemEl(item);
                if (el && el.dataset.origLeft !== undefined) {
                    el.style.left = el.dataset.origLeft + 'px';
                    el.style.top = el.dataset.origTop + 'px';
                }
            });
            return;
        }

        const slotMap = {};
        Object.values(tabs).flat().forEach(item => {
            const el = getItemEl(item);
            if (!el) return;
            slotMap[`${item.x}_${item.y}`] = {
                left: parseFloat(el.dataset.origLeft),
                top: parseFloat(el.dataset.origTop)
            };
        });

        const colPositions = {};
        const rowPositions = {};
        Object.entries(slotMap).forEach(([coords, pos]) => {
            const [cx, cy] = coords.split('_').map(Number);
            if (colPositions[cx] === undefined) colPositions[cx] = pos.left;
            if (rowPositions[cy] === undefined) rowPositions[cy] = pos.top;
        });

        const getTargetPos = (absX, absY) => {
            if (slotMap[`${absX}_${absY}`]) {
                return { left: slotMap[`${absX}_${absY}`].left + 'px', top: slotMap[`${absX}_${absY}`].top + 'px' };
            }
            const refX = Object.keys(colPositions)[0] ? Number(Object.keys(colPositions)[0]) : 0;
            const refY = Object.keys(rowPositions)[0] ? Number(Object.keys(rowPositions)[0]) : 0;
            const baseL = colPositions[refX] ?? 0;
            const baseT = rowPositions[refY] ?? 0;

            const l = colPositions[absX] ?? (baseL + (absX - refX) * 32);
            const t = rowPositions[absY] ?? (baseT + (absY - refY) * 32);
            return { left: l + 'px', top: t + 'px' };
        };

        Object.entries(tabs).forEach(([tabIdxStr, items]) => {
            const tabIdx = parseInt(tabIdxStr, 10);
            const startX = tabIdx * COLS;

            items.sort((a, b) => {
                let comp = 0;
                if (sort1Type !== '0') {
                    comp = compareSingle(a, b, sort1Type);
                    if (sort1Dir === 'desc') comp = -comp;
                }
                if (comp === 0 && sort2Type !== '0') {
                    comp = compareSingle(a, b, sort2Type);
                    if (sort2Dir === 'desc') comp = -comp;
                }
                if (comp === 0) {
                    const nameA = getItemName(a);
                    const nameB = getItemName(b);
                    comp = nameA.localeCompare(nameB);
                }
                return comp;
            });

            items.forEach((item, index) => {
                const targetX = startX + (index % COLS);
                const targetY = Math.floor(index / COLS);
                const pos = getTargetPos(targetX, targetY);
                const el = getItemEl(item);

                if (el) {
                    el.style.left = pos.left;
                    el.style.top = pos.top;
                }
            });
        });
    }

    function initEvents() {
        const setupDropdown = (toggleId, listId, textId, optClass, callback) => {
            const toggle = document.getElementById(toggleId);
            const list = document.getElementById(listId);
            const text = document.getElementById(textId);
            const options = document.querySelectorAll('.' + optClass);

            if (!toggle || !list) return;

            toggle.addEventListener('click', (e) => {
                const isHidden = list.style.display === 'none';
                document.querySelectorAll('#custom-depo-sort .custom-dropdown').forEach(m => m.style.display = 'none');
                document.querySelectorAll('#custom-depo-sort .sort-menu').forEach(m => m.classList.remove('open'));

                if (isHidden) {
                    list.style.display = 'block';
                    toggle.classList.add('open');
                }
                e.stopPropagation();
            });

            options.forEach(opt => {
                opt.addEventListener('click', (e) => {
                    const val = opt.getAttribute('value');
                    text.innerText = opt.innerText;
                    text.setAttribute('value', val);
                    list.style.display = 'none';
                    toggle.classList.remove('open');
                    e.stopPropagation();
                    callback(val);
                });
            });
        };

        setupDropdown('sort1-toggle', 'sort1-list', 'sort1-text', 's1-opt', (val) => {
            sort1Type = val;
            sortDepotVisual();
        });
        setupDropdown('sort2-toggle', 'sort2-list', 'sort2-text', 's2-opt', (val) => {
            sort2Type = val;
            sortDepotVisual();
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('#custom-depo-sort .custom-dropdown').forEach(m => m.style.display = 'none');
            document.querySelectorAll('#custom-depo-sort .sort-menu').forEach(m => m.classList.remove('open'));
        });

        const dir1Btn = document.getElementById('sort1-dir-toggle');
        if (dir1Btn) {
            dir1Btn.addEventListener('click', (e) => {
                sort1Dir = sort1Dir === 'asc' ? 'desc' : 'asc';
                dir1Btn.classList.toggle('desc', sort1Dir === 'desc');
                sortDepotVisual();
                e.stopPropagation();
            });
        }

        const dir2Btn = document.getElementById('sort2-dir-toggle');
        if (dir2Btn) {
            dir2Btn.addEventListener('click', (e) => {
                sort2Dir = sort2Dir === 'asc' ? 'desc' : 'asc';
                dir2Btn.classList.toggle('desc', sort2Dir === 'desc');
                sortDepotVisual();
                e.stopPropagation();
            });
        }
    }

    function injectSort() {
        const filterSection = document.querySelector('.filter-section');
        if (filterSection && !document.getElementById('custom-depo-sort')) {
            filterSection.insertAdjacentHTML('beforeend', htmlToInject);
            initEvents();
        }
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector('.filter-section')) {
            injectSort();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
