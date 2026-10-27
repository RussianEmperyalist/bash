/**
 * Виртуальные пользователи Linux (/etc/passwd).
 * Каждая запись: { Name, UID, GID, Home, Shell, Enabled }
 */
import { proxyWrap } from './filesystem.js';

export function createUsers() {
  const data = [
    ['root', 0, 0, '/root', '/bin/bash', true],
    ['student', 1000, 1000, '/home/student', '/bin/bash', true],
    ['guest', 1001, 1001, '/home/guest', '/usr/sbin/nologin', false],
    ['svc_backup', 200, 200, '/var/backups', '/usr/sbin/nologin', true],
    ['jadmin', 1002, 1002, '/home/jadmin', '/bin/bash', true],
    ['tempuser', 1003, 1003, '/home/tempuser', '/bin/bash', false]
  ];
  return data.map(([Name, UID, GID, Home, Shell, Enabled]) =>
    proxyWrap({ Name, UID, GID, Home, Shell, Enabled })
  );
}

export function createGroups() {
  return [
    { Name: 'root', GID: 0 },
    { Name: 'student', GID: 1000 },
    { Name: 'www-data', GID: 33 },
    { Name: 'adm', GID: 4 },
    { Name: 'sudo', GID: 27 },
    { Name: 'docker', GID: 999 }
  ];
}
