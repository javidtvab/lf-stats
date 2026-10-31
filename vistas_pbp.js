// LF Stats · lo que sale del jugada a jugada y del gráfico de tiro: mapa de tiro, zonas y calidad de tiro, red de
// asistencias, quintetos en pista, parejas, con y sin de verdad, minutos por cuarto, finales apretados y parciales.
'use strict';

const ZONAS_CORTO = {'Zona restringida': 'Restringida', 'Pintura': 'Pintura', 'Media distancia': 'Media dist.', 'Triple de esquina': 'Triple esquina', 'Triple frontal': 'Triple frontal'};
const pbpJ = j => j && j.pbp;
const pctZona = (pb, z) => pb && pb.tiro && pb.tiro.zonas[z] && pb.tiro.zonas[z][0] ? 100 * pb.tiro.zonas[z][1] / pb.tiro.zonas[z][0] : null;
const frecZona = (pb, z) => pb && pb.tiro && pb.tiro.tiros ? 100 * (pb.tiro.zonas[z] || [0])[0] / pb.tiro.tiros : null;
const apellido = id => (IDX.jugadoras[id]?.nombre || '?').split(' ').slice(-1)[0];

// ---------------------------------------------------------------- catálogo: cifras nuevas
mj('Tiro (jugada a jugada)', 'xefg', 'Tiro efectivo esperado por sus zonas', 'xeFG%', j => pbpJ(j)?.tiro?.xefg, 1, {i: 'El eFG% que haría una tiradora media de la liga con sus mismos tiros (por zonas)'});
mj('Tiro (jugada a jugada)', 'sobre_esperado', 'Tiro por encima de lo esperado', 'eFG−xeFG', j => pbpJ(j)?.tiro?.sobre_esperado, 1, {i: 'Su eFG% menos el esperado por las zonas desde las que tira: cuánto mejor tira que la media desde esos sitios'});
mj('Tiro (jugada a jugada)', 'distancia', 'Distancia media de tiro (m)', 'Dist', j => pbpJ(j)?.distancia, 2);
mj('Tiro (jugada a jugada)', 'asistidas', '% de canastas asistidas', '%Asist', j => pbpJ(j)?.asistidas?.pct, 1, {i: '% de sus canastas de campo que vienen de una asistencia (bajo: se crea su tiro)'});
for (const z of ['Zona restringida', 'Pintura', 'Media distancia', 'Triple de esquina', 'Triple frontal']) {
  mj('Tiro (jugada a jugada)', 'fr_' + z, '% de sus tiros: ' + z.toLowerCase(), 'Fr ' + ZONAS_CORTO[z], j => frecZona(pbpJ(j), z));
  mj('Tiro (jugada a jugada)', 'pc_' + z, '% de acierto: ' + z.toLowerCase(), '% ' + ZONAS_CORTO[z], j => pctZona(pbpJ(j), z));
}
const conSinDe = j => j._conSin !== undefined ? j._conSin : IDX.equipos[j.equipo]?.pbp?.con_sin?.[j.id];  // _conSin: lo pone el comparador
mj('Con y sin (jugada a jugada)', 'on_net', 'Neto del equipo con ella en pista', 'Neto con', j => conSinDe(j)?.con?.net, 1, {i: 'Diferencia de puntos por 100 posesiones de su equipo mientras está en pista'});
mj('Con y sin (jugada a jugada)', 'off_net', 'Neto del equipo sin ella', 'Neto sin', j => conSinDe(j)?.sin?.net, 1, {inv: true});
mj('Con y sin (jugada a jugada)', 'onoff_pbp', 'Con y sin (diferencia por 100 pos.)', 'On-Off', j => conSinDe(j)?.dif, 1, {i: 'Cuánto mejora el neto de su equipo por 100 posesiones con ella en pista'});
mj('Con y sin (jugada a jugada)', 'on_ortg', 'Ataque del equipo con ella', 'ORtg con', j => conSinDe(j)?.con?.ortg);
mj('Con y sin (jugada a jugada)', 'on_drtg', 'Defensa del equipo con ella', 'DRtg con', j => conSinDe(j)?.con?.drtg, 1, {inv: true});
mj('Con y sin (jugada a jugada)', 'onoff_o', 'Ataque: con menos sin', 'ΔORtg', j => { const c = conSinDe(j); return c && c.con.ortg != null && c.sin.ortg != null ? c.con.ortg - c.sin.ortg : null; });
mj('Con y sin (jugada a jugada)', 'onoff_d', 'Defensa: sin menos con', 'ΔDRtg', j => { const c = conSinDe(j); return c && c.con.drtg != null && c.sin.drtg != null ? c.sin.drtg - c.con.drtg : null; }, 1, {i: 'Puntos por 100 posesiones que encaja de menos su equipo con ella en pista'});
mj('Finales apretados', 'ap_pts', 'Puntos en finales apretados', 'PtsFA', j => pbpJ(j)?.final_apretado?.pts, 0, {i: 'Últimos 5 minutos del 4.º cuarto o la prórroga con 5 puntos o menos de diferencia'});
mj('Finales apretados', 'ap_pm', '+/- en finales apretados', '+/-FA', j => pbpJ(j)?.final_apretado?.pm, 0);
mj('Finales apretados', 'ap_tc', '% de tiro en finales apretados', 'TC%FA', j => { const a = pbpJ(j)?.final_apretado; return a && a.tci ? 100 * a.tc / a.tci : null; });
for (const [k, n] of [['efg_xp', 'Tiro efectivo esperado (por zonas)'], ['sobre', 'Tiro por encima de lo esperado']]) {
  me('Tiro (jugada a jugada)', k, n, k === 'efg_xp' ? 'xeFG%' : 'eFG−xeFG', e => e.pbp?.tiro?.[k === 'efg_xp' ? 'xefg' : 'sobre_esperado']);
  me('Tiro (jugada a jugada)', k + '_r', n + ' (rival)', (k === 'efg_xp' ? 'xeFG%' : 'eFG−xeFG') + ' r', e => e.pbp?.tiro_rival?.[k === 'efg_xp' ? 'xefg' : 'sobre_esperado'], 1, {inv: true});
}
me('Jugada a jugada', 'ap_net', 'Neto en finales apretados', 'NetoFA', e => e.pbp?.final_apretado?.net, 1, {i: 'Por 100 posesiones, en los últimos 5 minutos con 5 puntos o menos de diferencia'});
me('Jugada a jugada', 'parcial_favor', 'Mayor parcial a favor (media por partido)', 'Parcial+', e => e.pbp?.parciales?.mayor_favor);
me('Jugada a jugada', 'parcial_contra', 'Mayor parcial en contra (media)', 'Parcial−', e => e.pbp?.parciales?.mayor_contra, 1, {inv: true});
me('Jugada a jugada', 'n_quintetos_pista', 'Quintetos distintos en pista', 'Quint.', e => e.pbp?.n_quintetos, 0);
MJ.forEach(m => { MJK[m.k] = m; });   // los índices por clave se crearon antes de añadir estas cifras
ME.forEach(m => { MEK[m.k] = m; });

// ---------------------------------------------------------------- mapa de tiro (media pista, en metros)
function mapaTiro(tiros, opciones = {}) {
  // tiros: [[metros a lo ancho, metros desde la línea de fondo, anotado, zona]] en media pista, con el aro arriba
  const aro = 1.575;
  const pts = tiros.map(([x, y, a]) => [x, y, a]);
  const lineas_ = `<rect x="0" y="0" width="15" height="14" fill="none" class="pista"/>
    <rect x="${7.5 - 2.45}" y="0" width="4.9" height="5.8" fill="none" class="pista"/>
    <circle cx="7.5" cy="5.8" r="1.8" fill="none" class="pista"/>
    <line x1="6.6" x2="8.4" y1="1.2" y2="1.2" class="pista"/><circle cx="7.5" cy="${aro}" r="0.23" fill="none" class="pista"/>
    <path d="M ${7.5 - 1.25} ${aro} A 1.25 1.25 0 0 0 ${7.5 + 1.25} ${aro}" fill="none" class="pista"/>
    <path d="M 0.9 0 L 0.9 2.99 A 6.75 6.75 0 0 0 14.1 2.99 L 14.1 0" fill="none" class="pista"/>`;
  const puntos = pts.map(([x, y, a]) => a ? `<circle cx="${x}" cy="${y}" r="0.24" fill="var(--acento)" fill-opacity=".85"/>`
    : `<circle cx="${x}" cy="${y}" r="0.2" fill="none" stroke="var(--serie-2)" stroke-width="0.07" stroke-opacity=".8"/>`).join('');
  return `<svg class="grafico mapa-tiro" viewBox="-0.3 -0.3 15.6 14.6" role="img" aria-label="${esc(opciones.titulo || 'Mapa de tiro')}">${lineas_}${puntos}</svg>
    <div class="leyenda"><span style="--c:var(--acento)">Anotado</span><span style="--c:var(--serie-2)">Fallado</span></div>`;
}

// ---------------------------------------------------------------- mapas de calor del tiro (cuadros de 1 × 1 m)
const CELDA = 1, COLS = 15, FILAS = 14;
function aMediaPista(x, y) { return [x, y]; }   // los tiros ya vienen en metros de media pista (jugada_a_jugada.py)
function rejillaTiros(tiros) {
  const g = Array.from({length: FILAS}, () => Array.from({length: COLS}, () => [0, 0]));
  tiros.forEach(([l, t, a]) => { const [x, y] = aMediaPista(l, t); const c = Math.min(COLS - 1, Math.floor(x / CELDA)), f = Math.min(FILAS - 1, Math.floor(y / CELDA));
    if (f >= 0 && c >= 0) { g[f][c][0]++; g[f][c][1] += a; } });
  return g;
}
function rejillaLiga() {
  if (IDX._rejillaLiga) return IDX._rejillaLiga;
  return (IDX._rejillaLiga = rejillaTiros(T.equipos.flatMap(e => e.pbp?.tiros || [])));
}
const LINEAS_PISTA = `<rect x="0" y="0" width="15" height="14" fill="none" class="pista"/>
  <rect x="5.05" y="0" width="4.9" height="5.8" fill="none" class="pista"/><circle cx="7.5" cy="5.8" r="1.8" fill="none" class="pista"/>
  <line x1="6.6" x2="8.4" y1="1.2" y2="1.2" class="pista"/><circle cx="7.5" cy="1.575" r="0.23" fill="none" class="pista"/>
  <path d="M 6.25 1.575 A 1.25 1.25 0 0 0 8.75 1.575" fill="none" class="pista"/>
  <path d="M 0.9 0 L 0.9 2.99 A 6.75 6.75 0 0 0 14.1 2.99 L 14.1 0" fill="none" class="pista"/>`;

function mapaCalorTiro(tiros, modo, titulo, rival) {
  const g = rejillaTiros(tiros), liga = rejillaLiga(), total = tiros.length || 1;
  const maxFrec = Math.max(1e-9, ...g.flat().map(c => c[0] / total));
  const celdas = [];
  g.forEach((fila, f) => fila.forEach(([n, a], c) => {
    if (!n) return;
    const pctC = 100 * a / n, [nl, al] = liga[f][c], pctL = nl ? 100 * al / nl : null;
    let color, opacidad;
    if (modo === 'frecuencia') { color = 'var(--acento)'; opacidad = 0.12 + 0.88 * Math.sqrt((n / total) / maxFrec); }
    else {
      if (n < 5 || pctL == null) return;
      const d = pctC - pctL;  // positivo: aciertan más que la media de la liga desde ahí
      color = (rival ? d < 0 : d > 0) ? 'var(--acento)' : 'var(--rojo)'; opacidad = Math.min(0.9, 0.15 + Math.abs(d) / 25);
    }
    const tip = `<b>${titulo}</b><br>${n} tiros (${fmt(100 * n / total, 1)} % del total)<br>Acierto: ${fmt(pctC, 0)} % · liga: ${fmt(pctL, 0)} %`;
    celdas.push(`<rect x="${c * CELDA + 0.04}" y="${f * CELDA + 0.04}" width="${CELDA - 0.08}" height="${CELDA - 0.08}" rx="0.12" fill="${color}" fill-opacity="${opacidad.toFixed(2)}" data-tip="${esc(tip)}"/>`);
  }));
  return `<svg class="grafico mapa-tiro" viewBox="-0.3 -0.3 15.6 14.6" role="img" aria-label="${esc(titulo)}">${celdas.join('')}<g pointer-events="none">${LINEAS_PISTA}</g></svg>`;
}

function mapasCalorEquipo(e) {
  const pb = e.pbp;
  if (!pb || !pb.tiros) return '';
  const modo = VISTAS.equipo.calor || 'frecuencia';
  despues(() => alPulsar('calor-modo', v => { VISTAS.equipo.calor = v; pintar(); }));
  const leyenda = modo === 'frecuencia'
    ? '<div class="leyenda"><span style="--c:var(--acento)">Más intenso, más tiros desde ese cuadro (de 1 × 1 m)</span></div>'
    : '<div class="leyenda"><span style="--c:var(--acento)">Bien para el equipo</span><span style="--c:var(--rojo)">Mal para el equipo</span></div>';
  return `<div class="tarjeta seccion"><div class="encabezado"><h2>Mapa de calor del tiro</h2>${pildoras('calor-modo', [['frecuencia', 'Frecuencia'], ['acierto', 'Acierto frente a la liga']], modo)}</div>
    ${leyenda}
    <div class="rejilla-2"><div><h3>${esc(e.nombre)} <span class="muy-tenue">(${pb.tiros.length} tiros)</span></h3>${mapaCalorTiro(pb.tiros, modo, 'Tiros de ' + esc(e.nombre), false)}</div>
      <div><h3>Sus rivales <span class="muy-tenue">(${pb.tiros_rival.length} tiros)</span></h3>${mapaCalorTiro(pb.tiros_rival, modo, 'Tiros de sus rivales', true)}</div></div>
    <p class="muy-tenue">${modo === 'frecuencia' ? 'Desde dónde tira el equipo y desde dónde le tiran sus rivales.'
      : 'Acierto en cada cuadro frente a la media de la liga desde ese mismo cuadro (solo cuadros con 5 tiros o más). En el de los rivales, azul quiere decir que le aciertan menos que a la media: buena defensa ahí.'} Pasa el ratón por un cuadro para ver las cifras.</p></div>`;
}

function tablaZonas(tiro, liga) {
  if (!tiro) return '<p class="tenue">Sin tiros en el gráfico.</p>';
  return `<div class="tabla-scroll"><table><thead><tr><th class="izq">Zona</th><th>Tiros</th><th>% de sus tiros</th><th>Acierto</th><th>Liga</th><th>Diferencia</th></tr></thead><tbody>
    ${Object.entries(tiro.zonas).map(([z, [n, a]]) => { const p = n ? 100 * a / n : null, l = liga[z][2];
      return `<tr><td class="izq">${esc(z)}</td><td>${a}/${n}</td><td>${fmt(100 * n / tiro.tiros, 0)} %</td><td><b>${fmt(p)}</b></td><td class="muy-tenue">${fmt(l)}</td><td>${n ? signo(p - l, 1) : '–'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="cifras" style="margin-top:.75rem">${cifra(fmt(tiro.efg), 'eFG% real')}${cifra(fmt(tiro.xefg), 'eFG% esperado', MJK.xefg.i)}${cifra(signo(tiro.sobre_esperado, 1), 'Por encima de lo esperado', MJK.sobre_esperado.i)}</div>`;
}

// ---------------------------------------------------------------- en la ficha de la jugadora
function bloquePbpJugadora(j) {
  const pb = pbpJ(j);
  if (!pb || !T.pbp) return `<div class="tarjeta seccion"><h2>Tiro, asistencias y con y sin</h2><p class="tenue">${T.pbp ? 'Sin datos del jugada a jugada para esta jugadora.' : 'El jugada a jugada de esta temporada aún no se ha leído.'}</p></div>`;
  const cs = conSinDe(j), red = IDX.equipos[j.equipo]?.pbp?.red || [];
  const da = red.filter(x => x[0] === j.id).slice(0, 6), recibe = red.filter(x => x[1] === j.id).slice(0, 6);
  const fa = pb.final_apretado;
  return `<div class="rejilla-2 seccion">
    <div class="tarjeta"><h2>Mapa de tiro</h2>${mapaTiro(pb.tiros, {titulo: 'Mapa de tiro de ' + j.nombre})}<p class="muy-tenue">${pb.tiros.length} tiros de campo · distancia media ${fmt(pb.distancia, 1)} m</p></div>
    <div class="tarjeta"><h2>Por zonas</h2>${tablaZonas(pb.tiro, T.pbp.liga_tiro)}</div></div>
  <div class="rejilla-2 seccion">
    <div class="tarjeta"><h2>Con y sin ella (jugada a jugada)</h2>${cs ? `<div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>Min</th><th>Ataque</th><th>Defensa</th><th>Neto</th></tr></thead><tbody>
      <tr><td class="izq">Con ella en pista</td><td>${fmt(cs.con.min, 0)}</td><td>${fmt(cs.con.ortg)}</td><td>${fmt(cs.con.drtg)}</td><td><b>${signo(cs.con.net, 1)}</b></td></tr>
      <tr><td class="izq">Sin ella</td><td>${fmt(cs.sin.min, 0)}</td><td>${fmt(cs.sin.ortg)}</td><td>${fmt(cs.sin.drtg)}</td><td><b>${signo(cs.sin.net, 1)}</b></td></tr></tbody></table></div>
      <p class="muy-tenue">Puntos por 100 posesiones de su equipo. Diferencia: <b>${signo(cs.dif, 1)}</b>.</p>` : '<p class="tenue">Sin datos.</p>'}
      <h3 style="margin-top:1rem">Minutos por cuarto (total)</h3>${barrasH(pb.min_cuarto.map((m, i) => ({n: i < 4 ? `${i + 1}.º cuarto` : 'Prórroga', v: m, texto: fmt(m, 0) + ' min'})).filter((x, i) => i < 4 || x.v))}
      ${fa ? `<h3 style="margin-top:1rem">Finales apretados</h3><div class="cifras">${cifra(fa.pts, 'Puntos')}${cifra(fa.tci ? `${fa.tc}/${fa.tci}` : '–', 'Tiros de campo')}${cifra(signo(fa.pm), '+/-')}</div>` : ''}</div>
    <div class="tarjeta"><h2>Asistencias</h2><div class="cifras">${cifra(fmt(pb.asistidas.pct, 0) + ' %', '% de canastas asistidas', MJK.asistidas.i)}
      ${cifra(`${pb.asistidas.t2[1]}/${pb.asistidas.t2[0]}`, 'De 2 asistidas')}${cifra(`${pb.asistidas.t3[1]}/${pb.asistidas.t3[0]}`, 'Triples asistidos')}</div>
      <h3 style="margin-top:1rem">A quién asiste</h3>${da.length ? barrasH(da.map(x => ({n: linkJu(x[1]), v: x[2], texto: x[2]})), {d: 0}) : '<p class="tenue">–</p>'}
      <h3 style="margin-top:1rem">Quién le asiste</h3>${recibe.length ? barrasH(recibe.map(x => ({n: linkJu(x[0]), v: x[2], texto: x[2]})), {d: 0}) : '<p class="tenue">–</p>'}</div></div>`;
}

// ---------------------------------------------------------------- en la ficha del equipo
function bloquePbpEquipo(e) {
  const pb = e.pbp;
  if (!pb || !T.pbp) return `<div class="tarjeta seccion"><h2>Quintetos, asistencias y zonas de tiro</h2><p class="tenue">El jugada a jugada de esta temporada aún no se ha leído.</p></div>`;
  const modo = VISTAS.equipo.quint || 'usados';
  despues(() => alPulsar('q-modo', v => { VISTAS.equipo.quint = v; pintar(); }));
  const conMin = pb.quintetos.filter(q => q.min >= 10);
  const lista = modo === 'usados' ? pb.quintetos.slice(0, 10) : [...conMin].sort((a, b) => (modo === 'mejores' ? -1 : 1) * ((a.net ?? 0) - (b.net ?? 0))).slice(0, 10);
  const filaQ = q => `<tr><td class="izq" style="white-space:normal">${q.jugadoras.map(x => linkJu(x, apellido(x))).join(' · ')}</td><td>${fmt(q.min, 0)}</td><td>${q.pf}-${q.pc}</td><td>${fmt(q.ortg)}</td><td>${fmt(q.drtg)}</td><td><b>${signo(q.net, 1)}</b></td></tr>`;
  const jug = [...new Set(pb.red.flatMap(x => [x[0], x[1]]))].filter(x => IDX.jugadoras[x]).sort((a, b) => (IDX.jugadoras[b].tot.min || 0) - (IDX.jugadoras[a].tot.min || 0)).slice(0, 11);
  const maxRed = Math.max(1, ...pb.red.map(x => x[2]));
  const celdas = jug.map(a => jug.map(b => { const x = pb.red.find(r => r[0] === a && r[1] === b); return x ? {v: x[2] / maxRed, texto: x[2], tip: `${esc(apellido(a))} → ${esc(apellido(b))}: ${x[2]} asistencias`} : null; }));
  const cs = Object.entries(pb.con_sin).filter(([id, c]) => IDX.jugadoras[id] && c.con.min >= 40).sort((a, b) => (b[1].dif ?? -99) - (a[1].dif ?? -99));
  const par = pb.parciales, fa = pb.final_apretado;
  return `<div class="tarjeta seccion"><div class="encabezado"><h2>Quintetos en pista</h2>${pildoras('q-modo', [['usados', 'Más usados'], ['mejores', 'Mejores'], ['peores', 'Peores']], modo)}</div>
      <div class="tabla-scroll"><table><thead><tr><th class="izq">Quinteto</th><th>Min</th><th>Parcial</th><th>Ataque</th><th>Defensa</th><th>Neto</th></tr></thead><tbody>${lista.map(filaQ).join('')}</tbody></table></div>
      <p class="muy-tenue">${pb.n_quintetos} quintetos distintos han pisado la pista. Ataque, defensa y neto: puntos por 100 posesiones mientras estaban juntas${modo !== 'usados' ? ' (mínimo 10 minutos)' : ''}.</p></div>
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Con y sin cada jugadora (jugada a jugada)</h2>${barrasH(cs.map(([id, c]) => ({n: linkJu(id), v: c.dif, texto: signo(c.dif, 1),
        tip: `<b>${esc(IDX.jugadoras[id].nombre)}</b><br>Con ella: ataque ${fmt(c.con.ortg)}, defensa ${fmt(c.con.drtg)}, neto ${signo(c.con.net, 1)} (${fmt(c.con.min, 0)} min)<br>Sin ella: ataque ${fmt(c.sin.ortg)}, defensa ${fmt(c.sin.drtg)}, neto ${signo(c.sin.net, 1)}`})))}
        <p class="muy-tenue">Cuánto cambia el neto del equipo por 100 posesiones con cada jugadora en pista. Mínimo 40 minutos.</p></div>
      <div class="tarjeta"><h2>Mejores parejas</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">Pareja</th><th>Min</th><th>Neto</th></tr></thead><tbody>
        ${[...pb.parejas].sort((a, b) => (b.net ?? -99) - (a.net ?? -99)).slice(0, 8).map(q => `<tr><td class="izq">${q.jugadoras.map(x => linkJu(x, apellido(x))).join(' + ')}</td><td>${fmt(q.min, 0)}</td><td><b>${signo(q.net, 1)}</b></td></tr>`).join('')}
        </tbody></table></div><p class="muy-tenue">Parejas con al menos 40 minutos juntas.</p></div></div>
    <div class="tarjeta seccion"><h2>Red de asistencias</h2>${mapaCalor(jug.map(x => linkJu(x, apellido(x))), jug.map(x => esc(apellido(x))), celdas,
      {nota: 'Fila: la que asiste; columna: la que anota. Más oscuro, más asistencias.'})}</div>
    ${mapasCalorEquipo(e)}
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Zonas de tiro del equipo</h2>${tablaZonas(pb.tiro, T.pbp.liga_tiro)}</div>
      <div class="tarjeta"><h2>Zonas de tiro de sus rivales</h2>${tablaZonas(pb.tiro_rival, T.pbp.liga_tiro)}<p class="muy-tenue">Desde dónde le tiran y con qué acierto: su defensa por zonas.</p></div></div>
    <div class="tarjeta seccion"><h2>Parciales y finales apretados</h2><div class="cifras">
      ${cifra(fmt(par.mayor_favor), 'Mayor parcial a favor (media)')}${cifra(fmt(par.mayor_contra), 'Mayor parcial en contra (media)')}${cifra(par.maximo, 'Su mayor parcial')}
      ${cifra(par.de_10_favor, 'Partidos con parcial de 10+ a favor')}${cifra(par.de_10_contra, 'Con parcial de 10+ en contra')}
      ${fa ? cifra(signo(fa.net, 1), 'Neto en finales apretados', MEK.ap_net.i) + cifra(`${fa.pf}-${fa.pc}`, 'Puntos en finales apretados') : ''}</div></div>`;
}

VISTAS.tiro = () => {
  if (!T.pbp) return `<h1>Tiro</h1><p class="tenue">El jugada a jugada de esta temporada aún no se ha leído.</p>`;
  const c = T.pbp.control, L = T.pbp.liga_tiro, total = Object.values(L).reduce((a, x) => a + x[0], 0);
  despues(() => activarTablas(() => pintar()));
  return h`${subnav(NAV_LIGA, '#/tiro')}<div class="encabezado"><div><h1>Tiro y jugada a jugada</h1><p class="tenue">Del gráfico de tiro y del jugada a jugada de ${c.partidos} de ${c.total} partidos (${c.cuadran} cuadran exactamente con el acta en minutos y puntos).</p></div></div>
    <div class="rejilla-2"><div class="tarjeta"><h2>Mapa de calor de la liga</h2>${mapaCalorTiro(T.equipos.flatMap(e => e.pbp?.tiros || []), 'frecuencia', 'Tiros de toda la liga', false)}
      <p class="muy-tenue">Más intenso, más tiros. Cada equipo, con sus rivales, en su ficha.</p></div>
    <div class="tarjeta"><h2>Desde dónde se tira en la liga</h2>${barrasH(Object.entries(L).map(([z, x]) => ({n: esc(z), v: 100 * x[0] / total, texto: `${fmt(100 * x[0] / total, 0)} % · acierto ${fmt(x[2])} %`})))}</div></div>
    <div class="tarjeta seccion"><h2>Equipos</h2>${tabla('tiro-eq', IDX.jugadas.filter(e => e.pbp), [
      {t: 'Equipo', izq: true, f: e => linkEq(e.id), clase: 'nombre', v: e => e.nombre},
      ...ME.filter(m => m.g === 'Tiro (jugada a jugada)' || m.g === 'Jugada a jugada').map(m => colM(m)),
    ], 2)}</div>`;
};
