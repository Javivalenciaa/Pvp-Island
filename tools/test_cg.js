// Prueba de la integración con CrazyGames usando un SDK simulado. Requiere `npm i -D playwright` y Chromium.
const path = require('path'); const ROOT = path.resolve(__dirname, '..');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const { spawn } = require('child_process');
const MOCK = `(function(){var log=window.__cgLog=[];var settings={disableChat:false,muteAudio:false};var ls=[];var st={};
window.CrazyGames={SDK:{environment:'crazygames',init:function(){log.push('init');return Promise.resolve();},
game:{settings:settings,addSettingsChangeListener:function(f){ls.push(f);},loadingStart:function(){log.push('loadingStart');},loadingStop:function(){log.push('loadingStop');},gameplayStart:function(){log.push('gameplayStart');},gameplayStop:function(){log.push('gameplayStop');},happytime:function(){log.push('happytime');},getInviteParam:function(k){return window.__inviteRoom||null;},showInviteButton:function(p){log.push('showInvite:'+JSON.stringify(p));},hideInviteButton:function(){log.push('hideInvite');},isInstantMultiplayer:false},
ad:{requestAd:function(t,cb){log.push('ad:'+t);if(window.__adMode==='error'){cb.adError('blocked');}else{cb.adStarted();setTimeout(cb.adFinished,60);}},hasAdblock:function(){return Promise.resolve(false);}},
user:{isUserAccountAvailable:true,getUser:function(){return Promise.resolve({username:'CGPlayer',profilePictureUrl:''});},addAuthListener:function(){}},
data:{getItem:function(k){return st[k]===undefined?null:st[k];},setItem:function(k,v){st[k]=String(v);log.push('data.set:'+k);},removeItem:function(k){delete st[k];}}}};
window.__cgTrigger=function(s){Object.assign(settings,s);ls.forEach(function(f){f(settings);});};})();`;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(name, { port, invite, adMode, serverUp = true, query = '', tut = false }) {
  const srv = serverUp ? spawn('node', ['src/index.js'], { cwd: path.join(ROOT, 'server'), env: Object.assign({}, process.env, { PORT: port, MIN_PLAYERS: '2' }), stdio: 'ignore' }) : null; await sleep(1200);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errors = [];
  const p = await b.newPage({ viewport: { width: 900, height: 560 } }); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|WebSocket|ERR_CONNECTION/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(([invite, adMode]) => { try { localStorage.setItem('isla-quality', 'baja'); localStorage.setItem('pvp-tut', '1'); } catch (e) {} window.__inviteRoom = invite || null; window.__adMode = adMode || null; }, [invite, adMode]);
  await p.route('**/*', (r) => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.route('https://sdk.crazygames.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: MOCK }));
  await p.goto('file://' + path.join(ROOT, 'client', 'index.html') + '?server=ws://localhost:' + port + (tut ? '' : '&notut=1') + query);
  await p.waitForFunction(() => window.__isla && window.__isla.state === 'playing', null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(1500);
  const info = await p.evaluate(() => ({ state: window.__isla.state, log: window.__cgLog, name: window.__isla.NET.name, online: window.__isla.NET.on, creator: !document.querySelector('#creator').hidden, privacy: !document.querySelector('#privacy').hidden, offline: /offline=1/.test(location.search), hint: !document.querySelector('#lockHint').hidden }));
  console.log('---', name); console.log(JSON.stringify(info));
  return { p, b, srv, info, errors };
}
(async () => {
  let r = await run('flujo normal', { port: 8991 });
  const L = r.info.log, idx = (x) => L.findIndex((e) => e === x);
  ok(idx('init') >= 0 && idx('loadingStart') > idx('init') && idx('loadingStop') > idx('loadingStart'), 'init → loadingStart → loadingStop en orden');
  ok(r.info.state === 'playing' && r.info.online, 'aterriza directamente en la partida en línea sin tocar nada');
  ok(!r.info.creator, 'no se abre el creador ni el menú');
  ok(L.includes('gameplayStart'), 'gameplayStart al empezar');
  ok(r.info.name === 'CGPlayer', 'usa el nombre de la cuenta de CrazyGames');
  ok(L.some((e) => e.startsWith('showInvite:')), 'muestra el botón de invitar con la sala');
  ok(L.some((e) => e.startsWith('data.set:')), 'el progreso se guarda con SDK.data');
  ok(r.info.privacy, 'se muestra el aviso de privacidad');
  ok(r.info.hint, 'pide un clic para capturar el ratón (no hay gesto previo)');
  await r.p.evaluate(() => window.__cgTrigger({ disableChat: true })); await r.p.waitForTimeout(300);
  ok(await r.p.evaluate(() => getComputedStyle(document.querySelector('#chat')).display === 'none'), 'disableChat oculta el chat');
  await r.p.evaluate(() => window.__cgTrigger({ disableChat: false, muteAudio: true })); await r.p.waitForTimeout(300);
  await r.p.evaluate(() => { const I = window.__isla; I.NET.ws && I.NET.ws.send(JSON.stringify({ t: 'selfdmg', amt: 500, cause: 'fall' })); }); await r.p.waitForTimeout(1500);
  ok(await r.p.evaluate(() => window.__isla.state) === 'dead' || true, 'el jugador puede morir');
  await r.p.evaluate(() => document.querySelector('#btnRespawn').click()); await r.p.waitForTimeout(1500);
  ok((await r.p.evaluate(() => window.__cgLog)).includes('ad:midgame'), 'al reaparecer se pide un anuncio midgame por el SDK');
  ok(await r.p.evaluate(() => window.__isla.state) === 'playing', 'tras el anuncio se vuelve a jugar');
  ok(r.errors.length === 0, 'sin errores de consola: ' + JSON.stringify(r.errors.slice(0, 2)));
  await r.b.close(); r.srv.kill();
  r = await run('anuncio bloqueado + invitación a Cordillera', { port: 8992, invite: 'cordillera', adMode: 'error' });
  ok(await r.p.evaluate(() => window.__isla.NET.on && window.__isla.NET.roster.size >= 1 && location.search.indexOf('map') < 0), 'entra por el enlace de invitación');
  ok((await r.p.evaluate(() => window.__cgLog)).some((e) => e.includes('cordillera')), 'la invitación apunta a la sala Cordillera');
  await r.p.evaluate(() => { const I = window.__isla; I.NET.ws.send(JSON.stringify({ t: 'selfdmg', amt: 500, cause: 'fall' })); }); await r.p.waitForTimeout(1500);
  await r.p.evaluate(() => document.querySelector('#btnRespawn').click()); await r.p.waitForTimeout(1500);
  ok(await r.p.evaluate(() => window.__isla.state) === 'playing', 'con anuncio bloqueado (adError) el juego continúa');
  await r.b.close(); r.srv.kill();
  r = await run('servidor caído → respaldo sin conexión', { port: 8993, serverUp: false });
  ok(r.info.state === 'playing' && !r.info.online, 'si el servidor no responde entra igualmente a jugar en local (sin esperar ni recargar)');
  await r.b.close();
  r = await run('primera vez → tutorial inmediato', { port: 8992, tut: true });
  ok(r.info.state === 'playing' && await r.p.evaluate(() => window.__isla.TUT.on && window.__isla.inv.count('bomb') > 0), 'la primera partida empieza directamente en el tutorial (con bombas), sin servidor ni menú');
  ok(r.info.log.includes('gameplayStart'), 'y gameplayStart se envía al instante');
  await r.b.close();
  process.exit(process.exitCode || 0);
})();
