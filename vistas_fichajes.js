// LF Stats · para fichar y preparar partidos: nivel equivalente en la máxima de cada sección, buscador de perfiles,
// mercado (quién está libre, quién pierde minutos, quién ha cambiado de equipo), informe del rival e impresión.
// Las equivalencias salen de generar.equivalencias (jugadoras que han jugado en dos competiciones).
'use strict';

const NAV_FICHAJES = [['#/perfiles', 'Buscar perfiles'], ['#/mercado', 'Mercado']];

// ---------------------------------------------------------------- equivalencias
const maximaSeccion = () => MAXIMA[GENERO];
// cifras por partido de una fila de JUG.filas en la máxima de su sección, con sus mismos minutos
function equivalenteFila(f) {
  const q = EQUIV[f[F.c]];
  if (!q) return null;
  const x = k => f[F[k]] == null || q[k] == null ? null : f[F[k]] * q[k];
  return {pts: x('pts'), trb: x('trb'), ast: x('ast'), pir: x('pir')};
}
const valEq = f => { const e = equivalenteFila(f); return e ? e.pir : null; };

// en la ficha de una jugadora: lo que harían sus minutos en la máxima y dónde quedaría entre las de allí
function bloqueEquivalencia(j) {
  const max = maximaSeccion(), q = EQUIV[COMP.clave];
  if (!max || !q || COMP.clave === max) return '';
  const m = j.med, x = k => m[k] != null && q[k] != null ? m[k] * q[k] : null;
  let puesto = '';
  if (jugCargadas() && x('pir') != null) {
    // las de la máxima con minutos esa misma temporada (o la última que tenga)
    const filasMax = Object.values(JUG.filas).flatMap(fs => fs.filter(f => f[F.c] === max && f[F.pj] >= 5 && (f[F.min] || 0) >= 10));
    const tMax = filasMax.some(f => f[F.t] === T.temporada) ? T.temporada : Math.max(...filasMax.map(f => f[F.t]));
    const vals = filasMax.filter(f => f[F.t] === tMax).map(f => f[F.pir]).filter(v => v != null);
    if (vals.length >= 20) {
      const mejor = 100 * vals.filter(v => v < x('pir')).length / vals.length;
      puesto = cifra(fmt(mejor, 0) + ' %', `Mejor que ${enGenero('las jugadoras')} de ${esc(cortoDe(max))}`, `Porcentaje de las ${vals.length} jugadoras de ${cortoDe(max)} ${nombreT(tMax)} (con 5 partidos y 10 minutos) que tienen menos valoración que la equivalente de esta`);
    }
  }
  return `<div class="tarjeta seccion"><div class="encabezado"><h2>Su nivel en ${esc(cortoDe(max))}</h2><a href="#/perfiles" class="muy-tenue no-imprimir">Buscar perfiles parecidos →</a></div>
    <div class="cifras">${cifra(fmt(x('pts')), 'Puntos')}${cifra(fmt(x('trb')), 'Rebotes')}${cifra(fmt(x('ast')), 'Asistencias')}${cifra(fmt(x('pir')), 'Valoración')}${puesto}</div>
    <p class="muy-tenue">Lo que serían sus cifras por partido de esta temporada, con sus mismos ${fmt(m.min)} minutos, en ${esc(cortoDe(max))}.
      En ${esc(COMP.corto)}, 10 de valoración equivalen a unos ${fmt(10 * q.pir, 1)} allí (10 puntos, a ${fmt(10 * q.pts, 1)}).
      Sale de ${fmt(q.n, 0)} casos de ${enGenero('jugadoras')} que han jugado en ${esc(COMP.corto)} y en otra competición la misma temporada o la siguiente. Es una estimación de media: no tiene en cuenta el rol, el equipo ni la edad. <a href="#/metodo">Cómo se calcula</a></p></div>`;
}

// ---------------------------------------------------------------- filas de la sección (para perfiles y mercado)
const PUESTOS_EXT = ['Base', 'Escolta'], PUESTOS_INT = ['Ala-pívot', 'Pívot'];
function filasSeccion() {
  if (filasSeccion.de === JUG && filasSeccion.g === GENERO) return filasSeccion.r;
  const r = [];
  for (const [id, fs] of Object.entries(JUG.filas))
    for (const f of fs) if (genero(compDe(f[F.c])) === GENERO) r.push({id, f, eq: valEq(f)});
  filasSeccion.de = JUG; filasSeccion.g = GENERO;
  return (filasSeccion.r = r);
}
const temporadasSeccion = () => [...new Set(filasSeccion().map(x => x.f[F.t]))].sort((a, b) => b - a);
const enlaceFicha = (id, f) => enlaceIr(f[F.c], f[F.t], `#/jugadora/${id}`, esc(nombreDe(id)));
const puestoCorto = p => ({Base: 'B', Escolta: 'E', Alero: 'A', 'Ala-pívot': 'AP', 'Pívot': 'P'}[p] || p || '–');

// ---------------------------------------------------------------- buscador de perfiles
const FILTRO_PERFIL_INICIAL = {t: '', comp: 'senior', puesto: '', edadMin: '', edadMax: '', altMin: '', pjMin: '5', minMin: '15',
  ptsMin: '', trbMin: '', astMin: '', p3Min: '', p3aMin: '', tsMin: '', nac: '', form: ''};
VISTAS.perfiles = () => {
  if (!jugCargadas()) return `${subnav(NAV_FICHAJES, '#/perfiles')}<p class="tenue">Cargando…</p>`;
  const f = {...FILTRO_PERFIL_INICIAL, ...leerJSON('filtro-perfiles', {})};
  const ts = temporadasSeccion();
  const t = ts.includes(Number(f.t)) ? Number(f.t) : ts[0];
  const comps = COMPETICIONES.filter(c => genero(c) === GENERO);
  const num = k => f[k] === '' || f[k] == null ? null : Number(String(f[k]).replace(',', '.'));
  const filas = filasSeccion().filter(({f: x}) => {
    if (x[F.t] !== t) return false;
    if (f.comp === 'senior' ? !NIVEL[x[F.c]] : f.comp !== 'todas' && x[F.c] !== f.comp) return false;
    const p = x[F.puesto];
    if (f.puesto && (f.puesto === 'Exterior' ? !PUESTOS_EXT.includes(p) : f.puesto === 'Interior' ? !PUESTOS_INT.includes(p) : p !== f.puesto)) return false;
    const menor = (v, k) => num(k) != null && (v == null || v < num(k));
    if (menor(x[F.edad], 'edadMin') || (num('edadMax') != null && (x[F.edad] == null || x[F.edad] > num('edadMax')))) return false;
    if (menor(x[F.alt], 'altMin') || menor(x[F.pj], 'pjMin') || menor(x[F.min], 'minMin') || menor(x[F.pts], 'ptsMin')) return false;
    if (menor(x[F.trb], 'trbMin') || menor(x[F.ast], 'astMin') || menor(x[F.p3], 'p3Min') || menor(x[F.p3a], 'p3aMin') || menor(x[F.ts], 'tsMin')) return false;
    if (f.nac === 'nac' && x[F.ext] !== 0) return false;
    if (f.nac === 'ext' && x[F.ext] !== 1) return false;
    if (f.form && x[F.form] !== 1) return false;
    return true;
  });
  despues(() => {
    activarIr(); activarTablas(() => pintar());
    document.querySelectorAll('[data-perfil]').forEach(el => el.addEventListener('change', () => {
      guardarJSON('filtro-perfiles', {...f, [el.dataset.perfil]: el.value});
      pintar();
    }));
    const b = document.getElementById('perfil-limpiar');
    if (b) b.addEventListener('click', () => { guardarJSON('filtro-perfiles', {}); pintar(); });
  });
  const max = maximaSeccion();
  const campo = (k, nombre, ancho = 4, paso = 'any') => `<label>${nombre}<input type="number" inputmode="decimal" step="${paso}" data-perfil="${k}" value="${esc(f[k])}" style="width:${ancho}rem"></label>`;
  const opc = (lista, sel) => lista.map(([v, n]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(n)}</option>`).join('');
  return h`${subnav(NAV_FICHAJES, '#/perfiles')}<div class="encabezado"><div><h1>Buscar perfiles</h1>
      <p class="tenue">Todas las ${enGenero('jugadoras')} de la sección en una temporada, con los filtros que quieras, ordenadas por su valoración equivalente en ${esc(cortoDe(max))}: lo que harían con sus mismos minutos en la máxima.</p></div></div>
    <div class="tarjeta filtros-perfil">
      <label>Temporada<select data-perfil="t">${opc(ts.map(x => [x, nombreT(x)]), t)}</select></label>
      <label>Competición<select data-perfil="comp">${opc([['senior', 'Todas las sénior'], ['todas', 'Todas (también formación)'], ...comps.map(c => [c.clave, c.corto])], f.comp)}</select></label>
      <label>Puesto<select data-perfil="puesto">${opc([['', 'Todos'], ['Base', 'Base'], ['Escolta', 'Escolta'], ['Alero', enGenero('Alera')], ['Ala-pívot', 'Ala-pívot'], ['Pívot', 'Pívot'], ['Exterior', 'Exteriores (B y E)'], ['Interior', 'Interiores (AP y P)']], f.puesto)}</select></label>
      ${campo('edadMin', 'Edad desde', 3.5, 1)}${campo('edadMax', 'hasta', 3.5, 1)}${campo('altMin', 'Altura mín. (cm)', 4.5, 1)}
      ${campo('pjMin', 'Partidos mín.', 3.5, 1)}${campo('minMin', 'Minutos mín.', 3.5)}${campo('ptsMin', 'Puntos mín.', 3.5)}${campo('trbMin', 'Rebotes mín.', 3.5)}${campo('astMin', 'Asist. mín.', 3.5)}
      ${campo('p3Min', '% triple mín.', 3.5)}${campo('p3aMin', 'Triples int. mín.', 3.5)}${campo('tsMin', 'TS% mín.', 3.5)}
      <label>Nacionalidad<select data-perfil="nac">${opc([['', 'Todas'], ['nac', 'Española'], ['ext', 'Extranjera']], f.nac)}</select></label>
      <label>Formación<select data-perfil="form">${opc([['', 'Todas'], ['1', 'Solo de formación nacional']], f.form)}</select></label>
      <button type="button" class="boton" id="perfil-limpiar">Quitar filtros</button></div>
    <div class="tarjeta seccion"><h2>${filas.length} ${filas.length === 1 ? enGenero('jugadora') : enGenero('jugadoras')}</h2>
      ${filas.length ? tabla('perfiles', filas, [
        {t: enGenero('Jugadora'), izq: true, clase: 'nombre', f: x => enlaceFicha(x.id, x.f) + ` <a href="#/carrera/${x.id}" class="muy-tenue" title="Carrera completa">↗</a>`, v: x => nombreDe(x.id)},
        {t: 'Comp.', izq: true, f: x => esc(cortoDe(x.f[F.c])), v: x => NIVEL[x.f[F.c]] || 9},
        {t: 'Equipo', izq: true, f: x => esc(x.f[F.eq]), v: x => x.f[F.eq]},
        {t: 'Pos.', f: x => esc(puestoCorto(x.f[F.puesto])), v: x => x.f[F.puesto]},
        {t: 'Edad', f: x => x.f[F.edad] ?? '–', v: x => x.f[F.edad]}, {t: 'Alt.', f: x => x.f[F.alt] ?? '–', v: x => x.f[F.alt]},
        {t: 'PJ', f: x => x.f[F.pj], v: x => x.f[F.pj]}, {t: 'Min', f: x => fmt(x.f[F.min]), v: x => x.f[F.min]},
        {t: 'Pts', f: x => fmt(x.f[F.pts]), v: x => x.f[F.pts]}, {t: 'Reb', f: x => fmt(x.f[F.trb]), v: x => x.f[F.trb]}, {t: 'Ast', f: x => fmt(x.f[F.ast]), v: x => x.f[F.ast]},
        {t: 'T3%', tip: '% de triple (y triples intentados por partido)', f: x => x.f[F.p3a] ? `${fmt(x.f[F.p3])} <span class="muy-tenue">(${fmt(x.f[F.p3a])})</span>` : '–', v: x => x.f[F.p3a] ? x.f[F.p3] : null},
        {t: 'TS%', f: x => fmt(x.f[F.ts]), v: x => x.f[F.ts]}, {t: 'Uso', tip: 'Uso %: posesiones que acaba ella', f: x => fmt(x.f[F.usg]), v: x => x.f[F.usg]},
        {t: 'Val', f: x => fmt(x.f[F.pir]), v: x => x.f[F.pir]},
        {t: 'Val. eq.', tip: `Valoración equivalente en ${cortoDe(max)}: la suya por el factor de su competición`, f: x => `<b>${fmt(x.eq)}</b>`, v: x => x.eq},
        {t: 'Pts eq.', tip: `Puntos equivalentes en ${cortoDe(max)}`, f: x => fmt(equivalenteFila(x.f)?.pts), v: x => equivalenteFila(x.f)?.pts},
      ], 15, {limite: 300}) : '<p class="tenue">Nadie cumple todos los filtros.</p>'}
      <p class="muy-tenue">${filas.length > 300 ? 'Se ven las 300 primeras según el orden elegido. ' : ''}Cifras por partido. Los filtros se recuerdan en este navegador. Las equivalencias son una estimación de media (<a href="#/metodo">cómo se calculan</a>).</p></div>`;
};

// ---------------------------------------------------------------- mercado
// la fila principal de cada persona en una temporada: la sénior con más minutos
function principalesDe(t) {
  const por = new Map();
  for (const x of filasSeccion()) {
    if (x.f[F.t] !== t || !NIVEL[x.f[F.c]]) continue;
    const a = por.get(x.id), mins = x.f[F.pj] * (x.f[F.min] || 0);
    if (!a || mins > a.f[F.pj] * (a.f[F.min] || 0)) por.set(x.id, x);
  }
  return por;
}
VISTAS.mercado = () => {
  if (!jugCargadas()) return `${subnav(NAV_FICHAJES, '#/mercado')}<p class="tenue">Cargando…</p>`;
  const modo = VISTAS.mercado.modo || 'libres';
  const ts = temporadasSeccion(), t = ts[0], antes = t - 1;
  const ahora = principalesDe(t), pasada = principalesDe(antes);
  const enAlgo = new Set(filasSeccion().filter(x => x.f[F.t] === t).map(x => x.id));     // en cualquier competición, también formación
  despues(() => { activarIr(); activarTablas(() => pintar()); alPulsar('m-modo', v => { VISTAS.mercado.modo = v; pintar(); }); });
  const max = maximaSeccion();
  const base = (x, sufijo = '') => [
    {t: enGenero('Jugadora'), izq: true, clase: 'nombre', f: r => enlaceFicha(r.id, r[x].f) + ` <a href="#/carrera/${r.id}" class="muy-tenue" title="Carrera completa">↗</a>`, v: r => nombreDe(r.id)},
    {t: 'Pos.', f: r => esc(puestoCorto(r[x].f[F.puesto])), v: r => r[x].f[F.puesto]},
    {t: 'Edad', f: r => r[x].f[F.edad] != null ? r[x].f[F.edad] + (sufijo ? 1 : 0) : '–', v: r => r[x].f[F.edad]},
    {t: 'Alt.', f: r => r[x].f[F.alt] ?? '–', v: r => r[x].f[F.alt]}];
  let filas, columnas, orden, texto;
  if (modo === 'libres') {
    filas = [...pasada.values()].filter(x => !enAlgo.has(x.id) && x.f[F.pj] >= 5 && (x.f[F.min] || 0) >= 10).map(x => ({id: x.id, a: x}));
    columnas = [...base('a', '+1'),
      {t: `Dónde jugó (${nombreT(antes)})`, izq: true, f: r => `${esc(cortoDe(r.a.f[F.c]))} · ${esc(r.a.f[F.eq])}`, v: r => NIVEL[r.a.f[F.c]]},
      {t: 'PJ', f: r => r.a.f[F.pj], v: r => r.a.f[F.pj]}, {t: 'Min', f: r => fmt(r.a.f[F.min]), v: r => r.a.f[F.min]},
      {t: 'Pts', f: r => fmt(r.a.f[F.pts]), v: r => r.a.f[F.pts]}, {t: 'Val', f: r => fmt(r.a.f[F.pir]), v: r => r.a.f[F.pir]},
      {t: 'Val. eq.', tip: `Valoración equivalente en ${cortoDe(max)}`, f: r => `<b>${fmt(r.a.eq)}</b>`, v: r => r.a.eq}];
    orden = 9;
    texto = `Jugaron la temporada pasada (${nombreT(antes)}) en una liga sénior, con al menos 5 partidos y 10 minutos, y esta temporada no aparecen en ninguna competición de la web. Pueden estar sin equipo, lesionadas, retiradas o jugando donde la web no llega (otras ligas, el extranjero).`;
  } else if (modo === 'minutos') {
    filas = [...ahora.values()].filter(x => pasada.has(x.id) && x.f[F.pj] >= 3).map(x => ({id: x.id, b: x, a: pasada.get(x.id)}))
      .filter(r => (r.a.f[F.min] || 0) - (r.b.f[F.min] || 0) >= 6 && r.a.f[F.pj] >= 5);
    columnas = [...base('b'),
      {t: nombreT(antes), izq: true, f: r => `${esc(cortoDe(r.a.f[F.c]))} · ${esc(r.a.f[F.eq])}`, v: r => NIVEL[r.a.f[F.c]]},
      {t: nombreT(t), izq: true, f: r => `${esc(cortoDe(r.b.f[F.c]))} · ${esc(r.b.f[F.eq])}`, v: r => NIVEL[r.b.f[F.c]]},
      {t: 'Min antes', f: r => fmt(r.a.f[F.min]), v: r => r.a.f[F.min]}, {t: 'Min ahora', f: r => fmt(r.b.f[F.min]), v: r => r.b.f[F.min]},
      {t: 'Diferencia', f: r => `<b>${signo((r.b.f[F.min] || 0) - (r.a.f[F.min] || 0), 1)}</b>`, v: r => (r.a.f[F.min] || 0) - (r.b.f[F.min] || 0)},
      {t: 'Val. eq. antes', f: r => fmt(r.a.eq), v: r => r.a.eq}, {t: 'Val. eq. ahora', f: r => fmt(r.b.eq), v: r => r.b.eq}];
    orden = 8;
    texto = `Juegan esta temporada al menos 6 minutos menos por partido que la pasada (en su liga sénior principal, con al menos 3 partidos ahora y 5 antes). Pueden estar buscando más minutos.`;
  } else {
    filas = [...ahora.values()].filter(x => pasada.has(x.id)).map(x => ({id: x.id, b: x, a: pasada.get(x.id)}))
      .filter(r => (r.a.f[F.club] || r.a.f[F.eq]) !== (r.b.f[F.club] || r.b.f[F.eq]) || r.a.f[F.c] !== r.b.f[F.c]);
    const flecha = r => { const d = NIVEL[r.a.f[F.c]] - NIVEL[r.b.f[F.c]]; return d > 0 ? '<span class="v" title="Sube de categoría">▲</span>' : d < 0 ? '<span class="d" title="Baja de categoría">▼</span>' : '<span class="muy-tenue">=</span>'; };
    columnas = [...base('b'),
      {t: `De (${nombreT(antes)})`, izq: true, f: r => `${esc(cortoDe(r.a.f[F.c]))} · ${esc(r.a.f[F.eq])}`, v: r => r.a.f[F.eq]},
      {t: '', f: flecha, v: r => NIVEL[r.a.f[F.c]] - NIVEL[r.b.f[F.c]]},
      {t: `A (${nombreT(t)})`, izq: true, f: r => `${esc(cortoDe(r.b.f[F.c]))} · ${esc(r.b.f[F.eq])}`, v: r => r.b.f[F.eq]},
      {t: 'Val. eq. antes', f: r => fmt(r.a.eq), v: r => r.a.eq}, {t: 'Val. eq. ahora', f: r => `<b>${fmt(r.b.eq)}</b>`, v: r => r.b.eq}];
    orden = 8;
    texto = `Han cambiado de club o de competición de ${nombreT(antes)} a ${nombreT(t)} (ligas sénior). ▲ sube de categoría, ▼ baja.`;
  }
  const jugados = filasSeccion().filter(x => x.f[F.t] === t && NIVEL[x.f[F.c]]).length;
  return h`${subnav(NAV_FICHAJES, '#/mercado')}<div class="encabezado"><div><h1>Mercado</h1>
      <p class="tenue">Temporada ${nombreT(t)} frente a ${nombreT(antes)}, en todas las ligas sénior de la sección. Valoración equivalente: lo que harían con sus minutos en ${esc(cortoDe(max))}.</p></div>
      ${pildoras('m-modo', [['libres', 'Sin equipo esta temporada'], ['minutos', 'Pierden minutos'], ['cambios', 'Han cambiado de equipo']], modo)}</div>
    <div class="tarjeta"><h2>${filas.length} ${filas.length === 1 ? enGenero('jugadora') : enGenero('jugadoras')}</h2><p class="muy-tenue" style="margin-top:-.4rem">${texto}</p>
      ${filas.length ? tabla('mercado-' + modo, filas, columnas, orden, {limite: 300}) : '<p class="tenue">Ninguna.</p>'}
      ${jugados < 200 ? `<p class="aviso">La temporada ${nombreT(t)} acaba de empezar: hay pocas ${enGenero('jugadoras')} con partidos y esta lista cambiará mucho.</p>` : ''}</div>`;
};

// ---------------------------------------------------------------- informe del rival
VISTAS.informe = id => {
  const e = IDX.equipos[id];
  if (!e || !e.pj) return '<p>Ese equipo no tiene partidos en esta temporada.</p>';
  const rango = k => { const m = MEK[k], v = m.v(e); return v == null ? null : 1 + IDX.jugadas.filter(x => m.inv ? m.v(x) < v : m.v(x) > v).length; };
  const clas = IDX.clasificacion.find(x => x.id === id);
  const prox = (T.predicciones || []).find(p => p.local === id || p.visitante === id);
  const ult = [...e.partidos].slice(-5).reverse().map(x => IDX.partidos[x[0]]).filter(Boolean);
  const plantilla = T.jugadoras.filter(j => j.equipos.includes(id) && j.tot.min > 0).sort((a, b) => b.tot.min - a.tot.min);
  const clave = plantilla.slice(0, 8);
  const pb = e.pbp;
  const zonaFav = j => { const z = j.pbp?.tiro?.zonas; if (!z) return '–'; const [n, v] = Object.entries(z).sort((a, b) => b[1][0] - a[1][0])[0]; return `${esc(n)} <span class="muy-tenue">(${fmt(100 * v[0] / j.pbp.tiro.tiros, 0)} %)</span>`; };
  const fila = (k, n) => { const m = MEK[k]; if (!m) return ''; const rg = rango(k); return `<tr title="${esc(m.i || '')}"><td class="izq">${esc(n || m.n)}</td><td><b>${fmt(m.v(e), m.d)}</b></td><td class="tenue">${rg ? rg + '.º' : '–'}</td><td class="muy-tenue">${fmt(T.liga.factores[k.replace('_r', '')], m.d)}</td></tr>`; };
  despues(() => { activarImprimir(); });
  const cuartos = e.cuartos.map((c, i) => ({n: `${i + 1}.º cuarto`, v: c[0] != null ? c[0] - c[1] : null, texto: c[0] != null ? `${fmt(c[0])} - ${fmt(c[1])} (${signo(c[0] - c[1], 1)})` : '–'}));
  const quint = pb ? pb.quintetos.slice(0, 5) : [];
  return h`<a href="#/equipo/${id}" class="muy-tenue no-imprimir">← ${esc(e.nombre)}</a>
    <div class="tarjeta informe" style="margin-top:.5rem"><div class="encabezado" style="margin:0"><div><p class="muy-tenue" style="margin:0">Informe para preparar el partido · ${esc(COMP.corto)} ${esc(T.nombre)}</p>
      <h1 style="margin:.1rem 0 0">${esc(e.nombre)}</h1>${e.entrenador ? `<div class="tenue">Entrenador: ${esc(bonitoJS(e.entrenador.nombre))}</div>` : ''}</div>${botonImprimir()}</div>
      <div class="cifras" style="margin-top:1rem">${cifra(clas ? clas.pos + '.º' : '–', 'Clasificación')}${cifra(`${e.pg}-${e.pj - e.pg}`, 'Victorias-derrotas')}${cifra(racha(e.racha), 'Racha')}
        ${cifra(fmt(e.ortg), `Ataque (${rango('ortg')}.º)`, MEK.ortg.i)}${cifra(fmt(e.drtg), `Defensa (${rango('drtg')}.º)`, MEK.drtg.i)}${cifra(signo(e.net, 1), `Neto (${rango('net')}.º)`)}${cifra(fmt(e.ritmo), `Ritmo (${rango('ritmo')}.º)`, MEK.ritmo.i)}
        ${cifra(signo(e.neto_local, 1), 'Neto en casa')}${cifra(signo(e.neto_fuera, 1), 'Neto fuera')}</div>
      ${prox ? `<p style="margin:.75rem 0 0"><b>Próximo partido:</b> ${esc(prox.fecha || '')} · ${linkEq(prox.local)} - ${linkEq(prox.visitante)} · probabilidad de que gane ${esc(e.nombre)}: <b>${fmt(100 * (prox.local === id ? prox.p_local : 1 - prox.p_local), 0)} %</b></p>` : ''}
      <p class="muy-tenue" style="margin:.5rem 0 0">Últimos partidos: ${ult.map(p => { const l = p.local === id, a = p.puntos[l ? 0 : 1], b = p.puntos[l ? 1 : 0]; return `<a href="#/partido/${p.id}">${a > b ? 'V' : 'D'} ${a}-${b} ${l ? 'vs' : 'en'} ${esc(eq(l ? p.visitante : p.local).nombre)}</a>`; }).join(' · ')}</p></div>
    <div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Cómo ataca</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>Valor</th><th>Puesto</th><th>Liga</th></tr></thead><tbody>
        ${fila('efg')}${fila('ts')}${fila('p3r')}${fila('p3')}${fila('tov')}${fila('orb')}${fila('ftr')}${fila('ast')}</tbody></table></div></div>
      <div class="tarjeta"><h2>Cómo defiende</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">Lo que hacen sus rivales</th><th>Valor</th><th>Puesto</th><th>Liga</th></tr></thead><tbody>
        ${fila('efg_r')}${fila('ts_r')}${fila('p3r_r')}${fila('p3_r')}${fila('tov_r')}${fila('orb_r')}${fila('ftr_r')}${fila('stl')}${fila('blk')}</tbody></table></div>
        <p class="muy-tenue">Puesto entre los ${IDX.jugadas.length} equipos (1.º = el mejor).</p></div></div>
    <div class="tarjeta seccion"><h2>${enGenero('Jugadoras')} clave</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">${enGenero('Jugadora')}</th><th>Pos.</th><th>Edad</th><th>Alt.</th><th>PJ</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>T3</th><th>TS%</th><th>Uso</th><th class="izq">Desde dónde tira más</th></tr></thead><tbody>
      ${clave.map(j => `<tr><td class="izq">${linkJu(j.id)}${j.pbp?.final_apretado?.pts ? ` <span class="muy-tenue" title="Puntos en finales apretados">· ${j.pbp.final_apretado.pts} pts en finales</span>` : ''}</td><td>${esc(puestoCorto(j.puesto))}</td><td>${j.edad ?? '–'}</td><td>${j.altura ?? '–'}</td><td>${j.pj}</td><td>${fmt(j.med.min)}</td><td>${fmt(j.med.pts)}</td><td>${fmt(j.med.trb)}</td><td>${fmt(j.med.ast)}</td>
        <td>${j.tot.p3a ? `${j.tot.p3}/${j.tot.p3a} <span class="muy-tenue">(${fmt(j.av.p3, 0)} %)</span>` : '–'}</td><td>${fmt(j.av.ts)}</td><td>${fmt(j.av.usg)}</td><td class="izq">${zonaFav(j)}</td></tr>`).join('')}
      </tbody></table></div><p class="muy-tenue">Las 8 con más minutos. Uso: porcentaje de las posesiones del equipo que acaba ella cuando está en pista.</p></div>
    ${pb ? `<div class="rejilla-2 seccion">
      <div class="tarjeta"><h2>Quintetos más usados</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">Quinteto</th><th>Min</th><th>Neto</th></tr></thead><tbody>
        ${quint.map(q => `<tr><td class="izq" style="white-space:normal">${q.jugadoras.map(x => linkJu(x, apellido(x))).join(' · ')}</td><td>${fmt(q.min, 0)}</td><td><b>${signo(q.net, 1)}</b></td></tr>`).join('')}</tbody></table></div>
        <p class="muy-tenue">Neto: diferencia de puntos por 100 posesiones con ese quinteto en pista.</p></div>
      <div class="tarjeta"><h2>Cómo empieza y cómo acaba</h2>${barrasH(cuartos, {d: 1})}
        <div class="cifras" style="margin-top:.75rem">${pb.final_apretado ? cifra(signo(pb.final_apretado.net, 1), 'Neto en finales apretados', MEK.ap_net?.i) : ''}
          ${cifra(fmt(pb.parciales.mayor_favor), 'Mayor parcial a favor (media)')}${cifra(fmt(pb.parciales.mayor_contra), 'Mayor parcial en contra (media)')}</div></div></div>
    <div class="tarjeta seccion"><h2>Desde dónde tira y desde dónde le tiran</h2>
      <div class="rejilla-2"><div><h3>${esc(e.nombre)}</h3>${mapaCalorTiro(pb.tiros || [], 'frecuencia', 'Tiros de ' + esc(e.nombre), false)}${tablaZonas(pb.tiro, T.pbp.liga_tiro)}</div>
        <div><h3>Sus rivales</h3>${mapaCalorTiro(pb.tiros_rival || [], 'acierto', 'Tiros de sus rivales', true)}${tablaZonas(pb.tiro_rival, T.pbp.liga_tiro)}</div></div>
      <p class="muy-tenue">Izquierda: más intenso, más tiros. Derecha: azul, sus rivales aciertan menos que la media de la liga desde ahí (buena defensa); rojo, más.</p></div>` : '<p class="tenue seccion">Sin jugada a jugada para esta temporada: faltan quintetos y zonas de tiro.</p>'}
    <p class="muy-tenue seccion">LF Stats · ${esc(COMP.nombre)} ${esc(T.nombre)} · datos hasta ${esc(String(T.actualizado || '').replace('T', ' a las '))}</p>`;
};

// ---------------------------------------------------------------- imprimir o guardar en PDF
const botonImprimir = () => '<button type="button" class="boton no-imprimir" data-imprimir>Imprimir o guardar en PDF</button>';
function activarImprimir() {
  document.querySelectorAll('[data-imprimir]').forEach(b => b.addEventListener('click', () => window.print()));
}
