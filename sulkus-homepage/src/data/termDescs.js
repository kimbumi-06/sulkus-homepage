// 장르/메커니즘 설명을 화면 어디서든 꺼내 쓰기 위한 context
// 우선순위: 반영된 데이터(운영진 사전·AI) → 코드에 있는 기본 설명(mechanicInfo.js)
import { createContext, useContext } from 'react';
import mechanicInfo from './mechanicInfo';

export const TermDescContext = createContext({ mechanics: {}, categories: {} });

export function useTermDesc(type, ko) {
  const descs = useContext(TermDescContext);
  return descs[type]?.[ko] || (type === 'mechanics' ? mechanicInfo[ko]?.desc : '') || '';
}
