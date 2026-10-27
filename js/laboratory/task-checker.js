/**
 * Проверка выполнения заданий.
 * Получает текущий урок, историю команд, результат и состояние среды.
 * Возвращает { passed, message }.
 */

import { flattenLessons } from '../course/course-data.js';

const LS = flattenLessons();

/**
 * Проверить задание текущего урока.
 * @param {number} lessonIndex — индекс текущего урока
 * @param {string[]} history — все введённые команды
 * @param {string} outText — форматированный вывод последней команды
 * @param {Array} result — результат последней команды
 * @param {object} interp — интерпретатор (для доступа к переменным)
 * @param {object} env — виртуальная среда { svcs, ... }
 * @returns {{ passed: boolean, message: string }}
 */
export function checkTask(lessonIndex, history, outText, result, interp, env) {
  if (lessonIndex < 0 || lessonIndex >= LS.length) {
    return { passed: false, message: 'Нет такого задания.' };
  }

  const lastCmd = history.length ? history[history.length - 1].toLowerCase() : '';
  const historyText = history.join('\n');
  const has = (re) => re.test(historyText);
  const lastHas = (re) => re.test(lastCmd);
  const V = interp.getVars();

  const checks = [
    () => lastHas(/man\s+ls/) && /ls \[/.test(outText),

    () => has(/>\s*result\.txt/) && has(/grep\s+ssh/) && has(/cat\s+result\.txt/) && outText.split('\n').length > 0,

    () => lastHas(/grep\s+log/) && outText.split('\n').length > 0,

    () => has(/colors\s*=\s*\(/) && lastHas(/echo\s+\$\{#colors\[@\]\}/) && /^\d+$/.test(outText.trim()),

    () => has(/>\s*hello\.txt/) && lastHas(/cat\s+hello\.txt/) && outText.trim().length > 0,

    () => has(/for\s+\w+\s+in\s+1.*5.*do.*done/) && ['1','2','3','4','5'].every(x => outText.includes(x)),

    () => lastHas(/grep\s+root/) && /root:/.test(outText),

    () => lastHas(/ps\s+aux/) && outText.split('\n').length > 1,

    () => lastHas(/^id$/) && /uid=/.test(outText),

    () => lastHas(/journalctl\s+-n\s+10/) && outText.split('\n').length > 0,

    () => has(/declare\s+-A\s+config/) && has(/echo\s+\$\{config\[port\]\}/) && outText.trim().length > 0,

    () => has(/greet\s*\(\s*\)/) && lastHas(/greet\s+/) && outText.trim().length > 0,

    () => has(/\$\?/) && /^\d+$/.test(outText.trim()),

    () => lastHas(/ss\s+-tlnp/) && outText.split('\n').length > 1,

    () => lastHas(/sha256sum\s+\/etc\/hostname/) && /^[a-f0-9]{64}/.test(outText),

    () => lastHas(/grep\s+-ri\s+password/) && has(/-ri/) && outText.split('\n').length >= 0
  ];

  let passed = false;
  try {
    passed = !!checks[lessonIndex] && checks[lessonIndex]();
  } catch (e) {
    passed = false;
  }

  if (passed) {
    return { passed: true, message: 'Задание выполнено ✓' };
  }

  const lesson = LS[lessonIndex];
  if (lesson && lesson.h) {
    return { passed: false, message: 'Попробуйте: ' + lesson.h };
  }

  return { passed: false, message: 'Попробуйте другую команду.' };
}
