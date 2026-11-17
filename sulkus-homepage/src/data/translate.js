import fs from 'fs';
import dictionary from './dictionary.js';

const INPUT = 'games.json';      // 입력 파일명 (확인 필요)
const OUTPUT = 'games.ko.json';
const MAX_JOIN = 5;              // 쉼표 포함 용어의 최대 토큰 수

const norm = s => s.trim().toLowerCase();
const dict = new Map(Object.entries(dictionary).map(([k, v]) => [norm(k), v]));
const missing = new Map(); // 미번역 용어 -> 등장 횟수

function translateList(tokens) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    for (let n = Math.min(MAX_JOIN, tokens.length - i); n >= 1; n--) {
      const phrase = tokens.slice(i, i + n).join(', ');
      const hit = dict.get(norm(phrase));
      if (hit) {
        out.push(hit);
        i += n;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const t = tokens[i].trim();
      missing.set(t, (missing.get(t) || 0) + 1);
      out.push(t); // 원문 유지
      i++;
    }
  }
  return out;
}

const split = v => (typeof v === 'string' && v.trim() ? v.split(', ') : []);

const games = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const result = games.map(g => ({
  ...g,
  mechanics_ko: translateList(split(g.mechanics)),
  categories_ko: translateList(split(g.categories)),
}));

fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');

console.log(`완료: ${result.length}개 게임`);
if (missing.size) {
  console.log('미번역 용어 (사전 추가 필요):');
  [...missing].sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  ${c}회  ${t}`));
}