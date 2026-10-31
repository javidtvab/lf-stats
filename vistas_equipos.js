// LF Stats · vistas de equipos: tabla, carta de temporada, dispersión con evolución, cara a cara y ficha de equipo.
'use strict';

const NAV_EQ = [['#/equipos', 'Tabla'], ['#/carta', 'Carta de temporada'], ['#/evolucion-equipos', 'Dispersión y evolución'], ['#/cara-a-cara', 'Cara a cara']];
// Columnas de los frames de evolución (generar.py)
const FRAME = {ortg: 0, drtg: 1, ritmo: 2, efg: 3, tov: 4, orb: 5, ftr: 6, ptsm: 7, dif: 8, pg: 9, astm: 10, stlm: 11, blkm: 12, trbm: 13, tovm: 14, pfm: 15, p3m: 16};

VISTAS.equipos = () => {
  const f = VISTAS.equipos.f || (VISTAS.equipos.f = {grupo: 'Eficiencia'});
  const grupos_ = grupos(ME);
  despues(() => { alPulsar('e-grupo', v => { f.grupo = v; pintar(); }); activarTablas(() => pintar()); });
  const ms = ME.filter(m => m.g === f.grupo);
  return h`${subnav(NAV_EQ, '#/equipos')}<div class="encabezado"><div><h1>Equipos</h1><p class="tenue">Eficiencia por 100 posesiones, para que el ritmo no engañe. ${ME.length} cifras por equipo.</p></div></div>
    <div class="filtros">${pildoras('e-grupo', grupos_.map(g => [g, g]), f.grupo)}</div>
    <div class="tarjeta">${tabla('eq-' + f.grupo, IDX.jugadas, [
      {t: 'Equipo', izq: true, f: e => e._media ? 'Media de la liga' : linkEq(e.id) + (e.actas_incompletas ? ' <span title="Actas incompletas">⚠</span>' : ''), clase: 'nombre', v: e => e.nombre},
      {t: 'V-D', f: e => e._media ? '' : `${e.pg}-${e.pj - e.pg}`, v: e => e.pg / e.pj},
      ...ms.map(m => colM(m)),
    ], 2, {pie: [mediaObjetos(IDX.jugadas)]})}</div>
    <div class="tarjeta seccion"><h2>Ataque frente a defensa</h2>${dispersion(IDX.jugadas.map(e => ({x: e.ortg, y: e.drtg, texto: e.nombre.split(' ')[0].slice(0, 12), href: `#/equipo/${e.id}`,
      tip: `<b>${esc(e.nombre)}</b><br>${e.pg}-${e.pj - e.pg} · ORtg ${fmt(e.ortg)} · DRtg ${fmt(e.drtg)} · Neto ${signo(e.net, 1)}`})), MEK.ortg, MEK.drtg, {nota: 'mejor ataque y defensa ↗'})}
      <p class="muy-tenue">Las líneas discontinuas son la media de la liga. Pulsa un equipo para ver su ficha.</p></div>`;
};

VISTAS.carta = id => {
  const e = IDX.equipos[id] || IDX.clasificacion[0];
  if (!e) return '';
  despues(() => alCambiar('c-eq', v => location.hash = '#/carta/' + v));
  const filas = grupos(ME).map(g => `<h3 class="seccion">${g}</h3>${barrasPercentil(percentilesDe(e, ME.filter(m => m.g === g), IDX.jugadas))}`).join('');
  return h`${subnav(NAV_EQ, '#/carta')}<div class="encabezado"><div><h1>Carta de temporada</h1><p class="tenue">Cada cifra del equipo y su percentil frente a los otros ${IDX.jugadas.length - 1} equipos.</p></div>
      <label class="filtros" style="margin:0">Equipo <select id="c-eq">${IDX.clasificacion.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label></div>
    <div class="tarjeta"><h2>${linkEq(e.id)} <span class="muy-tenue">${e.pg}-${e.pj - e.pg}</span></h2>${avisoActas(e.actas_incompletas)}<div class="columnas-2">${filas}</div></div>`;
};

VISTAS['evolucion-equipos'] = () => {
  const f = VISTAS['evolucion-equipos'].f || (VISTAS['evolucion-equipos'].f = {x: 'ortg', y: 'drtg', j: null, sel: ''});
  const js = T.jornadas, jn = f.j && js.includes(f.j) ? f.j : js[js.length - 1];
  const opciones = Object.keys(FRAME).map(k => MEK[k]);
  const mx = MEK[f.x], my = MEK[f.y];
  despues(() => {
    alCambiar('v-x', v => { f.x = v; pintar(); }); alCambiar('v-y', v => { f.y = v; pintar(); });
    alCambiar('v-sel', v => { f.sel = v; pintar(); });
    alCambiar('v-j', v => { f.j = js[Number(v)]; pintar(); });
    const play = document.getElementById('v-play');
    if (play) play.addEventListener('click', () => {
      let i = 0; clearInterval(VISTAS['evolucion-equipos'].timer);
      VISTAS['evolucion-equipos'].timer = setInterval(() => {
        if (!location.hash.includes('evolucion-equipos') || i >= js.length) return clearInterval(VISTAS['evolucion-equipos'].timer);
        f.j = js[i++]; pintar();
      }, 700);
    });
  });
  const frame = T.frames[jn] || {};
  const rastro = f.sel ? js.filter(j => j <= jn).map(j => T.frames[j]?.[f.sel]).filter(Boolean) : [];
  const puntos = Object.entries(frame).map(([id, v]) => ({x: v[FRAME[f.x]], y: v[FRAME[f.y]], texto: eq(id).nombre.split(' ')[0].slice(0, 12), destacado: id === f.sel,
    href: `#/equipo/${id}`, tip: `<b>${esc(eq(id).nombre)}</b> (hasta la J${jn})<br>${mx.n}: ${fmt(v[FRAME[f.x]], mx.d)}<br>${my.n}: ${fmt(v[FRAME[f.y]], my.d)}`}));
  return h`${subnav(NAV_EQ, '#/evolucion-equipos')}<div class="encabezado"><div><h1>Dispersión y evolución</h1><p class="tenue">Cada punto es un equipo con sus medias hasta la jornada elegida. Dale a ▶ para verlos moverse.</p></div></div>
    <div class="filtros"><label>Eje horizontal<select id="v-x">${opcionesMetricas(opciones, f.x)}</select></label>
      <label>Eje vertical<select id="v-y">${opcionesMetricas(opciones, f.y)}</select></label>
      <label>Seguir a<select id="v-sel"><option value="">Nadie</option>${IDX.clasificacion.map(e => `<option value="${e.id}" ${f.sel === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></label>
      <label>Hasta la jornada ${jn}<input id="v-j" type="range" min="0" max="${js.length - 1}" value="${js.indexOf(jn)}"></label>
      <button id="v-play" class="boton" type="button">▶ Reproducir</button></div>
    <div class="tarjeta">${dispersion(puntos, mx, my)}
      ${rastro.length > 1 ? `<p class="muy-tenue">Recorrido de ${esc(eq(f.sel).nombre)}: ${rastro.map((v, i) => `J${js[i]} (${fmt(v[FRAME[f.x]], mx.d)}, ${fmt(v[FRAME[f.y]], my.d)})`).join(' → ')}</p>` : ''}</div>`;
};

VISTAS['cara-a-cara'] = (a, b) => {
  const ea = IDX.equipos[a] || IDX.clasificacion[0], eb = IDX.equipos[b] || IDX.clasificacion[1];
  if (!ea || !eb) return '';
  despues(() => ['h-a', 'h-b'].forEach(id => alCambiar(id, () => location.hash = `#/cara-a-cara/${document.getElementById('h-a').value}/${document.getElementById('h-b').value}`)));
  const sel = (id, e) => `<select id="${id}">${IDX.clasificacion.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>`;
  const duelos = T.partidos.filter(p => (p.local === ea.id && p.visitante === eb.id) || (p.local === eb.id && p.visitante === ea.id));
  const pend = (T.predicciones || []).filter(p => (p.local === ea.id && p.visitante === eb.id) || (p.local === eb.id && p.visitante === ea.id));
  const ms = ['pg', 'fuerza', 'ortg', 'drtg', 'net', 'ritmo', 'efg', 'tov', 'orb', 'ftr', 'efg_r', 'tov_r', 'orb_r', 'ftr_r', 'p3', 'p3r', 'ast', 'banq_pts', 'max_anot', 'edad', 'altura'].map(k => MEK[k]);
  const pa = percentilesDe(ea, ms, IDX.jugadas), pb = percentilesDe(eb, ms, IDX.jugadas);
  return h`${subnav(NAV_EQ, '#/cara-a-cara')}<h1>Cara a cara</h1>
    <div class="filtros"><label><span><span style="color:var(--serie-1)">●</span> Equipo 1</span>${sel('h-a', ea)}</label><label><span><span style="color:var(--serie-2)">●</span> Equipo 2</span>${sel('h-b', eb)}</label></div>
    <div class="rejilla-2"><div class="tarjeta"><div class="leyenda"><span style="--c:var(--serie-1)">${esc(ea.nombre)}</span><span style="--c:var(--serie-2)">${esc(eb.nombre)}</span></div>
      ${radar([{nombre: ea.nombre, color: 'var(--serie-1)', valores: pa.slice(2, 14).map(p => p.p)}, {nombre: eb.nombre, color: 'var(--serie-2)', valores: pb.slice(2, 14).map(p => p.p)}], pa.slice(2, 14).map(p => p.c))}</div>
      <div class="tarjeta"><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>${linkEq(ea.id)}</th><th>${linkEq(eb.id)}</th></tr></thead><tbody>
      ${ms.map((m, i) => { const x = m.v(ea), y = m.v(eb), mejor = x == null || y == null || x === y ? -1 : ((x > y) !== !!m.inv ? 0 : 1);
        return `<tr><td class="izq" title="${esc(m.i || '')}">${esc(m.n)}</td><td style="${mejor === 0 ? 'font-weight:700' : ''}">${fmt(x, m.d)} <span class="muy-tenue">P${pa[i].p}</span></td><td style="${mejor === 1 ? 'font-weight:700' : ''}">${fmt(y, m.d)} <span class="muy-tenue">P${pb[i].p}</span></td></tr>`; }).join('')}
      </tbody></table></div></div></div>
    <div class="tarjeta seccion"><h2>Sus partidos</h2>${duelos.length ? `<div class="partidos-lista">${duelos.map(partidoFila).join('')}</div>` : '<p class="tenue">Aún no se han enfrentado esta temporada.</p>'}
      ${pend.map(p => `<p>Pendiente (J${p.jornada}, ${esc(p.fecha)}): ${esc(eq(p.local).nombre)} gana con un <b>${fmt(100 * p.p_local, 0)} %</b> de probabilidad · margen esperado ${signo(p.margen, 1)}</p>`).join('')}</div>`;
};

VISTAS.equipo = id => {
  const e = IDX.equipos[id];
  if (!e || !e.pj) return '<p>Ese equipo no tiene partidos en esta temporada.</p>';
  const rango = (k) => { const m = MEK[k], v = m.v(e); return 1 + IDX.jugadas.filter(x => m.inv ? m.v(x) < v : m.v(x) > v).length; };
  const clas = IDX.clasificacion.find(x => x.id === id);
  const plantilla = T.jugadoras.filter(j => j.equipos.includes(id));
  const sim = T.simulacion && T.simulacion[id];
  despues(() => activarTablas(() => pintar()));
  const factor = (k) => { const m = MEK[k]; return `<tr title="${esc(m.i || (m.inv ? 'Menos es mejor' : 'Más es mejor'))}"><td class="izq">${esc(m.n)}</td><td><b>${fmt(m.v(e))}</b></td><td class="tenue">${rango(k)}.º</td><td class="muy-tenue">${fmt(T.liga.factores[k.replace('_r', '')])}</td></tr>`; };
  const rot = e.rotacion;
  const maxMin = 40;
  const celdasRot = rot.jugadoras.map((jid, i) => rot.min[i].map((m, k) => {
    const p = IDX.partidos[rot.partidos[k]];
    return {v: m / maxMin, texto: m ? Math.round(m) : '', tip: `<b>${esc(IDX.jugadoras[jid]?.nombre || '')}</b><br>J${p?.jornada} ${p ? (p.local === id ? 'vs ' + esc(eq(p.visitante).nombre) : 'en ' + esc(eq(p.local).nombre)) : ''}<br>${m ? Math.round(m) + ' min' + (rot.tit[i][k] ? ' · titular' : '') : 'no jugó'}`};
  }));
  const cuartosFilas = e.cuartos.map((c, i) => ({n: `${i + 1}.º cuarto`, v: c[0] != null ? c[0] - c[1] : null, texto: c[0] != null ? `${fmt(c[0])} - ${fmt(c[1])} (${signo(c[0] - c[1], 1)})` : '–'}));
  const wlFila = (n, wl, tip) => `<tr ${tip ? `title="${esc(tip)}"` : ''}><td class="izq">${n}</td><td>${vd(wl)}</td><td>${wl && wl[0] + wl[1] ? fmt(pct(wl[0], wl[0] + wl[1]), 0) + ' %' : '–'}</td></tr>`;
  return h`<a href="#/equipos" class="muy-tenue">← Equipos</a>
    <div class="tarjeta" style="margin-top:.5rem"><div class="encabezado" style="margin:0"><div><h1 style="margin:0">${esc(e.nombre)}</h1>${e.entrenador ? `<div class="tenue">Entrenador: <a href="#/entrenadores/${e.entrenador.id}">${esc(bonitoJS(e.entrenador.nombre))}</a></div>` : ''}</div><span><a href="${comparadorDeEquipo(e)}">Comparar con la liga${e.entrenador ? ' y su entrenador' : ''}</a> · <a href="#/carta/${id}">Carta de temporada</a> · <a href="#/cara-a-cara/${id}">Cara a cara</a></span></div>
      ${avisoActas(e.actas_incompletas)}
      <div class="cifras" style="margin-top:1rem">${cifra(`${clas ? clas.pos + '.º' : '–'}`, clas && T.grupos ? 'Clasificación · ' + IDX.grupoDe[id].nombre : 'Clasificación')}${cifra(`${e.pg}-${e.pj - e.pg}`, 'Victorias-derrotas')}
        ${cifra(fmt(e.pitag), 'V esperadas', MEK.pitag.i)}${cifra(signo(e.suerte, 1), 'Suerte', MEK.suerte.i)}${cifra(signo(e.fuerza, 1), `Fuerza (${rango('fuerza')}.º)`, MEK.fuerza.i)}
        ${cifra(fmt(e.ortg), `ORtg (${rango('ortg')}.º)`, MEK.ortg.i)}${cifra(fmt(e.drtg), `DRtg (${rango('drtg')}.º)`, MEK.drtg.i)}${cifra(signo(e.net, 1), `Neto (${rango('net')}.º)`)}${cifra(fmt(e.ritmo), `Ritmo (${rango('ritmo')}.º)`, MEK.ritmo.i)}
        ${sim && T.playoff ? cifra(fmt(100 * sim.puestos.slice(0, T.playoff).reduce((a, b) => a + b, 0), 0) + ' %', 'Prob. de playoff', 'Simulación del resto de la liga (10.000 veces)') : sim ? cifra(fmt(100 * sim.puestos[0], 0) + ' %', 'Prob. de acabar 1.º', 'Simulación del resto de su grupo (10.000 veces)') : ''}
        ${cifra(signo(e.srs, 2), `SRS (${rango('srs')}.º)`, MEK.srs.i)}${cifra(fmt(e.elo, 0), `Elo (${rango('elo')}.º)`, MEK.elo.i)}${cifra(signo(e.sos, 1), `Calendario (${rango('sos')}.º más duro)`, MEK.sos.i)}
        ${cifra(fmt(e.adj_ortg), 'ORtg ajustado', MEK.adj_ortg.i)}${cifra(fmt(e.adj_drtg), 'DRtg ajustado', MEK.adj_drtg.i)}
        ${cifra(signo(e.campo_propio, 1), 'Ventaja en casa', MEK.campo_propio.i)}${cifra(fmt(e.consistencia), 'Irregularidad', MEK.consistencia.i)}</div></div>
    ${e.factores_contrib ? `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>De dónde sale su diferencia</h2>
      ${barrasH(Object.entries(e.factores_contrib).map(([k, v]) => ({n: NOMBRE_FACTOR[k], v, texto: signo(v, 1),
        tip: `Puntos por 100 posesiones que le da (o le quita) su diferencia con los rivales en ${NOMBRE_FACTOR[k].toLowerCase()}`})))}
      <p class="muy-tenue">Cuántos puntos por 100 posesiones de su neto explica cada uno de los cuatro factores (su diferencia con los rivales por el peso que tiene en esta liga). <a href="#/decide">Cómo se calcula</a></p></div>
      <div class="tarjeta"><h2>Elo a lo largo de la temporada</h2>${(e.elo_hist || []).length > 1 ? lineas([{nombre: 'Elo', color: 'var(--serie-1)', valores: [e.elo_ini, ...e.elo_hist.map(x => x[1])]}],
        ['Inicio', ...e.elo_hist.map(x => 'J' + x[0])], {alto: 220, referencia: 1500, d: 0, titulo: 'Elo'}) : '<p class="tenue">Aún no hay partidos.</p>'}
        <p class="muy-tenue">Empieza con el 75 % de su Elo de la temporada anterior (y el resto, 1500). La raya es 1500, la media.</p></div></div>` : ''}
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Cuatro factores</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">Ataque</th><th>Valor</th><th>Puesto</th><th>Liga</th></tr></thead><tbody>
        ${['efg', 'tov', 'orb', 'ftr', 'ts', 'p3', 'p3r', 'ast'].map(factor).join('')}</tbody>
        <thead><tr><th class="izq">Defensa (lo del rival)</th><th></th><th></th><th></th></tr></thead><tbody>
        ${['efg_r', 'tov_r', 'orb_r', 'ftr_r', 'ts_r', 'p3_r', 'p3r_r', 'stl', 'blk'].map(factor).join('')}</tbody></table></div></div>
      <div class="tarjeta"><h2>Por cuartos</h2>${barrasH(cuartosFilas, {d: 1})}<p class="muy-tenue">Media de puntos a favor y en contra en cada cuarto, y su diferencia.</p>
        <h2 style="margin-top:1rem">Según el partido</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>V-D</th><th>%</th></tr></thead><tbody>
        ${wlFila('En casa', e.local)}${wlFila('Fuera', e.fuera)}${wlFila('Partidos igualados (≤ 5)', e.igualados)}${wlFila('Palizas (≥ 15)', e.palizas)}
        ${wlFila('Prórrogas', e.prorrogas)}${wlFila('Contra la mitad de arriba', e.vs_arriba, 'Rivales con fuerza positiva')}${wlFila('Contra la mitad de abajo', e.vs_abajo)}
        ${wlFila('Ganando al descanso', e.gana_al_descanso)}${wlFila('Perdiendo al descanso', e.pierde_al_descanso)}${wlFila('Con ≤ 4 días de descanso', e.descanso_corto)}
        </tbody></table></div><p class="muy-tenue">Neto por 100 posesiones: en casa ${signo(e.neto_local, 1)}, fuera ${signo(e.neto_fuera, 1)}.</p></div>
    </div>
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Titulares y banquillo</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>Pts</th><th>% pts</th><th>% min</th><th>Val</th><th>+/-</th></tr></thead><tbody>
        ${[['Titulares', e.titulares], ['Banquillo', e.banquillo]].map(([n, b]) => `<tr><td class="izq">${n}</td><td>${fmt(b.pts)}</td><td>${fmt(b.pct_pts)}</td><td>${fmt(b.pct_min)}</td><td>${fmt(b.pir)}</td><td>${signo(b.pm, 1)}</td></tr>`).join('')}
        </tbody></table></div>
        <h2 style="margin-top:1rem">Perfil de la plantilla</h2><div class="cifras">${cifra(fmt(e.edad_media), 'Edad media', 'Ponderada por minutos')}${cifra(fmt(e.altura_media, 0) + ' cm', 'Altura media', 'Ponderada por minutos')}
          ${cifra(fmt(e.pct_formacion, 0) + ' %', 'Min. formación')}${cifra(fmt(e.pct_extranjeras, 0) + ' %', 'Min. extranjeras')}${cifra(e.jugadoras_usadas, 'Jugadoras usadas')}
          ${cifra(fmt(e.max_anotadora, 0) + ' %', 'Puntos de la 1.ª', MEK.max_anot.i)}</div></div>
      <div class="tarjeta"><h2>Con y sin cada jugadora</h2>${barrasH(plantilla.filter(j => j.onoff != null && j.tot.min >= 40).sort((a, b) => b.onoff - a.onoff)
        .map(j => ({n: linkJu(j.id), v: j.onoff, texto: signo(j.onoff, 1), tip: `<b>${esc(j.nombre)}</b><br>Con ella: ${signo(j.con, 1)} por 40 min<br>Sin ella: ${signo(j.sin, 1)}<br>${fmt(j.tot.min, 0)} minutos`})))}
        <p class="muy-tenue">Cuánto mejora la diferencia de puntos del equipo (por 40 min) con ella en pista respecto a cuando está en el banquillo. Mínimo 40 minutos.</p></div>
    </div>
    <div class="tarjeta seccion"><h2>Plantilla</h2>${tabla('plantilla-' + id, plantilla, [
      {t: 'Jugadora', izq: true, f: j => linkJu(j.id), clase: 'nombre', v: j => j.nombre},
      {t: 'Pos.', izq: true, f: j => esc(j.puesto || '–'), v: j => j.puesto},
      {t: 'Edad', f: j => j.edad ?? '–', v: j => j.edad}, {t: 'Alt.', f: j => j.altura ?? '–', v: j => j.altura},
      {t: 'PJ', f: j => j.pj, v: j => j.pj}, ...['min', 'pts', 'trb', 'ast', 'pir', 'ts', 'usg', 'per', 'ortg', 'drtg', 'ws', 'onoff'].map(k => colM(MJK[k])),
    ], 5)}</div>
    ${bloquePbpEquipo(e)}
    <div class="tarjeta seccion"><h2>Por 100 posesiones: el equipo y sus rivales</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th>
      ${['Pts', 'Reb', 'RO', 'Ast', 'Rob', 'Tap', 'Pér', 'FC', 'T3', 'T3I', 'TLI'].map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>
      ${[['Equipo', e.p100], ['Rivales', e.p100_rival]].map(([n, x]) => `<tr><td class="izq">${n}</td>${['pts', 'trb', 'orb', 'ast', 'stl', 'blk', 'tov', 'pf', 'p3', 'p3a', 'fta'].map(k => `<td>${fmt(x && x[k])}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>
    <div class="tarjeta seccion"><h2>Quintetos titulares</h2>${(e.quintetos || []).length ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">Quinteto</th><th>Partidos</th><th>V-D</th><th>Dif. media</th></tr></thead><tbody>
      ${e.quintetos.slice(0, 8).map(q => `<tr><td class="izq" style="white-space:normal">${q.jugadoras.map(x => linkJu(x, (IDX.jugadoras[x]?.nombre || '').split(' ').slice(-1)[0])).join(' · ')}</td><td>${q.pj}</td><td>${q.v}-${q.pj - q.v}</td><td>${signo(q.dif, 1)}</td></tr>`).join('')}
      </tbody></table></div><p class="muy-tenue">${e.quintetos.length} quintetos titulares distintos. La diferencia es la del partido entero, no solo la de los minutos que estuvieron juntas (eso necesita el jugada a jugada).</p>` : '<p class="tenue">Sin datos.</p>'}</div>
    <div class="tarjeta seccion"><h2>Rotación</h2>${mapaCalor(rot.jugadoras.map(j => linkJu(j)), rot.partidos.map(p => 'J' + (IDX.partidos[p]?.jornada ?? '')), celdasRot,
      {nota: 'Minutos de cada jugadora en cada partido (más oscuro, más minutos).'})}</div>
    <div class="tarjeta seccion"><h2>Evolución en la clasificación</h2>${bump([id])}
      ${sim ? `<h2 style="margin-top:1rem">Dónde puede acabar</h2>${barrasH(sim.puestos.map((p, i) => ({n: `${i + 1}.º`, v: 100 * p, texto: fmt(100 * p, 1) + ' %'})).filter(x => x.v >= 0.5))}
        <p class="muy-tenue">Probabilidad de cada puesto final, simulando 10.000 veces lo que queda de liga. Victorias esperadas: ${fmt(sim.victorias)}.</p>` : ''}</div>
    <div class="tarjeta seccion"><h2>Resultados</h2><div class="partidos-lista partidos-lista--columnas">${[...e.partidos].reverse().map(x => partidoFila(IDX.partidos[x[0]])).join('')}</div></div>
    </div>`;
};

const bonitoJS = s => String(s || '').toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
