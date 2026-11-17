import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * 제목 검색창. 입력은 화면에 바로 반영하고, 주소(URL)는 잠깐 멈췄을 때 갱신한다.
 * (한글 조합 중 글자가 끊기지 않도록 입력값은 내부 state로 관리)
 */
function SearchBar({ value, onChange, delay = 250 }) {
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const timer = useRef(null);

  // 뒤로가기 등으로 URL의 q가 바뀌면 입력창도 맞춰줌
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleChange = (e) => {
    const next = e.target.value;
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), delay);
  };

  const clear = () => {
    clearTimeout(timer.current);
    setText('');
    onChange('');
  };

  return (
    <div className="searchbar">
      <Search className="searchbar__icon" size={18} strokeWidth={1.75} aria-hidden="true" />
      <input
        type="search"
        className="searchbar__input"
        value={text}
        onChange={handleChange}
        aria-label="게임 제목 검색"
      />
      {text && (
        <button type="button" className="searchbar__clear" onClick={clear} aria-label="검색어 지우기">
          <X size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export default SearchBar;
