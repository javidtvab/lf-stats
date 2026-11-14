// LF Stats · Preparar partido: eliges tu equipo y el rival y sale un informe del cruce. Pronóstico, dónde se decide,
// puntos fuertes y débiles de cada uno frente al otro, plan de ataque y de defensa, duelos por puesto, jugadoras clave,
// zonas de tiro, situaciones de juego (contraataque, segundas opciones, tras pérdida, tiempos muertos, bonus, salidas),
// quién cierra los partidos, quintetos, cómo van sus partidos, forma, rivales comunes y parecidos, descanso y una hoja
// resumen para el banquillo.
// Todo sale de la temporada elegida: lo de cada equipo se cruza con lo que hace (o concede) el otro.
'use strict';

const PP_PUESTO = {Base: 1, Escolta: 2, Alero: 3, 'Ala-pívot': 4, 'Pívot': 5};
const PP_COEF = {efg: 1.5, tov: -1.4, orb: 0.45, ftr: 0.33};       // si la temporada no tiene los suyos (pocos partidos)
const ppPos = j => PP_PUESTO[j.puesto] || (j.av && j.av.pos_est != null ? j.av.pos_est : 3);
const ppPct = (a, b) => b ? 100 * a / b : null;
const ppNum = (x, d = 1) => fmt(x, d);
// probabilidad de que gane el que tiene margen m a favor, con la desviación de los márgenes de la liga
function ppProb(m, sigma) {
  const x = m / (sigma || 12), z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + Math.sign(x) * y);
}
// desviación de una cifra entre los equipos de la liga (para decir si una diferencia es grande o no)
function ppDesv(f) {
  const vs = IDX.jugadas.map(f).filter(v => v != null && !Number.isNaN(v));
  if (vs.length < 3) return null;
  const m = media(vs);
  return Math.sqrt(media(vs.map(v => (v - m) ** 2))) || null;
}
const ppRango = (e, f, inv) => { const v = f(e); if (v == null) return null; return 1 + IDX.jugadas.filter(x => { const w = f(x); return w != null && (inv ? w < v : w > v); }).length; };
const ppPuesto = (e, f, inv) => { const r = ppRango(e, f, inv); return r ? `${r}.º de ${IDX.jugadas.length}` : '–'; };

// ---------------------------------------------------------------- la plantilla de un equipo, con lo de los últimos partidos
function ppPlantilla(e) {
  const rot = e.rotacion || {jugadoras: [], min: [], tit: [], partidos: []};
  const n = rot.partidos.length;
  return T.jugadoras.filter(j => j.equipo === e.id && j.tot.min > 0).map(j => {
    const i = rot.jugadoras.indexOf(j.id);
    const mins = i >= 0 && rot.min && rot.min[i] ? rot.min[i].map(m => m || 0) : [], tits = i >= 0 && rot.tit && rot.tit[i] ? rot.tit[i] : [];
    const ult5 = mins.slice(-5);
    const ausente = n >= 3 && j.med.min >= 12 && mins.length >= 2 && mins.slice(-2).every(m => !m);
    return {j, minRec: ult5.length ? media(ult5) : j.med.min, titRec: tits.length ? tits.slice(-5).filter(Boolean).length : 0,
      ausente, ultimos: ult5, sinJugar: mins.length ? mins.length - 1 - mins.map(Boolean).lastIndexOf(true) : 0};
  }).sort((a, b) => b.minRec - a.minRec || b.j.tot.min - a.j.tot.min);
}
// quinteto titular probable: las que más han salido de titulares en los últimos cinco partidos (sin las que no juegan)
function ppTitulares(pl) {
  const disp = pl.filter(x => !x.ausente);
  return [...disp].sort((a, b) => b.titRec - a.titRec || b.j.tit - a.j.tit || b.minRec - a.minRec).slice(0, 5).sort((a, b) => ppPos(a.j) - ppPos(b.j));
}

// ---------------------------------------------------------------- cruces de equipo: el ataque de uno contra la defensa del otro
// lo esperado en el partido: lo que hace uno + lo que concede el otro − la media de la liga
const ppCruce = (atq, def, k) => {
  const a = atq.ataque && atq.ataque[k], d = def.defensa && def.defensa[k], l = T.liga.factores[k];
  return a == null || d == null || l == null ? null : a + d - l;
};
// las dimensiones del cruce. mas: más es mejor para el que ataca
const PP_DIMS = [
  {k: 'efg', n: 'Tiro efectivo', c: 'eFG%', mas: true, d: 1},
  {k: 'tov', n: 'Pérdidas por posesión', c: 'PÉR%', mas: false, d: 1},
  {k: 'orb', n: 'Rebote ofensivo', c: 'RO%', mas: true, d: 1},
  {k: 'ftr', n: 'Tiros libres por tiro', c: 'TL/TC', mas: true, d: 1},
  {k: 'p3', n: 'Acierto en el triple', c: 'T3%', mas: true, d: 1},
  {k: 'p2', n: 'Acierto de dos', c: 'T2%', mas: true, d: 1},
  {k: 'p3r', n: 'Volumen de triples', c: 'T3I/TCI', mas: null, d: 1},
  {k: 'ast', n: 'Canastas asistidas', c: 'AST%', mas: null, d: 1},
];

function ppCruces(atq, def) {
  return PP_DIMS.map(x => {
    const esperado = ppCruce(atq, def, x.k), l = T.liga.factores[x.k];
    const sd = ppDesv(e => e.ataque && e.ataque[x.k]);
    const z = esperado == null || sd == null || x.mas == null ? null : (x.mas ? 1 : -1) * (esperado - l) / sd;
    return {...x, a: atq.ataque[x.k], dd: def.defensa[x.k], esperado, l, z,
      ra: ppRango(atq, e => e.ataque && e.ataque[x.k], x.mas === false), rd: ppRango(def, e => e.defensa && e.defensa[x.k], x.mas !== false)};
  });
}

// ---------------------------------------------------------------- zonas de tiro: lo que tira uno y lo que concede el otro
function ppZonas(atq, def) {
  const za = atq.pbp && atq.pbp.tiro, zd = def.pbp && def.pbp.tiro_rival;
  if (!T.pbp || !za || !zd) return null;
  const k = 40;      // cada acierto se acerca a la media de la liga como si hubiera 40 tiros más a la media
  const suave = (n, a, l) => 100 * (a + k * l / 100) / (n + k);
  const tirosLiga = Object.values(T.pbp.liga_tiro).reduce((s, x) => s + x[0], 0);
  return T.pbp.zonas.map(z => {
    const [na, aa] = za.zonas[z] || [0, 0], [nd, ad] = zd.zonas[z] || [0, 0], l = T.pbp.liga_tiro[z][2];
    const pa = suave(na, aa, l), pd = suave(nd, ad, l), esperado = pa + pd - l, valor = z.startsWith('Triple') ? 3 : 2;
    return {z, na, aa, nd, ad, l, pa: ppPct(aa, na), pd: ppPct(ad, nd), esperado, valor, pps: esperado / 100 * valor, ppsLiga: l / 100 * valor,
      fa: ppPct(na, za.tiros), fd: ppPct(nd, zd.tiros), fl: ppPct(T.pbp.liga_tiro[z][0], tirosLiga)};
  });
}

// ---------------------------------------------------------------- etiquetas de una jugadora (lo que hay que saber de ella)
function ppEtiquetas(x, base, venue) {
  const j = x.j, L = T.liga.factores, av = j.av || {}, p40 = j.p40 || {}, pb = j.pbp, out = [];
  const pc = (k, inv) => { const m = MJK[k]; return m ? percentil(m.v(j), base.map(m.v).filter(v => v != null), inv) : null; };
  const add = (tipo, t) => out.push({tipo, t});
  if (x.ausente) add('info', `No ha jugado los últimos ${x.sinJugar} partidos: posible baja`);
  if (av.usg != null && pc('usg') >= 85) add('peligro', `El ataque pasa por ella: uso del ${fmt(av.usg, 0)} %`);
  if (av.pts_share >= 18) add('peligro', `${fmt(j.med.pts)} puntos por partido (${fmt(av.pts_share, 0)} % de los de su equipo)`);
  if (p40.p3a >= 4 && av.p3_est >= L.p3 + 3) add('peligro', `Tiradora de triple: ${j.tot.p3}/${j.tot.p3a} (${fmt(av.p3, 0)} %). Salir fuerte a su tiro`);
  else if (p40.p3a >= 4 && av.p3_est <= L.p3 - 3) add('debil', `Tira muchos triples con poco acierto (${fmt(av.p3, 0)} %): se le puede conceder`);
  else if (p40.p3a < 1 && j.med.min >= 15) add('debil', 'Casi no tira de tres: se puede flotar y ayudar desde ella');
  if (pb && pb.tiro && pb.tiro.tiros >= 20) {
    const fr = z => ppPct((pb.tiro.zonas[z] || [0])[0], pb.tiro.tiros), ac = z => { const v = pb.tiro.zonas[z] || [0, 0]; return ppPct(v[1], v[0]); };
    if (fr('Zona restringida') >= 45) add('info', `Ataca el aro: ${fmt(fr('Zona restringida'), 0)} % de sus tiros en zona restringida (${fmt(ac('Zona restringida'), 0)} % de acierto)`);
    if (fr('Media distancia') >= 28) add('info', `Mucho tiro de media distancia: ${fmt(fr('Media distancia'), 0)} % de sus tiros (${fmt(ac('Media distancia'), 0)} % de acierto)`);
    if (fr('Triple de esquina') >= 15) add('info', `Se abre a la esquina: ${fmt(fr('Triple de esquina'), 0)} % de sus tiros son triples de esquina`);
    if (pb.asistidas && pb.asistidas.pct != null && p40.fga >= 9) {
      if (pb.asistidas.pct <= 35) add('peligro', `Se fabrica su tiro: solo el ${fmt(pb.asistidas.pct, 0)} % de sus canastas vienen de asistencia`);
      else if (pb.asistidas.pct >= 80 && av.usg >= 16) add('info', `Vive del pase (${fmt(pb.asistidas.pct, 0)} % de sus canastas asistidas): negarle la recepción`);
    }
  }
  if (av.ast_pct >= 25 || pc('ast_pct') >= 88) add('peligro', `Reparte el juego: ${fmt(j.med.ast)} asistencias (${fmt(av.ast_pct, 0)} % de las canastas de sus compañeras con ella en pista)`);
  if (av.tov_pct >= 20 && av.usg >= 15) add('debil', `Pierde balones (${fmt(av.tov_pct, 0)} % de sus jugadas): presionarla`);
  if (pc('orb_pct') >= 85) add('peligro', `Reboteadora ofensiva: ${fmt(j.med.orb)} por partido. Cerrarle el rebote`);
  if (pc('blk_pct') >= 88 && j.tot.blk >= 5) add('peligro', `Protectora del aro: ${fmt(j.med.blk)} tapones por partido. Fintas o sacarla de la zona`);
  if (pc('stl_pct') >= 88 && j.tot.stl >= 5) add('peligro', `Ladrona de balones: ${fmt(j.med.stl)} robos por partido`);
  if (av.ftr >= 0.45 && p40.fta >= 4) add('peligro', `Provoca faltas: ${fmt(j.med.fta)} tiros libres por partido`);
  if (j.tot.fta >= 12 && av.ft_est >= 82) add('info', `Mete los libres (${fmt(av.ft, 0)} %): no hacerle falta`);
  else if (j.tot.fta >= 12 && av.ft_est <= 62) add('debil', `Falla libres (${fmt(av.ft, 0)} %): si hay que hacer falta, mejor a ella`);
  if (p40.pf >= 4.8 && j.med.min >= 10) add('debil', `Se carga de faltas (${fmt(p40.pf)} por 40 min): atacarla para cargarla`);
  if (pb && pb.final_apretado && pb.final_apretado.pts >= 8) add('peligro', `Aparece en los finales apretados: ${pb.final_apretado.pts} puntos (${pb.final_apretado.tc}/${pb.final_apretado.tci} de campo)`);
  const s = j.splits || {};
  if (s.ultimos5 && s.ultimos5.pj >= 3 && j.pj >= 6) {
    const d = s.ultimos5.pts - j.med.pts;
    if (d >= 3) add('peligro', `En racha: ${fmt(s.ultimos5.pts)} puntos en los últimos 5 partidos (media ${fmt(j.med.pts)})`);
    else if (d <= -3) add('info', `A la baja: ${fmt(s.ultimos5.pts)} puntos en los últimos 5 (media ${fmt(j.med.pts)})`);
  }
  const sv = venue === 'casa' ? s.casa : venue === 'fuera' ? s.fuera : null;
  if (sv && sv.pj >= 2 && Math.abs(sv.pts - j.med.pts) >= 3) add('info', `${venue === 'casa' ? 'En casa' : 'Fuera'} hace ${fmt(sv.pts)} puntos (media ${fmt(j.med.pts)})`);
  const cs = IDX.equipos[j.equipo] && IDX.equipos[j.equipo].pbp && IDX.equipos[j.equipo].pbp.con_sin && IDX.equipos[j.equipo].pbp.con_sin[j.id];
  if (cs && cs.con.min >= 60 && cs.dif != null) {
    if (cs.dif >= 10) add('peligro', `Su equipo es ${signo(cs.dif, 1)} mejor por 100 posesiones con ella en pista`);
    if (cs.con.drtg != null && cs.sin.drtg != null && cs.con.drtg - cs.sin.drtg >= 8) add('debil', `Su equipo defiende peor con ella en pista (encaja ${fmt(cs.con.drtg - cs.sin.drtg)} más por 100 posesiones)`);
  }
  return out;
}

// cuánto peligro tiene una jugadora (para ordenar a quién frenar): su Game Score, con lo que juega ahora
const ppPeligro = x => (x.j.gmsc || 0) * Math.max(0.5, Math.min(1.3, x.minRec / Math.max(1, x.j.med.min)));
// lo floja que es en defensa (para ordenar a quién atacar): menos es más floja
function ppDefensa(x) {
  const j = x.j, cs = IDX.equipos[j.equipo] && IDX.equipos[j.equipo].pbp && IDX.equipos[j.equipo].pbp.con_sin && IDX.equipos[j.equipo].pbp.con_sin[j.id];
  const onoff = cs && cs.con.min >= 60 && cs.con.drtg != null && cs.sin.drtg != null ? (cs.sin.drtg - cs.con.drtg) / 10 : 0;
  return (j.av.dbpm ?? 0) + onoff - Math.max(0, ((j.p40 || {}).pf || 0) - 4) * 0.5;
}

// ---------------------------------------------------------------- partidos de un equipo
// e.partidos: [partido, jornada, rival, local, pf, pc, posesiones]
function ppForma(e, n = 5) {
  const ps = (e.partidos || []).slice(-n);
  const pos = ps.reduce((s, x) => s + (x[6] || 0), 0);
  return {ps, net: pos ? 100 * ps.reduce((s, x) => s + x[4] - x[5], 0) / pos : null, v: ps.filter(x => x[4] > x[5]).length};
}
function ppComunes(a, b) {
  const margen = e => { const m = {}; (e.partidos || []).forEach(x => { (m[x[2]] = m[x[2]] || []).push(x[4] - x[5]); }); return m; };
  const ma = margen(a), mb = margen(b);
  return Object.keys(ma).filter(r => mb[r] && r !== a.id && r !== b.id).map(r => ({r, a: media(ma[r]), b: media(mb[r]), na: ma[r].length, nb: mb[r].length}))
    .sort((x, y) => (y.a - y.b) - (x.a - x.b));
}

// los rivales de e más parecidos a ref (cuatro factores de ataque y de defensa y ritmo, en desviaciones de la liga)
function ppParecidos(e, ref, n = 4) {
  const ks = [...['efg', 'tov', 'orb', 'ftr'].map(k => x => x.ataque && x.ataque[k]), ...['efg', 'tov', 'orb', 'ftr'].map(k => x => x.defensa && x.defensa[k]), x => x.ritmo];
  const sds = ks.map(f => ppDesv(f));
  const dist = x => Math.sqrt(ks.reduce((s, f, i) => { const u = f(x), v = f(ref); return s + (u == null || v == null || !sds[i] ? 0 : ((u - v) / sds[i]) ** 2); }, 0));
  const jugados = {};
  (e.partidos || []).forEach(x => { if (x[2] !== ref.id) (jugados[x[2]] = jugados[x[2]] || []).push(x); });
  return Object.keys(jugados).map(r => IDX.equipos[r]).filter(r => r && r.ataque && r.defensa)
    .map(r => ({r, d: dist(r), ps: jugados[r.id]})).sort((x, y) => x.d - y.d).slice(0, n);
}

// situaciones de juego (del jugada a jugada): e.pbp.situaciones guarda [lo que hace, lo que le hacen] por partido
const PP_SITU = [
  {k: 'contra', n: 'Contraataque', i: 'Puntos hasta 6 segundos después de un robo o de un rebote defensivo',
    ata: 'Correr: buscar el contraataque tras robo o rebote', def: 'Balance defensivo: volver rápido y frenar el primer pase tras rebote o pérdida'},
  {k: 'segunda', n: 'Segunda oportunidad', i: 'Puntos tras rebote ofensivo',
    ata: 'Ir al rebote ofensivo: hay segundas opciones', def: 'Cerrar el rebote defensivo: cajas y rebotear las cinco'},
  {k: 'perdida', n: 'Tras pérdida del rival', i: 'Puntos en las posesiones que empiezan con una pérdida del rival',
    ata: 'Presionar el balón y las líneas de pase: sus pérdidas se pagan caras', def: 'Cuidar el balón: sus puntos tras pérdida hacen mucho daño'},
  {k: 'ato', n: 'Tras tiempo muerto', ppp: true, i: 'Puntos por posesión en el ataque que sale de un tiempo muerto propio',
    ata: 'Preparar bien las jugadas de salida de tus tiempos muertos', def: 'Ojo a la salida de sus tiempos muertos: traen la jugada preparada; avisar la defensa en cada uno'},
  {k: 'inicio', n: 'Primeros 5 minutos', i: 'Puntos en los 5 primeros minutos del partido',
    ata: 'Salir fuerte desde el salto inicial', def: 'Salir con la defensa enchufada: aprietan en los primeros minutos'},
  {k: 'descanso', n: '5 min tras el descanso', i: 'Puntos en los 5 primeros minutos del tercer cuarto',
    ata: 'Apretar a la vuelta del descanso', def: 'Cuidado a la vuelta del descanso: es cuando aprietan'},
];
const ppSv = (e, s, lado) => { const x = e.pbp && e.pbp.situaciones; if (!x) return null; return s.ppp ? (x.ato[lado + 2] >= 15 ? x.ato[lado] : null) : x[s.k][lado]; };
function ppSituaciones(atq, def) {
  return PP_SITU.map(s => {
    const h = ppSv(atq, s, 0), c = ppSv(def, s, 1);
    const vs = IDX.jugadas.map(e => ppSv(e, s, 0)).filter(v => v != null);
    const l = vs.length >= 3 ? media(vs) : null;
    const sd = l != null ? Math.sqrt(media(vs.map(v => (v - l) ** 2))) || null : null;
    const esperado = h != null && c != null && l != null ? Math.max(0, h + c - l) : null;
    return {...s, h, c, l, esperado, z: esperado != null && sd ? (esperado - l) / sd : null,
      rh: h == null ? null : ppRango(atq, e => ppSv(e, s, 0)), rc: c == null ? null : ppRango(def, e => ppSv(e, s, 1), true)};
  });
}
const ppLigaSitu = f => { const vs = IDX.jugadas.map(e => e.pbp && e.pbp.situaciones ? f(e.pbp.situaciones) : null).filter(v => v != null); return vs.length >= 3 ? media(vs) : null; };

// días desde su último partido hasta el día del partido (fechas «dd/mm/aaaa hh:mm»)
const ppFecha = s => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || ''); return m ? new Date(+m[3], m[2] - 1, +m[1]) : null; };
function ppDescanso(e, dia) {
  const u = (e.partidos || []).slice(-1)[0], f = u && IDX.partidos[u[0]] && ppFecha(IDX.partidos[u[0]].fecha);
  const d = f && dia ? Math.round((dia - f) / 864e5) : null;
  return d != null && d >= 0 && d <= 30 ? d : null;
}

// cómo juega un equipo cuando gana y cuando pierde (cuatro factores de cada partido)
function ppGanaPierde(e) {
  const g = {v: [], d: []};
  (e.partidos || []).forEach(x => {
    const p = IDX.partidos[x[0]];
    if (!p || !p.factores) return;
    const l = p.local === e.id ? 0 : 1, f = p.factores[l], r = p.factores[1 - l];
    if (f && r) g[x[4] > x[5] ? 'v' : 'd'].push({f, r, pts: x[4], pc: x[5], pos: x[6]});
  });
  const m = (l, fn) => { const vs = l.map(fn).filter(v => v != null); return vs.length ? media(vs) : null; };
  const filas = [['Tiro efectivo (eFG%)', y => y.f.efg, 'efg'], ['Pérdidas por posesión', y => y.f.tov, 'tov', true], ['Rebote ofensivo', y => y.f.orb, 'orb'],
    ['Tiros libres por tiro', y => y.f.ftr, 'ftr'], ['% de triple', y => y.f.p3, 'p3'], ['Frecuencia de triple', y => y.f.p3r, 'p3r', null],
    ['eFG% del rival', y => y.r.efg, 'efg', true], ['Pérdidas del rival', y => y.r.tov, 'tov'], ['Rebote ofensivo del rival', y => y.r.orb, 'orb', true],
    ['Posesiones', y => y.pos, null, null], ['Puntos', y => y.pts, null], ['Puntos encajados', y => y.pc, null, true]];
  return {nv: g.v.length, nd: g.d.length, filas: filas.map(([n, fn, k, inv]) => ({n, k, inv, v: m(g.v, fn), d: m(g.d, fn)}))};
}

// enfrentamientos de temporadas anteriores (se cargan aparte): mismos clubes por nombre o por club
function ppHistorial(a, b) {
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const claves = e => new Set([norm(e.club), norm(e.nombre)].filter(Boolean));
  const ka = claves(a), kb = claves(b), comp = COMP, actual = String(T.temporada);
  despues(async () => {
    const ts = INDICE.temporadas.map(x => x.temporada).filter(t => String(t) !== actual).slice(0, 5);
    const filas = [];
    for (const t of ts) {
      let d;
      try { d = await cargarTemporada(t); } catch (e) { continue; }
      if (COMP !== comp) return;
      const eqs = Object.fromEntries(d.equipos.map(e => [e.id, e]));
      const es = (id, k) => { const e = eqs[id]; return !!e && [norm(e.club), norm(e.nombre)].some(x => x && k.has(x)); };
      d.partidos.filter(p => (es(p.local, ka) && es(p.visitante, kb)) || (es(p.local, kb) && es(p.visitante, ka)))
        .forEach(p => filas.push({t: d.nombre, p, eqs, aLocal: es(p.local, ka)}));
    }
    const caja = document.getElementById('pp-historial');
    if (!caja || !caja.isConnected) return;
    if (!filas.length) { caja.innerHTML = `<p class="tenue">No se han enfrentado en las ${ts.length} temporadas anteriores que tiene la web.</p>`; return; }
    const gana = filas.filter(x => (x.p.puntos[x.aLocal ? 0 : 1] > x.p.puntos[x.aLocal ? 1 : 0])).length;
    const dif = media(filas.map(x => x.p.puntos[x.aLocal ? 0 : 1] - x.p.puntos[x.aLocal ? 1 : 0]));
    caja.innerHTML = `<p><b>${esc(a.nombre)}</b> ha ganado <b>${gana} de ${filas.length}</b> (diferencia media ${signo(dif, 1)}).</p><ul class="pp-lista">${filas.map(x => {
      const pa = x.p.puntos[x.aLocal ? 0 : 1], pb = x.p.puntos[x.aLocal ? 1 : 0];
      return `<li><span class="${pa > pb ? 'v' : 'd'}">${pa > pb ? 'V' : 'D'}</span> ${esc(x.eqs[x.p.local].nombre)} ${x.p.puntos[0]}-${x.p.puntos[1]} ${esc(x.eqs[x.p.visitante].nombre)} <span class="muy-tenue">${esc(x.t)} · J${x.p.jornada}${x.p.fecha ? ' · ' + esc(String(x.p.fecha).split(' ')[0]) : ''}</span></li>`; }).join('')}</ul>`;
  });
  return '<div id="pp-historial"><p class="tenue cargando-suave">Buscando sus partidos de otras temporadas…</p></div>';
}

// ---------------------------------------------------------------- buscadores de equipo
// los equipos de la temporada más reciente de cada competición (del índice del buscador de la cabecera)
function ppEquiposActuales() {
  if (ppEquiposActuales.de === JUG) return ppEquiposActuales.lista;
  const ult = {};
  (JUG.equipos || []).forEach(([, c, t]) => { if (!(c in ult) || t > ult[c]) ult[c] = t; });
  ppEquiposActuales.de = JUG;
  return (ppEquiposActuales.lista = (JUG.equipos || []).filter(([, c, t]) => t === ult[c] && COMPETICIONES.some(x => x.clave === c))
    .map(([n, c, t, eid]) => ({n, c, t, eid, k: normal(`${n} ${compDe(c).corto}`),
      det: `${compDe(c).corto} ${nombreT(t)}${genero(compDe(c)) !== GENERO ? (genero(compDe(c)) === 'm' ? ' · masculino' : ' · femenino') : ''}`})));
}
function ppBuscar(lista, q, max = 14) {
  const trozos = normal(q).split(/\s+/).filter(Boolean);
  const nota = x => (x.primero ? -1e7 : 0) + (genero(compDe(x.c)) === GENERO ? 0 : 1e6) + (x.c === COMP.clave ? 0 : 1e4) + (NIVEL[x.c] || 9) * 100
    - (trozos.length && x.k.split(/\s+/).some(w => w.startsWith(trozos[0])) ? 50 : 0);
  return lista.filter(x => trozos.every(tr => x.k.includes(tr))).sort((a, b) => nota(a) - nota(b) || a.n.localeCompare(b.n, 'es')).slice(0, max);
}
const ppCajaBuscar = (id, valor, texto) => `<div class="pp-buscador"><input id="${id}" type="search" autocomplete="off" placeholder="${esc(texto)}" value="${esc(valor)}"
  aria-controls="${id}-res" aria-expanded="false"><div id="${id}-res" class="resultados" role="listbox" hidden></div></div>`;
function ppActivarBuscar(id, fuente, elegir) {
  const input = document.getElementById(id), caja = document.getElementById(id + '-res');
  if (!input) return;
  const inicial = input.value;
  let lista = [], marcado = 0;
  const cerrar = () => { caja.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  const pintarL = () => {
    lista = fuente(input.value.trim()); marcado = 0;
    caja.hidden = false; input.setAttribute('aria-expanded', 'true');
    caja.innerHTML = lista.length ? lista.map((x, i) => `<button type="button" class="resultado" role="option" data-i="${i}" aria-selected="${i === 0}">${esc(x.n)}<small>${esc(x.det || '')}</small></button>`).join('')
      : '<div class="resultado tenue">Sin resultados</div>';
    caja.querySelectorAll('[data-i]').forEach(b => b.addEventListener('mousedown', ev => { ev.preventDefault(); cerrar(); elegir(lista[Number(b.dataset.i)]); }));
  };
  const marcar = n => { const bs = caja.querySelectorAll('[data-i]'); if (!bs.length) return; marcado = (n + bs.length) % bs.length;
    bs.forEach((b, i) => b.setAttribute('aria-selected', String(i === marcado))); bs[marcado].scrollIntoView({block: 'nearest'}); };
  input.addEventListener('focus', () => { input.value = ''; pintarL(); });          // al entrar, la lista entera
  input.addEventListener('input', pintarL);
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement === input) return; cerrar(); if (!input.value.trim()) input.value = inicial; }, 150));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); marcar(marcado + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); marcar(marcado - 1); }
    else if (ev.key === 'Enter' && lista[marcado] && !caja.hidden) { ev.preventDefault(); cerrar(); elegir(lista[marcado]); }
    else if (ev.key === 'Escape') { cerrar(); input.blur(); }
  });
}

// el mismo club en otra competición: los nombres cambian un poco (Kosner Baskonia / Kosner Baskonia Vitoria-Gasteiz)
const ppPalabras = n => normal(n).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 4);
function ppMismoClub(n1, n2) {
  const a = normal(n1).replace(/[^a-z0-9]/g, ''), b = normal(n2).replace(/[^a-z0-9]/g, '');
  if (a === b || (a.length >= 6 && b.includes(a)) || (b.length >= 6 && a.includes(b))) return true;
  const pa = ppPalabras(n1), pb = new Set(ppPalabras(n2));
  return pa.length >= 2 && pa.filter(w => pb.has(w)).length >= Math.min(2, pa.length, pb.size) && pa.filter(w => pb.has(w)).length / Math.min(pa.length, pb.size) >= 0.6;
}
// competiciones (temporada actual) en las que juegan los dos: [{c, t, a: id de mi equipo, b: id del rival}], la de más nivel primero
function ppCoinciden(nA, nB, g) {
  const por = {};
  ppEquiposActuales().filter(x => !g || genero(compDe(x.c)) === g).forEach(x => {
    const o = por[x.c] || (por[x.c] = {c: x.c, t: x.t});
    if (!o.a && ppMismoClub(x.n, nA)) o.a = x.eid;
    if (!o.b && ppMismoClub(x.n, nB)) o.b = x.eid;
  });
  return Object.values(por).filter(o => o.a && o.b && o.a !== o.b).sort((x, y) => (NIVEL[x.c] || 9) - (NIVEL[y.c] || 9));
}

// ---------------------------------------------------------------- la vista
// #/preparar/<mi equipo>/<rival>/<casa|fuera|neutral>. Siempre con la temporada actual de la competición; mi equipo
// se recuerda (competición, id y nombre) y, si es de otra competición, se va a la suya.
VISTAS.preparar = (idA, idB, donde) => {
  const ultima = INDICE.temporadas.length ? INDICE.temporadas[0].temporada : T.temporada;
  if (String(T.temporada) !== String(ultima)) {
    despues(() => irA(COMP.clave, ultima, location.hash));
    return '<h1>Preparar partido</h1><p class="tenue">Cargando la temporada actual…</p>';
  }
  const mio = leerJSON('mi-equipo', null);
  if (!idA && !idB && mio && mio.c && mio.c !== COMP.clave && COMPETICIONES.some(c => c.clave === mio.c)) {
    despues(() => irA(mio.c, undefined, `#/preparar/${mio.eid || ''}`));
    return '<h1>Preparar partido</h1><p class="tenue">Cargando la competición de tu equipo…</p>';
  }
  const jugado = id => IDX.equipos[id] && IDX.equipos[id].pj ? IDX.equipos[id] : null;
  const porNombre = n => n ? IDX.jugadas.find(e => normal(e.nombre) === normal(n)) : null;
  const a = jugado(idA) || (mio && mio.c === COMP.clave ? jugado(mio.eid) || porNombre(mio.n) : null) || jugado(leer('mi-equipo:' + COMP.clave));
  // sin rival elegido: el próximo partido de mi equipo
  const prox = a ? (T.predicciones || []).filter(p => p.local === a.id || p.visitante === a.id).sort((x, y) => x.jornada - y.jornada)[0] : null;
  const idRival = idB || (prox ? (prox.local === a.id ? prox.visitante : prox.local) : null);
  const b = jugado(idRival) && (!a || idRival !== a.id) ? IDX.equipos[idRival] : null;
  const partidoProg = a && b ? (T.predicciones || []).filter(p => (p.local === a.id && p.visitante === b.id) || (p.local === b.id && p.visitante === a.id)).sort((x, y) => x.jornada - y.jornada)[0] : null;
  const venue = ['casa', 'fuera', 'neutral'].includes(donde) ? donde : partidoProg ? (partidoProg.local === a.id ? 'casa' : 'fuera') : 'casa';
  const ir = (x, y, v) => { location.hash = `#/preparar/${x || ''}/${y || ''}${v ? '/' + v : ''}`; };
  // mi equipo: cualquiera de la temporada actual de cualquier competición; el rival, de la misma competición
  const deAqui = e => ({n: e.nombre, c: COMP.clave, t: T.temporada, eid: e.id, k: normal(e.nombre), det: `${COMP.corto} ${T.nombre}`});
  const fuenteMio = q => q.length < 2 ? ppBuscar(IDX.jugadas.map(deAqui), '', 40) : ppBuscar(jugCargadas() ? ppEquiposActuales() : IDX.jugadas.map(deAqui), q);
  const clasif = IDX.clasificacion.filter(e => e.pj);
  const deMiLiga = clasif.filter(e => !a || e.id !== a.id).map(e => ({...deAqui(e), primero: !!(prox && (prox.local === e.id || prox.visitante === e.id)),
    det: `${COMP.corto} · ${e.pos}.º${IDX.grupoDe[e.id] && IDX.grupoDe[e.id].nombre ? ' de ' + IDX.grupoDe[e.id].nombre : ''} · ${e.pg}-${e.pj - e.pg}${prox && (prox.local === e.id || prox.visitante === e.id) ? ' · tu próximo rival' : ''}`}));
  // sin escribir, los de la competición de mi equipo; escribiendo, cualquiera de la temporada actual de cualquier competición
  const fuenteRival = q => q.length < 2 || !jugCargadas() ? ppBuscar(deMiLiga, q, 60)
    : ppBuscar([...deMiLiga, ...ppEquiposActuales().filter(x => x.c !== COMP.clave && genero(compDe(x.c)) === genero(COMP) && !(a && ppMismoClub(x.n, a.nombre)))], q, 20);
  const elegirRival = x => {
    if (!a || x.c === COMP.clave) { ir(a && a.id, x.c === COMP.clave ? x.eid : '', ''); return; }
    // de otra competición: a la competición en la que juegan los dos
    const comun = ppCoinciden(a.nombre, x.n, genero(COMP)), mejor = comun.find(o => o.c === x.c) || comun[0];
    if (mejor) { irA(mejor.c, mejor.t, `#/preparar/${mejor.a}/${mejor.b}`); return; }
    VISTAS.preparar.aviso = `${esc(a.nombre)} y ${esc(x.n)} (${esc(compDe(x.c).corto)}) no coinciden en ninguna competición de la web esta temporada, así que no se pueden cruzar sus datos (cada liga tiene su nivel y sus medias). Puedes ver el ${enlaceIr(x.c, x.t, `#/informe/${x.eid}`, `<b>informe de ${esc(x.n)}</b>`)} en su competición.`;
    pintar();
  };
  despues(() => {
    ppActivarBuscar('pp-a', fuenteMio, x => {
      guardarJSON('mi-equipo', {c: x.c, eid: x.eid, n: x.n}); guardar('mi-equipo:' + x.c, x.eid);
      if (x.c === COMP.clave) ir(x.eid, b && b.id !== x.eid ? b.id : '', '');
      else {
        const comun = b && genero(compDe(x.c)) === genero(COMP) ? ppCoinciden(x.n, b.nombre, genero(COMP)) : [], mejor = comun.find(o => o.c === x.c);
        irA(x.c, x.t, mejor ? `#/preparar/${mejor.a}/${mejor.b}` : `#/preparar/${x.eid}`);
      }
    });
    ppActivarBuscar('pp-b', fuenteRival, elegirRival);
    activarIr();
    alPulsar('pp-donde', v => ir(a && a.id, b && b.id, v));
    activarImprimir();
  });
  const aviso = VISTAS.preparar.aviso ? `<p class="aviso no-imprimir">${VISTAS.preparar.aviso}</p>` : '';
  VISTAS.preparar.aviso = null;
  const cabecera = `<div class="encabezado no-imprimir"><div><h1>Preparar partido</h1><p class="tenue">Busca tu equipo y el rival: sale un informe del cruce con los datos de la temporada actual (${esc(COMP.corto)} ${esc(T.nombre)}).</p></div>${a && b ? botonImprimir() : ''}</div>
    <div class="filtros no-imprimir pp-elegir"><label><span><span style="color:var(--serie-1)">●</span> Mi equipo</span>${ppCajaBuscar('pp-a', a ? a.nombre : '', 'Busca tu equipo (cualquier competición)')}</label>
      <label><span><span style="color:var(--serie-2)">●</span> Rival</span>${ppCajaBuscar('pp-b', b && !aviso ? b.nombre : '', 'Busca el rival (cualquier competición)')}</label>
      <span><span class="muy-tenue">Dónde se juega</span> ${pildoras('pp-donde', [['casa', 'En casa'], ['fuera', 'Fuera'], ['neutral', 'Campo neutral']], venue)}</span></div>`;
  if (IDX.jugadas.length < 2) return h`${cabecera}<div class="tarjeta"><p class="tenue">La temporada actual de ${esc(COMP.corto)} aún no tiene partidos jugados. Busca tu equipo en otra competición.</p></div>`;
  if (!a) return h`${cabecera}${aviso}<div class="tarjeta"><p>Busca tu equipo arriba: escribe parte del nombre y elígelo de la lista (sale de cualquier competición, con su temporada actual). La web lo recordará y, si tiene partido programado, propondrá el rival.</p></div>`;
  if (!b) return h`${cabecera}${aviso}<div class="tarjeta"><p>Busca el rival: al entrar en el buscador salen los de ${esc(COMP.corto)} y, escribiendo, los de cualquier competición.${prox ? '' : ' No hay ningún partido de tu equipo programado en el calendario de esta temporada.'}</p></div>`;
  if (aviso) return h`${cabecera}${aviso}`;              // un rival que no se puede cruzar: sin el informe anterior
  return h`${cabecera}${ppInforme(a, b, venue, partidoProg)}`;
};

function ppInforme(a, b, venue, prog) {
  const L = T.liga.factores, LG = T.liga;
  const coef = (T.decide && T.decide.coef) || PP_COEF;
  const base = cualificadas();
  const pa = ppPlantilla(a), pb = ppPlantilla(b);
  const A = esc(a.nombre), B = esc(b.nombre);
  const punto = t => /\.$/.test(t) ? t : t + '.';     // sin «B.C..» cuando el nombre acaba en punto
  const campo = venue === 'casa' ? (LG.campo || 0) : venue === 'fuera' ? -(LG.campo || 0) : 0;
  // ---- pronóstico: ritmo, puntos de cada uno y margen
  const ritmo = (a.ritmo || LG.ritmo) + (b.ritmo || LG.ritmo) - LG.ritmo;
  const oa = a.adj_ortg ?? a.ortg, da = a.adj_drtg ?? a.drtg, ob = b.adj_ortg ?? b.ortg, db = b.adj_drtg ?? b.drtg;
  const ptsA0 = (oa + db - LG.ortg) * ritmo / 100 + campo / 2, ptsB0 = (ob + da - LG.ortg) * ritmo / 100 - campo / 2;
  const margenRat = ptsA0 - ptsB0;
  const modelo = prog ? {margen: prog.local === a.id ? prog.margen : -prog.margen, p: prog.local === a.id ? prog.p_local : 1 - prog.p_local} : null;
  const conModelo = modelo && venue === (prog.local === a.id ? 'casa' : 'fuera');
  const margen = conModelo ? modelo.margen : margenRat, prob = conModelo ? modelo.p : ppProb(margenRat, LG.sigma);
  // el marcador esperado, con el margen del modelo si es el que manda
  const ptsA = (ptsA0 + ptsB0 + margen) / 2, ptsB = (ptsA0 + ptsB0 - margen) / 2;
  // ---- cuatro factores cruzados
  const crA = ppCruces(a, b), crB = ppCruces(b, a);
  const ff = ['efg', 'tov', 'orb', 'ftr'].map(k => {
    const ea = ppCruce(a, b, k), eb = ppCruce(b, a, k);
    const net = ea == null || eb == null ? null : coef[k] * (ea - eb);
    return {k, ea, eb, net, pts: net == null ? null : net * ritmo / 100};
  });
  const zA = ppZonas(a, b), zB = ppZonas(b, a);
  const titA = ppTitulares(pa), titB = ppTitulares(pb);
  const rotB = pb.filter(x => !x.ausente && x.minRec >= 4).slice(0, 10), rotA = pa.filter(x => !x.ausente && x.minRec >= 4).slice(0, 10);
  const peligro = [...rotB].sort((x, y) => ppPeligro(y) - ppPeligro(x));
  const flojas = rotB.filter(x => x.minRec >= 12 && x.j.pj >= 3).sort((x, y) => ppDefensa(x) - ppDefensa(y));
  const nuestrasFlojas = rotA.filter(x => x.minRec >= 12 && x.j.pj >= 3).sort((x, y) => ppDefensa(x) - ppDefensa(y));
  const duelos = T.partidos.filter(p => (p.local === a.id && p.visitante === b.id) || (p.local === b.id && p.visitante === a.id));
  const comunes = ppComunes(a, b);
  const fa = ppForma(a), fb = ppForma(b);

  // ---------------------------------------------------------------- claves (frases ordenadas por lo que pesan)
  const ataque = [], defensa = [];
  const nombreFF = {efg: 'el acierto (tiro efectivo)', tov: 'las pérdidas', orb: 'el rebote ofensivo', ftr: 'los tiros libres'};
  // los cruces de factores: qué hace uno, qué concede el otro, qué se espera y qué hacer
  const ACCION = {
    efg: {w: 1, n: 'Tiro', ata: ['Hay ventaja en el tiro: buscar volumen de tiros de calidad.', 'Va a costar anotar: paciencia, mover el balón y ganar posesiones extra (rebote y pérdidas).'],
      def: ['Lo primero es defender el tiro: contestar todos y no conceder tiros liberados.', 'En este cruce les va a costar anotar: defensa paciente, que tiren tarde y forzados.']},
    tov: {w: 0.8, n: 'Pérdidas', ata: ['Se esperan pocas pérdidas: hay margen para arriesgar algo en el pase.', 'Cuidar el balón: pases seguros, no botar en tráfico y aclarar contra la presión.'],
      def: ['Van a perder pocos balones: mejor una defensa sólida que arriesgar en la presión.', 'Se espera que pierdan balones: presionar el balón y las líneas de pase.']},
    orb: {w: 0.7, n: 'Rebote ofensivo', ata: ['Ir al rebote ofensivo: habrá segundas opciones.', 'Pocas segundas opciones en este cruce: priorizar el balance defensivo.'],
      def: ['Cerrar el rebote defensivo: hacer cajas y rebotear las cinco.', 'Su rebote ofensivo no debería hacer daño: se puede salir rápido al contraataque.']},
    ftr: {w: 0.5, n: 'Tiros libres', ata: ['Atacar el aro y buscar la falta.', 'No van a llegar muchos tiros libres: no vivir de buscar la falta.'],
      def: ['No regalar faltas: defender sin manos y sin llegar tarde.', 'Se esperan pocos tiros libres suyos: se puede defender con más contacto.']},
    p3: {w: 0.6, n: 'Triple', ata: ['El triple puede ser un arma: buscar el tiro liberado.', 'El triple no promete en este cruce: buscar las ventajas dentro.'],
      def: ['Salir fuerte a las tiradoras y cerrar los pases a la esquina.', 'Su triple no debería hacer daño en este cruce: se puede ayudar más dentro.']},
    p2: {w: 0.6, n: 'Tiro de dos', ata: ['Dentro se les puede hacer daño: poste, penetraciones y cortes.', 'Dentro va a costar: abrir el campo y mover el balón.'],
      def: ['Proteger la zona: ayudas y contestar en la pintura.', 'Su tiro de dos no debería hacer daño: se puede negar el triple y conceder dentro.']},
  };
  const claveFactor = (x, atq, def, nAtq, nDef, lista, esAtaque) => {
    const ac = ACCION[x.k];
    if (!ac || x.z == null || Math.abs(x.z) < (x.k === 'p3' || x.k === 'p2' ? 0.6 : 0.4)) return;
    const bueno = x.z > 0;                       // bueno para el que ataca
    const texto = esAtaque ? ac.ata[bueno ? 0 : 1] : ac.def[bueno ? 0 : 1];
    // cuántos puntos mueve en el partido: el peso del factor en la liga, o los tiros que se juegan
    const dif = Math.abs(x.esperado - x.l);
    const pts = x.k in coef ? Math.abs(coef[x.k]) * dif * ritmo / 100 : x.k === 'p3' ? dif / 100 * 3 * (atq.med.p3a || 0) : dif / 100 * 2 * (atq.med.p2a || 0);
    lista.push({w: pts, k: x.k, t: `<b>${ac.n}.</b> ${texto} ${esc(nAtq)}: ${fmt(x.a, x.d)} (${x.ra}.º en ${esc(x.n.toLowerCase())}); ${esc(nDef)} concede ${fmt(x.dd, x.d)} (${x.rd}.º en defensa). Se espera ${fmt(x.esperado, x.d)} (liga ${fmt(x.l, x.d)})${pts >= 0.5 ? `: unos ${fmt(pts, 1)} puntos ${bueno === esAtaque ? 'a favor' : 'en contra'}` : ''}.`});
  };
  crA.forEach(x => claveFactor(x, a, b, a.nombre, b.nombre, ataque, true));
  if (zA) {
    const buenas = zA.filter(z => z.na >= 10 && z.nd >= 15 && z.esperado - z.l >= 3).sort((x, y) => (y.esperado - y.l) - (x.esperado - x.l));
    const malas = zA.filter(z => z.na >= 10 && z.nd >= 15 && z.esperado - z.l <= -3).sort((x, y) => (x.esperado - x.l) - (y.esperado - y.l));
    if (buenas.length) ataque.push({w: (buenas[0].esperado - buenas[0].l) / 100 * buenas[0].valor * buenas[0].na / a.pj + 0.3, t: `Zonas que más rinden en este cruce: ${buenas.slice(0, 2).map(z => `${z.z.toLowerCase()} (tu acierto ${fmt(z.pa, 0)} %, les meten ${fmt(z.pd, 0)} %, liga ${fmt(z.l, 0)} %)`).join(' y ')}.`});
    if (malas.length) ataque.push({w: (malas[0].l - malas[0].esperado) / 100 * malas[0].valor * malas[0].na / a.pj, t: `Evitar en lo posible: ${malas.slice(0, 2).map(z => `${z.z.toLowerCase()} (tu acierto ${fmt(z.pa, 0)} %, les meten ${fmt(z.pd, 0)} %)`).join(' y ')}.`});
  }
  if (flojas.length) {
    const f = flojas.slice(0, 2);
    ataque.push({w: 1.2, t: `Buscar los emparejamientos con ${f.map(x => `${linkJu(x.j.id)} (${esc(x.j.puesto || 'sin puesto')}${x.j.av.dbpm != null ? `, DBPM ${signo(x.j.av.dbpm, 1)}` : ''}${(x.j.p40 || {}).pf >= 4.5 ? `, ${fmt(x.j.p40.pf)} faltas por 40 min` : ''})`).join(' y ')}: son las que peor defienden de su rotación.`});
  }
  const cargadas = rotB.filter(x => (x.j.p40 || {}).pf >= 4.8 && x.minRec >= 12).slice(0, 3);
  if (cargadas.length) ataque.push({w: 0.8, t: `Cargar de faltas a ${cargadas.map(x => `${linkJu(x.j.id)} (${fmt(x.j.p40.pf)} por 40 min)`).join(', ')}: atacarlas en el uno contra uno y en el poste.`});
  // defensa: lo suyo contra mi defensa
  crB.forEach(x => claveFactor(x, b, a, b.nombre, a.nombre, defensa, false));
  if (b.ataque.p3r >= L.p3r + 4) defensa.push({w: 0.8 + (b.ataque.p3r - L.p3r) / 10, t: `Equipo de triples: el ${fmt(b.ataque.p3r, 0)} % de sus tiros son de tres (liga ${fmt(L.p3r, 0)} %), con un ${fmt(b.ataque.p3)} % de acierto. Cerrar líneas de pase y salir a las tiradoras.`});
  else if (b.ataque.p3r <= L.p3r - 4) defensa.push({w: 0.6, t: `Tiran poco de tres (${fmt(b.ataque.p3r, 0)} % de sus tiros, liga ${fmt(L.p3r, 0)} %): cerrar la zona y ayudar dentro.`});
  if (zB) {
    const fuertes = zB.filter(z => z.na >= 15 && z.fa >= 8 && z.esperado - z.l >= 2).sort((x, y) => (y.esperado - y.l) * y.fa - (x.esperado - x.l) * x.fa);
    if (fuertes.length) defensa.push({w: (fuertes[0].esperado - fuertes[0].l) / 100 * fuertes[0].valor * fuertes[0].na / b.pj + 0.3, t: `Sus zonas más peligrosas en este cruce: ${fuertes.slice(0, 2).map(z => `${z.z.toLowerCase()} (${fmt(z.fa, 0)} % de sus tiros, con un ${fmt(z.pa, 0)} % de acierto; a tu equipo le meten un ${fmt(z.pd, 0)} % desde ahí)`).join(' y ')}.`});
  }
  if (peligro.length) defensa.push({w: 2, t: `Frenar primero a ${peligro.slice(0, 2).map(x => `${linkJu(x.j.id)} (${fmt(x.j.med.pts)} pts, ${fmt(x.j.av.ts, 0)} % TS, uso ${fmt(x.j.av.usg, 0)} %)`).join(' y ')}.`});
  if (b.max_anotadora >= 24) defensa.push({w: 1.2, t: `Dependen mucho de su máxima anotadora: el ${fmt(b.max_anotadora, 0)} % de sus puntos. Ayudas y dos contra uno sobre ella.`});
  const red = b.pbp && b.pbp.red ? [...b.pbp.red].sort((x, y) => y[2] - x[2]).slice(0, 3) : [];
  if (red.length && red[0][2] >= 8) defensa.push({w: 0.6, t: `Cortar sus conexiones de pase: ${red.map(r => `${linkJu(r[0], apellido(r[0]))} → ${linkJu(r[1], apellido(r[1]))} (${r[2]} asistencias)`).join(', ')}.`});
  // situaciones de juego: contraataque, segundas opciones, tras pérdida, tiempos muertos, salidas
  const sA = ppSituaciones(a, b), sB = ppSituaciones(b, a);
  const uds = s => s.ppp ? 'puntos por posesión' : 'puntos por partido';
  const claveSitu = (x, nAtq, nDef, lista, esAtaque, tm) => {
    if (x.z == null || x.z < 0.5) return;
    const dif = x.esperado - x.l;
    const pts = x.ppp ? dif * (tm || 3) : x.k === 'perdida' ? dif * 0.6 : x.k === 'inicio' || x.k === 'descanso' ? dif * 0.5 : dif;
    const d = x.ppp ? 2 : 1, cifras = `${esc(nAtq)} ${fmt(x.h, d)} ${uds(x)} (${x.rh}.º), ${esc(nDef)} concede ${fmt(x.c, d)} (${x.rc}.º). Se espera ${fmt(x.esperado, d)} (liga ${fmt(x.l, d)})`;
    // segundas opciones y puntos tras pérdida van con su factor (rebote ofensivo, pérdidas) si ya hay clave de él
    const ya = lista.find(y => y.k === {segunda: 'orb', perdida: 'tov'}[x.k]);
    if (ya) { ya.t = ya.t.replace(/\.$/, '') + `. ${x.n}: ${cifras}.`; ya.w += pts / 2; return; }
    lista.push({w: pts + 0.2, t: `<b>${x.n}.</b> ${esAtaque ? x.ata : x.def}. ${cifras}.`});
  };
  const sit = e => e.pbp && e.pbp.situaciones;
  sA.forEach(x => claveSitu(x, a.nombre, b.nombre, ataque, true, sit(a) && sit(a).tm[0]));
  sB.forEach(x => claveSitu(x, b.nombre, a.nombre, defensa, false, sit(b) && sit(b).tm[0]));
  const bonusL = ppLigaSitu(s => s.bonus[0]);
  if (sit(b) && bonusL != null && sit(b).bonus[0] >= bonusL + 10) ataque.push({w: 0.5, t: `<b>Bonus.</b> Hacen muchas faltas: dejan al rival en bonus con 2 minutos o más por jugar en el ${fmt(sit(b).bonus[0], 0)} % de los cuartos (liga ${fmt(bonusL, 0)} %). Atacar el aro desde el principio de cada cuarto: desde la 5.ª falta, cada falta son tiros libres.`});
  if (sit(a) && bonusL != null && sit(a).bonus[0] >= bonusL + 10) defensa.push({w: 0.5, t: `<b>Bonus.</b> Tu equipo deja al rival en bonus pronto en el ${fmt(sit(a).bonus[0], 0)} % de los cuartos (liga ${fmt(bonusL, 0)} %): controlar las faltas de equipo, sobre todo lejos del aro.`});
  ataque.sort((x, y) => y.w - x.w); defensa.sort((x, y) => y.w - x.w);

  // ---------------------------------------------------------------- tiros libres: a quién no hacer falta y a quién sí
  const libres = rotB.filter(x => x.j.tot.fta >= 12 && x.minRec >= 8);
  const noFalta = [...libres].filter(x => x.j.av.ft_est >= 78).sort((x, y) => y.j.av.ft_est - x.j.av.ft_est).slice(0, 3);
  const siFalta = [...libres].filter(x => x.j.av.ft_est <= 66).sort((x, y) => x.j.av.ft_est - y.j.av.ft_est).slice(0, 3);
  const ritmoTexto = margen > 2
    ? `Partido de ${fmt(ritmo, 0)} posesiones esperadas. Siendo favorito, más posesiones te favorecen (menos peso de la suerte): ${a.ritmo < b.ritmo ? 'aunque tu equipo juega más lento, no temas correr' : 'mantén tu ritmo alto'}.`
    : margen < -2 ? `Partido de ${fmt(ritmo, 0)} posesiones esperadas. Siendo menos favorito, conviene un partido de pocas posesiones: ataques largos, balance defensivo y evitar el intercambio de canastas${b.ritmo > a.ritmo ? ` (ellos juegan más rápido: ${fmt(b.ritmo, 0)} frente a ${fmt(a.ritmo, 0)})` : ''}.`
    : `Partido igualado de ${fmt(ritmo, 0)} posesiones esperadas: el ritmo lo marcará quien imponga el suyo (${A} ${fmt(a.ritmo, 0)}, ${B} ${fmt(b.ritmo, 0)}).`;

  // ---------------------------------------------------------------- puntos fuertes y débiles de cada uno frente al otro
  const frase = (x, atq, def, nAtq, nDef) => {
    const dir = x.mas ? '' : ' (menos es mejor)';
    return `<b>${esc(x.n)}</b>: ${nAtq} ${fmt(x.a, x.d)}${x.ra ? ` (${x.ra}.º)` : ''} · lo que concede ${nDef} ${fmt(x.dd, x.d)}${x.rd ? ` (${x.rd}.º)` : ''} → en el partido, <b>${fmt(x.esperado, x.d)}</b> (liga ${fmt(x.l, x.d)})${dir}`;
  };
  const extra = (e, otro, propio) => {
    // lo que no es un cruce directo: banquillo, finales, cuartos, casa y fuera, dependencia, altura, forma
    const f = [], d = [];
    const pctl = (k) => { const m = MEK[k]; return m ? percentil(m.v(e), IDX.jugadas.map(m.v).filter(v => v != null), m.inv) : null; };
    if (pctl('banq_pts') >= 75 && e.banquillo.pts > otro.banquillo.pts + 4) f.push(`Banquillo: ${fmt(e.banquillo.pts)} puntos por partido de sus suplentes (${fmt(otro.banquillo.pts)} el otro).`);
    if (pctl('banq_pts') <= 25 && e.banquillo.pts < otro.banquillo.pts - 4) d.push(`Banquillo corto: ${fmt(e.banquillo.pts)} puntos de sus suplentes (${fmt(otro.banquillo.pts)} el otro); el ${fmt(e.top5_min, 0)} % de los minutos son de cinco jugadoras.`);
    if (e.pbp && e.pbp.final_apretado && e.pbp.final_apretado.net != null && e.pbp.final_apretado.pos >= 40) {
      if (e.pbp.final_apretado.net >= 10) f.push(`Finales apretados: ${signo(e.pbp.final_apretado.net, 1)} por 100 posesiones en los últimos 5 minutos con ±5.`);
      if (e.pbp.final_apretado.net <= -10) d.push(`Finales apretados: ${signo(e.pbp.final_apretado.net, 1)} por 100 posesiones en los últimos 5 minutos con ±5.`);
    }
    if (e.igualados && e.igualados[0] + e.igualados[1] >= 3) {
      const p = e.igualados[0] / (e.igualados[0] + e.igualados[1]);
      if (p >= 0.65) f.push(`Gana los partidos igualados: ${vd(e.igualados)} en los decididos por 5 puntos o menos.`);
      if (p <= 0.35) d.push(`Pierde los partidos igualados: ${vd(e.igualados)} en los decididos por 5 puntos o menos.`);
    }
    const lado = propio === 'casa' ? ['local', 'neto_local', 'en casa'] : propio === 'fuera' ? ['fuera', 'neto_fuera', 'fuera de casa'] : null;
    if (lado && e[lado[0]] && e[lado[0]][0] + e[lado[0]][1] >= 2) {
      const n = e[lado[1]];
      if (n != null && n - e.net >= 6) f.push(`Rinde más ${lado[2]}: ${vd(e[lado[0]])} y neto ${signo(n, 1)} (${signo(e.net, 1)} en total).`);
      if (n != null && e.net - n >= 6) d.push(`Rinde menos ${lado[2]}: ${vd(e[lado[0]])} y neto ${signo(n, 1)} (${signo(e.net, 1)} en total).`);
    }
    const q = (e.cuartos || []).map(c => c[0] != null ? c[0] - c[1] : null);
    const qo = (otro.cuartos || []).map(c => c[0] != null ? c[0] - c[1] : null);
    q.forEach((v, i) => { if (v == null || qo[i] == null) return;
      if (v - qo[i] >= 3) f.push(`${i + 1}.º cuarto: ${signo(v, 1)} de media (el otro, ${signo(qo[i], 1)}).`);
      if (qo[i] - v >= 3) d.push(`${i + 1}.º cuarto: ${signo(v, 1)} de media (el otro, ${signo(qo[i], 1)}).`); });
    if (e.altura_media && otro.altura_media && e.altura_media - otro.altura_media >= 3) f.push(`Más altura: ${fmt(e.altura_media, 0)} cm de media por minutos, ${fmt(e.altura_media - otro.altura_media, 0)} más que el otro.`);
    const fm = ppForma(e);
    if (fm.ps.length >= 3 && fm.net != null && e.net != null) {
      if (fm.net - e.net >= 6) f.push(`Llega en buena forma: ${fm.v}-${fm.ps.length - fm.v} y neto ${signo(fm.net, 1)} en los últimos ${fm.ps.length} (${signo(e.net, 1)} en la temporada).`);
      if (e.net - fm.net >= 6) d.push(`Llega a la baja: ${fm.v}-${fm.ps.length - fm.v} y neto ${signo(fm.net, 1)} en los últimos ${fm.ps.length} (${signo(e.net, 1)} en la temporada).`);
    }
    if (e.max_anotadora >= 25) d.push(`Depende de una sola jugadora: el ${fmt(e.max_anotadora, 0)} % de sus puntos los mete la máxima anotadora.`);
    return {f, d};
  };
  const otroLado = venue === 'casa' ? 'fuera' : venue === 'fuera' ? 'casa' : null;
  const exA = extra(a, b, venue === 'neutral' ? null : venue), exB = extra(b, a, otroLado);
  const lado = (cr, nAtq, nDef, signoZ) => cr.filter(x => x.z != null && signoZ * x.z >= 0.4).sort((x, y) => signoZ * (y.z - x.z)).map(x => frase(x, null, null, nAtq, nDef));
  const fuertesA = [...lado(crA, 'tu ataque', 'su defensa', 1), ...lado(crB, 'su ataque', 'tu defensa', -1).map(s => s.replace('<b>', '<b>En defensa · ')), ...exA.f.map(esc)];
  const debilesA = [...lado(crA, 'tu ataque', 'su defensa', -1), ...lado(crB, 'su ataque', 'tu defensa', 1).map(s => s.replace('<b>', '<b>En defensa · ')), ...exA.d.map(esc)];
  const fuertesB = [...lado(crB, 'su ataque', 'tu defensa', 1), ...lado(crA, 'tu ataque', 'su defensa', -1).map(s => s.replace('<b>', '<b>En defensa · ')), ...exB.f.map(esc)];
  const debilesB = [...lado(crB, 'su ataque', 'tu defensa', -1), ...lado(crA, 'tu ataque', 'su defensa', 1).map(s => s.replace('<b>', '<b>En defensa · ')), ...exB.d.map(esc)];
  const listaLi = (l, vacio) => l.length ? `<ul>${l.map(x => `<li>${x}</li>`).join('')}</ul>` : `<p class="tenue">${vacio}</p>`;

  // ---------------------------------------------------------------- piezas
  const pocos = Math.min(a.pj, b.pj) < 5 ? `<p class="aviso">Hay pocos partidos jugados (${a.pj} y ${b.pj}): las cifras todavía se mueven mucho y el informe es orientativo.</p>` : '';
  const favorito = margen >= 0 ? A : B;
  const lugar = venue === 'casa' ? `en casa de ${A}` : venue === 'fuera' ? `en casa de ${B}` : 'en campo neutral';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dia = (prog && ppFecha(prog.fecha)) || hoy, dsA = ppDescanso(a, dia), dsB = ppDescanso(b, dia);
  const dias = n => n === 1 ? '1 día' : `${n} días`;
  const descansoTexto = dsA != null && dsB != null ? `Descanso: ${A} llega con ${dias(dsA)} desde su último partido y ${B} con ${dias(dsB)}${Math.abs(dsA - dsB) >= 3 ? ` (${dsA > dsB ? A : B} más descansado)` : ''}.` : '';
  const hoja = `<div class="tarjeta seccion pp-hoja"><h2>Hoja para el banquillo</h2>
    <p><b>${A}</b> - <b>${B}</b>, ${punto(lugar + (prog ? ` · jornada ${prog.jornada}${prog.fecha ? ', ' + esc(prog.fecha) : ''}` : ''))} Probabilidad de que gane ${A}: <b>${fmt(100 * prob, 0)} %</b>. Marcador esperado: <b>${fmt(ptsA, 0)} - ${fmt(ptsB, 0)}</b> (${favorito} por ${fmt(Math.abs(margen), 1)}).</p>
    <div class="rejilla-2"><div><h3>En ataque</h3><ol>${ataque.slice(0, 5).map(x => `<li>${x.t}</li>`).join('') || '<li class="tenue">Sin claves claras: cruce muy parejo.</li>'}</ol></div>
      <div><h3>En defensa</h3><ol>${defensa.slice(0, 5).map(x => `<li>${x.t}</li>`).join('') || '<li class="tenue">Sin claves claras.</li>'}</ol></div></div>
    <div class="rejilla-2"><div><h3>Vigilar</h3><ul>${peligro.slice(0, 4).map(x => { const et = ppEtiquetas(x, base, otroLado).filter(e => e.tipo === 'peligro').slice(0, 2).map(e => e.t);
        const meta = [x.j.puesto, /\d/.test(x.j.dorsal || '') ? '#' + x.j.dorsal : ''].filter(Boolean).join(' · ');
        return `<li>${linkJu(x.j.id)}${meta ? ` <span class="muy-tenue">${esc(meta)}</span>` : ''}: ${fmt(x.j.med.pts)} pts, ${fmt(x.j.med.trb)} reb, ${fmt(x.j.med.ast)} ast${et.length ? '. ' + et.join('. ') : ''}.</li>`; }).join('')}</ul></div>
      <div><h3>Ritmo y faltas</h3><ul><li>${ritmoTexto}</li>${descansoTexto ? `<li>${descansoTexto}</li>` : ''}
        ${noFalta.length ? `<li>No hacer falta a ${noFalta.map(x => `${linkJu(x.j.id, apellido(x.j.id))} (${fmt(x.j.av.ft, 0)} % TL)`).join(', ')}.</li>` : ''}
        ${siFalta.length ? `<li>Si hay que hacer falta al final: ${siFalta.map(x => `${linkJu(x.j.id, apellido(x.j.id))} (${fmt(x.j.av.ft, 0)} % TL)`).join(', ')}.</li>` : ''}
        ${pb.some(x => x.ausente) ? `<li>Posibles bajas suyas: ${pb.filter(x => x.ausente).map(x => `${linkJu(x.j.id)} (${fmt(x.j.med.min, 0)} min de media, sin jugar los últimos ${x.sinJugar})`).join(', ')}.</li>` : ''}
        ${pa.some(x => x.ausente) ? `<li>Tuyas sin jugar los últimos partidos: ${pa.filter(x => x.ausente).map(x => linkJu(x.j.id)).join(', ')}.</li>` : ''}</ul></div></div></div>`;

  const pron = `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>Pronóstico</h2>
      <div class="cifras">${cifra(fmt(100 * prob, 0) + ' %', 'Probabilidad de que gane ' + A)}${cifra(`${fmt(ptsA, 0)} - ${fmt(ptsB, 0)}`, 'Marcador esperado')}${cifra(signo(margen, 1), 'Margen esperado')}${cifra(fmt(ritmo, 0), 'Posesiones esperadas', 'Ritmo de los dos frente a la media de la liga')}</div>
      <div class="barra-prob" style="margin-top:.75rem"><i style="width:${100 * prob}%"></i></div>
      <p class="muy-tenue">${conModelo ? `Probabilidad y margen: modelo de la web para el partido programado (fuerza de cada equipo y ventaja de campo). ` : ''}Por ataque y defensa ajustados por rival: ${A} ${fmt(oa)} y ${fmt(da)}, ${B} ${fmt(ob)} y ${fmt(db)} (puntos por 100 posesiones), ${venue === 'neutral' ? 'sin ventaja de campo' : `con ${fmt(LG.campo, 1)} puntos de ventaja de campo`}: margen ${signo(margenRat, 1)}. Desviación de los partidos de la liga: ±${fmt(LG.sigma, 0)} puntos.</p>
      <div class="cifras">${cifra(`${a.pg}-${a.pj - a.pg}`, A)}${cifra(`${b.pg}-${b.pj - b.pg}`, B)}${cifra(racha(a.racha), 'Racha ' + A)}${cifra(racha(b.racha), 'Racha ' + B)}</div></div>
    <div class="tarjeta"><h2>Dónde se decide</h2>${barrasH(ff.filter(x => x.pts != null).map(x => ({n: ({efg: 'Acierto', tov: 'Pérdidas', orb: 'Rebote of.', ftr: 'Tiros libres'})[x.k], v: x.pts, texto: signo(x.pts, 1) + ' pts',
        tip: `${esc(nombreFF[x.k])}: ${A} ${fmt(x.ea)} · ${B} ${fmt(x.eb)} (esperado en el partido)`})))}
      <p class="muy-tenue">Puntos de ventaja (a la derecha, para ${A}; a la izquierda, para ${B}) que da cada uno de los cuatro factores, con lo que se espera de cada equipo en este cruce y lo que pesa cada factor en esta liga${T.decide ? ` (explica el ${fmt(100 * T.decide.r2, 0)} % de los resultados)` : ''}. Total: ${signo(ff.reduce((s, x) => s + (x.pts || 0), 0) + campo, 1)} con la ventaja de campo.</p></div></div>`;

  const tablaCruce = (cr, nAtq, nDef, atq, def) => `<div class="tabla-scroll"><table class="pp-tabla"><thead><tr><th class="izq"></th><th title="Lo que hace ${esc(nAtq)} en ataque (y su puesto en la liga)">Ataque</th><th title="Lo que concede ${esc(nDef)} en defensa (y su puesto)">Concede</th><th>Esperado</th><th>Liga</th><th class="izq">Ventaja</th></tr></thead><tbody>
    ${cr.map(x => { const v = x.z == null ? '<span class="muy-tenue">–</span>' : x.z >= 0.4 ? `<span class="v">${esc(atq)}</span>` : x.z <= -0.4 ? `<span class="d">${esc(def)}</span>` : '<span class="muy-tenue">pareja</span>';
      return `<tr><td class="izq">${esc(x.n)}${x.mas === false ? ' <span class="muy-tenue">(menos, mejor)</span>' : ''}</td><td>${fmt(x.a, x.d)} <span class="muy-tenue">${x.ra ? x.ra + '.º' : ''}</span></td><td>${fmt(x.dd, x.d)} <span class="muy-tenue">${x.rd ? x.rd + '.º' : ''}</span></td><td><b>${fmt(x.esperado, x.d)}</b></td><td class="muy-tenue">${fmt(x.l, x.d)}</td><td class="izq">${v}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  const cruces = `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>Tu ataque contra su defensa</h2><p class="muy-tenue pp-sub">Ataque: ${A} · Concede: ${B}</p>${tablaCruce(crA, a.nombre, b.nombre, a.nombre, b.nombre)}</div>
    <div class="tarjeta"><h2>Su ataque contra tu defensa</h2><p class="muy-tenue pp-sub">Ataque: ${B} · Concede: ${A}</p>${tablaCruce(crB, b.nombre, a.nombre, b.nombre, a.nombre)}</div></div>
    <p class="muy-tenue">Esperado: lo que hace el que ataca más lo que concede el que defiende menos la media de la liga. El puesto es entre los ${IDX.jugadas.length} equipos (1.º, el mejor en eso; en lo que concede, 1.º es la defensa que menos concede). «Pareja»: diferencia pequeña frente a lo que varían los equipos de la liga.</p>`;

  const fyd = `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>${A}: puntos fuertes frente a ${B}</h2>${listaLi(fuertesA, 'Nada destaca a favor en este cruce.')}<h2 style="margin-top:1rem">${A}: puntos débiles frente a ${B}</h2>${listaLi(debilesA, 'Nada destaca en contra en este cruce.')}</div>
    <div class="tarjeta"><h2>${B}: puntos fuertes frente a ${A}</h2>${listaLi(fuertesB, 'Nada destaca a su favor en este cruce.')}<h2 style="margin-top:1rem">${B}: puntos débiles frente a ${A}</h2>${listaLi(debilesB, 'Nada destaca en su contra en este cruce.')}</div></div>`;

  const plan = `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>Plan de ataque: cómo hacerles daño</h2>${ataque.length ? `<ol>${ataque.map(x => `<li>${x.t}</li>`).join('')}</ol>` : '<p class="tenue">Cruce muy parejo: ninguna ventaja clara.</p>'}
      ${titB.length ? `<h3>Su quinteto titular probable</h3><p>${titB.map(x => `${linkJu(x.j.id)} <span class="muy-tenue">(${esc(puestoCorto(x.j.puesto))}${x.j.altura ? ', ' + x.j.altura + ' cm' : ''})</span>`).join(' · ')}</p>` : ''}</div>
    <div class="tarjeta"><h2>Plan de defensa: cómo frenarles</h2>${defensa.length ? `<ol>${defensa.map(x => `<li>${x.t}</li>`).join('')}</ol>` : '<p class="tenue">Sin claves claras.</p>'}
      ${nuestrasFlojas.length ? `<h3>Ojo con tus emparejamientos</h3><p>Las de tu rotación que peor defienden por sus cifras: ${nuestrasFlojas.slice(0, 2).map(x => `${linkJu(x.j.id)}${x.j.av.dbpm != null ? ` (DBPM ${signo(x.j.av.dbpm, 1)})` : ''}`).join(' y ')}. Si el rival las busca, ayudas preparadas.</p>` : ''}</div></div>`;

  // zonas de tiro
  const tablaZ = (zs, nAtq, nDef) => `<div class="tabla-scroll"><table class="pp-tabla"><thead><tr><th class="izq"></th><th colspan="2" class="pp-grupo">Tira ${esc(nAtq)}</th><th colspan="2" class="pp-grupo">Defiende ${esc(nDef)}</th><th colspan="3" class="pp-grupo">En el partido</th></tr>
    <tr><th class="izq">Zona</th><th title="% de sus tiros desde ahí">% tiros</th><th>Acierto</th><th title="% de los tiros de sus rivales desde ahí">% tiros</th><th title="Acierto de sus rivales desde ahí">Le meten</th><th>Esperado</th><th>Liga</th><th title="Puntos por tiro desde ahí en este cruce">Pts/tiro</th></tr></thead><tbody>
    ${zs.map(z => `<tr><td class="izq">${esc(z.z)}</td><td>${fmt(z.fa, 0)} %</td><td>${fmt(z.pa, 0)} % <span class="muy-tenue">(${z.aa}/${z.na})</span></td><td>${fmt(z.fd, 0)} %</td><td>${fmt(z.pd, 0)} % <span class="muy-tenue">(${z.ad}/${z.nd})</span></td>
      <td><b class="${z.esperado - z.l >= 3 ? 'v' : z.esperado - z.l <= -3 ? 'd' : ''}">${fmt(z.esperado, 0)} %</b></td><td class="muy-tenue">${fmt(z.l, 0)} %</td><td>${fmt(z.pps, 2)}</td></tr>`).join('')}</tbody></table></div>`;
  const zonas = zA && zB ? `<div class="tarjeta seccion"><h2>Zonas de tiro cruzadas</h2>
      <h3>Tu ataque contra su defensa</h3>${tablaZ(zA, a.nombre, b.nombre)}
      <h3 style="margin-top:1rem">Su ataque contra tu defensa</h3>${tablaZ(zB, b.nombre, a.nombre)}
      <p class="muy-tenue">Esperado: acierto del que tira más lo que le meten al que defiende desde esa zona, menos la media de la liga (con los dos aciertos acercados a la media cuando hay pocos tiros). En verde, 3 puntos o más por encima de la liga; en rojo, por debajo. Pts por tiro: lo que vale de media un tiro desde ahí en este cruce.</p></div>
    <div class="tarjeta seccion"><h2>Mapas de tiro</h2><div class="pp-mapas">
      <div><h3>Desde dónde tira ${A}</h3>${mapaCalorTiro(a.pbp.tiros || [], 'frecuencia', 'Tiros de ' + A, false)}</div>
      <div><h3>Dónde le meten a ${B}</h3>${mapaCalorTiro(b.pbp.tiros_rival || [], 'acierto', 'Tiros de los rivales de ' + B, true)}</div>
      <div><h3>Desde dónde tira ${B}</h3>${mapaCalorTiro(b.pbp.tiros || [], 'frecuencia', 'Tiros de ' + B, false)}</div>
      <div><h3>Dónde le meten a ${A}</h3>${mapaCalorTiro(a.pbp.tiros_rival || [], 'acierto', 'Tiros de los rivales de ' + A, true)}</div></div>
      <p class="muy-tenue">Frecuencia: más intenso, más tiros desde ese cuadro de 1 × 1 m. Lo que le meten: azul, sus rivales aciertan menos que la media de la liga desde ahí (buena defensa); rojo, más (por ahí se le puede atacar). Pasa el ratón por un cuadro para ver las cifras.</p></div>`
    : '<div class="tarjeta seccion"><h2>Zonas de tiro</h2><p class="tenue">Esta temporada no tiene el gráfico de tiro de los dos equipos: no se pueden cruzar las zonas.</p></div>';

  // duelos por puesto
  const filaDuelo = (x, y) => {
    const ja = x && x.j, jb = y && y.j;
    const celda = (j, k, d = 1) => j ? fmt(MJK[k].v(j), d) : '–';
    const mejor = ja && jb && ja.av.bpm != null && jb.av.bpm != null ? (ja.av.bpm - jb.av.bpm >= 2 ? 'a' : jb.av.bpm - ja.av.bpm >= 2 ? 'b' : '') : '';
    const alt = ja && jb && ja.altura && jb.altura ? ja.altura - jb.altura : null;
    const nota = [mejor === 'a' ? `<span class="v">ventaja ${esc(apellido(ja.id))}</span>` : mejor === 'b' ? `<span class="d">ventaja ${esc(apellido(jb.id))}</span>` : '',
      alt != null && Math.abs(alt) >= 6 ? `${alt > 0 ? esc(apellido(ja.id)) : esc(apellido(jb.id))} +${Math.abs(alt)} cm` : ''].filter(Boolean).join(' · ');
    return `<tr><td class="izq">${ja ? linkJu(ja.id) : '–'}<br><span class="muy-tenue">${ja ? esc(ja.puesto || '') + (ja.altura ? ' · ' + ja.altura + ' cm' : '') : ''}</span></td>
      <td>${celda(ja, 'pts')}</td><td>${celda(ja, 'trb')}</td><td>${celda(ja, 'ast')}</td><td>${celda(ja, 'ts')}</td><td>${celda(ja, 'bpm')}</td>
      <td class="izq" style="white-space:normal">${nota || '<span class="muy-tenue">pareja</span>'}</td>
      <td>${celda(jb, 'bpm')}</td><td>${celda(jb, 'ts')}</td><td>${celda(jb, 'ast')}</td><td>${celda(jb, 'trb')}</td><td>${celda(jb, 'pts')}</td>
      <td class="izq">${jb ? linkJu(jb.id) : '–'}<br><span class="muy-tenue">${jb ? esc(jb.puesto || '') + (jb.altura ? ' · ' + jb.altura + ' cm' : '') : ''}</span></td></tr>`;
  };
  const banA = rotA.filter(x => !titA.includes(x)).slice(0, 4).sort((x, y) => ppPos(x.j) - ppPos(y.j));
  const banB = rotB.filter(x => !titB.includes(x)).slice(0, 4).sort((x, y) => ppPos(x.j) - ppPos(y.j));
  const cab = '<th>Pts</th><th>Reb</th><th>Ast</th><th>TS%</th><th>BPM</th>';
  const duelosHtml = `<div class="tarjeta seccion"><h2>Duelos por puesto</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">${A}</th>${cab}<th class="izq"></th>${cab.split('</th>').filter(Boolean).reverse().map(x => x + '</th>').join('')}<th class="izq">${B}</th></tr></thead>
    <tbody><tr><td class="izq" colspan="13"><b>Titulares probables</b></td></tr>${[0, 1, 2, 3, 4].map(i => filaDuelo(titA[i], titB[i])).join('')}
    ${banA.length || banB.length ? `<tr><td class="izq" colspan="13"><b>Banquillo</b></td></tr>${[0, 1, 2, 3].filter(i => banA[i] || banB[i]).map(i => filaDuelo(banA[i], banB[i])).join('')}` : ''}</tbody></table></div>
    <p class="muy-tenue">Titulares probables: las que más han salido de inicio en los últimos cinco partidos, ordenadas por puesto (de base a pívot) y emparejadas así. Ventaja: 2 puntos de BPM o más de diferencia. Por partido; TS%: tiro real.</p></div>`;

  // fichas de las jugadoras del rival
  const ficha = (x, venueJ) => {
    const j = x.j, et = ppEtiquetas(x, base, venueJ);
    const col = {peligro: 'var(--rojo)', debil: 'var(--gana)', info: 'var(--texto-3)'};
    const ult = x.ultimos.length ? x.ultimos.map(m => m ? Math.round(m) : '–').join(' · ') : '';
    return `<div class="tarjeta pp-ficha"><div class="encabezado" style="margin:0"><div><h3 style="margin:0">${/\d/.test(j.dorsal || '') ? `<span class="muy-tenue">#${esc(j.dorsal)}</span> ` : ''}${linkJu(j.id)}</h3>
        <div class="muy-tenue">${esc(j.puesto || 'Sin puesto')}${j.altura ? ' · ' + j.altura + ' cm' : ''}${j.edad ? ' · ' + j.edad + ' años' : ''}${j.nacionalidad ? ' · ' + esc(j.nacionalidad) : ''}</div></div></div>
      <div class="pp-mini">${[[fmt(j.med.min, 0), 'Min'], [fmt(j.med.pts), 'Pts'], [fmt(j.med.trb), 'Reb'], [fmt(j.med.ast), 'Ast'], [fmt(j.av.ts, 0) + ' %', 'TS%'], [fmt(j.av.usg, 0) + ' %', 'Uso'],
        [j.tot.p3a ? `${j.tot.p3}/${j.tot.p3a}` : '–', 'Triples'], [j.tot.fta ? fmt(j.av.ft, 0) + ' %' : '–', 'TL%'], [fmt((j.p40 || {}).pf), 'Faltas/40']].map(([v, n]) => `<div><b>${v}</b><span>${n}</span></div>`).join('')}</div>
      ${et.length ? `<ul class="pp-etiquetas">${et.map(e => `<li style="--c:${col[e.tipo]}">${e.t}</li>`).join('')}</ul>` : ''}
      ${ult ? `<p class="muy-tenue" style="margin:.3rem 0 0">Minutos en los últimos partidos: ${ult}</p>` : ''}</div>`;
  };
  const fichasB = `<div class="seccion"><h2>${B}: ${enGenero('jugadoras')} una a una</h2><p class="muy-tenue">Su rotación de los últimos partidos, de más a menos peligro. En rojo, lo que hay que frenar; en verde, por dónde se le puede atacar.</p>
    <div class="pp-fichas">${peligro.map(x => ficha(x, otroLado)).join('')}</div>
    ${pb.filter(x => x.ausente).length ? `<p class="muy-tenue">Sin jugar los últimos partidos: ${pb.filter(x => x.ausente).map(x => linkJu(x.j.id)).join(', ')}.</p>` : ''}</div>`;
  // la rotación del rival de un vistazo (las fichas de abajo la desarrollan): sus cifras y cómo jugarle a cada una
  const suRotacion = `<div class="tarjeta seccion"><h2>${B}: su rotación para este partido</h2><div class="tabla-scroll"><table><thead><tr><th class="izq">${enGenero('Jugadora')}</th><th>Pos.</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>TS%</th><th>T3%</th><th>TL%</th><th>Faltas/40</th><th class="izq">Cómo jugarle</th></tr></thead><tbody>
    ${rotB.map(x => { const j = x.j, et = ppEtiquetas(x, base, otroLado).filter(e => e.tipo !== 'info' || /baja|racha|casa|Fuera/.test(e.t)).slice(0, 3);
      return `<tr><td class="izq">${linkJu(j.id)}</td><td>${esc(puestoCorto(j.puesto))}</td><td>${fmt(x.minRec, 0)}</td><td>${fmt(j.med.pts)}</td><td>${fmt(j.med.trb)}</td><td>${fmt(j.med.ast)}</td><td>${fmt(j.av.ts, 0)}</td><td>${j.tot.p3a ? fmt(j.av.p3, 0) : '–'}</td><td>${j.tot.fta ? fmt(j.av.ft, 0) : '–'}</td><td>${fmt((j.p40 || {}).pf)}</td>
        <td class="izq" style="white-space:normal">${et.map(e => e.t).join('. ') || '<span class="muy-tenue">–</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="muy-tenue">Min: media de los últimos cinco partidos. ${(n => n.length ? `Para cargarlas de faltas: ${n.join(', ')} ${n.length > 1 ? 'hacen' : 'hace'} casi 5 por 40 minutos.` : 'Nadie de su rotación se carga especialmente de faltas.')(rotB.filter(x => (x.j.p40 || {}).pf >= 4.8).map(x => esc(apellido(x.j.id))))}</p></div>`;

  // quintetos y rotación
  const qs = e => e.pbp && e.pbp.quintetos ? e.pbp.quintetos : [];
  const filaQ = q => `<tr><td class="izq" style="white-space:normal">${q.jugadoras.map(x => linkJu(x, apellido(x))).join(' · ')}</td><td>${fmt(q.min, 0)}</td><td>${fmt(q.ortg, 0)}</td><td>${fmt(q.drtg, 0)}</td><td><b>${signo(q.net, 1)}</b></td></tr>`;
  const tablaQ = l => l.length ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">Quinteto</th><th>Min</th><th>Ataque</th><th>Defensa</th><th>Neto</th></tr></thead><tbody>${l.map(filaQ).join('')}</tbody></table></div>` : '<p class="tenue">Sin datos.</p>';
  const conMin = l => l.filter(q => q.min >= 10 && q.net != null);
  const quint = qs(b).length ? `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>${B}: sus quintetos</h2><h3>Más usados</h3>${tablaQ(qs(b).slice(0, 4))}
      <h3 style="margin-top:.75rem">Los que mejor les funcionan</h3>${tablaQ([...conMin(qs(b))].sort((x, y) => y.net - x.net).slice(0, 3))}
      <h3 style="margin-top:.75rem">Los que peor (para buscarlos)</h3>${tablaQ([...conMin(qs(b))].sort((x, y) => x.net - y.net).slice(0, 3))}</div>
    <div class="tarjeta"><h2>${A}: tus quintetos</h2><h3>Más usados</h3>${tablaQ(qs(a).slice(0, 4))}
      <h3 style="margin-top:.75rem">Los que mejor te funcionan</h3>${tablaQ([...conMin(qs(a))].sort((x, y) => y.net - x.net).slice(0, 4))}
      ${red.length ? `<h3 style="margin-top:.75rem">Sus conexiones de pase</h3>${barrasH(red.map(r => ({n: `${linkJu(r[0], apellido(r[0]))} → ${linkJu(r[1], apellido(r[1]))}`, v: r[2], texto: r[2] + ' ast'})), {d: 0})}` : ''}</div></div>
    <p class="muy-tenue">Ataque, defensa y neto: puntos por 100 posesiones con ese quinteto en pista (del jugada a jugada). Mejores y peores: mínimo 10 minutos juntas.</p>` : '';

  // cómo van sus partidos
  const filaComo = (n, f, d = 1, inv) => { const x = f(a), y = f(b), mejor = x == null || y == null || x === y || typeof x === 'string' ? '' : (x > y) !== !!inv ? 'a' : 'b';
    return `<tr><td class="izq">${n}</td><td class="${mejor === 'a' ? 'v' : ''}">${typeof x === 'string' ? x : fmt(x, d)}</td><td class="${mejor === 'b' ? 'v' : ''}">${typeof y === 'string' ? y : fmt(y, d)}</td></tr>`; };
  const wl = k => e => e[k] && e[k][0] + e[k][1] ? `${e[k][0]}-${e[k][1]}` : '–';
  const como = `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>Cómo van sus partidos</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>${A}</th><th>${B}</th></tr></thead><tbody>
      ${(a.cuartos || []).map((_, i) => filaComo(`${i + 1}.º cuarto (diferencia media)`, e => e.cuartos && e.cuartos[i] && e.cuartos[i][0] != null ? e.cuartos[i][0] - e.cuartos[i][1] : null)).join('')}
      ${filaComo('Al descanso (diferencia media)', e => e.descanso_medio)}
      ${filaComo('Ganando al descanso', wl('gana_al_descanso'))}${filaComo('Perdiendo al descanso', wl('pierde_al_descanso'))}
      ${filaComo('Partidos igualados (≤ 5)', wl('igualados'))}${filaComo('Prórrogas', wl('prorrogas'))}
      ${filaComo('En casa', wl('local'))}${filaComo('Fuera', wl('fuera'))}${filaComo('Neto en casa', e => e.neto_local)}${filaComo('Neto fuera', e => e.neto_fuera)}
      ${filaComo('Contra la mitad de arriba', wl('vs_arriba'))}${filaComo('Contra la mitad de abajo', wl('vs_abajo'))}
      ${a.pbp && b.pbp ? filaComo('Neto en finales apretados', e => e.pbp && e.pbp.final_apretado ? e.pbp.final_apretado.net : null) + filaComo('Mayor parcial a favor (media)', e => e.pbp && e.pbp.parciales ? e.pbp.parciales.mayor_favor : null)
        + filaComo('Mayor parcial en contra (media)', e => e.pbp && e.pbp.parciales ? e.pbp.parciales.mayor_contra : null, 1, true) : ''}
      ${filaComo('Irregularidad (desv. del margen)', e => e.consistencia, 1, true)}</tbody></table></div>
      <p class="muy-tenue">En verde, lo mejor de los dos (los textos de victorias y derrotas no se colorean). Los cuartos dicen cuándo aprieta cada uno: buen momento para los tiempos muertos y los cambios.</p></div>
    <div class="tarjeta"><h2>Por cuartos</h2><div class="leyenda"><span style="--c:var(--serie-1)">${A}</span><span style="--c:var(--serie-2)">${B}</span></div>
      ${barrasH((a.cuartos || []).flatMap((c, i) => [
        {n: `${i + 1}.º · ${A}`, v: c[0] != null ? c[0] - c[1] : null, texto: c[0] != null ? `${fmt(c[0])}-${fmt(c[1])} (${signo(c[0] - c[1], 1)})` : '–', color: 'var(--serie-1)'},
        {n: `${i + 1}.º · ${B}`, v: b.cuartos && b.cuartos[i] && b.cuartos[i][0] != null ? b.cuartos[i][0] - b.cuartos[i][1] : null, texto: b.cuartos && b.cuartos[i] && b.cuartos[i][0] != null ? `${fmt(b.cuartos[i][0])}-${fmt(b.cuartos[i][1])} (${signo(b.cuartos[i][0] - b.cuartos[i][1], 1)})` : '–', color: 'var(--serie-2)'}]), {d: 1})}
      <h3 style="margin-top:1rem">Banquillo y rotación</h3><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>${A}</th><th>${B}</th></tr></thead><tbody>
        ${filaComo('Puntos del banquillo', e => e.banquillo && e.banquillo.pts)}${filaComo('% de minutos del banquillo', e => e.banquillo && e.banquillo.pct_min)}
        ${filaComo('% de minutos de las 5 que más juegan', e => e.top5_min, 1, true)}${filaComo('% de puntos de la máxima anotadora', e => e.max_anotadora, 1, true)}
        ${filaComo('Altura media (cm, por minutos)', e => e.altura_media, 0)}${filaComo('Edad media (por minutos)', e => e.edad_media)}
        ${filaComo('Faltas por partido', e => e.med.pf, 1, true)}${filaComo('Tiros libres que conceden por partido', e => e.med_rival.fta, 1, true)}</tbody></table></div></div></div>`;

  // situaciones de juego, tiempos muertos y faltas
  const tablaSitu = (ss, atq, def) => `<div class="tabla-scroll"><table class="pp-tabla"><thead><tr><th class="izq"></th><th>Hace</th><th>Concede</th><th>Esperado</th><th>Liga</th><th class="izq">Ventaja</th></tr></thead><tbody>
    ${ss.map(x => { const d = x.ppp ? 2 : 1, v = x.z == null ? '<span class="muy-tenue">–</span>' : x.z >= 0.4 ? `<span class="v">${esc(atq)}</span>` : x.z <= -0.4 ? `<span class="d">${esc(def)}</span>` : '<span class="muy-tenue">pareja</span>';
      return `<tr><td class="izq" data-tip="${esc(x.i)}">${esc(x.n)}${x.ppp ? ' <span class="muy-tenue">(por posesión)</span>' : ''}</td><td>${fmt(x.h, d)} <span class="muy-tenue">${x.rh ? x.rh + '.º' : ''}</span></td><td>${fmt(x.c, d)} <span class="muy-tenue">${x.rc ? x.rc + '.º' : ''}</span></td><td><b>${fmt(x.esperado, d)}</b></td><td class="muy-tenue">${fmt(x.l, d)}</td><td class="izq">${v}</td></tr>`; }).join('')}</tbody></table></div>`;
  const hay = sit(a) && sit(b);
  const situ = hay ? `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>Situaciones de juego: tu ataque</h2><p class="muy-tenue pp-sub">Hace: ${A} · Concede: ${B}</p>${tablaSitu(sA, a.nombre, b.nombre)}</div>
      <div class="tarjeta"><h2>Situaciones de juego: su ataque</h2><p class="muy-tenue pp-sub">Hace: ${B} · Concede: ${A}</p>${tablaSitu(sB, b.nombre, a.nombre)}</div></div>
    <div class="tarjeta seccion"><h2>Tiempos muertos, faltas y salidas</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>${A}</th><th>${B}</th><th>Liga</th></tr></thead><tbody>
      ${[['Tiempos muertos por partido', s => s.tm[0], 1, null],
        ['Parcial en contra al pedir tiempo muerto', s => s.tm_parcial, 1, null],
        ['Puntos por posesión tras su tiempo muerto', s => s.ato[2] >= 15 ? s.ato[0] : null, 2, false],
        ['Puntos por posesión que concede tras tiempo muerto del rival', s => s.ato[3] >= 15 ? s.ato[1] : null, 2, true],
        ...[0, 1, 2, 3].map(q => [`Faltas en el ${q + 1}.º cuarto`, s => s.faltas[q], 1, true]),
        ['% de cuartos con el rival en bonus antes de los 2 últimos min', s => s.bonus[0], 0, true],
        ['% de cuartos en bonus antes de los 2 últimos min', s => s.bonus[1], 0, false],
        ['Diferencia en los primeros 5 minutos', s => s.inicio[0] - s.inicio[1], 1, false],
        ['Diferencia en los 5 min tras el descanso', s => s.descanso[0] - s.descanso[1], 1, false]].map(([n, f, d, inv]) => {
          const x = f(sit(a)), y = f(sit(b)), l = ppLigaSitu(f), mejor = inv == null || x == null || y == null || x === y ? '' : (x > y) !== inv ? 'a' : 'b';
          return `<tr><td class="izq">${n}</td><td class="${mejor === 'a' ? 'v' : ''}">${fmt(x, d)}</td><td class="${mejor === 'b' ? 'v' : ''}">${fmt(y, d)}</td><td class="muy-tenue">${fmt(l, d)}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="muy-tenue">Del jugada a jugada. Contraataque: canasta hasta 6 segundos después de un robo o un rebote defensivo. Bonus: desde la 4.ª falta de equipo del cuarto, cada falta más son tiros libres. Parcial al pedir tiempo muerto: los puntos seguidos del rival en ese momento (dice cuánto aguanta su entrenador una racha). En verde, lo mejor de los dos.</p></div>` : '';

  // quién cierra los partidos: minutos en el 4.º cuarto, puntos en los finales apretados y tiros libres
  const cierre = (pl) => pl.filter(x => x.j.pbp && x.j.pbp.min_cuarto && x.j.pj).map(x => ({x, m: x.j.pbp.min_cuarto[3] / x.j.pj})).sort((p, q) => q.m - p.m).slice(0, 6);
  const tablaCierre = l => `<div class="tabla-scroll"><table><thead><tr><th class="izq">${enGenero('Jugadora')}</th><th>Min 4.º cuarto</th><th>Pts finales apretados</th><th>TL%</th></tr></thead><tbody>
    ${l.map(({x, m}) => `<tr><td class="izq">${linkJu(x.j.id)}</td><td>${fmt(m, 1)}</td><td>${x.j.pbp.final_apretado ? x.j.pbp.final_apretado.pts : 0}</td><td>${x.j.tot.fta ? fmt(x.j.av.ft, 0) : '–'}</td></tr>`).join('')}</tbody></table></div>`;
  const cB = cierre(rotB), cA = cierre(rotA);
  const final = cB.length && cA.length ? `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>${B}: quién cierra los partidos</h2>${tablaCierre(cB)}</div>
      <div class="tarjeta"><h2>${A}: quién cierra los partidos</h2>${tablaCierre(cA)}</div></div>
    <p class="muy-tenue">Min 4.º cuarto: media por partido. Pts finales apretados: últimos 5 minutos con 5 puntos o menos de diferencia, en toda la temporada. Sirve para saber quién estará en pista al final y a quién hacer (o no hacer) falta.</p>` : '';

  // contra equipos parecidos
  const bloqueParecidos = (e, ref, nE, nRef) => {
    const ps = ppParecidos(e, ref);
    if (!ps.length) return `<p class="tenue">Sin rivales parecidos todavía.</p>`;
    const todos = ps.flatMap(x => x.ps), v = todos.filter(x => x[4] > x[5]).length, m = media(todos.map(x => x[4] - x[5]));
    const mTot = media((e.partidos || []).map(x => x[4] - x[5]));
    return `<p>${nE} contra los equipos que más se parecen a ${nRef}: <b>${v}-${todos.length - v}</b>, diferencia media <b>${signo(m, 1)}</b> (en toda la temporada, ${signo(mTot, 1)}).</p>
      <ul class="pp-lista">${ps.map(x => `<li>${linkEq(x.r.id)}: ${x.ps.map(p => `<a href="#/partido/${p[0]}" class="${p[4] > p[5] ? 'v' : 'd'}">${p[4]}-${p[5]}</a>`).join(', ')}</li>`).join('')}</ul>`;
  };
  const parecidos = `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>${B} contra equipos como el tuyo</h2>${bloqueParecidos(b, a, B, A)}</div>
      <div class="tarjeta"><h2>${A} contra equipos como ${B}</h2>${bloqueParecidos(a, b, A, B)}</div></div>
    <p class="muy-tenue">Parecidos: los rivales con los cuatro factores de ataque y de defensa y el ritmo más cercanos (en lo que varían los equipos de la liga). Dice cómo le va a cada uno contra un estilo como el del otro.</p>`;

  // forma y rivales comunes
  const filaForma = (e, x) => { const p = IDX.partidos[x[0]]; const g = x[4] > x[5];
    return `<li><a href="#/partido/${x[0]}"><span class="${g ? 'v' : 'd'}">${g ? 'V' : 'D'}</span> ${x[4]}-${x[5]} ${x[3] ? 'vs' : 'en'} ${esc(eq(x[2]).nombre)}</a> <span class="muy-tenue">J${x[1]}${p && p.fecha ? ' · ' + esc(p.fecha.split(' ')[0]) : ''}</span></li>`; };
  const sumaComun = comunes.length ? media(comunes.map(c => c.a - c.b)) : null;
  const forma = `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>Forma reciente</h2><div class="rejilla-2">
      <div><h3>${A}</h3><ul class="pp-lista">${[...fa.ps].reverse().map(x => filaForma(a, x)).join('')}</ul><p class="muy-tenue">Neto en estos partidos: ${signo(fa.net, 1)} (temporada ${signo(a.net, 1)}). Elo ${fmt(a.elo, 0)}.</p></div>
      <div><h3>${B}</h3><ul class="pp-lista">${[...fb.ps].reverse().map(x => filaForma(b, x)).join('')}</ul><p class="muy-tenue">Neto en estos partidos: ${signo(fb.net, 1)} (temporada ${signo(b.net, 1)}). Elo ${fmt(b.elo, 0)}.</p></div></div></div>
    <div class="tarjeta"><h2>Rivales comunes</h2>${comunes.length ? `<div class="tabla-scroll"><table><thead><tr><th class="izq">Rival</th><th>${A}</th><th>${B}</th><th>Diferencia</th></tr></thead><tbody>
      ${comunes.map(c => `<tr><td class="izq">${linkEq(c.r)}</td><td>${signo(c.a, 1)}${c.na > 1 ? ` <span class="muy-tenue">(${c.na})</span>` : ''}</td><td>${signo(c.b, 1)}${c.nb > 1 ? ` <span class="muy-tenue">(${c.nb})</span>` : ''}</td><td class="${c.a - c.b > 0 ? 'v' : c.a - c.b < 0 ? 'd' : ''}">${signo(c.a - c.b, 1)}</td></tr>`).join('')}</tbody></table></div>
      <p class="muy-tenue">Diferencia media de puntos contra cada rival que han tenido los dos (entre paréntesis, los partidos si hay más de uno). De media, ${A} ha sacado <b>${signo(sumaComun, 1)}</b> puntos más que ${B} contra los mismos rivales.</p>` : '<p class="tenue">Aún no tienen rivales en común.</p>'}</div></div>`;

  // enfrentamientos de esta temporada
  const enf = duelos.length ? `<div class="tarjeta seccion"><h2>Ya se han enfrentado esta temporada</h2>${duelos.map(p => {
      const ladoB = p.local === b.id ? 0 : 1, caja = (p.caja || [[], []])[ladoB] || [];
      const top = [...caja].sort((x, y) => y[4] - x[4]).slice(0, 3).filter(r => r[4] > 0);
      const fB = p.factores && p.factores[ladoB], fA = p.factores && p.factores[1 - ladoB];
      return `<div class="partidos-lista">${partidoFila(p)}</div><p class="muy-tenue" style="margin:.2rem 0 .8rem">J${p.jornada}${p.fecha ? ' · ' + esc(p.fecha) : ''}${top.length ? ` · Sus mejores anotadoras: ${top.map(r => `${linkJu(r[0], apellido(r[0]))} ${r[4]}`).join(', ')}` : ''}
        ${fA && fB ? ` · eFG% ${fmt(fA.efg, 0)}-${fmt(fB.efg, 0)}, pérdidas ${fmt(fA.tov, 0)}-${fmt(fB.tov, 0)} %, rebote ofensivo ${fmt(fA.orb, 0)}-${fmt(fB.orb, 0)} % (${A} primero)` : ''}</p>`; }).join('')}</div>` : '';


  // cómo ganan y cómo pierden
  const bloqueGP = (e, pl) => {
    const gp = ppGanaPierde(e);
    if (gp.nv < 2 || gp.nd < 2) return `<div class="tarjeta"><h2>${esc(e.nombre)}: cuando gana y cuando pierde</h2><p class="tenue">Hacen falta al menos dos victorias y dos derrotas (${gp.nv}-${gp.nd}).</p></div>`;
    const claves = gp.filas.filter(f => f.k && f.inv !== null && f.v != null && f.d != null).map(f => {
      const sd = ppDesv(x => x.ataque && x.ataque[f.k]) || 1;
      return {...f, z: Math.abs(f.v - f.d) / sd};
    }).sort((x, y) => y.z - x.z).slice(0, 3);
    const jug = pl.filter(x => !x.ausente && x.j.splits && x.j.splits.victoria && x.j.splits.derrota && x.j.splits.victoria.pj >= 2 && x.j.splits.derrota.pj >= 2 && x.minRec >= 10)
      .map(x => ({x, dif: x.j.splits.victoria.gmsc - x.j.splits.derrota.gmsc})).sort((p, q) => q.dif - p.dif).slice(0, 3);
    return `<div class="tarjeta"><h2>${esc(e.nombre)}: cuando gana y cuando pierde</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>Victorias (${gp.nv})</th><th>Derrotas (${gp.nd})</th><th>Diferencia</th></tr></thead><tbody>
      ${gp.filas.map(f => `<tr><td class="izq">${f.n}</td><td>${fmt(f.v)}</td><td>${fmt(f.d)}</td><td class="muy-tenue">${f.v != null && f.d != null ? signo(f.v - f.d, 1) : '–'}</td></tr>`).join('')}</tbody></table></div>
      <p>Lo que más cambia cuando pierde: ${claves.map(f => `${f.n[0].toLowerCase() + f.n.slice(1)} (${fmt(f.v)} en sus victorias, ${fmt(f.d)} en sus derrotas)`).join('; ')}.</p>
      ${jug.length ? `<p>${enGenero('Jugadoras')} que más bajan en las derrotas: ${jug.map(({x}) => `${linkJu(x.j.id)} (Game Score ${fmt(x.j.splits.victoria.gmsc)} en victorias, ${fmt(x.j.splits.derrota.gmsc)} en derrotas; ${fmt(x.j.splits.victoria.pts)} y ${fmt(x.j.splits.derrota.pts)} puntos)`).join(', ')}.</p>` : ''}</div>`;
  };
  const ganaPierde = `<div class="rejilla-2 seccion">${bloqueGP(b, pb)}${bloqueGP(a, pa)}</div><p class="muy-tenue">Medias de sus partidos ganados y perdidos. Lo que más cambia (en proporción a lo que varían los equipos de la liga) es lo que suele decidir sus partidos: ahí está la llave.</p>`;
  const historial = `<div class="tarjeta seccion"><h2>Historial en temporadas anteriores</h2>${ppHistorial(a, b)}</div>`;
  // comparativa completa
  const ms = ['fuerza', 'net', 'adj_ortg', 'adj_drtg', 'ortg', 'drtg', 'ritmo', 'efg', 'ts', 'p3', 'p3r', 'p2', 'tov', 'orb', 'ftr', 'ast', 'efg_r', 'p3_r', 'p3r_r', 'tov_r', 'orb_r', 'ftr_r', 'stl', 'blk', 'ptsm', 'ptsc', 'trbm', 'astm', 'tovm', 'banq_pts', 'max_anot', 'altura', 'edad', 'elo', 'sos'].map(k => MEK[k]).filter(Boolean);
  const pA = percentilesDe(a, ms, IDX.jugadas), pB = percentilesDe(b, ms, IDX.jugadas);
  const radarEjes = ['ortg', 'drtg', 'efg', 'tov', 'orb', 'ftr', 'efg_r', 'tov_r', 'orb_r', 'ftr_r', 'p3', 'ritmo'].map(k => ms.findIndex(m => m.k === k)).filter(i => i >= 0);
  const comp = `<div class="rejilla-2 seccion"><div class="tarjeta"><h2>Perfil de los dos</h2><div class="leyenda"><span style="--c:var(--serie-1)">${A}</span><span style="--c:var(--serie-2)">${B}</span></div>
      ${radar([{nombre: a.nombre, color: 'var(--serie-1)', valores: radarEjes.map(i => pA[i].p)}, {nombre: b.nombre, color: 'var(--serie-2)', valores: radarEjes.map(i => pB[i].p)}], radarEjes.map(i => ms[i].c))}
      <p class="muy-tenue">Percentil de cada uno en la liga (más lejos del centro, mejor; en las defensivas también).</p></div>
    <div class="tarjeta"><h2>Comparativa completa</h2><div class="tabla-scroll"><table><thead><tr><th class="izq"></th><th>${A}</th><th>${B}</th></tr></thead><tbody>
      ${ms.map((m, i) => { const x = m.v(a), y = m.v(b), mejor = x == null || y == null || x === y ? -1 : ((x > y) !== !!m.inv ? 0 : 1);
        return `<tr><td class="izq" ${m.i ? `data-tip="${esc(m.i)}"` : ''}>${esc(m.n)}</td><td style="${mejor === 0 ? 'font-weight:700' : ''}">${fmt(x, m.d)} <span class="muy-tenue">P${pA[i].p ?? '–'}</span></td><td style="${mejor === 1 ? 'font-weight:700' : ''}">${fmt(y, m.d)} <span class="muy-tenue">P${pB[i].p ?? '–'}</span></td></tr>`; }).join('')}
      </tbody></table></div><p class="muy-tenue">En negrita, el mejor de los dos. P: percentil en la liga.</p></div></div>`;

  return `<div class="informe pp">
    <div class="tarjeta"><p class="muy-tenue" style="margin:0">Preparar partido · ${esc(COMP.corto)} ${esc(T.nombre)}</p>
      <h1 style="margin:.1rem 0 0"><span style="color:var(--serie-1)">${A}</span> <span class="muy-tenue">-</span> <span style="color:var(--serie-2)">${B}</span></h1>
      <p class="tenue" style="margin:.2rem 0 0">${venue === 'neutral' ? 'Campo neutral' : venue === 'casa' ? `En casa de ${A}` : `En casa de ${B}`}${prog ? ` · Jornada ${prog.jornada}${prog.fecha ? ' · ' + esc(prog.fecha) : ''}` : ''}${a.entrenador || b.entrenador ? ` · Entrenadores: ${esc(bonitoJS((a.entrenador || {}).nombre || '–'))} y ${esc(bonitoJS((b.entrenador || {}).nombre || '–'))}` : ''}</p>
      ${avisoActas(a.actas_incompletas + b.actas_incompletas)}${pocos}</div>
    ${hoja}${pron}${cruces}${situ}${fyd}${plan}${zonas}${duelosHtml}${suRotacion}${fichasB}${final}${quint}${como}${ganaPierde}${forma}${parecidos}${enf}${historial}${comp}
    <p class="muy-tenue seccion">LF Stats · ${esc(COMP.nombre)} ${esc(T.nombre)} · datos hasta ${esc(String(T.actualizado || '').replace('T', ' a las '))}. Informe automático a partir de las estadísticas: sirve para preparar el partido, no sustituye al vídeo.</p></div>`;
}
