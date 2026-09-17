import { useState } from 'react';

// B2.3: 좌측 메모 목록 + 우측 편집창, 프로젝트 태그 표시
// P4.2(IPC 연동) 전까지는 메모리 내 예시 데이터로만 동작한다 — 실제 저장/불러오기는 없음.
const SEED_MEMOS = [
  {
    id: 'memo-1',
    project_id: null,
    title: '예시 메모',
    content: '왼쪽 목록에서 메모를 고르면 여기서 편집할 수 있습니다.',
    created_at: '2026-09-15T00:00:00.000Z',
    updated_at: '2026-09-15T00:00:00.000Z',
  },
];

function createBlankMemo() {
  const now = new Date().toISOString();
  return {
    id: `memo-${crypto.randomUUID()}`,
    project_id: null,
    title: '',
    content: '',
    created_at: now,
    updated_at: now,
  };
}

export default function Memos() {
  const [memos, setMemos] = useState(SEED_MEMOS);
  const [selectedId, setSelectedId] = useState(SEED_MEMOS[0]?.id ?? null);

  const selected = memos.find((m) => m.id === selectedId) ?? null;

  function updateSelected(patch) {
    if (!selected) return;
    setMemos((prev) =>
      prev.map((m) => (m.id === selected.id ? { ...m, ...patch, updated_at: new Date().toISOString() } : m))
    );
  }

  function handleAddMemo() {
    const blank = createBlankMemo();
    setMemos((prev) => [blank, ...prev]);
    setSelectedId(blank.id);
  }

  return (
    <>
      <h1>메모</h1>
      <div className="memos-layout">
        <div className="memo-list">
          <button className="memo-add-btn" onClick={handleAddMemo}>
            + 새 메모
          </button>
          {memos.length === 0 && <p className="memo-empty">메모가 없습니다.</p>}
          <ul>
            {memos.map((m) => (
              <li key={m.id}>
                <button
                  className={m.id === selectedId ? 'memo-list-item active' : 'memo-list-item'}
                  onClick={() => setSelectedId(m.id)}
                >
                  <span className="memo-list-title">{m.title || '(제목 없음)'}</span>
                  {m.project_id && <span className="memo-tag">{m.project_id}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="memo-editor">
          {selected ? (
            <>
              <input
                className="memo-title-input"
                type="text"
                value={selected.title}
                placeholder="제목"
                onChange={(e) => updateSelected({ title: e.target.value })}
              />
              <textarea
                className="memo-content-input"
                value={selected.content}
                placeholder="내용을 입력하세요"
                onChange={(e) => updateSelected({ content: e.target.value })}
              />
            </>
          ) : (
            <p className="memo-empty">왼쪽 목록에서 메모를 선택하거나 새 메모를 추가하세요.</p>
          )}
        </div>
      </div>
    </>
  );
}
