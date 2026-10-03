// Filtro básico de lenguaje ofensivo (PEGI 12): sustituye por asteriscos en chat y apodos. No sustituye a la moderación humana.
const LONG = ['fuck', 'shit', 'bitch', 'cunt', 'pussy', 'asshole', 'bastard', 'whore', 'nigg', 'fagg', 'retard', 'hitler', 'porn', 'mierda', 'joder', 'gilipollas', 'pendejo', 'cabron', 'verga', 'chingar', 'maricon', 'follar', 'violar', 'negrata', 'sudaca', 'subnormal', 'mongolo', 'hijoputa', 'hijodeputa'];
const SHORT = ['dick', 'cock', 'slut', 'rape', 'nazi', 'puta', 'puto', 'coño', 'culo', 'pene', 'polla', 'zorra', 'marica', 'hdp', 'ptm', 'sexo', 'sex'];
const CLS = { a: '[a4@áà]', e: '[e3éè]', i: '[i1!íì]', o: '[o0óò]', u: '[uúüù]', s: '[s5$]', t: '[t7]', n: '[nñ]', c: '[cç]' };
const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pat = (w, boundary) => { const body = w.split('').map((c) => (CLS[c] || esc(c)) + '+').join('[\\s._*-]?'); return boundary ? '(?<![a-zñáéíóúü0-9])' + body + '(?![a-zñáéíóúü0-9])' : body; };
const RES = [...LONG.map((w) => new RegExp(pat(w, false), 'gi')), ...SHORT.map((w) => new RegExp(pat(w, true), 'gi'))];
export function clean(text) { let out = String(text); for (const re of RES) out = out.replace(re, (m) => '*'.repeat(m.length)); return out; }
export const isBad = (text) => clean(text) !== String(text);
