// .gs 파일들을 하나의 전역 공간에 불러와서 Node에서 순수 함수만 테스트 (Apps Script 서비스는 흉내)
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// XmlService 흉내 (Apps Script Element API 중 쓰는 것만)
const wrap = (el) => el && {
  getChildren: (name) => [...el.childNodes].filter((n) => n.nodeType === 1 && (!name || n.nodeName === name)).map(wrap),
  getChild: (name) => wrap([...el.childNodes].find((n) => n.nodeType === 1 && n.nodeName === name)),
  getAttribute: (name) => (el.hasAttribute(name) ? { getValue: () => el.getAttribute(name) } : null),
  getText: () => el.textContent,
};
const XmlService = {
  parse: (text) => ({ getRootElement: () => wrap(new DOMParser().parseFromString(text, 'text/xml').documentElement) }),
};
/** 테스트용: XML 문자열 → 루트 Element */
export const parseXml = (text) => XmlService.parse(text).getRootElement();

const Utilities = {
  DigestAlgorithm: { SHA_1: 'sha1' },
  Charset: { UTF_8: 'utf8' },
  computeDigest: (alg, text) => [...createHash(alg).update(text, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
  sleep: () => {},
};

export function loadGs(extra = {}) {
  const ctx = vm.createContext({ console, XmlService, Utilities, ...extra });
  // 파일 순서가 바뀌어도 동작해야 하므로 일부러 역순으로 불러옴
  const files = readdirSync(dir).filter((f) => f.endsWith('.gs')).sort().reverse();
  const code = files.map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n;\n');
  // const/let 최상단 선언을 꺼내 쓰기 위해 마지막에 노출
  const names = [...code.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  vm.runInContext(`${code}\n;globalThis.__gs = { ${[...new Set(names)].join(', ')} };`, ctx);
  return ctx.__gs;
}
