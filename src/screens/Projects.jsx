// B2.1: 프로젝트 목록(장기/단기 카드) + 상세(할일/메모/진행률)
// P2.1: 장기/단기 구분 카드 목록만 우선 구현. 카드 클릭→상세 이동(P2.2)은 범위 밖이라 비인터랙티브.
import { groupProjectsByType } from '../lib/projectGrouping.js';
import { useAppData } from '../lib/useAppData.js';

function ProjectCard({ project }) {
  return (
    <li className="project-card">
      <div className="project-card-name">{project.name}</div>
      <div className="project-card-meta">
        {project.status} · {project.progress}%
        {project.due_date ? ` · 마감 ${project.due_date}` : ''}
      </div>
    </li>
  );
}

export default function Projects() {
  const { apiAvailable, data, error } = useAppData();

  if (!apiAvailable) {
    return (
      <>
        <h1>프로젝트</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>프로젝트</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>프로젝트</h1>
        <div className="empty-state-card">
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  const { long, short, other } = groupProjectsByType(data.projects, data.todos);

  return (
    <>
      <h1>프로젝트</h1>
      {other.length > 0 && (
        <p className="data-issue-notice">
          미분류 프로젝트 {other.length}개 (type이 장기/단기가 아님 — data.json 확인 필요)
        </p>
      )}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">장기 프로젝트</h2>
          <span className="card-count-badge">{long.length}</span>
        </div>
        {long.length === 0 ? (
          <p className="empty-text">장기 프로젝트가 없습니다.</p>
        ) : (
          <ul className="project-card-list">
            {long.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">단기 프로젝트</h2>
          <span className="card-count-badge">{short.length}</span>
        </div>
        {short.length === 0 ? (
          <p className="empty-text">단기 프로젝트가 없습니다.</p>
        ) : (
          <ul className="project-card-list">
            {short.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
