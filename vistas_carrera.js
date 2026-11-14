// LF Stats · lo que cruza competiciones: buscador, carrera completa, cantera y estado de los datos. Sale de
// datos/jugadoras.js (cada jugadora en cada competición y temporada) y datos/salud.js.
'use strict';

// filas de JUG.filas[id]: [competición, temporada, equipo, PJ, Min, Pts, Reb, Ast, Val, TS%, PER, BPM, GmSc,
// puntos totales, edad, puesto, id del equipo, club, % de triple, triples intentados, uso %, altura, extranjera (1/0),
// de formación (1/0)], de la temporada más reciente a la más antigua
const F = {c: 0, t: 1, eq: 2, pj: 3, min: 4, pts: 5, trb: 6, ast: 7, pir: 8, ts: 9, per: 10, bpm: 11, gmsc: 12, tpts: 13, edad: 14, puesto: 15, eqid: 16,
  club: 17, p3: 18, p3a: 19, usg: 20, alt: 21, ext: 22, form: 23};
let NIVEL = {};          // ligas sénior y su nivel (1 = la máxima), de datos/competiciones.js
let SALUD = null;        // datos/salud.js, se carga al abrir la página
const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const compDe = c => COMPETICIONES.find(x => x.clave === c) || {clave: c, corto: c, genero: 'f'};
const cortoDe = c => compDe(c).corto;
const nombreT = t => `${t}/${String(Number(t) + 1).slice(2)}`;
const nombreDe = id => JUG.nombres[id] || '?';
const linkCarrera = id => `<a href="#/carrera/${id}">${esc(nombreDe(id))}</a>`;
const esFormacion = c => /^(clubes|selecciones)_/.test(c) || c === 'minicopa';
const categoria = c => c === 'minicopa' ? 'infantil' : (c.match(/junior|cadete|infantil|mini/) || [''])[0];
const NOMBRE_CAT = {junior: 'Júnior', cadete: 'Cadete', infantil: 'Infantil', mini: 'Mini'};
const jugCargadas = () => Object.keys(JUG.nombres).length > 0;
// enlaces a otra competición o temporada: <a data-ir="competición|temporada|#/ruta">
const enlaceIr = (c, t, ruta, texto) => `<a href="${ruta}" data-ir="${esc(c)}|${t}|${esc(ruta)}">${texto}</a>`;
function activarIr() {
  document.querySelectorAll('[data-ir]').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault();
    const [c, t, ruta] = a.dataset.ir.split('|');
    irA(c, t, ruta);
  }));
}

// ---------------------------------------------------------------- buscador de la cabecera
function indiceBuscador() {
  if (indiceBuscador.de === JUG) return indiceBuscador.lista;
  const jugadoras = Object.entries(JUG.nombres).map(([id, n]) => ({tipo: 'j', id, n, k: normal(n), fila: (JUG.filas[id] || [])[0]})).filter(x => x.fila);
  const equipos = (JUG.equipos || []).map(([n, c, t, eid]) => ({tipo: 'e', n, k: normal(n), c, t, eid}));
  indiceBuscador.de = JUG;
  return (indiceBuscador.lista = jugadoras.concat(equipos));
}
function buscarTexto(q) {
  const trozos = normal(q).split(/\s+/).filter(Boolean);
  const encaja = x => trozos.every(tr => x.k.includes(tr));
  const nota = x => {
    const c = x.tipo === 'j' ? x.fila[F.c] : x.c, t = x.tipo === 'j' ? x.fila[F.t] : x.t;
    return (genero(compDe(c)) === GENERO ? 0 : 1e6) - (x.k.split(/\s+/).some(p => p.startsWith(trozos[0])) ? 1e5 : 0) - t * 10 + (NIVEL[c] || 9);
  };
  const lista = indiceBuscador().filter(encaja).sort((a, b) => nota(a) - nota(b));
  return [...lista.filter(x => x.tipo === 'j').slice(0, 8), ...lista.filter(x => x.tipo === 'e').slice(0, 5)];
}
function activarBuscador() {
  const input = document.getElementById('buscar'), caja = document.getElementById('resultados');
  let lista = [], marcado = 0;
  const cerrar = () => { caja.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  const elegir = x => {
    cerrar(); input.value = ''; input.blur();
    if (x.tipo === 'j') irA(x.fila[F.c], x.fila[F.t], `#/jugadora/${x.id}`);
    else irA(x.c, x.t, `#/equipo/${x.eid}`);
  };
  const pintarLista = () => {
    const q = input.value.trim();
    if (q.length < 2) { cerrar(); return; }
    caja.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (!jugCargadas()) { caja.innerHTML = '<div class="resultado tenue">Cargando…</div>'; return; }
    lista = buscarTexto(q); marcado = 0;
    if (!lista.length) { caja.innerHTML = '<div class="resultado tenue">Sin resultados</div>'; return; }
    const otra = c => genero(compDe(c)) !== GENERO ? ` · ${genero(compDe(c)) === 'm' ? 'masculino' : 'femenino'}` : '';
    caja.innerHTML = lista.map((x, i) => {
      const titulo = i === 0 || lista[i - 1].tipo !== x.tipo ? `<div class="resultados__titulo">${x.tipo === 'j' ? enGenero('Jugadoras') : 'Equipos'}</div>` : '';
      const det = x.tipo === 'j' ? `${cortoDe(x.fila[F.c])} ${nombreT(x.fila[F.t])} · ${x.fila[F.eq]}${otra(x.fila[F.c])}` : `${cortoDe(x.c)} ${nombreT(x.t)}${otra(x.c)}`;
      return `${titulo}<button type="button" class="resultado" role="option" data-i="${i}" aria-selected="${i === marcado}">${esc(x.n)}<small>${esc(det)}</small></button>`;
    }).join('');
    caja.querySelectorAll('[data-i]').forEach(b => b.addEventListener('mousedown', ev => { ev.preventDefault(); elegir(lista[Number(b.dataset.i)]); }));
  };
  const marcar = n => {
    const bs = caja.querySelectorAll('[data-i]');
    if (!bs.length) return;
    marcado = (n + bs.length) % bs.length;
    bs.forEach((b, i) => b.setAttribute('aria-selected', String(i === marcado)));
    bs[marcado].scrollIntoView({block: 'nearest'});
  };
  input.addEventListener('input', pintarLista);
  input.addEventListener('focus', pintarLista);
  input.addEventListener('blur', () => setTimeout(cerrar, 150));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); marcar(marcado + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); marcar(marcado - 1); }
    else if (ev.key === 'Enter' && lista[marcado] && !caja.hidden) { ev.preventDefault(); elegir(lista[marcado]); }
    else if (ev.key === 'Escape') { cerrar(); input.blur(); }
  });
  // cuando llegan los datos, si ya había algo escrito
  const esperar = setInterval(() => { if (jugCargadas()) { clearInterval(esperar); if (document.activeElement === input) pintarLista(); } }, 500);
}

// ---------------------------------------------------------------- carrera completa
const METRICAS_CARRERA = [['eq', 'Val. equivalente'], ['pir', 'Valoración'], ['pts', 'Puntos'], ['trb', 'Rebotes'], ['ast', 'Asistencias'], ['min', 'Minutos'], ['gmsc', 'Game Score']];
VISTAS.carrera = id => {
  if (!jugCargadas()) return '<p class="tenue">Cargando…</p>';
  const filas = JUG.filas[id];
  if (!filas) return '<p>No está esa jugadora.</p>';
  const m = VISTAS.carrera.m || 'eq';
  despues(() => { alPulsar('car-m', v => { VISTAS.carrera.m = v; pintar(); }); activarIr(); activarImprimir(); });
  const valor = x => m === 'eq' ? valEq(x) : x[F[m]];
  const comps = [...new Set(filas.map(x => x[F.c]))];
  const temporadas = [...new Set(filas.map(x => x[F.t]))].sort((a, b) => a - b);
  const desde = temporadas[0], hasta = temporadas[temporadas.length - 1];
  const ejeT = Array.from({length: hasta - desde + 1}, (_, i) => desde + i);
  const series = comps.map((c, i) => ({nombre: cortoDe(c), color: COLORES[i % COLORES.length],
    valores: ejeT.map(t => { const x = filas.find(y => y[F.c] === c && y[F.t] === t); return x ? valor(x) : null; })}));
  const senior = filas.filter(x => NIVEL[x[F.c]]);
  const nivelMax = senior.length ? senior.reduce((a, b) => NIVEL[b[F.c]] < NIVEL[a[F.c]] ? b : a) : null;
  const conPartidos = filas.filter(x => x[F.pj] >= 5);
  const mejor = (conPartidos.length ? conPartidos : filas).reduce((a, b) => (b[F.gmsc] ?? -99) > (a[F.gmsc] ?? -99) ? b : a);
  const ultima = filas[0];
  const ir = x => enlaceIr(x[F.c], x[F.t], `#/jugadora/${id}`, nombreT(x[F.t]));
  const porComp = comps.map(c => {
    const fs = filas.filter(x => x[F.c] === c), pj = fs.reduce((s, x) => s + x[F.pj], 0);
    const pond = k => fs.some(x => x[k] != null) ? fs.reduce((s, x) => s + (x[k] || 0) * x[F.pj], 0) / pj : null;
    return {c, temporadas: fs.length, pj, desde: Math.min(...fs.map(x => x[F.t])), hasta: Math.max(...fs.map(x => x[F.t])),
      min: pond(F.min), pts: pond(F.pts), trb: pond(F.trb), ast: pond(F.ast), pir: pond(F.pir), tot: fs.reduce((s, x) => s + (x[F.tpts] || 0), 0)};
  });
  return h`${subnav(NAV_JUG, '')}<div class="encabezado"><div><h1>${esc(nombreDe(id))}</h1>
      <p class="tenue">Carrera completa: ${comps.length} ${comps.length === 1 ? 'competición' : 'competiciones'} y ${temporadas.length} temporada${temporadas.length === 1 ? '' : 's'}
      ${ultima[F.puesto] ? ' · ' + esc(ultima[F.puesto]) : ''}${ultima[F.edad] ? ` · ${ultima[F.edad]} años en ${nombreT(ultima[F.t])}` : ''}.
      Ahora: ${enlaceIr(ultima[F.c], ultima[F.t], `#/jugadora/${id}`, esc(cortoDe(ultima[F.c]) + ' · ' + ultima[F.eq]))}</p></div>${botonImprimir()}</div>
    <div class="cifras">${cifra(temporadas.length, 'Temporadas')}${cifra(comps.length, 'Competiciones')}${cifra(filas.reduce((s, x) => s + x[F.pj], 0), 'Partidos')}
      ${cifra(fmt(filas.reduce((s, x) => s + (x[F.tpts] || 0), 0), 0), 'Puntos')}
      ${cifra(nivelMax ? esc(cortoDe(nivelMax[F.c])) : '–', 'Nivel más alto', 'La liga sénior de más categoría en la que ha jugado')}
      ${cifra(`${nombreT(mejor[F.t])}`, `Mejor temporada · ${esc(cortoDe(mejor[F.c]))}`, `La de mejor Game Score por partido (${fmt(mejor[F.gmsc])}) con al menos 5 partidos`)}</div>
    <div class="tarjeta seccion"><div class="encabezado" style="margin-bottom:.25rem"><h2>Evolución</h2>${pildoras('car-m', METRICAS_CARRERA, m)}</div>
      <div class="leyenda">${series.map(s => `<span style="--c:${s.color}">${esc(s.nombre)}</span>`).join('')}</div>
      ${lineas(series, ejeT.map(nombreT), {titulo: 'Evolución por temporada'})}
      <p class="muy-tenue">Por partido, en cada competición. ${m === 'eq' ? `Valoración equivalente: la de cada temporada llevada a ${esc(cortoDe(maximaSeccion() || ''))} con el factor de su competición, para poder comparar niveles distintos (<a href="#/metodo">cómo se calcula</a>).` : 'Las cifras de competiciones de distinto nivel no son comparables entre sí (en «Val. equivalente», sí).'}</p></div>
    <div class="tarjeta seccion"><h2>Por competición</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">Competición</th><th>Temporadas</th><th class="izq">Años</th><th>PJ</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th><th>Puntos totales</th></tr></thead><tbody>
      ${porComp.map(x => `<tr><td class="izq">${esc(cortoDe(x.c))}</td><td>${x.temporadas}</td><td class="izq">${nombreT(x.desde)}${x.hasta > x.desde ? ' a ' + nombreT(x.hasta) : ''}</td><td>${x.pj}</td><td>${fmt(x.min)}</td><td>${fmt(x.pts)}</td><td>${fmt(x.trb)}</td><td>${fmt(x.ast)}</td><td>${fmt(x.pir)}</td><td>${fmt(x.tot, 0)}</td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="tarjeta seccion"><h2>Temporada a temporada</h2><p class="muy-tenue" style="margin-top:-.4rem">Pulsa una temporada para ver su ficha en esa competición.</p>
      <div class="tabla-scroll"><table><thead><tr><th class="izq">Temporada</th><th class="izq">Competición</th><th class="izq">Equipo</th><th>Edad</th><th>PJ</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th><th title="Valoración equivalente en la máxima de su sección">Val. eq.</th><th>TS%</th><th>PER</th><th>BPM</th><th>GmSc</th></tr></thead><tbody>
      ${filas.map(x => `<tr${x === mejor ? ' class="destacada"' : ''}><td class="izq">${ir(x)}</td><td class="izq">${esc(cortoDe(x[F.c]))}</td><td class="izq">${esc(x[F.eq])}</td><td>${x[F.edad] ?? '–'}</td><td>${x[F.pj]}</td><td>${fmt(x[F.min])}</td><td>${fmt(x[F.pts])}</td><td>${fmt(x[F.trb])}</td><td>${fmt(x[F.ast])}</td><td>${fmt(x[F.pir])}</td><td><b>${fmt(valEq(x))}</b></td><td>${fmt(x[F.ts])}</td><td>${fmt(x[F.per])}</td><td>${signo(x[F.bpm], 1)}</td><td>${fmt(x[F.gmsc])}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="muy-tenue">El PER, el BPM y el TS% se calculan frente a su competición. En negrita, la mejor temporada.</p></div>`;
};

// ---------------------------------------------------------------- cantera
// quién jugó los campeonatos de España de formación y dónde ha llegado, qué clubes forman más y las promesas del año
function datosCantera() {
  const clave = GENERO;
  if (datosCantera.de === JUG && datosCantera.g === clave) return datosCantera.r;
  const deSeccion = c => genero(compDe(c)) === GENERO;
  const personas = [];
  for (const [id, filas] of Object.entries(JUG.filas)) {
    const fs = filas.filter(x => deSeccion(x[F.c]));
    const form = fs.filter(x => esFormacion(x[F.c]));
    if (!form.length) continue;
    const senior = fs.filter(x => NIVEL[x[F.c]]);
    const inicio = Math.min(...form.map(x => x[F.t]));
    const llega = senior.filter(x => x[F.t] >= inicio);
    const mejorF = form.filter(x => x[F.pj] >= 2).concat(form).reduce((a, b) => (b[F.gmsc] ?? -99) > (a[F.gmsc] ?? -99) ? b : a);
    const nivel = llega.length ? Math.min(...llega.map(x => NIVEL[x[F.c]])) : null;
    personas.push({id, form, mejorF, llega, nivel, alto: llega.length ? llega.find(x => NIVEL[x[F.c]] === nivel) : null, ultima: llega[0] || null});
  }
  // clubes: los de los campeonatos de clubes (no las selecciones), por su nombre
  const clubes = new Map();
  for (const p of personas) {
    for (const x of p.form.filter(x => !x[F.c].startsWith('selecciones_'))) {
      const k = normal(x[F.eq]).replace(/[^a-z0-9 ]/g, '').trim();
      if (!k) continue;
      const c = clubes.get(k) || {nombres: new Map(), todas: new Set(), senior: new Set(), maxima: new Set()};
      c.nombres.set(x[F.eq], (c.nombres.get(x[F.eq]) || 0) + 1);
      c.todas.add(p.id);
      if (p.nivel) c.senior.add(p.id);
      if (p.nivel === 1) c.maxima.add(p.id);
      clubes.set(k, c);
    }
  }
  const listaClubes = [...clubes.values()].filter(c => c.todas.size >= 5)
    .map(c => ({nombre: [...c.nombres.entries()].sort((a, b) => b[1] - a[1])[0][0], todas: c.todas.size, senior: c.senior.size, maxima: c.maxima.size}));
  const ultimaT = Math.max(...personas.flatMap(p => p.form.map(x => x[F.t])));
  datosCantera.de = JUG; datosCantera.g = clave;
  return (datosCantera.r = {personas, clubes: listaClubes, ultimaT});
}

VISTAS.cantera = () => {
  if (!jugCargadas()) return '<p class="tenue">Cargando…</p>';
  const d = datosCantera();
  if (!d.personas.length) return '<p>Todavía no hay campeonatos de formación en esta sección.</p>';
  const filtro = VISTAS.cantera.f || 'todas', cat = VISTAS.cantera.cat || 'todas';
  const repintar = () => pintar();
  despues(() => {
    alPulsar('can-f', v => { VISTAS.cantera.f = v; repintar(); });
    alPulsar('can-cat', v => { VISTAS.cantera.cat = v; repintar(); });
    activarTablas(repintar); activarIr();
  });
  const llegaron = d.personas.filter(p => p.nivel), maxima = llegaron.filter(p => p.nivel === 1);
  const elite = (filtro === 'maxima' ? maxima : llegaron);
  const formacion = p => `${NOMBRE_CAT[categoria(p.mejorF[F.c])] || ''} · ${p.mejorF[F.eq]} (${nombreT(p.mejorF[F.t])})`;
  const tablaElite = tabla('cantera-elite', elite, [
    {t: 'Jugadora', izq: true, f: p => linkCarrera(p.id), v: p => nombreDe(p.id)},
    {t: 'Formación', izq: true, tip: 'Su mejor campeonato de formación (por Game Score)', f: p => esc(formacion(p))},
    {t: 'Nivel más alto', izq: true, f: p => esc(cortoDe(p.alto[F.c])), v: p => -p.nivel},
    {t: 'Última temporada sénior', izq: true, f: p => enlaceIr(p.ultima[F.c], p.ultima[F.t], `#/jugadora/${p.id}`, esc(`${nombreT(p.ultima[F.t])} · ${cortoDe(p.ultima[F.c])} · ${p.ultima[F.eq]}`)), v: p => p.ultima[F.t] * 10 - NIVEL[p.ultima[F.c]]},
    {t: 'PJ', f: p => p.ultima[F.pj], v: p => p.ultima[F.pj]},
    {t: 'Pts', f: p => fmt(p.ultima[F.pts]), v: p => p.ultima[F.pts]},
    {t: 'Val', f: p => fmt(p.ultima[F.pir]), v: p => p.ultima[F.pir]},
  ], 2, {limite: 200});
  const tablaClubes = tabla('cantera-clubes', d.clubes, [
    {t: 'Club', izq: true, f: c => esc(c.nombre), v: c => c.nombre},
    {t: 'Jugadoras', tip: 'Jugadoras distintas en sus equipos de los Campeonatos de España de clubes', f: c => c.todas, v: c => c.todas},
    {t: 'Sénior', tip: 'Cuántas han jugado después en una liga sénior', f: c => c.senior, v: c => c.senior},
    {t: '% sénior', f: c => fmt(pct(c.senior, c.todas), 0) + ' %', v: c => pct(c.senior, c.todas)},
    {t: 'Máxima', tip: 'Cuántas han llegado a la máxima categoría', f: c => c.maxima, v: c => c.maxima},
  ], 2, {limite: 40});
  const promesas = d.personas.flatMap(p => p.form.filter(x => x[F.t] === d.ultimaT && x[F.pj] >= 3).map(x => ({id: p.id, x})))
    .filter(r => cat === 'todas' || categoria(r.x[F.c]) === cat);
  const cats = ['junior', 'cadete', 'infantil', 'mini'].filter(c => d.personas.some(p => p.form.some(x => x[F.t] === d.ultimaT && categoria(x[F.c]) === c)));
  const tablaPromesas = tabla('cantera-promesas', promesas, [
    {t: 'Jugadora', izq: true, f: r => linkCarrera(r.id), v: r => nombreDe(r.id)},
    {t: 'Campeonato', izq: true, f: r => enlaceIr(r.x[F.c], r.x[F.t], `#/jugadora/${r.id}`, esc(cortoDe(r.x[F.c]))), v: r => r.x[F.c]},
    {t: 'Equipo', izq: true, f: r => esc(r.x[F.eq]), v: r => r.x[F.eq]},
    {t: 'Edad', f: r => r.x[F.edad] ?? '–', v: r => r.x[F.edad]},
    {t: 'PJ', f: r => r.x[F.pj], v: r => r.x[F.pj]},
    {t: 'Pts', f: r => fmt(r.x[F.pts]), v: r => r.x[F.pts]},
    {t: 'Reb', f: r => fmt(r.x[F.trb]), v: r => r.x[F.trb]},
    {t: 'Ast', f: r => fmt(r.x[F.ast]), v: r => r.x[F.ast]},
    {t: 'Val', f: r => fmt(r.x[F.pir]), v: r => r.x[F.pir]},
    {t: 'GmSc', tip: MJK.gmsc.i, f: r => `<b>${fmt(r.x[F.gmsc])}</b>`, v: r => r.x[F.gmsc]},
  ], 9, {limite: 40});
  return h`<div class="encabezado"><div><h1>Cantera</h1><p class="tenue">Las jugadoras de los Campeonatos de España de formación (clubes y selecciones, de mini a júnior) y dónde han llegado después.</p></div></div>
    <div class="cifras">${cifra(fmt(d.personas.length, 0), 'En formación')}${cifra(fmt(llegaron.length, 0), 'Llegan a sénior', 'Han jugado una liga sénior después de su primer campeonato de formación')}
      ${cifra(fmt(maxima.length, 0), 'Llegan a la máxima')}${cifra(fmt(pct(llegaron.length, d.personas.length), 1) + ' %', 'De formación a sénior')}</div>
    <div class="tarjeta seccion"><div class="encabezado" style="margin-bottom:.25rem"><h2>De la formación a la élite</h2>${pildoras('can-f', [['todas', 'Todas las ligas sénior'], ['maxima', 'Solo la máxima']], filtro)}</div>
      <p class="muy-tenue" style="margin-top:-.2rem">Solo cuenta lo jugado desde su primer campeonato de formación en la web (los datos empiezan en 2020/21).</p>${tablaElite}</div>
    <div class="tarjeta seccion"><h2>Clubes que más forman</h2><p class="muy-tenue" style="margin-top:-.4rem">Clubes con al menos 5 jugadoras en los Campeonatos de España de clubes, por su nombre en el acta (el patrocinador puede partir un club en dos).</p>${tablaClubes}</div>
    <div class="tarjeta seccion"><div class="encabezado" style="margin-bottom:.25rem"><h2>Promesas de ${nombreT(d.ultimaT)}</h2>${pildoras('can-cat', [['todas', 'Todas'], ...cats.map(c => [c, NOMBRE_CAT[c]])], cat)}</div>
      <p class="muy-tenue" style="margin-top:-.2rem">Lo mejor de los últimos campeonatos de formación, por Game Score por partido (mínimo 3 partidos).</p>${tablaPromesas}</div>`;
};

// ---------------------------------------------------------------- estado de los datos
VISTAS.salud = () => {
  if (!SALUD) {
    if (!VISTAS.salud.cargando) {
      VISTAS.salud.cargando = cargarDatos('datos/salud.js', 'salud', () => window.LF_SALUD)
        .then(d => { SALUD = d; }).catch(() => { SALUD = {temporadas: [], unificadas: [], dudosas: [], error: true}; })
        .then(() => { if (location.hash.startsWith('#/salud')) { pintar.ultima = null; pintar(); } });
    }
    return '<p class="tenue">Cargando…</p>';
  }
  if (SALUD.error) return '<div class="aviso">No se ha podido cargar el estado de los datos.</div>';
  despues(activarIr);
  const deSeccion = c => genero(compDe(c)) === GENERO;
  const ts = SALUD.temporadas.filter(x => deSeccion(x.comp)).sort((a, b) => COMPETICIONES.indexOf(compDe(a.comp)) - COMPETICIONES.indexOf(compDe(b.comp)) || b.t - a.t);
  const suma = k => ts.reduce((s, x) => s + (x[k] || 0), 0);
  const alerta = (n, tip) => `<td class="${n ? 'alerta' : 'muy-tenue'}" ${n && tip ? `data-tip="${esc(tip)}"` : ''}>${n}</td>`;
  const unif = SALUD.unificadas.filter(x => x.genero === GENERO), dud = SALUD.dudosas.filter(x => x.genero === GENERO);
  const dondeJuega = id => { const x = (JUG.filas[id] || [])[0]; return x ? enlaceIr(x[F.c], x[F.t], `#/jugadora/${id}`, esc(`${cortoDe(x[F.c])} ${nombreT(x[F.t])} · ${x[F.eq]}`)) : `<span class="muy-tenue">n.º ${esc(id)}</span>`; };
  return h`<div class="encabezado"><div><h1>Estado de los datos</h1><p class="tenue">Qué falta o no cuadra en lo que publica la FEB, por competición y temporada. Actualizado ${esc((SALUD.actualizado || '').replace('T', ' '))}.</p></div></div>
    <div class="cifras">${cifra(fmt(suma('con_acta'), 0), 'Partidos con acta')}${cifra(fmt(suma('sin_acta'), 0), 'Jugados sin acta', 'Tienen resultado en el calendario pero la FEB no ha publicado sus estadísticas')}
      ${cifra(fmt(suma('incompletas'), 0), 'Actas incompletas', 'Falta alguna jugadora o no cuadran los minutos o los puntos')}
      ${cifra(fmt(suma('rescatadas'), 0), 'Jugadoras rescatadas', 'Las que la FEB no puso en el acta, rehechas con el jugada a jugada')}${cifra(fmt(suma('fichas'), 0), 'Fichas completadas', 'Con la ficha de otra temporada o competición')}
      ${cifra(fmt(suma('sin_pbp') + suma('pbp_pendiente'), 0), 'Sin jugada a jugada')}${cifra(fmt(unif.length, 0), 'Personas juntadas')}${cifra(fmt(dud.length, 0), 'Posibles duplicados')}</div>
    <div class="tarjeta seccion"><h2>Por competición y temporada</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">Competición</th><th class="izq">Temporada</th>
      <th title="Partidos en el calendario (jugados y por jugar)">Calendario</th><th title="Con resultado">Jugados</th><th title="Con estadísticas publicadas">Con acta</th><th title="Con resultado pero sin estadísticas">Sin acta</th>
      <th title="Falta alguna jugadora o no cuadran los minutos o los puntos">Incompletas</th><th title="Partidos con jugada a jugada y gráfico de tiro">Jugada a jugada</th>
      <th title="La FEB no la tiene (probado dos días distintos)">No disponible</th><th title="Aún no descargada">Pendiente</th>
      <th title="Jugadoras que la FEB no puso en el acta y se han rehecho con el jugada a jugada">Rescatadas</th>
      <th title="Jugadoras que no están en la plantilla de su equipo y han tomado la ficha de otra temporada o competición">Fichas completadas</th>
      <th title="Jugadoras que salen en las actas pero no en ninguna plantilla: sin edad, altura ni puesto">Sin ficha</th><th title="Equipos con dos nombres distintos en el calendario (cambio de patrocinador)">Dos nombres</th></tr></thead><tbody>
      ${ts.map(x => `<tr><td class="izq">${esc(cortoDe(x.comp))}</td><td class="izq">${enlaceIr(x.comp, x.t, '#/', nombreT(x.t))}</td><td>${x.calendario}</td><td>${x.jugados}</td><td>${x.con_acta}</td>
        ${alerta(x.sin_acta)}${alerta(x.incompletas)}<td>${x.con_pbp}</td>${alerta(x.sin_pbp)}${alerta(x.pbp_pendiente)}
        <td>${x.rescatadas || 0}</td><td>${x.fichas || 0}</td>${alerta(x.sin_ficha, `${x.sin_ficha} de ${x.jugadoras} jugadoras`)}${alerta(x.renombrados.length, x.renombrados.map(n => n.map(esc).join(' / ')).join('<br>'))}</tr>`).join('')}
      </tbody></table></div></div>
    <div class="tarjeta seccion"><h2>La misma persona con dos números (FEB o ACB)</h2>
      <p class="muy-tenue" style="margin-top:-.4rem">Mismo nombre y misma fecha de nacimiento en las plantillas (en las competiciones de fuera de la FEB, que a veces escriben un solo apellido: todas las palabras de su nombre en el de la FEB). Se han juntado en una sola: sus partidos y temporadas cuentan juntos.</p>
      ${unif.length ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">Nombre</th><th class="izq">Nacimiento</th><th class="izq">Números</th><th class="izq">Última temporada</th></tr></thead><tbody>
      ${unif.map(x => `<tr><td class="izq">${JUG.filas[x.id] ? linkCarrera(x.id) : esc(x.nombre)}</td><td class="izq">${x.a_mano ? 'revisada a mano' : esc(x.nacimiento)}</td><td class="izq">${esc([x.id, ...x.otros].join(', '))}</td><td class="izq">${dondeJuega(x.id)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="tenue">Ninguna.</p>'}</div>
    <div class="tarjeta seccion"><h2>Posibles duplicados</h2>
      <p class="muy-tenue" style="margin-top:-.4rem">Mismo nombre con números distintos y sin la misma fecha de nacimiento: pueden ser dos personas que se llaman igual o una con la fecha mal puesta. No se juntan.</p>
      ${dud.length ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">Nombre</th><th class="izq">Dónde sale cada número</th></tr></thead><tbody>
      ${dud.map(x => `<tr><td class="izq">${esc(x.nombre)}</td><td class="izq">${x.ids.map(dondeJuega).join('<br>')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="tenue">Ninguno.</p>'}</div>`;
};

// ---------------------------------------------------------------- favoritas
// Se guardan en este navegador: [{tipo: 'j', id} | {tipo: 'e', club, nombre, comp, t, eid}]
const FAVORITAS = {
  leer() { try { return JSON.parse(localStorage.getItem('lfstats:favoritas')) || []; } catch (e) { return []; } },
  guardar(l) { try { localStorage.setItem('lfstats:favoritas', JSON.stringify(l)); } catch (e) { /* sin almacenamiento */ } },
  clave: x => x.tipo === 'j' ? 'j:' + x.id : 'e:' + x.comp + ':' + (x.club || x.nombre),
  esta(x) { return this.leer().some(y => this.clave(y) === this.clave(x)); },
  cambiar(x) {
    const l = this.leer(), k = this.clave(x);
    this.guardar(l.some(y => this.clave(y) === k) ? l.filter(y => this.clave(y) !== k) : [...l, x]);
  },
};
const TIP_FAV = esta => esta ? 'Quitar de favoritas' : 'Añadir a favoritas: sale en la portada';
// botón de estrella para una jugadora o un equipo
function botonFavorita(x) {
  const esta = FAVORITAS.esta(x);
  return `<button type="button" class="estrella" data-fav="${esc(JSON.stringify(x))}" aria-pressed="${esta}" aria-label="${TIP_FAV(esta)}" data-tip="${TIP_FAV(esta)}">${esta ? '★' : '☆'}</button>`;
}
const favJugadora = id => ({tipo: 'j', id});
const favEquipo = e => ({tipo: 'e', club: e.club || null, nombre: e.nombre, comp: COMP.clave, t: T.temporada, eid: e.id});
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-fav]');
  if (!b) return;
  const x = JSON.parse(b.dataset.fav);
  FAVORITAS.cambiar(x);
  const esta = FAVORITAS.esta(x);
  b.setAttribute('aria-pressed', String(esta)); b.textContent = esta ? '★' : '☆';
  b.setAttribute('data-tip', enGenero(TIP_FAV(esta))); b.setAttribute('aria-label', enGenero(TIP_FAV(esta)));
  $tip.innerHTML = b.getAttribute('data-tip');
});

// tarjeta de la portada con las favoritas de esta sección
function panelFavoritas() {
  const deSeccion = c => genero(compDe(c)) === GENERO;
  const lista = FAVORITAS.leer().filter(x => x.tipo === 'j' ? JUG.filas[x.id] && deSeccion(JUG.filas[x.id][0][F.c]) : deSeccion(x.comp));
  if (!lista.length) return '';
  despues(activarIr);
  const filaJ = x => {
    const f = JUG.filas[x.id][0], j = IDX.jugadoras[x.id];
    const ult = j && (j.ult || (j.log && j.log[j.log.length - 1]));
    const ultimo = ult ? ` · <a href="#/partido/${ult[0]}">J${ult[1]} ${ult[3] ? 'vs' : 'en'} ${esc(eq(ult[2]).nombre)}</a>: ${ult[7]} pts, ${ult[14]} reb, ${ult[19]} val` : '';
    return `<tr><td class="izq">${botonFavorita(favJugadora(x.id))} ${enlaceIr(f[F.c], f[F.t], `#/jugadora/${x.id}`, esc(nombreDe(x.id)))}
      <div class="muy-tenue">${esc(cortoDe(f[F.c]))} ${nombreT(f[F.t])} · ${esc(f[F.eq])}${ultimo}</div></td><td>${f[F.pj]}</td><td>${fmt(f[F.pts])}</td><td>${fmt(f[F.trb])}</td><td>${fmt(f[F.ast])}</td><td><b>${fmt(f[F.pir])}</b></td></tr>`;
  };
  const filaE = x => {
    const e = x.comp === COMP.clave ? T.equipos.find(y => y.pj && ((x.club && y.club === x.club) || y.nombre === x.nombre)) : null;
    if (!e) return `<tr><td class="izq">${botonFavorita(x)} ${enlaceIr(x.comp, x.t, `#/equipo/${x.eid}`, esc(x.nombre))}<div class="muy-tenue">${esc(cortoDe(x.comp))}</div></td><td colspan="5" class="muy-tenue">Elige ${esc(cortoDe(x.comp))} para ver su temporada</td></tr>`;
    const clas = IDX.clasificacion.find(y => y.id === e.id);
    const p = [...T.partidos].reverse().find(y => y.local === e.id || y.visitante === e.id);
    const ultimo = p ? ` · <a href="#/partido/${p.id}">J${p.jornada}: ${esc(eq(p.local).nombre)} ${p.puntos[0]}-${p.puntos[1]} ${esc(eq(p.visitante).nombre)}</a>` : '';
    return `<tr><td class="izq">${botonFavorita(x)} ${linkEq(e.id)}<div class="muy-tenue">${clas ? clas.pos + '.º' : ''}${ultimo}</div></td><td>${e.pj}</td><td colspan="2">${e.pg}-${e.pj - e.pg}</td><td>${signo(e.net, 1)}</td><td><b>${fmt(e.elo, 0)}</b></td></tr>`;
  };
  const js = lista.filter(x => x.tipo === 'j'), es = lista.filter(x => x.tipo === 'e');
  return `<div class="tarjeta seccion"><h2>Tus favoritas</h2>
    ${js.length ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">Jugadora · última temporada</th><th>PJ</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Val</th></tr></thead><tbody>${js.map(filaJ).join('')}</tbody></table></div>` : ''}
    ${es.length ? `<div class="tabla-scroll"${js.length ? ' style="margin-top:1rem"' : ''}><table><thead><tr><th class="izq">Equipo</th><th>PJ</th><th colspan="2">V-D</th><th>Neto</th><th>Elo</th></tr></thead><tbody>${es.map(filaE).join('')}</tbody></table></div>` : ''}
    <p class="muy-tenue">Pulsa ☆ en la ficha de una jugadora o de un equipo para añadirla. Se guardan en este navegador.</p></div>`;
}

// ---------------------------------------------------------------- temporada a temporada (liga y clubes)
const CIFRAS_LIGA = [['ortg', 'Puntos por 100 posesiones'], ['ritmo', 'Ritmo (posesiones por 40 min)'], ['ppg', 'Puntos por partido'],
  ['p3r', '% de tiros que son triples'], ['p3', '% de triple'], ['ts', 'Tiro real (TS%)'], ['efg', 'Tiro efectivo (eFG%)'],
  ['tov', 'Pérdidas por posesión (%)'], ['orb', '% de rebote ofensivo'], ['ftr', 'Tiros libres por tiro'], ['ast', '% de canastas asistidas'],
  ['edad', 'Edad media (por minutos)'], ['altura', 'Altura media (por minutos)'], ['extranjeras', '% de minutos de extranjeras'],
  ['formacion', '% de minutos de jugadoras de formación'], ['local', '% de victorias del local'], ['margen', 'Diferencia media de los partidos'],
  ['igualados', '% de partidos de 5 puntos o menos']];
// columnas de INDICE.clubes[club]: [temporada, id, nombre, V, PJ, neto, ORtg, DRtg, ritmo, %T3I, TS%, edad, altura, %extranjeras, Elo]
const CIFRAS_CLUB = [['wpct', '% de victorias', x => pct(x[3], x[4]), null], ['net', 'Neto (por 100 posesiones)', x => x[5], null],
  ['ortg', 'Rating ofensivo', x => x[6], 'ortg'], ['drtg', 'Rating defensivo (menos es mejor)', x => x[7], 'ortg'], ['ritmo', 'Ritmo', x => x[8], 'ritmo'],
  ['p3r', '% de tiros que son triples', x => x[9], 'p3r'], ['ts', 'Tiro real (TS%)', x => x[10], 'ts'], ['edad', 'Edad media', x => x[11], 'edad'],
  ['altura', 'Altura media', x => x[12], 'altura'], ['extranjeras', '% de minutos de extranjeras', x => x[13], 'extranjeras'], ['elo', 'Elo al acabar', x => x[14], null]];

VISTAS.temporadas = club => {
  const st = VISTAS.temporadas.st || (VISTAS.temporadas.st = {cifra: 'ortg', cifraClub: 'net'});
  const res = [...(INDICE.resumen_liga || [])].sort((a, b) => a.t - b.t);
  const clubes = Object.entries(INDICE.clubes || {}).filter(([, x]) => x.length >= 2).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  club = club || '';
  despues(() => {
    alPulsar('tt-cifra', v => { st.cifra = v; pintar(); });
    alPulsar('tt-cifra-club', v => { st.cifraClub = v; pintar(); });
    alCambiar('tt-club', v => { location.hash = v ? `#/temporadas/${encodeURIComponent(v)}` : '#/temporadas'; });
    activarIr();
  });
  if (res.length < 2) return `${subnav(NAV_LIGA, '#/temporadas')}<p class="tenue">Hace falta más de una temporada de ${esc(COMP.corto)} para comparar.</p>`;
  const cl = CIFRAS_LIGA.find(x => x[0] === st.cifra) || CIFRAS_LIGA[0];
  const graficoLiga = lineas([{nombre: cl[1], color: 'var(--serie-1)', valores: res.map(x => x[cl[0]])}], res.map(x => x.nombre), {titulo: cl[1]});
  let bloqueClub = '';
  if (club && INDICE.clubes && INDICE.clubes[club]) {
    const hc = [...INDICE.clubes[club]].sort((a, b) => a[0] - b[0]);
    const cc = CIFRAS_CLUB.find(x => x[0] === st.cifraClub) || CIFRAS_CLUB[0];
    const serieClub = {nombre: club, color: 'var(--serie-2)', valores: res.map(r => { const x = hc.find(y => y[0] === r.t); return x ? cc[2](x) : null; })};
    const serieLiga = cc[3] ? [{nombre: 'Media de la liga', color: 'var(--texto-3)', valores: res.map(x => x[cc[3]])}] : [];
    bloqueClub = `<div class="tarjeta seccion"><div class="encabezado" style="margin-bottom:.25rem"><h2>${esc(club)}</h2></div>
      <div class="filtros">${pildoras('tt-cifra-club', CIFRAS_CLUB.map(x => [x[0], x[1].split(' (')[0]]), cc[0])}</div>
      <div class="leyenda"><span style="--c:var(--serie-2)">${esc(club)}</span>${serieLiga.length ? '<span style="--c:var(--texto-3)">Media de la liga</span>' : ''}</div>
      ${lineas([serieClub, ...serieLiga], res.map(x => x.nombre), {titulo: cc[1]})}
      <div class="tabla-scroll"><table><thead><tr><th class="izq">Temporada</th><th class="izq">Nombre</th><th>V-D</th><th>Neto</th><th>ORtg</th><th>DRtg</th><th>Ritmo</th><th>T3I/TCI</th><th>TS%</th><th>Edad</th><th>Elo</th></tr></thead><tbody>
      ${hc.slice().reverse().map(x => `<tr><td class="izq">${enlaceIr(COMP.clave, x[0], `#/equipo/${x[1]}`, nombreT(x[0]))}</td><td class="izq">${esc(x[2])}</td><td>${x[3]}-${x[4] - x[3]}</td><td>${signo(x[5], 1)}</td><td>${fmt(x[6])}</td><td>${fmt(x[7])}</td><td>${fmt(x[8])}</td><td>${fmt(x[9])}</td><td>${fmt(x[10])}</td><td>${fmt(x[11])}</td><td>${fmt(x[14], 0)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
  return h`${subnav(NAV_LIGA, '#/temporadas')}<div class="encabezado"><div><h1>Temporada a temporada</h1><p class="tenue">Cómo ha cambiado ${esc(COMP.corto)} de una temporada a otra, y cada club aunque cambie de patrocinador.</p></div></div>
    <div class="tarjeta"><h2>La liga</h2>
      <div class="filtros">${pildoras('tt-cifra', CIFRAS_LIGA, cl[0])}</div>${graficoLiga}
      <div class="tabla-scroll"><table><thead><tr><th class="izq">Temporada</th><th>Partidos</th><th>ORtg</th><th>Ritmo</th><th>Pts</th><th>T3I/TCI</th><th>T3%</th><th>TS%</th><th>Edad</th><th>Altura</th><th title="% de minutos de extranjeras">% extr.</th><th title="% de victorias del equipo local">% local</th><th title="Diferencia media de los partidos">Margen</th></tr></thead><tbody>
      ${res.slice().reverse().map(x => `<tr><td class="izq">${enlaceIr(COMP.clave, x.t, '#/liga', esc(x.nombre))}</td><td>${x.partidos}</td><td>${fmt(x.ortg)}</td><td>${fmt(x.ritmo)}</td><td>${fmt(x.ppg)}</td><td>${fmt(x.p3r)}</td><td>${fmt(x.p3)}</td><td>${fmt(x.ts)}</td><td>${fmt(x.edad)}</td><td>${fmt(x.altura, 0)}</td><td>${fmt(x.extranjeras)}</td><td>${fmt(x.local)}</td><td>${fmt(x.margen)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="muy-tenue">La temporada en curso solo cuenta los partidos jugados hasta hoy.</p></div>
    <div class="tarjeta seccion"><h2>Un club</h2><div class="filtros"><label>Club<select id="tt-club"><option value="">Elige un club</option>
      ${clubes.map(([k, x]) => `<option value="${esc(k)}" ${k === club ? 'selected' : ''}>${esc(k)} (${x.length} temporadas)</option>`).join('')}</select></label></div>
      <p class="muy-tenue" style="margin:0">Por el nombre oficial del club en la FEB, que no cambia con el patrocinador.</p></div>
    ${bloqueClub}`;
};

// historia de un club en esta competición, para la ficha del equipo
function historiaClub(e) {
  const hc = e.club && INDICE.clubes && INDICE.clubes[e.club];
  if (!hc || hc.length < 2) return '';
  despues(activarIr);
  return `<div class="tarjeta seccion"><div class="encabezado" style="margin-bottom:.25rem"><h2>Historia del club en ${esc(COMP.corto)}</h2><a href="#/temporadas/${encodeURIComponent(e.club)}">Temporada a temporada →</a></div>
    <div class="tabla-scroll"><table><thead><tr><th class="izq">Temporada</th><th class="izq">Nombre</th><th>V-D</th><th>%V</th><th>Neto</th><th>Elo</th></tr></thead><tbody>
    ${[...hc].sort((a, b) => b[0] - a[0]).map(x => `<tr${x[0] === T.temporada ? ' class="destacada"' : ''}><td class="izq">${x[0] === T.temporada ? nombreT(x[0]) : enlaceIr(COMP.clave, x[0], `#/equipo/${x[1]}`, nombreT(x[0]))}</td><td class="izq">${esc(x[2])}</td><td>${x[3]}-${x[4] - x[3]}</td><td>${fmt(pct(x[3], x[4]), 0)} %</td><td>${signo(x[5], 1)}</td><td>${fmt(x[14], 0)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

// ---------------------------------------------------------------- lo último, para la portada
// las mejores actuaciones de la última jornada, los récords de la temporada que se han batido en ella y los máximos
// de carrera (en esta competición) que se han hecho en ella
function loUltimo(ultimaJ) {
  const ps = T.partidos.filter(p => p.jornada === ultimaJ);
  if (!ps.length) return '';
  const ids = new Set(ps.map(p => p.id));
  const acts = ps.filter(p => p.caja).flatMap(p => [0, 1].flatMap(i => p.caja[i].map(f => ({f, p, eq: i ? p.visitante : p.local, gs: gameScore(f)}))));
  const top = acts.sort((a, b) => b.gs - a.gs).slice(0, 5);
  const NOMBRES = {pts: 'puntos', trb: 'rebotes', ast: 'asistencias', pir: 'de valoración', p3: 'triples', stl: 'robos', blk: 'tapones'};
  const hitos = [];
  for (const [k, n] of Object.entries(NOMBRES)) {
    const r = (T.records || {})[k];
    if (r && r[0] && ids.has(r[0][1])) hitos.push(`<b>Récord de la temporada:</b> ${linkJu(r[0][0])}, ${fmt(r[0][3], 0)} ${n} (${linkEq(r[0][2])})`);
  }
  for (const a of acts) {
    const m = (INDICE.carrera || {})[a.f[0]];
    if (!m) continue;
    for (const [k, col, minimo] of [['pts', 4, 15], ['trb', 13, 10], ['ast', 14, 7], ['pir', 20, 20]]) {
      if (m[k] && m[k][2] === a.p.id && a.f[col] >= minimo && INDICE.temporadas.length > 1)
        hitos.push(`<b>Máximo de su carrera en ${esc(COMP.corto)}:</b> ${linkJu(a.f[0])}, ${a.f[col]} ${NOMBRES[k]}`);
    }
  }
  return `<div class="tarjeta"><h2>Lo mejor de la jornada ${ultimaJ}</h2>
    <table class="lideres"><tbody>${top.map((a, i) => `<tr><td class="pos">${i + 1}</td><td class="izq">${linkJu(a.f[0])}<div class="muy-tenue">${linkEq(a.eq)} · <a href="#/partido/${a.p.id}">${a.f[4]} pts, ${a.f[13]} reb, ${a.f[14]} ast</a></div></td><td><b>${fmt(a.gs)}</b></td></tr>`).join('')}</tbody></table>
    <p class="muy-tenue" style="margin:.25rem 0 0">Por Game Score.</p>
    ${hitos.length ? `<h3 style="margin-top:1rem">Récords</h3><ul class="hitos">${hitos.slice(0, 8).map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>`;
}
