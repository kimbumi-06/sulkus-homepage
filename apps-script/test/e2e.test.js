// 처음 설정 → 동기화(BGG + 번역) → 시트 수정 → 자동 반영 → 웹 요청까지 한 번에 (서비스는 흉내)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs } from './harness.js';
import { createFakes } from './fakes.js';

const COLLECTION = `<items totalitems="3">
  <item objecttype="thing" objectid="1" subtype="boardgame" />
  <item objecttype="thing" objectid="2" subtype="boardgame" />
  <item objecttype="thing" objectid="3" subtype="boardgame" />
</items>`;

const thing = (id, name, alt, mech, cat, desc) => `
  <item type="boardgame" id="${id}">
    <image>img${id}.jpg</image>
    <name type="primary" sortindex="1" value="${name}" />
    ${alt ? `<name type="alternate" sortindex="1" value="${alt}" />` : ''}
    <description>${desc}</description>
    <minplayers value="2" /><maxplayers value="4" /><minplaytime value="30" /><maxplaytime value="60" />
    ${mech.map((m) => `<link type="boardgamemechanic" id="9" value="${m}" />`).join('')}
    ${cat.map((c) => `<link type="boardgamecategory" id="8" value="${c}" />`).join('')}
    <statistics page="1"><ratings><average value="7.5" /><averageweight value="2.5" />
      <ranks><rank type="subtype" id="1" name="boardgame" value="${id}00" /></ranks></ratings></statistics>
  </item>`;

function makeEnv({ descText = 'Build &amp;amp; trade.' } = {}) {
  const things = {
    1: thing(1, 'Catan', '카탄', ['Trading', 'Dice Rolling'], ['Economic'], descText),
    2: thing(2, 'Brass', '', ['Network and Route Building', 'Brand New Mechanic'], ['Industry / Manufacturing'], 'Industrial.'),
    3: thing(3, 'Streams', '', ['Bingo'], ['Puzzle'], ''),
  };
  const f = createFakes({
    editors: ['owner@club.kr', 'staff@club.kr'],
    bgg: (url) => {
      if (url.includes('/collection?')) return f.response(200, COLLECTION);
      const ids = decodeURIComponent(url.match(/id=([^&]+)/)[1]).split(',');
      return f.response(200, `<items>${ids.map((id) => things[id]).join('')}</items>`);
    },
    claude: (body) => {
      const user = body.messages[0].content;
      const text = (t) => f.response(200, JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] }));
      if (body.output_config?.format) {
        if (user.includes('용어를 번역')) {
          const items = [...user.matchAll(/\] (.+)$/gm)].map((m) => ({ en: m[1], ko: `AI-${m[1]}`, desc: `${m[1]} 설명` }));
          return text(JSON.stringify({ items }));
        }
        const items = [...user.matchAll(/id=(\d+): (.+)$/gm)].map((m) => ({ id: m[1], name_ko: `AI제목-${m[2]}` }));
        return text(JSON.stringify({ items }));
      }
      return text(`번역: ${user}`);
    },
  });
  const gs = loadGs(f.services);
  f.props.set('BGG_USERNAME', 'club');
  f.props.set('BGG_TOKEN', 'bggtok');
  f.props.set('ANTHROPIC_API_KEY', 'sk-test');
  return { f, gs };
}

const published = (gs) => JSON.parse(gs.readPublished_());

test('처음 설정 → 동기화 한 번에 끝까지', () => {
  const { f, gs } = makeEnv();
  gs.setup();
  assert.ok(f.triggers.some((t) => t.fn === 'onSheetEdit'));
  assert.ok(!f.triggers.some((t) => t.fn === 'autoPublish')); // 주기 트리거 없음
  assert.equal(f.props.get('SHEET_ID'), 'SHEET123');

  const status = gs.startSync_('owner@club.kr', 60_000);
  assert.equal(status.job.state, 'done', status.job.error);
  assert.equal(status.job.message, '완료: 게임 3개');

  const out = published(gs);
  const [catan, brass, streams] = out.games;
  assert.equal(catan.name_ko, '카탄'); // BGG 한글 이름 → AI 안 씀
  assert.equal(catan._src.name, 'bgg');
  assert.equal(brass.name_ko, 'AI제목-Brass');
  assert.equal(catan.description, 'Build & trade.');
  assert.equal(catan.description_ko, '번역: Build & trade.');
  assert.equal(streams.description_ko, ''); // 영문 설명 없으면 번역 안 함
  // 장르/메커니즘: 기본 사전(Dictionary.gs) 우선, 없는 것만 AI
  assert.deepEqual(catan.mechanics_ko, ['거래', '주사위 굴리기']);
  assert.equal(brass.mechanics_ko[1], 'AI-Brand New Mechanic');
  assert.equal(out.terms.mechanics.Trading.source, 'builtin');
  assert.equal(out.terms.mechanics['Brand New Mechanic'].source, 'ai');

  // Claude 요청 형태
  const first = f.log.claude[0];
  assert.equal(first.body.model, 'claude-haiku-5-5');
  assert.equal(first.headers['anthropic-version'], '2026-10-21');
  assert.equal(first.headers['x-api-key'], 'sk-test');
  assert.equal(first.body.output_config.effort, 'low');
  const descReq = f.log.claude.find((c) => !c.body.output_config.format);
  assert.match(descReq.body.system[0].text, /Trading = 거래/); // 용어집 포함
  assert.equal(descReq.body.system[0].cache_control.type, 'ephemeral');

  // 시트 구조
  const games = f.sheets.get('게임');
  assert.equal(games.get(1, 3), '한글 제목 (수정)');
  assert.equal(games.get(3, 5), 'AI제목-Brass');
  assert.equal(f.sheets.get('_bgg').hidden, true);
  assert.ok(!f.triggers.some((t) => t.fn === 'continueSync')); // 끝났으면 이어하기 트리거 없음
});

test('시간이 모자라면 이어서 실행 (트리거)', () => {
  const { f, gs } = makeEnv();
  gs.setup();
  let status = gs.startSync_('owner@club.kr', -1); // 시간 0: 아무것도 못 하고 예약만
  assert.equal(status.job.state, 'running');
  assert.ok(f.triggers.some((t) => t.fn === 'continueSync'));
  // 웹 앱/트리거에는 열린 시트가 없음 → 저장해둔 SHEET_ID로 열려야 함
  f.detach();
  for (let i = 0; i < 10 && gs.getStatus_().job.state === 'running'; i++) gs.continueSync();
  status = gs.getStatus_();
  assert.equal(status.job.state, 'done', status.job.error);
  assert.equal(f.triggers.filter((t) => t.fn === 'continueSync').length, 0);
  // 끝난 뒤엔 다시 시작할 수 있어야 함
  assert.equal(gs.startSync_('owner@club.kr', 60_000).job.state, 'done');
});

test('운영진 시트 수정 → 바로 반영, 다음 동기화에도 유지', () => {
  const { f, gs } = makeEnv();
  gs.setup();
  gs.startSync_('owner@club.kr', 60_000);
  const claudeCalls = f.log.claude.length;

  const games = f.sheets.get('게임');
  const terms = f.sheets.get('사전');
  games.set(3, 3, '브라스'); // Brass 한글 제목 (수정)
  games.set(3, 4, '운영진 설명');
  const tradingRow = [...Array(terms.getLastRow()).keys()].map((i) => i + 2).find((r) => terms.get(r, 2) === 'Trading');
  terms.set(tradingRow, 3, '교환');
  const before = gs.getStatus_().publishedAt;
  gs.onSheetEdit({ range: { getSheet: () => f.sheets.get('_bgg') } }); // 다른 시트 수정은 무시
  assert.equal(gs.getStatus_().publishedAt, before);
  gs.onSheetEdit({ range: { getSheet: () => games } });
  let out = published(gs);
  assert.equal(out.games[1].name_ko, '브라스');
  assert.equal(out.games[1]._src.desc, 'admin');
  assert.equal(out.games[0].mechanics_ko[0], '교환'); // 운영진 사전 > 기본 사전
  assert.equal(gs.getStatus_().pendingEdits, false);

  // 다시 동기화: 운영진 수정 유지, 이미 번역한 건 다시 안 부름
  const status = gs.startSync_('owner@club.kr', 60_000);
  assert.equal(status.job.state, 'done', status.job.error);
  out = published(gs);
  assert.equal(out.games[1].name_ko, '브라스');
  assert.equal(out.games[1].description_ko, '운영진 설명');
  assert.equal(f.log.claude.length, claudeCalls, '변한 게 없으면 AI 호출 0번');
});

test('BGG 영문 설명이 바뀌면 그 게임만 다시 번역', () => {
  const env = makeEnv();
  env.gs.setup();
  env.gs.startSync_('owner@club.kr', 60_000);
  const before = env.f.log.claude.length;
  // 같은 시트/속성을 쓰는 새 환경을 만들기 어려워서, BGG 응답만 바꿔 다시 동기화
  const env2 = makeEnv({ descText: 'New text.' });
  // env2에 env의 시트·속성 복사
  env.f.sheets.forEach((s, n) => env2.f.sheets.set(n, s));
  env.f.props.forEach((v, k) => env2.f.props.set(k, v));
  env2.f.props.delete('SYNC_JOB');
  env2.gs.startSync_('owner@club.kr', 60_000);
  const descCalls = env2.f.log.claude.filter((c) => !c.body.output_config.format);
  assert.equal(descCalls.length, 1);
  assert.equal(descCalls[0].body.messages[0].content, 'New text.');
  assert.ok(before > 0);
});

test('웹 앱: 게임 JSON, 시트 정보, 상태, 반영 + 동기화 10분 제한', () => {
  const { f, gs } = makeEnv();
  gs.setup();
  f.detach();
  const post = (body) => JSON.parse(gs.doPost({ postData: { contents: JSON.stringify(body) } }).text);

  const first = post({ action: 'sync' });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.job.state, 'done');
  // 방금 끝났으면 다시 시작 못 함
  assert.match(post({ action: 'sync' }).error, /10분에 한 번/);

  f.cache.clear(); // 캐시 없을 때 시트에서 읽기
  const get = JSON.parse(gs.doGet({ parameter: { action: 'games' } }).text);
  assert.equal(get.games.length, 3);

  const info = post({ action: 'info' });
  assert.equal(info.ok, true, info.error);
  assert.equal(info.rows['2'], 3); // Brass 는 3번째 행
  assert.match(info.sheetUrl, /SHEET123/);

  const pub = post({ action: 'publish' });
  assert.equal(pub.ok, true, pub.error);
  assert.equal(pub.count, 3);
  assert.equal(post({ action: 'status' }).job.state, 'done');
  assert.match(post({ action: 'nope' }).error, /알 수 없는/);

  // 10분 지나면 다시 가능
  const job = JSON.parse(f.props.get('SYNC_JOB'));
  job.finishedAt -= 11 * 60 * 1000;
  f.props.set('SYNC_JOB', JSON.stringify(job));
  assert.equal(post({ action: 'sync' }).ok, true);
});

test('동기화 실패하면 오류 상태로 남고 다시 시작 가능', () => {
  const { f, gs } = makeEnv();
  gs.setup();
  f.props.delete('BGG_USERNAME');
  const status = gs.startSync_('owner@club.kr', 60_000);
  assert.equal(status.job.state, 'error'); // (콘솔에 찍히는 BGG_USERNAME 오류는 일부러 낸 것)
  assert.match(status.job.error, /BGG_USERNAME/);
  f.props.set('BGG_USERNAME', 'club');
  assert.equal(gs.startSync_('owner@club.kr', 60_000).job.state, 'done');
});

test('동기화 중 시트를 고치면 동기화 끝날 때 같이 반영', () => {
  const { f, gs } = makeEnv();
  gs.setup();
  gs.startSync_('owner@club.kr', 60_000);
  // 두 번째 동기화를 시작만 해두고(실행 시간 0) 그 사이에 수정
  gs.startSync_('owner@club.kr', -1);
  const games = f.sheets.get('게임');
  games.set(2, 3, '카탄 (운영진)');
  gs.onSheetEdit({ range: { getSheet: () => games } });
  assert.equal(gs.getStatus_().pendingEdits, true); // 동기화 중이라 바로 반영 안 함
  for (let i = 0; i < 10 && gs.getStatus_().job.state === 'running'; i++) gs.continueSync();
  assert.equal(published(gs).games[0].name_ko, '카탄 (운영진)');
  assert.equal(gs.getStatus_().pendingEdits, false);
});
