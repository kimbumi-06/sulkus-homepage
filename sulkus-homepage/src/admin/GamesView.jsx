import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import SourceBadge from './SourceBadge';

const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '');

/** 게임 목록 확인용 (수정은 스프레드시트에서) */
function GamesView({ games, sheet }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | admin | missing
  const [selectedId, setSelectedId] = useState(null);

  const list = useMemo(() => {
    const q = normalize(query);
    return games.filter((g) => {
      if (filter === 'admin' && g._src?.name !== 'admin' && g._src?.desc !== 'admin') return false;
      if (filter === 'missing' && g.name_ko && g.description_ko) return false;
      return !q || normalize(g.name_ko).includes(q) || normalize(g.name_en).includes(q);
    });
  }, [games, query, filter]);

  const selected = games.find((g) => g.id === selectedId);
  const sheetLink = (id) =>
    sheet && sheet.rows?.[id]
      ? `${sheet.sheetUrl}#gid=${sheet.gids.games}&range=C${sheet.rows[id]}`
      : sheet?.sheetUrl;

  return (
    <div className="games">
      <aside className="games__list">
        <div className="games__search">
          <Search size={16} strokeWidth={1.75} />
          <input
            className="admin__input"
            value={query}
            placeholder="제목 검색"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="dict__types">
          {[
            ['all', `전체 ${games.length}`],
            ['admin', '운영진 수정'],
            ['missing', '한글 빠진 것'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>

        <ul>
          {list.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className={g.id === selectedId ? 'active' : ''}
                onClick={() => setSelectedId(g.id)}
              >
                <strong>{g.name_ko || g.name_en}</strong>
                <small>{g.name_en}</small>
                {(g._src?.name === 'admin' || g._src?.desc === 'admin') && <em>수정됨</em>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="games__detail">
        {selected ? (
          <div className="games__editor">
            <h2>{selected.name_ko || selected.name_en}</h2>
            <p className="games__meta">
              {selected.name_en} · BGG ID {selected.id}
            </p>

            <div className="games__field">
              <span>
                한글 제목 <SourceBadge source={selected._src?.name} />
              </span>
              <p className="games__value">{selected.name_ko || '(없음 — 영문 제목으로 표시)'}</p>
            </div>

            <div className="games__field">
              <span>
                한글 설명 <SourceBadge source={selected._src?.desc} />
              </span>
              <p className="games__value games__value--long">
                {selected.description_ko || '(없음 — 영문 설명으로 표시)'}
              </p>
            </div>

            {sheet && (
              <a className="admin__btn admin__btn--ghost games__sheet" href={sheetLink(selected.id)} target="_blank" rel="noreferrer">
                <ExternalLink size={15} strokeWidth={1.75} /> 스프레드시트에서 수정
              </a>
            )}

            <details className="games__original">
              <summary>영문 원본 설명</summary>
              <p>{selected.description}</p>
            </details>
          </div>
        ) : (
          <p className="games__empty">왼쪽에서 게임을 고르세요.</p>
        )}
      </section>
    </div>
  );
}

export default GamesView;
