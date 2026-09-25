// P12.13(사람 결정): 옵션이 고정된 적은 수인 select(장기/단기, 진행중/완료/보류, 우선순위)를
// 대체하는 공용 토글 버튼 그룹. .schedule-weekday-chip(P5.6, 다중 선택)과 같은 이유로
// 네이티브 <select>를 안 쓴다 — 여기서는 Windows에서 select 드롭다운 팝업이 OS 네이티브
// 콤보박스로 그려져 다크 테마를 못 따르는 문제(index.css의 P12.13 규칙 주석 참고)를 팝업
// 자체를 없애서 피한다. 옵션 수가 늘어날 수 있는 select(소속 프로젝트 등)에는 쓰지 않는다.
export default function FieldToggleGroup({ options, value, onChange, disabled = false, ariaLabel }) {
  return (
    <div className="field-toggle-group" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={opt.value === value ? 'field-toggle-option active' : 'field-toggle-option'}
          disabled={disabled}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
