// Composición final de la portada: fondo 3D + logo enorme, bomba con mecha, bocadillo "BRO?!" y flecha. Uso: node promo/key_art_overlay.js <bg.png> <salida.png> <ancho> <alto> <wide|tall|square>
const { chromium } = require('/opt/node-tools/node_modules/playwright'); const fs = require('fs');
const [bg, out, W, H, kind] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5], process.argv[6] || 'wide'];
const img = 'data:image/png;base64,' + fs.readFileSync(bg).toString('base64');
const L = { // posiciones relativas por formato
  wide:   { logo: { x: .03, y: .035, w: .5 }, bomb: { x: .045, y: .60, w: .2 }, bubble: { x: .60, y: .08, w: .31 }, sub: { x: .03, y: .245 }, arrow: { x: .66, y: .30, w: .14, r: 25 } },
  tall:   { logo: { x: .05, y: .03, w: .9 }, bomb: { x: .04, y: .70, w: .36 }, bubble: { x: .52, y: .39, w: .44 }, sub: { x: .05, y: .215 }, arrow: { x: .56, y: .58, w: .22, r: 25 } },
  square: { logo: { x: .04, y: .03, w: .8 }, bomb: { x: .035, y: .66, w: .3 }, bubble: { x: .56, y: .30, w: .4 }, sub: { x: .04, y: .235 }, arrow: { x: .62, y: .48, w: .2, r: 25 } },
}[kind];
const html = `<!doctype html><meta charset=utf-8><style>
*{margin:0;box-sizing:border-box}body{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:#000 url(${img}) center/cover;font-family:Impact,'Arial Black','Anton',sans-serif}
.abs{position:absolute}
.vig{inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(20,5,0,.55) 100%)}
.logo{left:${L.logo.x * W}px;top:${L.logo.y * H}px;width:${L.logo.w * W}px;transform:rotate(-3deg);line-height:.86;letter-spacing:.01em}
.logo .a{display:block;font-size:${L.logo.w * W * .3}px;color:#fff;-webkit-text-stroke:${W * .008}px #1a0a00;paint-order:stroke fill;text-shadow:${W * .006}px ${W * .008}px 0 #1a0a00,0 0 ${W * .03}px rgba(255,120,0,.55)}
.logo .b{display:block;font-size:${L.logo.w * W * .3}px;color:#ffd21f;-webkit-text-stroke:${W * .008}px #1a0a00;paint-order:stroke fill;text-shadow:${W * .006}px ${W * .008}px 0 #8a1c00,${W * .012}px ${W * .016}px 0 #1a0a00,0 0 ${W * .03}px rgba(255,140,0,.6)}
.sub{left:${L.sub.x * W}px;top:${L.sub.y * H}px;font-size:${W * (kind === 'wide' ? .028 : .04)}px;color:#fff;background:#d9221c;padding:${W * .006}px ${W * .016}px;transform:rotate(-2deg);border:${W * .004}px solid #1a0a00;box-shadow:${W * .005}px ${W * .006}px 0 #1a0a00;letter-spacing:.04em}
.bubble{left:${L.bubble.x * W}px;top:${L.bubble.y * H}px;width:${L.bubble.w * W}px;transform:rotate(4deg)}
.bubble .t{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-size:${L.bubble.w * W * .27}px;color:#1a0a00;line-height:.9;padding-bottom:8%}
.bomb{left:${L.bomb.x * W}px;top:${L.bomb.y * H}px;width:${L.bomb.w * W}px;transform:rotate(-12deg);filter:drop-shadow(${W * .006}px ${W * .01}px 0 rgba(0,0,0,.55))}
.arrow{left:${L.arrow.x * W}px;top:${L.arrow.y * H}px;width:${L.arrow.w * W}px;transform:rotate(${L.arrow.r}deg);filter:drop-shadow(${W * .004}px ${W * .006}px 0 #1a0a00)}
</style>
<div class="abs vig"></div>
<div class="abs logo"><span class="a">PvP</span><span class="b">ISLAND</span></div>
<div class="abs sub">BUILD · RAID · REPEAT</div>
<svg class="abs arrow" viewBox="0 0 120 120"><path d="M10 20 C 40 6, 90 30, 92 88" fill="none" stroke="#ff2a1f" stroke-width="13" stroke-linecap="round"/><path d="M70 82 L94 112 L112 78 Z" fill="#ff2a1f" stroke="#1a0a00" stroke-width="4" stroke-linejoin="round"/></svg>
<svg class="abs bubble" viewBox="0 0 300 220"><path d="M30 20 Q150 -10 270 22 Q300 70 268 120 Q240 160 190 150 L132 205 L148 148 Q50 160 24 112 Q0 62 30 20 Z" fill="#fff" stroke="#1a0a00" stroke-width="9" stroke-linejoin="round"/></svg>
<div class="abs bubble"><div class="t">BRO?!<br><span style="font-size:.52em;color:#d9221c">MY BASE!!</span></div></div>
<svg class="abs bomb" viewBox="0 0 200 220"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6b6b73"/><stop offset=".45" stop-color="#25252b"/><stop offset="1" stop-color="#08080a"/></radialGradient><radialGradient id="f" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff7a8"/><stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="rgba(255,60,0,0)"/></radialGradient></defs>
<circle cx="92" cy="132" r="72" fill="url(#g)" stroke="#000" stroke-width="7"/><ellipse cx="68" cy="102" rx="22" ry="13" fill="rgba(255,255,255,.35)" transform="rotate(-30 68 102)"/>
<rect x="76" y="40" width="34" height="26" rx="5" fill="#8c8c94" stroke="#000" stroke-width="6"/><path d="M96 40 C 100 14, 128 20, 136 6" fill="none" stroke="#d9b36b" stroke-width="8" stroke-linecap="round"/><circle cx="140" cy="8" r="22" fill="url(#f)"/><g stroke="#ffe07a" stroke-width="5" stroke-linecap="round"><path d="M140 -18 v10 M164 8 h10 M158 -10 l8 -8 M118 -10 l-8 -8"/></g>
<text x="92" y="152" text-anchor="middle" font-size="46" font-family="Impact,Arial Black" fill="#e8291f" stroke="#000" stroke-width="3" paint-order="stroke">TNT</text></svg>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } }); await p.setContent(html); await p.waitForTimeout(400); await p.screenshot({ path: out }); await b.close(); console.log('ok', out); })();
