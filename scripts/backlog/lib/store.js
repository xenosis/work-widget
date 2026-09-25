// backlog.json 파일 I/O: 읽기+해시, 원자적 쓰기(+백업), 낙관적 동시성 확인.
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const { BacklogError, assertValid, findCycle, findParentCycle } = require('./schema');

const DEFAULT_BACKLOG_PATH = 'C:/교육/바이브코딩교육/backlog.json';

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** 파일을 읽고 {raw, json, hash, size, mtimeMs, path} 반환. 파싱 실패 시 BacklogError('PARSE_ERROR'). */
function readBacklogFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    throw new BacklogError('IO_ERROR', `backlog.json을 읽을 수 없습니다: ${filePath} (${e.message})`);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new BacklogError('PARSE_ERROR', `backlog.json JSON 파싱 오류: ${e.message}`);
  }
  const stat = fs.statSync(filePath);
  return {
    raw,
    json,
    hash: sha256(Buffer.from(raw, 'utf-8')),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    path: filePath,
  };
}

function loadAndValidate(filePath) {
  const file = readBacklogFile(filePath);
  assertValid(file.json);
  const cyc = findCycle(file.json.tasks);
  if (cyc) {
    throw new BacklogError('SCHEMA_ERROR', 'backlog.json deps에 순환 의존성이 있습니다', [cyc.join(' -> ')]);
  }
  const parentCyc = findParentCycle(file.json.tasks);
  if (parentCyc) {
    throw new BacklogError('SCHEMA_ERROR', 'backlog.json parent에 순환 참조가 있습니다', [parentCyc.join(' -> ')]);
  }
  return file;
}

function sourceMeta(file) {
  return {
    path: file.path,
    sha256: file.hash,
    size: file.size,
    task_count: file.json.tasks.length,
  };
}

function backupPath(filePath) {
  return filePath + '.bak';
}

function atomicWrite(filePath, newJsonObj, originalRaw) {
  // 검증 전 원본을 백업(덮어쓰기 전 스냅샷 — 롤링 1개 보관)
  fs.writeFileSync(backupPath(filePath), originalRaw, 'utf-8');
  const tmpPath = filePath + '.tmp-' + process.pid;
  const text = JSON.stringify(newJsonObj, null, 2) + '\n';
  fs.writeFileSync(tmpPath, text, 'utf-8');
  fs.renameSync(tmpPath, filePath); // 같은 볼륨 내 rename은 원자적
}

/**
 * 낙관적 동시성 확인 + 스키마/참조/사이클 재검증 후 원자적 저장까지 한 번에 처리.
 * mutateFn(json) 은 in-place로 json.tasks 등을 수정하고 아무것도 반환하지 않는다.
 * 실패 시 예외를 던지고 파일은 건드리지 않는다(마지막 성공 검증 이후에만 write).
 */
function loadMutateValidateSave(filePath, expectedVersion, mutateFn) {
  const before = readBacklogFile(filePath);
  if (expectedVersion && expectedVersion !== before.hash) {
    throw new BacklogError(
      'CONFLICT',
      `backlog.json이 조회 이후 변경되었습니다 (기대 버전 ${expectedVersion}, 실제 ${before.hash}). ` +
      `다시 조회한 뒤 재시도하세요.`,
      { expected: expectedVersion, actual: before.hash }
    );
  }
  assertValid(before.json); // 쓰기 전에도 현재 파일이 이미 깨져있지 않은지 먼저 확인

  const after = JSON.parse(JSON.stringify(before.json)); // deep clone, before는 그대로 유지
  mutateFn(after);

  assertValid(after); // 변경 결과도 검증
  const cyc = findCycle(after.tasks);
  if (cyc) {
    throw new BacklogError('SCHEMA_ERROR', '변경 결과 deps에 순환 의존성이 생깁니다', [cyc.join(' -> ')]);
  }
  // deps 순환과 별개 그래프라 위 findCycle이 안 잡아준다(P11 critical-reviewer 지적) — parent도
  // 여기서 최종 방어선으로 확인한다. set-field의 assertNoParentCycle은 사람이 읽을 수 있는
  // 필드 단위 오류를 먼저 주기 위한 것일 뿐, 유일한 방어선이 아니다.
  const parentCyc = findParentCycle(after.tasks);
  if (parentCyc) {
    throw new BacklogError('SCHEMA_ERROR', '변경 결과 parent에 순환 참조가 생깁니다', [parentCyc.join(' -> ')]);
  }

  atomicWrite(filePath, after, before.raw);
  return readBacklogFile(filePath); // 새 해시 포함해서 반환
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  DEFAULT_BACKLOG_PATH,
  sha256,
  readBacklogFile,
  loadAndValidate,
  sourceMeta,
  atomicWrite,
  loadMutateValidateSave,
  nowIso,
};
