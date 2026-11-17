import MechanicSelect from './MechanicSelect';
import { TIME_OPTIONS, MECH_SEP, parseMechs } from '../../utils/gameQuery';

function FilterPanel({ params, setParams, mechanics }) {
  const time = params.get('time');
  const selectedMechs = parseMechs(params.get('mech'));

  return (
    <div className="filter">
      <div className="filter__group filter__group--inline">
        <h3>인원수</h3>
        <label className="filter__players">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="99"
            placeholder="-"
            value={params.get('players') || ''}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setParams({ players: n > 0 ? Math.min(n, 99) : null });
            }}
          />
          명
        </label>
      </div>

      <div className="filter__group">
        <h3>플레이 시간</h3>
        <div className="filter__chips">
          {TIME_OPTIONS.map((opt) => {
            const active = time === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`filter__chip ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => setParams({ time: active ? null : opt.value })}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter__group">
        <h3>
          메커니즘 <span className="filter__hint">(선택한 것을 모두 가진 게임)</span>
        </h3>
        <MechanicSelect
          options={mechanics}
          selected={selectedMechs}
          onChange={(next) => setParams({ mech: next.length ? next.join(MECH_SEP) : null })}
        />
      </div>
    </div>
  );
}

export default FilterPanel;
