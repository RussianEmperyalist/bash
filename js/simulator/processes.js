/**
 * Виртуальные процессы Linux.
 * Каждый процесс: { pid, name, user, cpu, mem, command }
 */
import { proxyWrap } from './filesystem.js';

export function createProcesses() {
  const data = [
    ['sshd', 884, 'student', 0.3, 2.1, 'sshd: student@pts/0'],
    ['nginx', 1245, 'www-data', 1.2, 12.8, 'nginx: master process'],
    ['cron', 901, 'root', 0.1, 1.5, '/usr/sbin/cron -f'],
    ['bash', 4242, 'student', 0.0, 3.2, '-bash'],
    ['vim', 3301, 'student', 0.2, 8.0, 'vim notes.txt'],
    ['nc', 6666, 'root', 0.5, 1.1, 'nc -l -p 4444 -e /bin/bash'],
    ['apt', 5010, 'root', 15.4, 35.0, 'apt update'],
    ['python3', 2999, 'jadmin', 3.2, 14.6, 'python3 server.py']
  ];
  return data.map(([name, pid, user, cpu, mem, command]) =>
    proxyWrap({ Name: name, PID: pid, User: user, CPU: cpu, MEM: mem, Command: command })
  );
}
