/**
 * Виртуальная файловая система Linux.
 * Структура: D({ c: { ... } }) — каталог, F(f) — файл.
 * Пути в Linux: /home/student/Documents/notes.txt
 */

export function F(f) {
  return { f };
}

export function D(c) {
  return { c };
}

/**
 * Создать исходную файловую структуру лаборатории.
 * /home/student/Documents/notes.txt
 * /home/student/Documents/creds.txt
 * /home/student/Documents/Logs/app.log
 * /home/student/Documents/Scripts/
 */
export function createFilesystem() {
  return D({
    etc: D({
      hostname: F('bash4all\n'),
      os_release: F('NAME="Debian GNU/Linux"\nVERSION="12 (bookworm)"\n'),
      passwd: F('root:x:0:0:root:/root:/bin/bash\nstudent:x:1000:1000:Student:/home/student:/bin/bash\nguest:x:1001:1001:Guest:/home/guest:/usr/sbin/nologin\n'),
      'passwd-': F('root:x:0:0:root:/root:/bin/bash\n'),
      nginx: D({
        'nginx.conf': F('worker_processes 1;\nlisten 80;\nserver_name localhost;\n')
      }),
      ssh: D({
        'sshd_config': F('Port 22\nPermitRootLogin no\nPasswordAuthentication yes\n')
      })
    }),
    var: D({
      log: D({
        syslog: F('Oct 27 10:01:01 linux systemd[1]: Started Session.\nOct 27 10:02:00 linux sshd[884]: Accepted password for student from 192.168.1.10\nOct 27 10:05:13 linux kernel: [UFW BLOCK] IN=eth0 SRC=185.220.101.5 DST=192.168.1.15\nOct 27 10:09:00 linux CRON[1023]: (root) CMD (test -x)\nOct 27 10:13:44 linux kernel: [UFW ALLOW] IN=eth0 SRC=93.184.216.34 DST=192.168.1.15\n'),
        auth: D({
          'auth.log': F('Oct 27 09:58:00 linux sshd[884]: Failed password for root from 10.0.0.5\nOct 27 09:58:05 linux sshd[884]: Failed password for root from 10.0.0.5\nOct 27 10:00:02 linux sshd[901]: Accepted publickey for student\nOct 27 10:02:33 linux sudo[1102]: student : TTY=pts/0 ; PWD=/home/student ; USER=root ; COMMAND=/usr/bin/apt update\n')
        }),
        nginx: D({
          'error.log': F('[error] 1245#0: *7 open() "/var/www/html/favicon.ico" failed\n[error] 1245#0: *7 open() "/var/www/html/secret.key" failed\n')
        })
      }),
      lib: D({
        dpkg: D({})
      })
    }),
    home: D({
      student: D({
        Documents: D({
          'notes.txt': F('Встреча в 10:00\nПароль от VPN: Winter2024!\n'),
          'creds.txt': F('login=admin\npassword=P@ssw0rd\n'),
          Logs: D({
            'app.log': F('INFO start\nWARN disk 91%\nERROR db timeout\nINFO ok\nERROR auth failed\n')
          }),
          Scripts: D({}),
          'config.txt': F('DB_HOST=localhost\nAPI_KEY=sk-1234567890abcdef\nTOKEN=eyJhbGciOiJIUzI1\n')
        })
      })
    }),
    usr: D({
      bin: D({
        ls: F(''), grep: F(''), ps: F(''), top: F(''), bash: F(''), man: F(''), cat: F(''), date: F(''), whoami: F(''), id: F(''), chmod: F(''), chown: F(''), mv: F(''), cp: F(''), rm: F(''), find: F(''), wc: F(''), sort: F(''), head: F(''), tail: F(''), awk: F(''), cut: F(''), ss: F(''), ip: F(''), systemctl: F(''), journalctl: F(''), kill: F(''), df: F(''), du: F(''), free: F(''), useradd: F(''), sha256sum: F(''), md5sum: F(''), echo: F(''), umask: F(''), groups: F(''), which: F(''), type: F(''), pwd: F(''), uptime: F(''), uname: F(''), crontab: F(''), sshd: F(''), nginx: F(''), cron: F(''), vim: F(''), sshd_config_test: F('')
      })
    }),
    proc: D({
      '1': D({}), 
      '884': D({}),
      '1245': D({}),
      '4242': D({}),
      '6666': D({})
    }),
    tmp: D({})
  });
}

/**
 * Ключевой фильтр: найти ключ в каталоге (case-insensitive).
 */
export function findKey(node, name) {
  if (!node || !node.c) return undefined;
  return Object.keys(node.c).find(k => k.toLowerCase() === name.toLowerCase());
}

/**
 * Получить узел по пути (массив сегментов).
 */
export function getNode(fsRoot, segments) {
  let node = fsRoot;
  for (const s of segments) {
    const k = findKey(node, s);
    if (!k) return null;
    node = node.c[k];
  }
  return node;
}

/**
 * Преобразовать массив сегментов в строку пути (/home/student).
 */
export function pathToString(segments) {
  return '/' + segments.join('/');
}

/**
 * Разрешить относительный/абсолютный путь в [segments, node, parent, name].
 */
export function resolvePath(fsRoot, cwd, path) {
  if (path == null) {
    throw new Error('Не указан путь. Пример: cat notes.txt');
  }
  let segments;
  if (path === '' || path === '.') {
    segments = [...cwd];
  } else if (String(path).startsWith('/')) {
    segments = [];
  } else {
    segments = [...cwd];
  }
  for (const s of String(path).split(/[/\\]/)) {
    if (!s || s === '.') continue;
    if (s === '..') segments.pop();
    else segments.push(s);
  }
  const node = getNode(fsRoot, segments);
  const parent = segments.length > 0 ? getNode(fsRoot, segments.slice(0, -1)) : null;
  const name = segments[segments.length - 1];
  return { segments, node, parent, name };
}

/**
 * Считать содержимое файла.
 */
export function readFile(fsRoot, cwd, path) {
  const r = resolvePath(fsRoot, cwd, path);
  if (!r.node) throw new Error(`cat: ${path}: Нет такого файла или каталога`);
  if (r.node.c) throw new Error(`cat: ${path}: Это каталог, а не файл`);
  return r.node.f.replace(/\r\n?/g, '\n');
}

/**
 * Записать/добавить содержимое файла.
 */
export function writeFile(fsRoot, cwd, path, text, append) {
  const r = resolvePath(fsRoot, cwd, path);
  if (!r.parent || !r.parent.c) throw new Error(`cat: ${path}: Каталог не найден`);
  if (r.node && r.node.c) throw new Error(`cat: ${path}: Это каталог`);
  const key = findKey(r.parent, r.name) || r.name;
  if (append && r.node) {
    r.parent.c[key] = F(r.node.f + text);
  } else {
    r.parent.c[key] = F(text);
  }
}

/**
 * Получить список каталога (ls).
 */
export function listDirectory(node, segments, recursive) {
  if (!node.c) return [];
  const result = [];
  for (const k of Object.keys(node.c)) {
    const child = node.c[k];
    const isDir = !!child.c;
    result.push({
      name: k,
      isDir,
      mode: isDir ? 'drwxr-xr-x' : '-rw-r--r--',
      size: isDir ? child.f || '' : child.f.length,
      fullPath: pathToString([...segments, k])
    });
    if (recursive && child.c) {
      result.push(...listDirectory(child, [...segments, k], 1));
    }
  }
  return result;
}

/**
 * Proxy для case-insensitive доступа к свойствам.
 */
export function proxyWrap(obj) {
  return new Proxy(obj, {
    get(target, key) {
      if (typeof key !== 'string' || key in target) return target[key];
      const found = Object.keys(target).find(k => k.toLowerCase() === key.toLowerCase());
      return found !== undefined ? target[found] : undefined;
    }
  });
}
