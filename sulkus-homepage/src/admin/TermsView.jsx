import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { TERM_TYPES, collectTerms } from './terms';
import SourceBadge from './SourceBadge';

const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '');

/** 장르·메커니즘 사전 확인용 (수정은 스프레드시트 "사전" 시트에서) */
function TermsView({ games, terms, sheet }) {
  const [type, setType] = useState('mechanics');
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  const list = useMemo(() => {
    const q = normalize(query);
    return collectTerms(games, terms, type).filter((t) => {
      const p = t.published;
      if (onlyMissing && p?.source !== 'none' && p?.desc) return false;
      return !q || normalize(t.en).includes(q) || normalize(p?.ko).includes(q);
    });
  }, [games, terms, type, query, onlyMissing]);

  return (
    <div className="dict">
      <div className="dict__bar">
        <div className="dict__types">
          {TERM_TYPES.map((t) => (
            <button key={t.id} type="button" className={type === t.id ? 'active' : ''} onClick={() => setType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="games__search dict__search">
          <Search size={16} strokeWidth={1.75} />
          <input className="admin__input" value={query} placeholder="영문 / 한글 검색" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <label className="games__toggle">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          한글·설명 빠진 것만
        </label>
        {sheet && (
          <a
            className="admin__btn admin__btn--ghost admin__btn--small"
            href={`${sheet.sheetUrl}#gid=${sheet.gids.terms}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} strokeWidth={1.75} /> 사전 시트에서 수정
          </a>
        )}
      </div>

      <p className="games__hint">우선순위: 운영진(사전 시트의 노란 열) → 기본 사전 → 영문</p>

      <table className="dict__table">
        <thead>
          <tr>
            <th>영문</th>
            <th>한글</th>
            <th>설명</th>
            <th>출처</th>
          </tr>
        </thead>
        <tbody>
          {list.map((t) => (
            <tr key={t.en}>
              <td className="dict__en">
                {t.en}
                <small>{t.count}개 게임</small>
              </td>
              <td>{t.published?.ko || ''}</td>
              <td className="dict__desc">{t.published?.desc || ''}</td>
              <td>
                <SourceBadge source={t.published?.source} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TermsView;
