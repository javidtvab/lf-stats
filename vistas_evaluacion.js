// LF Stats · Evaluación de equipo (#/evaluacion/<equipo>): el informe de autoanálisis («self-scout») de un equipo con la
// temporada actual, como lo hace un cuerpo técnico profesional. Resumen con las conclusiones clave; identidad y tendencia;
// posesiones según cómo empiezan (transición, tras rebote, tras canasta…); tiro por zonas (calidad y acierto); rebote,
// pérdidas, faltas y libres; tramos del partido; cuándo gana y cuándo pierde, contextos y estilos de rival; partido a
// partido; rotación minuto a minuto; quintetos, tríos y parejas con sus cuatro factores; una ficha a fondo de cada
// jugadora de la rotación (titulares primero: por qué juega, cómo anota, su impacto con y sin ella, cuándo juega, con
// quién funciona y cómo sacarle más partido) y recomendaciones. El equipo se busca en cualquier competición.
'use strict';

// ---------------------------------------------------------------- indicadores del equipo frente a la liga
// f: valor del equipo; l: media de la liga; mas: más es mejor; acc: qué hacer si es un punto flojo
const EV_IND = [
  {g: 'Ataque', n: 'Tiro efectivo (eFG%)', f: e => e.ataque && e.ataque.efg, l: () => T.liga.factores.efg, mas: true, u: ' %',
    acc: 'Mejorar la selección de tiro: más tiros cerca del aro y triples liberados, menos media distancia forzada'},
  {g: 'Ataque', n: 'Acierto de dos', f: e => e.ataque && e.ataque.p2, l: () => T.liga.factores.p2, mas: true, u: ' %',
    acc: 'Atacar más el aro y el poste: el tiro de dos no está entrando'},
  {g: 'Ataque', n: 'Acierto en el triple', f: e => e.ataque && e.ataque.p3, l: () => T.liga.factores.p3, mas: true, u: ' %',
    acc: 'Triples solo con pies colocados y tras pase: el acierto está por debajo de la liga'},
  {g: 'Ataque', n: 'Pérdidas por posesión', f: e => e.ataque && e.ataque.tov, l: () => T.liga.factores.tov, mas: false, u: ' %',
    acc: 'Cuidar el balón: menos pases arriesgados y más apoyos ante la presión'},
  {g: 'Ataque', n: 'Rebote ofensivo', f: e => e.ataque && e.ataque.orb, l: () => T.liga.factores.orb, mas: true, u: ' %',
    acc: 'Ir más al rebote ofensivo (al menos dos jugadoras) en los tiros exteriores'},
  {g: 'Ataque', n: 'Tiros libres por tiro', f: e => e.ataque && e.ataque.ftr, l: () => T.liga.factores.ftr, mas: true,
    acc: 'Atacar más el aro para provocar faltas y llegar al bonus antes'},
  {g: 'Ataque', n: 'Acierto en tiros libres', f: e => e.ataque && e.ataque.ft, l: () => T.liga.factores.ft, mas: true, u: ' %',
    acc: 'Practicar tiros libres en situación de cansancio: se escapan puntos fáciles'},
  {g: 'Defensa', n: 'Tiro efectivo del rival', f: e => e.defensa && e.defensa.efg, l: () => T.liga.factores.efg, mas: false, u: ' %',
    acc: 'Defender mejor el tiro: cerrar la zona y llegar a tiempo a los tiradores'},
  {g: 'Defensa', n: 'Acierto de dos del rival', f: e => e.defensa && e.defensa.p2, l: () => T.liga.factores.p2, mas: false, u: ' %',
    acc: 'Proteger la zona: ayudas antes y cerrar las penetraciones'},
  {g: 'Defensa', n: 'Acierto en el triple del rival', f: e => e.defensa && e.defensa.p3, l: () => T.liga.factores.p3, mas: false, u: ' %',
    acc: 'Salir más fuerte al tirador y evitar las ayudas largas que dejan triples liberados'},
  {g: 'Defensa', n: 'Pérdidas que provoca', f: e => e.defensa && e.defensa.tov, l: () => T.liga.factores.tov, mas: true, u: ' %',
    acc: 'Más presión al balón y a las líneas de pase: provoca pocas pérdidas'},
  {g: 'Defensa', n: 'Rebote ofensivo del rival', f: e => e.defensa && e.defensa.orb, l: () => T.liga.factores.orb, mas: false, u: ' %',
    acc: 'Cerrar el rebote defensivo: cajas y rebotear las cinco'},
  {g: 'Defensa', n: 'Tiros libres que concede', f: e => e.defensa && e.defensa.ftr, l: () => T.liga.factores.ftr, mas: false,
    acc: 'Defender sin faltas: menos manos y mejores posiciones de ayuda'},
];
const EV_SITU = [
  {k: 'contra', n: 'Puntos al contraataque', acc: 'Correr más tras robo o rebote defensivo', accD: 'Balance defensivo: volver rápido tras tiro o pérdida'},
  {k: 'segunda', n: 'Puntos de segunda oportunidad', acc: 'Ir más al rebote ofensivo', accD: 'Cerrar el rebote: le hacen muchos puntos tras rebote ofensivo'},
  {k: 'perdida', n: 'Puntos tras pérdida del rival', acc: 'Aprovechar más los robos: atacar rápido', accD: 'Cuidar el balón: sus pérdidas acaban en canasta rival'},
  {k: 'inicio', n: 'Puntos en los 5 primeros minutos', acc: 'Salir más enchufados desde el salto inicial', accD: 'Arrancar con la defensa activada: encaja mucho al empezar'},
  {k: 'descanso', n: 'Puntos en los 5 minutos tras el descanso', acc: 'Volver del descanso con un plan claro de ataque', accD: 'Cuidado a la vuelta del descanso: es cuando se le escapan los partidos'},
];
// cómo empieza una posesión (pbp_temporada.py: origen)
const EV_ORIGEN = {robo: 'Tras robo', rebote: 'Tras rebote defensivo', canasta: 'Tras canasta del rival', perdida: 'Tras pérdida del rival (sin robo)', otro: 'Otras (saques, faltas…)'};

function evIndicadores(e) {
  const filas = EV_IND.map(x => {
    const v = x.f(e), l = x.l(), sd = ppDesv(x.f);
    const z = v == null || l == null || !sd ? null : (x.mas ? 1 : -1) * (v - l) / sd;
    return {...x, v, l, z, r: ppRango(e, x.f, x.mas === false)};
  });
  if (e.pbp && e.pbp.situaciones) EV_SITU.forEach(x => [0, 1].forEach(lado => {
    const f = q => q.pbp && q.pbp.situaciones ? q.pbp.situaciones[x.k][lado] : null;
    const v = f(e), l = ppLigaSitu(q => q[x.k][lado]), sd = ppDesv(f), mas = lado === 0;
    filas.push({g: lado ? 'Defensa' : 'Ataque', n: lado ? x.n.replace('Puntos', 'Puntos encajados') : x.n, v, l, mas, sit: true,
      z: v == null || l == null || !sd ? null : (mas ? 1 : -1) * (v - l) / sd, r: ppRango(e, f, !mas), acc: lado ? x.accD : x.acc});
  }));
  if (e.pbp && e.pbp.tiro && T.pbp) T.pbp.zonas.forEach(z => [['tiro', true], ['tiro_rival', false]].forEach(([k, mas]) => {
    const [n, a] = (e.pbp[k].zonas[z] || [0, 0]), l = T.pbp.liga_tiro[z][2];
    if (n < 25) return;
    const pct = 100 * a / n, sdP = Math.sqrt(l * (100 - l) / n);
    filas.push({g: mas ? 'Ataque' : 'Defensa', n: `${mas ? 'Acierto' : 'Acierto del rival'} desde ${z.toLowerCase()}`, v: pct, l, mas, u: ' %', zona: true, tiros: n,
      z: (mas ? 1 : -1) * (pct - l) / Math.max(sdP, 4), r: null,
      acc: mas ? 'Elegir mejor esos tiros o cambiarlos por otros más rentables' : 'Defender mejor esa zona: cerrar las penetraciones y llegar antes con las ayudas'});
  }));
  return filas;
}

// ---------------------------------------------------------------- utilidades
const evPct = (a, b) => b ? 100 * a / b : null;
const evColor = z => z == null ? 'var(--texto-3)' : z >= 0.5 ? 'var(--gana)' : z <= -0.5 ? 'var(--rojo)' : 'var(--texto-3)';
const evJuicio = z => z == null ? '–' : z >= 1 ? 'Muy bien' : z >= 0.5 ? 'Bien' : z <= -1 ? 'Muy mal' : z <= -0.5 ? 'Mal' : 'Normal';
const evDif = (a, b, d = 1) => a == null || b == null ? '–' : signo(a - b, d);
const evNombres = l => l.map(x => linkJu(x, apellido(x))).join(' · ');
const evMin = j => j && j.pbp && j.pbp.rot_min && j.pbp.turnos ? j.pbp.rot_min.map(s => s / 60 / Math.max(1, j.pbp.turnos.pj)) : null;

// los rangos de minutos en los que una jugadora suele estar en pista (probabilidad ≥ umbral), en texto
function evTramos(p, umbral) {
  const r = [];
  let ini = null;
  p.forEach((v, m) => { if (v >= umbral && ini == null) ini = m; if ((v < umbral || m === p.length - 1) && ini != null) { r.push([ini, v >= umbral ? m + 1 : m]); ini = null; } });
  return r.filter(([a, b]) => b - a >= 2).map(([a, b]) => `${a}-${b}`).join(', ');
}

// los equipos de la liga: media y desviación de un valor de origen de posesión
function evLigaOrigen(o, lado, k) {
  const vs = IDX.jugadas.map(q => {
    const x = q.pbp && q.pbp.origen && q.pbp.origen[lado];
    if (!x) return null;
    const tot = Object.values(x).reduce((s, v) => s + v[0], 0);
    return k === 'frec' ? evPct(x[o][0], tot) : x[o][0] >= 10 ? x[o][1] / x[o][0] : null;
  }).filter(v => v != null);
  if (vs.length < 3) return [null, null];
  const m = media(vs);
  return [m, Math.sqrt(media(vs.map(v => (v - m) ** 2))) || null];
}

// ---------------------------------------------------------------- jugadoras: rol, percentiles y razones
const EV_JUG = [
  {k: 'ts', n: 'Tiro real (TS%)', t: 'Muy eficiente en el tiro', m: 'Poco eficiente en el tiro', min: j => j.tot.fga >= 40, u: ' %'},
  {k: 'p3_est', n: 'Triple (estabilizado)', t: 'Buena tiradora de triple', m: 'Poco acierto en el triple', min: j => j.tot.p3a >= 20, u: ' %'},
  {k: 'ft_est', n: 'Tiros libres (estabilizado)', t: 'Segura en los libres', m: 'Falla libres', min: j => j.tot.fta >= 15, u: ' %'},
  {k: 'usg', n: 'Uso', t: 'Asume mucho peso en ataque', m: null, u: ' %'},
  {k: 'ast_pct', n: 'Asistencias (Ast%)', t: 'Generadora de juego', m: null, u: ' %'},
  {k: 'tov_pct', n: 'Pérdidas (Pér%)', t: 'Cuida mucho el balón', m: 'Pierde muchos balones', inv: true, min: j => (j.av.usg || 0) >= 14, u: ' %'},
  {k: 'orb_pct', n: 'Rebote ofensivo (RO%)', t: 'Reboteadora ofensiva', m: null, u: ' %'},
  {k: 'drb_pct', n: 'Rebote defensivo (RD%)', t: 'Domina el rebote defensivo', m: 'Rebotea poco en defensa', min: j => ppPos(j) >= 4, u: ' %'},
  {k: 'stl_pct', n: 'Robos (Rob%)', t: 'Roba muchos balones', m: null, u: ' %'},
  {k: 'blk_pct', n: 'Tapones', t: 'Tapona mucho para su puesto', m: null, u: ' %'},
  {k: 'ftr', n: 'Tiros libres por tiro', t: 'Provoca muchas faltas', m: null, d: 2},
  {k: 'dbpm', n: 'Defensa (DBPM)', t: 'Aporta mucho en defensa', m: 'Flojea en defensa'},
  {k: 'obpm', n: 'Ataque (OBPM)', t: 'Aporta mucho en ataque', m: 'Aporta poco en ataque'},
];

function evRol(j) {
  const av = j.av || {}, pos = ppPos(j);
  if ((av.usg || 0) >= 24 && (av.pts_share || 0) >= 18) return 'Referente en ataque';
  if ((av.ast_pct || 0) >= 25) return 'Directora de juego';
  if (pos >= 4 && ((av.trb_pct || 0) >= 15 || (av.blk_pct || 0) >= 3)) return 'Interior de rebote y zona';
  if ((av.p3r || 0) >= 50 && (j.tot.p3a || 0) >= 20) return 'Tiradora';
  if ((av.dbpm || 0) >= 1.5 && (av.usg || 0) < 17) return 'Especialista defensiva';
  if ((av.usg || 0) >= 20) return 'Anotadora';
  return pos >= 4 ? 'Interior de rotación' : 'Exterior de rotación';
}

function evBase(j, base) {
  const g = base.filter(x => x.grupo && x.grupo === j.grupo);
  return g.length >= 15 ? {lista: g, nombre: 'su puesto en la liga', puesto: String(j.grupo).toLowerCase()} : {lista: base, nombre: 'la liga', puesto: null};
}

function evPercentiles(j, base) {
  const b = evBase(j, base);
  return {grupo: b.nombre, puesto: b.puesto, filas: EV_JUG.map(m => {
    const def = MJK[m.k];
    if (!def || (m.min && !m.min(j))) return null;
    const v = def.v(j);
    if (v == null) return null;
    return {...m, v, d: m.d ?? def.d, p: percentil(v, b.lista.map(def.v).filter(w => w != null), m.inv || def.inv)};
  }).filter(x => x && x.p != null)};
}

// ---------------------------------------------------------------- contextos y estilos de rival
function evContextos(e) {
  const ps = (e.partidos || []).filter(x => x[6]);
  const neto = l => { const pos = l.reduce((s, x) => s + x[6], 0); return pos ? 100 * l.reduce((s, x) => s + x[4] - x[5], 0) / pos : null; };
  const fila = (n, l) => l.length >= 2 ? {n, pj: l.length, v: l.filter(x => x[4] > x[5]).length, net: neto(l)} : null;
  const mediana = l => { const s = [...l].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const ritmoMed = mediana(ps.map(x => x[6]));
  const fuerza = r => (IDX.equipos[r] && IDX.equipos[r].fuerza) || 0;
  const contextos = [
    fila('En casa', ps.filter(x => x[3])), fila('Fuera', ps.filter(x => !x[3])),
    fila('Contra la mitad de arriba', ps.filter(x => fuerza(x[2]) > 0)), fila('Contra la mitad de abajo', ps.filter(x => fuerza(x[2]) <= 0)),
    fila('Partidos rápidos (más posesiones)', ps.filter(x => x[6] > ritmoMed)), fila('Partidos lentos (menos posesiones)', ps.filter(x => x[6] <= ritmoMed)),
    fila('Primera mitad de la temporada', ps.slice(0, Math.ceil(ps.length / 2))), fila('Segunda mitad de la temporada', ps.slice(Math.ceil(ps.length / 2))),
    fila('Últimos 5 partidos', ps.slice(-5)),
  ].filter(Boolean);
  // estilos de rival: cada rival según su perfil de temporada (por encima o por debajo de la mediana de la liga)
  const rasgo = (n1, n2, f) => {
    const vs = IDX.jugadas.map(f).filter(v => v != null);
    if (vs.length < 4) return [];
    const med = mediana(vs);
    const arriba = ps.filter(x => { const r = IDX.equipos[x[2]]; return r && f(r) != null && f(r) > med; });
    const abajo = ps.filter(x => { const r = IDX.equipos[x[2]]; return r && f(r) != null && f(r) <= med; });
    return [fila(n1, arriba), fila(n2, abajo)].filter(Boolean);
  };
  const estilos = [
    ...rasgo('Rivales que juegan rápido', 'Rivales que juegan lento', r => r.ritmo),
    ...rasgo('Rivales que tiran mucho de tres', 'Rivales que tiran poco de tres', r => r.ataque && r.ataque.p3r),
    ...rasgo('Rivales fuertes en el rebote ofensivo', 'Rivales flojos en el rebote ofensivo', r => r.ataque && r.ataque.orb),
    ...rasgo('Rivales que provocan muchas pérdidas', 'Rivales que provocan pocas pérdidas', r => r.defensa && r.defensa.tov),
    ...rasgo('Rivales con buena defensa', 'Rivales con mala defensa', r => r.drtg != null ? -r.drtg : null),
    ...rasgo('Rivales más altos', 'Rivales más bajos', r => r.altura_media),
  ];
  return {contextos, estilos};
}

// ---------------------------------------------------------------- la vista
VISTAS.evaluacion = id => {
  const ultima = INDICE.temporadas.length ? INDICE.temporadas[0].temporada : T.temporada;
  if (String(T.temporada) !== String(ultima)) {
    despues(() => irA(COMP.clave, ultima, location.hash));
    return '<h1>Evaluación de equipo</h1><p class="tenue">Cargando la temporada actual…</p>';
  }
  const mio = leerJSON('mi-equipo', null);
  if (!id && mio && mio.c && mio.c !== COMP.clave && COMPETICIONES.some(c => c.clave === mio.c)) {
    despues(() => irA(mio.c, undefined, `#/evaluacion/${mio.eid || ''}`));
    return '<h1>Evaluación de equipo</h1><p class="tenue">Cargando la competición de tu equipo…</p>';
  }
  const jugado = x => IDX.equipos[x] && IDX.equipos[x].pj ? IDX.equipos[x] : null;
  const e = jugado(id) || (!id && mio && mio.c === COMP.clave ? jugado(mio.eid) : null);
  const deAqui = q => ({n: q.nombre, c: COMP.clave, t: T.temporada, eid: q.id, k: normal(q.nombre), det: `${COMP.corto} ${T.nombre}`});
  const fuente = q => q.length < 2 ? ppBuscar(IDX.jugadas.map(deAqui), '', 60) : ppBuscar(jugCargadas() ? ppEquiposActuales() : IDX.jugadas.map(deAqui), q);
  despues(() => {
    ppActivarBuscar('ev-eq', fuente, x => { x.c === COMP.clave ? location.hash = `#/evaluacion/${x.eid}` : irA(x.c, x.t, `#/evaluacion/${x.eid}`); });
    activarImprimir();
    document.querySelectorAll('[data-ev-ir]').forEach(b => b.addEventListener('click', () => {
      const d = document.getElementById(b.dataset.evIr);
      if (d) d.scrollIntoView({behavior: 'smooth', block: 'start'});
    }));
  });
  const cabecera = `<div class="encabezado no-imprimir"><div><h1>Evaluación de equipo</h1><p class="tenue">El autoanálisis completo de un equipo con la temporada actual (${esc(COMP.corto)} ${esc(T.nombre)}), como lo prepara un cuerpo técnico: conclusiones, cómo ataca y defiende, rotación, quintetos y una ficha a fondo de cada ${enGenero('jugadora')}.</p></div>${e ? botonImprimir() : ''}</div>
    <div class="filtros no-imprimir pp-elegir"><label><span>Equipo</span>${ppCajaBuscar('ev-eq', e ? e.nombre : '', 'Busca un equipo (cualquier competición)')}</label></div>`;
  if (IDX.jugadas.length < 2) return h`${cabecera}<div class="tarjeta"><p class="tenue">La temporada actual de ${esc(COMP.corto)} aún no tiene partidos jugados.</p></div>`;
  if (!e) return h`${cabecera}<div class="tarjeta"><p>Busca un equipo arriba: escribe parte del nombre y elígelo (sale de cualquier competición, con su temporada actual).</p></div>`;
  return h`${cabecera}${evInforme(e)}`;
};

function evInforme(e) {
  const E = esc(e.nombre), N = IDX.jugadas.length, LG = T.liga, L = LG.factores;
  const base = cualificadas();
  const clas = IDX.clasificacion.find(x => x.id === e.id);
  const rk = k => { const m = MEK[k]; return m ? ppRango(e, m.v, m.inv) : null; };
  const pb = e.pbp, cs = (pb && pb.con_sin) || {};
  const forma = ppForma(e);
  const ind = evIndicadores(e).filter(x => x.z != null);
  const fuertes = ind.filter(x => x.z >= 0.5).sort((a, b) => b.z - a.z).slice(0, 6);
  const flojos = ind.filter(x => x.z <= -0.5).sort((a, b) => a.z - b.z).slice(0, 6);
  const gp = ppGanaPierde(e);
  const {contextos: ctx, estilos} = evContextos(e);
  const pl = ppPlantilla(e);
  const tit = ppTitulares(pl);
  const titIds = new Set(tit.map(x => x.j.id));
  const rot = pl.filter(x => !x.ausente && (x.minRec >= 8 || titIds.has(x.j.id)) && x.j.tot.min >= 40)
    .sort((a, b) => (titIds.has(b.j.id) - titIds.has(a.j.id)) || ppPos(a.j) - ppPos(b.j) || b.minRec - a.minRec);
  const val = (x, d = 1) => `${fmt(x.v, x.d ?? d)}${x.u || ''}`;
  const pos = r => r ? `${r}.º de ${N}` : '';
  const secciones = [];
  const seccion = (idS, titulo, html) => { if (html) secciones.push({id: idS, titulo, html: `<section id="${idS}" class="seccion ev-seccion"><h2 class="ev-titulo">${titulo}</h2>${html}</section>`}); };
  const conclusiones = [];                 // {peso, t}: lo más importante va al resumen
  const rec = [];                          // {peso, t}: recomendaciones

  // ================================================================ 1. identidad
  const ra = rk('ortg'), rd = rk('drtg'), rr = rk('ritmo'), rn = rk('net');
  const nivel = r => r == null ? 'sin datos' : r <= Math.ceil(N * 0.25) ? 'es de los mejores' : r <= Math.ceil(N * 0.5) ? 'está por encima de la media' : r <= Math.ceil(N * 0.75) ? 'está por debajo de la media' : 'es de los peores';
  const estilo = [];
  if (rr != null) estilo.push(rr <= N / 3 ? 'juega rápido (muchas posesiones)' : rr > 2 * N / 3 ? 'juega lento (pocas posesiones)' : 'juega a un ritmo medio');
  const p3r = e.ataque && e.ataque.p3r;
  if (p3r != null && L.p3r != null) estilo.push(p3r >= L.p3r + 4 ? 'tira mucho de tres' : p3r <= L.p3r - 4 ? 'tira poco de tres y juega más por dentro' : 'equilibra triple y juego interior');
  const ast = e.ataque && e.ataque.ast;
  if (ast != null && L.ast != null && Math.abs(ast - L.ast) >= 5) estilo.push(ast > L.ast ? 'mueve mucho el balón (muchas canastas asistidas)' : 'depende mucho del juego individual (pocas canastas asistidas)');
  const tendencia = forma.net != null && e.net != null ? (forma.net - e.net >= 6 ? `Llega en buena racha: ${signo(forma.net, 1)} por 100 posesiones en los últimos ${forma.ps.length} partidos (temporada ${signo(e.net, 1)}).`
    : e.net - forma.net >= 6 ? `Llega a la baja: ${signo(forma.net, 1)} por 100 posesiones en los últimos ${forma.ps.length} partidos (temporada ${signo(e.net, 1)}).` : '') : '';
  conclusiones.push({peso: 10, t: `<b>Nivel:</b> ataque ${pos(ra)} y defensa ${pos(rd)}; neto ${signo(e.net, 1)} por 100 posesiones (${pos(rn)}). ${e.suerte != null && Math.abs(e.suerte) >= 1 ? (e.suerte > 0 ? `Lleva ${fmt(e.suerte, 1)} victorias más de las que dicen sus puntos: algo de suerte en los finales.` : `Lleva ${fmt(-e.suerte, 1)} victorias menos de las que dicen sus puntos: merece más de lo que tiene.`) : ''}`});
  if (tendencia) conclusiones.push({peso: 6, t: `<b>Tendencia:</b> ${tendencia}`});
  const ps = (e.partidos || []).filter(x => x[6]);
  const movil = ps.map((_, i) => { const l = ps.slice(Math.max(0, i - 4), i + 1), p = l.reduce((s, x) => s + x[6], 0); return p ? 100 * l.reduce((s, x) => s + x[4] - x[5], 0) / p : null; });
  const ffBarras = g => ind.filter(x => x.g === g && !x.zona && !x.sit).map(x => ({n: esc(x.n), v: x.z, texto: `${val(x)} · ${x.r ? x.r + '.º' : ''}`, color: evColor(x.z),
    tip: `<b>${esc(x.n)}</b><br>${val(x)} (liga ${fmt(x.l, x.d ?? 1)}${x.u || ''})<br>Puesto ${x.r || '–'} de ${N}`}));
  seccion('ev-identidad', '1. Identidad y nivel', `<div class="tarjeta">
    <p><b>${E}</b> ${clas ? `va ${clas.pos}.º con ${e.pg}-${e.pj - e.pg}` : `lleva ${e.pg}-${e.pj - e.pg}`}. Su ataque ${nivel(ra)} (${pos(ra)}, ${fmt(e.ortg)} puntos por 100 posesiones) y su defensa ${nivel(rd)} (${pos(rd)}, encaja ${fmt(e.drtg)}). Neto: ${signo(e.net, 1)} (${pos(rn)}).</p>
    ${estilo.length ? `<p>Estilo: ${estilo.join(', ')}.</p>` : ''}${tendencia ? `<p>${tendencia}</p>` : ''}
    <div class="cifras">${cifra(fmt(e.ortg), `Ataque (${ra || '–'}.º)`, MEK.ortg.i)}${cifra(fmt(e.drtg), `Defensa (${rd || '–'}.º)`, MEK.drtg.i)}${cifra(signo(e.net, 1), `Neto (${rn || '–'}.º)`)}
      ${cifra(fmt(e.ritmo), `Ritmo (${rr || '–'}.º)`, MEK.ritmo.i)}${e.adj_ortg != null ? cifra(fmt(e.adj_ortg), 'Ataque ajustado al rival', MEK.adj_ortg.i) : ''}${e.adj_drtg != null ? cifra(fmt(e.adj_drtg), 'Defensa ajustada al rival', MEK.adj_drtg.i) : ''}
      ${cifra(fmt(e.pitag), 'Victorias esperadas', MEK.pitag.i)}${cifra(signo(e.suerte, 1), 'Suerte', MEK.suerte.i)}${cifra(signo(e.sos, 1), 'Calendario', MEK.sos && MEK.sos.i)}${cifra(fmt(e.consistencia), 'Irregularidad', MEK.consistencia && MEK.consistencia.i)}</div></div>
    <div class="rejilla-2" style="margin-top:1rem"><div class="tarjeta"><h3>Ataque frente a la liga</h3>${barrasH(ffBarras('Ataque'))}</div>
      <div class="tarjeta"><h3>Defensa frente a la liga</h3>${barrasH(ffBarras('Defensa'))}</div></div>
    <p class="muy-tenue">Barras: cuánto mejor (verde, a la derecha) o peor (rojo) que la media de la liga, en desviaciones (lo que varían los equipos). Al lado, el valor y el puesto entre ${N}.</p>
    ${ps.length >= 4 ? `<div class="tarjeta" style="margin-top:1rem"><h3>Evolución: neto de los últimos 5 partidos, jornada a jornada</h3>${lineas([{nombre: 'Neto (5 partidos)', color: 'var(--serie-1)', valores: movil},
      {nombre: 'Neto del partido', color: 'var(--serie-2)', valores: ps.map(x => 100 * (x[4] - x[5]) / x[6])}], ps.map(x => 'J' + x[1]), {alto: 220, referencia: 0, titulo: 'Neto por partido'})}</div>` : ''}`);

  // ================================================================ 2. puntos fuertes y flojos
  const itemFF = x => `<li><b>${esc(x.n)}</b>: ${val(x)}${x.zona ? ` en ${x.tiros} tiros` : ''} <span class="muy-tenue">(liga ${fmt(x.l, x.d ?? 1)}${x.u || ''}${x.r ? ` · ${x.r}.º de ${N}` : ''})</span></li>`;
  fuertes.slice(0, 2).forEach((x, i) => conclusiones.push({peso: 8 - i, t: `<b>Fortaleza:</b> ${esc(x.n.toLowerCase())} (${val(x)}, liga ${fmt(x.l, x.d ?? 1)}${x.u || ''}${x.r ? `, ${x.r}.º` : ''}).`}));
  flojos.slice(0, 3).forEach((x, i) => {
    conclusiones.push({peso: 9 - i, t: `<b>Debilidad:</b> ${esc(x.n.toLowerCase())} (${val(x)}, liga ${fmt(x.l, x.d ?? 1)}${x.u || ''}${x.r ? `, ${x.r}.º` : ''}).`});
    rec.push({peso: 10 - i, t: `<b>${esc(x.n)}</b> (${val(x)}, liga ${fmt(x.l, x.d ?? 1)}${x.u || ''}): ${esc(x.acc)}.`});
  });
  seccion('ev-fyf', '2. Puntos fuertes y puntos flojos', `<div class="rejilla-2">
    <div class="tarjeta"><h3>Puntos fuertes</h3>${fuertes.length ? `<ul>${fuertes.map(itemFF).join('')}</ul>` : '<p class="tenue">Nada destaca claramente por encima de la liga.</p>'}</div>
    <div class="tarjeta"><h3>Puntos flojos</h3>${flojos.length ? `<ul>${flojos.map(itemFF).join('')}</ul>` : '<p class="tenue">Nada queda claramente por debajo de la liga.</p>'}</div></div>
    <div class="rejilla-2" style="margin-top:1rem">${['Ataque', 'Defensa'].map(g => `<div class="tarjeta"><h3>${g}, indicador a indicador</h3><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>Valor</th><th>Liga</th><th>Puesto</th><th>Juicio</th></tr></thead><tbody>
      ${ind.filter(x => x.g === g && !x.zona).map(x => `<tr><td class="izq">${esc(x.n)}</td><td><b>${val(x)}</b></td><td class="muy-tenue">${fmt(x.l, x.d ?? 1)}${x.u || ''}</td><td class="tenue">${x.r ? x.r + '.º' : '–'}</td><td style="color:${evColor(x.z)}">${evJuicio(x.z)}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}</div>`);

  // ================================================================ 3. posesiones según cómo empiezan
  const org = pb && pb.origen;
  if (org) {
    const tabla = lado => {
      const x = org[lado], tot = Object.values(x).reduce((s, v) => s + v[0], 0);
      return Object.keys(EV_ORIGEN).map(o => {
        const [n, pts] = x[o] || [0, 0], fr = evPct(n, tot), ppp = n >= 10 ? pts / n : null;
        const [lf] = evLigaOrigen(o, lado, 'frec'), [lp, sdp] = evLigaOrigen(o, lado, 'ppp');
        const z = ppp != null && lp != null && sdp ? (lado ? -1 : 1) * (ppp - lp) / sdp : null;
        return {o, n, fr, ppp, lf, lp, z, pts};
      });
    };
    const ta = tabla(0), td = tabla(1);
    const filaO = r => `<tr><td class="izq">${EV_ORIGEN[r.o]}</td><td>${r.n}</td><td>${fmt(r.fr, 0)} %</td><td class="muy-tenue">${fmt(r.lf, 0)} %</td><td><b>${r.ppp != null ? fmt(r.ppp, 2) : '–'}</b></td><td class="muy-tenue">${r.lp != null ? fmt(r.lp, 2) : '–'}</td><td style="color:${evColor(r.z)}">${evJuicio(r.z)}</td></tr>`;
    const cab = `<thead><tr><th class="izq">Cómo empieza</th><th>Posesiones</th><th>% de las suyas</th><th>Liga</th><th>Puntos por posesión</th><th>Liga</th><th>Juicio</th></tr></thead>`;
    const rob = ta.find(r => r.o === 'robo'), reb = ta.find(r => r.o === 'rebote'), can = ta.find(r => r.o === 'canasta');
    const notas = [];
    if (rob && rob.ppp != null && rob.lp != null && rob.ppp >= rob.lp + 0.1 && rob.fr <= (rob.lf || 0)) { notas.push(`Rentabiliza muy bien los robos (${fmt(rob.ppp, 2)} puntos por posesión), pero roba poco: presionar más le daría puntos fáciles.`); rec.push({peso: 6, t: `<b>Defensa más agresiva en las líneas de pase</b>: tras robo anota ${fmt(rob.ppp, 2)} por posesión (liga ${fmt(rob.lp, 2)}) y solo el ${fmt(rob.fr, 0)} % de sus posesiones empiezan así.`}); }
    if (reb && reb.ppp != null && reb.lp != null && reb.ppp <= reb.lp - 0.08) { notas.push(`Tras rebote defensivo anota poco (${fmt(reb.ppp, 2)}; liga ${fmt(reb.lp, 2)}): no aprovecha para correr.`); rec.push({peso: 5, t: `<b>Salir más rápido tras rebote defensivo</b>: ${fmt(reb.ppp, 2)} puntos por posesión, liga ${fmt(reb.lp, 2)}. Primer pase rápido y carriles abiertos.`}); }
    if (can && can.ppp != null && can.lp != null && can.ppp <= can.lp - 0.08) { notas.push(`Su ataque en estático (tras canasta del rival) es flojo: ${fmt(can.ppp, 2)} por posesión (liga ${fmt(can.lp, 2)}).`); rec.push({peso: 7, t: `<b>Ataque en estático</b>: ${fmt(can.ppp, 2)} puntos por posesión tras canasta del rival (liga ${fmt(can.lp, 2)}). Revisar sistemas y jugadoras que lo generan.`}); }
    const tdCan = td.find(r => r.o === 'canasta'), tdReb = td.find(r => r.o === 'rebote'), tdRob = td.find(r => r.o === 'robo');
    if (tdRob && tdRob.ppp != null && tdRob.lp != null && tdRob.ppp >= tdRob.lp + 0.1) notas.push(`Cuando le roban, lo paga caro: ${fmt(tdRob.ppp, 2)} puntos por posesión del rival (liga ${fmt(tdRob.lp, 2)}). Falla el balance defensivo.`);
    if (tdReb && tdReb.ppp != null && tdReb.lp != null && tdReb.ppp >= tdReb.lp + 0.08) notas.push(`Tras su tiro fallado, el rival le hace ${fmt(tdReb.ppp, 2)} por posesión (liga ${fmt(tdReb.lp, 2)}): volver antes a defender.`);
    if (tdCan && tdCan.ppp != null && tdCan.lp != null) notas.push(`Su defensa en estático (tras su canasta) deja ${fmt(tdCan.ppp, 2)} por posesión (liga ${fmt(tdCan.lp, 2)}): ${tdCan.ppp <= tdCan.lp - 0.05 ? 'buena' : tdCan.ppp >= tdCan.lp + 0.05 ? 'floja' : 'normal'}.`);
    notas.forEach((t, i) => i < 2 && conclusiones.push({peso: 5 - i, t: `<b>Tipo de posesión:</b> ${t}`}));
    const s = pb.situaciones;
    seccion('ev-posesiones', '3. Cómo anota y cómo le anotan: posesiones según cómo empiezan', `<div class="tarjeta">
      ${notas.length ? `<ul>${notas.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
      <h3>En ataque</h3><div class="tabla-scroll"><table>${cab}<tbody>${ta.map(filaO).join('')}</tbody></table></div>
      <h3 style="margin-top:1rem">En defensa (lo que hace el rival)</h3><div class="tabla-scroll"><table>${cab}<tbody>${td.map(filaO).join('')}</tbody></table></div>
      ${s ? `<div class="cifras" style="margin-top:1rem">${cifra(`${fmt(s.contra[0])} / ${fmt(s.contra[1])}`, 'Contraataque: a favor / en contra')}${cifra(`${fmt(s.segunda[0])} / ${fmt(s.segunda[1])}`, 'Segunda oportunidad')}
        ${cifra(`${fmt(s.perdida[0])} / ${fmt(s.perdida[1])}`, 'Tras pérdida')}${cifra(`${s.ato[0] != null ? fmt(s.ato[0], 2) : '–'} / ${s.ato[1] != null ? fmt(s.ato[1], 2) : '–'}`, 'Puntos por posesión tras tiempo muerto (suyo / del rival)')}</div>` : ''}
      <p class="muy-tenue">Cada posesión se clasifica por cómo empieza, siguiendo el jugada a jugada: tras un robo (casi siempre a la carrera), tras rebote defensivo, tras canasta o libre anotado del rival (lo más parecido a un ataque en estático), tras una pérdida del rival sin robo o de otra forma. Los rebotes ofensivos siguen la misma posesión. Contraataque y demás: puntos por partido.</p></div>`);
  }

  // ================================================================ 4. tiro
  if (pb && pb.tiro && T.pbp) {
    const zonasF = (k, lado) => T.pbp.zonas.map(z => {
      const [n, a] = pb[k].zonas[z] || [0, 0], l = T.pbp.liga_tiro[z], v = z.startsWith('Triple') ? 3 : 2;
      const frL = 100 * l[0] / Object.values(T.pbp.liga_tiro).reduce((s, x) => s + x[0], 0);
      return {z, n, a, fr: evPct(n, pb[k].tiros), frL, pct: evPct(a, n), l: l[2], ppt: n ? v * a / n : null, pptL: v * l[2] / 100};
    });
    const za = zonasF('tiro'), zd = zonasF('tiro_rival');
    const filaZ = (r, def) => { const z = r.n >= 15 && r.pct != null ? (def ? -1 : 1) * (r.pct - r.l) / Math.max(4, Math.sqrt(r.l * (100 - r.l) / r.n)) : null;
      return `<tr><td class="izq">${esc(r.z)}</td><td>${r.a}/${r.n}</td><td>${fmt(r.fr, 0)} %</td><td class="muy-tenue">${fmt(r.frL, 0)} %</td><td><b>${fmt(r.pct, 0)} %</b></td><td class="muy-tenue">${fmt(r.l, 0)} %</td><td>${fmt(r.ppt, 2)}</td><td style="color:${evColor(z)}">${evJuicio(z)}</td></tr>`; };
    const cabZ = `<thead><tr><th class="izq">Zona</th><th>Tiros</th><th>% de los tiros</th><th>Liga</th><th>Acierto</th><th>Liga</th><th>Puntos por tiro</th><th>Juicio</th></tr></thead>`;
    const t = pb.tiro, tr = pb.tiro_rival;
    const notasT = [];
    if (t.sobre_esperado != null) notasT.push(t.sobre_esperado >= 2 ? `Mete más de lo que da su selección de tiro (${signo(t.sobre_esperado, 1)} puntos de eFG%): buenas tiradoras, pero puede bajar si se enfría.` : t.sobre_esperado <= -2 ? `Mete menos de lo que da su selección de tiro (${signo(t.sobre_esperado, 1)} de eFG%): los tiros son buenos, entran poco; debería mejorar solo.` : 'Su acierto es el que corresponde a los tiros que elige.');
    if (t.xefg != null && T.pbp.liga_tiro) notasT.push(`Calidad de sus tiros (eFG% esperado por zonas): ${fmt(t.xefg, 1)}. ${t.xefg >= 47 ? 'Busca buenos tiros.' : t.xefg <= 44 ? 'Elige demasiados tiros difíciles (media distancia o triples frontales).' : ''}`);
    if (tr && tr.xefg != null) notasT.push(`Lo que concede: sus rivales tiran con un eFG% esperado de ${fmt(tr.xefg, 1)} y meten ${fmt(tr.efg, 1)} (${signo(tr.sobre_esperado, 1)}).`);
    const media2 = za.find(r => r.z === 'Media distancia');
    if (media2 && media2.fr != null && media2.fr >= media2.frL + 5 && media2.ppt != null && media2.ppt < 0.85) rec.push({peso: 6, t: `<b>Menos media distancia</b>: es el ${fmt(media2.fr, 0)} % de sus tiros (liga ${fmt(media2.frL, 0)} %) y da ${fmt(media2.ppt, 2)} puntos por tiro. Cambiarlos por penetraciones o triples.`});
    const asis = (() => { let tot = 0, a = 0; T.jugadoras.filter(j => j.equipo === e.id && j.pbp && j.pbp.asistidas).forEach(j => { const x = j.pbp.asistidas; tot += x.t2[0] + x.t3[0]; a += x.t2[1] + x.t3[1]; }); return evPct(a, tot); })();
    seccion('ev-tiro', '4. Tiro: desde dónde, con qué calidad y con qué acierto', `<div class="tarjeta">
      ${notasT.length ? `<ul>${notasT.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
      <div class="cifras">${cifra(fmt(t.efg, 1), 'eFG% real')}${cifra(fmt(t.xefg, 1), 'eFG% esperado por sus zonas')}${cifra(signo(t.sobre_esperado, 1), 'Por encima de lo esperado')}${asis != null ? cifra(fmt(asis, 0) + ' %', 'Canastas asistidas') : ''}
        ${tr ? cifra(fmt(tr.efg, 1), 'eFG% del rival') + cifra(fmt(tr.xefg, 1), 'eFG% esperado del rival') : ''}</div>
      <h3 style="margin-top:1rem">Sus tiros por zona</h3><div class="tabla-scroll"><table>${cabZ}<tbody>${za.map(r => filaZ(r, false)).join('')}</tbody></table></div>
      ${tr ? `<h3 style="margin-top:1rem">Los tiros de sus rivales por zona</h3><div class="tabla-scroll"><table>${cabZ}<tbody>${zd.map(r => filaZ(r, true)).join('')}</tbody></table></div>` : ''}
      <div class="rejilla-2" style="margin-top:1rem"><div><h3>Mapa: ${E}</h3>${mapaCalorTiro(pb.tiros || [], 'acierto', 'Tiros de ' + E, false)}</div><div><h3>Mapa: sus rivales</h3>${mapaCalorTiro(pb.tiros_rival || [], 'acierto', 'Tiros de sus rivales', true)}</div></div>
      <p class="muy-tenue">Puntos por tiro: acierto por el valor del tiro (los triples valen 3). eFG% esperado: el que haría un equipo medio de la liga con esos mismos tiros por zonas; la diferencia con el real es acierto (o suerte), no selección.</p></div>`);
  }

  // ================================================================ 5. rebote, pérdidas, faltas y libres
  {
    const a = e.ataque || {}, d = e.defensa || {}, s = pb && pb.situaciones;
    const rbD = d.orb != null ? 100 - d.orb : null, rbDL = L.orb != null ? 100 - L.orb : null;
    const robC = d.stl, perd = a.tov;
    const faltasQ = s && s.faltas ? s.faltas : null;
    const notasR = [];
    if (rbD != null && rbDL != null) notasR.push(`Rebote defensivo: coge el ${fmt(rbD, 1)} % de los rebotes de su aro (liga ${fmt(rbDL, 1)} %). ${rbD < rbDL - 3 ? 'Concede demasiadas segundas oportunidades.' : rbD > rbDL + 3 ? 'Cierra muy bien su rebote.' : ''}`);
    if (a.orb != null) notasR.push(`Rebote ofensivo: ${fmt(a.orb, 1)} % (liga ${fmt(L.orb, 1)} %).`);
    if (perd != null) notasR.push(`Pérdidas: ${fmt(perd, 1)} por cada 100 posesiones (liga ${fmt(L.tov, 1)}). ${robC != null ? `De ellas, ${fmt(robC, 1)} son robos del rival (pérdidas «vivas», que acaban en contraataque) y ${fmt(perd - robC, 1)} «muertas» (pasos, fuera de banda, ataque…).` : ''}`);
    if (faltasQ) { const mx = faltasQ.indexOf(Math.max(...faltasQ)); notasR.push(`Faltas por cuarto: ${faltasQ.map((f, i) => `${i + 1}.º ${fmt(f, 1)}`).join(' · ')}. Más en el ${mx + 1}.º cuarto.${s.bonus ? ` Pone al rival en bonus con 2 minutos o más por jugar en el ${fmt(s.bonus[0], 0)} % de los cuartos (sus rivales, en el ${fmt(s.bonus[1], 0)} %).` : ''}`); }
    if (a.ft != null) notasR.push(`Tiros libres: mete el ${fmt(a.ft, 1)} % (liga ${fmt(L.ft, 1)} %) y saca ${fmt(a.ftr, 1)} libres anotados por cada 100 tiros de campo (liga ${fmt(L.ftr, 1)}).`);
    if (s && s.bonus && s.bonus[0] >= s.bonus[1] + 10) rec.push({peso: 4, t: `<b>Menos faltas tempranas</b>: deja al rival en bonus pronto en el ${fmt(s.bonus[0], 0)} % de los cuartos.`});
    seccion('ev-rebote', '5. Rebote, pérdidas, faltas y tiros libres', `<div class="tarjeta"><ul>${notasR.map(x => `<li>${x}</li>`).join('')}</ul>
      <div class="tabla-scroll"><table><thead><tr><th class="izq">Por 100 posesiones</th>${['Pts', 'Reb', 'RO', 'Ast', 'Rob', 'Tap', 'Pér', 'FC', 'T3', 'T3I', 'TLI'].map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>
      ${[['Equipo', e.p100], ['Rivales', e.p100_rival]].map(([n, x]) => `<tr><td class="izq">${n}</td>${['pts', 'trb', 'orb', 'ast', 'stl', 'blk', 'tov', 'pf', 'p3', 'p3a', 'fta'].map(k => `<td>${fmt(x && x[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`);
  }

  // ================================================================ 6. tramos del partido
  {
    const cuartos = (e.cuartos || []).map((c, i) => ({n: `${i + 1}.º cuarto`, v: c[0] != null ? c[0] - c[1] : null, texto: c[0] != null ? `${fmt(c[0])} - ${fmt(c[1])} (${signo(c[0] - c[1], 1)})` : '–'}));
    const cm = cuartos.filter(c => c.v != null).sort((a, b) => b.v - a.v);
    const s = pb && pb.situaciones, fa = pb && pb.final_apretado, par = pb && pb.parciales;
    const notas = [];
    if (cm.length >= 2) { notas.push(`Su mejor cuarto es el ${cm[0].n} (${signo(cm[0].v, 1)}) y el peor, el ${cm[cm.length - 1].n} (${signo(cm[cm.length - 1].v, 1)}).`);
      if (cm[cm.length - 1].v <= -2) { rec.push({peso: 5, t: `<b>El ${cm[cm.length - 1].n}</b> es su punto débil (${signo(cm[cm.length - 1].v, 1)} de media): revisar la rotación y los ajustes de ese tramo.`}); conclusiones.push({peso: 4, t: `<b>Tramo débil:</b> el ${cm[cm.length - 1].n} (${signo(cm[cm.length - 1].v, 1)} de media).`}); } }
    if (s) notas.push(`Primeros 5 minutos: ${fmt(s.inicio[0])} - ${fmt(s.inicio[1])}. Tras el descanso: ${fmt(s.descanso[0])} - ${fmt(s.descanso[1])}.`);
    if (s && s.tm != null) notas.push(`Tiempos muertos: ${fmt(s.tm[0], 1)} por partido; los pide de media con un parcial en contra de ${fmt(s.tm_parcial, 1)} puntos. Tras ellos anota ${s.ato[0] != null ? fmt(s.ato[0], 2) : '–'} por posesión.`);
    if (fa && fa.min) { notas.push(`Finales apretados (últimos 5 minutos con 5 puntos o menos): ${fa.pf}-${fa.pc} en ${fmt(fa.min, 0)} minutos.`); if (fa.min >= 10) conclusiones.push({peso: 3, t: `<b>Finales apretados:</b> ${fa.pf}-${fa.pc} en ${fmt(fa.min, 0)} minutos (${fa.pf > fa.pc ? 'los gana' : fa.pf < fa.pc ? 'los pierde' : 'igualados'}).`}); }
    if (par) notas.push(`Mayor parcial a favor por partido: ${fmt(par.mayor_favor)} de media; en contra: ${fmt(par.mayor_contra)}. Parciales de 10 o más: ${par.de_10_favor} a favor y ${par.de_10_contra} en contra.`);
    if (s && s.ato[0] != null && s.ato[2] >= 15 && s.ato[0] <= 0.85) rec.push({peso: 4, t: `<b>Jugadas tras tiempo muerto</b>: ${fmt(s.ato[0], 2)} puntos por posesión en ${s.ato[2]} salidas de tiempo muerto. Preparar 2-3 jugadas de pizarra fiables.`});
    seccion('ev-tramos', '6. Por tramos del partido', `<div class="rejilla-2"><div class="tarjeta"><h3>Por cuartos (media de puntos)</h3>${barrasH(cuartos, {d: 1})}</div>
      <div class="tarjeta"><ul>${notas.map(x => `<li>${x}</li>`).join('')}</ul></div></div>`);
  }

  // ================================================================ 7. cuándo gana, contextos y estilos de rival
  {
    const difs = gp.filas.filter(f => f.k && f.v != null && f.d != null && f.inv !== null).map(f => {
      const fuente = f.n.includes('rival') || f.n.includes('del rival') ? 'defensa' : 'ataque';
      const sd = ppDesv(q => q[fuente] && q[fuente][f.k]);
      return {...f, z: sd ? (f.inv ? -1 : 1) * (f.v - f.d) / sd : null};
    }).filter(f => f.z != null).sort((a, b) => b.z - a.z);
    const clave = difs.slice(0, 2);
    if (clave.length && gp.nv && gp.nd) conclusiones.push({peso: 7, t: `<b>Dónde se le deciden los partidos:</b> ${clave.map(f => `${f.n.toLowerCase()} (${fmt(f.v)} cuando gana, ${fmt(f.d)} cuando pierde)`).join(' y ')}.`});
    const ctxOrd = ctx.filter(c => c.net != null && !/Últimos|mitad de la temporada/.test(c.n)).sort((a, b) => b.net - a.net);
    const estOrd = estilos.filter(c => c.net != null).sort((a, b) => b.net - a.net);
    if (estOrd.length >= 2) conclusiones.push({peso: 5, t: `<b>Rivales:</b> rinde mejor contra ${estOrd[0].n.toLowerCase()} (${signo(estOrd[0].net, 1)}) y peor contra ${estOrd[estOrd.length - 1].n.toLowerCase()} (${signo(estOrd[estOrd.length - 1].net, 1)}).`});
    const tablaC = l => `<div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>PJ</th><th>V-D</th><th>Neto</th></tr></thead><tbody>
      ${l.map(c => `<tr><td class="izq">${esc(c.n)}</td><td>${c.pj}</td><td>${c.v}-${c.pj - c.v}</td><td style="color:${c.net >= 5 ? 'var(--gana)' : c.net <= -5 ? 'var(--rojo)' : 'inherit'}"><b>${signo(c.net, 1)}</b></td></tr>`).join('')}</tbody></table></div>`;
    seccion('ev-gana', '7. Cuándo gana y cuándo pierde', `${gp.nv && gp.nd ? `<div class="tarjeta">
      ${clave.length ? `<p>La mayor diferencia entre sus victorias y sus derrotas está en <b>${clave.map(f => f.n.toLowerCase()).join('</b> y <b>')}</b>.</p>` : ''}
      <div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>En sus ${gp.nv} victorias</th><th>En sus ${gp.nd} derrotas</th><th>Diferencia</th></tr></thead><tbody>
      ${gp.filas.map(f => `<tr><td class="izq">${esc(f.n)}</td><td>${fmt(f.v)}</td><td>${fmt(f.d)}</td><td>${evDif(f.v, f.d)}</td></tr>`).join('')}</tbody></table></div></div>` : '<p class="tenue">Necesita al menos una victoria y una derrota para comparar.</p>'}
      <div class="rejilla-2" style="margin-top:1rem"><div class="tarjeta"><h3>Contextos</h3>${ctxOrd.length >= 2 ? `<p>Mejor: <b>${esc(ctxOrd[0].n.toLowerCase())}</b> (${signo(ctxOrd[0].net, 1)}). Peor: <b>${esc(ctxOrd[ctxOrd.length - 1].n.toLowerCase())}</b> (${signo(ctxOrd[ctxOrd.length - 1].net, 1)}).</p>` : ''}${tablaC(ctx)}</div>
        <div class="tarjeta"><h3>Contra qué estilos de rival</h3>${estilos.length ? tablaC(estilos) : '<p class="tenue">Pocos partidos.</p>'}
        <p class="muy-tenue">Cada rival se clasifica por su temporada (por encima o por debajo de la mitad de la liga). Neto por 100 posesiones en esos partidos.</p></div></div>`);
  }

  // ================================================================ 8. partido a partido
  {
    const filas = (e.partidos || []).map(x => {
      const p = IDX.partidos[x[0]], l = p ? (p.local === e.id ? 0 : 1) : 0, f = p && p.factores ? p.factores[l] : null, r = p && p.factores ? p.factores[1 - l] : null;
      return {x, p, f, r, net: x[6] ? 100 * (x[4] - x[5]) / x[6] : null};
    }).reverse();
    seccion('ev-partidos', '8. Partido a partido', `<div class="tarjeta"><div class="tabla-scroll"><table><thead><tr><th>J</th><th class="izq">Rival</th><th></th><th>Resultado</th><th>Posesiones</th><th>Neto</th><th>eFG%</th><th>Pérd.</th><th>RO%</th><th>TL</th><th>eFG% rival</th><th>Pérd. rival</th><th>RO% rival</th></tr></thead><tbody>
      ${filas.map(({x, p, f, r, net}) => `<tr><td>${x[1]}</td><td class="izq">${x[3] ? 'vs' : 'en'} ${linkEq(x[2])}</td><td>${p ? `<a href="#/partido/${p.id}" class="${x[4] > x[5] ? 'v' : 'd'}">${x[4] > x[5] ? 'V' : 'D'}</a>` : ''}</td><td>${x[4]}-${x[5]}</td><td>${fmt(x[6], 0)}</td><td><b>${signo(net, 1)}</b></td>
        <td>${fmt(f && f.efg)}</td><td>${fmt(f && f.tov)}</td><td>${fmt(f && f.orb)}</td><td>${fmt(f && f.ftr)}</td><td>${fmt(r && r.efg)}</td><td>${fmt(r && r.tov)}</td><td>${fmt(r && r.orb)}</td></tr>`).join('')}</tbody></table></div>
      <p class="muy-tenue">Los cuatro factores de cada partido (TL: libres anotados por cada 100 tiros de campo). Del más reciente al más antiguo.</p></div>`);
  }

  // ================================================================ 9. rotación
  const conMin = pl.filter(x => !x.ausente && x.minRec >= 10).length;
  {
    const orden = [...rot].sort((a, b) => b.j.tot.min - a.j.tot.min);
    const conMapa = orden.filter(x => evMin(x.j));
    // en tramos de 2 minutos (20 columnas: cabe en pantalla)
    const dos = p => Array.from({length: 20}, (_, k) => (p[2 * k] + p[2 * k + 1]) / 2);
    const mapa = conMapa.length ? mapaCalor(conMapa.map(x => linkJu(x.j.id, apellido(x.j.id))), Array.from({length: 20}, (_, k) => k % 5 === 0 ? `${2 * k}'` : ''),
      conMapa.map(x => dos(evMin(x.j)).map((p, k) => ({v: p, texto: p >= 0.5 ? fmt(100 * p, 0) : '', tip: `<b>${esc(x.j.nombre)}</b><br>Minutos ${2 * k}-${2 * k + 2}: en pista el ${fmt(100 * p, 0)} % del tiempo`}))),
      {nota: 'Cuánto está en pista cada jugadora en cada tramo de 2 minutos del partido (media de sus partidos; más oscuro, más; el número es el % si pasa del 50). Los cuartos empiezan en los minutos 0, 10, 20 y 30.'}) : '';
    const cierre = orden.map(x => { const p = evMin(x.j); return p ? {x, v: media(p.slice(35, 40))} : null; }).filter(Boolean).sort((a, b) => b.v - a.v).slice(0, 5);
    const ban = e.banquillo || {}, titu = e.titulares || {};
    const minTot = pl.reduce((s, x) => s + x.j.tot.min, 0), top5 = [...pl].sort((a, b) => b.j.tot.min - a.j.tot.min).slice(0, 5).reduce((s, x) => s + x.j.tot.min, 0);
    const notas = [];
    notas.push(conMin <= 7 ? `Rotación corta: ${conMin} ${enGenero('jugadoras')} con 10 minutos o más. Ojo al cansancio y a las faltas.` : conMin >= 10 ? `Rotación larga: ${conMin} ${enGenero('jugadoras')} con 10 minutos o más.` : `Rotación de ${conMin} ${enGenero('jugadoras')} con 10 minutos o más.`);
    if (cierre.length) notas.push(`Quién cierra los partidos (más tiempo en pista en los 5 últimos minutos): ${cierre.map(c => `${linkJu(c.x.j.id, apellido(c.x.j.id))} (${fmt(100 * c.v, 0)} %)`).join(', ')}.`);
    if ((e.max_anotadora || 0) >= 25) notas.push(`Depende mucho de su máxima anotadora: ${fmt(e.max_anotadora, 0)} % de los puntos.`);
    if (ban.pm != null && titu.pm != null) notas.push(`Titulares ${signo(titu.pm, 1)} y banquillo ${signo(ban.pm, 1)} de +/- por partido; el banquillo aporta el ${fmt(ban.pct_pts, 0)} % de los puntos.`);
    if (conMin <= 7) rec.push({peso: 3, t: '<b>Abrir la rotación</b>: con tan pocas jugadoras, una lesión o problemas de faltas pesan mucho.'});
    seccion('ev-rotacion', '9. Rotación: quién juega, cuándo y cuánto', `<div class="tarjeta"><ul>${notas.map(x => `<li>${x}</li>`).join('')}</ul>${mapa}
      <div class="tabla-scroll" style="margin-top:1rem"><table><thead><tr><th class="izq">${enGenero('Jugadora')}</th><th>Tit/PJ</th><th>Min (últ. 5)</th><th>1.º</th><th>2.º</th><th>3.º</th><th>4.º</th><th>Turnos por partido</th><th>Turno medio</th><th>Turno más largo</th><th>+/- 1.º</th><th>2.º</th><th>3.º</th><th>4.º</th></tr></thead><tbody>
      ${orden.map(x => { const j = x.j, p = j.pbp || {}, mc = p.min_cuarto || [], pm = p.pm_cuarto || [], tu = p.turnos, n = Math.max(1, j.pj);
        return `<tr><td class="izq">${linkJu(j.id)}</td><td>${j.tit}/${j.pj}</td><td>${fmt(x.minRec, 0)}</td>${[0, 1, 2, 3].map(q => `<td>${mc[q] != null ? fmt(mc[q] / n, 1) : '–'}</td>`).join('')}
          <td>${tu ? fmt(tu.n / Math.max(1, tu.pj), 1) : '–'}</td><td>${tu ? fmt(tu.media, 1) + ' min' : '–'}</td><td>${tu ? fmt(tu.largo, 1) + ' min' : '–'}</td>${[0, 1, 2, 3].map(q => `<td>${pm[q] != null ? signo(pm[q] / n, 1) : '–'}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>
      <p class="muy-tenue">Minutos por cuarto y +/- por cuarto: media por partido jugado. Un turno es el tiempo seguido en pista sin sentarse (los cuartos lo cortan).</p>
      <div class="cifras" style="margin-top:.75rem">${cifra(fmt(minTot ? 100 * top5 / minTot : null, 0) + ' %', 'Minutos de las 5 que más juegan')}${cifra(fmt(e.max_anotadora, 0) + ' %', 'Puntos de la máxima anotadora')}${cifra(fmt(ban.pct_pts, 0) + ' %', 'Puntos del banquillo')}${cifra(signo(ban.pm, 1), '+/- del banquillo')}${cifra(signo(titu.pm, 1), '+/- de las titulares')}</div></div>`);
  }

  // ================================================================ 10. quintetos, tríos y parejas
  const qs = pb ? pb.quintetos || [] : [], parejas = pb ? pb.parejas || [] : [], trios = pb ? pb.trios || [] : [];
  const qMin = Math.max(15, 0.03 * (e.pj * 40));
  const qOk = qs.filter(q => q.min >= qMin && q.net != null);
  const mejoresQ = qOk.filter(q => q.net > 0).sort((a, b) => b.net - a.net).slice(0, 4), peoresQ = qOk.filter(q => q.net < 0).sort((a, b) => a.net - b.net).slice(0, 4);
  if (pb) {
    const cabQ = n => `<thead><tr><th class="izq">${n}</th><th>Min</th><th>Ataque</th><th>Defensa</th><th>Neto</th><th>eFG%</th><th>Pérd.</th><th>RO%</th><th>eFG% rival</th><th>Pérd. rival</th><th>RO% rival</th></tr></thead>`;
    const filaQ = q => `<tr><td class="izq" style="white-space:normal">${evNombres(q.jugadoras)}</td><td>${fmt(q.min, 0)}</td><td>${fmt(q.ortg)}</td><td>${fmt(q.drtg)}</td><td><b style="color:${q.net >= 5 ? 'var(--gana)' : q.net <= -5 ? 'var(--rojo)' : 'inherit'}">${signo(q.net, 1)}</b></td>
      <td>${fmt(q.ff && q.ff.efg)}</td><td>${fmt(q.ff && q.ff.tov)}</td><td>${fmt(q.ff && q.ff.orb)}</td><td>${fmt(q.ff_r && q.ff_r.efg)}</td><td>${fmt(q.ff_r && q.ff_r.tov)}</td><td>${fmt(q.ff_r && q.ff_r.orb)}</td></tr>`;
    const tablaQ = (n, l) => l.length ? `<div class="tabla-scroll"><table>${cabQ(n)}<tbody>${l.map(filaQ).join('')}</tbody></table></div>` : '<p class="tenue">–</p>';
    const tqMin = 25, tOk = trios.filter(t => t.min >= tqMin && t.net != null), pMin = Math.max(40, 0.08 * (e.pj * 40)), pOk = parejas.filter(p => p.min >= pMin && p.net != null);
    const titQ = qs.find(q => tit.length === 5 && tit.every(x => q.jugadoras.includes(x.j.id)));
    const usado = qs[0];
    const notas = [];
    if (titQ) notas.push(`El quinteto titular habitual (${evNombres(titQ.jugadoras)}) ha jugado ${fmt(titQ.min, 0)} minutos juntas con un neto de ${signo(titQ.net, 1)} (ataque ${fmt(titQ.ortg)}, defensa ${fmt(titQ.drtg)}).`);
    else if (tit.length) notas.push(`Su quinteto titular habitual (${tit.map(x => linkJu(x.j.id, apellido(x.j.id))).join(' · ')}) apenas coincide en pista: el más usado es ${usado ? evNombres(usado.jugadoras) : '–'}.`);
    if (pb.n_quintetos) notas.push(`Ha usado ${pb.n_quintetos} quintetos distintos; los 5 más usados suman el ${fmt(evPct(qs.slice(0, 5).reduce((s, q) => s + q.min, 0), e.pj * 40), 0)} % de los minutos.`);
    if (mejoresQ[0] && usado && mejoresQ[0] !== usado && mejoresQ[0].net >= (usado.net ?? 0) + 8) rec.push({peso: 6, t: `<b>Dar más minutos a</b> ${evNombres(mejoresQ[0].jugadoras)}: ${signo(mejoresQ[0].net, 1)} en ${fmt(mejoresQ[0].min, 0)} min, mejor que el quinteto más usado (${signo(usado.net, 1)}).`});
    if (peoresQ[0] && peoresQ[0].net <= -10) { rec.push({peso: 6, t: `<b>Evitar</b> ${evNombres(peoresQ[0].jugadoras)}: ${signo(peoresQ[0].net, 1)} en ${fmt(peoresQ[0].min, 0)} min.`}); conclusiones.push({peso: 4, t: `<b>Quinteto que no funciona:</b> ${evNombres(peoresQ[0].jugadoras)} (${signo(peoresQ[0].net, 1)} en ${fmt(peoresQ[0].min, 0)} min).`}); }
    if (mejoresQ[0]) conclusiones.push({peso: 4, t: `<b>Mejor quinteto:</b> ${evNombres(mejoresQ[0].jugadoras)} (${signo(mejoresQ[0].net, 1)} en ${fmt(mejoresQ[0].min, 0)} min).`});
    // matriz de parejas de las 8 que más juegan
    const top = [...rot].sort((a, b) => b.j.tot.min - a.j.tot.min).slice(0, 8).map(x => x.j.id);
    const parDe = (a, b) => parejas.find(p => p.jugadoras.includes(a) && p.jugadoras.includes(b));
    const matriz = top.length >= 4 ? mapaCalor(top.map(x => linkJu(x, apellido(x))), top.map(x => esc(apellido(x))), top.map(a => top.map(b => {
      if (a === b) return null; const p = parDe(a, b); if (!p || p.net == null) return {v: 0, texto: '·', tip: 'Menos de 40 minutos juntas'};
      return {v: Math.max(0, Math.min(1, 0.5 + p.net / 40)), texto: signo(p.net, 0), tip: `<b>${esc(apellido(a))} + ${esc(apellido(b))}</b><br>${fmt(p.min, 0)} min juntas · neto ${signo(p.net, 1)}`};
    })), {nota: 'Neto por 100 posesiones de cada pareja cuando están juntas en pista (más oscuro, mejor). Solo parejas con 40 minutos o más.'}) : '';
    seccion('ev-quintetos', '10. Quintetos, tríos y parejas', `<div class="tarjeta"><ul>${notas.map(x => `<li>${x}</li>`).join('')}</ul>
      <h3>Los más usados</h3>${tablaQ('Quinteto', qs.slice(0, 6))}
      <div class="rejilla-2" style="margin-top:1rem"><div><h3>Mejores (mín. ${fmt(qMin, 0)} min)</h3>${tablaQ('Quinteto', mejoresQ)}</div><div><h3>Peores (mín. ${fmt(qMin, 0)} min)</h3>${tablaQ('Quinteto', peoresQ)}</div></div>
      ${tOk.length >= 4 ? `<div class="rejilla-2" style="margin-top:1rem"><div><h3>Tríos que mejor funcionan (mín. ${tqMin} min)</h3>${tablaQ('Trío', [...tOk].sort((a, b) => b.net - a.net).slice(0, 6))}</div><div><h3>Tríos que peor funcionan</h3>${tablaQ('Trío', [...tOk].sort((a, b) => a.net - b.net).slice(0, 6))}</div></div>` : ''}
      ${pOk.length >= 4 ? `<div class="rejilla-2" style="margin-top:1rem"><div><h3>Parejas que mejor funcionan (mín. ${fmt(pMin, 0)} min)</h3>${tablaQ('Pareja', [...pOk].sort((a, b) => b.net - a.net).slice(0, 6))}</div><div><h3>Parejas que peor funcionan</h3>${tablaQ('Pareja', [...pOk].sort((a, b) => a.net - b.net).slice(0, 6))}</div></div>` : ''}
      ${matriz ? `<h3 style="margin-top:1rem">Quién funciona con quién</h3>${matriz}` : ''}
      <p class="muy-tenue">Ataque y defensa: puntos anotados y encajados por 100 posesiones con ese grupo en pista. Sus cuatro factores y los del rival, con ese grupo en pista. Con pocos minutos las cifras bailan mucho: confírmalo con el vídeo.</p></div>`);
  } else seccion('ev-quintetos', '10. Quintetos, tríos y parejas', '<p class="tenue">Sin jugada a jugada en esta competición: no hay datos de quintetos ni parejas.</p>');

  // ================================================================ 11. la plantilla de un vistazo
  const fichas = rot.map(x => evFicha(x, e, base, cs, parejas, qs, titIds.has(x.j.id), rot));
  {
    const filas = rot.map(x => { const j = x.j, c = cs[j.id]; return `<tr><td class="izq">${linkJu(j.id)}${titIds.has(j.id) ? ' <span class="etiqueta">titular</span>' : ''}</td><td class="izq">${esc(evRol(j))}</td><td>${fmt(x.minRec, 0)}</td><td>${fmt(j.med.pts)}</td><td>${fmt(j.med.trb)}</td><td>${fmt(j.med.ast)}</td>
      <td>${fmt(j.av.ts, 0)}</td><td>${fmt(j.av.usg, 0)}</td><td>${fmt(j.av.ast_pct, 0)}</td><td>${fmt(j.av.tov_pct, 0)}</td><td>${fmt(j.av.trb_pct, 0)}</td><td>${signo(j.av.bpm, 1)}</td><td>${c && c.dif != null && c.con.min >= 60 ? signo(c.dif, 1) : '–'}</td></tr>`; }).join('');
    seccion('ev-plantilla', '11. La plantilla de un vistazo', `<div class="tarjeta"><div class="tabla-scroll"><table><thead><tr><th class="izq">${enGenero('Jugadora')}</th><th class="izq">Rol</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>TS%</th><th>Uso</th><th>Ast%</th><th>Pér%</th><th>Reb%</th><th>BPM</th><th>Con/sin</th></tr></thead><tbody>${filas}</tbody></table></div>
      <p class="muy-tenue">Min: media de los últimos cinco partidos. Ast%: canastas de sus compañeras que asiste con ella en pista. Pér%: pérdidas por cada 100 jugadas suyas. Reb%: rebotes que coge de los disponibles. BPM: aportación por 100 posesiones frente a una ${enGenero('jugadora')} media. Con/sin: diferencia del neto del equipo con ella en pista y sin ella.</p></div>`);
  }

  // ================================================================ 12. fichas
  fichas.forEach(f => f.rec.forEach(r => rec.push(r)));
  seccion('ev-fichas', `12. ${enGenero('Jugadora')} a ${enGenero('jugadora')} (titulares primero)`, fichas.map(f => f.html).join(''));

  // ================================================================ 13. recomendaciones y resumen
  const recOrd = rec.sort((a, b) => b.peso - a.peso).slice(0, 14);
  seccion('ev-recomendaciones', '13. Recomendaciones', `<div class="tarjeta">${recOrd.length ? `<ol>${recOrd.map(r => `<li>${r.t}</li>`).join('')}</ol>` : '<p class="tenue">No hay nada que destaque claramente para corregir.</p>'}
    <p class="muy-tenue">Ordenadas por lo que pesan. Salen de las cifras de la temporada: confírmalas con el vídeo y con lo que ves en los entrenamientos.</p></div>`);
  const resumen = `<section id="ev-resumen" class="seccion ev-seccion"><h2 class="ev-titulo">Resumen: las conclusiones clave</h2><div class="tarjeta"><ol>${conclusiones.sort((a, b) => b.peso - a.peso).slice(0, 10).map(c => `<li>${c.t}</li>`).join('')}</ol>
    ${recOrd.length ? `<p><b>Lo primero que haría:</b> ${recOrd.slice(0, 3).map(r => r.t).join(' · ')}</p>` : ''}</div></section>`;
  const indice = `<nav class="tarjeta no-imprimir ev-indice seccion"><b>Índice:</b> ${[{id: 'ev-resumen', titulo: 'Resumen'}, ...secciones].map(s => `<button type="button" class="enlace" data-ev-ir="${s.id}">${esc(s.titulo.replace(/^\d+\.\s*/, ''))}</button>`).join(' · ')}</nav>`;
  return `<div class="tarjeta informe" style="margin-top:.5rem"><p class="muy-tenue" style="margin:0">Evaluación de equipo · ${esc(COMP.corto)} ${esc(T.nombre)} · ${e.pj} partidos</p>
      <h1 style="margin:.1rem 0 0"><a href="#/equipo/${e.id}">${E}</a></h1>${e.entrenador ? `<div class="tenue">Entrenador: ${esc(bonitoJS(e.entrenador.nombre))}</div>` : ''}</div>
    ${indice}${resumen}${secciones.map(s => s.html).join('')}
    <p class="muy-tenue seccion">LF Stats · ${esc(COMP.nombre)} ${esc(T.nombre)} · datos hasta ${esc(String(T.actualizado || '').replace('T', ' a las '))}. Lo que sale del jugada a jugada (posesiones, quintetos, con y sin, rotación por minuto) cuenta solo los partidos con jugada a jugada.</p>`;
}

// ---------------------------------------------------------------- la ficha a fondo de una jugadora
function evFicha(x, e, base, cs, parejas, qs, esTitular, rot) {
  const j = x.j, av = j.av || {}, p40 = j.p40 || {}, pb = j.pbp || {}, nom = esc(j.nombre), ape = esc(apellido(j.id));
  const c = cs[j.id], conOk = c && c.con.min >= 60 && c.sin.min >= 30;
  const perc = evPercentiles(j, base);
  const top = perc.filas.filter(f => f.p >= 80).sort((a, b) => b.p - a.p), bajo = perc.filas.filter(f => f.p <= 20 && f.m).sort((a, b) => a.p - b.p);
  const equipo = rot.map(y => y.j);
  const rangoEq = (f, inv) => 1 + equipo.filter(y => { const a = f(y), b = f(j); return a != null && b != null && (inv ? a < b : a > b); }).length;
  const rec = [];
  // ---- por qué juega
  const razones = [], dudas = [];
  if (esTitular) razones.push(`Titular en ${j.tit} de ${j.pj} partidos; ${fmt(x.minRec, 0)} minutos de media en los últimos cinco.`);
  else razones.push(`Sale desde el banquillo (${j.tit} titularidades en ${j.pj} partidos); ${fmt(x.minRec, 0)} minutos de media en los últimos cinco.`);
  if (conOk && c.dif >= 5) razones.push(`El equipo es <b>${signo(c.dif, 1)}</b> mejor por 100 posesiones con ella en pista (${signo(c.con.net, 1)} con ella, ${signo(c.sin.net, 1)} sin ella).`);
  if (conOk && c.dif <= -5) dudas.push(`El equipo es ${signo(c.dif, 1)} peor con ella en pista (${signo(c.con.net, 1)} con ella, ${signo(c.sin.net, 1)} sin ella).`);
  if (av.bpm != null && rangoEq(y => y.av.bpm) <= 3) razones.push(`Una de las tres que más aportan del equipo por BPM (${signo(av.bpm, 1)}, ${rangoEq(y => y.av.bpm)}.ª).`);
  const rolEq = [[y => y.av.ast_pct, 'la que más genera para las demás', 'Ast%'], [y => y.av.drb_pct, 'la mejor reboteadora defensiva', 'RD%'], [y => y.av.orb_pct, 'la mejor reboteadora ofensiva', 'RO%'],
    [y => y.av.stl_pct, 'la que más balones roba', 'Rob%'], [y => y.av.blk_pct, 'la que más tapona', 'Tap%'], [y => y.tot.p3a >= 15 ? y.av.p3_est : null, 'la mejor tiradora de triple', 'T3%'],
    [y => y.av.usg, 'la que más tiros y jugadas acaba', 'Uso'], [y => y.tot.fga >= 30 ? y.av.ts : null, 'la más eficiente en el tiro', 'TS%']];
  rolEq.forEach(([f, t]) => { if (f(j) != null && rangoEq(f) === 1) razones.push(`Es ${t} del equipo.`); });
  const minus = t => t.charAt(0).toLowerCase() + t.slice(1);
  top.slice(0, 3).forEach(f => razones.push(`${f.t}: ${fmt(f.v, f.d ?? 1)}${f.u || ''} en ${minus(f.n)} (mejor que el ${f.p} % de ${perc.grupo}).`));
  bajo.slice(0, 3).forEach(f => dudas.push(`${f.m}: ${fmt(f.v, f.d ?? 1)}${f.u || ''} en ${minus(f.n)} (peor que el ${100 - f.p} % de ${perc.grupo}).`));
  if ((p40.pf || 0) >= 4.8) dudas.push(`Se carga de faltas: ${fmt(p40.pf, 1)} por 40 minutos.`);
  // ---- cómo anota
  const t = pb.tiro, zonas = t && T.pbp ? T.pbp.zonas.map(z => {
    const [n, a] = t.zonas[z] || [0, 0], l = T.pbp.liga_tiro[z][2];
    const frG = media(base.filter(y => y.grupo === j.grupo && y.pbp && y.pbp.tiro && y.pbp.tiro.tiros >= 30).map(y => 100 * ((y.pbp.tiro.zonas[z] || [0])[0]) / y.pbp.tiro.tiros));
    return {z, n, a, fr: evPct(n, t.tiros), frG, pct: evPct(a, n), l, ppt: n ? (z.startsWith('Triple') ? 3 : 2) * a / n : null};
  }) : [];
  const situ = pb.situ, pts = j.tot.pts || 0;
  const origenPts = situ && pts ? [['al contraataque', situ.contra], ['de segunda oportunidad', situ.segunda], ['tras pérdida del rival', situ.perdida], ['tras tiempo muerto', situ.ato]] : [];
  const asis = pb.asistidas;
  const anota = [];
  if (t && t.tiros >= 20) {
    const fav = [...zonas].sort((a, b) => b.n - a.n)[0];
    anota.push(`Tira sobre todo desde ${fav.z.toLowerCase()} (${fmt(fav.fr, 0)} % de sus tiros${fav.frG != null ? `; su puesto en la liga, ${fmt(fav.frG, 0)} %` : ''}). Distancia media: ${fmt(pb.distancia, 1)} m.`);
    anota.push(`eFG% ${fmt(t.efg, 1)} con unos tiros que valen ${fmt(t.xefg, 1)} (${signo(t.sobre_esperado, 1)}): ${t.sobre_esperado >= 3 ? 'mete más de lo esperado' : t.sobre_esperado <= -3 ? 'mete menos de lo esperado' : 'mete lo esperado'} por sus zonas.`);
    zonas.filter(z => z.n >= 15 && z.pct != null && z.pct >= z.l + 8).slice(0, 2).forEach(z => { anota.push(`Muy eficaz desde ${z.z.toLowerCase()}: ${z.a}/${z.n} (${fmt(z.pct, 0)} %, liga ${fmt(z.l, 0)} %).`);
      if (z.frG != null && z.fr < z.frG) rec.push({peso: 3, t: `<b>${linkJu(j.id)}</b>: buscarle más tiros desde ${z.z.toLowerCase()} (${fmt(z.pct, 0)} % de acierto y solo el ${fmt(z.fr, 0)} % de sus tiros).`}); });
    zonas.filter(z => z.n >= 20 && z.pct != null && z.pct <= z.l - 8).slice(0, 2).forEach(z => { anota.push(`Floja desde ${z.z.toLowerCase()}: ${z.a}/${z.n} (${fmt(z.pct, 0)} %, liga ${fmt(z.l, 0)} %).`);
      if (z.fr >= 20) rec.push({peso: 3, t: `<b>${linkJu(j.id)}</b>: reducir sus tiros desde ${z.z.toLowerCase()} (${fmt(z.fr, 0)} % de sus tiros con un ${fmt(z.pct, 0)} % de acierto).`}); });
  }
  if (asis && asis.pct != null && asis.t2[0] + asis.t3[0] >= 10) anota.push(`${fmt(asis.pct, 0)} % de sus canastas vienen de asistencia: ${asis.pct >= 70 ? 'necesita que se la generen (tiradora o finalizadora)' : asis.pct <= 40 ? 'se fabrica su propio tiro' : 'mezcla tiros creados y tiros tras pase'}.`);
  if (origenPts.length) { const txt = origenPts.filter(([, v]) => v).map(([n, v]) => `${v} ${n} (${fmt(evPct(v, pts), 0)} %)`); if (txt.length) anota.push(`De sus ${pts} puntos: ${txt.join(', ')}.`); }
  if (av.ftr != null && j.tot.fta >= 10) anota.push(`Tiros libres: ${j.tot.ft}/${j.tot.fta} (${fmt(av.ft, 0)} %), ${fmt(p40.fta, 1)} intentos por 40 minutos.`);
  if (av.ftr != null && (av.ftr >= 40) && (av.ft || 0) >= 75) rec.push({peso: 2, t: `<b>${linkJu(j.id)}</b>: que ataque más el aro; provoca muchas faltas (${fmt(p40.fta, 1)} libres por 40 min) y los mete (${fmt(av.ft, 0)} %).`});
  // ---- impacto con y sin
  const imp = conOk && c.con.ff && c.sin.ff ? [
    ['Neto', c.con.net, c.sin.net, true, 1], ['Puntos anotados por 100 posesiones', c.con.ortg, c.sin.ortg, true, 1], ['Puntos encajados por 100 posesiones', c.con.drtg, c.sin.drtg, false, 1],
    ['Tiro efectivo del equipo', c.con.ff.efg, c.sin.ff.efg, true], ['Pérdidas del equipo', c.con.ff.tov, c.sin.ff.tov, false], ['Rebote ofensivo del equipo', c.con.ff.orb, c.sin.ff.orb, true],
    ['Libres por tiro del equipo', c.con.ff.ftr, c.sin.ff.ftr, true], ['Canastas asistidas del equipo', c.con.ff.ast, c.sin.ff.ast, null],
    ['Tiro efectivo del rival', c.con.ff_r.efg, c.sin.ff_r.efg, false], ['Pérdidas que provoca el equipo', c.con.ff_r.tov, c.sin.ff_r.tov, true], ['Rebote ofensivo del rival', c.con.ff_r.orb, c.sin.ff_r.orb, false],
  ] : null;
  const impTxt = [];
  if (imp) {
    const grandes = imp.slice(3).filter(r => r[3] !== null && r[1] != null && r[2] != null).map(r => ({n: r[0], d: (r[3] ? 1 : -1) * (r[1] - r[2]), c: r[1], s: r[2]})).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).filter(r => Math.abs(r.d) >= 3).slice(0, 3);
    grandes.forEach(r => impTxt.push(`${r.d > 0 ? 'Mejora' : 'Empeora'} ${r.n.toLowerCase()}: ${fmt(r.c, 1)} con ella, ${fmt(r.s, 1)} sin ella.`));
  }
  // ---- cuándo juega
  const pmin = evMin(j), mc = pb.min_cuarto || [], pmq = pb.pm_cuarto || [], tu = pb.turnos, n = Math.max(1, j.pj);
  const cuando = [];
  if (pmin) {
    const sale = [0, 10, 20, 30].filter(m => pmin[m] >= 0.6).map(m => `${m / 10 + 1}.º`);
    if (sale.length === 4) cuando.push('Suele empezar en pista los cuatro cuartos.');
    else if (sale.length) cuando.push(`Suele empezar en pista el ${sale.length > 1 ? sale.slice(0, -1).join(', el ') + ' y el ' + sale.slice(-1) : sale[0]} cuarto.`);
    const fin = media(pmin.slice(35, 40));
    cuando.push(fin >= 0.6 ? `Cierra los partidos: está en pista el ${fmt(100 * fin, 0)} % de los 5 últimos minutos.` : fin <= 0.25 ? `Casi no juega los finales (${fmt(100 * fin, 0)} % de los 5 últimos minutos).` : `Juega el ${fmt(100 * fin, 0)} % de los 5 últimos minutos.`);
    const en = evTramos(pmin, 0.6), fuera = evTramos(pmin.map(v => 1 - v), 0.6);
    if (en) cuando.push(`Minutos en los que casi siempre está en pista: ${en}.`);
    if (fuera && x.minRec >= 15) cuando.push(`Descansa normalmente en los minutos ${fuera}.`);
  }
  if (tu) cuando.push(`${fmt(tu.n / Math.max(1, tu.pj), 1)} turnos por partido de ${fmt(tu.media, 1)} minutos de media (el más largo, ${fmt(tu.largo, 1)}).`);
  if (pmq.length) { const mejorQ = pmq.slice(0, 4).map((v, i) => [i, v / n]).sort((a, b) => b[1] - a[1]); cuando.push(`+/- por cuarto: ${pmq.slice(0, 4).map((v, i) => `${i + 1}.º ${signo(v / n, 1)}`).join(' · ')}. Su mejor cuarto, el ${mejorQ[0][0] + 1}.º; el peor, el ${mejorQ[3][0] + 1}.º.`); }
  const fa = pb.final_apretado;
  if (fa && (fa.tci || fa.pts)) cuando.push(`En finales apretados: ${fa.pts} puntos, ${fa.tc}/${fa.tci} de campo, +/- ${signo(fa.pm)}.`);
  // ---- con quién funciona
  const suyas = parejas.filter(p => p.jugadoras.includes(j.id) && p.min >= 40 && p.net != null).map(p => ({otra: p.jugadoras.find(y => y !== j.id), ...p}));
  const mejorP = [...suyas].sort((a, b) => b.net - a.net).slice(0, 3), peorP = [...suyas].sort((a, b) => a.net - b.net).slice(0, 2).filter(p => p.net < 0);
  const suQ = qs.filter(q => q.jugadoras.includes(j.id))[0];
  const quien = [];
  if (mejorP.length) quien.push(`Mejor con ${mejorP.map(p => `${linkJu(p.otra, apellido(p.otra))} (${signo(p.net, 1)} en ${fmt(p.min, 0)} min)`).join(', ')}.`);
  if (peorP.length) quien.push(`Peor con ${peorP.map(p => `${linkJu(p.otra, apellido(p.otra))} (${signo(p.net, 1)} en ${fmt(p.min, 0)} min)`).join(', ')}.`);
  if (suQ) quien.push(`Su quinteto más usado: ${evNombres(suQ.jugadoras)} (${fmt(suQ.min, 0)} min, ${signo(suQ.net, 1)}).`);
  const red = (IDX.equipos[e.id] && IDX.equipos[e.id].pbp && IDX.equipos[e.id].pbp.red) || [];
  const da = red.filter(r => r[0] === j.id).slice(0, 3), recibe = red.filter(r => r[1] === j.id).slice(0, 3);
  if (da.length) quien.push(`Asiste sobre todo a ${da.map(r => `${linkJu(r[1], apellido(r[1]))} (${r[2]})`).join(', ')}.`);
  if (recibe.length) quien.push(`Le asisten sobre todo ${recibe.map(r => `${linkJu(r[0], apellido(r[0]))} (${r[2]})`).join(', ')}.`);
  // ---- regularidad y tendencia
  const s = j.splits || {}, tend = [];
  if (s.ultimos5 && j.pj >= 6) { const d = s.ultimos5.pts - j.med.pts; tend.push(`Últimos 5 partidos: ${fmt(s.ultimos5.pts)} puntos, ${fmt(s.ultimos5.ts, 0)} % TS y ${fmt(s.ultimos5.gmsc)} de Game Score (temporada: ${fmt(j.med.pts)}, ${fmt(av.ts, 0)} %, ${fmt(j.gmsc)}). ${d >= 3 ? 'En racha.' : d <= -3 ? 'A la baja.' : ''}`); }
  const par = (a, b, n1, n2) => a && b ? `${n1}: ${fmt(a.pts)} pts y ${fmt(a.ts, 0)} % TS (${a.pj} PJ) · ${n2}: ${fmt(b.pts)} pts y ${fmt(b.ts, 0)} % TS (${b.pj} PJ).` : '';
  [par(s.victoria, s.derrota, 'Cuando gana', 'cuando pierde'), par(s.casa, s.fuera, 'En casa', 'fuera'), par(s.vs_arriba, s.vs_abajo, 'Contra los de arriba', 'contra los de abajo'), par(s.titular, s.suplente, 'De titular', 'de suplente')].filter(Boolean).forEach(x => tend.push(x));
  if (MJK.gmsc_sd && MJK.gmsc_sd.v(j) != null) tend.push(`Regularidad: desviación de su Game Score ${fmt(MJK.gmsc_sd.v(j), 1)} (${MJK.gmsc_sd.v(j) >= 7 ? 'muy irregular' : MJK.gmsc_sd.v(j) <= 4 ? 'muy regular' : 'normal'}).`);
  // ---- cómo sacarle más partido
  const consejos = [];
  if (conOk && c.dif >= 10 && x.minRec < 22) { consejos.push(`Merece más minutos: con ella el equipo es ${signo(c.dif, 1)} mejor y juega ${fmt(x.minRec, 0)}.`); rec.push({peso: 5, t: `<b>${linkJu(j.id)} merece más minutos</b>: el equipo es ${signo(c.dif, 1)} mejor con ella y juega ${fmt(x.minRec, 0)} min.`}); }
  if ((av.tov_pct || 0) >= 22 && (av.usg || 0) >= 16) { consejos.push(`Bajar sus pérdidas (${fmt(av.tov_pct, 0)} % de sus jugadas): menos balón en situaciones de presión o más apoyos.`); rec.push({peso: 4, t: `<b>${linkJu(j.id)}</b> pierde el ${fmt(av.tov_pct, 0)} % de sus jugadas: trabajar la toma de decisiones o quitarle carga de balón.`}); }
  if ((av.usg || 0) >= 24 && (av.ts || 0) < (T.liga.factores.ts || 52) - 3) consejos.push(`Mucho volumen con poca eficiencia (uso ${fmt(av.usg, 0)} %, TS ${fmt(av.ts, 0)} %): repartir tiros o mejorar su selección.`);
  if ((av.usg || 0) <= 15 && (av.ts || 0) >= (T.liga.factores.ts || 52) + 6 && j.tot.fga >= 30) consejos.push(`Muy eficiente con poco volumen (TS ${fmt(av.ts, 0)} %, uso ${fmt(av.usg, 0)} %): puede asumir más tiros.`);
  if ((p40.pf || 0) >= 4.8) consejos.push('Proteger sus faltas: evitar que defienda a la principal amenaza rival en la primera parte.');
  if (pmq.length >= 4) { const malo = pmq.slice(0, 4).map((v, i) => [i, v / n]).sort((a, b) => a[1] - b[1])[0]; if (malo[1] <= -3 && (mc[malo[0]] || 0) / n >= 4) consejos.push(`Revisar sus minutos del ${malo[0] + 1}.º cuarto (${signo(malo[1], 1)} de +/- por partido).`); }
  if (!consejos.length) consejos.push('Mantener su papel: no hay nada en sus cifras que pida un cambio claro.');
  // ---- tabla de percentiles
  const tablaP = perc.filas.length ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">Faceta</th><th>Valor</th><th>Percentil</th></tr></thead><tbody>${perc.filas.map(f => `<tr><td class="izq">${esc(f.n)}</td><td>${fmt(f.v, f.d ?? 1)}${f.u || ''}</td><td><span style="color:${f.p >= 80 ? 'var(--gana)' : f.p <= 20 ? 'var(--rojo)' : 'inherit'}"><b>${f.p}</b></span></td></tr>`).join('')}</tbody></table></div>
    <p class="muy-tenue">Percentil frente a ${perc.puesto ? `su puesto (${esc(perc.puesto)}) en la liga` : 'la liga'} (100 = lo mejor).</p>` : '';
  const tablaZ = zonas.length && t.tiros >= 20 ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">Zona</th><th>Tiros</th><th>% suyo</th><th>% de su puesto</th><th>Acierto</th><th>Liga</th><th>Pts/tiro</th></tr></thead><tbody>${zonas.map(z => `<tr><td class="izq">${esc(z.z)}</td><td>${z.a}/${z.n}</td><td>${fmt(z.fr, 0)} %</td><td class="muy-tenue">${fmt(z.frG, 0)} %</td><td><b>${fmt(z.pct, 0)} %</b></td><td class="muy-tenue">${fmt(z.l, 0)} %</td><td>${fmt(z.ppt, 2)}</td></tr>`).join('')}</tbody></table></div>` : '';
  const tablaI = imp ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">El equipo…</th><th>Con ella</th><th>Sin ella</th><th>Diferencia</th></tr></thead><tbody>${imp.map(r => { const d = r[1] != null && r[2] != null ? r[1] - r[2] : null, bueno = r[3] === null || d == null ? null : (r[3] ? d > 0 : d < 0);
    return `<tr><td class="izq">${esc(r[0])}</td><td>${fmt(r[1], 1)}</td><td>${fmt(r[2], 1)}</td><td style="color:${bueno == null || Math.abs(d) < 2 ? 'inherit' : bueno ? 'var(--gana)' : 'var(--rojo)'}">${d == null ? '–' : signo(d, 1)}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="muy-tenue">${fmt(c.con.min, 0)} minutos con ella y ${fmt(c.sin.min, 0)} sin ella (jugada a jugada). Lo de con y sin depende también de con quién juega: léelo junto a sus parejas.</p>` : '<p class="tenue">Pocos minutos con y sin ella para compararlo.</p>';
  const tiros = pb.tiros || [];
  const lista = (titulo, l, cls) => l.length ? `<h4 style="margin:.75rem 0 .25rem">${titulo}</h4><ul class="${cls || ''}">${l.map(t => `<li>${t}</li>`).join('')}</ul>` : '';
  const html = `<article class="tarjeta ev-ficha" style="margin-top:1rem"><div class="encabezado" style="margin:0"><div><h3 style="margin:0">${/\d/.test(j.dorsal || '') ? `<span class="muy-tenue">#${esc(j.dorsal)}</span> ` : ''}${linkJu(j.id)} ${esTitular ? '<span class="etiqueta">titular</span>' : ''}</h3>
      <div class="muy-tenue">${esc(j.puesto || 'Sin puesto')}${j.altura ? ' · ' + j.altura + ' cm' : ''}${j.edad ? ' · ' + j.edad + ' años' : ''}${j.nacionalidad ? ' · ' + esc(j.nacionalidad) : ''} · Rol: <b>${esc(evRol(j))}</b></div></div></div>
    <div class="cifras" style="margin-top:.5rem">${cifra(`${j.tit}/${j.pj}`, 'Titular/partidos')}${cifra(fmt(x.minRec, 0), 'Min (últ. 5)')}${cifra(fmt(j.med.pts), 'Puntos')}${cifra(fmt(j.med.trb), 'Rebotes')}${cifra(fmt(j.med.ast), 'Asistencias')}
      ${cifra(fmt(av.ts, 0) + ' %', 'TS%', MJK.ts.i)}${cifra(fmt(av.usg, 0) + ' %', 'Uso', MJK.usg.i)}${cifra(signo(av.bpm, 1), 'BPM', MJK.bpm.i)}${cifra(conOk ? signo(c.dif, 1) : '–', 'Con/sin')}${cifra(fmt(p40.pts), 'Pts por 40 min')}</div>
    <div class="rejilla-2" style="margin-top:.5rem"><div>
      ${lista(esTitular ? 'Por qué es titular' : 'Por qué juega', razones)}${lista('Dudas', dudas)}
      ${lista('Cómo anota', anota)}${lista('Cuándo juega', cuando)}${lista('Con quién funciona', quien)}${lista('Regularidad y tendencia', tend)}
      ${lista('Cómo sacarle más partido', consejos)}</div>
      <div><h4 style="margin:.75rem 0 .25rem">Su impacto en el equipo</h4>${impTxt.length ? `<ul>${impTxt.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}${tablaI}
        <h4 style="margin:.75rem 0 .25rem">Frente a la liga</h4>${tablaP}
        ${tablaZ ? `<h4 style="margin:.75rem 0 .25rem">Sus tiros por zona</h4>${tablaZ}` : ''}
        ${tiros.length >= 15 ? `<h4 style="margin:.75rem 0 .25rem">Mapa de tiro</h4>${mapaTiro(tiros, {titulo: 'Mapa de tiro de ' + j.nombre})}` : ''}</div></div></article>`;
  return {html, rec};
}
