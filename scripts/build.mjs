// Buduje bundle hubów, zaciemnione:
//   public/hub-builds/hub.js     ← /hub.js, loader public/hub.user.js: panel + dodatki
//   public/hub-builds/hub-dev.js ← /hub.js?mode=dev: to samo + dodatki z `dev: true`
//   public/hidden.js            ← loader public/hidden.user.js: panel ukrytych dodatków z logowaniem Discord
//   private/hidden-modules.js   ← same ukryte dodatki, wydawane przez api/hidden/modules.js po zalogowaniu
// Ładowane przez eval w kontekście Tampermonkeya.
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

const TARGETS = [
    // /hub.js i /hub.js?mode=dev — rewrite w vercel.json (pod /hub.js nie może leżeć prawdziwy plik).
    { entry: 'src/main.js', out: 'public/hub-builds/hub.js', define: { __HUB_DEV__: 'false' } },
    { entry: 'src/main.js', out: 'public/hub-builds/hub-dev.js', define: { __HUB_DEV__: 'true' } },
    { entry: 'src/hidden/main.js', out: 'public/hidden.js' },
    // globalName: src/hidden/auth.js odczytuje `hiddenModules.default` po wykonaniu bundla.
    { entry: 'src/hidden/modules/index.js', out: 'private/hidden-modules.js', globalName: 'hiddenModules' },
];

// Duże pliki danych (*.json) nie idą przez obfuscator — zaciemnianie setek KB współrzędnych
// trwa wieki i nic nie daje. W bundlu zostaje placeholder, a dane wstawiamy po obfuskacji.
// Tak samo skrypty importowane jako tekst (import '...?raw', eval w oknie strony) — te zaciemniamy osobno.
function createExtractPlugin(extracted) {
    const placeholder = () => `__EXTRACTED_${extracted.size}__`;
    return {
        name: 'extract-data',
        setup(b) {
            b.onResolve({ filter: /\?raw$/ }, args => ({
                path: path.resolve(args.resolveDir, args.path.slice(0, -'?raw'.length)),
                namespace: 'raw',
            }));
            b.onLoad({ filter: /.*/, namespace: 'raw' }, async args => {
                const key = placeholder();
                const source = await readFile(args.path, 'utf8');
                extracted.set(key, isDev ? source : JavaScriptObfuscator.obfuscate(source, OBFUSCATOR_OPTIONS).getObfuscatedCode());
                return { contents: `export default ${key};`, loader: 'js' };
            });
            b.onLoad({ filter: /\.json$/ }, async args => {
                const key = placeholder();
                extracted.set(key, JSON.stringify(JSON.parse(await readFile(args.path, 'utf8'))));
                return { contents: `export default JSON.parse(${key});`, loader: 'js' };
            });
        },
    };
}

async function buildTarget({ entry, out, globalName, define }) {
    const extracted = new Map();
    const result = await build({
        entryPoints: [path.join(root, entry)],
        bundle: true,
        format: 'iife',
        globalName,
        define,
        target: 'es2020',
        charset: 'utf8',
        legalComments: 'none',
        write: false,
        plugins: [createExtractPlugin(extracted)],
    });

    let code = result.outputFiles[0].text;
    if (!isDev) code = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS).getObfuscatedCode();
    for (const [key, text] of extracted) {
        if (!code.includes(key)) throw new Error(`Brak ${key} w bundlu ${out}`);
        code = code.replace(key, () => JSON.stringify(text));
    }

    const outPath = path.join(root, out);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, code);

    console.log(`${out}${isDev ? ' (dev, bez obfuskacji)' : ''} — ${(code.length / 1024).toFixed(0)} KB`);
}

for (const target of TARGETS) await buildTarget(target);
