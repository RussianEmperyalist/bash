/**
 * Терминал лаборатории — DOM-обёртка для ввода/вывода bash.
 */

import { createInterpreter } from '../bash/interpreter.js';
import { proxyWrap, pathToString } from '../simulator/filesystem.js';
import { createProcesses } from '../simulator/processes.js';
import { createServices } from '../simulator/services.js';
import { createUsers } from '../simulator/users.js';
import { createEvents } from '../simulator/events-log.js';
import { createNetworkConnections } from '../simulator/network.js';
import { resetPolicies } from '../simulator/policies.js';
import { createFilesystem } from '../simulator/filesystem.js';
import { createHistory } from './history.js';

export function createTerminal(options) {
  const { outputEl, inputEl, promptEl, onAfterExec } = options;

  // Виртуальная среда
  let procs = createProcesses();
  let svcs = createServices();
  let users = createUsers();
  let events = createEvents();
  let net = createNetworkConnections();
  let fsRoot = createFilesystem();
  let cwd = ['home', 'student'];

  const MAX_OUTPUT_NODES = 5000;
  function out(text, cssClass) {
    const div = document.createElement('div');
    div.className = cssClass || '';
    div.textContent = text;
    outputEl.append(div);
    outputEl.scrollTop = outputEl.scrollHeight;
    if (outputEl.childElementCount > MAX_OUTPUT_NODES) {
      while (outputEl.childElementCount > MAX_OUTPUT_NODES / 2) {
        outputEl.removeChild(outputEl.firstChild);
      }
    }
  }

  const interp = createInterpreter({
    cwd,
    proxyWrap,
    home: '/home/student',
    user: 'student',
    hostname: 'bash4all'
  });

  const history = createHistory();

  function updatePrompt() {
    if (promptEl) {
      promptEl.textContent = pathToString(cwd) + '$ ';
    }
  }

  function exec(line) {
    line = line.trim();
    if (!line) return;

    out((promptEl ? promptEl.textContent : '$ ') + ' ' + line, 'cm');
    history.push(line);

    try {
      if (/^clear$/.test(line)) {
        clearOutput();
        if (onAfterExec) {
          onAfterExec(line, history.all(), '', []);
        }
        return;
      }

      const results = interp.run(line);
      const text = results.lines ? results.lines.join('\n') : '';
      if (text) out(text, results.code ? 'er' : '');
      if (onAfterExec) {
        onAfterExec(line, history.all(), text, results);
      }
    } catch (e) {
      const msg = e instanceof RangeError
        ? 'Слишком глубокая рекурсия или слишком большой объём данных.'
        : e && e.message ? e.message : 'Ошибка выполнения команды';
      out(msg, 'er');
    }

    updatePrompt();
  }

  if (inputEl) {
    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        exec(inputEl.value);
        inputEl.value = '';
      } else if (e.key === 'ArrowUp') {
        inputEl.value = history.prev();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        inputEl.value = history.next();
      } else if (e.key === 'l' && e.ctrlKey) {
        outputEl.innerHTML = '';
        e.preventDefault();
      }
    };
  }

  function clearOutput() {
    outputEl.innerHTML = '';
  }

  function resetLab() {
    procs = createProcesses();
    svcs = createServices();
    users = createUsers();
    events = createEvents();
    net = createNetworkConnections();
    fsRoot = createFilesystem();
    cwd = ['home', 'student'];
    resetPolicies();
    interp.reset();
    history.reset();
    clearOutput();
    updatePrompt();
  }

  updatePrompt();

  return {
    exec,
    clearOutput,
    resetLab,
    updatePrompt,
    getHistory: () => history.all(),
    getInterp: () => interp,
    getEnv: () => ({ procs, svcs, users, events, net, fsRoot, cwd }),
    out
  };
}
