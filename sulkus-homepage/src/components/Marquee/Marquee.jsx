import React, { useRef, useState, useLayoutEffect } from 'react';
import './Marquee.css';

function Marquee({ children, className = '', speed = 30, gap = 24, align }) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);
  const [state, setState] = useState({ overflow: false, duration: 0 });

  useLayoutEffect(() => {
    const check = () => {
      const wrap = wrapRef.current;
      const text = textRef.current;
      if (!wrap || !text) return;
      const textW = text.getBoundingClientRect().width; // 패딩 제외, 텍스트만
      const overflow = textW > wrap.clientWidth + 1;
      const duration = (textW + gap) / speed;
      setState((prev) =>
        prev.overflow === overflow && prev.duration === duration
          ? prev
          : { overflow, duration }
      );
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(wrapRef.current);
    ro.observe(textRef.current);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
    return () => ro.disconnect();
  }, [children, speed, gap]);

  return (
    <div
      ref={wrapRef}
      className={`marquee marquee--${align} ${className} ${state.overflow ? 'is-overflow' : ''}`}
      style={{ '--gap': `${gap}px`, '--duration': `${state.duration}s` }}
    >
      <div className="marquee-track">
        <div className="marquee-item">
          <span ref={textRef}>{children}</span>
        </div>
        {state.overflow && (
          <div className="marquee-item" aria-hidden="true">
            <span>{children}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Marquee;