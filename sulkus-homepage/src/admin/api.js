// 서버 함수 호출 (기본 사전을 같이 보내서 "운영진 → 기본 사전 → AI" 순서로 번역)
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { builtinDictionary } from './terms';

export const callSync = () =>
  httpsCallable(functions, 'syncGames', { timeout: 3_600_000 })({ builtin: builtinDictionary });

export const callPublish = () =>
  httpsCallable(functions, 'publishGames', { timeout: 120_000 })({ builtin: builtinDictionary });
