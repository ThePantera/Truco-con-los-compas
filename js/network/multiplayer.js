// Salas por código usando PeerJS (WebRTC). No necesita servidor propio:
// el broker público de PeerJS solo presenta a los navegadores y después
// los datos van directo entre ellos. El anfitrión es la autoridad: reparte,
// valida jugadas y le manda a cada uno solo lo que puede ver.

import { Peer } from 'peerjs';

const PREFIX = 'truco-compas-v1-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(len = 4) {
  let c = '';
  for (let i = 0; i < len; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

// Por defecto usa el broker público de PeerJS. Para probar en local o usar uno
// propio: ?peer=localhost:9000 en la URL.
function peerOptions() {
  const opts = { debug: 1 };
  const custom = new URLSearchParams(window.location.search).get('peer');
  if (custom) {
    const [host, port] = custom.split(':');
    Object.assign(opts, { host, port: Number(port) || 443, path: '/', secure: window.location.protocol === 'https:' });
  }
  return opts;
}

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    const onError = (err) => {
      peer.off('open', onOpen);
      peer.destroy();
      reject(err);
    };
    const onOpen = () => {
      peer.off('error', onError);
      resolve(peer);
    };
    peer.once('open', onOpen);
    peer.once('error', onError);
  });
}

function friendlyError(err) {
  const type = err && err.type;
  if (type === 'peer-unavailable') return 'No existe esa sala (o el anfitrión se fue). Revisá el código.';
  if (type === 'network' || type === 'server-error' || type === 'socket-error')
    return 'No hay conexión con el servidor de salas. Revisá internet o probá en otra red.';
  if (type === 'browser-incompatible') return 'Tu navegador no soporta WebRTC. Probá con Chrome, Edge o Firefox.';
  return `Error de conexión${type ? ` (${type})` : ''}.`;
}

// Anfitrión. handlers: { onMessage(clientId, msg), onDisconnect(clientId), onError(texto) }
export async function hostRoom(handlers) {
  let peer;
  let code;
  for (let attempt = 0; attempt < 5 && !peer; attempt++) {
    code = randomCode();
    try {
      peer = await openPeer(PREFIX + code);
    } catch (err) {
      if (err.type !== 'unavailable-id') throw new Error(friendlyError(err));
    }
  }
  if (!peer) throw new Error('No se pudo crear la sala, probá de nuevo.');

  const conns = new Map(); // clientId -> DataConnection
  peer.on('connection', (conn) => {
    const clientId = conn.peer;
    conn.on('open', () => conns.set(clientId, conn));
    conn.on('data', (msg) => handlers.onMessage(clientId, msg));
    const gone = () => {
      if (conns.get(clientId) === conn) {
        conns.delete(clientId);
        handlers.onDisconnect(clientId);
      }
    };
    conn.on('close', gone);
    conn.on('error', gone);
  });
  peer.on('disconnected', () => {
    // Se cayó el broker, pero las conexiones abiertas siguen. Reintentamos para aceptar nuevos.
    if (!peer.destroyed) peer.reconnect();
  });
  peer.on('error', (err) => handlers.onError && handlers.onError(friendlyError(err)));

  return {
    code,
    send(clientId, msg) {
      const c = conns.get(clientId);
      if (c && c.open) c.send(msg);
    },
    broadcast(msg) {
      for (const c of conns.values()) if (c.open) c.send(msg);
    },
    close() {
      peer.destroy();
    },
  };
}

// Invitado. handlers: { onMessage(msg), onClose(), onError(texto) }
export async function joinRoom(rawCode, handlers) {
  const code = normalizeCode(rawCode);
  if (code.length < 4) throw new Error('El código de sala tiene 4 letras.');
  let peer;
  try {
    peer = await openPeer(null);
  } catch (err) {
    throw new Error(friendlyError(err));
  }
  const conn = await new Promise((resolve, reject) => {
    const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
    const timer = setTimeout(() => reject(new Error('La sala no contesta. ¿Está bien el código?')), 15000);
    c.on('open', () => {
      clearTimeout(timer);
      resolve(c);
    });
    peer.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(friendlyError(err)));
    });
  }).catch((e) => {
    peer.destroy();
    throw e;
  });

  conn.on('data', (msg) => handlers.onMessage(msg));
  let closed = false;
  const onClose = () => {
    if (closed) return;
    closed = true;
    handlers.onClose && handlers.onClose();
  };
  conn.on('close', onClose);
  conn.on('error', onClose);
  peer.on('error', (err) => handlers.onError && handlers.onError(friendlyError(err)));

  return {
    code,
    send(msg) {
      if (conn.open) conn.send(msg);
    },
    close() {
      closed = true;
      peer.destroy();
    },
  };
}
