/**
 * Виртуальные TCP-соединения.
 * { LocalAddress, LocalPort, RemoteAddress, RemotePort, State, PID }
 */
import { proxyWrap } from './filesystem.js';

export function createNetworkConnections() {
  const data = [
    ['127.0.0.1', 22, '192.168.1.10', 51000, 'ESTAB', 884],
    ['0.0.0.0', 22, '0.0.0.0', 0, 'LISTEN', 884],
    ['127.0.0.1', 8080, '127.0.0.1', 54321, 'ESTAB', 1245],
    ['192.168.1.15', 4444, '45.155.205.231', 443, 'ESTAB', 6666],
    ['0.0.0.0', 80, '0.0.0.0', 0, 'LISTEN', 1245],
    ['0.0.0.0', 22, '0.0.0.0', 0, 'LISTEN', 884]
  ];
  return data.map(([LocalAddress, LocalPort, RemoteAddress, RemotePort, State, PID]) =>
    proxyWrap({ LocalAddress, LocalPort, RemoteAddress, RemotePort, State, PID, OwningProcess: PID })
  );
}
