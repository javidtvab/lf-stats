// LF Stats · arranque y rutas (#/seccion/argumentos). Las vistas están en vistas_*.js.
'use strict';

const SECCION_MENU = {jugadora: 'jugadoras', comparar: 'jugadoras', dispersion: 'jugadoras', familias: 'jugadoras', progresion: 'jugadoras',
  decide: 'liga', elo: 'liga', ampliada: 'liga', tiro: 'liga', comparador: 'comparador', entrenadores: 'liga', historico: 'jugadoras',
  equipo: 'equipos', carta: 'equipos', 'evolucion-equipos': 'equipos', 'cara-a-cara': 'equipos',
  simulacion: 'liga', previa: 'liga', lideres: 'liga', records: 'liga', ambiente: 'liga', arbitros: 'liga', partido: 'partidos'};

function pintar() {
  const [seccion = '', ...args] = location.hash.replace(/^#\/?/, '').split('/');
  const nombre = VISTAS[seccion] ? seccion : 'inicio';
  const scroll = scrollY, mismo = pintar.ultima === location.hash;
  try {
    $vista.innerHTML = T ? VISTAS[nombre](...args.map(decodeURIComponent))
      : '<div class="aviso">Todavía no hay datos. Ejecuta <code>actualizar.bat</code> (o <code>python feb.py</code> y <code>python generar.py</code>).</div>';
  } catch (e) {
    console.error(e);
    $vista.innerHTML = `<div class="aviso">No se ha podido mostrar esta página (${esc(e.message)}).</div>`;
  }
  const menu = SECCION_MENU[nombre] || nombre;
  document.querySelectorAll('.menu a').forEach(a => a.classList.toggle('activo', a.dataset.seccion === menu));
  const titulo = $vista.querySelector('h1');
  document.title = (titulo && nombre !== 'inicio' ? titulo.textContent.trim() + ' · ' : '') + (COMP ? COMP.corto + ' · ' : '') + 'LF Stats';
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
  tabla.estado = {};
  pintar.ultima = null;
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
    COMPETICIONES = (await cargarCompeticiones()).competiciones;    // pide el email y la contraseña si la web los tiene
  } catch (e) {
    $vista.innerHTML = `<div class="aviso">No se han podido cargar los datos (${esc(e.message || e)}).</div>`;
    return;
  }
  // lo de cada jugadora en cada competición: se carga aparte y, cuando llega, se repinta su ficha si está abierta
  cargarDatos('datos/jugadoras.js', 'jugadoras', () => window.LF_JUG)
    .then(d => { JUG = d; if (T && location.hash.startsWith('#/jugadora/')) { pintar.ultima = null; pintar(); } })
    .catch(() => { /* sin la tabla de competiciones */ });
  const selC = document.getElementById('competicion');
  selC.innerHTML = COMPETICIONES.map(c => `<option value="${c.clave}">${esc(c.corto)}</option>`).join('');
  selC.addEventListener('change', () => usarCompeticion(selC.value).then(() => { location.hash = '#/'; }));
  const sel = document.getElementById('temporada');
  sel.addEventListener('change', () => usarTemporada(sel.value));
  addEventListener('hashchange', pintar);
  if (!COMPETICIONES.length) { pintar(); return; }
  const guardada = leer('competicion');
  usarCompeticion(COMPETICIONES.some(c => c.clave === guardada) ? guardada : COMPETICIONES[0].clave, leer('temporada'));
})();

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
