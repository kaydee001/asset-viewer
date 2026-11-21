// captures demo-video footage from the running app over DevTools, frame by frame (each frame waits for the sharp
// render), as numbered JPEGs, one folder per shot.
// usage: node scripts/capture.mjs <port> <frames-dir> <settings-backup.json> <run> <models-dir>
//   run: boombox (drop, inspector, lighting, sweep, debug views) | showcase (lighting and sweep only) |
//        light (the inspector in the light theme) | montage (the format models) | helmet (anything else: the
//        window as an "Open with" launch opens it, then the hero orbit)
//   CAPTURE_NOGRID=1 turns the app's floor grid off for the cinematic shots (montage, helmet's hero orbit)
// Launch the debug build first: WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port> asset-viewer.exe
// --debug [file to open, for helmet]. Write frames into an empty folder: numbering continues from what is there.
// The user's saved settings are written to the backup file BEFORE anything touches them (if the file does not
// exist yet), and restored from it in `finally`: use a fresh backup file each session, or an old one is restored.
import fs from 'node:fs';
import path from 'node:path';

const [port, outDir, keepFile, run, models] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let page;
for (let i = 0; i < 80 && !page; i++) {
  try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page' && t.url.startsWith('http://tauri.localhost')); } catch {}
  if (!page) await sleep(500);
}
if (!page) { console.log('no page'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = {};
ws.onmessage = e => { const m = JSON.parse(e.data); if (pending[m.id]) pending[m.id](m); };
const send = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async expr => {
  const m = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (m.result?.exceptionDetails) throw new Error(expr.slice(0, 80) + ' -> ' + m.result.exceptionDetails.exception?.description);
  return m.result?.result?.value;
};
await send('Runtime.enable');

// settings backup comes first
if (!fs.existsSync(keepFile)) {
  const current = await ev(`localStorage.getItem("asset-viewer-settings")`);
  fs.writeFileSync(keepFile, JSON.stringify(current));
  console.log('backed up user settings:', current === null ? '(none saved)' : current.length + ' chars');
}
const original = JSON.parse(fs.readFileSync(keepFile, 'utf8'));

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1.5, mobile: false });

let frameNo = 0;
async function shot(scene, settle = 260) {
  await sleep(settle);
  const m = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  const dir = path.join(outDir, scene);
  fs.mkdirSync(dir, { recursive: true });
  const n = fs.readdirSync(dir).length;
  fs.writeFileSync(path.join(dir, String(n).padStart(4, '0') + '.jpg'), Buffer.from(m.result.data, 'base64'));
  frameNo++;
}
const choose = (sel, v) => ev(`(() => { const s = document.getElementById("${sel}"); s.value = "${v}"; s.dispatchEvent(new Event("change", {bubbles: true})); })()`);
const slide = (sel, v) => ev(`(() => { const r = document.getElementById("${sel}"); r.value = ${v}; r.dispatchEvent(new Event("input", {bubbles: true})); })()`);
const click = id => ev(`document.getElementById("${id}").click()`);
const pickPart = name => ev(`(() => { const rows = [...document.querySelectorAll("#parts-list .part")];
  const row = (${JSON.stringify(name)} && rows.find(r => r.querySelector(".part-name").textContent === ${JSON.stringify(name)})) || rows.find(r => !r.classList.contains("group")); row && row.click(); })()`);
const saveView = () => ev(`(() => { const {camera, controls} = window.viewer; const o = camera.position.clone().sub(controls.target);
  window.__base = {t: controls.target.clone(), r: o.length(), yaw: Math.atan2(o.x, o.z), pitch: Math.asin(o.y / o.length())}; })()`);
const view = (yaw, pitch, dist) => ev(`(() => { const {camera, controls} = window.viewer; const b = window.__base;
  const t = b.yaw + ${yaw} * Math.PI / 180, p = b.pitch + ${pitch} * Math.PI / 180, r = b.r * ${dist};
  camera.position.set(b.t.x + r * Math.cos(p) * Math.sin(t), b.t.y + r * Math.sin(p), b.t.z + r * Math.cos(p) * Math.cos(t)); controls.update(); })()`);
// linear in time: the composition does its own easing per shot, and cuts look smoother with constant motion
async function move(scene, n, a, b, perFrame, curve = x => x) {
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : curve(i / (n - 1));
    await view(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
    if (perFrame) await perFrame(i, n);
    await shot(scene);
  }
}
const waitIdle = async () => { await sleep(500); for (let i = 0; i < 80; i++) { if (!(await ev(`document.body.classList.contains("busy") || document.body.classList.contains("opening")`))) break; await sleep(400); } await sleep(1500); };
async function drop(files) {
  const payload = files.map(f => ({ name: path.basename(f), data: fs.readFileSync(f).toString('base64') }));
  await ev(`(() => { const dt = new DataTransfer();
    for (const {name, data} of ${JSON.stringify(payload)}) dt.items.add(new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], name));
    document.body.dispatchEvent(new DragEvent("drop", {dataTransfer: dt, bubbles: true, cancelable: true})); })()`);
  await waitIdle();
}
const hideUI = async () => { await click('hide-btn'); await sleep(3300); };   // the toast that hiding shows is waited out
// the cinematic shots go without the app's floor grid (set CAPTURE_NOGRID=1); interface and debug shots keep it
const NOGRID = process.env.CAPTURE_NOGRID === '1';
const gridOff = async () => { await ev(`(() => { const b = document.getElementById("grid-btn"); if (b.classList.contains("active")) b.click(); })()`); await sleep(400); };

try {
  await ev(`localStorage.removeItem("asset-viewer-settings")`);
  await send('Page.reload');
  await sleep(3500);

  if (run === 'boombox') {
    // the empty app, as it looks before anything is dropped in
    await shot('a-empty', 800);
    await drop([path.join(models, 'BoomBox.glb')]);
    await saveView();
    // a: the window right after the drop, camera pushing in
    await move('a-load', 90, [-35, 4, 1.05], [-5, 7, 0.8]);
    // b: pick the part, the material panel fills in, slow drift
    await pickPart('BoomBox');
    await move('b-inspect', 100, [-5, 7, 0.8], [14, 8, 0.75]);
    // c: lighting presets, interface hidden, each its own short move
    await hideUI();
    const hdris = ['studio_small_09_2k.hdr', 'venice_sunset_2k.hdr', 'photo_studio_loft_hall_2k.hdr', 'empty_warehouse_01_2k.hdr'];
    for (const [i, h] of hdris.entries()) {
      await choose('hdri-select', h); await sleep(1600);
      await move(`c-light${i}`, 40, [20 + i * 25, 6, 0.62], [34 + i * 25, 8, 0.6]);
    }
    // d: the light angle sweeping the reflections round, in the loft
    await choose('hdri-select', 'photo_studio_loft_hall_2k.hdr'); await sleep(1600);
    await move('d-sweep', 70, [30, 6, 0.6], [40, 6, 0.6], (i, n) => slide('sun-range', Math.round(360 * i / (n - 1))));
    await slide('sun-range', 0);
    await choose('hdri-select', 'studio_small_09_2k.hdr'); await sleep(1600);
    // e: the four shading modes along the SAME camera path, so they play in sync side by side
    for (const mode of ['clay', 'normals', 'uv', 'wire']) {
      if (mode === 'wire') { await choose('shading-select', 'shaded'); await click('wireframe-btn'); }
      else await choose('shading-select', mode);
      await sleep(600);
      await move(`e-${mode}`, 70, [-30, 6, 0.7], [0, 9, 0.68]);
    }
    await click('wireframe-btn'); await choose('shading-select', 'shaded');
  } else if (run === 'showcase') {
    // the lighting shots of the 'boombox' run again (same camera paths, same frame counts), without the floor grid
    await drop([path.join(models, 'BoomBox.glb')]);
    await saveView();
    await gridOff();
    await hideUI();
    const hdris = ['studio_small_09_2k.hdr', 'venice_sunset_2k.hdr', 'photo_studio_loft_hall_2k.hdr', 'empty_warehouse_01_2k.hdr'];
    for (const [i, h] of hdris.entries()) {
      await choose('hdri-select', h); await sleep(1600);
      await move(`c-light${i}`, 40, [20 + i * 25, 6, 0.62], [34 + i * 25, 8, 0.6]);
    }
    await choose('hdri-select', 'photo_studio_loft_hall_2k.hdr'); await sleep(1600);
    await move('d-sweep', 70, [30, 6, 0.6], [40, 6, 0.6], (i, n) => slide('sun-range', Math.round(360 * i / (n - 1))));
    await slide('sun-range', 0);
  } else if (run === 'light') {
    // the inspector in the app's light theme, along the same camera path as b-inspect (for a light-theme cut)
    await drop([path.join(models, 'BoomBox.glb')]);
    await saveView();
    await view(-5, 7, 0.8);
    await pickPart('BoomBox');
    await click('theme-btn'); await sleep(900);
    await move('b-inspect-light', 100, [-5, 7, 0.8], [14, 8, 0.75]);
  } else if (run === 'montage') {
    if (NOGRID) await gridOff();
    await hideUI();
    const list = [
      ['Corset', [path.join(models, 'Corset.glb')], 'brown_photostudio_02_2k.hdr'],
      ['Lantern', [path.join(models, 'Lantern.glb')], 'venice_sunset_2k.hdr'],
      ['WaterBottle', [path.join(models, 'WaterBottle.glb')], 'photo_studio_loft_hall_2k.hdr'],
      ['SciFiHelmet', fs.readdirSync(path.join(models, 'SciFiHelmet')).map(f => path.join(models, 'SciFiHelmet', f)), 'empty_warehouse_01_2k.hdr'],
    ];
    for (const [name, files, hdri] of list) {
      await choose('hdri-select', hdri); await sleep(1200);
      await drop(files);
      await saveView();
      await move(`m-${name}`, 90, [-35, 5, 0.8], [15, 8, 0.74]);
    }
  } else {
    // the helmet arrived from the command line ("Open with"): the window as it opens, then the long hero spin
    await waitIdle();
    await saveView();
    await move('f-open', 60, [-15, 2, 1.0], [5, 4, 0.92]);
    await choose('hdri-select', 'photo_studio_loft_hall_2k.hdr'); await sleep(1600);
    if (NOGRID) await gridOff();
    await hideUI();
    await move('g-hero', 330, [-70, 4, 0.8], [170, 2, 0.74]);
  }
  console.log('captured', frameNo, 'frames');
} finally {
  await ev(original === null ? `localStorage.removeItem("asset-viewer-settings")` : `localStorage.setItem("asset-viewer-settings", ${JSON.stringify(original)})`);
  console.log('user settings restored');
}
ws.close();
