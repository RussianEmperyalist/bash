/** Страница курса: уроки, учебная консоль, автопроверка заданий. */
import { initPage, refreshHeader, $, esc } from './common.js';
import {
  courseModules, LS, TOTAL_LESSONS, isLessonCompleted, markLessonCompleted, completedCount,
  setCurrentLesson, getCurrentLesson, showToast, createTerminal, checkTask
} from '../app.js';
import { resetProgress } from '../core/state.js';

initPage();
const hdr = document.querySelector('header');
const rs = document.createElement('button');
rs.className = 'gh'; rs.id = 'rs'; rs.textContent = 'Сброс';
hdr.append(rs);

let cur = getCurrentLesson();
let start = 0; // сколько команд было в истории к началу текущего урока

const term = createTerminal({
  outputEl: $('#o'), inputEl: $('#in'), promptEl: $('#ps'),
  onAfterExec(line, hist, text, results) {
    const r = checkTask(cur, hist.slice(start), text, results, term.getInterp(), term.getEnv());
    if (r.passed && !isLessonCompleted(cur)) {
      markLessonCompleted(cur);
      const tk = $('#tk'); if (tk) tk.classList.add('ok');
      renderNav(); refreshHeader();
      showToast(completedCount() === TOTAL_LESSONS ? 'Курс пройден! 🎉' : 'Задание выполнено ✓');
    }
  }
});

function renderNav() {
  let k = 0;
  $('#nv').innerHTML = courseModules.map((m) => '<h4>' + esc(m.name) + ' <span>' + esc(m.level) + '</span></h4>' +
    m.lessons.map((l) => {
      const i = k++, done = isLessonCompleted(i);
      return '<button data-i="' + i + '" class="' + (done ? 'd ' : '') + (i === cur ? 'on' : '') + '"><b>' + (done ? '✓' : i + 1) + '</b>' + esc(l.t) + '</button>';
    }).join('')).join('') +
    '<div class="pages"><a href="index.html">Главная</a><a href="progress.html">Прогресс</a><a href="about.html">О проекте</a></div>';
}

function show(i) {
  cur = Math.min(Math.max(i, 0), LS.length - 1);
  setCurrentLesson(cur);
  start = term.getHistory().length;
  const l = LS[cur];
  $('#ls').innerHTML = '<div class="bd">' + esc(l.level) + ' · ' + esc(l.module) + '</div><h1>' + esc(l.t) + '</h1>' + '<section class="scenario"><div class="scenario-title">Ситуация администратора</div><p>' + esc(l.scenario || '') + '</p><div class="scenario-steps"><b>Алгоритм работы</b><ol>' + (l.adminSteps || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ol></div></section>' + '<div>' + l.th + '</div>' +
    '<h3>Попробуйте в терминале</h3>' + l.ex.map((e, k) => '<button class="ch" data-k="' + k + '">' + esc(e) + '</button>').join('') +
    '<div class="task' + (isLessonCompleted(cur) ? ' ok' : '') + '" id="tk"><div class="st">✓ Выполнено</div><b>Задание</b><p>' + esc(l.task) + '</p>' +
    '<button id="hn" aria-expanded="false">Показать решение</button><pre id="hi" hidden>' + esc(l.h) + '</pre></div>' +
    '<div class="nv"><button id="pv"' + (cur ? '' : ' disabled') + '>← Назад</button><button class="pr" id="nx"' + (cur < LS.length - 1 ? '' : ' disabled') + '>Далее →</button></div>';
  $('#hn').onclick = () => { const h = $('#hi'); h.hidden = !h.hidden; $('#hn').setAttribute('aria-expanded', String(!h.hidden)); };
  $('#pv').onclick = () => show(cur - 1);
  $('#nx').onclick = () => show(cur + 1);
  $('#ls').scrollTop = 0; window.scrollTo(0, 0);
  renderNav(); refreshHeader(); closeDrawer();
}

function closeDrawer() { $('#nv').classList.remove('open'); $('#mn').setAttribute('aria-expanded', 'false'); }

$('#ls').onclick = (e) => {
  const b = e.target.closest('.ch'); if (!b) return;
  term.exec(LS[cur].ex[b.dataset.k]);
  if (innerWidth < 1000) $('#tm').scrollIntoView({ behavior: 'smooth' });
};
$('#nv').onclick = (e) => { const b = e.target.closest('button[data-i]'); if (b) show(+b.dataset.i); };
$('#mn').onclick = () => { const o = $('#nv').classList.toggle('open'); $('#mn').setAttribute('aria-expanded', String(o)); };
$('#cl').onclick = () => term.clearOutput();
$('#tm').onclick = () => { if (!getSelection().toString()) $('#in').focus({ preventScroll: true }); };

let timer = 0;
rs.onclick = () => {
  if (!timer) { rs.textContent = 'Точно?'; timer = setTimeout(() => { timer = 0; rs.textContent = 'Сброс'; }, 3000); return; }
  clearTimeout(timer); timer = 0; rs.textContent = 'Сброс';
  resetProgress(); term.resetLab(); show(0);
};

  term.out('Bash 4All — учебная консоль. Это безопасный симулятор: ничего не затрагивает ваш компьютер.\nНачните с man ls, стрелка вверх — предыдущая команда.\n', 'sy');
const fromHash = parseInt(location.hash.slice(1), 10);
show(fromHash >= 1 && fromHash <= LS.length ? fromHash - 1 : cur);
