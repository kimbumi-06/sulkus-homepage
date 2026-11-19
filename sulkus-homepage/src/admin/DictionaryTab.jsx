import { useEffect, useMemo, useState } from 'react';
import {
  collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { RotateCcw, Save, Search } from 'lucide-react';
import { auth, db } from './firebase';
import { TERM_TYPES, builtinTerm, collectTerms, termDocId } from './terms';

const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '');

const SOURCE_LABEL = { admin: '운영진', builtin: '기본 사전', ai: 'AI', none: '번역 없음' };

// 지금 사이트에 쓰이는(또는 다음 반영 때 쓰일) 값과 출처
function effectiveTerm(en, stored, published) {
  if (stored?.source === 'admin') return { ...stored, source: 'admin' };
  const builtin = builtinTerm(en);
  if (builtin) return { ...builtin, source: 'builtin' };
  if (stored) return { ...stored, source: stored.source || 'ai' };
  if (published?.ko) return { ...published, source: published.source || 'ai' };
  return { ko: '', desc: '', source: 'none' };
}

function TermRow({ type, term, stored }) {
  const current = effectiveTerm(term.en, stored, term.published);
  const [ko, setKo] = useState(current.ko || '');
  const [desc, setDesc] = useState(current.desc || '');
  const [state, setState] = useState(''); // '', 'saving', 'saved', 'error'

  const dirty = ko.trim() !== (current.ko || '') || desc.trim() !== (current.desc || '');

  const save = async () => {
    setState('saving');
    try {
      await setDoc(doc(db, 'terms', termDocId(type, term.en)), {
        type,
        en: term.en,
        ko: ko.trim(),
        desc: desc.trim(),
        source: 'admin',
        updatedBy: auth.currentUser?.email ?? null,
        updatedAt: serverTimestamp(),
      });
      setState('saved');
    } catch {
      setState('error');
    }
  };

  // 운영진 수정만 지움 → 기본 사전/AI 번역으로 돌아감
  const revert = async () => {
    setState('saving');
    try {
      await deleteDoc(doc(db, 'terms', termDocId(type, term.en)));
      setState('');
    } catch {
      setState('error');
    }
  };

  return (
    <tr>
      <td className="dict__en">
        {term.en}
        <small>{term.count}개 게임</small>
      </td>
      <td>
        <input className="admin__input" value={ko} placeholder="한글 이름" onChange={(e) => setKo(e.target.value)} />
      </td>
      <td>
        <input className="admin__input" value={desc} placeholder="한 줄 설명" onChange={(e) => setDesc(e.target.value)} />
      </td>
      <td>
        <span className={`dict__badge dict__badge--${current.source}`}>{SOURCE_LABEL[current.source]}</span>
      </td>
      <td className="dict__actions">
        <button
          type="button"
          className="admin__btn admin__btn--small"
          disabled={!dirty || state === 'saving'}
          onClick={save}
          aria-label="저장"
        >
          <Save size={14} strokeWidth={1.75} />
        </button>
        {current.source === 'admin' && (
          <button
            type="button"
            className="admin__btn admin__btn--small admin__btn--ghost"
            onClick={revert}
            aria-label="운영진 수정 취소"
          >
            <RotateCcw size={14} strokeWidth={1.75} />
          </button>
        )}
        {state === 'saved' && <span className="dict__state">저장됨</span>}
        {state === 'error' && <span className="dict__state">실패</span>}
      </td>
    </tr>
  );
}

function DictionaryTab({ games, terms }) {
  const [type, setType] = useState('mechanics');
  const [stored, setStored] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  useEffect(
    () =>
      onSnapshot(collection(db, 'terms'), (snap) => {
        const next = {};
        snap.forEach((d) => {
          next[d.id] = d.data();
        });
        setStored(next);
        setLoaded(true);
      }),
    []
  );

  const list = useMemo(() => {
    const q = normalize(query);
    return collectTerms(games, terms, type).filter((t) => {
      const s = stored[termDocId(type, t.en)];
      if (onlyMissing && effectiveTerm(t.en, s, t.published).source !== 'none') return false;
      if (!q) return true;
      return normalize(t.en).includes(q) || normalize(effectiveTerm(t.en, s, t.published).ko).includes(q);
    });
  }, [games, terms, type, stored, query, onlyMissing]);

  return (
    <div className="dict">
      <div className="dict__bar">
        <div className="dict__types">
          {TERM_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={type === t.id ? 'active' : ''}
              onClick={() => setType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="games__search dict__search">
          <Search size={16} strokeWidth={1.75} />
          <input
            className="admin__input"
            value={query}
            placeholder="영문 / 한글 검색"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="games__toggle">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          번역 없는 것만
        </label>
      </div>

      <p className="games__hint">
        우선순위: 운영진 수정 → 기본 사전 → AI 번역. 저장한 내용은 다음 &quot;사이트에 반영&quot; 때 적용돼요.
      </p>

      <table className="dict__table">
        <thead>
          <tr>
            <th>영문</th>
            <th>한글</th>
            <th>설명</th>
            <th>출처</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((t) => {
            const id = termDocId(type, t.en);
            const s = stored[id];
            // 저장된 값이 바뀌면 입력칸도 새로 맞춤
            const key = `${id}-${loaded}-${s?.source || ''}-${s?.ko || ''}-${s?.desc || ''}`;
            return <TermRow key={key} type={type} term={t} stored={s} />;
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DictionaryTab;
