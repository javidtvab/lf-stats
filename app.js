// LF Stats · arranque y rutas (#/seccion/argumentos). Las vistas están en vistas_*.js.
'use strict';

const SECCION_MENU = {jugadora: 'jugadoras', comparar: 'jugadoras', dispersion: 'jugadoras', familias: 'jugadoras', progresion: 'jugadoras',
  decide: 'liga', elo: 'liga', ampliada: 'liga', tiro: 'liga', comparador: 'comparador', entrenadores: 'liga', historico: 'jugadoras',
  equipo: 'equipos', carta: 'equipos', 'evolucion-equipos': 'equipos', 'cara-a-cara': 'equipos',
  simulacion: 'liga', previa: 'liga', lideres: 'liga', records: 'liga', ambiente: 'liga', arbitros: 'liga', partido: 'partidos',
  carrera: 'jugadoras', salud: 'metodo', temporadas: 'liga', mercado: 'perfiles', informe: 'equipos'};

// las páginas que necesitan la parte pesada de la temporada (nucleo.cargarDetalle)
const CON_DETALLE = new Set(['jugadora', 'comparar', 'partido', 'comparador', 'tiro', 'equipo', 'informe']);

function pintar() {
  const [seccion = '', ...args] = location.hash.replace(/^#\/?/, '').split('/');
  const nombre = VISTAS[seccion] ? seccion : 'inicio';
  if (T && CON_DETALLE.has(nombre) && !T._detalle) {
    const hash = location.hash, de = T;
    $vista.innerHTML = '<p class="tenue cargando">Cargando…</p>';
    cargarDetalle(de).then(() => { if (location.hash === hash && T === de) pintar(); })
      .catch(() => { $vista.innerHTML = '<div class="aviso">No se han podido cargar los datos de esta página.</div>'; });
    return;
  }
  const scroll = scrollY, mismo = pintar.ultima === location.hash;
  try {
    $vista.innerHTML = T ? VISTAS[nombre](...args.map(decodeURIComponent))
      : COMPETICIONES.length ? `<div class="aviso">Todavía no hay competiciones ${GENERO === 'm' ? 'masculinas' : 'femeninas'}.</div>`
      : '<div class="aviso">Todavía no hay datos. Ejecuta <code>actualizar.bat</code> (o <code>python feb.py</code> y <code>python generar.py</code>).</div>';
  } catch (e) {
    console.error(e);
    $vista.innerHTML = `<div class="aviso">No se ha podido mostrar esta página (${esc(e.message)}).</div>`;
  }
  const menu = SECCION_MENU[nombre] || nombre;
  document.querySelectorAll('.menu a').forEach(a => a.classList.toggle('activo', a.dataset.seccion === menu));
  const titulo = $vista.querySelector('h1');
  document.title = enGenero((titulo && nombre !== 'inicio' ? titulo.textContent.trim() + ' · ' : '') + (COMP ? COMP.corto + ' · ' : '') + 'LF Stats');
  $tip.hidden = true;
  if (mismo) scrollTo(0, scroll); else scrollTo(0, 0);
  pintar.ultima = location.hash;
}

async function usarTemporada(t) {
  try {
    elegirTemporada(await cargarTemporada(t));
  } catch (e) {
    $vista.innerHTML = `<div class="aviso">No se han podido cargar los datos de la temporada ${esc(t)}.</div>`;
    return;
  }
  pintar.ultima = null;           // el orden de las tablas se mantiene (y se recuerda) al cambiar de temporada
  pintar();
}

(async function arrancar() {
  const tema = leer('tema');
  if (tema) document.documentElement.dataset.theme = tema;
  document.getElementById('tema').addEventListener('click', () => {
    const oscuro = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = oscuro ? 'light' : 'dark';
    guardar('tema', document.documentElement.dataset.theme);
  });
  try {
    const lista = await cargarCompeticiones();                       // pide el email y la contraseña si la web los tiene
    COMPETICIONES = lista.competiciones;
    NIVEL = lista.nivel || {};
    EQUIV = lista.equivalencias || {};
    MAXIMA = lista.maxima || {};
  } catch (e) {
    $vista.innerHTML = `<div class="aviso">No se han podido cargar los datos (${esc(e.message || e)}).</div>`;
    return;
  }
  // lo de cada jugadora en cada competición: se carga aparte y, cuando llega, se repinta su ficha si está abierta
  cargarDatos('datos/jugadoras.js', 'jugadoras', () => window.LF_JUG)
    .then(d => { JUG = d; if (T && /^(#\/?)?$|^#\/(jugadora|carrera|cantera|perfiles|mercado)\b/.test(location.hash)) { pintar.ultima = null; pintar(); } })
    .catch(() => { /* sin la tabla de competiciones */ });
  const selC = document.getElementById('competicion');
  selC.addEventListener('change', () => usarCompeticion(selC.value).then(() => { location.hash = '#/'; }));
  const selG = document.getElementById('genero');
  selG.addEventListener('change', () => usarGenero(selG.value).then(() => { location.hash = '#/'; }));
  const sel = document.getElementById('temporada');
  sel.addEventListener('change', () => usarTemporada(sel.value));
  addEventListener('hashchange', pintar);
  if (!COMPETICIONES.length) { pintar(); return; }
  const guardada = COMPETICIONES.find(c => c.clave === leer('competicion'));
  usarGenero(guardada ? genero(guardada) : leer('genero') || 'f', guardada && guardada.clave, leer('temporada'));
  activarBuscador();
})();

// cambia de sección (femenino o masculino): el desplegable de competiciones pasa a tener solo las suyas
const genero = c => c.genero || 'f';
async function usarGenero(g, clave, temporada, hash) {
  GENERO = g;
  guardar('genero', g);
  document.getElementById('genero').value = g;
  document.querySelector('.menu [data-seccion="jugadoras"]').textContent = g === 'm' ? 'Jugadores' : 'Jugadoras';
  document.getElementById('buscar').placeholder = g === 'm' ? 'Buscar jugador o equipo' : 'Buscar jugadora o equipo';
  const lista = COMPETICIONES.filter(c => genero(c) === g);
  const selC = document.getElementById('competicion');
  selC.innerHTML = lista.map(c => `<option value="${c.clave}">${esc(c.corto)}</option>`).join('');
  selC.hidden = !lista.length;
  document.getElementById('temporada').hidden = !lista.length;
  if (!lista.length) {
    COMP = T = null;
    pintar.ultima = null;
    pintar();
    return;
  }
  await usarCompeticion(lista.some(c => c.clave === clave) ? clave : lista[0].clave, temporada, hash);
}

// abre una página de otra competición o temporada (y de la otra sección si hace falta)
function irA(clave, temporada, hash) {
  const c = COMPETICIONES.find(x => x.clave === clave);
  if (!c) return;
  if (genero(c) !== GENERO) usarGenero(genero(c), clave, temporada, hash);
  else if (COMP && clave === COMP.clave && String(temporada) === String(T && T.temporada)) location.hash = hash;
  else usarCompeticion(clave, temporada, hash);
}

// cambia de competición (y de temporada: la pedida si la tiene, si no la más reciente); hash: la página a la que ir
async function usarCompeticion(clave, temporada, hash) {
  const c = COMPETICIONES.find(x => x.clave === clave);
  if (!c) return;
  try {
    INDICE = await cargarIndiceCompeticion(clave);
  } catch (e) {
    $vista.innerHTML = `<div class="aviso">No se han podido cargar los datos de ${esc(c.nombre)}.</div>`;
    return;
  }
  if (COMP && COMP.clave !== clave) Object.values(VISTAS).forEach(v => { delete v.f; });   // filtros de la otra competición
  COMP = c;
  guardar('competicion', clave);
  document.getElementById('competicion').value = clave;
  document.getElementById('temporada').innerHTML = INDICE.temporadas.map(t => `<option value="${t.temporada}">${esc(t.nombre)}</option>`).join('');
  const t = INDICE.temporadas.some(x => String(x.temporada) === String(temporada)) ? temporada : INDICE.temporadas[0].temporada;
  if (hash) history.replaceState(null, '', hash);
  await usarTemporada(t);
}
