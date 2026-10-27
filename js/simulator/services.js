/**
 * Виртуальные службы systemd.
 * Каждая служба: { Name, Status, Description, Type }
 */
import { proxyWrap } from './filesystem.js';

export function createServices() {
  const data = [
    ['ssh', 'active (running)', 'OpenBSD Secure Shell server', 'simple'],
    ['nginx', 'active (running)', 'The nginx HTTP and reverse proxy server', 'simple'],
    ['cron', 'active (running)', 'Regular background program processing daemon', 'simple'],
    ['systemd-resolved', 'active (running)', 'DNS resolver', 'simple'],
    ['docker', 'inactive (dead)', 'Docker Application Container Engine', 'simple'],
    ['fail2ban', 'inactive (dead)', 'Ban IPs that look malicious', 'simple'],
    ['rsyslog', 'active (running)', 'System monitoring daemon', 'simple'],
    ['ufw', 'active (running)', 'Uncomplicated firewall', 'simple']
  ];
  return data.map(([Name, Status, Description, Type]) =>
    proxyWrap({ Name, Status, Description, Type })
  );
}
