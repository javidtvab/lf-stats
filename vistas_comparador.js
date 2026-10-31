// LF Stats · comparador: cualquier cosa razonable frente a cualquier otra, con gráfico.
// Jugadoras: una jugadora, la media de un puesto, de la liga, de un equipo o de un partido, o una actuación.
// Equipos: un equipo, el equipo medio de la liga, un entrenador (una temporada o su carrera) o un equipo en un partido.
// Cada cosa puede ser de cualquier temporada. Se ve como valor, percentil o diferencia con una referencia, en barras,
// radar, evolución jornada a jornada o dispersión, y siempre con su tabla.
'use strict';

const CACHE_IX = {};
async function ixDe(t) {
  if (CACHE_IX[t]) return CACHE_IX[t];
  const d = String(t) === String(T.temporada) ? T : await cargarTemporada(t);
  const ix = {d, t: d.temporada, equipos: {}, jugadoras: {}, partidos: {}};
  d.equipos.forEach(e => ix.equipos[e.id] = e);
  d.jugadoras.forEach(j => ix.jugadoras[j.id] = j);
  d.partidos.forEach(p => ix.partidos[p.id] = p);
  ix.maxPJ = Math.max(1, ...d.equipos.map(e => e.pj || 0));
  ix.jugadas = d.equipos.filter(e => e.pj);
  ix.cualificadas = d.jugadoras.filter(j => j.pj >= Math.max(2, Math.ceil(0.4 * ix.maxPJ)) && (j.med.min || 0) >= 10);
  return (CACHE_IX[t] = ix);
}

const PUESTOS_OPC = [['Base', 'Bases'], ['Escolta', 'Escoltas'], ['Alero', 'Aleras'], ['Ala-pívot', 'Ala-pívots'], ['Pívot', 'Pívots'],
  ['Exterior', 'Exteriores (bases y escoltas)'], ['Interior', 'Interiores (ala-pívots y pívots)']];
const TIPOS = {
  j: [['jugadora', 'Una jugadora'], ['puesto', 'Media de un puesto'], ['liga_j', 'Media de la liga'], ['equipo_j', 'Media de las jugadoras de un equipo'],
      ['partido_j', 'Media de las jugadoras de un partido'], ['actuacion', 'Una actuación (un partido de una jugadora)']],
  e: [['equipo', 'Un equipo'], ['liga_e', 'Equipo medio de la liga'], ['entrenador', 'Un entrenador'], ['partido_e', 'Un equipo en un partido']],
};
const nombreTemp = t => `${t}/${String(+t + 1).slice(2)}`;

// media de objetos campo a campo, ponderada (los que no son números ni objetos se ignoran)
function mediaPond(objs, pesos) {
  const fusion = (lista, ps) => {
    const salida = {};
    const claves = new Set(lista.flatMap(o => o && typeof o === 'object' ? Object.keys(o) : []));
    for (const k of claves) {
      const vals = lista.map(o => o ? o[k] : undefined);
      if (vals.some(v => typeof v === 'number')) {
        let s = 0, w = 0;
        vals.forEach((v, i) => { if (typeof v === 'number' && !Number.isNaN(v)) { s += v * ps[i]; w += ps[i]; } });
        salida[k] = w ? s / w : null;
      } else if (vals.some(v => v && typeof v === 'object' && !Array.isArray(v))) {
        salida[k] = fusion(vals.map(v => v && typeof v === 'object' && !Array.isArray(v) ? v : null), ps);
      }
    }
    return salida;
  };
  return fusion(objs, pesos);
}

// una fila del acta de un partido (vistas: caja) como si fuera una jugadora con un solo partido
function deCaja(f) {
  const min = f[3] || 0, med = {min, pts: f[4], p2: f[5], p2a: f[6], p3: f[7], p3a: f[8], ft: f[9], fta: f[10], orb: f[11], drb: f[12], trb: f[13],
    ast: f[14], stl: f[15], tov: f[16], blk: f[17], pf: f[18], pfd: f[19], pir: f[20], pm: f[21], blka: f[22] || 0};
  med.fg = med.p2 + med.p3; med.fga = med.p2a + med.p3a;
  const tsa = med.fga + 0.44 * med.fta;
  return {pj: 1, tit: f[2], med, tot: med, gmsc: gameScore(f),
    p40: min ? Object.fromEntries(Object.entries(med).map(([k, v]) => [k, 40 * v / min])) : {},
    av: {ts: tsa ? 100 * med.pts / (2 * tsa) : null, efg: med.fga ? 100 * (med.fg + 0.5 * med.p3) / med.fga : null, fg: pct(med.fg, med.fga),
      p2: pct(med.p2, med.p2a), p3: pct(med.p3, med.p3a), ft: pct(med.ft, med.fta), p3r: pct(med.p3a, med.fga), ftr: med.fga ? med.fta / med.fga : null,
      ft_rate: med.fga ? med.ft / med.fga : null, pps: med.fga ? med.pts / med.fga : null, ppt: tsa ? med.pts / tsa : null, ast_tov: med.tov ? med.ast / med.tov : null},
    cons: {}, splits: {}};
}

// un equipo en un partido, como si fuera un equipo con un solo partido
function equipoDePartido(p, lado) {
  const tt = x => ({fg: x[0], fga: x[1], p3: x[2], p3a: x[3], ft: x[4], fta: x[5], orb: x[6], drb: x[7], trb: x[6] + x[7], ast: x[8], stl: x[9],
    tov: x[10], blk: x[11], pir: x[12], pf: x[13], p2: x[14], p2a: x[15]});
  const med = {...tt(p.totales[lado]), pts: p.puntos[lado]}, rival = {...tt(p.totales[1 - lado]), pts: p.puntos[1 - lado]};
  const gana = p.puntos[lado] > p.puntos[1 - lado];
  return {pj: 1, pg: +gana, pf: p.puntos[lado], pc: p.puntos[1 - lado], med, med_rival: rival,
    ortg: 100 * p.puntos[lado] / p.pos, drtg: 100 * p.puntos[1 - lado] / p.pos, net: 100 * (p.puntos[lado] - p.puntos[1 - lado]) / p.pos,
    ritmo: p.pos * 40 / (40 + 5 * Math.max(p.cuartos.length - 4, 0)), ataque: p.factores[lado], defensa: p.factores[1 - lado],
    p100: Object.fromEntries(Object.entries(med).map(([k, v]) => [k, 100 * v / p.pos])),
    p100_rival: Object.fromEntries(Object.entries(rival).map(([k, v]) => [k, 100 * v / p.pos]))};
}

const conSinAdjunto = (ix, j) => ({...j, _conSin: ix.equipos[j.equipo]?.pbp?.con_sin?.[j.id]});

// convierte una «cosa» elegida en {nombre, detalle, obj, nivel, t, serie(clave) -> [[jornada, valor]]}
async function resolver(s) {
  const ix = await ixDe(s.t), tn = nombreTemp(ix.t);
  const filasLog = (lista, f) => lista.flatMap(j => j.log.map(x => [x[1], f(x)]));
  const promedioPorJornada = filas => { const m = new Map(); filas.forEach(([jn, v]) => { if (v == null) return; const a = m.get(jn) || [0, 0]; a[0] += v; a[1]++; m.set(jn, a); });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([jn, [s_, n]]) => [jn, s_ / n]); };
  const grupoJ = (lista, nombre, detalle) => ({nivel: 'j', t: ix.t, nombre, detalle: `${detalle} · ${lista.length} jugadoras · ${tn}`,
    obj: mediaPond(lista.map(j => conSinAdjunto(ix, j)), lista.map(j => j.tot.min || 0)),
    serie: f => promedioPorJornada(filasLog(lista, f))});
  switch (s.tipo) {
    case 'jugadora': {
      const j = ix.jugadoras[s.id]; if (!j) return null;
      return {nivel: 'j', t: ix.t, nombre: j.nombre, detalle: `${ix.equipos[j.equipo]?.nombre || ''} · ${j.puesto || 'sin puesto'} · ${tn}`,
        obj: conSinAdjunto(ix, j), serie: f => j.log.map(x => [x[1], f(x)])};
    }
    case 'puesto': {
      const lista = ix.cualificadas.filter(j => j.puesto === s.id || j.grupo === s.id);
      return grupoJ(lista, `Media: ${(PUESTOS_OPC.find(p => p[0] === s.id) || [, s.id])[1].toLowerCase()}`, 'Con minutos suficientes');
    }
    case 'liga_j': return grupoJ(ix.cualificadas, `Media de la liga ${tn}`, 'Jugadoras con minutos suficientes');
    case 'equipo_j': {
      const lista = ix.d.jugadoras.filter(j => j.equipo === s.id && (j.tot.min || 0) > 0);
      return grupoJ(lista, `Media de ${ix.equipos[s.id]?.nombre || '?'}`, 'Ponderada por minutos');
    }
    case 'partido_j': {
      const p = ix.partidos[s.id]; if (!p) return null;
      const lados = s.id2 === '0' ? [0] : s.id2 === '1' ? [1] : [0, 1];
      const filas = lados.flatMap(l => p.caja[l]).filter(f => f[3] > 0);
      const quien = s.id2 === '0' ? ix.equipos[p.local]?.nombre : s.id2 === '1' ? ix.equipos[p.visitante]?.nombre : 'las jugadoras';
      return {nivel: 'j', t: ix.t, nombre: `Media de ${quien} en J${p.jornada}`, detalle: `${ix.equipos[p.local]?.nombre} ${p.puntos[0]}-${p.puntos[1]} ${ix.equipos[p.visitante]?.nombre} · ${tn}`,
        obj: mediaPond(filas.map(deCaja), filas.map(f => f[3])), serie: null, partido: true};
    }
    case 'actuacion': {
      const j = ix.jugadoras[s.id], p = ix.partidos[s.id2]; if (!j || !p) return null;
      const f = [...p.caja[0], ...p.caja[1]].find(x => x[0] === j.id); if (!f) return null;
      const rival = p.local === j.equipo ? p.visitante : p.local;
      return {nivel: 'j', t: ix.t, nombre: `${j.nombre} · J${p.jornada}`, detalle: `vs ${ix.equipos[rival]?.nombre} · ${p.puntos[0]}-${p.puntos[1]} · ${tn}`, obj: deCaja(f), serie: null, partido: true};
    }
    case 'equipo': {
      const e = ix.equipos[s.id]; if (!e) return null;
      return {nivel: 'e', t: ix.t, nombre: e.nombre, detalle: `${e.pg}-${e.pj - e.pg} · ${tn}`, obj: e, serie: f => e.partidos.map(x => [x[1], f(x, ix)])};
    }
    case 'liga_e': return {nivel: 'e', t: ix.t, nombre: `Equipo medio ${tn}`, detalle: `Media de ${ix.jugadas.length} equipos`, obj: mediaObjetos(ix.jugadas),
      serie: f => promedioPorJornada(ix.jugadas.flatMap(e => e.partidos.map(x => [x[1], f(x, ix)])))};
    case 'entrenador': {
      const c = (INDICE.entrenadores || {})[s.id]; if (!c) return null;
      if (s.id2 === 'carrera') {
        const objs = [];
        for (const x of c.temporadas) { const ixx = await ixDe(x[0]); if (ixx.equipos[x[1]]) objs.push(ixx.equipos[x[1]]); }
        const v = c.temporadas.reduce((a, x) => a + x[3], 0), dd = c.temporadas.reduce((a, x) => a + x[4], 0);
        return {nivel: 'e', t: ix.t, nombre: `${c.nombre} (carrera)`, detalle: `${c.temporadas.length} temporadas · ${v}-${dd}`, obj: mediaObjetos(objs), serie: null};
      }
      const x = c.temporadas.find(y => String(y[0]) === String(s.t)); if (!x) return null;
      const e = ix.equipos[x[1]];
      return {nivel: 'e', t: ix.t, nombre: c.nombre, detalle: `${e?.nombre || ''} · ${tn}`, obj: e, serie: e ? f => e.partidos.map(y => [y[1], f(y, ix)]) : null};
    }
    case 'partido_e': {
      const p = ix.partidos[s.id]; if (!p) return null;
      const lado = Number(s.id2 || 0), id = lado ? p.visitante : p.local, rival = lado ? p.local : p.visitante;
      return {nivel: 'e', t: ix.t, nombre: `${ix.equipos[id]?.nombre} · J${p.jornada}`, detalle: `vs ${ix.equipos[rival]?.nombre} · ${p.puntos[lado]}-${p.puntos[1 - lado]} · ${tn}`,
        obj: equipoDePartido(p, lado), serie: null, partido: true};
    }
  }
  return null;
}

// cifras por partido para la evolución (jugadoras: fila del registro; equipos: fila de partidos del equipo)
const EVOL_J = {min: x => x[6], pts: x => x[7], trb: x => x[14], orb: x => x[22], ast: x => x[15], stl: x => x[16], tov: x => x[17], blk: x => x[18],
  pir: x => x[19], pm: x => x[20], gmsc: x => x[21], pf: x => x[23], pfd: x => x[24], p3: x => x[10], p3a: x => x[11], fta: x => x[13], ft: x => x[12],
  ts: x => { const t_ = x[9] + x[11] + 0.44 * x[13]; return t_ ? 100 * x[7] / (2 * t_) : null; }, p3p: x => x[11] ? 100 * x[10] / x[11] : null,
  pts40: x => x[6] ? 40 * x[7] / x[6] : null, trb40: x => x[6] ? 40 * x[14] / x[6] : null, ast40: x => x[6] ? 40 * x[15] / x[6] : null};
const factorDe = (k, lado) => (x, ix) => { const p = ix.partidos[x[0]]; if (!p) return null; const l = x[3] ? 0 : 1; return p.factores[lado === 'r' ? 1 - l : l][k]; };
const EVOL_E = {ptsm: x => x[4], ptsc: x => x[5], dif: x => x[4] - x[5], ortg: x => x[6] ? 100 * x[4] / x[6] : null, drtg: x => x[6] ? 100 * x[5] / x[6] : null,
  net: x => x[6] ? 100 * (x[4] - x[5]) / x[6] : null, ritmo: (x, ix) => { const p = ix.partidos[x[0]]; return p ? p.pos * 40 / (40 + 5 * Math.max(p.cuartos.length - 4, 0)) : null; },
  efg: factorDe('efg'), tov: factorDe('tov'), orb: factorDe('orb'), ftr: factorDe('ftr'), ts: factorDe('ts'), p3: factorDe('p3'), p3r: factorDe('p3r'), ast: factorDe('ast'),
  efg_r: factorDe('efg', 'r'), tov_r: factorDe('tov', 'r'), orb_r: factorDe('orb', 'r'), ftr_r: factorDe('ftr', 'r')};

const PRESETS = {
  j: {'Básico': ['min', 'pts', 'trb', 'ast', 'stl', 'blk', 'tov', 'pir'], 'Tiro': ['ts', 'efg', 'p2p', 'p3p', 'ftp', 'p3r', 'ftr'],
      'Por 40 min': ['pts40', 'trb40', 'ast40', 'stl40', 'blk40', 'tov40'], 'Avanzadas': ['usg', 'ast_pct', 'tov_pct', 'orb_pct', 'drb_pct', 'stl_pct', 'blk_pct'],
      'Impacto': ['per', 'bpm', 'ws40', 'ortg', 'drtg', 'gmsc', 'onoff'], 'Zonas de tiro': ['xefg', 'sobre_esperado', 'distancia', 'asistidas']},
  e: {'Resultados': ['wpct', 'dif', 'srs', 'elo', 'pitag'], 'Eficiencia': ['ortg', 'drtg', 'net', 'ritmo'],
      'Cuatro factores': ['efg', 'tov', 'orb', 'ftr', 'efg_r', 'tov_r', 'orb_r', 'ftr_r'], 'Por partido': ['ptsm', 'ptsc', 'trbm', 'astm', 'stlm', 'tovm', 'p3m'],
      'Plantilla': ['banq_pts', 'max_anot', 'edad', 'altura', 'formacion']},
};

function estadoInicial() {
  const top = [...cualificadas()].sort((a, b) => b.med.pir - a.med.pir)[0];
  return {nivel: 'j', sujetos: top ? [{tipo: 'jugadora', t: T.temporada, id: top.id}, {tipo: 'puesto', t: T.temporada, id: top.puesto || top.grupo || 'Exterior'},
    {tipo: 'liga_j', t: T.temporada}] : [{tipo: 'liga_j', t: T.temporada}], metricas: PRESETS.j['Básico'], modo: 'valor', ref: 1, grafico: 'barras', acum: false};
}
// enlace al comparador ya preparado (se usa desde las fichas)
const enlaceComparador = estado => '#/comparador/' + encodeURIComponent(JSON.stringify(estado));
function comparadorDeJugadora(j) {
  return enlaceComparador({nivel: 'j', sujetos: [{tipo: 'jugadora', t: T.temporada, id: j.id},
    ...(j.puesto ? [{tipo: 'puesto', t: T.temporada, id: j.puesto}] : j.grupo ? [{tipo: 'puesto', t: T.temporada, id: j.grupo}] : []),
    {tipo: 'equipo_j', t: T.temporada, id: j.equipo}, {tipo: 'liga_j', t: T.temporada}], metricas: PRESETS.j['Básico'], modo: 'dif', ref: 1, grafico: 'barras'});
}
function comparadorDeEquipo(e) {
  const c = e.entrenador ? [{tipo: 'entrenador', t: T.temporada, id: e.entrenador.id, id2: 'carrera'}] : [];
  return enlaceComparador({nivel: 'e', sujetos: [{tipo: 'equipo', t: T.temporada, id: e.id}, {tipo: 'liga_e', t: T.temporada}, ...c],
    metricas: PRESETS.e['Cuatro factores'], modo: 'valor', ref: 1, grafico: 'barras'});
}

VISTAS.comparador = arg => {
  let st = VISTAS.comparador.st;
  if (arg) { try { st = JSON.parse(arg); } catch (e) { /* enlace roto: estado por defecto */ } }
  if (!st) st = estadoInicial();
  st.modo = st.modo || 'valor'; st.grafico = st.grafico || 'barras'; st.ref = Math.min(st.ref || 0, Math.max(0, st.sujetos.length - 1));
  VISTAS.comparador.st = st;
  const nuevo = VISTAS.comparador.nuevo || (VISTAS.comparador.nuevo = {tipo: st.nivel === 'j' ? 'jugadora' : 'equipo', t: T.temporada});
  const cambiar = () => { history.replaceState(null, '', enlaceComparador(st)); pintar.ultima = location.hash; pintar(); };
  const catalogo = st.nivel === 'j' ? MJ : ME, K = st.nivel === 'j' ? MJK : MEK;
  despues(() => {
    alPulsar('c-nivel', v => { if (v === st.nivel) return; Object.assign(st, v === 'j' ? estadoInicial() : {nivel: 'e', sujetos: [{tipo: 'liga_e', t: T.temporada}], metricas: PRESETS.e['Eficiencia'], ref: 0});
      nuevo.tipo = v === 'j' ? 'jugadora' : 'equipo'; cambiar(); });
    alPulsar('c-preset', v => { st.metricas = PRESETS[st.nivel][v]; cambiar(); });
    alCambiar('c-anadir-m', v => { if (v && !st.metricas.includes(v)) st.metricas = [...st.metricas, v]; cambiar(); });
    document.querySelectorAll('[data-quitar-m]').forEach(b => b.addEventListener('click', () => { st.metricas = st.metricas.filter(m => m !== b.dataset.quitarM); cambiar(); }));
    document.querySelectorAll('[data-quitar-s]').forEach(b => b.addEventListener('click', () => { st.sujetos.splice(Number(b.dataset.quitarS), 1); cambiar(); }));
    alPulsar('c-modo', v => { st.modo = v; cambiar(); });
    alPulsar('c-graf', v => { st.grafico = v; cambiar(); });
    alCambiar('c-ref', v => { st.ref = Number(v); cambiar(); });
    alCambiar('c-acum', () => { st.acum = document.getElementById('c-acum').checked; cambiar(); });
    pintarNuevo(st, nuevo, cambiar);
    pintarResultado(st, catalogo, K);
  });
  return h`${subnav(NAV_JUG.map(x => x[0] === '#/comparar' ? ['#/comparador', 'Comparador'] : x), '#/comparador')}
    <div class="encabezado"><div><h1>Comparador</h1><p class="tenue">Pon lo que quieras frente a lo que quieras: jugadoras, medias de un puesto, de un equipo, de un partido o de la liga, equipos, entrenadores… de cualquier temporada.</p></div>
      ${pildoras('c-nivel', [['j', 'Jugadoras'], ['e', 'Equipos y entrenadores']], st.nivel)}</div>
    <div class="tarjeta"><h2>Qué se compara</h2>
      <div class="sujetos">${st.sujetos.map((s, i) => `<span class="sujeto" id="suj-${i}" style="--c:${COLORES[i % COLORES.length]}"><i></i><span class="tenue">cargando…</span>
        <button class="boton-mini" data-quitar-s="${i}" aria-label="Quitar">✕</button></span>`).join('')}</div>
      ${st.sujetos.length < 6 ? `<div id="comp-nuevo" class="filtros" style="margin-top:.75rem"></div>` : '<p class="muy-tenue">Máximo 6 a la vez.</p>'}</div>
    <div class="tarjeta seccion"><h2>Qué cifras</h2>
      <div class="filtros">${pildoras('c-preset', Object.keys(PRESETS[st.nivel]).map(k => [k, k]), '')}
        <label>Añadir otra<select id="c-anadir-m"><option value="">Elige…</option>${opcionesMetricas(catalogo, '')}</select></label></div>
      <div class="sujetos">${st.metricas.filter(k => K[k]).map(k => `<span class="sujeto"><span>${esc(K[k].n)}</span><button class="boton-mini" data-quitar-m="${k}" aria-label="Quitar">✕</button></span>`).join('')}</div></div>
    <div class="filtros seccion">
      <label>Ver como${pildoras('c-modo', [['valor', 'Valor'], ['percentil', 'Percentil'], ['dif', 'Diferencia'], ['difpct', 'Diferencia %']], st.modo)}</label>
      ${st.modo.startsWith('dif') ? `<label>Respecto a<select id="c-ref">${st.sujetos.map((s, i) => `<option value="${i}" ${i === st.ref ? 'selected' : ''} id="ref-${i}">Elemento ${i + 1}</option>`).join('')}</select></label>` : ''}
      <label>Gráfico${pildoras('c-graf', [['barras', 'Barras'], ['radar', 'Radar'], ['evolucion', 'Evolución'], ['dispersion', 'Dispersión']], st.grafico)}</label>
      ${st.grafico === 'evolucion' ? `<label class="check"><input type="checkbox" id="c-acum" ${st.acum ? 'checked' : ''}> Media acumulada</label>` : ''}</div>
    <div id="comp-resultado"><p class="tenue">Calculando…</p></div>`;
};

async function pintarNuevo(st, nuevo, cambiar) {
  const caja = document.getElementById('comp-nuevo');
  if (!caja) return;
  const ix = await ixDe(nuevo.t);
  const tipos = TIPOS[st.nivel];
  if (!tipos.some(x => x[0] === nuevo.tipo)) nuevo.tipo = tipos[0][0];
  const opt = (lista, sel) => lista.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const jugadorasOpc = () => [...ix.d.jugadoras].filter(j => j.tot.min > 0).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(j => [j.id, `${j.nombre} · ${ix.equipos[j.equipo]?.nombre || ''}`]);
  const equiposOpc = () => [...ix.jugadas].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(e => [e.id, e.nombre]);
  const partidosOpc = () => [...ix.d.partidos].reverse().map(p => [p.id, `J${p.jornada} · ${ix.equipos[p.local]?.nombre} ${p.puntos[0]}-${p.puntos[1]} ${ix.equipos[p.visitante]?.nombre}`]);
  let campos = '';
  if (nuevo.tipo === 'jugadora') campos = `<label>Jugadora<select id="n-id">${opt(jugadorasOpc(), nuevo.id)}</select></label>`;
  if (nuevo.tipo === 'puesto') campos = `<label>Puesto<select id="n-id">${opt(PUESTOS_OPC, nuevo.id)}</select></label>`;
  if (nuevo.tipo === 'equipo_j' || nuevo.tipo === 'equipo') campos = `<label>Equipo<select id="n-id">${opt(equiposOpc(), nuevo.id)}</select></label>`;
  if (nuevo.tipo === 'partido_j') campos = `<label>Partido<select id="n-id">${opt(partidosOpc(), nuevo.id)}</select></label><label>De<select id="n-id2">${opt([['todas', 'Los dos equipos'], ['0', 'El local'], ['1', 'El visitante']], nuevo.id2)}</select></label>`;
  if (nuevo.tipo === 'partido_e') campos = `<label>Partido<select id="n-id">${opt(partidosOpc(), nuevo.id)}</select></label><label>Equipo<select id="n-id2">${opt([['0', 'El local'], ['1', 'El visitante']], nuevo.id2)}</select></label>`;
  if (nuevo.tipo === 'actuacion') {
    const j = ix.jugadoras[nuevo.id] || ix.jugadoras[jugadorasOpc()[0]?.[0]];
    campos = `<label>Jugadora<select id="n-id">${opt(jugadorasOpc(), j?.id)}</select></label>
      <label>Partido<select id="n-id2">${opt(j ? [...j.log].reverse().map(x => [x[0], `J${x[1]} ${x[3] ? 'vs' : 'en'} ${ix.equipos[x[2]]?.nombre} · ${x[7]} pts`]) : [], nuevo.id2)}</select></label>`;
  }
  if (nuevo.tipo === 'entrenador') {
    const ents = Object.entries(INDICE.entrenadores || {}).filter(([, c]) => c.temporadas.some(x => String(x[0]) === String(nuevo.t)))
      .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre)).map(([id, c]) => [id, `${c.nombre} · ${c.temporadas.find(x => String(x[0]) === String(nuevo.t))[2]}`]);
    campos = `<label>Entrenador<select id="n-id">${opt(ents, nuevo.id)}</select></label><label>Qué<select id="n-id2">${opt([['temporada', 'Esa temporada'], ['carrera', 'Toda su carrera']], nuevo.id2)}</select></label>`;
  }
  caja.innerHTML = `<label>Añadir<select id="n-tipo">${opt(tipos, nuevo.tipo)}</select></label>
    <label>Temporada<select id="n-t">${opt(INDICE.temporadas.map(x => [x.temporada, x.nombre]), nuevo.t)}</select></label>${campos}
    <button class="boton" type="button" id="n-ok">Añadir</button>`;
  const leerCampos = () => { const a = document.getElementById('n-id'), b = document.getElementById('n-id2'); nuevo.id = a ? a.value : undefined; nuevo.id2 = b ? b.value : undefined; };
  document.getElementById('n-tipo').addEventListener('change', ev => { nuevo.tipo = ev.target.value; nuevo.id = nuevo.id2 = undefined; pintarNuevo(st, nuevo, cambiar); });
  document.getElementById('n-t').addEventListener('change', ev => { nuevo.t = Number(ev.target.value); nuevo.id = nuevo.id2 = undefined; caja.innerHTML = '<span class="tenue">Cargando la temporada…</span>'; pintarNuevo(st, nuevo, cambiar); });
  const id1 = document.getElementById('n-id');
  if (id1 && nuevo.tipo === 'actuacion') id1.addEventListener('change', () => { nuevo.id = id1.value; nuevo.id2 = undefined; pintarNuevo(st, nuevo, cambiar); });
  document.getElementById('n-ok').addEventListener('click', () => {
    leerCampos();
    st.sujetos.push({tipo: nuevo.tipo, t: nuevo.t, ...(nuevo.id !== undefined ? {id: nuevo.id} : {}), ...(nuevo.id2 !== undefined ? {id2: nuevo.id2} : {})});
    cambiar();
  });
}

async function pintarResultado(st, catalogo, K) {
  const caja = document.getElementById('comp-resultado');
  const res = await Promise.all(st.sujetos.map(s => resolver(s).catch(() => null)));
  if (!document.body.contains(caja)) return;
  res.forEach((r, i) => {
    const el = document.getElementById('suj-' + i);
    if (el) el.innerHTML = `<i></i><span><b>${esc(r ? r.nombre : 'No encontrado')}</b><span class="muy-tenue"> ${esc(r ? r.detalle : '')}</span></span><button class="boton-mini" data-quitar-s="${i}" aria-label="Quitar">✕</button>`;
    const op = document.getElementById('ref-' + i);
    if (op && r) op.textContent = r.nombre;
  });
  document.querySelectorAll('[data-quitar-s]').forEach(b => b.addEventListener('click', () => { st.sujetos.splice(Number(b.dataset.quitarS), 1);
    history.replaceState(null, '', enlaceComparador(st)); pintar.ultima = location.hash; pintar(); }));
  const ok = res.map((r, i) => ({r, i, color: COLORES[i % COLORES.length]})).filter(x => x.r && x.r.nivel === st.nivel);
  const ms = st.metricas.map(k => K[k]).filter(Boolean);
  if (!ok.length || !ms.length) { caja.innerHTML = '<p class="tenue">Añade al menos una cosa que comparar y una cifra.</p>'; return; }
  // base para los percentiles: jugadoras con minutos (o equipos) de la temporada de cada elemento
  const bases = {};
  for (const x of ok) { const ix = await ixDe(x.r.t); bases[x.r.t] = st.nivel === 'j' ? ix.cualificadas.map(j => conSinAdjunto(ix, j)) : ix.jugadas; }
  const valor = (x, m) => { const v = m.v(x.r.obj); return typeof v === 'number' && !Number.isNaN(v) ? v : null; };
  const perc = (x, m) => percentil(valor(x, m), bases[x.r.t].map(m.v).filter(v => v != null), m.inv);
  const refX = ok.find(x => x.i === st.ref) || ok[0];
  const mostrar = (x, m) => {
    const v = valor(x, m);
    if (st.modo === 'percentil') return perc(x, m);
    if (st.modo === 'dif') { const r = valor(refX, m); return v == null || r == null ? null : v - r; }
    if (st.modo === 'difpct') { const r = valor(refX, m); return v == null || r == null || !r ? null : 100 * (v - r) / Math.abs(r); }
    return v;
  };
  const texto = (x, m) => { const v = mostrar(x, m); if (v == null) return '–';
    return st.modo === 'percentil' ? fmt(v, 0) : st.modo === 'dif' ? signo(v, m.d) : st.modo === 'difpct' ? signo(v, 0) + ' %' : fmt(v, m.d); };
  const modoTxt = {valor: '', percentil: 'Percentil (0-100) frente a la liga de su temporada.', dif: `Diferencia con «${refX.r.nombre}».`, difpct: `Diferencia en % con «${refX.r.nombre}».`}[st.modo];
  let grafico = '';
  if (st.grafico === 'barras') {
    grafico = `<div class="rejilla-2">${ms.map(m => `<div class="tarjeta"><h3 title="${esc(m.i || '')}">${esc(m.n)}${m.inv ? ' <span class="muy-tenue">(menos es mejor)</span>' : ''}</h3>
      ${barrasH(ok.map(x => ({n: `<span style="color:${x.color}">●</span> ${esc(x.r.nombre)}`, v: mostrar(x, m) ?? 0, texto: texto(x, m), color: x.color,
        tip: `<b>${esc(x.r.nombre)}</b><br>${esc(m.n)}: ${fmt(valor(x, m), m.d)}<br>Percentil: ${perc(x, m) ?? '–'}`})), {d: m.d})}</div>`).join('')}</div>`;
  } else if (st.grafico === 'radar') {
    grafico = ms.length < 3 ? '<p class="aviso">El radar necesita al menos 3 cifras.</p>' : `<div class="tarjeta">
      <div class="leyenda">${ok.map(x => `<span style="--c:${x.color}">${esc(x.r.nombre)}</span>`).join('')}</div>
      ${radar(ok.map(x => ({nombre: x.r.nombre, color: x.color, valores: ms.map(m => perc(x, m))})), ms.map(m => m.c))}
      <p class="muy-tenue">El radar siempre muestra percentiles (0 en el centro, 100 en el borde), para que cifras de escalas distintas se puedan comparar.</p></div>`;
  } else if (st.grafico === 'evolucion') {
    const m = ms.find(mm => (st.nivel === 'j' ? EVOL_J : EVOL_E)[mm.k]) || null;
    const f = m && (st.nivel === 'j' ? EVOL_J : EVOL_E)[m.k];
    const conSerie = ok.filter(x => x.r.serie);
    if (!m) grafico = `<p class="aviso">La evolución se puede ver con: ${Object.keys(st.nivel === 'j' ? EVOL_J : EVOL_E).map(k => esc(K[k]?.n || k)).join(', ')}. Añade alguna de esas cifras.</p>`;
    else {
      const series = conSerie.map(x => { let s = x.r.serie(f).filter(p => p[1] != null);
        if (st.acum) { let sum = 0; s = s.map(([jn, v], i) => { sum += v; return [jn, sum / (i + 1)]; }); }
        return {x, puntos: new Map(s)}; });
      const jornadas = [...new Set(series.flatMap(s => [...s.puntos.keys()]))].sort((a, b) => a - b);
      grafico = `<div class="tarjeta"><h3>${esc(m.n)} por jornada${st.acum ? ' (media acumulada)' : ''}</h3>
        <div class="leyenda">${series.map(s => `<span style="--c:${s.x.color}">${esc(s.x.r.nombre)}</span>`).join('')}</div>
        ${lineas(series.map(s => ({nombre: s.x.r.nombre, color: s.x.color, valores: jornadas.map(j => s.puntos.get(j) ?? null)})), jornadas.map(j => 'J' + j), {alto: 300, d: m.d})}
        <p class="muy-tenue">${ms.length > 1 ? `Se muestra la primera cifra que tiene evolución (${esc(m.n)}). ` : ''}${conSerie.length < ok.length ? 'Las actuaciones, los partidos y las carreras de entrenador no tienen evolución.' : ''}
        Si se mezclan temporadas, la jornada es la de cada una.</p></div>`;
    }
  } else if (st.grafico === 'dispersion') {
    if (ms.length < 2) grafico = '<p class="aviso">La dispersión necesita al menos 2 cifras (eje horizontal y vertical: las dos primeras).</p>';
    else {
      const [mx, my] = ms, base = bases[ok[0].r.t];
      const fondo = base.map(o => ({x: mx.v(o), y: my.v(o), color: 'var(--texto-3)', tip: `<b>${esc(o.nombre)}</b><br>${mx.c}: ${fmt(mx.v(o), mx.d)} · ${my.c}: ${fmt(my.v(o), my.d)}`}));
      const ellos = ok.map(x => ({x: valor(x, mx), y: valor(x, my), color: x.color, destacado: true, texto: x.r.nombre.slice(0, 22),
        tip: `<b>${esc(x.r.nombre)}</b><br>${mx.c}: ${fmt(valor(x, mx), mx.d)} · ${my.c}: ${fmt(valor(x, my), my.d)}`}));
      grafico = `<div class="tarjeta">${dispersion([...fondo, ...ellos], mx, my)}
        <p class="muy-tenue">En gris, ${st.nivel === 'j' ? 'todas las jugadoras con minutos' : 'todos los equipos'} de ${nombreTemp(ok[0].r.t)}; en color, lo que se compara. Ejes: las dos primeras cifras elegidas.</p></div>`;
    }
  }
  const tablaHtml = `<div class="tarjeta seccion"><h2>Tabla</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">Cifra</th>${ok.map(x => `<th><span style="color:${x.color}">●</span> ${esc(x.r.nombre)}</th>`).join('')}</tr></thead><tbody>
    ${ms.map(m => `<tr><td class="izq" title="${esc(m.i || '')}">${esc(m.n)}</td>${ok.map(x => `<td><b>${texto(x, m)}</b>${st.modo !== 'valor' ? `<div class="muy-tenue">${fmt(valor(x, m), m.d)}</div>` : `<div class="muy-tenue">P${perc(x, m) ?? '–'}</div>`}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div><p class="muy-tenue">${modoTxt} ${st.modo === 'valor' ? 'Debajo, el percentil frente a la liga de su temporada.' : 'Debajo, el valor real.'}
    Las medias de grupos están ponderadas por minutos; las de partidos y actuaciones solo tienen las cifras del acta.</p></div>`;
  caja.innerHTML = grafico + tablaHtml;
}
