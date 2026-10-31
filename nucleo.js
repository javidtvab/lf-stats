// LF Stats · núcleo: carga de datos, utilidades, catálogo de métricas, tablas ordenables y gráficos SVG.
// Las vistas (vistas_*.js) se apoyan en esto. Sin dependencias.
'use strict';

const $vista = document.getElementById('vista');
const $tip = document.getElementById('tip');
let COMPETICIONES = [];  // las competiciones y sus temporadas (datos/competiciones.js)
let COMP = null;         // la competición elegida (una de COMPETICIONES)
let INDICE = {temporadas: [], historial: {}, parecidas: {}, familias: [], nombres: {}};   // el de la competición elegida
let JUG = {filas: {}, nombres: {}};   // lo de cada jugadora en cada competición (datos/jugadoras.js)
let T = null;        // temporada elegida (window.LF_T["competición/temporada"])
let IDX = {};        // índices de la temporada

// ---------------------------------------------------------------- utilidades
const guardar = (k, v) => { try { localStorage.setItem('lfstats:' + k, v); } catch (e) { /* sin almacenamiento */ } };
const leer = k => { try { return localStorage.getItem('lfstats:' + k); } catch (e) { return null; } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = (x, d = 1) => x == null || Number.isNaN(x) ? '–' : Number(x).toLocaleString('es-ES', {minimumFractionDigits: d, maximumFractionDigits: d});
const pct = (a, b) => b ? 100 * a / b : null;
const signo = (x, d = 0) => x == null ? '–' : (x > 0 ? '+' : '') + fmt(x, d);
const minutos = m => { const s = Math.round(m * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const eq = id => IDX.equipos[id] || {nombre: '?', id};
const linkEq = id => `<a href="#/equipo/${id}">${esc(eq(id).nombre)}</a>`;
const linkJu = (id, texto) => { const j = IDX.jugadoras[id]; return j ? `<a href="#/jugadora/${id}">${esc(texto || j.nombre)}</a>` : esc(INDICE.nombres[id] || '?'); };
const h = (strings, ...vals) => strings.reduce((s, str, i) => s + str + (i < vals.length ? vals[i] : ''), '');
const media = l => l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
const despues = f => setTimeout(f);   // engancha eventos cuando la vista ya está en el DOM

// los datos ya descifrados se guardan aquí para no volver a cargarlos
window.LF_T = window.LF_T || {};
window.LF_I = window.LF_I || {};

async function cargarIndiceCompeticion(c) {
  if (!window.LF_I[c]) window.LF_I[c] = await cargarDatos(`datos/${c}/indice.js`, `${c}/indice`, () => window.LF_I[c]);
  return window.LF_I[c];
}

async function cargarTemporada(t) {
  const k = `${COMP.clave}/${t}`;
  if (!window.LF_T[k]) window.LF_T[k] = await cargarDatos(`datos/${COMP.clave}/t${t}.js`, `${COMP.clave}/t${t}`, () => window.LF_T[k]);
  return window.LF_T[k];
}

// grupos de la clasificación: con un solo grupo, la clasificación de siempre; con varios (LF2, campeonatos), los de
// tres equipos o más son ligas (con tabla) y los de dos, cruces
function gruposTemporada() {
  if (!T.grupos) {
    const orden = T.evolucion[T.jornadas[T.jornadas.length - 1]] || [];
    return [{id: '', nombre: '', liga: true, filas: orden.map(id => [id]), evolucion: T.evolucion, completa: true}];
  }
  return T.grupos.map(g => ({...g, liga: g.filas.length >= 3}));
}

function elegirTemporada(datos) {
  T = datos;
  IDX = {equipos: {}, jugadoras: {}, partidos: {}};
  T.equipos.forEach(e => IDX.equipos[e.id] = e);
  T.jugadoras.forEach(j => IDX.jugadoras[j.id] = j);
  T.partidos.forEach(p => IDX.partidos[p.id] = p);
  IDX.maxPJ = Math.max(1, ...T.equipos.map(e => e.pj || 0));
  // clasificación de cada grupo (con sus partidos) y la de todos los equipos, cada uno en el primer grupo en que juega
  IDX.grupos = gruposTemporada().map(g => {
    const js = Object.keys(g.evolucion || {}).map(Number).sort((a, b) => a - b);
    const antes = (g.evolucion || {})[js[js.length - 2]] || [];
    const filas = g.filas.map(([id, pj, pg, pf, pc, racha], i) => ({
      ...eq(id), ...(g.completa ? {} : {pj, pg, pf, pc, racha}), pos: i + 1, grupo: g.id,
      cambio: antes.indexOf(id) >= 0 ? antes.indexOf(id) - i : 0}));
    return {...g, jornadas: js, filas};
  });
  IDX.grupoDe = {};
  IDX.clasificacion = [];
  IDX.grupos.forEach(g => g.filas.forEach(e => {
    if (IDX.grupoDe[e.id]) return;
    IDX.grupoDe[e.id] = g;
    IDX.clasificacion.push(e);
  }));
  IDX.jugadas = T.equipos.filter(e => e.pj);
  document.getElementById('temporada').value = T.temporada;
  document.getElementById('actualizado').textContent = `Datos actualizados: ${new Date(T.actualizado).toLocaleString('es-ES', {dateStyle: 'long', timeStyle: 'short'})}.`;
  guardar('temporada', T.temporada);
}

// ---------------------------------------------------------------- catálogo de métricas de jugadora
// k: clave; n: nombre; c: abreviatura de columna; v: valor; d: decimales; inv: menos es mejor; g: grupo; i: explicación
const MJ = [];
const mj = (g, k, n, c, v, d = 1, extra = {}) => MJ.push({g, k, n, c, v, d, ...extra});
// Por partido
mj('Por partido', 'min', 'Minutos', 'Min', j => j.med.min);
mj('Por partido', 'pts', 'Puntos', 'Pts', j => j.med.pts);
mj('Por partido', 'trb', 'Rebotes', 'Reb', j => j.med.trb);
mj('Por partido', 'orb', 'Rebotes ofensivos', 'RO', j => j.med.orb);
mj('Por partido', 'drb', 'Rebotes defensivos', 'RD', j => j.med.drb);
mj('Por partido', 'ast', 'Asistencias', 'Ast', j => j.med.ast);
mj('Por partido', 'stl', 'Robos', 'Rob', j => j.med.stl);
mj('Por partido', 'blk', 'Tapones', 'Tap', j => j.med.blk);
mj('Por partido', 'tov', 'Pérdidas', 'Pér', j => j.med.tov, 1, {inv: true});
mj('Por partido', 'blka', 'Tapones recibidos', 'TapR', j => j.med.blka, 1, {inv: true});
mj('Por partido', 'pf', 'Faltas cometidas', 'FC', j => j.med.pf, 1, {inv: true});
mj('Por partido', 'pfd', 'Faltas recibidas', 'FR', j => j.med.pfd);
mj('Por partido', 'pir', 'Valoración', 'Val', j => j.med.pir);
mj('Por partido', 'gmsc', 'Game Score', 'GmSc', j => j.gmsc, 1, {i: 'Productividad de Hollinger: 10 es un partido normal, 40 uno extraordinario'});
mj('Por partido', 'pm', '+/-', '+/-', j => j.med.pm);
mj('Por partido', 'fg', 'Tiros de campo anotados', 'TC', j => j.med.fg);
mj('Por partido', 'fga', 'Tiros de campo intentados', 'TCI', j => j.med.fga);
mj('Por partido', 'p2', 'Tiros de dos anotados', 'T2', j => j.med.p2);
mj('Por partido', 'p2a', 'Tiros de dos intentados', 'T2I', j => j.med.p2a);
mj('Por partido', 'p3', 'Triples anotados', 'T3', j => j.med.p3);
mj('Por partido', 'p3a', 'Triples intentados', 'T3I', j => j.med.p3a);
mj('Por partido', 'ft', 'Tiros libres anotados', 'TL', j => j.med.ft);
mj('Por partido', 'fta', 'Tiros libres intentados', 'TLI', j => j.med.fta);
// Por 40 minutos y por 100 posesiones
for (const [k, n, inv] of [['pts', 'Puntos'], ['trb', 'Rebotes'], ['orb', 'Rebotes ofensivos'], ['drb', 'Rebotes defensivos'], ['ast', 'Asistencias'],
  ['stl', 'Robos'], ['blk', 'Tapones'], ['tov', 'Pérdidas', true], ['pf', 'Faltas', true], ['pfd', 'Faltas recibidas'], ['pir', 'Valoración'],
  ['p3', 'Triples'], ['fta', 'Tiros libres intentados'], ['fga', 'Tiros de campo intentados']]) {
  mj('Por 40 minutos', k + '40', n + ' por 40 min', n.split(' ')[0].slice(0, 4) + '/40', j => j.p40[k], 1, {inv});
  mj('Por 100 posesiones', k + '100', n + ' por 100 pos.', n.split(' ')[0].slice(0, 4) + '/100', j => j.p100[k], 1, {inv});
}
// Tiro
mj('Tiro', 'ts', 'Tiro real (TS%)', 'TS%', j => j.av.ts, 1, {i: 'Puntos por cada dos tiros, contando los libres (0,44 por intento)'});
mj('Tiro', 'efg', 'Tiro efectivo (eFG%)', 'eFG%', j => j.av.efg, 1, {i: 'Tiro de campo en el que el triple vale 1,5'});
mj('Tiro', 'fgp', '% tiro de campo', 'TC%', j => j.av.fg);
mj('Tiro', 'p2p', '% de dos', 'T2%', j => j.av.p2);
mj('Tiro', 'p3p', '% de triple', 'T3%', j => j.av.p3);
mj('Tiro', 'ftp', '% de tiro libre', 'TL%', j => j.av.ft);
mj('Tiro', 'p3r', 'Frecuencia de triple', 'T3I/TCI', j => j.av.p3r, 1, {i: '% de sus tiros de campo que son triples'});
mj('Tiro', 'ftr', 'Tiros libres por tiro', 'TLI/TCI', j => j.av.ftr, 2, {i: 'Tiros libres intentados por tiro de campo: cuánto provoca faltas'});
mj('Tiro', 'ft_rate', 'Tasa de tiro libre', 'TL/TCI', j => j.av.ft_rate, 2, {i: 'Tiros libres anotados por tiro de campo (Oliver)'});
mj('Tiro', 'pps', 'Puntos por tiro', 'Pts/TC', j => j.av.pps, 2);
mj('Tiro', 'ppt', 'Puntos por intento', 'Pts/Int', j => j.av.ppt, 2, {i: 'Puntos por intento de tiro, contando los libres'});
// Avanzadas
mj('Avanzadas', 'usg', 'Uso (USG%)', 'USG%', j => j.av.usg, 1, {i: '% de las posesiones de su equipo que acaba ella (tiro, libres o pérdida) mientras está en pista'});
mj('Avanzadas', 'ast_pct', '% de asistencias', 'AST%', j => j.av.ast_pct, 1, {i: '% de las canastas de sus compañeras que asiste mientras está en pista'});
mj('Avanzadas', 'tov_pct', '% de pérdidas', 'PÉR%', j => j.av.tov_pct, 1, {inv: true, i: '% de sus jugadas que acaban en pérdida'});
mj('Avanzadas', 'orb_pct', '% rebote ofensivo', 'RO%', j => j.av.orb_pct, 1, {i: '% de los rebotes ofensivos disponibles que coge mientras está en pista'});
mj('Avanzadas', 'drb_pct', '% rebote defensivo', 'RD%', j => j.av.drb_pct, 1, {i: '% de los rebotes defensivos disponibles que coge'});
mj('Avanzadas', 'trb_pct', '% rebote total', 'REB%', j => j.av.trb_pct);
mj('Avanzadas', 'stl_pct', '% de robos', 'ROB%', j => j.av.stl_pct, 1, {i: '% de las posesiones rivales que acaban en robo suyo'});
mj('Avanzadas', 'blk_pct', '% de tapones', 'TAP%', j => j.av.blk_pct, 1, {i: '% de los tiros de dos rivales que tapona'});
mj('Avanzadas', 'ast_tov', 'Asistencias por pérdida', 'AST/PÉR', j => j.av.ast_tov, 2);
mj('Avanzadas', 'ast_ratio', 'Ratio de asistencias', 'ASTr', j => j.av.ast_ratio, 1, {i: '% de sus jugadas que acaban en asistencia (Hollinger)'});
mj('Avanzadas', 'pts_share', '% de los puntos del equipo', '%PTS', j => j.av.pts_share);
mj('Avanzadas', 'ortg', 'Rating ofensivo individual', 'ORtg', j => j.av.ortg, 1, {i: 'Puntos que produce por cada 100 posesiones que usa (Dean Oliver)'});
mj('Avanzadas', 'drtg', 'Rating defensivo individual', 'DRtg', j => j.av.drtg, 1, {inv: true, i: 'Puntos que encaja su equipo por 100 posesiones con lo que ella frena (Oliver; menos es mejor)'});
mj('Avanzadas', 'netrtg_ind', 'Rating neto individual', 'Neto', j => j.av.netrtg_ind);
mj('Avanzadas', 'floor', '% de posesiones con puntos', 'Floor%', j => j.av.floor, 1, {i: '% de las posesiones que usa que acaban en puntos (Oliver)'});
mj('Avanzadas', 'per', 'PER', 'PER', j => j.av.per, 1, {i: 'Player Efficiency Rating de Hollinger: la media de la liga es 15'});
mj('Avanzadas', 'ows', 'Win Shares ofensivos', 'OWS', j => j.av.ows, 2);
mj('Avanzadas', 'dws', 'Win Shares defensivos', 'DWS', j => j.av.dws, 2);
mj('Avanzadas', 'ws', 'Win Shares', 'WS', j => j.av.ws, 2, {i: 'Victorias que aporta (ataque + defensa)'});
mj('Avanzadas', 'ws40', 'Win Shares por 40 min', 'WS/40', j => j.av.ws40, 3, {i: 'Victorias aportadas por cada 40 minutos; ~0,100 es la media'});
mj('Avanzadas', 'pm40', '+/- por 40 min', '+/-/40', j => j.av.pm40);
mj('Avanzadas', 'con', 'Neto con ella en pista', 'Con', j => j.con, 1, {i: 'Diferencia de puntos de su equipo por 40 minutos con ella en pista'});
mj('Avanzadas', 'sin', 'Neto con ella en el banquillo', 'Sin', j => j.sin, 1, {inv: true, i: 'Diferencia de puntos por 40 min de su equipo sin ella (en los partidos que jugó)'});
mj('Avanzadas', 'onoff', 'Con y sin (diferencia)', 'On-Off', j => j.onoff, 1, {i: 'Con menos sin: cuánto mejora el equipo con ella en pista'});
mj('Avanzadas', 'bpm', 'Box Plus/Minus (BPM)', 'BPM', j => j.av.bpm, 1, {i: 'Puntos por 100 posesiones que aporta por encima de una jugadora media (modelo BPM 2.0 de Basketball-Reference)'});
mj('Avanzadas', 'obpm', 'BPM ofensivo', 'OBPM', j => j.av.obpm);
mj('Avanzadas', 'dbpm', 'BPM defensivo', 'DBPM', j => j.av.dbpm);
mj('Avanzadas', 'vorp', 'Valor sobre reemplazo (VORP)', 'VORP', j => j.av.vorp, 2, {i: 'BPM por encima de una jugadora de reemplazo (−2), por los minutos jugados y la parte de la temporada'});
mj('Avanzadas', 'pie', 'Player Impact Estimate (PIE)', 'PIE', j => j.av.pie, 1, {i: '% de todo lo que pasó en sus partidos (los dos equipos) que hizo ella (NBA)'});
mj('Avanzadas', 'eff', 'Eficiencia NBA (EFF)', 'EFF', j => j.av.eff, 1, {i: 'PTS + REB + AST + ROB + TAP − tiros fallados − pérdidas, por partido'});
mj('Avanzadas', 'win_score40', 'Win Score por 40 min', 'WinS/40', j => j.av.win_score40, 1, {i: 'Índice de David Berri: premia el rebote y castiga los tiros fallados'});
mj('Avanzadas', 'pos_est', 'Puesto estimado por sus cifras', 'PosEst', j => j.av.pos_est, 1, {i: '1 = base, 5 = pívot, según lo que hace (rebotes, asistencias, tapones…), como en BPM'});
mj('Tiro', 'pts_anadidos', 'Puntos añadidos por su tiro', 'PtsAñ', j => j.av.pts_anadidos, 0, {i: 'Puntos que ha sumado por encima (o por debajo) de lo que haría una tiradora media de la liga con los mismos tiros'});
mj('Tiro', 'rts', 'Tiro real respecto a la liga', 'rTS%', j => j.av.rts, 1, {i: 'Su TS% menos el de la liga'});
mj('Tiro', 'comp3', 'Competencia en el triple', '3PComp', j => j.av.comp3, 3, {i: 'El % de triple pesado por el volumen (Thinking Basketball): premia meter muchos y bien'});
mj('Tiro', 'p3_est', '% de triple estabilizado', 'T3%est', j => j.av.p3_est, 1, {i: 'Su % de triple como si hubiera tirado 200 más a la media de la liga: corrige las muestras pequeñas'});
mj('Tiro', 'ft_est', '% de tiro libre estabilizado', 'TL%est', j => j.av.ft_est, 1, {i: 'Igual, con 100 tiros libres a la media de la liga'});
mj('Por 40 minutos', 'stocks40', 'Robos + tapones por 40 min', 'Stocks/40', j => j.av.stocks40, 1, {i: '«Stocks»: acciones defensivas que se ven en el acta'});
// Tiro ajustado (Basketball-Reference): 100 = la media de la liga
for (const [k, n] of [['fg', 'Tiro de campo'], ['p2', 'Tiro de dos'], ['p3', 'Triple'], ['efg', 'Tiro efectivo'], ['ft', 'Tiro libre'], ['ts', 'Tiro real'],
  ['ftr', 'Tiros libres por tiro'], ['p3r', 'Frecuencia de triple']]) {
  mj('Tiro ajustado', k + '_mas', n + ' (100 = media)', {fg: 'FG+', p2: '2P+', p3: '3P+', efg: 'eFG+', ft: 'FT+', ts: 'TS+', ftr: 'FTr+', p3r: '3PAr+'}[k],
    j => j.av[k + '_mas'], 0, {i: 'Su cifra respecto a la media de la liga: 100 es la media, 110 un 10 % mejor'});
}
mj('Tiro ajustado', 'fg_add', 'Puntos añadidos por su tiro de campo', 'FG Add', j => j.av.fg_add, 0, {i: 'Puntos de más (o de menos) que su tiro de campo efectivo respecto a la media de la liga'});
mj('Tiro ajustado', 'ts_add', 'Puntos añadidos por su tiro real', 'TS Add', j => j.av.pts_anadidos, 0, {i: 'Igual, contando los tiros libres'});
// Regularidad
mj('Regularidad', 'gmsc_sd', 'Irregularidad (desv. Game Score)', 'σGmSc', j => j.cons.gmsc_sd, 1, {inv: true});
mj('Regularidad', 'pts_sd', 'Irregularidad anotadora (desv. puntos)', 'σPts', j => j.cons.pts_sd, 1, {inv: true});
mj('Regularidad', 'dd', 'Dobles-dobles', 'DD', j => j.cons.dd, 0);
mj('Regularidad', 'td', 'Triples-dobles', 'TD', j => j.cons.td, 0);
mj('Regularidad', 'p20', 'Partidos de 20+ puntos', '20+', j => j.cons.p20, 0);
mj('Regularidad', 'p10', 'Partidos de 10+ puntos', '10+', j => j.cons.p10, 0);
mj('Totales', 'pj', 'Partidos', 'PJ', j => j.pj, 0);
mj('Totales', 'tit', 'Titularidades', 'Tit', j => j.tit, 0);
mj('Totales', 'tmin', 'Minutos totales', 'MinT', j => j.tot.min, 0);
mj('Totales', 'tpts', 'Puntos totales', 'PtsT', j => j.tot.pts, 0);
mj('Totales', 'ttrb', 'Rebotes totales', 'RebT', j => j.tot.trb, 0);
mj('Totales', 'tast', 'Asistencias totales', 'AstT', j => j.tot.ast, 0);
mj('Totales', 'tp3', 'Triples totales', 'T3T', j => j.tot.p3, 0);
mj('Totales', 'tpir', 'Valoración total', 'ValT', j => j.tot.pir, 0);
const MJK = Object.fromEntries(MJ.map(m => [m.k, m]));
const grupos = lista => [...new Set(lista.map(m => m.g))];

// ---------------------------------------------------------------- catálogo de métricas de equipo
const ME = [];
const me = (g, k, n, c, v, d = 1, extra = {}) => ME.push({g, k, n, c, v, d, ...extra});
me('Resultados', 'pg', 'Victorias', 'V', e => e.pg, 0);
me('Resultados', 'wpct', '% de victorias', 'V%', e => pct(e.pg, e.pj));
me('Resultados', 'pitag', 'Victorias esperadas (pitagóricas)', 'Pitag', e => e.pitag, 1, {i: 'Las que «tocarían» por puntos a favor y en contra (exponente 14)'});
me('Resultados', 'suerte', 'Suerte (victorias − esperadas)', 'Suerte', e => e.suerte, 1, {i: 'Positivo: ha ganado más de lo que dicen sus puntos (partidos apretados a favor)'});
me('Resultados', 'fuerza', 'Fuerza ajustada por rival', 'Fuerza', e => e.fuerza, 1, {i: 'Puntos por encima de un equipo medio en campo neutral, teniendo en cuenta a quién se ha enfrentado'});
me('Resultados', 'dif', 'Diferencia por partido', 'Dif', e => (e.pf - e.pc) / e.pj);
me('Resultados', 'srs', 'SRS (Simple Rating System)', 'SRS', e => e.srs, 2, {i: 'Diferencia media de puntos ajustada por la dificultad del calendario (Basketball-Reference)'});
me('Resultados', 'sos_srs', 'Dificultad del calendario (SRS)', 'SOS', e => e.sos_srs, 2, {i: 'SRS medio de sus rivales'});
me('Resultados', 'elo', 'Elo', 'Elo', e => e.elo, 0, {i: 'Rating Elo con margen de victoria, arrastrado de una temporada a otra (1500 es la media)'});
me('Resultados', 'sos', 'Dificultad del calendario (SOS)', 'SOS', e => e.sos, 1, {i: 'Fuerza media de los rivales a los que se ha enfrentado'});
me('Resultados', 'consistencia', 'Irregularidad (desv. del margen)', 'σDif', e => e.consistencia, 1, {inv: true, i: 'Cuánto varía su diferencia de puntos de un partido a otro'});
me('Resultados', 'campo_propio', 'Ventaja de jugar en casa', 'Casa', e => e.campo_propio, 1, {i: 'Mitad de la diferencia entre su neto en casa y fuera (por 100 posesiones)'});
me('Eficiencia', 'adj_ortg', 'Rating ofensivo ajustado por rival', 'AdjO', e => e.adj_ortg, 1, {i: 'ORtg corregido por lo bien que defienden sus rivales'});
me('Eficiencia', 'adj_drtg', 'Rating defensivo ajustado por rival', 'AdjD', e => e.adj_drtg, 1, {inv: true, i: 'DRtg corregido por lo bien que atacan sus rivales'});
me('Eficiencia', 'adj_net', 'Rating neto ajustado por rival', 'AdjNeto', e => e.adj_net);
me('Eficiencia', 'ortg', 'Rating ofensivo', 'ORtg', e => e.ortg, 1, {i: 'Puntos anotados por 100 posesiones'});
me('Eficiencia', 'drtg', 'Rating defensivo', 'DRtg', e => e.drtg, 1, {inv: true, i: 'Puntos encajados por 100 posesiones'});
me('Eficiencia', 'net', 'Rating neto', 'Neto', e => e.net);
me('Eficiencia', 'ritmo', 'Ritmo', 'Ritmo', e => e.ritmo, 1, {i: 'Posesiones por 40 minutos'});
for (const [lado, nombre, invDef] of [['ataque', '', false], ['defensa', ' (rival)', true]]) {
  const sfx = lado === 'ataque' ? '' : '_r';
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'efg' + sfx, 'Tiro efectivo' + nombre, 'eFG%' + (sfx ? ' r' : ''), e => e[lado].efg, 1, {inv: invDef});
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'tov' + sfx, 'Pérdidas por posesión' + nombre, 'PÉR%' + (sfx ? ' r' : ''), e => e[lado].tov, 1, {inv: !invDef});
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'orb' + sfx, 'Rebote ofensivo' + nombre, 'RO%' + (sfx ? ' r' : ''), e => e[lado].orb, 1, {inv: invDef});
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'ftr' + sfx, 'Tiros libres por tiro' + nombre, 'TL/TC' + (sfx ? ' r' : ''), e => e[lado].ftr, 1, {inv: invDef});
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'ts' + sfx, 'Tiro real' + nombre, 'TS%' + (sfx ? ' r' : ''), e => e[lado].ts, 1, {inv: invDef});
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'p2' + sfx, '% de dos' + nombre, 'T2%' + (sfx ? ' r' : ''), e => e[lado].p2, 1, {inv: invDef});
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'p3' + sfx, '% de triple' + nombre, 'T3%' + (sfx ? ' r' : ''), e => e[lado].p3, 1, {inv: invDef});
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'p3r' + sfx, 'Frecuencia de triple' + nombre, 'T3I%' + (sfx ? ' r' : ''), e => e[lado].p3r);
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'ast' + sfx, '% canastas asistidas' + nombre, 'AST%' + (sfx ? ' r' : ''), e => e[lado].ast);
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'stl' + sfx, 'Robos por posesión' + nombre, 'ROB%' + (sfx ? ' r' : ''), e => e[lado].stl, 1, {inv: invDef});
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'blk' + sfx, 'Tapones por tiro de dos' + nombre, 'TAP%' + (sfx ? ' r' : ''), e => e[lado].blk, 1, {inv: invDef});
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'pts3' + sfx, '% de puntos de triple' + nombre, '%P3' + (sfx ? ' r' : ''), e => e[lado].pts3);
  me(lado === 'ataque' ? 'Ataque' : 'Defensa', 'ptsft' + sfx, '% de puntos de tiro libre' + nombre, '%PTL' + (sfx ? ' r' : ''), e => e[lado].ptsft);
}
for (const [k, n, inv] of [['pts', 'Puntos'], ['trb', 'Rebotes'], ['orb', 'Rebotes ofensivos'], ['ast', 'Asistencias'], ['stl', 'Robos'], ['blk', 'Tapones'],
  ['tov', 'Pérdidas', true], ['pf', 'Faltas', true], ['p3', 'Triples'], ['p3a', 'Triples intentados'], ['fta', 'Tiros libres intentados']]) {
  me('Por 100 posesiones', k + '_100', n + ' por 100 pos.', n.split(' ')[0].slice(0, 4) + '/100', e => e.p100 && e.p100[k], 1, {inv});
  me('Rival por 100 posesiones', k + '_100r', n + ' del rival por 100 pos.', n.split(' ')[0].slice(0, 4) + '/100 r', e => e.p100_rival && e.p100_rival[k], 1, {inv: !inv});
  me('Rival por partido', k + '_r', n + ' del rival', n.split(' ')[0].slice(0, 4) + ' r', e => e.med_rival[k], 1, {inv: !inv});
}
me('Ataque', 'fta_rate', 'Tiros libres intentados por tiro', 'FTr', e => e.ataque.fta_rate, 1, {i: 'TLI / TCI (Basketball-Reference)'});
me('Defensa', 'fta_rate_r', 'Tiros libres intentados por tiro (rival)', 'FTr r', e => e.defensa.fta_rate, 1, {inv: true});
me('Por partido', 'ptsm', 'Puntos', 'Pts', e => e.med.pts);
me('Por partido', 'ptsc', 'Puntos encajados', 'PtsC', e => e.med_rival.pts, 1, {inv: true});
me('Por partido', 'trbm', 'Rebotes', 'Reb', e => e.med.trb);
me('Por partido', 'astm', 'Asistencias', 'Ast', e => e.med.ast);
me('Por partido', 'stlm', 'Robos', 'Rob', e => e.med.stl);
me('Por partido', 'blkm', 'Tapones', 'Tap', e => e.med.blk);
me('Por partido', 'tovm', 'Pérdidas', 'Pér', e => e.med.tov, 1, {inv: true});
me('Por partido', 'p3m', 'Triples', 'T3', e => e.med.p3);
me('Por partido', 'pfm', 'Faltas', 'FC', e => e.med.pf, 1, {inv: true});
me('Por partido', 'pirm', 'Valoración', 'Val', e => e.med.pir);
me('Plantilla', 'banq_pts', 'Puntos del banquillo', 'PtsBanq', e => e.banquillo.pts);
me('Plantilla', 'banq_min', '% de minutos del banquillo', '%MinBanq', e => e.banquillo.pct_min);
me('Plantilla', 'max_anot', '% de puntos de la máxima anotadora', '%Máx', e => e.max_anotadora, 1, {i: 'Dependencia de una sola jugadora'});
me('Plantilla', 'top3', '% de puntos de las 3 máximas', '%Top3', e => e.top3);
me('Plantilla', 'usadas', 'Jugadoras usadas', 'Usadas', e => e.jugadoras_usadas, 0);
me('Plantilla', 'top5_min', '% de minutos de las 5 que más juegan', '%Min5', e => e.top5_min, 1, {i: 'Lo corta o larga que es la rotación'});
me('Plantilla', 'quintetos_distintos', 'Quintetos titulares distintos', 'Quint.', e => (e.quintetos || []).length, 0);
me('Plantilla', 'edad', 'Edad media (por minutos)', 'Edad', e => e.edad_media);
me('Plantilla', 'altura', 'Altura media (por minutos)', 'Alt', e => e.altura_media);
me('Plantilla', 'formacion', '% de minutos de jugadoras de formación', '%Form', e => e.pct_formacion);
me('Plantilla', 'extranjeras', '% de minutos de extranjeras', '%Extr', e => e.pct_extranjeras);
const MEK = Object.fromEntries(ME.map(m => [m.k, m]));

// ---------------------------------------------------------------- percentiles
// Jugadoras comparables: al menos el 40 % de los partidos de su equipo y 10 minutos por partido.
function cualificadas(grupo) {
  return T.jugadoras.filter(j => j.pj >= Math.max(2, Math.ceil(0.4 * IDX.maxPJ)) && j.med.min >= 10 && (!grupo || j.grupo === grupo));
}
function percentil(valor, lista, inv) {
  if (valor == null || !lista.length) return null;
  let menos = 0, iguales = 0;
  lista.forEach(x => { if (inv ? x > valor : x < valor) menos++; else if (x === valor) iguales++; });
  return Math.round(100 * (menos + 0.5 * iguales) / lista.length);
}
function percentilesDe(obj, metricas, base) {
  return metricas.map(m => {
    const lista = base.map(m.v).filter(x => x != null);
    return {...m, valor: m.v(obj), p: percentil(m.v(obj), lista, m.inv), total: lista.length};
  });
}

// ---------------------------------------------------------------- tooltip
document.addEventListener('mousemove', ev => {
  const el = ev.target.closest && ev.target.closest('[data-tip]');
  if (!el) { $tip.hidden = true; return; }
  $tip.innerHTML = el.getAttribute('data-tip');
  $tip.hidden = false;
  const r = $tip.getBoundingClientRect();
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
  $tip.style.left = x + 'px'; $tip.style.top = y + 'px';
});
document.addEventListener('scroll', () => { $tip.hidden = true; }, {passive: true});

// ---------------------------------------------------------------- tablas ordenables
// columnas: [{t: título, v: fila => valor para ordenar, f: fila => html, izq, tip, clase}]
function tabla(id, filas, columnas, ordenInicial, opciones = {}) {
  const estado = tabla.estado[id] || (tabla.estado[id] = {col: ordenInicial, desc: opciones.asc ? false : true});
  const col = columnas[estado.col];
  const ordenadas = col && col.v ? [...filas].sort((a, b) => {
    const x = col.v(a), y = col.v(b);
    if (x == null) return 1; if (y == null) return -1;
    return (x < y ? -1 : x > y ? 1 : 0) * (estado.desc ? -1 : 1);
  }) : filas;
  const lim = opciones.limite ? ordenadas.slice(0, opciones.limite) : ordenadas;
  const pie = (opciones.pie || []).map(f => `<tr class="fila-pie">${columnas.map(c => `<td class="${c.izq ? 'izq' : ''} ${c.clase || ''}">${c.f(f, -1)}</td>`).join('')}</tr>`).join('');
  return `<div class="tabla-scroll"><table data-tabla="${id}" class="${opciones.clase || ''}"><thead><tr>${columnas.map((c, i) => `<th class="${c.izq ? 'izq ' : ''}${c.v ? 'ordenable' : ''}"
      ${c.v ? `data-col="${i}" tabindex="0"` : ''} ${i === estado.col ? `aria-sort="${estado.desc ? 'descending' : 'ascending'}"` : ''}
      ${c.tip ? `title="${esc(c.tip)}"` : ''}>${c.t}${i === estado.col ? (estado.desc ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>
    <tbody>${lim.map((f, n) => `<tr>${columnas.map(c => `<td class="${c.izq ? 'izq' : ''} ${c.clase || ''}">${c.f(f, n)}</td>`).join('')}</tr>`).join('')}</tbody>${pie ? `<tfoot>${pie}</tfoot>` : ''}</table></div>`;
}
tabla.estado = {};
function activarTablas(repintar, raiz = $vista) {
  raiz.querySelectorAll('th[data-col]').forEach(th => {
    const cambiar = () => {
      const id = th.closest('table').dataset.tabla, i = Number(th.dataset.col);
      const e = tabla.estado[id];
      if (e.col === i) e.desc = !e.desc; else { e.col = i; e.desc = true; }
      repintar();
    };
    th.addEventListener('click', cambiar);
    th.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cambiar(); } });
  });
}
// columna de una métrica del catálogo
const colM = (m, extra = {}) => ({t: m.c, tip: m.n + (m.i ? ': ' + m.i : ''), f: x => fmt(m.v(x), m.d), v: m.v, ...extra});
const opcionesMetricas = (lista, sel) => grupos(lista).map(g => `<optgroup label="${esc(g)}">${lista.filter(m => m.g === g)
  .map(m => `<option value="${m.k}" ${m.k === sel ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}</optgroup>`).join('');

// ---------------------------------------------------------------- piezas
const cifra = (valor, nombre, tip) => `<div class="cifra" ${tip ? `data-tip="${esc(tip)}"` : ''}><div class="cifra__valor">${valor}</div><div class="cifra__nombre">${nombre}</div></div>`;
const racha = r => `<span class="racha">${[...(r || '')].map(c => `<span class="${c}">${c}</span>`).join('')}</span>`;
const vd = wl => wl ? `${wl[0]}-${wl[1]}` : '–';
const pildoras = (id, opciones, actual) => `<span id="${id}" class="pildoras">${opciones.map(([k, t]) => `<button type="button" data-v="${esc(k)}" aria-pressed="${String(k) === String(actual)}">${t}</button>`).join('')}</span>`;
function alPulsar(id, f) { document.querySelectorAll(`#${id} button`).forEach(b => b.addEventListener('click', () => f(b.dataset.v))); }
function alCambiar(id, f) { const el = document.getElementById(id); if (el) el.addEventListener(el.tagName === 'INPUT' && el.type !== 'range' ? 'input' : 'change', ev => f(ev.target.value)); }
const partidoFila = p => {
  if (!p) return '';
  const g = p.puntos[0] > p.puntos[1];
  return `<a class="partido" href="#/partido/${p.id}"><span class="local ${g ? 'gana' : 'pierde'}">${esc(eq(p.local).nombre)}</span>
    <span class="marcador">${p.puntos[0]} - ${p.puntos[1]}</span><span class="${g ? 'pierde' : 'gana'}">${esc(eq(p.visitante).nombre)}</span></a>`;
};
const subnav = (items, actual) => `<nav class="subnav" aria-label="Apartados">${items.map(([u, t]) => `<a href="${u}" class="${u === actual ? 'activo' : ''}">${t}</a>`).join('')}</nav>`;
const avisoActas = n => n ? `<p class="aviso">⚠ En ${n} partido${n === 1 ? '' : 's'} el acta pública de la FEB está incompleta (falta alguna jugadora), así que algunas cifras de este equipo quedan cortas. Los puntos sí salen del marcador oficial.</p>` : '';

// ---------------------------------------------------------------- gráficos SVG
const COLORES = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)', 'var(--serie-5)', 'var(--serie-6)'];

function barrasPercentil(lista) {
  return lista.map(m => `<div class="percentil" data-tip="${esc(`<b>${m.n}</b><br>${fmt(m.valor, m.d)}${m.i ? '<br><i>' + m.i + '</i>' : ''}<br>Mejor que el ${m.p ?? '–'} % de ${m.total}${m.inv ? ' (menos es mejor)' : ''}`)}">
      <span>${m.n}</span><span class="percentil__barra"><i style="width:${m.p ?? 0}%"></i></span>
      <span class="percentil__valor"><b>${m.p ?? '–'}</b></span></div>`).join('');
}

function radar(series, ejes, tam = 340) {
  // series: [{nombre, color, valores: [0-100 por eje]}]
  const c = tam / 2, rad = tam / 2 - 54, n = ejes.length;
  const punto = (i, v) => { const a = -Math.PI / 2 + 2 * Math.PI * i / n; return [c + Math.cos(a) * rad * v / 100, c + Math.sin(a) * rad * v / 100]; };
  const anillos = [25, 50, 75, 100].map(v => `<polygon class="rejilla-linea" fill="none" points="${ejes.map((_, i) => punto(i, v).join(',')).join(' ')}"/>`).join('');
  const radios = ejes.map((e, i) => { const [x, y] = punto(i, 100), [tx, ty] = punto(i, 116);
    return `<line class="rejilla-linea" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/><text x="${tx}" y="${ty}" text-anchor="${Math.abs(tx - c) < 8 ? 'middle' : tx > c ? 'start' : 'end'}" dominant-baseline="middle">${esc(e)}</text>`; }).join('');
  const polis = series.map(s => `<polygon points="${s.valores.map((v, i) => punto(i, v ?? 0).join(',')).join(' ')}" fill="${s.color}" fill-opacity=".13" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>` +
    s.valores.map((v, i) => { const [x, y] = punto(i, v ?? 0); return `<circle cx="${x}" cy="${y}" r="5" fill="${s.color}" stroke="var(--superficie)" stroke-width="2"
        data-tip="${esc(`<b>${s.nombre}</b><br>${ejes[i]}: percentil ${v ?? '–'}`)}"/>`; }).join('')).join('');
  return `<svg class="grafico grafico--radar" viewBox="0 0 ${tam} ${tam}" role="img" aria-label="Radar de percentiles">${anillos}${radios}${polis}</svg>`;
}

// Nota de una pregunta a partir de los percentiles de sus cifras
const NIVELES = [[90, 'Élite', 'var(--nivel-5)'], [75, 'Muy bueno', 'var(--nivel-4)'], [60, 'Bueno', 'var(--nivel-3)'],
  [40, 'Normal', 'var(--nivel-2)'], [25, 'Flojo', 'var(--nivel-1)'], [0, 'Muy flojo', 'var(--nivel-0)']];
const nivelDe = p => NIVELES.find(([min]) => p >= min) || NIVELES[NIVELES.length - 1];

function resumenJugadora(j, base, grupos_, opciones = {}) {
  // Ficha de un vistazo: una tarjeta por pregunta con una palabra (Élite… Muy flojo), su color y una barra 0-100;
  // debajo, en frases, lo mejor y lo más flojo de la jugadora frente a su grupo.
  const W = 720, cab = 74, tarjW = 232, tarjH = 128, hueco = 12, cols = 3;
  const filasT = Math.ceil(grupos_.length / cols);
  const pctDe = m => percentil(m.v(j), base.map(m.v).filter(v => v != null), m.inv);
  const notas = grupos_.map(([pregunta, claves]) => {
    const ms = claves.map(k => MJK[k]).filter(Boolean).map(m => ({m, p: pctDe(m)}));
    const ps = ms.map(x => x.p).filter(p => p != null);
    return {pregunta, ms, nota: ps.length ? Math.round(media(ps)) : null};
  });
  let svg = '';
  notas.forEach((g, i) => {
    const x = (i % cols) * (tarjW + hueco), y = cab + Math.floor(i / cols) * (tarjH + hueco);
    const [, palabra, color] = g.nota == null ? [0, 'Sin datos', 'var(--texto-3)'] : nivelDe(g.nota);
    const ancho = tarjW - 32, lleno = ancho * (g.nota ?? 0) / 100;
    svg += `<g data-tip="${esc(`<b>${g.pregunta}</b> · ${palabra}${g.nota != null ? ` (${g.nota}/100)` : ''}<br>` + g.ms.map(x => `${esc(x.m.n)}: ${fmt(x.m.v(j), x.m.d)} · percentil ${x.p ?? '–'}`).join('<br>'))}">
      <rect x="${x}" y="${y}" width="${tarjW}" height="${tarjH}" rx="12" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-width="2"/>
      <text x="${x + 16}" y="${y + 28}" font-size="15" font-weight="700" style="fill:var(--texto-2)">${esc(g.pregunta)}</text>
      <text x="${x + 16}" y="${y + 66}" font-size="30" font-weight="800" style="fill:${color}">${palabra}</text>
      <rect x="${x + 16}" y="${y + 84}" width="${ancho}" height="10" rx="5" fill="var(--superficie-2)"/>
      <rect x="${x + 16}" y="${y + 84}" width="${Math.max(lleno, 4)}" height="10" rx="5" fill="${color}"/>
      <line x1="${x + 16 + ancho / 2}" x2="${x + 16 + ancho / 2}" y1="${y + 80}" y2="${y + 98}" stroke="var(--texto-2)" stroke-width="1.5"/>
      <text x="${x + 16}" y="${y + 114}" font-size="11" style="fill:var(--texto-3)">${g.nota != null ? g.nota + ' de 100' : ''}</text>
      <text x="${x + tarjW - 16}" y="${y + 114}" font-size="11" text-anchor="end" style="fill:var(--texto-3)">media de su grupo: 50</text></g>`;
  });
  // lo mejor y lo más flojo, en frases
  const todas = (opciones.todas || []).map(k => MJK[k]).filter(Boolean)
    .map(m => { const lista = base.map(m.v).filter(v => v != null); return {m, v: m.v(j), p: percentil(m.v(j), lista, m.inv), raro: lista.filter(v => v === 0).length > lista.length / 2}; })
    .filter(x => x.p != null && !x.raro);
  const fuertes = [...todas].sort((a, b) => b.p - a.p).filter(x => x.p >= 70).slice(0, 3);
  const flojos = [...todas].sort((a, b) => a.p - b.p).filter(x => x.p <= 30).slice(0, 3);
  const grupo = opciones.grupo || 'jugadoras';
  const y0 = cab + filasT * (tarjH + hueco) + 16;
  // en minúscula solo la primera letra, y no si es una sigla (BPM, PER, TS%…)
  const enFrase = s => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
  const frase = (x, bien) => bien ? `Mejor que el ${x.p} % de las ${grupo} en ${enFrase(x.m.n)} (${fmt(x.v, x.m.d)})`
    : `Peor que el ${100 - x.p} % de las ${grupo} en ${enFrase(x.m.n)} (${fmt(x.v, x.m.d)})`;
  // una lista debajo de otra: «Lo mejor» y «Lo más flojo»
  const lista = (titulo, items, bien, ya) => `<text x="0" y="${ya + 16}" font-size="15" font-weight="800" style="fill:${bien ? 'var(--nivel-5)' : 'var(--nivel-0)'}">${bien ? '▲' : '▼'} ${titulo}</text>` +
    (items.length ? items.map((x, i) => `<text x="0" y="${ya + 42 + i * 22}" font-size="12.5" style="fill:var(--texto)">${esc(frase(x, bien))}</text>`).join('')
      : `<text x="0" y="${ya + 42}" font-size="12.5" style="fill:var(--texto-3)">${bien ? 'Nada por encima del 70 %' : 'Nada por debajo del 30 %'}</text>`);
  const alto = items => 42 + Math.max(items.length, 1) * 22;
  const y1 = y0 + alto(fuertes) + 10;
  const textos = lista('Lo mejor', fuertes, true, y0) + lista('Lo más flojo', flojos, false, y1);
  const H = y1 + alto(flojos) + 20;
  const cabecera = `<text x="0" y="30" font-size="26" font-weight="800" style="fill:var(--texto)">${esc(opciones.titulo || j.nombre)}</text>
    <text x="0" y="54" font-size="12.5" style="fill:var(--texto-2)">${esc(opciones.subtitulo || '')}</text>`;
  return `<svg class="grafico grafico--resumen" viewBox="-6 0 ${W + 12} ${H}" role="img" aria-label="Resumen de ${esc(j.nombre)}" xmlns="http://www.w3.org/2000/svg">
    <rect x="-6" width="${W + 12}" height="${H}" fill="var(--superficie)"/>${cabecera}${svg}${textos}
    <text x="${W}" y="${H - 6}" font-size="10" text-anchor="end" style="fill:var(--texto-3)">LF Stats · actas de la FEB</text></svg>`;
}

// Descarga un gráfico SVG de la página como imagen PNG (resolviendo los colores del tema actual)
function descargarPng(svg, nombre) {
  const estilo = getComputedStyle(document.documentElement);
  let texto = new XMLSerializer().serializeToString(svg).replace(/var\((--[a-z0-9-]+)\)/g, (_, v) => estilo.getPropertyValue(v).trim() || '#888');
  if (!/xmlns=/.test(texto)) texto = texto.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  texto = texto.replace('<svg', `<svg style="font-family:${getComputedStyle(document.body).fontFamily.replace(/"/g, "'")}"`);
  const vb = svg.viewBox.baseVal, escala = 2;
  const img = new Image();
  img.onload = () => {
    const lienzo = document.createElement('canvas');
    lienzo.width = vb.width * escala; lienzo.height = vb.height * escala;
    lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const a = document.createElement('a');
    a.download = nombre.replace(/[^\w\-áéíóúñü ]+/gi, '').trim().replace(/\s+/g, '_') + '.png';
    a.href = lienzo.toDataURL('image/png');
    a.click();
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(texto);
}

function barrasPartidos(log, campo, nombre) {
  const w = 640, alto = 180, m = {i: 34, d: 8, a: 12, b: 26};
  const vals = log.map(campo), max = Math.max(5, ...vals), min = Math.min(0, ...vals);
  const ancho = Math.min(44, (w - m.i - m.d) / Math.max(log.length, 1)), y = v => m.a + (alto - m.a - m.b) * (max - v) / (max - min);
  const marcas = [min, Math.round((min + max) / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const barras = log.map((x, i) => { const v = campo(x), y0 = y(Math.max(v, 0)), y1 = y(Math.min(v, 0));
    const tip = `<b>J${x[1]} ${x[3] ? 'vs' : 'en'} ${esc(eq(x[2]).nombre)}</b><br>${nombre}: ${fmt(v, 0)} · ${minutos(x[6])} min · ${x[4] ? 'victoria' : 'derrota'}`;
    return `<rect x="${m.i + i * ancho + 1}" y="${m.a}" width="${Math.max(ancho - 2, 1)}" height="${alto - m.a - m.b}" fill="transparent" data-tip="${esc(tip)}"/>
      <rect x="${m.i + i * ancho + 2}" y="${y0}" width="${Math.max(ancho - 4, 2)}" height="${Math.max(y1 - y0, 1)}" rx="${Math.min(4, ancho / 4)}" fill="var(--acento)" pointer-events="none"/>`; }).join('');
  const ejeX = log.map((x, i) => (log.length <= 16 || i % 3 === 0) ? `<text x="${m.i + (i + .5) * ancho}" y="${alto - 8}" text-anchor="middle">${x[1]}</text>` : '').join('');
  return `<svg class="grafico grafico--barras" viewBox="0 0 ${w} ${alto}" role="img" aria-label="${esc(nombre)} por partido">
    ${marcas.map(v => `<line class="rejilla-linea" x1="${m.i}" x2="${w - m.d}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.i - 6}" y="${y(v)}" text-anchor="end" dominant-baseline="middle">${v}</text>`).join('')}
    <line class="eje" x1="${m.i}" x2="${w - m.d}" y1="${y(0)}" y2="${y(0)}"/>${barras}${ejeX}
    <text x="${w - m.d}" y="${alto - 8}" text-anchor="end">jornada</text></svg>`;
}

function lineas(series, etiquetasX, opciones = {}) {
  // series: [{nombre, color, valores}] — líneas con cruz de lectura por cada x
  const w = 720, alto = opciones.alto || 260, m = {i: 44, d: 16, a: 14, b: 30};
  const todos = series.flatMap(s => s.valores).filter(v => v != null);
  if (!todos.length) return '';
  let min = Math.min(...todos), max = Math.max(...todos);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.08; min -= pad; max += pad;
  const n = etiquetasX.length, x = i => m.i + (w - m.i - m.d) * (n === 1 ? .5 : i / (n - 1)), y = v => m.a + (alto - m.a - m.b) * (max - v) / (max - min);
  const ticks = 4, marcas = Array.from({length: ticks + 1}, (_, k) => min + (max - min) * k / ticks);
  const caminos = series.map(s => {
    const pts = s.valores.map((v, i) => v == null ? null : [x(i), y(v)]);
    let d = '', nuevo = true;
    pts.forEach(p => { if (!p) { nuevo = true; return; } d += (nuevo ? 'M' : 'L') + p.join(','); nuevo = false; });
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
      (n <= 40 ? pts.map(p => p ? `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${s.color}"/>` : '').join('') : '');
  }).join('');
  const columnas = etiquetasX.map((et, i) => `<rect x="${x(i) - (w - m.i - m.d) / Math.max(n - 1, 1) / 2}" y="${m.a}" width="${(w - m.i - m.d) / Math.max(n - 1, 1)}" height="${alto - m.a - m.b}" fill="transparent"
      data-tip="${esc(`<b>${et}</b><br>` + series.map(s => `${s.nombre}: ${fmt(s.valores[i], opciones.d ?? 1)}`).join('<br>'))}"/>`).join('');
  const paso = Math.ceil(n / 12);
  return `<svg class="grafico" viewBox="0 0 ${w} ${alto}" role="img" aria-label="${esc(opciones.titulo || 'Evolución')}">
    ${marcas.map(v => `<line class="rejilla-linea" x1="${m.i}" x2="${w - m.d}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.i - 6}" y="${y(v)}" text-anchor="end" dominant-baseline="middle">${fmt(v, opciones.d ?? 1)}</text>`).join('')}
    ${etiquetasX.map((et, i) => i % paso === 0 ? `<text x="${x(i)}" y="${alto - 10}" text-anchor="middle">${esc(et)}</text>` : '').join('')}
    ${opciones.referencia != null ? `<line class="eje" stroke-dasharray="4 4" x1="${m.i}" x2="${w - m.d}" y1="${y(opciones.referencia)}" y2="${y(opciones.referencia)}"/>` : ''}
    ${caminos}${columnas}</svg>`;
}

function etiquetasSinChoque(puntos, w, alto) {
  // coloca cada etiqueta en la primera posición que no pise otra etiqueta ni un punto; si no cabe, no la pone
  const cajas = puntos.map(p => ({x0: p.x - 7, x1: p.x + 7, y0: p.y - 7, y1: p.y + 7}));
  const choca = c => cajas.some(b => c.x0 < b.x1 && c.x1 > b.x0 && c.y0 < b.y1 && c.y1 > b.y0);
  return puntos.map(p => {
    if (!p.texto) return '';
    const ancho = p.texto.length * 6.4, opciones = [[10, -4, 'start'], [-10, -4, 'end'], [0, -14, 'middle'], [0, 20, 'middle'], [10, 12, 'start'], [-10, 12, 'end']];
    for (const [dx, dy, ancla] of opciones) {
      const x0 = ancla === 'start' ? p.x + dx : ancla === 'end' ? p.x + dx - ancho : p.x - ancho / 2;
      const c = {x0, x1: x0 + ancho, y0: p.y + dy - 10, y1: p.y + dy + 2};
      if (c.x0 < 0 || c.x1 > w || c.y0 < 0 || c.y1 > alto || choca(c)) continue;
      cajas.push(c);
      return `<text x="${p.x + dx}" y="${p.y + dy}" text-anchor="${ancla}" pointer-events="none" ${p.fuerte ? 'style="font-weight:700;fill:var(--texto)"' : ''}>${esc(p.texto)}</text>`;
    }
    return '';
  }).join('');
}

function dispersion(puntos, ejeX, ejeY, opciones = {}) {
  // puntos: [{x, y, texto, tip, href, destacado}]; ejeY invertido si menos es mejor
  const pts = puntos.filter(p => p.x != null && p.y != null);
  const w = 680, alto = 440, m = {i: 52, d: 16, a: 18, b: 46};
  if (pts.length < 2) return '<p class="tenue">No hay datos suficientes.</p>';
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const rango = (l) => { let a = Math.min(...l), b = Math.max(...l); const p = (b - a) * 0.06 || 1; return [a - p, b + p]; };
  const [x0, x1] = rango(xs), [y0, y1] = rango(ys);
  const x = v => m.i + (w - m.i - m.d) * (v - x0) / (x1 - x0);
  const y = v => ejeY.inv ? m.a + (alto - m.a - m.b) * (v - y0) / (y1 - y0) : m.a + (alto - m.a - m.b) * (y1 - v) / (y1 - y0);
  const mx = media(xs), my = media(ys);
  const ticks = (a, b) => { const paso = Math.pow(10, Math.floor(Math.log10((b - a) / 4))); const k = [1, 2, 2.5, 5, 10].find(f => (b - a) / (paso * f) <= 6) * paso;
    const out = []; for (let v = Math.ceil(a / k) * k; v <= b + 1e-9; v += k) out.push(+v.toFixed(6)); return out; };
  const etiquetas = etiquetasSinChoque(pts.filter(p => p.texto).sort((a, b) => (b.destacado || 0) - (a.destacado || 0)).map(p => ({x: x(p.x), y: y(p.y), texto: p.texto, fuerte: p.destacado})), w, alto);
  return `<svg class="grafico" viewBox="0 0 ${w} ${alto}" role="img" aria-label="${esc(ejeX.n)} frente a ${esc(ejeY.n)}">
    ${ticks(x0, x1).map(v => `<line class="rejilla-linea" x1="${x(v)}" x2="${x(v)}" y1="${m.a}" y2="${alto - m.b}"/><text x="${x(v)}" y="${alto - m.b + 16}" text-anchor="middle">${fmt(v, Math.abs(v) < 5 && v % 1 ? 2 : 0)}</text>`).join('')}
    ${ticks(y0, y1).map(v => `<line class="rejilla-linea" x1="${m.i}" x2="${w - m.d}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.i - 6}" y="${y(v)}" text-anchor="end" dominant-baseline="middle">${fmt(v, Math.abs(v) < 5 && v % 1 ? 2 : 0)}</text>`).join('')}
    <line class="eje" x1="${x(mx)}" x2="${x(mx)}" y1="${m.a}" y2="${alto - m.b}" stroke-dasharray="4 4"/>
    <line class="eje" x1="${m.i}" x2="${w - m.d}" y1="${y(my)}" y2="${y(my)}" stroke-dasharray="4 4"/>
    <text x="${(m.i + w - m.d) / 2}" y="${alto - 8}" text-anchor="middle">${esc(ejeX.n)}${ejeX.inv ? ' (menos es mejor)' : ''}</text>
    <text transform="translate(13 ${(m.a + alto - m.b) / 2}) rotate(-90)" text-anchor="middle">${esc(ejeY.n)}${ejeY.inv ? ' (menos, arriba)' : ''}</text>
    ${opciones.nota ? `<text x="${w - m.d}" y="${m.a + 10}" text-anchor="end">${esc(opciones.nota)}</text>` : ''}
    ${pts.sort((a, b) => (a.destacado || 0) - (b.destacado || 0)).map(p => `<g data-tip="${esc(p.tip || '')}" ${p.href ? `style="cursor:pointer" onclick="location.hash='${p.href}'"` : ''}>
      <circle cx="${x(p.x)}" cy="${y(p.y)}" r="12" fill="transparent"/>
      <circle cx="${x(p.x)}" cy="${y(p.y)}" r="${p.destacado ? 7 : 5}" fill="${p.color || (p.destacado ? 'var(--serie-2)' : 'var(--acento)')}" fill-opacity="${p.destacado ? 1 : (pts.length > 60 ? .55 : .9)}" stroke="var(--superficie)" stroke-width="${p.destacado ? 2 : 1}"/></g>`).join('')}
    ${etiquetas}</svg>`;
}

function mapaCalor(filas, columnas, celdas, opciones = {}) {
  // filas/columnas: etiquetas (html); celdas[i][j] = {v (0-1 intensidad), texto, tip}
  return `<div class="tabla-scroll"><table class="calor"><thead><tr><th class="izq"></th>${columnas.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
    ${filas.map((f, i) => `<tr><td class="izq">${f}</td>${celdas[i].map(c => c ? `<td class="celda${c.v > 0.55 ? ' oscura' : ''}" style="--v:${Math.max(0, Math.min(1, c.v)).toFixed(3)}" ${c.tip ? `data-tip="${esc(c.tip)}"` : ''}><span>${c.texto ?? ''}</span></td>` : '<td class="celda"></td>').join('')}</tr>`).join('')}
    </tbody></table></div>${opciones.nota ? `<p class="muy-tenue">${opciones.nota}</p>` : ''}`;
}

function bump(destacados, grupo = IDX.grupos[0]) {
  // posición de cada equipo de un grupo tras cada jornada; todos en gris y los destacados en color
  const js = grupo.jornadas, evol = grupo.evolucion, equipos = grupo.filas.map(f => eq(f.id)), n = equipos.length;
  const w = 760, alto = 380, m = {i: 34, d: 160, a: 14, b: 28};
  if (js.length < 2) return '<p class="tenue">La evolución aparece a partir de la segunda jornada.</p>';
  const x = i => m.i + (w - m.i - m.d) * i / (js.length - 1), y = p => m.a + (alto - m.a - m.b) * (p - 1) / (n - 1);
  const lineasEq = equipos.map(e => {
    const pts = js.map((j, i) => [x(i), y((evol[j] || []).indexOf(e.id) + 1)]);
    const k = destacados.indexOf(e.id), sel = k >= 0, color = sel ? COLORES[k % 4] : 'var(--borde)', ult = pts[pts.length - 1];
    const tip = `<b>${esc(e.nombre)}</b><br>${js.map(j => `J${j}: ${(evol[j] || []).indexOf(e.id) + 1}.º`).slice(-10).join(' · ')}`;
    return [sel, `<g><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${sel ? 3 : 2}" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="transparent" stroke-width="10" data-tip="${esc(tip)}" style="cursor:pointer" onclick="location.hash='#/equipo/${e.id}'"/>
      ${sel ? pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${color}" stroke="var(--superficie)" stroke-width="1.5"/>`).join('') : ''}
      <text x="${ult[0] + 8}" y="${ult[1]}" dominant-baseline="middle" style="${sel ? 'font-weight:700;fill:var(--texto)' : ''}">${esc(e.nombre.slice(0, 24))}</text></g>`];
  }).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const marcasY = [1, 4, 8, 12, n].filter((v, i, a) => v <= n && a.indexOf(v) === i);
  return `<svg class="grafico" viewBox="0 0 ${w} ${alto}" role="img" aria-label="Evolución de la clasificación">
    ${marcasY.map(p => `<line class="rejilla-linea" x1="${m.i}" x2="${w - m.d}" y1="${y(p)}" y2="${y(p)}"/><text x="${m.i - 8}" y="${y(p)}" text-anchor="end" dominant-baseline="middle">${p}.º</text>`).join('')}
    ${js.map((j, i) => (js.length <= 15 || i % 2 === 0) ? `<text x="${x(i)}" y="${alto - 8}" text-anchor="middle">J${j}</text>` : '').join('')}
    ${lineasEq.join('')}</svg>`;
}

function barrasH(filas, opciones = {}) {
  // filas: [{n (html), v, texto, tip, color}] barras horizontales con valor; admite negativos (centradas en 0)
  const vals = filas.map(f => f.v ?? 0), max = Math.max(...vals.map(Math.abs), 1e-9), conNeg = vals.some(v => v < 0);
  return `<div class="barrash">${filas.map(f => { const v = f.v ?? 0, ancho = 100 * Math.abs(v) / max;
    const izq = conNeg ? (v < 0 ? 50 - ancho / 2 : 50) : 0, w = conNeg ? ancho / 2 : ancho;
    return `<div class="barrash__fila" ${f.tip ? `data-tip="${esc(f.tip)}"` : ''}><span class="barrash__nombre">${f.n}</span>
      <span class="barrash__pista">${conNeg ? '<i class="barrash__cero"></i>' : ''}<i class="barrash__barra" style="left:${izq}%;width:${w}%;background:${f.color || (v < 0 ? 'var(--serie-2)' : 'var(--acento)')}"></i></span>
      <span class="barrash__valor">${f.texto ?? fmt(v, opciones.d ?? 1)}</span></div>`; }).join('')}</div>`;
}

// Media de una lista de objetos (campo a campo, también dentro de objetos), para la fila «Media de la liga»
function mediaObjetos(lista) {
  const fusion = (objs) => {
    const salida = {};
    for (const k of Object.keys(objs[0] || {})) {
      const vals = objs.map(o => o[k]);
      if (vals.every(v => typeof v === 'number')) salida[k] = media(vals);
      else if (vals.every(v => v && typeof v === 'object' && !Array.isArray(v))) salida[k] = fusion(vals);
    }
    return salida;
  };
  return {...fusion(lista), _media: true, nombre: 'Media de la liga'};
}
// Agrupa partidos de una jugadora (filas del registro) y resume
function resumirLog(filas) {
  if (!filas.length) return null;
  const s = k => filas.reduce((a, x) => a + (x[k] || 0), 0), n = filas.length;
  const tsa = s(9) + s(11) + 0.44 * s(13);
  return {pj: n, v: filas.filter(x => x[4]).length, min: s(6) / n, pts: s(7) / n, trb: s(14) / n, ast: s(15) / n, pir: s(19) / n, gmsc: s(21) / n,
    ts: tsa ? 100 * s(7) / (2 * tsa) : null, pm: s(20) / n};
}
const fechaDe = pid => { const p = IDX.partidos[pid]; if (!p) return null; const m = /(\d\d)\/(\d\d)\/(\d{4})/.exec(p.fecha || ''); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
