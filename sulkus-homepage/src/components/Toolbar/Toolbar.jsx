import './Toolbar.css';
import SearchBar from './SearchBar';
import SortSelect from './SortSelect';
import { DEFAULT_SORT } from '../../utils/gameQuery';

function Toolbar({ params, setParams, totalCount }) {
  const sort = params.get('sort') || DEFAULT_SORT;

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
      </div>
      <p className="toolbar__count">{totalCount}개 게임</p>
    </section>
  );
}

export default Toolbar;
