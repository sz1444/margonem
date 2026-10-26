// Buduje public/hub.js: panel + wszystkie dodatki w jednym pliku, zaciemnione.
// Ładuje go loader public/hub.user.js (eval w kontekście Tampermonkeya).
//   npm run build      → produkcyjny (obfuskacja)
//   npm run build:dev  → bez obfuskacji, czytelny (do debugowania)
import { build } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isDev = process.argv.includes('--dev');

const OBFUSCATOR_OPTIONS = {
    target: 'browser',
    compact: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    transformObjectKeys: true,
    // Bez control-flow flattening / dead code — pętle requestAnimationFrame muszą zostać szybkie.
    controlFlowFlattening: false,
    deadCodeInjection: false,
    // selfDefending psuje się po przepakowaniu kodu przez Tampermonkeya.
    selfDefending: false,
    debugProtection: false,
    disableConsoleOutput: false,
    unicodeEscapeSequence: false,
};

// Duże pliki danych (*.json) nie idą przez obfuscator — zaciemnianie setek KB współrzędnych
// trwa wieki i nic nie daje. W bundlu zostaje placeholder, a dane wstawiamy po obfuskacji.
const jsonData = new Map();
const extractJsonPlugin = {
    name: 'extract-json',
    setup(b) {
        b.onLoad({ filter: /\.json$/ }, async args => {
            const placeholder = `__JSON_DATA_${jsonData.size}__`;
            jsonData.set(placeholder, JSON.stringify(JSON.parse(await readFile(args.path, 'utf8'))));
            return { contents: `export default JSON.parse(${placeholder});`, loader: 'js' };
        });
    },
};

const result = await build({
    entryPoints: [path.join(root, 'src/main.js')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    write: false,
    plugins: [extractJsonPlugin],
});

let code = result.outputFiles[0].text;
if (!isDev) code = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS).getObfuscatedCode();
for (const [placeholder, json] of jsonData) {
    if (!code.includes(placeholder)) throw new Error(`Brak ${placeholder} w bundlu`);
    code = code.replace(placeholder, () => JSON.stringify(json));
}

const outDir = path.join(root, 'public');
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'hub.js'), code);

console.log(`hub.js${isDev ? ' (dev, bez obfuskacji)' : ''} — ${(code.length / 1024).toFixed(0)} KB`);
