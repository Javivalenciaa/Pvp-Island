// Deterministic video capture: virtual clock + manual rAF stepping + per-frame screenshot.
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const fs = require('fs');
const OUT = process.env.OUT || '/tmp/claude-0/pvpf'; const W = +process.env.W || 1280, H = +process.env.H || 720;
const FPS = 10; // render fps (2 sim ticks per render; ffmpeg interpolates to 30)
async function open() {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } }); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.addInitScript(() => {
    try { localStorage.setItem('isla-quality', window.__Q || 'media'); localStorage.setItem('pvp-priv', '1'); } catch (e) {}
    let V = 1000; const q = []; const base = Date.now();
    window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; }; performance.now = () => V; Date.now = () => base + V;
    window.__vstep = (ms) => { V += ms; const run = q.splice(0); for (const cb of run) { try { cb(V); } catch (e) { console.error(e); } } };
  });
  await p.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await p.goto('file:///home/user/pvp-island/client/index.html?offline=1');
  for (let i = 0; i < 400; i++) { await p.evaluate(() => window.__vstep(33)); if (await p.evaluate(() => !!window.__isla && document.body.classList.contains('ready'))) break; await p.waitForTimeout(30); }
  return { b, p };
}
let frame = 0;
async function grab(p, ms) { const d = await p.evaluate((ms) => { window.__isla.sim(.05); window.__vstep(ms); return window.__isla.renderer.domElement.toDataURL('image/jpeg', .93); }, ms); fs.writeFileSync(`${OUT}/${String(frame++).padStart(5, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64')); }
async function run(p, frames, per) { // advance `frames` video frames; per(i) runs before each one
  for (let i = 0; i < frames; i++) { if (per) await per(i, frames); await grab(p, 50); }
}
module.exports = { mark: () => {}, open, run, grab, FPS, OUT, W, H, getFrame: () => frame };
if (require.main === module) (async () => {
  const { b, p } = await open(); const t0 = Date.now();
  await p.evaluate(() => { document.querySelector('#btnPlay').click(); }); await run(p, 3, null); await p.evaluate(() => window.__isla.setPhase(.3));
  await run(p, 6, null); console.log('ms/frame', (Date.now() - t0) / 9, await p.evaluate(() => window.__isla.state)); await b.close();
})();
