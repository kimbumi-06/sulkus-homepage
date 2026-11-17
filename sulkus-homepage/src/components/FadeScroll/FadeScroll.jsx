import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import './FadeScroll.css';

/**
 * 스크롤 영역. 아래에 글이 더 남아 있으면 밑부분을 흐리게 보여주고,
 * 끝까지 내리면(또는 글이 짧으면) 흐림을 없앤다.
 */
function FadeScroll({ className = '', children }) {
  const ref = useRef(null);
  const [hasMore, setHasMore] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setHasMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  // 크기가 바뀔 때(처음 그려질 때, 폰트 로드 후 등) 다시 확인
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [check, children]);

  return (
    <div
      ref={ref}
      className={`fade-scroll ${hasMore ? 'fade-scroll--more' : ''} ${className}`}
      onScroll={check}
    >
      {children}
    </div>
  );
}

export default FadeScroll;
