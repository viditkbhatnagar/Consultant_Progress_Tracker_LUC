import { io } from 'socket.io-client';
import { API_BASE_URL } from '../utils/constants';

// Socket server origin = API base minus the trailing "/api". In prod that
// resolves to '' (same origin); in dev to http://localhost:5001.
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

let socket = null;

// Lazily create the singleton (autoConnect off — we connect explicitly
// once a token is available).
function getSocket() {
    if (!socket) {
        socket = io(SOCKET_URL || '/', {
            autoConnect: false,
            path: '/socket.io',
            transports: ['websocket', 'polling'],
        });
    }
    return socket;
}

export function connectSocket(token) {
    if (!token) return;
    const s = getSocket();
    s.auth = { token };
    if (s.connected) s.disconnect();
    s.connect();
}

export function disconnectSocket() {
    if (socket && socket.connected) socket.disconnect();
}

// Subscribe to a list of event names with one handler. Returns an
// unsubscribe fn that removes exactly those listeners.
export function onSocketEvents(events, handler) {
    const s = getSocket();
    events.forEach((e) => s.on(e, handler));
    return () => events.forEach((e) => s.off(e, handler));
}

// Register a handler for (re)connect so a tab that was asleep can catch up.
export function onSocketConnect(handler) {
    const s = getSocket();
    s.on('connect', handler);
    return () => s.off('connect', handler);
}

export default getSocket;
