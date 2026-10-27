/**
 * Централизованное состояние приложения.
 * Все мутации проходят через методы этого модуля.
 */

import { load, save, clear } from './storage.js';
import { flattenLessons } from '../course/course-data.js';

const state = {
  currentLesson: 0,
  completedLessons: {}  // { [lessonIndex]: 1 }
};

/** Загрузить состояние из localStorage. */
export function initState() {
  const saved = load();
  const maxLesson = Math.max(flattenLessons().length - 1, 0);
  if (saved) {
    state.currentLesson = Math.min(Math.max(Number(saved.c) || 0, 0), maxLesson);
    state.completedLessons = saved.d || {};
  } else {
    state.currentLesson = 0;
    state.completedLessons = {};
  }
  return state;
}

/** Сохранить текущее состояние. */
export function persist() {
  save({
    c: state.currentLesson,
    d: state.completedLessons
  });
}

/** Полный сброс прогресса. */
export function resetProgress() {
  state.currentLesson = 0;
  state.completedLessons = {};
  clear();
}

export function getCurrentLesson() {
  return state.currentLesson;
}

export function setCurrentLesson(index) {
  state.currentLesson = index;
  persist();
}

export function isLessonCompleted(index) {
  return !!state.completedLessons[index];
}

export function markLessonCompleted(index) {
  state.completedLessons[index] = 1;
  persist();
}

export function completedCount() {
  return Object.keys(state.completedLessons).length;
}

/** Прогресс в процентах (totalLessons — всего уроков). */
export function progressPercent(totalLessons) {
  if (!totalLessons || totalLessons <= 0) return 0;
  return Math.round((completedCount() / totalLessons) * 100);
}

export { state };
