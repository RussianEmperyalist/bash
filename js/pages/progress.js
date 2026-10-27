import { initPage, $, esc } from './common.js';
import { courseModules, isLessonCompleted, getCurrentLesson, completedCount, progressPercent, TOTAL_LESSONS, LS } from '../app.js';
initPage();
const cur = getCurrentLesson();
$('#pb').style.width = progressPercent(TOTAL_LESSONS) + '%';
$('#pd').textContent = 'Пройдено ' + completedCount() + ' из ' + TOTAL_LESSONS + ' уроков (' + progressPercent(TOTAL_LESSONS) + '%)';
let k = 0;
$('#tp').innerHTML = courseModules.map((m) => '<h3>' + esc(m.name) + ' · ' + esc(m.level) + '</h3><ul>' +
  m.lessons.map((l) => {
    const i = k++, done = isLessonCompleted(i);
    return '<li class="' + (done ? 'done' : i === cur ? 'current' : '') + '"><span class="icon">' + (done ? '✓' : i === cur ? '▶' : '○') + '</span><a href="course.html#' + (i + 1) + '" style="color:inherit;text-decoration:none">' + esc(l.t) + '</a></li>';
  }).join('') + '</ul>').join('');
const next = LS.findIndex((_, i) => !isLessonCompleted(i));
$('#nt').innerHTML = next < 0
  ? '🎉 <strong>Курс пройден!</strong> Вы можете повторить любой урок.'
  : 'Следующий шаг: <strong>' + esc(LS[next].t) + '</strong> — <a href="course.html#' + (next + 1) + '">продолжить</a>';
