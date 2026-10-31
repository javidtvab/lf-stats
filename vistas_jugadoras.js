// LF Stats · vistas de jugadoras: tabla, ficha, comparar, dispersión y familias de juego.
'use strict';

const NAV_JUG = [['#/jugadoras', 'Tabla'], ['#/comparar', 'Comparar'], ['#/dispersion', 'Dispersión'], ['#/familias', 'Familias de juego'], ['#/progresion', 'Progresión y edad'], ['#/historico', 'Histórico']];

// El resumen de un vistazo: las cifras agrupadas por la pregunta que responden
const PREGUNTAS = [['¿Anota?', ['pts40', 'usg', 'ftr']], ['¿Tira bien?', ['ts', 'efg', 'p3_est']], ['¿Crea juego?', ['ast_pct', 'ast_tov', 'tov_pct']],
  ['¿Rebotea?', ['orb_pct', 'drb_pct']], ['¿Defiende?', ['stl_pct', 'blk_pct', 'pf40']], ['¿Cuánto aporta?', ['bpm', 'per', 'onoff']]];
// Ejes del radar de comparación y de la ficha
const RADAR = ['pts40', 'trb40', 'ast40', 'stl40', 'blk40', 'ts', 'usg', 'ast_pct', 'orb_pct', 'drb_pct', 'tov_pct', 'bpm'];
// Percentiles completos de la ficha
const PERCENTILES_FICHA = ['pts', 'trb', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pfd', 'pir', 'pm', 'min', 'fgp', 'p3p', 'ftp', 'efg', 'ts',
  'fga', 'p2', 'p2a', 'p3', 'p3a', 'ft', 'fta', 'usg', 'ast_pct', 'tov_pct', 'orb_pct', 'drb_pct', 'stl_pct', 'blk_pct', 'ortg', 'drtg', 'per',
  'ws40', 'onoff', 'gmsc', 'bpm', 'obpm', 'dbpm', 'vorp', 'pie', 'pts_anadidos', 'stocks40', 'p3_est', 'ft_est', 'comp3'];

const VISTAS = {};

VISTAS.jugadoras = () => {
  const f = VISTAS.jugadoras.filtro || (VISTAS.jugadoras.filtro = {equipo: '', grupo: '', min: 1, minutos: 0, buscar: '', modo: 'Por partido'});
  const modos = {'Por partido': ['min', 'pts', 'trb', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pfd', 'pir', 'gmsc', 'pm', 'ts', 'efg', 'usg'],
    'Por 40 minutos': ['min', ...MJ.filter(m => m.g === 'Por 40 minutos').map(m => m.k)],
    'Por 100 posesiones': ['min', ...MJ.filter(m => m.g === 'Por 100 posesiones').map(m => m.k)],
    'Tiro': ['fg', 'fga', 'fgp', 'p2', 'p2a', 'p2p', 'p3', 'p3a', 'p3p', 'p3_est', 'comp3', 'ft', 'fta', 'ftp', 'ft_est', 'efg', 'ts', 'rts', 'pts_anadidos', 'p3r', 'ftr', 'ft_rate', 'pps', 'ppt'],
    'Tiro ajustado': MJ.filter(m => m.g === 'Tiro ajustado').map(m => m.k),
    'Avanzadas': ['min', 'usg', 'ast_pct', 'tov_pct', 'orb_pct', 'drb_pct', 'trb_pct', 'stl_pct', 'blk_pct', 'ast_tov', 'ast_ratio', 'pts_share'],
    'Impacto': ['min', 'bpm', 'obpm', 'dbpm', 'vorp', 'per', 'ortg', 'drtg', 'netrtg_ind', 'floor', 'ows', 'dws', 'ws', 'ws40', 'pie', 'eff', 'win_score40', 'pm40', 'con', 'sin', 'onoff', 'gmsc'],
    'Regularidad': ['gmsc', 'gmsc_sd', 'pts_sd', 'p10', 'p20', 'dd', 'td'],
    'Zonas de tiro': ['xefg', 'sobre_esperado', 'distancia', 'asistidas', ...MJ.filter(m => m.k.startsWith('fr_') || m.k.startsWith('pc_')).map(m => m.k)],
    'Con y sin (jugada a jugada)': ['min', ...MJ.filter(m => m.g === 'Con y sin (jugada a jugada)' || m.g === 'Finales apretados').map(m => m.k)],
    'Totales': ['pj', 'tit', 'tmin', 'tpts', 'ttrb', 'tast', 'tp3', 'tpir']};
  const repintar = () => { document.getElementById('tabla-jugadoras').innerHTML = cuerpo(); activarTablas(repintar); };
  const cuerpo = () => {
    const filas = T.jugadoras.filter(j => (!f.equipo || j.equipos.includes(f.equipo)) && (!f.grupo || j.grupo === f.grupo)
      && j.pj >= f.min && (j.med.min || 0) >= f.minutos && (!f.buscar || j.nombre.toLowerCase().includes(f.buscar.toLowerCase())));
    const ms = modos[f.modo].map(k => MJK[k]);
    return `<p class="muy-tenue">${filas.length} jugadoras · pasa el ratón por una columna para ver qué es</p>` + tabla('jug-' + f.modo, filas, [
      {t: 'Jugadora', izq: true, f: j => linkJu(j.id) + (j.actas_incompletas ? ' <span title="Acta incompleta en algún partido">⚠</span>' : ''), clase: 'nombre', v: j => j.nombre},
      {t: 'Equipo', izq: true, f: j => `<span class="tenue">${esc(eq(j.equipo).nombre)}</span>`, v: j => eq(j.equipo).nombre},
      {t: 'Pos.', izq: true, f: j => esc(j.puesto || '–'), v: j => j.puesto},
      {t: 'PJ', f: j => j.pj, v: j => j.pj},
      ...ms.map(m => colM(m)),
    ], 4 + Math.min(1, ms.length - 1));
  };
  despues(() => {
    alCambiar('f-equipo', v => { f.equipo = v; repintar(); }); alCambiar('f-grupo', v => { f.grupo = v; repintar(); });
    alCambiar('f-min', v => { f.min = Number(v); repintar(); }); alCambiar('f-minutos', v => { f.minutos = Number(v); repintar(); });
    alCambiar('f-buscar', v => { f.buscar = v; repintar(); });
    alPulsar('f-modo', v => { f.modo = v; document.querySelectorAll('#f-modo button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); repintar(); });
    activarTablas(repintar);
  });
  return h`${subnav(NAV_JUG, '#/jugadoras')}<div class="encabezado"><div><h1>Jugadoras</h1><p class="tenue">${MJ.length} cifras por jugadora. Pulsa una columna para ordenar.</p></div></div>
    <div class="filtros">
      <label>Buscar<input id="f-buscar" type="search" placeholder="Nombre" value="${esc(f.buscar)}"></label>
      <label>Equipo<select id="f-equipo"><option value="">Todos</option>${[...T.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(e => `<option value="${e.id}" ${f.equipo === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></label>
      <label>Puesto<select id="f-grupo"><option value="">Todos</option>${['Exterior', 'Alero', 'Interior'].map(g => `<option ${f.grupo === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label>Mín. partidos<input id="f-min" type="number" min="1" max="40" value="${f.min}" style="width:5rem"></label>
      <label>Mín. minutos/partido<input id="f-minutos" type="number" min="0" max="40" value="${f.minutos}" style="width:5rem"></label>
    </div>
    <div class="filtros">${pildoras('f-modo', Object.keys(modos).map(k => [k, k]), f.modo)}</div>
    <div class="tarjeta" id="tabla-jugadoras">${cuerpo()}</div>`;
};

VISTAS.jugadora = id => {
  const j = IDX.jugadoras[id];
  if (!j) return '<p>No está esa jugadora en esta temporada.</p>';
  const elegido = VISTAS.jugadora.grupo;  // {id, g}
  const grupoSel = elegido && elegido.id === id ? elegido.g : j.grupo;
  const base = cualificadas(grupoSel);
  const comparable = cualificadas().some(x => x.id === j.id);
  const nombreGrupo = {Exterior: 'exteriores', Alero: 'aleras', Interior: 'interiores'}[grupoSel] || 'jugadoras de la liga';
  const pTodos = percentilesDe(j, PERCENTILES_FICHA.map(k => MJK[k]), base);
  const pRadar = percentilesDe(j, RADAR.map(k => MJK[k]), base);
  despues(() => {
    alPulsar('p-grupo', g => { VISTAS.jugadora.grupo = {id, g}; pintar(); });
    const b = document.getElementById('resumen-png');
    if (b) b.addEventListener('click', () => descargarPng(document.querySelector('.grafico--resumen'), `${j.nombre} ${T.nombre}`));
    activarTablas(() => pintar());
  });
  const s = j.splits, fila = (n, x) => x ? `<tr><td class="izq">${n}</td><td>${x.pj}</td><td>${fmt(x.min)}</td><td>${fmt(x.pts)}</td><td>${fmt(x.trb)}</td><td>${fmt(x.ast)}</td><td>${fmt(x.pir)}</td><td>${fmt(x.gmsc)}</td><td>${fmt(x.ts)}</td><td>${signo(x.pm, 1)}</td></tr>` : '';
  const hist = INDICE.historial[id] || [];
  const parecidas = INDICE.parecidas[`${T.temporada}:${id}`] || [];
  const familia = j.familia != null ? INDICE.familias.find(f => f.id === j.familia) : null;
  const log = [...j.log].reverse();
  return h`<a href="#/jugadoras" class="muy-tenue">← Jugadoras</a>
    <div class="tarjeta" style="margin-top:.5rem"><div class="ficha"><div class="dorsal">${esc(j.dorsal || '·')}</div>
      <div style="flex:1;min-width:220px"><h1 style="margin:0">${esc(j.nombre)}</h1><div class="tenue">${linkEq(j.equipo)}${j.equipos.length > 1 ? ` <span class="muy-tenue">(también ${j.equipos.filter(e => e !== j.equipo).map(linkEq).join(', ')})</span>` : ''}</div>
      <div class="etiquetas">${[j.puesto, j.edad && `${j.edad} años`, j.altura && `${j.altura} cm`, j.nacionalidad, j.formacion && 'Formación nacional',
        familia && `Familia: ${familia.nombre}`].filter(Boolean).map(x => `<span class="etiqueta">${esc(x)}</span>`).join('')}</div></div>
      <span style="text-align:right"><a href="${comparadorDeJugadora(j)}">Comparar con su puesto, su equipo y la liga →</a><br><a href="#/comparar/${j.id}" class="muy-tenue">Frente a otra jugadora</a></span></div>
      ${avisoActas(j.actas_incompletas)}
      <div class="cifras" style="margin-top:1rem">${cifra(j.pj, `Partidos (${j.tit} tit.)`)}${cifra(fmt(j.med.min), 'Minutos')}${cifra(fmt(j.med.pts), 'Puntos')}${cifra(fmt(j.med.trb), 'Rebotes')}
        ${cifra(fmt(j.med.ast), 'Asistencias')}${cifra(fmt(j.med.pir), 'Valoración')}${cifra(fmt(j.av.per), 'PER', MJK.per.i)}${cifra(fmt(j.av.ts), 'TS%', MJK.ts.i)}
        ${cifra(fmt(j.av.usg), 'Uso %', MJK.usg.i)}${cifra(signo(j.av.bpm, 1), 'BPM', MJK.bpm.i)}${cifra(fmt(j.av.vorp, 2), 'VORP', MJK.vorp.i)}${cifra(fmt(j.av.ws, 2), 'Win Shares', MJK.ws.i)}${cifra(signo(j.onoff, 1), 'Con y sin', MJK.onoff.i)}${cifra(fmt(j.gmsc), 'Game Score', MJK.gmsc.i)}</div></div>
    <div class="filtros seccion">Comparada con ${pildoras('p-grupo', [[j.grupo, j.grupo ? `su puesto (${j.grupo.toLowerCase()})` : ''], ['', 'toda la liga']].filter(x => x[1]), grupoSel)}
      <span class="muy-tenue">${base.length} jugadoras con al menos el 40 % de los partidos y 10 minutos por partido</span></div>
    ${comparable ? '' : '<p class="aviso">Juega pocos minutos o partidos para compararla con fiabilidad: los percentiles son orientativos.</p>'}
    <div class="huella-y-perfil">
      <div class="tarjeta"><div class="encabezado"><h2>De un vistazo</h2><button id="resumen-png" class="boton" type="button">Descargar imagen</button></div>
        ${resumenJugadora(j, base, PREGUNTAS, {titulo: j.nombre, subtitulo: `${eq(j.equipo).nombre} · ${j.puesto || 'sin puesto'} · ${j.pj} partidos · comparada con ${base.length} ${nombreGrupo} · ${COMP.corto} ${T.nombre}`,
          todas: PERCENTILES_FICHA, grupo: nombreGrupo})}
        <p class="muy-tenue">Cada tarjeta resume varias cifras frente a su grupo: 50 es lo normal, 100 lo mejor. Pasa el ratón por una tarjeta para ver de qué cifras sale.</p></div>
      <div class="tarjeta"><h2>Perfil</h2>${radar([{nombre: j.nombre, color: 'var(--serie-1)', valores: pRadar.map(p => p.p)}], pRadar.map(p => p.c))}</div>
    </div>
    <div class="tarjeta seccion"><h2>Percentiles de todas sus cifras</h2><div class="columnas-2">${barrasPercentil(pTodos)}</div>
      <p class="muy-tenue">La raya central es la mediana (50). En pérdidas, faltas y DRtg, menos es mejor y ya está tenido en cuenta.</p></div>
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Impacto</h2><div class="cifras">
        ${cifra(fmt(j.av.ortg), 'ORtg', MJK.ortg.i)}${cifra(fmt(j.av.drtg), 'DRtg', MJK.drtg.i)}${cifra(fmt(j.av.floor), 'Floor %', MJK.floor.i)}
        ${cifra(fmt(j.av.ows, 2), 'OWS')}${cifra(fmt(j.av.dws, 2), 'DWS')}${cifra(fmt(j.av.ws40, 3), 'WS/40', MJK.ws40.i)}
        ${cifra(signo(j.av.obpm, 1), 'OBPM')}${cifra(signo(j.av.dbpm, 1), 'DBPM')}${cifra(fmt(j.av.pie), 'PIE', MJK.pie.i)}${cifra(signo(j.av.pts_anadidos, 0), 'Puntos añadidos', MJK.pts_anadidos.i)}
        ${cifra(fmt(j.av.pos_est), 'Puesto estimado', MJK.pos_est.i)}</div>
        <h3 style="margin-top:1rem">Con y sin ella</h3>
        ${barrasH([{n: 'Con ella en pista', v: j.con, texto: signo(j.con, 1), tip: MJK.con.i}, {n: 'Con ella en el banquillo', v: j.sin, texto: signo(j.sin, 1), tip: MJK.sin.i}])}
        <p class="muy-tenue">Diferencia de puntos de su equipo por 40 minutos, en los partidos que jugó (sale de su +/- del acta).</p></div>
      <div class="tarjeta"><h2>Regularidad</h2><div class="cifras">
        ${cifra(j.cons.dd, 'Dobles-dobles')}${cifra(j.cons.td, 'Triples-dobles')}${cifra(j.cons.p20, 'Partidos 20+')}${cifra(j.cons.p10, 'Partidos 10+')}
        ${cifra(fmt(j.cons.gmsc_sd), 'Desv. Game Score', 'Cuanto más bajo, más regular')}${cifra(fmt(j.cons.pts_sd), 'Desv. puntos')}</div>
        <h3 style="margin-top:1rem">Máximos de la temporada</h3><div class="cifras">${cifra(j.cons.max.pts, 'Puntos')}${cifra(j.cons.max.trb, 'Rebotes')}${cifra(j.cons.max.ast, 'Asistencias')}${cifra(j.cons.max.pir, 'Valoración')}${cifra(fmt(j.cons.max.gmsc), 'Game Score')}</div></div>
    </div>
    <div class="tarjeta seccion"><h2>Según el partido</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>PJ</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th><th>GmSc</th><th>TS%</th><th>+/-</th></tr></thead><tbody>
      ${fila('En casa', s.casa)}${fila('Fuera', s.fuera)}${fila('Victorias', s.victoria)}${fila('Derrotas', s.derrota)}${fila('De titular', s.titular)}${fila('Desde el banquillo', s.suplente)}${fila('Contra la mitad de arriba', s.vs_arriba)}${fila('Contra la mitad de abajo', s.vs_abajo)}${fila('Últimos 5 partidos', s.ultimos5)}
    </tbody></table></div></div>
    ${bloquePbpJugadora(j)}
    ${splitsExtra(j)}
    ${carreraYProyeccion(j)}
    <div class="rejilla-2 seccion"><div class="tarjeta"><h2>Puntos por partido</h2>${barrasPartidos(j.log, x => x[7], 'Puntos')}</div>
      <div class="tarjeta"><h2>Game Score por partido</h2>${barrasPartidos(j.log, x => x[21], 'Game Score')}</div></div>
    ${j.log.length >= 6 ? `<div class="tarjeta seccion"><h2>Forma: media de los últimos 5 partidos</h2>
      ${lineas([{nombre: 'Puntos', color: 'var(--serie-1)', valores: movil(j.log, 7)}, {nombre: 'Game Score', color: 'var(--serie-2)', valores: movil(j.log, 21)},
        {nombre: 'Valoración', color: 'var(--serie-3)', valores: movil(j.log, 19)}], j.log.map(x => 'J' + x[1]), {alto: 220, titulo: 'Media móvil'})}
      <div class="leyenda"><span style="--c:var(--serie-1)">Puntos</span><span style="--c:var(--serie-2)">Game Score</span><span style="--c:var(--serie-3)">Valoración</span></div></div>` : ''}
    ${hist.length > 1 ? `<div class="tarjeta seccion"><h2>Temporada a temporada</h2>
      ${lineas([{nombre: 'Puntos', color: 'var(--serie-1)', valores: hist.map(x => x[4])}, {nombre: 'Valoración', color: 'var(--serie-2)', valores: hist.map(x => x[7])}, {nombre: 'PER', color: 'var(--serie-3)', valores: hist.map(x => x[10])}],
        hist.map(x => `${x[0]}/${String(x[0] + 1).slice(2)}`), {alto: 220, titulo: 'Evolución por temporadas'})}
      <div class="leyenda"><span style="--c:var(--serie-1)">Puntos</span><span style="--c:var(--serie-2)">Valoración</span><span style="--c:var(--serie-3)">PER</span></div>
      <div class="tabla-scroll"><table><thead><tr><th class="izq">Temporada</th><th class="izq">Equipo</th><th>PJ</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th><th>TS%</th><th>USG%</th><th>PER</th><th>BPM</th><th>VORP</th><th>WS/40</th><th>ORtg</th><th>DRtg</th></tr></thead><tbody>
      ${[...hist].reverse().map(x => `<tr><td class="izq">${x[0]}/${String(x[0] + 1).slice(2)}</td><td class="izq">${esc(x[1])}</td><td>${x[2]}</td><td>${fmt(x[3])}</td><td>${fmt(x[4])}</td><td>${fmt(x[5])}</td><td>${fmt(x[6])}</td><td>${fmt(x[7])}</td><td>${fmt(x[8])}</td><td>${fmt(x[9])}</td><td>${fmt(x[10])}</td><td>${signo(x[16], 1)}</td><td>${fmt(x[18], 2)}</td><td>${fmt(x[11], 3)}</td><td>${fmt(x[14])}</td><td>${fmt(x[15])}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
    ${tablaCompeticiones(id)}
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Las más parecidas</h2><p class="muy-tenue" style="margin-top:-.4rem">De cualquier temporada, por estilo (uso, triples, tiros libres, asistencias, rebote, robos, tapones, pérdidas), producción por 40 min y tiro real.</p>
        ${parecidas.length ? `<table class="lideres"><tbody>${parecidas.map(([t, pid, sim]) => `<tr><td class="izq">${t === T.temporada && IDX.jugadoras[pid] ? linkJu(pid) : esc(INDICE.nombres[pid] || '?')}<div class="muy-tenue">${t}/${String(t + 1).slice(2)} · ${esc(((INDICE.historial[pid] || []).find(x => x[0] === t) || [])[1] || '')}</div></td><td><b>${fmt(sim, 0)} %</b><div class="muy-tenue">parecido</div></td></tr>`).join('')}</tbody></table>`
          : '<p class="tenue">Necesita al menos 5 partidos y 12 minutos por partido.</p>'}</div>
      <div class="tarjeta"><h2>Complementarias</h2><p class="muy-tenue" style="margin-top:-.4rem">De esta temporada: las que más destacan justo en lo que a ella le falta.</p>
        ${(j.complementarias || []).length ? `<table class="lideres"><tbody>${j.complementarias.map(([pid, s]) => `<tr><td class="izq">${linkJu(pid)}<div class="muy-tenue">${esc(eq(IDX.jugadoras[pid]?.equipo).nombre)} · ${esc(IDX.jugadoras[pid]?.puesto || '')}</div></td><td>${fmt(s, 1)}</td></tr>`).join('')}</tbody></table>`
          : '<p class="tenue">Necesita al menos 3 partidos y 10 minutos por partido.</p>'}</div>
    </div>
    <div class="tarjeta seccion"><h2>Partido a partido</h2>${tabla('log-' + j.id, log, [
      {t: 'J', f: x => x[1], v: x => x[1]},
      {t: 'Rival', izq: true, f: x => `${x[3] ? 'vs' : 'en'} ${linkEq(x[2])}`},
      {t: '', f: x => `<a href="#/partido/${x[0]}" class="${x[4] ? 'v' : 'd'}">${x[4] ? 'V' : 'D'}</a>`},
      {t: 'Tit', f: x => x[5] ? '✓' : ''},
      {t: 'Min', f: x => minutos(x[6]), v: x => x[6]}, {t: 'Pts', f: x => `<b>${x[7]}</b>`, v: x => x[7]},
      {t: 'T2', f: x => `${x[8]}/${x[9]}`, v: x => x[8]}, {t: 'T3', f: x => `${x[10]}/${x[11]}`, v: x => x[10]}, {t: 'TL', f: x => `${x[12]}/${x[13]}`, v: x => x[12]},
      {t: 'RO', f: x => x[22], v: x => x[22]}, {t: 'Reb', f: x => x[14], v: x => x[14]}, {t: 'Ast', f: x => x[15], v: x => x[15]}, {t: 'Rob', f: x => x[16], v: x => x[16]},
      {t: 'Pér', f: x => x[17], v: x => x[17]}, {t: 'Tap', f: x => x[18], v: x => x[18]}, {t: 'FC', f: x => x[23], v: x => x[23]}, {t: 'FR', f: x => x[24], v: x => x[24]},
      {t: 'Val', f: x => `<b>${x[19]}</b>`, v: x => x[19]}, {t: 'GmSc', f: x => fmt(x[21]), v: x => x[21]}, {t: '+/-', f: x => signo(x[20]), v: x => x[20]},
    ], -1)}</div>`;
};

// lo de una jugadora en cada competición (solo si ha jugado en más de una): un resumen por competición y cada
// temporada; cada fila lleva a su ficha en esa competición y temporada
function tablaCompeticiones(id) {
  const filas = JUG.filas[id];
  if (!filas) return '';
  const nombreC = c => (COMPETICIONES.find(x => x.clave === c) || {corto: c}).corto;
  const enLaWeb = (c, t) => (COMPETICIONES.find(x => x.clave === c) || {temporadas: []}).temporadas.some(x => x.temporada === t);
  const porComp = [...new Set(filas.map(x => x[0]))].map(c => {
    const fs = filas.filter(x => x[0] === c), pj = fs.reduce((s, x) => s + x[3], 0);
    const pond = k => fs.some(x => x[k] != null) ? fs.reduce((s, x) => s + (x[k] || 0) * x[3], 0) / pj : null;
    return {c, temporadas: fs.length, pj, min: pond(4), pts: pond(5), trb: pond(6), ast: pond(7), pir: pond(8), tot: fs.reduce((s, x) => s + (x[13] || 0), 0)};
  });
  despues(() => document.querySelectorAll('[data-ir-comp]').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault();
    usarCompeticion(a.dataset.irComp, a.dataset.irT, `#/jugadora/${id}`);
  })));
  const ir = (c, t, texto) => c === COMP.clave && String(t) === String(T.temporada) ? `<b>${texto}</b>`
    : enLaWeb(c, t) ? `<a href="#/jugadora/${id}" data-ir-comp="${c}" data-ir-t="${t}">${texto}</a>` : texto;
  return h`<div class="tarjeta seccion"><h2>En todas las competiciones</h2>
    <p class="muy-tenue" style="margin-top:-.4rem">Cada competición por separado, solo con sus partidos. Pulsa una temporada para ver su ficha en esa competición.</p>
    <div class="tabla-scroll"><table><thead><tr><th class="izq">Competición</th><th>Temporadas</th><th>PJ</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th><th>Puntos totales</th></tr></thead><tbody>
    ${porComp.map(x => `<tr><td class="izq">${x.c === COMP.clave ? `<b>${esc(nombreC(x.c))}</b>` : esc(nombreC(x.c))}</td><td>${x.temporadas}</td><td>${x.pj}</td><td>${fmt(x.min)}</td><td>${fmt(x.pts)}</td><td>${fmt(x.trb)}</td><td>${fmt(x.ast)}</td><td>${fmt(x.pir)}</td><td>${fmt(x.tot, 0)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="tabla-scroll seccion"><table><thead><tr><th class="izq">Temporada</th><th class="izq">Competición</th><th class="izq">Equipo</th><th>PJ</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th><th>TS%</th><th>PER</th><th>BPM</th><th>GmSc</th></tr></thead><tbody>
    ${filas.map(x => `<tr><td class="izq">${ir(x[0], x[1], `${x[1]}/${String(x[1] + 1).slice(2)}`)}</td><td class="izq">${esc(nombreC(x[0]))}</td><td class="izq">${esc(x[2])}</td><td>${x[3]}</td><td>${fmt(x[4])}</td><td>${fmt(x[5])}</td><td>${fmt(x[6])}</td><td>${fmt(x[7])}</td><td>${fmt(x[8])}</td><td>${fmt(x[9])}</td><td>${fmt(x[10])}</td><td>${signo(x[11], 1)}</td><td>${fmt(x[12])}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="muy-tenue">El PER, el BPM y el TS% de cada fila se calculan frente a su competición: no se comparan entre competiciones de distinto nivel.</p></div>`;
}

VISTAS.comparar = (a, b) => {
  const lista = [...cualificadas()].sort((x, y) => x.nombre.localeCompare(y.nombre));
  const porVal = [...cualificadas()].sort((x, y) => y.med.pir - x.med.pir);
  const ja = IDX.jugadoras[a] || porVal[0];
  const jb = IDX.jugadoras[b] || porVal.find(x => x.id !== ja?.id);
  if (!ja || !jb) return '<p>Aún no hay jugadoras suficientes para comparar.</p>';
  despues(() => ['c-a', 'c-b'].forEach(id => alCambiar(id, () =>
    location.hash = `#/comparar/${document.getElementById('c-a').value}/${document.getElementById('c-b').value}`)));
  const base = cualificadas();
  const pa = percentilesDe(ja, RADAR.map(k => MJK[k]), base), pb = percentilesDe(jb, RADAR.map(k => MJK[k]), base);
  const sel = (id, j) => `<select id="${id}">${lista.concat(lista.some(x => x.id === j.id) ? [] : [j]).map(x => `<option value="${x.id}" ${x.id === j.id ? 'selected' : ''}>${esc(x.nombre)} · ${esc(eq(x.equipo).nombre)}</option>`).join('')}</select>`;
  const filas = ['pj', 'min', 'pts', 'trb', 'ast', 'stl', 'blk', 'tov', 'pir', 'gmsc', 'pts40', 'trb40', 'ast40', 'ts', 'efg', 'p3p', 'ftp', 'p3r', 'ftr',
    'usg', 'ast_pct', 'tov_pct', 'orb_pct', 'drb_pct', 'stl_pct', 'blk_pct', 'ortg', 'drtg', 'per', 'ws', 'ws40', 'con', 'sin', 'onoff'].map(k => MJK[k]);
  return h`${subnav(NAV_JUG, '#/comparar')}<div class="encabezado"><div><h1>Comparar jugadoras</h1><p class="tenue">Percentiles frente a toda la liga (jugadoras con minutos suficientes).</p></div></div>
    <div class="filtros"><label><span><span style="color:var(--serie-1)">●</span> Jugadora 1</span>${sel('c-a', ja)}</label>
      <label><span><span style="color:var(--serie-2)">●</span> Jugadora 2</span>${sel('c-b', jb)}</label></div>
    <div class="rejilla-2">
      <div class="tarjeta"><div class="leyenda"><span style="--c:var(--serie-1)">${esc(ja.nombre)}</span><span style="--c:var(--serie-2)">${esc(jb.nombre)}</span></div>
        ${radar([{nombre: ja.nombre, color: 'var(--serie-1)', valores: pa.map(p => p.p)}, {nombre: jb.nombre, color: 'var(--serie-2)', valores: pb.map(p => p.p)}], pa.map(p => p.c))}</div>
      <div class="tarjeta"><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>${linkJu(ja.id)}</th><th>${linkJu(jb.id)}</th></tr></thead><tbody>
        ${filas.map(m => { const x = m.v(ja), y = m.v(jb), mejor = x == null || y == null || x === y ? -1 : ((x > y) !== !!m.inv ? 0 : 1);
          return `<tr><td class="izq" title="${esc(m.i || '')}">${esc(m.n)}</td><td style="${mejor === 0 ? 'font-weight:700' : ''}">${fmt(x, m.d)}</td><td style="${mejor === 1 ? 'font-weight:700' : ''}">${fmt(y, m.d)}</td></tr>`; }).join('')}
      </tbody></table></div></div></div>`;
};

VISTAS.dispersion = () => {
  const f = VISTAS.dispersion.f || (VISTAS.dispersion.f = {x: 'usg', y: 'ts', grupo: '', equipo: ''});
  const mx = MJK[f.x], my = MJK[f.y];
  despues(() => {
    alCambiar('d-x', v => { f.x = v; pintar(); }); alCambiar('d-y', v => { f.y = v; pintar(); });
    alCambiar('d-grupo', v => { f.grupo = v; pintar(); }); alCambiar('d-equipo', v => { f.equipo = v; pintar(); });
  });
  const base = cualificadas(f.grupo);
  const puntos = base.map(j => ({x: mx.v(j), y: my.v(j), destacado: f.equipo && j.equipo === f.equipo, href: `#/jugadora/${j.id}`,
    texto: (f.equipo ? j.equipo === f.equipo : true) ? j.nombre.split(' ').slice(-1)[0] : '',
    tip: `<b>${esc(j.nombre)}</b><br>${esc(eq(j.equipo).nombre)}<br>${mx.n}: ${fmt(mx.v(j), mx.d)}<br>${my.n}: ${fmt(my.v(j), my.d)}`}));
  return h`${subnav(NAV_JUG, '#/dispersion')}<div class="encabezado"><div><h1>Dispersión</h1><p class="tenue">Cualquier cifra frente a cualquier otra. Jugadoras con minutos suficientes.</p></div></div>
    <div class="filtros"><label>Eje horizontal<select id="d-x">${opcionesMetricas(MJ, f.x)}</select></label>
      <label>Eje vertical<select id="d-y">${opcionesMetricas(MJ, f.y)}</select></label>
      <label>Puesto<select id="d-grupo"><option value="">Todos</option>${['Exterior', 'Alero', 'Interior'].map(g => `<option ${f.grupo === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label>Destacar equipo<select id="d-equipo"><option value="">Ninguno</option>${IDX.clasificacion.map(e => `<option value="${e.id}" ${f.equipo === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></label></div>
    <div class="tarjeta">${dispersion(puntos, mx, my)}<p class="muy-tenue">Las líneas discontinuas son la media. ${f.equipo ? 'En naranja, las del equipo destacado.' : 'Pulsa un punto para ver la ficha.'}</p></div>`;
};

VISTAS.familias = () => {
  const fams = INDICE.familias;
  if (!fams.length) return `${subnav(NAV_JUG, '#/familias')}<p>Hacen falta más datos para agrupar estilos.</p>`;
  const nombres = {usg: 'Uso', p3r: 'Triples', ftr: 'Tiros libres', ast_pct: 'Asistencias', orb_pct: 'Reb. ofensivo', drb_pct: 'Reb. defensivo', stl_pct: 'Robos', blk_pct: 'Tapones', tov_pct: 'Pérdidas'};
  const deEsta = id => T.jugadoras.filter(j => j.familia === id).sort((a, b) => b.tot.min - a.tot.min);
  return h`${subnav(NAV_JUG, '#/familias')}<div class="encabezado"><div><h1>Familias de juego</h1>
      <p class="tenue">Grupos de jugadoras con un estilo parecido (qué hacen, no lo bien que lo hacen), calculados con todas las temporadas por k-medias. Muchas jugadoras son híbridas: es una lectura, no una etiqueta exacta.</p></div></div>
    <div class="rejilla-2">${fams.map(f => `<div class="tarjeta"><h2>${esc(f.nombre)}</h2><p class="muy-tenue" style="margin-top:-.4rem">${f.miembros} temporadas de jugadora en total · rasgos frente a la media (0)</p>
      ${barrasH(Object.entries(f.centro).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({n: nombres[k] || k, v, texto: signo(v, 1)})))}
      <h3 style="margin-top:.75rem">Esta temporada</h3><p>${deEsta(f.id).slice(0, 14).map(j => linkJu(j.id)).join(', ') || '<span class="tenue">Nadie con minutos suficientes.</span>'}</p></div>`).join('')}</div>`;
};

// media móvil de los últimos n partidos de una columna del registro partido a partido
const movil = (log, col, n = 5) => log.map((_, i) => i < n - 1 ? null : media(log.slice(i - n + 1, i + 1).map(x => x[col])));

VISTAS.progresion = () => {
  const lista = (INDICE.progresion || {})[T.temporada] || [];
  const curva = INDICE.curva_edad || [];
  despues(() => activarTablas(() => pintar()));
  return h`${subnav(NAV_JUG, '#/progresion')}<div class="encabezado"><div><h1>Progresión y edad</h1>
      <p class="tenue">Cuánto ha cambiado cada jugadora respecto a la temporada anterior (al menos 10 partidos y 12 minutos por partido en las dos), y cómo rinde la liga según la edad.</p></div></div>
    <div class="tarjeta"><h2>De ${T.temporada - 1}/${String(T.temporada).slice(2)} a ${T.nombre}</h2>
      ${lista.length ? tabla('progresion', lista, [
        {t: 'Jugadora', izq: true, f: x => linkJu(x[0], INDICE.nombres[x[0]]), clase: 'nombre', v: x => INDICE.nombres[x[0]]},
        {t: 'Equipo antes', izq: true, f: x => `<span class="tenue">${esc(x[1])}</span>`}, {t: 'Equipo ahora', izq: true, f: x => `<span class="tenue">${esc(x[2])}</span>`},
        {t: 'PER antes', f: x => fmt(x[3]), v: x => x[3]}, {t: 'PER ahora', f: x => fmt(x[4]), v: x => x[4]},
        {t: 'Cambio PER', f: x => `<b class="${x[5] >= 0 ? 'v' : 'd'}">${signo(x[5], 1)}</b>`, v: x => x[5]},
        {t: 'Val antes', f: x => fmt(x[6]), v: x => x[6]}, {t: 'Val ahora', f: x => fmt(x[7]), v: x => x[7]},
        {t: 'Pts antes', f: x => fmt(x[8]), v: x => x[8]}, {t: 'Pts ahora', f: x => fmt(x[9]), v: x => x[9]},
        {t: 'Cambio BPM', f: x => x[10] != null && x[11] != null ? signo(x[11] - x[10], 1) : '–', v: x => x[10] != null && x[11] != null ? x[11] - x[10] : null},
      ], 5) : '<p class="tenue">Para esta temporada aún no hay jugadoras con partidos suficientes en las dos (o no hay datos de la anterior).</p>'}</div>
    <div class="tarjeta seccion"><h2>Curva de edad</h2>
      ${lineas([{nombre: 'PER medio', color: 'var(--serie-1)', valores: curva.map(x => x[1])}], curva.map(x => x[0] + ' años'), {alto: 240, referencia: 15, titulo: 'PER por edad'})}
      <p class="muy-tenue">PER medio (ponderado por minutos) de todas las temporadas de jugadora según su edad. La raya es 15, la media. Solo edades con al menos 8 casos.</p>
      <div class="tabla-scroll"><table><thead><tr><th class="izq">Edad</th>${curva.map(x => `<th>${x[0]}</th>`).join('')}</tr></thead><tbody>
        <tr><td class="izq">PER</td>${curva.map(x => `<td>${fmt(x[1])}</td>`).join('')}</tr><tr><td class="izq">BPM</td>${curva.map(x => `<td>${signo(x[2], 1)}</td>`).join('')}</tr>
        <tr><td class="izq muy-tenue">Casos</td>${curva.map(x => `<td class="muy-tenue">${x[3]}</td>`).join('')}</tr></tbody></table></div></div>`;
};

function splitsExtra(j) {
  const modo = VISTAS.jugadora.split || 'mes';
  despues(() => alPulsar('j-split', v => { VISTAS.jugadora.split = v; pintar(); }));
  const log = j.log, grupos_ = new Map();
  const equipoDe = x => IDX.partidos[x[0]] ? (IDX.partidos[x[0]].local === x[2] ? IDX.partidos[x[0]].visitante : IDX.partidos[x[0]].local) : null;
  log.forEach((x, i) => {
    let clave;
    if (modo === 'mes') { const f = fechaDe(x[0]); clave = f ? `${f.getFullYear()}-${String(f.getMonth()).padStart(2, '0')}|${MESES[f.getMonth()]}` : '?|?'; }
    else if (modo === 'rival') clave = `${eq(x[2]).nombre}|${eq(x[2]).nombre}`;
    else {
      // días desde el partido anterior de su equipo
      const e = equipoDe(x), ps = e ? IDX.equipos[e]?.partidos || [] : [], k = ps.findIndex(y => y[0] === x[0]);
      const f = fechaDe(x[0]), fa = k > 0 ? fechaDe(ps[k - 1][0]) : null, dias = f && fa ? Math.round((f - fa) / 864e5) : null;
      clave = dias == null ? '9|Primer partido' : dias <= 4 ? '1|4 días o menos' : dias <= 7 ? '2|5 a 7 días' : '3|Más de 7 días';
    }
    if (!grupos_.has(clave)) grupos_.set(clave, []);
    grupos_.get(clave).push(x);
  });
  const filas = [...grupos_.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, v]) => [k.split('|')[1], resumirLog(v)]);
  return `<div class="tarjeta seccion"><div class="encabezado"><h2>Por ${modo === 'mes' ? 'mes' : modo === 'rival' ? 'rival' : 'días de descanso'}</h2>
    ${pildoras('j-split', [['mes', 'Mes'], ['rival', 'Rival'], ['descanso', 'Descanso']], modo)}</div>
    <div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>PJ</th><th>V-D</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th><th>GmSc</th><th>TS%</th><th>+/-</th></tr></thead><tbody>
    ${filas.map(([n, s]) => `<tr><td class="izq">${esc(n)}</td><td>${s.pj}</td><td>${s.v}-${s.pj - s.v}</td><td>${fmt(s.min)}</td><td>${fmt(s.pts)}</td><td>${fmt(s.trb)}</td><td>${fmt(s.ast)}</td><td>${fmt(s.pir)}</td><td>${fmt(s.gmsc)}</td><td>${fmt(s.ts)}</td><td>${signo(s.pm, 1)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

function carreraYProyeccion(j) {
  const c = (INDICE.carrera || {})[j.id], pr = (INDICE.proyeccion || {})[j.id];
  const esUltima = String(T.temporada) === String(INDICE.temporadas[0]?.temporada);
  const max = (k, n) => c && c[k] ? `<tr><td class="izq">${n}</td><td><b>${fmt(c[k][0], k === 'gmsc' ? 1 : 0)}</b></td><td class="izq muy-tenue">${c[k][1]}/${String(c[k][1] + 1).slice(2)} · ${
    c[k][1] === T.temporada ? `<a href="#/partido/${c[k][2]}">ver partido</a>` : 'otra temporada'}</td></tr>` : '';
  return `<div class="rejilla-2 seccion">
    <div class="tarjeta"><h2>Máximos de su carrera</h2><p class="muy-tenue" style="margin-top:-.4rem">En todas las temporadas que hay en LF Stats.</p>
      ${c ? `<table><tbody>${max('pts', 'Puntos')}${max('trb', 'Rebotes')}${max('ast', 'Asistencias')}${max('stl', 'Robos')}${max('blk', 'Tapones')}${max('p3', 'Triples')}${max('pir', 'Valoración')}${max('gmsc', 'Game Score')}
        <tr><td class="izq">Dobles-dobles</td><td><b>${c.dd}</b></td><td></td></tr><tr><td class="izq">Triples-dobles</td><td><b>${c.td}</b></td><td></td></tr></tbody></table>` : '<p class="tenue">Sin datos.</p>'}</div>
    <div class="tarjeta"><h2>Proyección para la próxima temporada</h2>
      ${pr && esUltima ? `<p class="muy-tenue" style="margin-top:-.4rem">Por 40 minutos, con sus tres últimas temporadas (pesos 5-4-3), regresión a la media de la liga y su edad (${pr.edad} años). Fiabilidad: ${fmt(pr.fiabilidad, 0)} %.</p>
        <div class="cifras">${cifra(fmt(pr.pts), 'Puntos/40')}${cifra(fmt(pr.trb), 'Rebotes/40')}${cifra(fmt(pr.ast), 'Asist./40')}${cifra(fmt(pr.stl), 'Robos/40')}${cifra(fmt(pr.blk), 'Tapones/40')}${cifra(fmt(pr.tov), 'Pérdidas/40')}${cifra(fmt(pr.p3), '% triple')}${cifra(fmt(pr.ft), '% tiro libre')}${cifra(fmt(pr.ts), 'TS%')}</div>`
        : `<p class="tenue">${esUltima ? 'Necesita al menos unos 100 minutos (ponderados) en las últimas temporadas.' : 'Solo para la temporada más reciente.'}</p>`}</div></div>`;
}

VISTAS.historico = () => {
  const f = VISTAS.historico.f || (VISTAS.historico.f = {orden: 'pts'});
  despues(() => activarTablas(() => pintar()));
  const filas = Object.entries(INDICE.historial).map(([id, h]) => {
    const s = i => h.reduce((a, x) => a + (x[i] || 0), 0);
    return {id, nombre: INDICE.nombres[id], temporadas: h.length, pj: s(2), tit: s(27), min: s(20), pts: s(21), trb: s(22), ast: s(23), p3: s(24), stl: s(25), blk: s(26),
      ws: s(19), vorp: s(18), equipos: [...new Set(h.map(x => x[1]))].length, ultima: Math.max(...h.map(x => x[0]))};
  }).filter(x => x.pj >= 10);
  const n = INDICE.temporadas.length;
  return h`${subnav(NAV_JUG, '#/historico')}<div class="encabezado"><div><h1>Histórico</h1><p class="tenue">Totales de cada jugadora en las ${n} temporadas de LF Stats (${INDICE.temporadas[n - 1]?.nombre} a ${INDICE.temporadas[0]?.nombre}). Mínimo 10 partidos.</p></div></div>
    <div class="tarjeta">${tabla('historico', filas, [
      {t: 'Jugadora', izq: true, f: x => IDX.jugadoras[x.id] ? linkJu(x.id) : esc(x.nombre), clase: 'nombre', v: x => x.nombre},
      {t: 'Temp.', f: x => x.temporadas, v: x => x.temporadas}, {t: 'Equipos', f: x => x.equipos, v: x => x.equipos},
      {t: 'PJ', f: x => x.pj, v: x => x.pj}, {t: 'Tit', f: x => x.tit, v: x => x.tit}, {t: 'Min', f: x => fmt(x.min, 0), v: x => x.min},
      {t: 'Pts', f: x => fmt(x.pts, 0), v: x => x.pts}, {t: 'Reb', f: x => fmt(x.trb, 0), v: x => x.trb}, {t: 'Ast', f: x => fmt(x.ast, 0), v: x => x.ast},
      {t: 'T3', f: x => fmt(x.p3, 0), v: x => x.p3}, {t: 'Rob', f: x => fmt(x.stl, 0), v: x => x.stl}, {t: 'Tap', f: x => fmt(x.blk, 0), v: x => x.blk},
      {t: 'WS', tip: 'Win Shares sumados', f: x => fmt(x.ws, 1), v: x => x.ws}, {t: 'VORP', f: x => fmt(x.vorp, 1), v: x => x.vorp},
      {t: 'Pts/PJ', f: x => fmt(x.pts / x.pj), v: x => x.pts / x.pj},
    ], 6, {limite: 200})}<p class="muy-tenue">Se muestran las 200 primeras según la columna elegida.</p></div>`;
};
