import { useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '');

/**
 * 검색해서 고르는 메커니즘 다중 선택창.
 * - 입력창에 글자를 치면 목록이 걸러짐
 * - ↑/↓로 이동, Enter로 선택, Esc로 닫기, 빈 입력창에서 Backspace로 마지막 선택 해제
 */
function MechanicSelect({ options, selected, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = normalize(query);
    return options.filter(
      (o) => !selected.includes(o.name) && (!q || normalize(o.name).includes(q))
    );
  }, [options, selected, query]);

  const add = (name) => {
    onChange([...selected, name]);
    setQuery('');
    setHighlight(0);
    inputRef.current?.focus();
  };

  const remove = (name) => onChange(selected.filter((m) => m !== name));

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중에는 무시
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) add(filtered[highlight].name);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !query && selected.length) {
      remove(selected[selected.length - 1]);
    }
  };

  return (
    <div className="mselect">
      <div className="mselect__box" onClick={() => inputRef.current?.focus()}>
        {selected.map((name) => (
          <span key={name} className="mselect__tag">
            {name}
            <button
              type="button"
              aria-label={`${name} 선택 해제`}
              onClick={(e) => {
                e.stopPropagation();
                remove(name);
              }}
            >
              <X size={12} strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="mselect__input"
          value={query}
          placeholder={selected.length ? '' : '메커니즘 검색'}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {open && (
        <ul
          id={listId}
          className="mselect__list"
          role="listbox"
          // 목록을 눌러도 입력창 포커스가 빠지지 않게
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 ? (
            <li className="mselect__empty">일치하는 메커니즘이 없어요</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.name}
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? 'highlight' : ''}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => add(o.name)}
              >
                <span>{o.name}</span>
                <small>{o.count}</small>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default MechanicSelect;
