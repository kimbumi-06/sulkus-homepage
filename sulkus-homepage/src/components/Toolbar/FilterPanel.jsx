import { useState } from 'react';
import mechanicInfo from '../../data/mechanicInfo';
import {
  PLAYER_OPTIONS, TIME_OPTIONS, RATING_OPTIONS, MECH_SEP, parseMechs,
} from '../../utils/gameQuery';

const MECH_PREVIEW = 24; // 처음에 보여줄 메커니즘 개수

// 같은 값을 다시 누르면 해제되는 단일 선택 칩 그룹
function ChipGroup({ options, value, onChange }) {
  return (
    <div className="filter__chips">
      {options.map((opt) => {
        const active = value === String(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className={`filter__chip ${active ? 'active' : ''}`}
            aria-pressed={active}
            onClick={() => onChange(active ? null : String(opt.value))}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterPanel({ params, setParams, mechanics }) {
  const [showAllMechs, setShowAllMechs] = useState(false);
  const selectedMechs = parseMechs(params.get('mech'));

  const toggleMech = (name) => {
    const next = selectedMechs.includes(name)
      ? selectedMechs.filter((m) => m !== name)
      : [...selectedMechs, name];
    setParams({ mech: next.length ? next.join(MECH_SEP) : null });
  };

  // 선택된 메커니즘은 접혀 있어도 항상 보이게
  const visibleMechs = showAllMechs
    ? mechanics
    : mechanics.filter((m, i) => i < MECH_PREVIEW || selectedMechs.includes(m.name));

  return (
    <div className="filter">
      <div className="filter__group">
        <h3>인원수</h3>
        <ChipGroup
          options={PLAYER_OPTIONS.map((n) => ({ value: n, label: n === 8 ? '8명+' : `${n}명` }))}
          value={params.get('players')}
          onChange={(v) => setParams({ players: v })}
        />
      </div>

      <div className="filter__group">
        <h3>플레이 시간</h3>
        <ChipGroup
          options={TIME_OPTIONS}
          value={params.get('time')}
          onChange={(v) => setParams({ time: v })}
        />
      </div>

      <div className="filter__group">
        <h3>최소 평점</h3>
        <ChipGroup
          options={RATING_OPTIONS.map((r) => ({ value: r, label: `${r}점 이상` }))}
          value={params.get('rating')}
          onChange={(v) => setParams({ rating: v })}
        />
      </div>

      <div className="filter__group">
        <h3>
          메커니즘 <span className="filter__hint">(선택한 것을 모두 가진 게임)</span>
        </h3>
        <div className="filter__chips">
          {visibleMechs.map(({ name, count }) => {
            const active = selectedMechs.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`filter__chip filter__chip--mech ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleMech(name)}
              >
                {mechanicInfo[name]?.icon && <span>{mechanicInfo[name].icon}</span>}
                {name}
                <small>{count}</small>
              </button>
            );
          })}
          {mechanics.length > MECH_PREVIEW && (
            <button
              type="button"
              className="filter__more"
              onClick={() => setShowAllMechs((v) => !v)}
            >
              {showAllMechs ? '접기' : `더보기 (+${mechanics.length - MECH_PREVIEW})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilterPanel;
