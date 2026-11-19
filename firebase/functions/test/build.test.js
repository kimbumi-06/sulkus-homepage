import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublished, hashText, missingTerms, termsMap } from '../lib/build.js';
import { parseItem, cleanDescription } from '../lib/bgg.js';
import { mapLimit, descriptionSystem } from '../lib/translate.js';

const raw = [
  {
    id: '1', name_en: 'Catan', name_ko_bgg: '카탄', rank: '600', rating: '7.1',
    mechanics: ['Trading', 'Dice Rolling'], categories: ['Economic'],
    weight: '2.3', min_players: '3', max_players: '4', min_time: '60', max_time: '120',
    has_expansion: 'Yes', description: 'Build roads.', image: 'x.jpg',
  },
  {
    id: '2', name_en: 'Brass', name_ko_bgg: '', rank: 'N/A', rating: '8.6',
    mechanics: ['Network and Route Building', 'Brand New Mechanic'], categories: ['Industry / Manufacturing'],
    weight: '3.9', min_players: '2', max_players: '4', min_time: '60', max_time: '120',
    has_expansion: 'No', description: 'Industrial revolution.', image: 'y.jpg',
  },
];
const builtin = {
  ko: { Trading: '거래', 'Dice Rolling': '주사위 굴리기', Economic: '경제', 'Network and Route Building': '네트워크 및 경로 구축' },
  descByKo: { 거래: '자원을 주고받음' },
};

test('우선순위: 운영진 > 기본 사전 > AI > 영문', () => {
  const stored = termsMap([
    { type: 'mechanics', en: 'Trading', ko: '교환', desc: '운영진 설명', source: 'admin' },
    { type: 'mechanics', en: 'Dice Rolling', ko: 'AI주사위', desc: 'AI 설명', source: 'ai' },
    { type: 'categories', en: 'Industry / Manufacturing', ko: '산업', desc: '', source: 'ai' },
  ]);
  const edits = new Map([['2', { name_ko: '브라스' }]]);
  const aiCache = new Map([
    ['1', { name_ko: 'AI카탄', description_ko: '길을 지어요', descHash: hashText('Build roads.') }],
    ['2', { description_ko: '옛 번역', descHash: hashText('old text') }],
  ]);
  const out = buildPublished({ raw, edits, stored, aiCache, builtin, now: new Date(0) });
  const [catan, brass] = out.games;

  assert.equal(catan.name_ko, '카탄'); // BGG 한글 이름이 AI보다 우선
  assert.equal(brass.name_ko, '브라스'); // 운영진 수정
  assert.equal(catan.description_ko, '길을 지어요'); // 캐시 해시 일치
  assert.equal(brass.description_ko, ''); // 영문이 바뀌어 캐시 무효
  assert.deepEqual(catan.mechanics_ko, ['교환', '주사위 굴리기']); // 운영진 > 기본 사전 (AI보다 우선)
  assert.deepEqual(brass.mechanics_ko, ['네트워크 및 경로 구축', 'Brand New Mechanic']); // 없으면 영문
  assert.equal(out.terms.mechanics['Dice Rolling'].desc, 'AI 설명'); // 기본 사전에 설명 없으면 AI 설명
  assert.equal(out.terms.mechanics.Trading.source, 'admin');
  assert.ok(!('name_ko_bgg' in catan));
});

test('번역 없는 용어만 AI 대상', () => {
  const stored = termsMap([{ type: 'categories', en: 'Industry / Manufacturing', ko: '산업', source: 'ai' }]);
  assert.deepEqual(missingTerms(raw, stored, builtin), [{ type: 'mechanics', en: 'Brand New Mechanic' }]);
});

test('BGG 항목 파싱', () => {
  const item = {
    id: 421,
    name: [{ type: 'primary', value: '1830' }, { type: 'alternate', value: '1830: 철도왕' }],
    statistics: { ratings: { average: { value: '7.912' }, averageweight: { value: '4.1612' },
      ranks: { rank: [{ name: 'boardgame', value: 'Not Ranked' }] } } },
    link: [
      { type: 'boardgamemechanic', value: 'Auction / Bidding' },
      { type: 'boardgamecategory', value: 'Trains' },
      { type: 'boardgameexpansion', value: 'x' },
    ],
    minplayers: { value: 2 }, maxplayers: { value: 7 }, minplaytime: { value: 180 }, maxplaytime: { value: 360 },
    description: 'A &amp;mdash; B&#10;&#10;<b>C</b>',
    image: 'img.jpg',
  };
  const g = parseItem(item);
  assert.equal(g.id, '421');
  assert.equal(g.name_ko_bgg, '1830: 철도왕');
  assert.equal(g.rank, 'N/A');
  assert.equal(g.rating, '7.9');
  assert.equal(g.weight, '4.16');
  assert.deepEqual(g.mechanics, ['Auction / Bidding']);
  assert.equal(g.has_expansion, 'Yes');
  assert.equal(g.description, 'A — B\n\nC');
  assert.equal(cleanDescription(undefined), '');
});

test('mapLimit 순서 유지 + 동시 실행 제한', async () => {
  let running = 0, peak = 0;
  const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (x) => {
    running++; peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
    return x * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60]);
  assert.equal(peak, 2);
});

test('설명 번역 지시문에 용어집 포함 (같은 용어는 제외, 캐시 표시)', () => {
  const [block] = descriptionSystem([{ en: 'Trading', ko: '거래' }, { en: 'X', ko: 'X' }]);
  assert.match(block.text, /Trading = 거래/);
  assert.doesNotMatch(block.text, /X = X/);
  assert.deepEqual(block.cache_control, { type: 'ephemeral' });
});
