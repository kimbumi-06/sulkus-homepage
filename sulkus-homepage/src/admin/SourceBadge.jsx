const SOURCE_LABEL = {
  admin: '운영진',
  builtin: '기본 사전',
  bgg: 'BGG',
  ai: 'AI',
  none: '번역 없음',
};

/** 번역 출처 표시 */
function SourceBadge({ source }) {
  const s = source || 'none';
  return <span className={`dict__badge dict__badge--${s}`}>{SOURCE_LABEL[s] || s}</span>;
}

export default SourceBadge;
