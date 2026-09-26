// P15(사람 결정, 2026-09-26): 일정 카테고리 관리와 외부 backlog(.json) 소스 관리가 일정
// 화면 위쪽을 가려 캘린더가 바로 안 보인다는 피드백으로, 두 관리 UI를 전용 사이드바 탭으로
// 옮긴다. 이 화면은 다른 화면들처럼 자체적으로 useAppData()를 불러 data/setData를 들고
// 있고(Schedule.jsx와 데이터를 공유하는 게 아니라 각자 로드), CRUD 핸들러는 기존에 이미
// Schedule.jsx가 쓰던 순수 액션 팩토리(createScheduleCategoryActions/createBacklogSourceActions)를
// 그대로 재사용한다 — 로직 이원화 방지.
import { useState } from 'react';
import { useAppData } from '../lib/useAppData.js';
import { SettingsIcon } from '../components/icons.jsx';
import ScheduleCategorySection from '../components/ScheduleCategorySection.jsx';
import BacklogSourcesSection from '../components/BacklogSourcesSection.jsx';
import { createScheduleCategoryActions } from '../lib/scheduleCategoryActions.js';
import { createBacklogSourceActions } from '../lib/backlogSourceActions.js';

export default function Settings() {
  const { apiAvailable, data, error, setData } = useAppData();
  // critical-reviewer 지적(P5.4 리뷰 등, 이 세션 내내 반복된 패턴): 화면 전체 saving 가드로
  // 겹쳐 들어가는 저장이 옛 데이터로 나중 저장을 덮어쓰는 것을 막는다.
  const [saving, setSaving] = useState(false);

  if (!apiAvailable) {
    return (
      <>
        <h1>설정</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>설정</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>설정</h1>
        <div className="empty-state-card">
          <SettingsIcon />
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  const { handleAddCategory, handleEditCategory, handleDeleteCategory } = createScheduleCategoryActions({
    data,
    setData,
    saving,
    setSaving,
  });
  const { handleAddSource, handleDeleteSource } = createBacklogSourceActions({ data, setData, saving, setSaving });

  return (
    <>
      <h1>설정</h1>
      <ScheduleCategorySection
        categories={data.schedule_categories}
        onAdd={handleAddCategory}
        onEdit={handleEditCategory}
        onDelete={handleDeleteCategory}
        disabled={saving}
      />
      <BacklogSourcesSection
        sources={data.backlog_sources}
        onAdd={handleAddSource}
        onDelete={handleDeleteSource}
        disabled={saving}
      />
    </>
  );
}
