const SOURCE_LABEL = {
  admin: '운영진',
  builtin: '기본 사전',
  bgg: 'BGG',
  none: '한글 없음',
};

/** 한글이 어디서 왔는지 표시 */
function SourceBadge({ source }) {
  const s = source || 'none';
  return <span className={`dict__badge dict__badge--${s}`}>{SOURCE_LABEL[s] || s}</span>;
}

export default SourceBadge;
