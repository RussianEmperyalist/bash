/**
 * История команд в терминале.
 */

export function createHistory() {
  const commands = [];
  let pos = 0;

  return {
    push(cmd) {
      if (cmd === commands[commands.length - 1]) return;
      commands.push(cmd);
      pos = commands.length;
    },

    prev() {
      if (pos > 0) {
        pos--;
        return commands[pos] || '';
      }
      return '';
    },

    next() {
      if (pos < commands.length) {
        pos++;
        return commands[pos] || '';
      }
      pos = commands.length;
      return '';
    },

    all() {
      return [...commands];
    },

    reset() {
      commands.length = 0;
      pos = 0;
    }
  };
}
