/**
 * Журнал системных событий Linux (виртуальный).
 * События с уровнями: INFO, WARNING, ERROR, CRITICAL.
 */
import { proxyWrap } from './filesystem.js';

const MSG = {
  INFO: 'Информационное сообщение',
  WARNING: 'Предупреждение',
  ERROR: 'Ошибка выполнения',
  CRITICAL: 'Критическая ошибка'
};

export function createEvents() {
  const data = [
    ['INFO', 'systemd', 'Запущен процесс cron'],
    ['INFO', 'kernel', 'Загружен модуль vboxdrv'],
    ['WARNING', 'CRON', 'Файл конфигурации устарел'],
    ['ERROR', 'sshd', 'Ошибка аутентификации для пользователя root'],
    ['CRITICAL', 'kernel', 'Сектор не исправим на /dev/sda'],
    ['INFO', 'nginx', 'Запущен worker process'],
    ['WARNING', 'apt', 'Проблемы зависимостей'],
    ['ERROR', 'systemd', 'Не удалось запустить docker'],
    ['INFO', 'sshd', 'Подключение закрыто'],
    ['WARNING', 'kernel', 'Переполнение буфера сети']
  ];
  return data.map(([Level, Source, Message], n) =>
    proxyWrap({
      Time: '10:' + String(n).padStart(2, '0') + ':00',
      Level,
      Source,
      Message,
      Id: 1000 + n
    })
  );
}
