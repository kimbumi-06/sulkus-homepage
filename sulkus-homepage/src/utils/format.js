// "2","2" -> "2" / "2","4" -> "2-4"
export const formatRange = (min, max) =>
  !max || min === max ? String(min) : `${min}-${max}`;

// "A, B, C" -> ["A", "B", "C"]
export const splitList = (str) =>
  str ? str.split(',').map((s) => s.trim()).filter(Boolean) : [];

// 설명 첫 문단만 추출
export const firstParagraph = (text) => (text || '').split('\n')[0].trim();