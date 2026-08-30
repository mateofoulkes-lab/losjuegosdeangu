// Trystero-compatible transport shim used by app.js.
// Topology is intentionally HOST <-> PHONE only: phones never connect to each other.
// PeerJS is loaded lazily so a CDN/network problem cannot prevent the game UI from booting.
export let selfId = '';

const reconnectDelay = 1200;
const rooms = new Set();
let peerCtorPromise = null;

function loadPeerCtor() {
  if (!peerCtorPromise) {
    peerCtorPromise = import('https://esm.sh/peerjs@1.5.5?bundle').then(m => m.default || m.Peer || m);
  }
  return peerCtorPromise;
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52);
}

function extraIceServers() {
  const configured = Array.isArray(window.ANGU_TURN_SERVERS) ? window.ANGU_TURN_SERVERS : [];
  return configured;
}

function peerOptions() {
  return {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...extraIceServers()
      ],
      iceCandidatePoolSize: 4
    }
  };
}

function invitationUrl(roomId) {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('room', roomId);
  u.searchParams.set('join', '1');
  return u.toString();
}

function renderInvite(roomId) {
  const box = document.querySelector('#qrBox');
  if (!box) return;
  const url = invitationUrl(roomId);
  box.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:9px">
      <div id="anguQrCanvas" style="background:#fff;padding:9px;border-radius:14px;line-height:0"></div>
      <div style="font-weight:900;color:#ffd451">Escaneá para entrar a la sala</div>
      <div style="font-size:12px;opacity:.72">SALA <b>${roomId}</b> · conexión WebRTC directa al host</div>
    </div>`;
  const qr = document.querySelector('#anguQrCanvas');
  if (qr && window.QRCode) {
    new window.QRCode(qr, {
      text: url,
      width: 156,
      height: 156,
      colorDark: '#071a35',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M
    });
  } else if (qr) {
    qr.style.lineHeight = '1.3';
    qr.style.color = '#071a35';
    qr.style.maxWidth = '300px';
    qr.textContent = url;
  }
}

export function joinRoom(config = {}, roomId = '', opts = {}) {
  const isHost = document.querySelector('#hostView')?.classList.contains('active') === true;
  const appId = config.appId || 'angu';
  const hostId = `angu-${slug(appId)}-${slug(roomId)}`.slice(0, 90);
  const connections = new Map();
  const actionHandlers = new Map();
  let peer = null;
  let hostConnection = null;
  let destroyed = false;
  let reconnectTimer = null;

  const room = {
    onPeerJoin: null,
    onPeerLeave: null,
    makeAction(name) {
      if (!actionHandlers.has(name)) actionHandlers.set(name, null);
      return {
        send(data, options = {}) {
          const packet = { __angu: 1, action: name, data };
          const target = options?.target;
          try {
            if (isHost) {
              if (target) {
                const conn = connections.get(target);
                if (!conn?.open) return Promise.reject(new Error('target-not-connected'));
                conn.send(packet);
              } else {
                for (const conn of connections.values()) if (conn.open) conn.send(packet);
              }
            } else {
              if (!hostConnection?.open) return Promise.reject(new Error('host-not-connected'));
              hostConnection.send(packet);
            }
            return Promise.resolve();
          } catch (error) {
            return Promise.reject(error);
          }
        },
        set onMessage(fn) { actionHandlers.set(name, typeof fn === 'function' ? fn : null); },
        get onMessage() { return actionHandlers.get(name); }
      };
    },
    leave() {
      destroyed = true;
      clearTimeout(reconnectTimer);
      for (const conn of connections.values()) try { conn.close(); } catch {}
      try { hostConnection?.close(); } catch {}
      try { peer?.destroy(); } catch {}
      rooms.delete(room);
    }
  };

  rooms.add(room);
  if (isHost) renderInvite(roomId);

  function deliver(conn, packet) {
    if (!packet || packet.__angu !== 1 || !packet.action) return;
    const handler = actionHandlers.get(packet.action);
    if (typeof handler === 'function') handler(packet.data, { peerId: conn.peer });
  }

  function attach(conn) {
    if (!conn) return;
    conn.on('data', data => deliver(conn, data));
    conn.on('error', error => console.warn('[Angu WebRTC] data connection error', error));
    conn.on('open', () => {
      if (isHost) connections.set(conn.peer, conn);
      else hostConnection = conn;
      room.onPeerJoin?.(conn.peer);
    });
    conn.on('close', () => {
      if (isHost) connections.delete(conn.peer);
      else if (hostConnection === conn) hostConnection = null;
      room.onPeerLeave?.(conn.peer);
      if (!isHost) scheduleReconnect();
    });
  }

  function connectToHost() {
    if (destroyed || isHost || !peer?.open || hostConnection?.open) return;
    try {
      const conn = peer.connect(hostId, {
        reliable: true,
        serialization: 'json',
        metadata: { room: roomId, role: 'player' }
      });
      hostConnection = conn;
      attach(conn);
    } catch (error) {
      console.warn('[Angu WebRTC] connect failed', error);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (destroyed || isHost || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectToHost();
    }, reconnectDelay);
  }

  loadPeerCtor().then(Peer => {
    if (destroyed) return;
    peer = isHost ? new Peer(hostId, peerOptions()) : new Peer(undefined, peerOptions());

    peer.on('open', id => {
      selfId = id;
      if (!isHost) connectToHost();
    });

    if (isHost) peer.on('connection', conn => attach(conn));

    peer.on('disconnected', () => {
      if (destroyed) return;
      try { peer.reconnect(); } catch {}
    });

    peer.on('error', error => {
      console.warn('[Angu WebRTC] peer error', error?.type || error, error);
      if (error?.type === 'unavailable-id' && isHost) {
        opts?.onJoinError?.({ error: new Error('Ya existe una pantalla host para esta sala.') });
      } else if (!isHost) {
        scheduleReconnect();
      } else {
        opts?.onJoinError?.({ error });
      }
    });
  }).catch(error => {
    console.error('[Angu WebRTC] no se pudo cargar PeerJS', error);
    opts?.onJoinError?.({ error: new Error('No se pudo cargar el módulo de red PeerJS.') });
  });

  return room;
}

window.addEventListener('beforeunload', () => {
  for (const room of [...rooms]) room.leave();
});
