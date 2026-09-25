#!/usr/bin/env node
// backlog.json 조회/작업추가/상태수정 CLI.
//
// 사용법:
//   node scripts/backlog/cli.js list [--status=todo] [--priority=P0] [--category=feature] [--parent=P0]
//   node scripts/backlog/cli.js show <id>
//   node scripts/backlog/cli.js ready
//   node scripts/backlog/cli.js ids
//   node scripts/backlog/cli.js add --id=P9 --title=... --status=todo --priority=P2 --category=feature \
//        --summary=... --done_when=... [--where=] [--parent=] [--deps=P1,P2] [--doc=] [--est_min=20] \
//        [--owner=] [--note=] [--expected-version=<hash>]
//   node scripts/backlog/cli.js set-status <id> <new-status> [--expected-status=todo] \
//        [--expected-version=<hash>] [--note=...] [--owner=...]
//   node scripts/backlog/cli.js reorder <id> [--note=...] [--owner=...] [--expected-version=<hash>]
//        (parent가 같은 마지막 형제 task 바로 뒤로 위치만 옮긴다. status/내용은 안 바뀜)
//   node scripts/backlog/cli.js set-field <id> --<field>=<value> [--<field2>=<value2> ...] \
//        --note=<수정 근거> [--owner=...] [--expected-version=<hash>]
//        (허용 필드: title, summary, where, doc, done_when, est_min, gate, priority, category,
//        parent, deps(콤마 구분, 중복 제거됨). status/id/log/updated_at/done_at/claimed_at은
//        여기서 못 고침 — status는 set-status 전용. 모든 값은 문자열이어야 함(--field만 값 없이
//        넘기면 거부됨). where/doc/gate/parent는 빈 문자열이나 "null"을 주면 null로 비워짐.
//        parent를 바꾸면 add/reorder와 같은 규칙으로 새 부모의 형제 옆으로 위치도 옮겨짐.)
//
// 모든 명령에 공통 옵션: --file=<backlog.json 경로> (기본값: 프로젝트 실제 backlog.json)
//
// list/show/ready/ids 는 읽기 전용이며 파일을 절대 수정하지 않는다.
// gate 필드는 어디서도 실행하지 않는다 — 값 자체를 명령으로 넘기지 않는다.
'use strict';

const lib = require('./lib');

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) flags[arg.slice(2)] = true;
      else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function printJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function printError(err) {
  const out = {
    error: {
      code: err.code || 'ERROR',
      message: err.message,
      details: err.details || null,
    },
  };
  process.stderr.write(JSON.stringify(out, null, 2) + '\n');
}

function main() {
  const [, , cmd, ...rest] = process.argv;
  const { positional, flags } = parseArgs(rest);
  const filePath = flags.file || lib.DEFAULT_BACKLOG_PATH;

  if (!cmd || flags.help || cmd === 'help') {
    printJson({
      usage: [
        'list [--status=] [--priority=] [--category=] [--parent=]',
        'show <id>',
        'ready',
        'ids',
        'add --id= --title= --status= --priority= --category= --summary= --done_when= [--where=] [--parent=] [--deps=a,b] [--doc=] [--est_min=] [--owner=] [--note=] [--expected-version=]',
        'set-status <id> <new-status> [--expected-status=] [--expected-version=] [--note=] [--owner=]',
        'reorder <id> [--note=] [--owner=] [--expected-version=] (parent 형제 옆으로 위치만 이동)',
        'set-field <id> --<field>=<value>... --note= [--owner=] [--expected-version=] ' +
          '(field: title/summary/where/doc/done_when/est_min/gate/priority/category/parent/deps)',
        '공통: --file=<backlog.json 경로>',
      ],
    });
    process.exit(cmd ? 0 : 1);
  }

  try {
    if (cmd === 'list') {
      const file = lib.loadAndValidate(filePath);
      const tasks = lib.listTasks(file, {
        status: flags.status,
        priority: flags.priority,
        category: flags.category,
        parent: flags.parent,
      });
      printJson({ _source: lib.sourceMeta(file), count: tasks.length, tasks });
      return;
    }

    if (cmd === 'show') {
      const id = positional[0];
      if (!id) throw new lib.BacklogError('VALIDATION', 'show <id> 형식으로 id를 지정하세요.');
      const file = lib.loadAndValidate(filePath);
      const task = lib.getTask(file, id);
      printJson({ _source: lib.sourceMeta(file), task });
      return;
    }

    if (cmd === 'ready') {
      const file = lib.loadAndValidate(filePath);
      const tasks = lib.readyCandidates(file);
      printJson({ _source: lib.sourceMeta(file), count: tasks.length, tasks });
      return;
    }

    if (cmd === 'ids') {
      const file = lib.loadAndValidate(filePath);
      printJson({ _source: lib.sourceMeta(file), ids: lib.allIds(file) });
      return;
    }

    if (cmd === 'add') {
      const input = {
        id: flags.id,
        title: flags.title,
        status: flags.status,
        priority: flags.priority === 'null' ? null : flags.priority,
        category: flags.category,
        summary: flags.summary,
        where: flags.where,
        parent: flags.parent,
        deps: flags.deps ? String(flags.deps).split(',').map((s) => s.trim()).filter(Boolean) : [],
        doc: flags.doc,
        done_when: flags.done_when,
        est_min: flags.est_min !== undefined ? Number(flags.est_min) : undefined,
        owner: flags.owner,
        note: flags.note,
      };
      const result = lib.addTask(filePath, flags['expected-version'], input);
      printJson({ _source: lib.sourceMeta(result), added: lib.getTask(result, input.id) });
      return;
    }

    if (cmd === 'set-status') {
      const id = positional[0];
      const newStatus = positional[1];
      if (!id || !newStatus) {
        throw new lib.BacklogError('VALIDATION', 'set-status <id> <new-status> 형식으로 지정하세요.');
      }
      const result = lib.setStatus(filePath, flags['expected-version'], id, newStatus, {
        expectedStatus: flags['expected-status'],
        note: flags.note,
        owner: flags.owner,
      });
      printJson({ _source: lib.sourceMeta(result), updated: lib.getTask(result, id) });
      return;
    }

    if (cmd === 'reorder') {
      const id = positional[0];
      if (!id) throw new lib.BacklogError('VALIDATION', 'reorder <id> 형식으로 id를 지정하세요.');
      const result = lib.reorderTask(filePath, flags['expected-version'], id, {
        note: flags.note,
        owner: flags.owner,
      });
      printJson({ _source: lib.sourceMeta(result), reordered: lib.getTask(result, id) });
      return;
    }

    if (cmd === 'set-field') {
      const id = positional[0];
      if (!id) throw new lib.BacklogError('VALIDATION', 'set-field <id> --<field>=<value>... 형식으로 지정하세요.');
      const RESERVED_FLAGS = ['file', 'note', 'owner', 'expected-version', 'help'];
      const updates = {};
      for (const key of Object.keys(flags)) {
        if (RESERVED_FLAGS.includes(key)) continue;
        updates[key] = flags[key];
      }
      const result = lib.setField(filePath, flags['expected-version'], id, updates, {
        note: flags.note,
        owner: flags.owner,
      });
      printJson({ _source: lib.sourceMeta(result), updated: lib.getTask(result, id) });
      return;
    }

    printError(new lib.BacklogError('VALIDATION', `알 수 없는 명령: ${cmd}`));
    process.exit(1);
  } catch (e) {
    if (e instanceof lib.BacklogError) {
      printError(e);
      process.exit(1);
    }
    printError(new lib.BacklogError('ERROR', e.message));
    process.exit(1);
  }
}

main();
