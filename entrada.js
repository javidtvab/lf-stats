// LF Stats · acceso con email y contraseña. Si existe datos/acceso.js, los datos están cifrados (cifrado.py) y solo se
// pueden leer con la clave que sale del email y la contraseña: aquí se pide, se comprueba y se descifra.
'use strict';

const ENTRADA = {clave: null};
const hexABytes = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const bytesAHex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

// SHA-256 de un mensaje de 48 bytes (un solo bloque): es el generador del flujo de cifrado
const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
  0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138,
  0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624,
  0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f,
  0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
function sha256Bloque(msg48, salida, desde) {
  const w = new Uint32Array(64);
  for (let i = 0; i < 12; i++) w[i] = (msg48[4 * i] << 24) | (msg48[4 * i + 1] << 16) | (msg48[4 * i + 2] << 8) | msg48[4 * i + 3];
  w[12] = 0x80000000; w[13] = 0; w[14] = 0; w[15] = 48 * 8;
  for (let i = 16; i < 64; i++) {
    const a = w[i - 15], b = w[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3), s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
  }
  let a = 0x6a09e667, b = 0xbb67ae85, c = 0x3c6ef372, d = 0xa54ff53a, e = 0x510e527f, f = 0x9b05688c, g = 0x1f83d9ab, h = 0x5be0cd19;
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K256[i] + w[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)), maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  const res = [a + 0x6a09e667, b + 0xbb67ae85, c + 0x3c6ef372, d + 0xa54ff53a, e + 0x510e527f, f + 0x9b05688c, g + 0x1f83d9ab, h + 0x5be0cd19];
  for (let i = 0; i < 8; i++) { const v = res[i] | 0; salida[desde + 4 * i] = v >>> 24; salida[desde + 4 * i + 1] = (v >>> 16) & 255; salida[desde + 4 * i + 2] = (v >>> 8) & 255; salida[desde + 4 * i + 3] = v & 255; }
}

async function derivarClave(email, contrasena) {
  const a = window.LF_ACCESO, enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(email.trim().toLowerCase() + '\n' + contrasena), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: hexABytes(a.sal), iterations: a.iteraciones}, base, 512);
  return new Uint8Array(bits);
}
async function hmac(clave32, datos) {
  const k = await crypto.subtle.importKey('raw', clave32, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, datos));
}
async function claveValida(clave) {
  return bytesAHex(await hmac(clave.slice(32), new TextEncoder().encode('LF Stats'))) === window.LF_ACCESO.prueba;
}
async function descifrar(b64, clave) {
  const bin = atob(b64), bruto = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bruto[i] = bin.charCodeAt(i);
  const unico = bruto.subarray(0, 8), cifrado = bruto.subarray(8, bruto.length - 32), firma = bruto.subarray(bruto.length - 32);
  const esperada = await hmac(clave.slice(32), bruto.subarray(0, bruto.length - 32));
  if (bytesAHex(esperada) !== bytesAHex(firma)) throw new Error('Los datos no se pueden abrir con esta clave');
  const salida = new Uint8Array(cifrado.length), msg = new Uint8Array(48), flujo = new Uint8Array(32);
  msg.set(clave.subarray(0, 32), 0); msg.set(unico, 32);
  for (let bloque = 0, p = 0; p < cifrado.length; bloque++, p += 32) {
    let n = bloque;
    for (let k = 47; k >= 40; k--) { msg[k] = n & 255; n = Math.floor(n / 256); }
    sha256Bloque(msg, flujo, 0);
    const fin = Math.min(32, cifrado.length - p);
    for (let k = 0; k < fin; k++) salida[p + k] = cifrado[p + k] ^ flujo[k];
  }
  return JSON.parse(new TextDecoder().decode(salida));
}
// los datos de un archivo cifrado ya cargado (window.LF_CIFRADO[nombre])
async function datosCifrados(nombre) {
  const texto = window.LF_CIFRADO && window.LF_CIFRADO[nombre];
  if (!texto) throw new Error('Faltan los datos ' + nombre);
  const d = await descifrar(texto, ENTRADA.clave);
  delete window.LF_CIFRADO[nombre];
  return d;
}

function cargarScript(src) {
  return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = mal; document.head.appendChild(s); });
}

function guardarClave(clave, recordar) {
  try { (recordar ? localStorage : sessionStorage).setItem('lfstats:clave', bytesAHex(clave)); } catch (e) { /* sin almacenamiento */ }
}
function claveRecordada() {
  try { const h = sessionStorage.getItem('lfstats:clave') || localStorage.getItem('lfstats:clave'); return h ? hexABytes(h) : null; } catch (e) { return null; }
}
function salir() {
  try { sessionStorage.removeItem('lfstats:clave'); localStorage.removeItem('lfstats:clave'); } catch (e) { /* nada */ }
  location.hash = ''; location.reload();
}

// pide el email y la contraseña hasta que sean buenos; devuelve cuando se puede entrar
function pedirAcceso() {
  return new Promise(ok => {
    document.body.classList.add('sin-acceso');
    $vista.innerHTML = `<form class="entrada tarjeta" id="form-entrada" autocomplete="on">
      <div class="marca" style="font-size:1.4rem"><span class="marca__punto" aria-hidden="true"></span>LF Stats</div>
      <p class="tenue">Introduce tu email y tu contraseña para entrar.</p>
      <label>Email<input id="e-email" type="email" autocomplete="username" required></label>
      <label>Contraseña<input id="e-clave" type="password" autocomplete="current-password" required></label>
      <label class="check"><input id="e-recordar" type="checkbox"> Recordarme en este ordenador</label>
      <button class="boton" type="submit" id="e-entrar">Entrar</button>
      <p id="e-error" class="error" role="alert" hidden></p></form>`;
    document.getElementById('e-email').focus();
    document.getElementById('form-entrada').addEventListener('submit', async ev => {
      ev.preventDefault();
      const boton = document.getElementById('e-entrar'), error = document.getElementById('e-error');
      boton.disabled = true; boton.textContent = 'Comprobando…'; error.hidden = true;
      try {
        const clave = await derivarClave(document.getElementById('e-email').value, document.getElementById('e-clave').value);
        if (!await claveValida(clave)) throw new Error('El email o la contraseña no son correctos.');
        ENTRADA.clave = clave;
        guardarClave(clave, document.getElementById('e-recordar').checked);
        document.body.classList.remove('sin-acceso');
        ok();
      } catch (e) {
        error.textContent = e.message || 'No se ha podido entrar.'; error.hidden = false;
        boton.disabled = false; boton.textContent = 'Entrar';
      }
    });
  });
}

// carga un archivo de datos: sin contraseña los deja en una variable (plano() los lee); con ella, vienen cifrados
async function cargarDatos(src, nombre, plano) {
  await cargarScript(src);
  return window.LF_ACCESO ? datosCifrados(nombre) : plano();
}

// pide el acceso si los datos están cifrados y carga la lista de competiciones
async function cargarCompeticiones() {
  if (window.LF_ACCESO) {
    const guardada = claveRecordada();
    if (guardada && await claveValida(guardada).catch(() => false)) ENTRADA.clave = guardada;
    else await pedirAcceso();
    const salirB = document.getElementById('salir');
    if (salirB) { salirB.hidden = false; salirB.addEventListener('click', salir); }
  }
  return cargarDatos('datos/competiciones.js', 'competiciones', () => window.LF_COMP);
}
