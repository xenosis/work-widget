// B2.1: 프로젝트를 장기/단기로 구분한다. B3.1의 Project.type enum은 "장기"|"단기" 두 값뿐이지만,
// 프로젝트 생성 경로가 아직 IPC(P2.5)로 연동되지 않아 현재는 data.json 수기 편집이 유일한 생성
// 수단이고(요구사항이 이를 명시적으로 허용), electron/dataStore.js의 normalizeData는 필드 단위
// 검증을 하지 않는다 — 그래서 type이 없거나 오타인 레코드가 조용히 사라지지 않도록 "other"로
// 분리해서 계속 추적 가능하게 한다.
import { calculateProjectProgress } from './projectProgress.js';

// id 없는 레코드는 React key로 못 쓰므로 제외한다(Dashboard.jsx와 동일한 방어).
export function groupProjectsByType(projects, todos) {
  const withProgress = (Array.isArray(projects) ? projects : [])
    .filter((p) => p && typeof p.id === 'string')
    .map((p) => ({ ...p, progress: calculateProjectProgress(p.id, todos) }));
  return {
    long: withProgress.filter((p) => p.type === '장기'),
    short: withProgress.filter((p) => p.type === '단기'),
    other: withProgress.filter((p) => p.type !== '장기' && p.type !== '단기'),
  };
}
