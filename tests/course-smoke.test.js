import test from 'node:test';
import assert from 'node:assert/strict';
import { courseModules, flattenLessons } from '../js/course/course-data.js';
import { createTerminal } from '../js/laboratory/terminal.js';
import { checkTask } from '../js/laboratory/task-checker.js';

// Терминалу нужен только небольшой DOM-мок: симулятор не должен менять настоящий компьютер.
globalThis.document ??= {
  createElement() {
    return { className: '', textContent: '', remove() {} };
  }
};

function createOutput() {
  return {
    nodes: [],
    childElementCount: 0,
    scrollTop: 0,
    scrollHeight: 0,
    innerHTML: '',
    append(node) { this.nodes.push(node); this.childElementCount = this.nodes.length; },
    removeChild() { this.nodes.shift(); this.childElementCount = this.nodes.length; },
    insertBefore(node) { this.nodes.unshift(node); this.childElementCount = this.nodes.length; }
  };
}

function runInFreshTerminal(command, onAfterExec) {
  const outputEl = createOutput();
  const terminal = createTerminal({ outputEl, inputEl: null, promptEl: { textContent: '' }, onAfterExec });
  terminal.exec(command);
  return { outputEl, terminal };
}

test('все 16 уроков имеют теорию, задание, подсказку и примеры', () => {
  assert.equal(flattenLessons().length, 16);
  for (const module of courseModules) {
    assert.ok(module.name);
    assert.ok(module.lessons.length);
    for (const lesson of module.lessons) {
      assert.ok(lesson.th.length > 100, `${lesson.t}: теория слишком короткая`);
      assert.ok(lesson.task);
      assert.ok(lesson.h);
      assert.ok(lesson.ex.length > 0);
    }
  }
});

test('все кнопки примеров запускаются без ошибки в чистой лаборатории', () => {
  const errors = [];
  for (const [lessonIndex, lesson] of flattenLessons().entries()) {
    for (const command of lesson.ex) {
      const { outputEl } = runInFreshTerminal(command);
      const error = outputEl.nodes.find(node => node.className === 'er');
      if (error) errors.push(`Урок ${lessonIndex + 1} «${lesson.t}»: ${command} → ${error.textContent}`);
    }
  }
  assert.deepEqual(errors, []);
});

test('подсказка к каждому уроку позволяет пройти автопроверку', () => {
  const failures = [];
  for (const [lessonIndex, lesson] of flattenLessons().entries()) {
    let terminal;
    let check = { passed: false, message: 'Команда не проверена' };
    const outputEl = createOutput();
    terminal = createTerminal({
      outputEl,
      inputEl: null,
      promptEl: { textContent: '' },
      onAfterExec(_line, history, outputText, result) {
        check = checkTask(lessonIndex, history, outputText, result, terminal.getInterp(), terminal.getEnv());
      }
    });
    for (const command of lesson.h.split('\n')) terminal.exec(command);
    if (!check.passed) failures.push(`Урок ${lessonIndex + 1} «${lesson.t}»: ${check.message}`);
  }
  assert.deepEqual(failures, []);
});
