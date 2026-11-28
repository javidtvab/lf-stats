// LF Stats · Araski Scout (#/scout/<rival>): el informe de scouting del rival del cuerpo técnico del Kutxabank Araski,
// en Word. Se elige el rival y la web rellena la plantilla original (datos/araski_scout.js, la escribe generar.py a
// partir de plantillas\ARASKI_SCOUT.docx) y la descarga: el formato, las tablas, el logo y las preguntas son los del
// archivo, aquí solo se cambia el texto de los huecos entre corchetes. Lo que sale del vídeo (sistemas, clips, normas)
// se queda como en la plantilla, para escribirlo a mano.
'use strict';

const SC_COMP = 'lfendesa';
const scEsAraski = e => /araski/i.test(e.nombre);
const scDorsal = j => /\d/.test(j.dorsal || '') ? `#${j.dorsal} ` : '';
const scXml = s => String(s).replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));
const scDeXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// ---------------------------------------------------------------- lo que se escribe en cada hueco
const scPlano = s => scDeXml(String(s).replace(/<[^>]+>/g, '')).replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const scPunto = s => s.replace(/\.$/, '');
const scMayus = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// las claves de Preparar partido hablan de «tu equipo»: en el informe es el Araski
const scNuestro = s => s.replace(/\ba tu equipo\b/g, 'al Araski').replace(/\bTu equipo\b/g, 'El Araski').replace(/\btu equipo\b/g, 'el Araski')
  .replace(/\btu acierto\b/g, 'nuestro acierto').replace(/\btus\b/g, 'nuestros').replace(/\btu\b/g, 'nuestro');
// una clave de Preparar partido («<b>Tiro.</b> Hay ventaja en el tiro: buscar tiros de calidad. Cifras…») por partes:
// etiqueta (Tiro), qué (Hay ventaja en el tiro), cómo (buscar tiros de calidad) y datos (las cifras)
function scClave(c) {
  const m = /^<b>([^<]+?)\.?<\/b>\s*/.exec(c.t), resto = scNuestro(scPlano(m ? c.t.slice(m[0].length) : c.t));
  const corte = resto.search(/\. (?=[A-ZÁÉÍÓÚÑ])/), frase = corte < 0 ? scPunto(resto) : resto.slice(0, corte), dos = frase.indexOf(': ');
  return {w: c.w, etiqueta: m ? scPlano(m[1]) : '', que: dos < 0 ? frase : frase.slice(0, dos), como: dos < 0 ? '' : scMayus(frase.slice(dos + 2)),
    datos: corte < 0 ? '' : scPunto(resto.slice(corte + 2)), todo: resto};
}
const scTitulo = c => c.etiqueta ? `${c.etiqueta}: ${c.que}` : c.que;

// {'[texto del hueco]': [valor de la primera vez que sale, de la segunda…]}; null deja el hueco como está. Un valor
// puede ser una lista: una parte por cada línea del párrafo (las separa un salto de línea)
function scValores(a, b, conDatos) {
  const prog = (T.predicciones || []).filter(p => (p.local === a.id && p.visitante === b.id) || (p.local === b.id && p.visitante === a.id))
    .sort((x, y) => x.jornada - y.jornada)[0];
  const fechas = (b.partidos || []).map(x => IDX.partidos[x[0]] && /\d\d\/\d\d\/\d{4}/.exec(IDX.partidos[x[0]].fecha || '')).filter(Boolean).map(m => m[0]);
  const ahora = new Date(), dos = n => String(n).padStart(2, '0');
  const v = {
    '[Nombre del equipo]': [b.nombre],
    '[Jornada y competición]': [`${prog ? `Jornada ${prog.jornada} · ` : ''}${COMP.corto} ${T.nombre}`],
    '[DD/MM/AAAA • Casa/Fuera]': [prog ? `${prog.fecha} • ${prog.local === a.id ? 'Casa' : 'Fuera'}` : null],
    '[Nº y fechas]': [fechas.length ? `${fechas.length} partido${fechas.length === 1 ? '' : 's'} · ${fechas[0].slice(0, 5)} – ${fechas[fechas.length - 1]}` : null],
    '[DD/MM • HH:MM]': [`${dos(ahora.getDate())}/${dos(ahora.getMonth() + 1)} • ${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`],
  };
  if (!conDatos || !b.pj) return v;
  const n = IDX.jugadas.length, L = T.liga.factores, pl = ppPlantilla(b).filter(x => !x.ausente);
  const quien = j => `${scDorsal(j)}${apellido(j.id)}`;
  // ---- página 2: identidad ofensiva (ritmo, tendencia, tiro y rebote ofensivo)
  const rr = ppRango(b, e => e.ritmo);
  if (b.ritmo != null && rr) v['[Alto / medio / bajo + evidencia]'] = [`${rr <= n / 3 ? 'Alto' : rr > 2 * n / 3 ? 'Bajo' : 'Medio'}: ${fmt(b.ritmo)} posesiones por partido (${rr}.º de ${n}; media de la liga ${fmt(T.liga.ritmo)})`];
  const forma = ppForma(b);
  if (forma.ps.length) v['[Tendencia últimos partidos]'] = [`Últimos ${forma.ps.length}: ${forma.v}-${forma.ps.length - forma.v}${forma.net == null ? '' : ` · neto ${signo(forma.net, 1)} por 100 posesiones`}`];
  const at = b.ataque || {};
  if (at.p3r != null) v['[BD / poste / indirectos / cortes]'] = [`El ${fmt(at.p3r, 0)} % de sus tiros son triples (liga ${fmt(L.p3r, 0)} %), con un ${fmt(at.p3)} % de acierto` +
    (at.ast != null ? ` · ${fmt(at.ast, 0)} % de canastas asistidas (liga ${fmt(L.ast, 0)} %)` : '')];
  const usan = [...pl].filter(x => x.j.av && x.j.av.usg != null && x.minRec >= 10).sort((x, y) => y.j.av.usg - x.j.av.usg).slice(0, 2).map(x => x.j);
  if (usan.length) v['[Quién genera primera ventaja]'] = [usan.map(j => `${quien(j)} (uso ${fmt(j.av.usg, 0)} %, ${fmt(j.med.ast)} ast)`).join(' · ')];
  const rebote = [...pl].filter(x => x.j.med.orb > 0).sort((x, y) => y.j.med.orb - x.j.med.orb).slice(0, 3).map(x => x.j);
  if (at.orb != null) v['[Quién carga y con qué frecuencia]'] = [`Capturan el ${fmt(at.orb)} % de sus fallos (${ppPuesto(b, e => e.ataque && e.ataque.orb)})` +
    (rebote.length ? `; cargan ${rebote.slice(0, 2).map(j => `${quien(j)} (${fmt(j.med.orb)} por partido)`).join(' y ')}` : '')];
  // ---- página 3: quintetos y rebote
  if (rebote.length) v['[Dorsal + zona]'] = [rebote.map(j => `${quien(j)} (${fmt(j.med.orb)} RO por partido)`).join(' · ')];
  const qs = b.pbp && b.pbp.quintetos ? b.pbp.quintetos : [];
  const quinteto = (q, que) => `${q.jugadoras.map(x => IDX.jugadoras[x] ? quien(IDX.jugadoras[x]) : apellido(x)).join(' · ')} (${que}: ${fmt(q.min, 0)} min${q.net == null ? '' : `, neto ${signo(q.net, 1)}`})`;
  const cambia = q => q.ortg == null ? null : `Con ellas: ataque ${fmt(q.ortg, 0)} y defensa ${fmt(q.drtg, 0)} por 100 posesiones` +
    (q.ff && q.ff.efg != null ? ` · tiro efectivo ${fmt(q.ff.efg)} %${q.ff.orb != null ? `, rebote ofensivo ${fmt(q.ff.orb)} %` : ''}` : '');
  const mejor = qs.slice(1).filter(q => q.min >= 10 && q.net != null).sort((x, y) => y.net - x.net)[0], q2 = mejor || qs[1];
  if (qs[0]) { v['[Quinteto o cambio 1]'] = [quinteto(qs[0], 'el más usado')]; v['[Más tiro / tamaño / velocidad]'] = [cambia(qs[0])]; }
  if (q2) { v['[Quinteto o cambio 2]'] = [quinteto(q2, mejor ? 'el siguiente con mejor neto' : 'el segundo más usado')]; v['[Más rebote / juego interior]'] = [cambia(q2)]; }
  // ---- posesiones según cómo empiezan: las suyas (página 2) y las que concede (página 4)
  const org = b.pbp && b.pbp.origen;
  const origen = lado => {
    const x = org[lado], tot = Object.values(x).reduce((s, y) => s + y[0], 0);
    return Object.keys(EV_ORIGEN).map(o => { const [m, pts] = x[o] || [0, 0]; return {o, m, tot, fr: evPct(m, tot), ppp: m >= 10 ? pts / m : null, lp: evLigaOrigen(o, lado, 'ppp')[0]}; });
  };
  const porPos = r => r.ppp == null ? null : `${fmt(r.ppp, 2)} puntos por posesión${r.lp != null ? ` (liga ${fmt(r.lp, 2)})` : ''}`;
  if (org) {
    const suyas = origen(0).filter(r => r.m).sort((x, y) => y.m - x.m);
    v['[Nombre / gesto]'] = suyas.map(r => EV_ORIGEN[r.o]);
    v['[n/N · %]'] = suyas.map(r => `${r.m}/${r.tot} · ${fmt(r.fr, 0)} %`);
    v['[Dónde aparece ventaja]'] = suyas.map(porPos);
    const conc = Object.fromEntries(origen(1).map(r => [r.o, r]));
    const balance = [['robo', 'tras robo'], ['rebote', 'tras rebote defensivo']].filter(([o]) => conc[o] && conc[o].ppp != null).map(([o, t]) => `${t}, ${porPos(conc[o])}`);
    if (balance.length) v['[Balance / emparejamientos]'] = [`Lo que conceden al correr: ${balance.join('; ')}`];
  }
  const df = b.defensa || {};
  if (df.tov != null) v['[Cuándo las usan / norma]'] = [`Fuerzan pérdida en el ${fmt(df.tov)} % de las posesiones del rival (${ppPuesto(b, e => e.defensa && e.defensa.tov)})`];
  // ---- el cruce con el Araski (Preparar partido): claves, amenazas, ventajas, normas e indicadores
  let D = null;
  const venue = prog && prog.local !== a.id ? 'fuera' : 'casa';
  try { if (a.pj) { ppInforme(a, b, venue, prog); D = ppInforme.datos; } } catch (e) { console.error(e); }
  // las tres jugadoras más peligrosas, con sus cifras y cómo jugarles
  const amenazas = [...pl].sort((x, y) => ppPeligro(y) - ppPeligro(x)).slice(0, 3);
  v['[Jugadora o acción]'] = amenazas.map(x => `${scDorsal(x.j)}${x.j.nombre}${x.j.puesto ? ` (${x.j.puesto})` : ''}`);
  v['[Qué ventaja genera]'] = amenazas.map(({j}) => `${fmt(j.med.pts)} pts · ${fmt(j.med.trb)} reb · ${fmt(j.med.ast)} ast en ${fmt(j.med.min, 0)} min` +
    (j.med.p3a >= 2 && j.av.p3 != null ? ` · ${fmt(j.av.p3, 0)} % en triples` : ''));
  if (D) amenazas.forEach((x, i) => {
    const et = ppEtiquetas(x, D.base, venue).filter(e => e.tipo !== 'info' || /:/.test(e.t)).slice(0, 2).map(e => scPunto(scPlano(e.t)));
    v[`[Ajuste propuesto · V0${i + 1}]`] = [et.length ? `${et.join('. ')} · V0${i + 1}` : null];
  });
  if (!D) return v;
  const ata = D.ataque.map(scClave), def = D.defensa.map(scClave);
  // página 1: las tres claves (las que más puntos mueven, de ataque o de defensa) y dónde atacar y qué proteger
  const tres = [...ata.map(c => ({...c, lado: 'En ataque'})), ...def.map(c => ({...c, lado: 'En defensa'}))].sort((x, y) => y.w - x.w).slice(0, 3);
  v['[Objetivo observable]'] = tres.map(c => `${c.lado} · ${scTitulo(c)}`);
  v['[Norma concreta + situación]'] = tres.map(c => c.como || c.datos.split('. ')[0] || null);       // «el partido en una página»: sin las cifras
  const libre = l => l.find(c => !tres.some(x => x.todo === c.todo)) || l[0];
  const breve = c => `${[scTitulo(c), c.como].filter(Boolean).join('. ')}.${c.datos ? ' ' + c.datos.split('. ')[0] + '.' : ''}`;
  if (ata.length) v['[Debilidad defensiva más castigable y acción concreta para explotarla.]'] = [breve(libre(ata))];
  if (def.length) v['[Situación rival que no podemos conceder y norma para limitarla.]'] = [breve(libre(def))];
  // página 2: qué zonas ocupan y los ajustes en defensa
  if (D.zB) v['[Qué espacios ocupan]'] = [[...D.zB].filter(z => z.fa != null).sort((x, y) => y.fa - x.fa).slice(0, 3)
    .map(z => `${z.z} ${fmt(z.fa, 0)} % de sus tiros (${fmt(z.pa, 0)} % de acierto)`).join(' · ')];
  def.slice(0, 3).forEach((c, i) => { v[`[Acción ${i + 1}]`] = [c.etiqueta || c.que]; });
  v['[Ventaja]'] = def.slice(0, 3).map(c => c.datos || (c.etiqueta ? null : c.como || null));
  v['[Norma defensiva]'] = def.slice(0, 3).map(c => c.etiqueta || c.datos ? [c.que, c.como].filter(Boolean).join(': ') : null);
  // página 4: su defensa y las tres ventajas que buscar
  const contra = D.sA.find(s => s.k === 'contra');
  if (contra && contra.h != null && contra.c != null) v['[Ventaja temprana · D05]'] = [`El Araski hace ${fmt(contra.h)} puntos de contraataque por partido y ellos conceden ${fmt(contra.c)} (${contra.rc}.º) · D05`];
  const aro = D.zA && D.zA.find(z => z.z === 'Zona restringida');
  if (aro && aro.nd) v['[1c1 / 2c1 / frontal]'] = [`Junto al aro les meten el ${fmt(aro.pd, 0)} % (liga ${fmt(aro.l, 0)} %); el ${fmt(aro.fd, 0)} % de los tiros que conceden son ahí`];
  v['[Concepto / sistema]'] = ata.slice(0, 3).map(scTitulo);
  v['[Tiro / mismatch / falta / rebote]'] = ata.slice(0, 3).map(c => [c.como, c.datos].filter(Boolean).join('. ') || null);
  // página 5: normas, finales e indicadores
  const normas = (l, huecos) => [huecos.map((hueco, i) => l[i] ? `${i + 1}. ${scTitulo(l[i])}${l[i].como ? '. ' + l[i].como : ''}` : `${i + 1}. ${hueco}`)];
  v['1. [Nuestra prioridad ofensiva]2. [Nuestra segunda prioridad]3. [Nuestro objetivo de ritmo/rebote]'] = normas(ata, ['[Nuestra prioridad ofensiva]', '[Nuestra segunda prioridad]', '[Nuestro objetivo de ritmo/rebote]']);
  v['1. [Nuestra prioridad defensiva]2. [Nuestra segunda prioridad]3. [Nuestra norma de comunicación]'] = normas(def, ['[Nuestra prioridad defensiva]', '[Nuestra segunda prioridad]', '[Nuestra norma de comunicación]']);
  const finales = D.rotB.filter(x => x.j.pbp && x.j.pbp.final_apretado && x.j.pbp.final_apretado.pts >= 4).sort((x, y) => y.j.pbp.final_apretado.pts - x.j.pbp.final_apretado.pts).slice(0, 2);
  if (finales.length) v['[A quién buscan · E02]'] = [`${finales.map(({j}) => `${quien(j)} (${j.pbp.final_apretado.pts} pts en finales apretados, ${j.pbp.final_apretado.tc}/${j.pbp.final_apretado.tci} de campo)`).join(' · ')} · E02`];
  if (D.cB && D.cB.length >= 5) v['[Cinco probable · E03]'] = [`${D.cB.slice(0, 5).map(c => quien(c.x.j)).join(' · ')} (las que más juegan el último cuarto) · E03`];
  const libres = l => l.map(x => `${quien(x.j)} (${fmt(x.j.av.ft, 0)} % en libres)`).join(', ');
  if (D.noFalta.length || D.siFalta.length) v['[Emparejamientos / faltas]'] = [[D.noFalta.length ? `No hacer falta a ${libres(D.noFalta)}` : '', D.siFalta.length ? `Si hay que hacerla, a ${libres(D.siFalta)}` : ''].filter(Boolean).join('. ')];
  const correr = D.sB.find(s => s.k === 'contra'), tov = D.crA.find(x => x.k === 'tov');
  const segunda = D.sB.find(s => s.k === 'segunda');
  if (rebote.length) v['[La 4 / 5 domina rebote]'] = [`${quien(rebote[0])} domina el rebote ofensivo (${fmt(rebote[0].med.orb)} por partido)`];
  if (segunda && segunda.h != null) v['[Segundas opciones repetidas]'] = [`Más de ${fmt(segunda.h, 0)} puntos de segunda oportunidad (su media: ${fmt(segunda.h)})`];
  v['[Ej. puntos concedidos en transición]'] = ['Puntos concedidos en transición'];
  v['[Ej. rebote defensivo o 2ª opción]'] = ['Rebote defensivo: su rebote ofensivo'];
  v['[Ej. pérdidas no forzadas]'] = ['Pérdidas del Araski'];
  v['[Objetivo medible]'] = [
    correr && correr.h != null ? `Menos de ${fmt(correr.h, 0)} puntos de contraataque (su media: ${fmt(correr.h)}${correr.l != null ? `; liga ${fmt(correr.l)}` : ''})` : null,
    at.orb != null && L.orb != null ? `Que capturen menos del ${fmt(Math.min(at.orb, L.orb), 0)} % de sus fallos (su media: ${fmt(at.orb)} %; liga ${fmt(L.orb)} %)` : null,
    tov && tov.esperado != null ? `Perder el balón en menos del ${fmt(Math.min(tov.esperado, tov.a), 0)} % de las posesiones (el Araski pierde el ${fmt(tov.a)} % y ellos fuerzan el ${fmt(tov.dd)} %)` : null];
  return v;
}

// cambia el texto de los huecos del documento (word/document.xml) sin tocar nada más: cada párrafo cuyo texto es un
// hueco con valor pasa a llevarlo en el primer trozo de cada línea, con su mismo formato
function scRellenar(xml, valores) {
  const cola = Object.fromEntries(Object.entries(valores).map(([k, l]) => [k, [...l]]));
  return xml.replace(/<w:p[ >](?:(?!<w:p[ >])[\s\S])*?<\/w:p>/g, p => {
    const hueco = scDeXml([...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join('')).trim();
    if (!cola[hueco] || !cola[hueco].length) return p;
    const valor = cola[hueco].shift();
    if (valor == null) return p;
    const lineas = Array.isArray(valor) ? valor : [valor];
    let linea = 0, primero = true;
    return p.replace(/<w:br\/>|<w:t(?: [^>]*)?>[^<]*<\/w:t>/g, x => {
      if (x === '<w:br/>') { linea++; primero = true; return x; }
      const texto = primero && lineas[linea] != null ? lineas[linea] : '';
      primero = false;
      return texto ? `<w:t xml:space="preserve">${scXml(texto)}</w:t>` : '<w:t></w:t>';
    });
  });
}

// ---------------------------------------------------------------- el archivo .docx (un zip)
const SC_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function scCrc(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = SC_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
async function scComprimir(b) {
  if (typeof CompressionStream !== 'function') return null;
  try { return new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); }
  catch (e) { return null; }                  // un navegador sin deflate-raw: el archivo va sin comprimir
}
async function scZip(archivos) {               // [[nombre, Uint8Array]] en el orden del original
  const enc = new TextEncoder(), trozos = [], central = [];
  const d = new Date(), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let pos = 0;
  for (const [nombre, datos] of archivos) {
    const n = enc.encode(nombre), z = await scComprimir(datos), cuerpo = z && z.length < datos.length ? z : datos;
    const comun = [20, 0, cuerpo === datos ? 0 : 8, hora, dia];       // versión, opciones, método, hora y día
    const cab = new DataView(new ArrayBuffer(30)), cen = new DataView(new ArrayBuffer(46));
    cab.setUint32(0, 0x04034b50, true); cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true);
    comun.forEach((x, i) => { cab.setUint16(4 + 2 * i, x, true); cen.setUint16(6 + 2 * i, x, true); });
    [scCrc(datos), cuerpo.length, datos.length].forEach((x, i) => { cab.setUint32(14 + 4 * i, x, true); cen.setUint32(16 + 4 * i, x, true); });
    cab.setUint16(26, n.length, true); cen.setUint16(28, n.length, true); cen.setUint32(42, pos, true);
    trozos.push(cab.buffer, n, cuerpo); central.push(cen.buffer, n);
    pos += 30 + n.length + cuerpo.length;
  }
  const largo = central.reduce((s, x) => s + x.byteLength, 0), fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, largo, true); fin.setUint32(16, pos, true);
  return new Blob([...trozos, ...central, fin.buffer], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

// la plantilla: {orden: [nombres], archivos: {nombre: base64}, documento: el texto de word/document.xml}
function scPlantilla() {
  return scPlantilla.p || (scPlantilla.p = cargarDatos('datos/araski_scout.js', 'araski_scout', () => window.LF_SCOUT)
    .catch(e => { scPlantilla.p = null; throw e; }));
}
async function scGenerar(a, b, conDatos) {
  const pl = await scPlantilla(), enc = new TextEncoder();
  const bytes = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const documento = scRellenar(pl.documento, scValores(a, b, conDatos));
  const blob = await scZip(pl.orden.map(n => [n, n === 'word/document.xml' ? enc.encode(documento) : bytes(pl.archivos[n])]));
  const prog = (T.predicciones || []).find(p => (p.local === a.id && p.visitante === b.id) || (p.local === b.id && p.visitante === a.id));
  const nombre = `ARASKI_SCOUT_${normal(b.nombre).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase()}${prog ? '_J' + prog.jornada : ''}.docx`;
  const url = URL.createObjectURL(blob), enlace = document.createElement('a');
  enlace.href = url; enlace.download = nombre;
  document.body.appendChild(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return nombre;
}

// ---------------------------------------------------------------- la vista
VISTAS.scout = idRival => {
  const titulo = '<h1>Araski Scout</h1>';
  if (!COMPETICIONES.some(c => c.clave === SC_COMP)) return `${titulo}<div class="aviso">Faltan los datos de la LF Endesa.</div>`;
  const ultima = INDICE.temporadas.length ? INDICE.temporadas[0].temporada : T.temporada;
  if (COMP.clave !== SC_COMP || String(T.temporada) !== String(ultima)) {       // siempre con la temporada actual de la LF Endesa
    despues(() => irA(SC_COMP, COMP.clave === SC_COMP ? ultima : undefined, location.hash));
    return `${titulo}<p class="tenue">Cargando la temporada actual de la LF Endesa…</p>`;
  }
  const a = T.equipos.find(scEsAraski);
  if (!a) return `${titulo}<div class="aviso">El Araski no está entre los equipos de ${esc(COMP.corto)} ${esc(T.nombre)}.</div>`;
  const pendientes = (T.predicciones || []).filter(p => p.local === a.id || p.visitante === a.id).sort((x, y) => x.jornada - y.jornada);
  const rivalDe = p => p.local === a.id ? p.visitante : p.local;
  const b = IDX.equipos[idRival] && idRival !== a.id ? IDX.equipos[idRival] : pendientes.length ? IDX.equipos[rivalDe(pendientes[0])] : null;
  const rivales = T.equipos.filter(e => e.id !== a.id).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
  const cuando = e => { const p = pendientes.find(x => rivalDe(x) === e.id); return p ? ` · jornada ${p.jornada}, ${p.fecha}${p === pendientes[0] ? ' (próximo rival)' : ''}` : ''; };
  const conDatos = leer('scout:datos') !== 'no';
  const valores = b ? scValores(a, b, conDatos) : {};
  const filas = Object.entries(valores).flatMap(([k, l]) => l.filter(x => x != null).map(x => `<tr><td class="izq muy-tenue" style="white-space:normal">${esc(k.replace(/[\[\]]/g, ''))}</td><td class="izq" style="white-space:normal">${esc([].concat(x).join(' '))}</td></tr>`));
  despues(() => {
    alCambiar('sc-rival', id => { location.hash = `#/scout/${id}`; });
    const casilla = document.getElementById('sc-datos'), boton = document.getElementById('sc-generar'), estado = document.getElementById('sc-estado');
    if (casilla) casilla.addEventListener('change', () => { guardar('scout:datos', casilla.checked ? 'si' : 'no'); pintar(); });
    if (boton) boton.addEventListener('click', async () => {
      boton.disabled = true; estado.textContent = 'Generando el informe…';
      try { estado.textContent = `Descargado: ${await scGenerar(a, b, conDatos)}`; }
      catch (e) { console.error(e); estado.textContent = `No se ha podido generar el informe (${e.message || e}).`; }
      boton.disabled = false;
    });
  });
  return h`<div class="encabezado"><div>${titulo}<p class="tenue">El informe de scouting del rival del cuerpo técnico del ${esc(a.nombre)}, en Word:
      elige el rival y se descarga con el formato de siempre, listo para completar.</p></div></div>
    <div class="filtros"><label><span>Rival</span><select id="sc-rival">${b ? '' : '<option value="">Elige el rival</option>'}${rivales.map(e =>
      `<option value="${esc(e.id)}"${b && e.id === b.id ? ' selected' : ''}>${esc(e.nombre)}${esc(cuando(e))}</option>`).join('')}</select></label></div>
    ${b ? `<div class="tarjeta"><h2>Informe de ${esc(b.nombre)}</h2>
      <label class="check"><input id="sc-datos" type="checkbox"${conDatos ? ' checked' : ''}> Rellenar también lo que sale de los datos: claves, amenazas, situaciones, ajustes, ventajas, normas e indicadores</label>
      <div class="tabla-scroll" style="margin:.75rem 0"><table><thead><tr><th class="izq">Hueco de la plantilla</th><th class="izq">Lo que llevará escrito</th></tr></thead><tbody>${filas.join('')}</tbody></table></div>
      <p class="muy-tenue">${filas.length} huecos rellenos. Lo que solo se ve en el vídeo (coberturas del bloqueo directo, saques, clips, plan B, señales de banquillo y quién controla cada indicador) sale como en la plantilla, entre corchetes, para escribirlo a mano.</p>
      <p><button id="sc-generar" class="boton" type="button">Generar informe (Word)</button> <span id="sc-estado" class="tenue" role="status"></span></p></div>`
    : '<div class="tarjeta"><p>Elige el rival en el desplegable.</p></div>'}`;
};
