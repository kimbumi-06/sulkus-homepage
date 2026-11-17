import { useState } from 'react';
import './Toolbar.css';
import SearchBar from './SearchBar';
import SortSelect from './SortSelect';
import FilterPanel from './FilterPanel';
import { DEFAULT_SORT, countActiveFilters } from '../../utils/gameQuery';

function Toolbar({ params, setParams, totalCount, mechanics }) {
  const sort = params.get('sort') || DEFAULT_SORT;
  const activeCount = countActiveFilters(params);
  // 주소에 필터가 들어 있는 채로 들어오면 패널을 펼친 상태로 시작
  const [open, setOpen] = useState(activeCount > 0);

  const resetFilters = () =>
    setParams({ players: null, time: null, rating: null, mech: null });

  return (
    <section className="toolbar">
      <div className="toolbar__row">
        <SearchBar
          value={params.get('q') || ''}
          onChange={(q) => setParams({ q: q.trim() ? q : null })}
        />
        <SortSelect
          value={sort}
          onChange={(v) => setParams({ sort: v === DEFAULT_SORT ? null : v })}
        />
        <button
          type="button"
          className={`toolbar__filter-btn ${open ? 'open' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          필터
          {activeCount > 0 && <span className="toolbar__badge">{activeCount}</span>}
          <span className="toolbar__caret" aria-hidden="true">▾</span>
        </button>
      </div>

      {open && (
        <FilterPanel params={params} setParams={setParams} mechanics={mechanics} />
      )}

      <div className="toolbar__status">
        <span>{totalCount}개 게임</span>
        {activeCount > 0 && (
          <button type="button" className="toolbar__reset" onClick={resetFilters}>
            필터 초기화
          </button>
        )}
      </div>
    </section>
  );
}

export default Toolbar;
