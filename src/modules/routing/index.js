import { win } from '../../core/env.js';
// Trasy per id mapy (współrzędne na minimapie 230x230).
import routesDatabase from './routes.json';

const MINIMAP_BASE_SIZE = 230;

const EYE_OPEN_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#c5c4c3" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const EYE_CLOSED_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#c5c4c3" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

/**
 * Baza tras ma kilka historycznych formatów — sprowadzamy je do [{ color, points }].
 */
function normalizeRoutes(data) {
    const first = data?.[0];
    if (!first) return [];
    if (first.routingpath) return first.routingpath;
    if (Array.isArray(first.points)) return data;
    if (first.x !== undefined) return [{ color: first.color || '#ff0000', points: data }];
    if (Array.isArray(first) && first[0]?.x !== undefined) {
        return data.map(sub => ({ color: sub[0].color || '#ff0000', points: sub }));
    }
    return [];
}

function drawRoute(ctx, route, idx, scaleX, scaleY) {
    const points = route?.points;
    if (!points?.length) return;

    const color = route.color || points[0].color || '#ff0000';
    // Kolejne trasy lekko przesunięte, żeby się nie nakrywały.
    const offset = idx === 0 ? 0 : (idx % 2 === 0 ? idx * 1.5 : -idx * 1.5);
    const scale = p => ({ x: p.x * scaleX + offset, y: p.y * scaleY + offset });

    const tracePath = () => {
        const start = scale(points[0]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < points.length; i++) {
            const pt = scale(points[i]);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    tracePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    tracePath();

    const end = scale(points[points.length - 1]);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 2, 0, Math.PI * 2);
    ctx.fill();
}

export default {
    id: 'routing',
    name: 'Routing',
    description: 'Rysuje optymalną trasę na mini mapie do latania ulepy/emek.',

    run() {
        let canvas = null;
        let ctx = null;
        let last = { mapId: null, width: 0, height: 0 };
        let isRouteVisible = true;

        function drawCurrentRoute() {
            if (!ctx || !win.Engine?.map) return;
            const origCanvas = document.querySelector('.handheld-mini-map-canvas');
            if (!origCanvas) return;

            const mapId = win.Engine.map.getId();
            const { width, height } = origCanvas;
            if (mapId === last.mapId && width === last.width && height === last.height) return;
            last = { mapId, width, height };

            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, width, height);
            if (!isRouteVisible) return;

            const scaleX = width / MINIMAP_BASE_SIZE;
            const scaleY = height / MINIMAP_BASE_SIZE;
            normalizeRoutes(routesDatabase[mapId]).forEach((route, idx) => drawRoute(ctx, route, idx, scaleX, scaleY));
        }

        function initDisplay(wrapper) {
            if (document.querySelector('.route-canvas')) return;
            wrapper.style.position = 'relative';

            const origCanvas = wrapper.querySelector('.handheld-mini-map-canvas');
            canvas = document.createElement('canvas');
            canvas.className = 'route-canvas';
            canvas.width = origCanvas ? origCanvas.width : MINIMAP_BASE_SIZE;
            canvas.height = origCanvas ? origCanvas.height : MINIMAP_BASE_SIZE;
            Object.assign(canvas.style, { position: 'absolute', top: '0', left: '0', zIndex: '9998', pointerEvents: 'none' });

            const eyeBtn = document.createElement('div');
            eyeBtn.className = 'route-toggle-eye';
            Object.assign(eyeBtn.style, {
                position: 'absolute', bottom: '0', right: '0', zIndex: '9999', cursor: 'pointer',
                backgroundColor: 'transparent', padding: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            });
            eyeBtn.innerHTML = EYE_OPEN_SVG;
            eyeBtn.addEventListener('click', e => {
                e.stopPropagation();
                isRouteVisible = !isRouteVisible;
                eyeBtn.innerHTML = isRouteVisible ? EYE_OPEN_SVG : EYE_CLOSED_SVG;
                last.mapId = null; // wymuszenie przerysowania
                drawCurrentRoute();
            });

            wrapper.appendChild(canvas);
            wrapper.appendChild(eyeBtn);
            ctx = canvas.getContext('2d');
            last.mapId = null;
        }

        const observer = new MutationObserver(() => {
            const wrapper = document.querySelector('.handheld-mini-map');
            if (wrapper && document.querySelector('.handheld-mini-map-canvas')) {
                initDisplay(wrapper);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        function hookMapUpdate() {
            const map = win.Engine?.map;
            if (!map?.update) return false;
            const originalUpdate = map.update;
            map.update = function (...args) {
                const result = originalUpdate.apply(this, args);
                drawCurrentRoute();
                return result;
            };
            return true;
        }

        if (!hookMapUpdate()) window.addEventListener('load', hookMapUpdate);
    },
};
