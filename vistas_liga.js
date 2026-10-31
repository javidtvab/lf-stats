// LF Stats · vistas de liga, jornadas, partidos, portada y método.
'use strict';

const NAV_LIGA = [['#/liga', 'Clasificación'], ['#/simulacion', 'Simulación'], ['#/previa', 'Previa'], ['#/lideres', 'Líderes'],
  ['#/records', 'Récords'], ['#/ambiente', 'La liga en cifras'], ['#/decide', 'Qué decide los partidos'], ['#/elo', 'Elo'], ['#/ampliada', 'Clasificación ampliada'], ['#/tiro', 'Tiro y jugada a jugada'], ['#/entrenadores', 'Entrenadores'], ['#/arbitros', 'Árbitros']];

// clasificación de un grupo; con varios grupos, las cifras de la temporada entera (pitagóricas, SRS…) no se ponen,
// porque mezclan partidos de otros grupos o fases
function tablaGrupo(g, limite) {
  const compacta = Boolean(limite), sola = g.completa;
  return tabla((compacta ? 'clasif-portada' : 'clasif') + g.id, g.filas, [
    {t: '#', f: e => `<span class="pos">${e.pos}</span>`, v: e => -e.pos},
    {t: 'Equipo', izq: true, f: e => linkEq(e.id), clase: 'nombre'},
    {t: 'PJ', f: e => e.pj, v: e => e.pj},
    {t: 'V', f: e => e.pg, v: e => e.pg},
    {t: 'D', f: e => e.pj - e.pg, v: e => e.pj - e.pg},
    ...(compacta ? [] : [{t: '%V', f: e => fmt(pct(e.pg, e.pj), 1), v: e => e.pg / e.pj},
      {t: 'Dif. V', tip: 'Partidos por detrás del líder', f: e => { const l = g.filas[0]; const gb = ((l.pg - e.pg) + ((e.pj - e.pg) - (l.pj - l.pg))) / 2; return gb ? fmt(gb, 1) : '–'; }},
      {t: 'PF', f: e => e.pf, v: e => e.pf}, {t: 'PC', f: e => e.pc, v: e => -e.pc},
      {t: 'PF/PJ', f: e => fmt(e.pf / e.pj), v: e => e.pf / e.pj}, {t: 'PC/PJ', f: e => fmt(e.pc / e.pj), v: e => -e.pc / e.pj}]),
    {t: 'Dif', f: e => signo(e.pf - e.pc), v: e => e.pf - e.pc},
    ...(compacta || !sola ? [] : [colM(MEK.pitag), {t: 'D pitag', tip: 'Derrotas pitagóricas', f: e => fmt(e.pj - e.pitag), v: e => -(e.pj - e.pitag)}, colM(MEK.suerte), colM(MEK.srs), colM(MEK.sos_srs), colM(MEK.fuerza)]),
    ...(sola ? [{t: 'Neto', tip: 'Diferencia de puntos por 100 posesiones', f: e => signo(e.net, 1), v: e => e.net}] : []),
    {t: 'Racha', f: e => racha(e.racha)},
  ], 0, {limite});
}

function tablaClasificacion(limite) {
  const varios = IDX.grupos.length > 1, ligas = IDX.grupos.filter(g => g.liga), cruces = IDX.grupos.filter(g => !g.liga);
  const titulo = g => varios ? `<h3 class="seccion">${esc(g.nombre)}</h3>` : '';
  return ligas.map(g => titulo(g) + tablaGrupo(g, limite)).join('') +
    (cruces.length && !limite ? `<h3 class="seccion">Cruces</h3><div class="partidos-lista">${cruces.map(g => T.partidos.filter(p => p.grupo === g.id)
      .map(p => `<div class="muy-tenue">${esc(g.nombre)}</div>${partidoFila(p)}`).join('')).join('')}</div>` : '');
}

VISTAS.liga = () => {
  const f = VISTAS.liga.f || (VISTAS.liga.f = {destacados: [IDX.clasificacion[0]?.id].filter(Boolean)});
  despues(() => {
    activarTablas(() => pintar());
    alCambiar('l-equipo', v => { if (v && !f.destacados.includes(v)) f.destacados = [...f.destacados, v].slice(-4); pintar(); });
    document.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => { f.destacados = f.destacados.filter(x => x !== b.dataset.quitar); pintar(); }));
  });
  // evolución: la de cada grupo de liga con algún equipo destacado (o la del primero)
  const conEvol = IDX.grupos.filter(g => g.liga && g.jornadas.length >= 2);
  const evol = conEvol.filter(g => g.filas.some(e => f.destacados.includes(e.id)));
  const varios = IDX.grupos.length > 1;
  return h`${subnav(NAV_LIGA, '#/liga')}<div class="encabezado"><div><h1>${esc(COMP.corto)} · ${esc(T.nombre)}</h1><p class="tenue">Jornada ${T.jornadas[T.jornadas.length - 1] ?? '–'} de ${T.total_jornadas}.${varios ? ` ${IDX.grupos.length} grupos o fases.` : ''}</p></div></div>
    <div class="tarjeta"><h2>Clasificación</h2>${tablaClasificacion()}<p class="muy-tenue">Desempates como la FEB: enfrentamientos directos (si ya se han jugado la ida y la vuelta), luego diferencia de puntos general y puntos a favor.${varios ? ' Cada grupo, solo con sus partidos.' : ' Pitag: victorias que «tocarían» por puntos (exponente 7, ajustado a la LF Endesa); SRS: diferencia ajustada por calendario; Fuerza: ajustada por rival y campo.'}</p></div>
    ${conEvol.length ? `<div class="tarjeta seccion"><div class="encabezado"><h2>Evolución jornada a jornada</h2>
      <label class="filtros" style="margin:0">Añadir equipo (hasta 4) <select id="l-equipo"><option value="">Elige…</option>${conEvol.flatMap(g => g.filas).map(e => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}</select></label></div>
      <div class="leyenda">${f.destacados.map((id, i) => `<span style="--c:${COLORES[i]}">${esc(eq(id).nombre)} <button class="boton-mini" data-quitar="${id}" aria-label="Quitar">✕</button></span>`).join('')}</div>
      ${(evol.length ? evol : conEvol.slice(0, 1)).map(g => (varios ? `<h3>${esc(g.nombre)}</h3>` : '') + bump(f.destacados, g)).join('')}</div>` : ''}`;
};

VISTAS.simulacion = () => {
  if (!T.simulacion) return `${subnav(NAV_LIGA, '#/simulacion')}<p class="tenue">La fase de liga ya ha terminado: no queda nada que simular.</p>`;
  const sim = T.simulacion, varios = IDX.grupos.length > 1;
  const suma = (e, a, b) => 100 * sim[e.id].puestos.slice(a, b).reduce((x, y) => x + y, 0);
  // un bloque por cada grupo que tiene simulación (los equipos de la fila son los del grupo, con su balance en él)
  const bloque = g => {
    const filas = g.filas.filter(e => sim[e.id] && (!T.grupos || sim[e.id].grupo === g.id)), n = filas.length;
    if (!n) return '';
    const orden = [...filas].sort((a, b) => sim[b.id].victorias - sim[a.id].victorias);
    const celdas = orden.map(e => sim[e.id].puestos.map((p, i) => ({v: Math.min(1, p * 2.2), texto: p >= 0.005 ? fmt(100 * p, 0) : '',
      tip: `<b>${esc(e.nombre)}</b><br>${i + 1}.º: ${fmt(100 * p, 1)} %`})));
    return h`${varios ? `<h2 class="seccion">${esc(g.nombre)}</h2>` : ''}<div class="tarjeta">${tabla('sim' + g.id, orden, [
        {t: 'Equipo', izq: true, f: e => linkEq(e.id), clase: 'nombre'},
        {t: 'Ahora', f: e => `${e.pg}-${e.pj - e.pg}`, v: e => e.pg},
        {t: 'V esperadas', f: e => fmt(sim[e.id].victorias), v: e => sim[e.id].victorias},
        {t: '1.º', f: e => fmt(suma(e, 0, 1), 1) + ' %', v: e => suma(e, 0, 1)},
        ...(T.playoff ? [{t: `Playoff (top ${T.playoff})`, f: e => fmt(suma(e, 0, T.playoff), 1) + ' %', v: e => suma(e, 0, T.playoff)}] : []),
        ...(T.descenso ? [{t: `Descenso (últ. ${T.descenso})`, f: e => fmt(suma(e, n - T.descenso, n), 1) + ' %', v: e => suma(e, n - T.descenso, n)}] : []),
        {t: 'Fuerza', f: e => signo(eq(e.id).fuerza, 1), v: e => eq(e.id).fuerza},
      ], 2)}</div>
      <div class="tarjeta seccion"><h2>Probabilidad de cada puesto final (%)</h2>${mapaCalor(orden.map(e => linkEq(e.id)), Array.from({length: n}, (_, i) => `${i + 1}.º`), celdas)}</div>`;
  };
  return h`${subnav(NAV_LIGA, '#/simulacion')}<div class="encabezado"><div><h1>Simulación${varios ? ' de cada grupo' : ' de la liga'}</h1>
      <p class="tenue">Lo que queda de liga jugado 10.000 veces con la fuerza estimada de cada equipo (ajustada por rival y por campo, ${signo(T.liga.campo, 1)} puntos para el local).</p></div></div>
    ${IDX.grupos.map(bloque).join('')}`;
};

VISTAS.previa = () => {
  const c = T.comprobacion || {};
  const prox = (T.predicciones || []).filter(p => p.jornada === T.proxima);
  const jugados = T.partidos.filter(p => p.previa).slice(-24).reverse();
  return h`${subnav(NAV_LIGA, '#/previa')}<div class="encabezado"><div><h1>Previa${T.proxima ? ' · jornada ' + T.proxima : ''}</h1>
      <p class="tenue">Probabilidad de victoria y margen esperado de cada partido, a partir de la fuerza de los equipos.</p></div></div>
    ${prox.length ? `<div class="rejilla-2">${prox.map(p => `<div class="tarjeta"><div class="muy-tenue">${esc(p.fecha)}</div>
      <div class="previa"><span>${linkEq(p.local)}</span><b>${fmt(100 * p.p_local, 0)} %</b></div><div class="previa"><span>${linkEq(p.visitante)}</span><b>${fmt(100 - 100 * p.p_local, 0)} %</b></div>
      <div class="barra-prob"><i style="width:${100 * p.p_local}%"></i></div>
      <p class="muy-tenue" style="margin:.4rem 0 0">${Math.abs(p.margen) < 1.5 ? 'Muy igualado' : `${esc(eq(p.margen > 0 ? p.local : p.visitante).nombre)} por ${fmt(Math.abs(p.margen), 1)}`} · <a href="#/cara-a-cara/${p.local}/${p.visitante}">cara a cara</a></p></div>`).join('')}</div>`
      : '<p class="tenue">No quedan partidos por jugar.</p>'}
    <div class="tarjeta seccion"><h2>¿Cómo acierta el modelo?</h2>
      <div class="cifras">${cifra(c.acierto != null ? fmt(100 * c.acierto, 0) + ' %' : '–', 'Ganadores acertados')}${cifra(T.elo_acierto != null ? fmt(100 * T.elo_acierto, 0) + ' %' : '–', 'Acierto del Elo', 'El Elo, a modo de comparación')}${cifra(fmt(c.error_margen), 'Error medio del margen (pts)')}${cifra(c.partidos || 0, 'Partidos comprobados')}</div>
      <p class="muy-tenue">Cada jornada se predice solo con lo jugado antes (desde la 4.ª), sin mirar el resultado.</p>
      ${jugados.length ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">Partido</th><th>J</th><th>Prob. local</th><th>Margen previsto</th><th>Resultado</th><th></th></tr></thead><tbody>
        ${jugados.map(p => `<tr><td class="izq"><a href="#/partido/${p.id}">${esc(eq(p.local).nombre)} - ${esc(eq(p.visitante).nombre)}</a></td><td>${p.jornada}</td><td>${fmt(100 * p.previa[0], 0)} %</td><td>${signo(p.previa[1], 1)}</td><td>${p.puntos[0]}-${p.puntos[1]}</td><td>${p.previa[2] ? '<span class="v">✓</span>' : '<span class="d">✗</span>'}</td></tr>`).join('')}
      </tbody></table></div>` : ''}</div>`;
};

VISTAS.lideres = () => {
  const f = VISTAS.lideres.f || (VISTAS.lideres.f = {grupo: 'Por partido'});
  despues(() => alPulsar('li-g', v => { f.grupo = v; pintar(); }));
  const base = cualificadas();
  const ms = MJ.filter(m => m.g === f.grupo);
  return h`${subnav(NAV_LIGA, '#/lideres')}<div class="encabezado"><div><h1>Líderes</h1><p class="tenue">Jugadoras con al menos el 40 % de los partidos y 10 minutos por partido (${base.length}).</p></div></div>
    <div class="filtros">${pildoras('li-g', grupos(MJ).map(g => [g, g]), f.grupo)}</div>
    <div class="rejilla">${ms.map(m => `<div class="tarjeta"><h3 title="${esc(m.i || '')}">${esc(m.n)}${m.inv ? ' <span class="muy-tenue">(menos)</span>' : ''}</h3><table class="lideres"><tbody>
      ${[...base].filter(j => m.v(j) != null).sort((a, b) => (m.inv ? 1 : -1) * (m.v(a) - m.v(b))).slice(0, 5).map((j, i) => `<tr><td class="pos">${i + 1}</td><td class="izq">${linkJu(j.id)}<div class="muy-tenue">${esc(eq(j.equipo).nombre)}</div></td><td><b>${fmt(m.v(j), m.d)}</b></td></tr>`).join('')}
    </tbody></table></div>`).join('')}</div>`;
};

VISTAS.records = () => {
  const R = T.records, part = id => IDX.partidos[id];
  const rival = (pid, eid) => { const p = part(pid); return p ? (p.local === eid ? 'vs ' + esc(eq(p.visitante).nombre) : 'en ' + esc(eq(p.local).nombre)) : ''; };
  const bloque = (titulo, filas, d = 0) => `<div class="tarjeta"><h3>${titulo}</h3><table class="lideres"><tbody>${filas.map((x, i) => `<tr><td class="pos">${i + 1}</td>
    <td class="izq">${linkJu(x[0])}<div class="muy-tenue">${esc(eq(x[2]).nombre)} · <a href="#/partido/${x[1]}">J${part(x[1])?.jornada} ${rival(x[1], x[2])}</a></div></td><td><b>${fmt(x[3], d)}</b></td></tr>`).join('')}</tbody></table></div>`;
  const bloqueEq = (titulo, filas) => `<div class="tarjeta"><h3>${titulo}</h3><table class="lideres"><tbody>${filas.map((x, i) => `<tr><td class="pos">${i + 1}</td>
    <td class="izq">${linkEq(x[0])}<div class="muy-tenue"><a href="#/partido/${x[1]}">J${part(x[1])?.jornada} ${rival(x[1], x[0])}</a></div></td><td><b>${x[2]}</b></td></tr>`).join('')}</tbody></table></div>`;
  return h`${subnav(NAV_LIGA, '#/records')}<h1>Récords de la temporada</h1><p class="tenue">Las mejores actuaciones en un solo partido.</p>
    <div class="rejilla">${bloque('Puntos', R.pts.slice(0, 5))}${bloque('Rebotes', R.trb.slice(0, 5))}${bloque('Asistencias', R.ast.slice(0, 5))}${bloque('Valoración', R.pir.slice(0, 5))}
      ${bloque('Game Score', R.gmsc.slice(0, 5), 1)}${bloque('Triples', R.p3.slice(0, 5))}${bloque('Robos', R.stl.slice(0, 5))}${bloque('Tapones', R.blk.slice(0, 5))}
      ${bloqueEq('Más puntos de un equipo', R.equipo_pts.slice(0, 5))}${bloqueEq('Mayores victorias', R.equipo_dif.slice(0, 5))}${bloqueEq('Menos puntos encajados', R.equipo_menos.slice(0, 5))}</div>`;
};

VISTAS.ambiente = () => {
  const a = T.ambiente, et = a.map(x => 'J' + x[0]);
  const serie = (i, nombre) => [{nombre, color: 'var(--serie-1)', valores: a.map(x => x[i])}];
  const L = T.liga;
  return h`${subnav(NAV_LIGA, '#/ambiente')}<div class="encabezado"><div><h1>La liga en cifras</h1><p class="tenue">Cómo se juega en la liga y cómo cambia jornada a jornada.</p></div></div>
    <div class="tarjeta"><div class="cifras">${cifra(fmt(L.ppg), 'Puntos por equipo')}${cifra(fmt(L.ritmo), 'Ritmo (pos./40)')}${cifra(fmt(L.ortg), 'Puntos por 100 pos.')}
      ${cifra(fmt(L.factores.efg), 'eFG%')}${cifra(fmt(L.factores.ts), 'TS%')}${cifra(fmt(L.factores.p3), '% de triple')}${cifra(fmt(L.factores.p3r), '% de tiros que son triple')}
      ${cifra(fmt(L.factores.tov), 'Pérdidas por posesión')}${cifra(fmt(L.factores.orb), '% rebote ofensivo')}${cifra(fmt(L.factores.ft), '% tiro libre')}
      ${cifra(signo(L.campo, 1), 'Ventaja de campo (pts)', 'Estimada por el modelo de fuerza')}${cifra(fmt(L.factores.ast), '% canastas asistidas')}</div></div>
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Puntos por equipo y partido</h2>${lineas(serie(1, 'Puntos'), et, {alto: 200})}</div>
      <div class="tarjeta"><h2>Ritmo (posesiones por 40 min)</h2>${lineas(serie(2, 'Ritmo'), et, {alto: 200})}</div>
      <div class="tarjeta"><h2>Puntos por 100 posesiones</h2>${lineas(serie(3, 'ORtg'), et, {alto: 200})}</div>
      <div class="tarjeta"><h2>Tiro efectivo (eFG%)</h2>${lineas(serie(4, 'eFG%'), et, {alto: 200})}</div>
      <div class="tarjeta"><h2>% de tiros que son triples</h2>${lineas(serie(5, 'Triples'), et, {alto: 200})}</div>
      <div class="tarjeta"><h2>% de victorias locales</h2>${lineas(serie(6, '% local'), et, {alto: 200, referencia: 50, d: 0})}</div>
    </div>`;
};

VISTAS.arbitros = () => {
  despues(() => activarTablas(() => pintar()));
  return h`${subnav(NAV_LIGA, '#/arbitros')}<div class="encabezado"><div><h1>Árbitros</h1><p class="tenue">Medias de los partidos que ha pitado cada árbitro (los tres del acta). Con pocos partidos, las diferencias son ruido.</p></div></div>
    <div class="tarjeta">${tabla('arbitros', T.arbitros, [
      {t: 'Árbitro', izq: true, f: a => esc(a.nombre), clase: 'nombre', v: a => a.nombre},
      {t: 'PJ', f: a => a.pj, v: a => a.pj},
      {t: 'Faltas', tip: 'Faltas por partido (los dos equipos)', f: a => fmt(a.faltas), v: a => a.faltas},
      {t: 'TLI', tip: 'Tiros libres intentados por partido', f: a => fmt(a.tli), v: a => a.tli},
      {t: 'Faltas vis.−loc.', tip: 'Faltas del visitante menos las del local (positivo: pita más al visitante)', f: a => signo(a.dif_faltas, 1), v: a => a.dif_faltas},
      {t: 'TLI loc.−vis.', tip: 'Tiros libres del local menos los del visitante', f: a => signo(a.dif_tli, 1), v: a => a.dif_tli},
      {t: '% gana local', f: a => fmt(a.gana_local, 0), v: a => a.gana_local},
      {t: 'Puntos', tip: 'Puntos totales por partido', f: a => fmt(a.puntos), v: a => a.puntos},
      {t: 'Ritmo', f: a => fmt(a.ritmo), v: a => a.ritmo},
    ], 1)}</div>`;
};

VISTAS.jornada = n => {
  const jn = Number(n) || T.jornadas[T.jornadas.length - 1];
  const res = T.resumen.find(r => r.jornada === jn);
  if (!res) return '<p>Esa jornada aún no se ha jugado.</p>';
  despues(() => alCambiar('j-sel', v => location.hash = '#/jornada/' + v));
  const ps = T.partidos.filter(p => p.jornada === jn);
  const act = a => { const j = IDX.jugadoras[a.jugadora]; const p = IDX.partidos[a.partido];
    const rival = p.local === a.equipo ? p.visitante : p.local;
    return `<tr><td class="izq">${linkJu(a.jugadora)}<div class="muy-tenue">${esc(eq(a.equipo).nombre)} · ${esc(j?.puesto || '')}</div></td>
      <td class="izq muy-tenue">vs ${esc(eq(rival).nombre)}</td><td>${a.pts} pts</td><td>${a.rt} reb</td><td>${a.as} ast</td><td><b>${a.va}</b> val</td><td>${fmt(a.gmsc)} GmSc</td></tr>`; };
  const ex = res.extremos, part = id => IDX.partidos[id];
  const extremo = (t, d, id) => id ? `<div class="cifra"><div class="cifra__nombre">${t}</div><div style="font-weight:600;margin:.2rem 0"><a href="#/partido/${id}">${esc(eq(part(id).local).nombre)} ${part(id).puntos[0]}-${part(id).puntos[1]} ${esc(eq(part(id).visitante).nombre)}</a></div><div class="muy-tenue">${d}</div></div>` : '';
  const aciertos = ps.filter(p => p.previa);
  return h`<div class="encabezado"><div><h1>Jornada ${jn}</h1><p class="tenue">${esc(ps[0]?.fecha?.split(' ')[0] || '')}${aciertos.length ? ` · el modelo acertó ${aciertos.filter(p => p.previa[2]).length} de ${aciertos.length}` : ''}</p></div>
      <label class="filtros" style="margin:0">Jornada <select id="j-sel">${T.jornadas.map(x => `<option ${x === jn ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <div class="rejilla-2">
      <div class="tarjeta"><h2>Resultados</h2><div class="partidos-lista">${ps.map(partidoFila).join('')}</div></div>
      <div class="tarjeta"><h2>Quinteto ideal</h2><p class="muy-tenue" style="margin-top:-.4rem">Por valoración: dos exteriores, una alera y dos interiores.</p><div class="tabla-scroll"><table><tbody>${res.quinteto.map(act).join('')}</tbody></table></div></div>
    </div>
    <h2 class="seccion">Extremos</h2>
    <div class="cifras">
      ${ex.paliza ? extremo('Mayor diferencia', `${ex.paliza[1]} puntos`, ex.paliza[0]) : ''}
      ${ex.igualado ? extremo('Más igualado', `${ex.igualado[1]} punto${ex.igualado[1] === 1 ? '' : 's'}`, ex.igualado[0]) : ''}
      ${ex.remontada ? extremo('Mayor remontada', `ganó perdiendo de ${ex.remontada[1]} al final de un cuarto`, ex.remontada[0]) : ''}
      ${ex.ataque ? extremo('Mejor ataque', `${esc(eq(ex.ataque[2]).nombre)}: ${ex.ataque[1]} puntos`, ex.ataque[0]) : ''}
      ${ex.defensa ? extremo('Mejor defensa', `${esc(eq(ex.defensa[2]).nombre)}: encajó ${ex.defensa[1]}`, ex.defensa[0]) : ''}
      ${ex.cuarto ? extremo('Mejor cuarto', `${esc(eq(ex.cuarto[1]).nombre)}: ${ex.cuarto[3]}-${ex.cuarto[4]} en el ${ex.cuarto[2] > 4 ? 'prórroga' : ex.cuarto[2] + '.º'}`, ex.cuarto[0]) : ''}
    </div>
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Líderes de la jornada</h2><div class="tabla-scroll"><table><tbody>
        ${[['Puntos', 'pts'], ['Rebotes', 'rt'], ['Asistencias', 'as']].map(([t, k]) => res.lideres[k] ? `<tr><td class="izq muy-tenue">${t}</td>${act(res.lideres[k]).slice(4)}` : '').join('')}
      </tbody></table></div></div>
      <div class="tarjeta"><h2>La jornada en cifras</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>Media</th><th class="izq">Más</th><th class="izq">Menos</th></tr></thead><tbody>
        ${(res.cifras || []).map(c => `<tr><td class="izq">${c[0]}</td><td>${fmt(c[1])}</td><td class="izq">${c[3]} <span class="muy-tenue">${esc(eq(c[2]).nombre)}</span></td><td class="izq">${c[5]} <span class="muy-tenue">${esc(eq(c[4]).nombre)}</span></td></tr>`).join('')}
      </tbody></table></div></div>
    </div>`;
};

VISTAS.partidos = () => {
  const porJ = {};
  T.partidos.forEach(p => (porJ[p.jornada] = porJ[p.jornada] || []).push(p));
  return h`<h1>Partidos</h1><div class="rejilla">${Object.keys(porJ).sort((a, b) => b - a).map(j => `<div class="tarjeta">
    <div class="encabezado"><h2>Jornada ${j}</h2><a href="#/jornada/${j}">Resumen →</a></div><div class="partidos-lista">${porJ[j].map(partidoFila).join('')}</div></div>`).join('')}</div>`;
};

const gameScore = f => f[4] + 0.4 * (f[5] + f[7]) - 0.7 * (f[6] + f[8]) - 0.4 * (f[10] - f[9]) + 0.7 * f[11] + 0.3 * f[12] + f[15] + 0.7 * f[14] + 0.7 * f[17] - 0.4 * f[18] - f[16];

VISTAS.partido = id => {
  const p = IDX.partidos[id];
  if (!p) return '<p>No encuentro ese partido.</p>';
  const lados = [p.local, p.visitante];
  const caja = i => tabla(`caja-${id}-${i}`, p.caja[i], [
    {t: '#', f: f => esc(f[1])},
    {t: 'Jugadora', izq: true, f: f => `${linkJu(f[0])}${f[2] ? ' <span class="muy-tenue">*</span>' : ''}`, clase: 'nombre'},
    {t: 'Min', f: f => minutos(f[3]), v: f => f[3]}, {t: 'Pts', f: f => `<b>${f[4]}</b>`, v: f => f[4]},
    {t: 'T2', f: f => `${f[5]}/${f[6]}`, v: f => f[5]}, {t: 'T3', f: f => `${f[7]}/${f[8]}`, v: f => f[7]}, {t: 'TL', f: f => `${f[9]}/${f[10]}`, v: f => f[9]},
    {t: 'RO', f: f => f[11], v: f => f[11]}, {t: 'RD', f: f => f[12], v: f => f[12]}, {t: 'Reb', f: f => f[13], v: f => f[13]},
    {t: 'Ast', f: f => f[14], v: f => f[14]}, {t: 'Rob', f: f => f[15], v: f => f[15]}, {t: 'Pér', f: f => f[16], v: f => f[16]},
    {t: 'Tap', f: f => f[17], v: f => f[17]}, {t: 'FC', f: f => f[18], v: f => f[18]}, {t: 'FR', f: f => f[19], v: f => f[19]},
    {t: 'Val', f: f => `<b>${f[20]}</b>`, v: f => f[20]}, {t: 'GmSc', tip: MJK.gmsc.i, f: f => fmt(gameScore(f)), v: f => gameScore(f)},
    {t: 'TS%', f: f => fmt(pct(f[4], 2 * (f[6] + f[8] + 0.44 * f[10]))), v: f => pct(f[4], 2 * (f[6] + f[8] + 0.44 * f[10]))},
    {t: '+/-', f: f => signo(f[21]), v: f => f[21]},
  ], 2);
  despues(() => activarTablas(() => pintar()));
  const t = p.totales, fa = p.factores;
  const comp = [['Puntos por 100 posesiones', i => fmt(100 * p.puntos[i] / p.pos)], ['Tiro efectivo (eFG%)', i => fmt(fa[i].efg)], ['Tiro real (TS%)', i => fmt(fa[i].ts)],
    ['Pérdidas por posesión', i => fmt(fa[i].tov)], ['% rebote ofensivo', i => fmt(fa[i].orb)], ['Tiros libres por tiro', i => fmt(fa[i].ftr)],
    ['Tiros de dos', i => `${t[i][14]}/${t[i][15]} (${fmt(fa[i].p2)} %)`], ['Triples', i => `${t[i][2]}/${t[i][3]} (${fmt(fa[i].p3)} %)`],
    ['Tiros libres', i => `${t[i][4]}/${t[i][5]} (${fmt(fa[i].ft)} %)`], ['Rebotes (of.)', i => `${t[i][6] + t[i][7]} (${t[i][6]})`],
    ['Asistencias', i => `${t[i][8]} (${fmt(fa[i].ast, 0)} % de canastas)`], ['Robos', i => t[i][9]], ['Pérdidas', i => t[i][10]], ['Tapones', i => t[i][11]],
    ['Faltas', i => t[i][13]], ['Valoración', i => t[i][12]]];
  // marcador acumulado al final de cada cuarto
  let a = 0, b = 0;
  const acumulado = p.cuartos.map(c => { a += c[0]; b += c[1]; return a - b; });
  return h`<a href="#/jornada/${p.jornada}" class="muy-tenue">← Jornada ${p.jornada}</a>
    <div class="tarjeta" style="margin-top:.5rem"><div class="marcador-grande">
      <div><h2>${linkEq(p.local)}</h2></div><div class="puntos">${p.puntos[0]} - ${p.puntos[1]}</div><div><h2>${linkEq(p.visitante)}</h2></div></div>
      <div class="tabla-scroll" style="max-width:560px;margin:1rem auto 0"><table><thead><tr><th class="izq"></th>${p.cuartos.map((_, i) => `<th>${i < 4 ? i + 1 + '.º' : 'Pr' + (i - 3)}</th>`).join('')}<th>Total</th></tr></thead><tbody>
        ${[0, 1].map(i => `<tr><td class="izq">${esc(eq(lados[i]).nombre)}</td>${p.cuartos.map(c => `<td>${c[i]}</td>`).join('')}<td><b>${p.puntos[i]}</b></td></tr>`).join('')}
        <tr><td class="izq muy-tenue">Diferencia acumulada</td>${acumulado.map(d => `<td class="muy-tenue">${signo(d)}</td>`).join('')}<td></td></tr></tbody></table></div>
      <p class="muy-tenue" style="text-align:center">${esc(p.fecha)} · ${esc(p.pabellon)} · ${fmt(p.pos)} posesiones${p.arbitros.length ? ' · Árbitros: ' + p.arbitros.map(esc).join(', ') : ''}</p>
      ${p.previa ? `<p class="muy-tenue" style="text-align:center">Antes del partido, el modelo daba al local un ${fmt(100 * p.previa[0], 0)} % (margen ${signo(p.previa[1], 1)}): ${p.previa[2] ? 'acertó' : 'falló'}.</p>` : ''}
      ${p.incompleta && p.incompleta.some(Boolean) ? `<p class="aviso">⚠ El acta pública de la FEB de ${p.incompleta.map((x, i) => x ? esc(eq(lados[i]).nombre) : '').filter(Boolean).join(' y ')} está incompleta: falta alguna jugadora.</p>` : ''}</div>
    <div class="tarjeta seccion"><h2>Comparativa</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>${esc(eq(p.local).nombre)}</th><th>${esc(eq(p.visitante).nombre)}</th></tr></thead>
      <tbody>${comp.map(([n, f]) => `<tr><td class="izq">${n}</td><td>${f(0)}</td><td>${f(1)}</td></tr>`).join('')}</tbody></table></div></div>
    ${[0, 1].map(i => `<div class="tarjeta seccion"><h2>${linkEq(lados[i])}</h2>${caja(i)}<p class="muy-tenue">* titular · GmSc: Game Score</p></div>`).join('')}`;
};

VISTAS.inicio = () => {
  const ultimaJ = T.jornadas[T.jornadas.length - 1];
  const res = T.resumen.find(r => r.jornada === ultimaJ);
  const ultimos = T.partidos.filter(p => p.jornada === ultimaJ);
  const mvp = res && res.mvp && IDX.jugadoras[res.mvp.jugadora];
  const totalAct = T.partidos.reduce((s, p) => s + p.caja[0].length + p.caja[1].length, 0);
  const prox = (T.predicciones || []).filter(p => p.jornada === T.proxima);
  const destacado = mvp ? `<div class="tarjeta"><h2>Jugadora de la jornada ${ultimaJ}</h2>
      <div class="ficha"><div class="dorsal">${esc(mvp.dorsal || '·')}</div><div><h3 style="font-size:1.25rem">${linkJu(mvp.id)}</h3>
      <div class="tenue">${linkEq(res.mvp.equipo)} · ${esc(mvp.puesto || '')}</div></div></div>
      <div class="cifras" style="margin-top:1rem">${cifra(res.mvp.va, 'Valoración')}${cifra(res.mvp.pts, 'Puntos')}${cifra(res.mvp.rt, 'Rebotes')}${cifra(res.mvp.as, 'Asistencias')}${cifra(fmt(res.mvp.gmsc), 'Game Score')}</div>
      <p style="margin:.75rem 0 0"><a href="#/jornada/${ultimaJ}">Toda la jornada ${ultimaJ} →</a></p></div>` : '';
  return h`<section class="portada">
      <h1>${esc(COMP.nombre)}, en datos</h1>
      <p>Estadísticas de cada jugadora y cada equipo sacadas de las actas públicas de la FEB y comparadas con el resto de la competición: ${MJ.length} cifras por jugadora y ${ME.length} por equipo, percentiles, PER, Win Shares, ratings, con y sin, predicciones y simulación de la liga.</p>
      <div class="cifras" style="max-width:760px">${cifra(T.nombre, 'Temporada')}${cifra(ultimaJ ?? '–', `Jornada de ${T.total_jornadas}`)}${cifra(T.partidos.length, 'Partidos')}${cifra(fmt(totalAct, 0), 'Actuaciones')}${cifra(INDICE.temporadas.length, 'Temporadas')}${cifra(COMPETICIONES.length, 'Competiciones')}</div>
    </section>
    <div class="rejilla-2 seccion">${destacado}
      <div class="tarjeta"><h2>Resultados · jornada ${ultimaJ}</h2><div class="partidos-lista">${ultimos.map(partidoFila).join('')}</div></div>
    </div>
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><div class="encabezado"><h2>Clasificación</h2><a href="#/liga">Completa →</a></div>${tablaClasificacion(IDX.grupos.length > 1 ? 4 : 8)}</div>
      <div class="tarjeta"><div class="encabezado"><h2>Previa${T.proxima ? ' · jornada ' + T.proxima : ''}</h2><a href="#/previa">Detalle →</a></div>
        ${prox.length ? `<div class="partidos-lista">${prox.map(p => `<div class="partido"><span class="local">${esc(eq(p.local).nombre)}</span><span class="marcador tenue" data-tip="${esc(`Probabilidad del local: ${fmt(100 * p.p_local, 0)} %<br>Margen esperado: ${signo(p.margen, 1)}`)}">${fmt(100 * p.p_local, 0)}–${fmt(100 - 100 * p.p_local, 0)} %</span><span>${esc(eq(p.visitante).nombre)}</span></div>`).join('')}</div>` : '<p class="tenue">No quedan partidos por jugar.</p>'}
      </div>
    </div>
    <div class="rejilla seccion">
      ${[['#/jugadoras', 'Jugadoras', 'Tabla con todas las cifras: por partido, por 40, por 100 posesiones, tiro, avanzadas, impacto y regularidad.'],
         ['#/comparar', 'Comparar', 'Dos jugadoras frente a frente en un radar de percentiles.'],
         ['#/dispersion', 'Dispersión', 'Cualquier cifra frente a cualquier otra.'],
         ['#/familias', 'Familias de juego', 'Grupos de jugadoras con un estilo parecido.'],
         ['#/equipos', 'Equipos', 'Eficiencia, cuatro factores, plantilla y dependencia.'],
         ['#/evolucion-equipos', 'Evolución', 'Los equipos moviéndose jornada a jornada.'],
         ['#/simulacion', 'Simulación', 'Probabilidad de playoff, de ganar la liga y de descender.'],
         ['#/arbitros', 'Árbitros', 'Faltas, tiros libres y victorias locales por árbitro.']].map(([u, t, d]) =>
        `<a class="tarjeta" href="${u}" style="color:inherit"><h3>${t} →</h3><p class="tenue" style="margin:0">${d}</p></a>`).join('')}
    </div>`;
};

VISTAS.metodo = () => {
  const glosario = lista => grupos(lista).map(g => `<h3>${esc(g)}</h3><ul>${lista.filter(m => m.g === g && (m.i || !/por (40|100)/.test(m.n)))
    .map(m => `<li><b>${esc(m.n)}</b> (${esc(m.c)})${m.i ? ': ' + esc(m.i) : ''}${m.inv ? ' <i>Menos es mejor.</i>' : ''}</li>`).join('')}</ul>`).join('');
  return h`<div class="metodo"><h1>Método</h1>
  <p>Todo sale de las <b>actas públicas</b> de cada partido en <a href="https://baloncestoenvivo.feb.es/">baloncestoenvivo.feb.es</a>, su calendario y las plantillas de los equipos, de las competiciones femeninas que publica: LF Endesa, LF Challenge, LF2 (todos sus grupos y la fase final), la fase final de 1.ª División, la Minicopa y los Campeonatos de España de clubes y de selecciones autonómicas de formación. Cada competición se calcula por separado, solo con sus partidos; en la ficha de cada jugadora se ven también sus números en las demás. LF Stats no está afiliado a la FEB.</p>
  <h2>Las fórmulas</h2><ul>
    <li><b>Posesiones</b>: <code>TCI − RO + PÉR + 0,44 × TLI</code>; la de un partido es la media de los dos equipos. <b>Ritmo</b>: posesiones por 40 minutos.</li>
    <li><b>eFG%</b>: <code>(TC + 0,5 × T3) / TCI</code>. <b>TS%</b>: <code>PTS / (2 × (TCI + 0,44 × TLI))</code>.</li>
    <li><b>USG%, AST%, RO%, RD%, ROB%, TAP%, PÉR%</b>: las de Basketball-Reference, con los totales de su equipo y del rival en los partidos que jugó y la parte de los minutos que estuvo en pista.</li>
    <li><b>ORtg y DRtg individuales</b>: los de Dean Oliver (<i>Basketball on Paper</i>): puntos producidos y posesiones usadas, y paradas defensivas. La suma de los puntos producidos de un equipo cuadra con sus puntos reales (lo comprobamos: 99 %).</li>
    <li><b>PER</b>: el de John Hollinger, ajustado al ritmo de cada equipo y escalado para que la media de la liga (ponderada por minutos) sea 15.</li>
    <li><b>Win Shares</b>: los de Basketball-Reference (puntos producidos frente a 0,92 veces los de la liga por posesión, y defensa frente a 1,08), con partidos de 40 minutos (WS/40). Sin tope por abajo: un equipo que defiende muy mal puede sumar menos Win Shares que victorias.</li>
    <li><b>Game Score</b>: <code>PTS + 0,4·TC − 0,7·TCI − 0,4·(TLI−TL) + 0,7·RO + 0,3·RD + ROB + 0,7·AST + 0,7·TAP − 0,4·FC − PÉR</code>.</li>
    <li><b>Con y sin</b>: con su +/- del acta. Con ella: <code>40 × (+/-) / minutos</code>. Sin ella: lo que hizo el equipo en el resto de minutos de esos partidos. No separa ataque y defensa (para eso hace falta el jugada a jugada).</li>
    <li><b>BPM 2.0 y VORP</b>: el modelo de Basketball-Reference con sus coeficientes. El puesto (1-5) y el rol ofensivo de cada jugadora se estiman con sus cifras (rebote, asistencias, robos, tapones, faltas y puntos por encima de un umbral), mezclados con 50 minutos en su puesto de la plantilla, y se reparte el rating neto de su equipo ajustado por rival. Sin el ajuste por «ventaja media» del original, que necesita el jugada a jugada. VORP: <code>(BPM + 2) × % de minutos × partidos / partidos de la liga</code>.</li>
    <li><b>PIE</b> (NBA): su parte de la suma de <code>PTS + TC + TL − TCI − TLI + RD + 0,5·RO + AST + ROB + 0,5·TAP − FC − PÉR</code> de los dos equipos. <b>EFF</b>: <code>PTS + REB + AST + ROB + TAP − fallos − pérdidas</code>. <b>Win Score</b> (Berri): <code>PTS + REB + ROB + 0,5·TAP + 0,5·AST − TCI − 0,5·TLI − PÉR − 0,5·FC</code>.</li>
    <li><b>Puntos añadidos</b>: <code>PTS − 2 × (TCI + 0,44·TLI) × TS% de la liga</code>. <b>Competencia en el triple</b>: <code>(2 / (1 + e^(−T3I por 100 pos.)) − 1) × T3%</code>. <b>% estabilizados</b>: <code>(aciertos + k × media de la liga) / (intentos + k)</code> con k = 200 triples o 100 tiros libres.</li>
    <li><b>Victorias pitagóricas</b>: <code>PJ × PF¹⁴ / (PF¹⁴ + PC¹⁴)</code>. <b>Suerte</b>: victorias reales menos esas.</li>
    <li><b>Ratings ajustados por rival</b>: <code>ORtg − (DRtg medio de sus rivales − media de la liga)</code>, y al revés para la defensa. <b>SOS</b>: fuerza media de sus rivales.</li>
    <li><b>Elo</b>: K = 20, 60 puntos de ventaja de campo y multiplicador por margen de victoria <code>ln(|margen| + 1) × 2,2 / (0,001 × diferencia de Elo del ganador + 2,2)</code>; cada temporada empieza con el 75 % del Elo anterior y el 25 % de 1500.</li>
    <li><b>Qué decide los partidos</b>: regresión lineal de la diferencia de puntos por 100 posesiones de cada partido sobre la diferencia con el rival en eFG%, pérdidas por posesión, rebote ofensivo y TL/TC. El peso de cada factor es su coeficiente por su desviación típica.</li>
    <li><b>Fuerza</b>: mínimos cuadrados sobre los márgenes (con tope de 30 puntos): <code>margen = campo + fuerza local − fuerza visitante</code>, tirando hacia la mitad de la fuerza de la temporada anterior con el peso de unos 4 partidos. De ahí salen la <b>previa</b> (probabilidad con una normal de desviación la del error del modelo) y la <b>simulación</b> (10.000 ligas, sorteando también la fuerza de cada equipo según lo segura que es).</li>
    <li><b>Percentiles</b>: el porcentaje de jugadoras a las que supera, entre las que han jugado al menos el 40 % de los partidos y 10 minutos por partido; frente a su puesto (exteriores = bases y escoltas, aleras, interiores = ala-pívots y pívots) o frente a toda la liga.</li>
    <li><b>Parecidas</b>: distancia entre perfiles normalizados (estilo, producción por 40 y tiro real) con todas las temporadas. <b>Complementarias</b>: las que más puntúan donde la jugadora está por debajo de la media. <b>Familias</b>: k-medias (7 grupos) sobre el estilo.</li>
  </ul>
  <h2>Glosario de jugadoras</h2>${glosario(MJ)}
  <h2>Glosario de equipos</h2>${glosario(ME)}
  <h2>Jugada a jugada y gráfico de tiro</h2><ul>
    <li>Se leen de la página pública de cada partido, pestañas «Directo» y «Gráfico de tiro», tal como las ve cualquier visitante.</li>
    <li><b>Quién está en pista</b>: se parte de las cinco titulares del acta y se sigue cada cambio. Se comprueba contra el acta: los minutos en pista y los puntos de cada jugadora cuadran exactamente en casi todos los partidos (en la página «Tiro y jugada a jugada» se ve cuántos).</li>
    <li><b>Quintetos, parejas y con y sin</b>: puntos a favor y en contra y posesiones (estimadas en cada tramo: tiros de campo − rebotes ofensivos + pérdidas + 0,44 × tiros libres) mientras estaban en pista.</li>
    <li><b>Asistencias</b>: cada asistencia se une con la canasta de su equipo en el mismo instante (la FEB también la da cuando el pase acaba en falta y tiros libres anotados).</li>
    <li><b>Finales apretados</b>: últimos 5 minutos del 4.º cuarto o de la prórroga con 5 puntos o menos de diferencia. <b>Parciales</b>: puntos seguidos de un equipo sin que anote el otro.</li>
    <li><b>Zonas de tiro</b>: el dibujo de la pista de la FEB no está a escala, así que se ha calibrado con miles de tiros cuyo valor (2 o 3) da el jugada a jugada: solo el 0,4 % cae al otro lado de la línea de triple. Además, en cada cuarto los tiros más lejanos de cada jugadora se toman como sus triples, tantos como diga el jugada a jugada. <b>Tiro esperado</b> (xeFG%): el eFG% que haría una tiradora media de la liga con los mismos tiros, según la zona.</li>
  </ul>
  <h2>Lo que no está (y por qué)</h2><ul>
    <li><b>Solo con vídeo o seguimiento</b> (ninguna web pública los tiene para esta liga): tipos de jugada (bloqueo directo, aislamiento, transición…), emparejamientos defensivos, tiros punteados o liberados, distancia recorrida, bloqueos que acaban en canasta.</li>
  </ul>
  <h2>Avisos</h2><ul>
    <li>Algunas actas públicas de la FEB están incompletas (falta alguna jugadora; los casos más grandes: Spar Gran Canaria en 2022/23 y 2024/25, y Movistar Estudiantes en 2023/24 y 2025/26). Se marcan con ⚠ y los puntos salen del marcador oficial.</li>
    <li>El puesto, la altura y la edad salen de la plantilla del equipo; a algunas jugadoras la FEB no les pone puesto.</li>
    <li>Con pocos partidos, todo (percentiles, fuerza, previa) se mueve mucho.</li>
  </ul></div>`;
};

const NOMBRE_FACTOR = {efg: 'Tiro efectivo', tov: 'Pérdidas', orb: 'Rebote ofensivo', ftr: 'Tiros libres'};

VISTAS.decide = () => {
  const d = T.decide;
  if (!d) return `${subnav(NAV_LIGA, '#/decide')}<p class="tenue">Hacen falta más partidos.</p>`;
  despues(() => activarTablas(() => pintar()));
  const unidades = {efg: 'punto de eFG%', tov: 'punto de pérdidas por posesión', orb: 'punto de rebote ofensivo', ftr: 'punto de TL/TC'};
  return h`${subnav(NAV_LIGA, '#/decide')}<div class="encabezado"><div><h1>Qué decide los partidos</h1>
      <p class="tenue">Regresión con todos los partidos de la temporada: la diferencia de puntos por 100 posesiones explicada por la diferencia con el rival en los cuatro factores de Dean Oliver.</p></div></div>
    <div class="rejilla-2"><div class="tarjeta"><h2>Peso de cada factor en esta liga</h2>
      ${barrasH(Object.entries(d.importancia).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({n: NOMBRE_FACTOR[k], v, texto: fmt(v, 0) + ' %'})))}
      <p class="muy-tenue">Oliver estimó para la NBA 40 % tiro, 25 % pérdidas, 20 % rebote y 15 % tiros libres. Aquí el modelo explica el ${fmt(100 * d.r2, 0)} % de las diferencias (R²).</p></div>
      <div class="tarjeta"><h2>Cuánto vale cada punto</h2><ul>${Object.entries(d.coef).map(([k, v]) => `<li>Cada ${unidades[k]} de diferencia con el rival vale <b>${signo(v, 2)}</b> puntos por 100 posesiones.</li>`).join('')}</ul></div></div>
    <div class="tarjeta seccion"><h2>De dónde sale el neto de cada equipo</h2>${tabla('decide', IDX.jugadas, [
      {t: 'Equipo', izq: true, f: e => linkEq(e.id), clase: 'nombre', v: e => e.nombre},
      {t: 'Neto', f: e => signo(e.net, 1), v: e => e.net},
      ...['efg', 'tov', 'orb', 'ftr'].map(k => ({t: NOMBRE_FACTOR[k], f: e => e.factores_contrib ? signo(e.factores_contrib[k], 1) : '–', v: e => e.factores_contrib && e.factores_contrib[k]})),
    ], 1)}<p class="muy-tenue">Puntos por 100 posesiones que da (o quita) a cada equipo su diferencia con los rivales en cada factor.</p></div>`;
};

VISTAS.elo = () => {
  const f = VISTAS.elo.f || (VISTAS.elo.f = {sel: IDX.clasificacion.slice(0, 3).map(e => e.id)});
  despues(() => {
    activarTablas(() => pintar());
    alCambiar('elo-eq', v => { if (v && !f.sel.includes(v)) f.sel = [...f.sel, v].slice(-4); pintar(); });
    document.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => { f.sel = f.sel.filter(x => x !== b.dataset.quitar); pintar(); }));
  });
  const js = T.jornadas;
  const serie = (e, i) => { const h_ = Object.fromEntries((e.elo_hist || []).map(x => [x[0], x[1]])); let ult = e.elo_ini;
    return {nombre: e.nombre, color: COLORES[i], valores: [e.elo_ini, ...js.map(j => (ult = h_[j] ?? ult))]}; };
  return h`${subnav(NAV_LIGA, '#/elo')}<div class="encabezado"><div><h1>Elo</h1><p class="tenue">Rating que sube al ganar y baja al perder, más cuanto más inesperado y amplio es el resultado, y que se arrastra de una temporada a otra.</p></div></div>
    <div class="tarjeta">${tabla('elo', IDX.jugadas, [
      {t: 'Equipo', izq: true, f: e => linkEq(e.id), clase: 'nombre', v: e => e.nombre},
      {t: 'Elo', f: e => `<b>${fmt(e.elo, 0)}</b>`, v: e => e.elo}, {t: 'Al empezar', f: e => fmt(e.elo_ini, 0), v: e => e.elo_ini},
      {t: 'Cambio', f: e => signo(e.elo - e.elo_ini), v: e => e.elo - e.elo_ini}, {t: 'V-D', f: e => `${e.pg}-${e.pj - e.pg}`, v: e => e.pg},
    ], 1)}</div>
    <div class="tarjeta seccion"><div class="encabezado"><h2>Evolución</h2><label class="filtros" style="margin:0">Añadir equipo (hasta 4) <select id="elo-eq"><option value="">Elige…</option>${IDX.clasificacion.map(e => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}</select></label></div>
      <div class="leyenda">${f.sel.map((id, i) => `<span style="--c:${COLORES[i]}">${esc(eq(id).nombre)} <button class="boton-mini" data-quitar="${id}" aria-label="Quitar">✕</button></span>`).join('')}</div>
      ${f.sel.length ? lineas(f.sel.map((id, i) => serie(eq(id), i)), ['Inicio', ...js.map(j => 'J' + j)], {alto: 280, referencia: 1500, d: 0, titulo: 'Elo'}) : ''}</div>`;
};

VISTAS.ampliada = () => {
  despues(() => activarTablas(() => pintar()));
  const meses = new Map();
  const datos = IDX.clasificacion.map(e => {
    const ps = e.partidos.map(x => ({x, f: fechaDe(x[0]), dif: x[4] - x[5]}));
    const wl = f => { const g = ps.filter(f); return [g.filter(p => p.dif > 0).length, g.filter(p => p.dif < 0).length]; };
    const porMes = {};
    ps.forEach(p => { if (!p.f) return; const k = `${p.f.getFullYear()}-${String(p.f.getMonth()).padStart(2, '0')}`; meses.set(k, MESES[p.f.getMonth()]);
      (porMes[k] = porMes[k] || [0, 0])[p.dif > 0 ? 0 : 1]++; });
    return {...e, casa: wl(p => p.x[3]), fuera: wl(p => !p.x[3]), le3: wl(p => Math.abs(p.dif) <= 3), ge10: wl(p => Math.abs(p.dif) >= 10),
      arriba: wl(p => (eq(p.x[2]).fuerza || 0) > 0), abajo: wl(p => (eq(p.x[2]).fuerza || 0) <= 0), porMes};
  });
  const ms = [...meses.keys()].sort();
  const cols = [['casa', 'Casa'], ['fuera', 'Fuera'], ['le3', '≤ 3 pts'], ['ge10', '≥ 10 pts'], ['arriba', 'vs. mitad de arriba'], ['abajo', 'vs. mitad de abajo']];
  return h`${subnav(NAV_LIGA, '#/ampliada')}<div class="encabezado"><div><h1>Clasificación ampliada</h1><p class="tenue">Victorias y derrotas según el partido y por mes (como la «expanded standings» de Basketball-Reference).</p></div></div>
    <div class="tarjeta">${tabla('ampliada', datos, [
      {t: '#', f: e => `<span class="pos">${e.pos}</span>`, v: e => -e.pos},
      {t: 'Equipo', izq: true, f: e => linkEq(e.id), clase: 'nombre'},
      {t: 'Total', f: e => `${e.pg}-${e.pj - e.pg}`, v: e => e.pg},
      ...cols.map(([k, n]) => ({t: n, f: e => vd(e[k]), v: e => e[k][0] - e[k][1]})),
      ...ms.map(k => ({t: meses.get(k).slice(0, 3), tip: meses.get(k), f: e => e.porMes[k] ? vd(e.porMes[k]) : '–', v: e => e.porMes[k] ? e.porMes[k][0] - e.porMes[k][1] : null})),
    ], 0)}</div>`;
};

VISTAS.entrenadores = id => {
  despues(() => activarTablas(() => pintar()));
  const todos = Object.entries(INDICE.entrenadores || {}).map(([cid, c]) => {
    const v = c.temporadas.reduce((a, x) => a + x[3], 0), d = c.temporadas.reduce((a, x) => a + x[4], 0);
    const ahora = c.temporadas.find(x => x[0] === T.temporada);
    return {id: cid, nombre: c.nombre, temporadas: c.temporadas, v, d, ahora};
  });
  const sel = id && todos.find(c => c.id === id);
  return h`${subnav(NAV_LIGA, '#/entrenadores')}<div class="encabezado"><div><h1>Entrenadores</h1><p class="tenue">El entrenador que figura en la página de cada equipo de la FEB. Si hubo un cambio a mitad de temporada, cuenta toda la temporada para el que figuraba al final.</p></div></div>
    ${sel ? `<div class="tarjeta"><h2>${esc(sel.nombre)}</h2><div class="cifras">${cifra(`${sel.v}-${sel.d}`, 'Balance total')}${cifra(fmt(pct(sel.v, sel.v + sel.d), 1) + ' %', '% de victorias')}${cifra(sel.temporadas.length, 'Temporadas')}</div>
      <div class="tabla-scroll seccion"><table><thead><tr><th class="izq">Temporada</th><th class="izq">Equipo</th><th>V-D</th><th>Neto</th><th>SRS</th></tr></thead><tbody>
      ${sel.temporadas.map(x => `<tr><td class="izq">${x[0]}/${String(x[0] + 1).slice(2)}</td><td class="izq">${x[0] === T.temporada ? linkEq(x[1]) : esc(x[2])}</td><td>${x[3]}-${x[4]}</td><td>${signo(x[5], 1)}</td><td>${signo(x[6], 2)}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
    <div class="tarjeta seccion">${tabla('entrenadores', todos, [
      {t: 'Entrenador', izq: true, f: c => `<a href="#/entrenadores/${c.id}">${esc(c.nombre)}</a>`, clase: 'nombre', v: c => c.nombre},
      {t: 'Equipo esta temporada', izq: true, f: c => c.ahora ? linkEq(c.ahora[1]) : '<span class="muy-tenue">–</span>', v: c => c.ahora ? 1 : 0},
      {t: 'Temp.', f: c => c.temporadas.length, v: c => c.temporadas.length},
      {t: 'V-D', f: c => `${c.v}-${c.d}`, v: c => c.v}, {t: '%V', f: c => fmt(pct(c.v, c.v + c.d), 1), v: c => c.v / (c.v + c.d)},
      {t: 'Esta temporada', f: c => c.ahora ? `${c.ahora[3]}-${c.ahora[4]}` : '–', v: c => c.ahora ? c.ahora[3] : null},
    ], 1)}</div>`;
};
