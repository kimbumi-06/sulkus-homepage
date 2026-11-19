import { useEffect, useMemo, useState } from 'react';
import {
  collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { Search, RotateCcw, Save } from 'lucide-react';
import { auth, db } from './firebase';

const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '');

// 운영진이 고친 값만 저장 (빈칸이면 AI 번역/긱 값을 그대로 씀)
const EDIT_FIELDS = ['name_ko', 'description_ko'];

function GameEditor({ game, edit, onSaved }) {
  const [form, setForm] = useState(() => ({
    name_ko: edit?.name_ko ?? '',
    description_ko: edit?.description_ko ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const values = Object.fromEntries(
        EDIT_FIELDS.map((k) => [k, form[k].trim()]).filter(([, v]) => v)
      );
      const ref = doc(db, 'gameEdits', game.id);
      if (Object.keys(values).length === 0) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          ...values,
          updatedBy: auth.currentUser?.email ?? null,
          updatedAt: serverTimestamp(),
        });
      }
      setMessage('저장했어요.');
      onSaved?.();
    } catch (e) {
      setMessage(`저장 실패: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetToAuto = () => setForm({ name_ko: '', description_ko: '' });

  return (
    <div className="games__editor">
      <h2>{game.name_en}</h2>
      <p className="games__meta">BGG ID {game.id}</p>

      <label className="games__field">
        <span>한글 제목</span>
        <input
          className="admin__input"
          value={form.name_ko}
          placeholder={game.name_ko || '비워두면 자동 번역'}
          onChange={(e) => setForm((f) => ({ ...f, name_ko: e.target.value }))}
        />
      </label>

      <label className="games__field">
        <span>한글 설명</span>
        <textarea
          className="admin__textarea"
          value={form.description_ko}
          placeholder={game.description_ko || '비워두면 자동 번역'}
          onChange={(e) => setForm((f) => ({ ...f, description_ko: e.target.value }))}
        />
      </label>

      <div className="games__actions">
        <button type="button" className="admin__btn" onClick={save} disabled={saving}>
          <Save size={15} strokeWidth={1.75} /> {saving ? '저장 중…' : '저장'}
        </button>
        <button type="button" className="admin__btn admin__btn--ghost" onClick={resetToAuto}>
          <RotateCcw size={15} strokeWidth={1.75} /> 자동 번역으로 되돌리기
        </button>
        {message && <span className="games__message">{message}</span>}
      </div>
      <p className="games__hint">
        빈칸은 자동 번역(AI)을 씁니다. 저장한 내용은 다음 &quot;사이트에 반영&quot; 때 적용돼요.
      </p>

      <details className="games__original">
        <summary>영문 원본 설명</summary>
        <p>{game.description}</p>
      </details>
    </div>
  );
}

function GamesTab({ games, onSaved }) {
  const [edits, setEdits] = useState({});
  const [editsLoaded, setEditsLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // 운영진 수정 내역 실시간 구독
  useEffect(
    () =>
      onSnapshot(collection(db, 'gameEdits'), (snap) => {
        const next = {};
        snap.forEach((d) => {
          next[d.id] = d.data();
        });
        setEdits(next);
        setEditsLoaded(true);
      }),
    []
  );

  const list = useMemo(() => {
    const q = normalize(query);
    return games.filter((g) => {
      if (onlyEdited && !edits[g.id]) return false;
      if (!q) return true;
      return (
        normalize(g.name_ko).includes(q) ||
        normalize(g.name_en).includes(q) ||
        normalize(edits[g.id]?.name_ko).includes(q)
      );
    });
  }, [games, edits, query, onlyEdited]);

  const selected = games.find((g) => g.id === selectedId);

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
        <label className="games__toggle">
          <input
            type="checkbox"
            checked={onlyEdited}
            onChange={(e) => setOnlyEdited(e.target.checked)}
          />
          수정한 게임만 ({Object.keys(edits).length})
        </label>

        <ul>
          {list.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className={g.id === selectedId ? 'active' : ''}
                onClick={() => setSelectedId(g.id)}
              >
                <strong>{edits[g.id]?.name_ko || g.name_ko || g.name_en}</strong>
                <small>{g.name_en}</small>
                {edits[g.id] && <em>수정됨</em>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="games__detail">
        {selected ? (
          <GameEditor key={`${selected.id}-${editsLoaded}`} game={selected} edit={edits[selected.id]} onSaved={onSaved} />
        ) : (
          <p className="games__empty">왼쪽에서 게임을 고르세요.</p>
        )}
      </section>
    </div>
  );
}

export default GamesTab;
