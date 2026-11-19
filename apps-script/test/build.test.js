import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, parseXml } from './harness.js';

const gs = loadGs();
const { G, T, buildPublished_, mergeGameRows_, mergeTermRows_, parseThing_, cleanDescription_ } = gs;

const builtin = {
  ko: { Trading: '거래', 'Dice Rolling': '주사위 굴리기', Economic: '경제' },
  descByKo: { 거래: '자원을 주고받음' },
};

const raw = [
  {
    id: '1', name_en: 'Catan', name_ko_bgg: '카탄', rank: '600', rating: '7.1',
    mechanics: ['Trading', 'Dice Rolling'], categories: ['Economic'], description: 'Build roads.',
  },
  {
    id: '2', name_en: 'Brass', name_ko_bgg: '', rank: 'N/A', rating: '8.6',
    mechanics: ['Brand New Mechanic'], categories: ['Industry / Manufacturing'], description: 'Industrial revolution.',
  },
];

// 시트 한 행 만들기 (열 번호 상수 기준)
const gameRow = (vals) => {
  const r = Array(Object.keys(G).length).fill('');
  Object.entries(vals).forEach(([k, v]) => { r[G[k] - 1] = v; });
  return r;
};
const termRow = (vals) => {
  const r = Array(Object.keys(T).length).fill('');
  Object.entries(vals).forEach(([k, v]) => { r[T[k] - 1] = v; });
  return r;
};

test('한글 우선순위 (자동 번역 없음)', () => {
  const gameRows = [
    gameRow({ id: '1' }),
    gameRow({ id: '2', nameKoEdit: '브라스', descKoEdit: '운영진 설명' }),
  ];
  const termRows = [
    termRow({ type: '메커니즘', en: 'Trading', koEdit: '교환', koBase: '거래', descBase: '자원을 주고받음' }),
    termRow({ type: '장르', en: 'Industry / Manufacturing', descEdit: '공장을 짓는 게임' }), // 설명만 씀
  ];
  const out = buildPublished_(raw, gameRows, termRows, builtin, new Date(0));
  const [catan, brass] = out.games;
  assert.equal(catan.name_ko, '카탄'); // BGG 한글 이름
  assert.equal(catan._src.name, 'bgg');
  assert.equal(brass.name_ko, '브라스'); // 운영진
  assert.equal(brass._src.name, 'admin');
  assert.equal(catan.description_ko, ''); // 운영진이 안 쓰면 영문으로 표시
  assert.equal(brass.description_ko, '운영진 설명');
  assert.deepEqual([...catan.mechanics_ko], ['교환', '주사위 굴리기']); // 운영진 > 기본 사전
  assert.equal(out.terms.mechanics.Trading.desc, '자원을 주고받음'); // 운영진이 설명은 안 썼으면 기본 설명
  assert.equal(out.terms.mechanics['Dice Rolling'].source, 'builtin');
  assert.deepEqual([...brass.mechanics_ko], ['Brand New Mechanic']); // 사전에 없으면 영문
  assert.equal(out.terms.mechanics['Brand New Mechanic'].source, 'none');
  assert.equal(out.terms.categories['Industry / Manufacturing'].ko, 'Industry / Manufacturing');
  assert.equal(out.terms.categories['Industry / Manufacturing'].desc, '공장을 짓는 게임');
  assert.ok(!('name_ko_bgg' in catan));
});

test('동기화 합치기: 운영진 수정 유지, 컬렉션에서 빠진 게임 제거, 새 용어 추가', () => {
  const oldGames = [
    gameRow({ id: '2', nameEn: 'Brass(old)', nameKoEdit: '브라스', descKoEdit: '운영진 설명' }),
    gameRow({ id: '99', nameEn: 'Removed', nameKoEdit: '사라진 게임' }),
  ];
  const rows = mergeGameRows_(raw, oldGames);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][G.nameKoBgg - 1], '카탄'); // BGG 한글 이름 열
  assert.equal(rows[0][G.descEn - 1], 'Build roads.');
  assert.equal(rows[1][G.nameEn - 1], 'Brass'); // 영문은 BGG 최신값
  assert.equal(rows[1][G.nameKoEdit - 1], '브라스');
  assert.equal(rows[1][G.descKoEdit - 1], '운영진 설명');
  assert.equal(rows[0].length, Object.keys(G).length);

  const oldTerms = [
    termRow({ type: '장르', en: 'Gone', koEdit: '운영진이 쓴 것' }),
    termRow({ type: '장르', en: 'Gone2' }),
    termRow({ type: '메커니즘', en: 'Trading', descEdit: '설명만 고침' }),
  ];
  const terms = mergeTermRows_(raw, oldTerms, builtin);
  const keys = [...terms].map((r) => `${r[0]}:${r[1]}`);
  assert.deepEqual(keys.slice(0, 2), ['장르:Gone', '메커니즘:Trading']); // 기존 순서 유지, 안 쓰는 빈 행 제거
  assert.ok(keys.includes('메커니즘:Brand New Mechanic'));
  const trading = terms.find((r) => r[1] === 'Trading');
  assert.equal(trading[T.koBase - 1], '거래');
  assert.equal(trading[T.descBase - 1], '자원을 주고받음');
  assert.equal(trading[T.descEdit - 1], '설명만 고침');
  assert.equal(trading[T.count - 1], 1);
  assert.equal(trading.length, Object.keys(T).length);
});

test('BGG XML 파싱 (XmlService)', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><items><item type="boardgame" id="421">
    <thumbnail>t.jpg</thumbnail><image>i.jpg</image>
    <name type="primary" sortindex="1" value="1830: Railways &amp; Robber Barons" />
    <name type="alternate" sortindex="1" value="1830: 철도왕" />
    <description>A &amp;mdash; B&amp;#10;&#10;&#10;&lt;b&gt;C&lt;/b&gt; &amp;quot;q&amp;quot;</description>
    <minplayers value="2" /><maxplayers value="7" /><minplaytime value="180" /><maxplaytime value="360" />
    <link type="boardgamecategory" id="1" value="Trains" />
    <link type="boardgamemechanic" id="2" value="Auction / Bidding" />
    <link type="boardgameexpansion" id="3" value="x" />
    <statistics page="1"><ratings>
      <average value="7.86802" />
      <ranks><rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="321" /></ranks>
      <averageweight value="4.1611" />
    </ratings></statistics>
  </item></items>`;
  const parsed = parseThing_(parseXml(xml).getChildren('item')[0]);
  assert.equal(parsed.id, '421');
  assert.equal(parsed.name_en, '1830: Railways & Robber Barons');
  assert.equal(parsed.name_ko_bgg, '1830: 철도왕');
  assert.equal(parsed.rank, '321');
  assert.equal(parsed.rating, '7.9');
  assert.equal(parsed.weight, '4.16');
  assert.deepEqual([...parsed.mechanics], ['Auction / Bidding']);
  assert.equal(parsed.has_expansion, 'Yes');
  assert.equal(parsed.description, 'A — B\n\n\nC "q"');
  assert.equal(parsed.image, 'i.jpg');
  assert.equal(cleanDescription_(''), '');
});
