import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import './Toolbar.css';
import SearchBar from './SearchBar';
import SortSelect from './SortSelect';
import FilterPanel from './FilterPanel';
import { DEFAULT_SORT, countActiveFilters } from '../../utils/gameQuery';

function Toolbar({ brand, params, setParams, mechanics }) {
  const sort = params.get('sort') || DEFAULT_SORT;
  const activeCount = countActiveFilters(params);
  // 주소에 필터가 들어 있는 채로 들어오면 패널을 펼친 상태로 시작
  const [open, setOpen] = useState(activeCount > 0);

  const resetFilters = () =>
    setParams({ players: null, time: null, mech: null });

  return (
    <header className="toolbar">
      <div className="toolbar__row">
        {brand}
        <SearchBar
          value={params.get('q') || ''}
          onChange={(q) => setParams({ q: q.trim() ? q : null })}
        />
        <button
          type="button"
          className={`toolbar__filter-btn ${open ? 'open' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
          필터
          {activeCount > 0 && <span className="toolbar__badge">{activeCount}</span>}
          <ChevronDown className="toolbar__caret" size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <SortSelect
          value={sort}
          onChange={(v) => setParams({ sort: v === DEFAULT_SORT ? null : v })}
        />
      </div>

      {open && (
        <FilterPanel params={params} setParams={setParams} mechanics={mechanics} />
      )}

      {activeCount > 0 && (
        <div className="toolbar__status">
          <button type="button" className="toolbar__reset" onClick={resetFilters}>
            필터 초기화
          </button>
        </div>
      )}
    </header>
  );
}

export default Toolbar;
