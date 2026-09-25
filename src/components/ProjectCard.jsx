// Projects.jsx(P2.1)에서 분리 — P2.5로 파일이 커져 eslint max-lines(300) 여유를 두기 위해
// ProjectDetail.jsx와 함께 컴포넌트 파일로 뺐다.
// P2.7: docs/backlog/P2.1.md(backlog-explainer 산출 파생 문서)가 "진행률 바"를 서술했는데
// 실제로는 퍼센트 숫자만 있었다(critical-reviewer가 P9 리뷰 중 발견) — 다만 요구사항 원본
// B2.1은 목록 카드에 진행률 바를 요구하지 않는다(진행률은 B1.2 대시보드/B2.1 상세 화면에만
// 명시됨, work-widget-requirements.md#B2.1). 즉 이 변경의 근거는 파생 문서와 실제 구현의
// 불일치이지 원본 요구사항 미충족이 아니다 — Dashboard.jsx가 이미 쓰는
// .progress-track/.progress-fill을 그대로 재사용해 시각적으로 통일했다.
import { progressBarWidth } from '../lib/projectProgress.js';

export default function ProjectCard({ project, onSelect }) {
  return (
    <li>
      <button className="project-card-button" onClick={() => onSelect(project.id)}>
        <div className="project-card-name">{project.name}</div>
        <div className="project-card-meta">
          {project.status} · {project.progress}%
          {project.due_date ? ` · 마감 ${project.due_date}` : ''}
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: progressBarWidth(project.progress) }} />
        </div>
      </button>
    </li>
  );
}
