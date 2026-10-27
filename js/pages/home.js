import { initPage, $ } from './common.js';
import { completedCount, progressPercent, TOTAL_LESSONS } from '../app.js';
initPage();
$('#hb').style.width = progressPercent(TOTAL_LESSONS) + '%';
$('#hd').textContent = 'Пройдено уроков: ' + completedCount() + ' из ' + TOTAL_LESSONS + ' (' + progressPercent(TOTAL_LESSONS) + '%)';
