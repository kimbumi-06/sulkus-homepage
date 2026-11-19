// 사이트의 기본 사전(src/data/dictionary.js + mechanicInfo.js 설명)을 Apps Script용 Dictionary.gs 로 변환
// 사용: node apps-script/tools/build-dictionary.mjs   (사이트 사전을 고친 뒤 다시 실행)
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../../sulkus-homepage/src/data');
const load = async (f) => (await import(pathToFileURL(path.join(dataDir, f)).href)).default;

const ko = await load('dictionary.js');
const info = await load('mechanicInfo.js');
const descByKo = Object.fromEntries(
  Object.entries(info).filter(([, v]) => v.desc).map(([k, v]) => [k, v.desc])
);

const out = `// 자동 생성 파일 — 직접 고치지 말고 tools/build-dictionary.mjs 로 다시 만드세요.
// 기본 사전: 번역 우선순위 2순위 (1순위는 스프레드시트 "사전" 시트에서 운영진이 쓴 값)
const BUILTIN = ${JSON.stringify({ ko, descByKo }, null, 2)};
`;
writeFileSync(path.join(here, '..', 'Dictionary.gs'), out);
console.log(`Dictionary.gs: 용어 ${Object.keys(ko).length}개, 설명 ${Object.keys(descByKo).length}개`);
