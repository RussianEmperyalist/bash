/**
 * App.js — точка входа для страницы курса.
 * Объединяет все модули в единое приложение.
 *
 * Экспортирует функции для использования в course.html.
 */

import { flattenLessons, courseModules } from './course/course-data.js';

export { initState, isLessonCompleted, markLessonCompleted, completedCount, setCurrentLesson, getCurrentLesson, progressPercent } from './core/state.js';
export { showToast } from './ui/toast.js';
export { createTerminal } from './laboratory/terminal.js';
export { checkTask } from './laboratory/task-checker.js';
export { pathToString } from './simulator/filesystem.js';

export const LS = flattenLessons();
export const TOTAL_LESSONS = LS.length;
export { courseModules };
