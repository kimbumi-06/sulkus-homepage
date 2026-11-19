// Claude API로 번역 (운영진 수정·기본 사전·이미 번역된 것은 건너뜀)
// 스크립트 속성: ANTHROPIC_API_KEY

const CLAUDE_MODEL = 'claude-haiku-5-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_VERSION = '2026-10-21';
const TERM_BATCH = 40;
const NAME_BATCH = 40;
const DESC_PARALLEL = 6; // 설명 번역 동시 요청 수

function claudeRequest_(body) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('스크립트 속성 ANTHROPIC_API_KEY 가 없습니다.');
  return {
    url: CLAUDE_URL,
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': CLAUDE_VERSION },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  };
}

/** 여러 요청 동시에. 429/5xx는 잠깐 쉬고 다시. 결과: 응답 JSON 또는 null */
function claudeFetchAll_(bodies) {
  const results = new Array(bodies.length).fill(null);
  let pending = bodies.map((_, i) => i);
  for (let attempt = 0; attempt < 4 && pending.length; attempt++) {
    if (attempt) Utilities.sleep(5000 * attempt);
    const responses = UrlFetchApp.fetchAll(pending.map((i) => claudeRequest_(bodies[i])));
    const retry = [];
    responses.forEach((res, k) => {
      const i = pending[k];
      const code = res.getResponseCode();
      if (code === 200) results[i] = JSON.parse(res.getContentText());
      else if (code === 429 || code === 529 || code >= 500) retry.push(i);
      else console.warn(`Claude API ${code}: ${res.getContentText().slice(0, 300)}`);
    });
    pending = retry;
  }
  return results;
}

/** 응답에서 글만 (거절·잘림이면 null) */
function claudeText_(res) {
  if (!res || res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return null;
  const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  return text || null;
}

function claudeJson_(res) {
  const text = claudeText_(res);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

const chunk_ = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

// ---------- 요청 본문 ----------

const TERM_SYSTEM = [
  '너는 한국 보드게임 동호회 홈페이지의 번역 담당이다.',
  'BoardGameGeek의 메커니즘/장르 용어를 한국 보드게이머들이 실제로 쓰는 말로 옮긴다.',
  '- ko: 한국 커뮤니티에서 통용되는 이름 (예: Worker Placement → 일꾼 놓기). 통용 번역이 없으면 자연스러운 한국어로.',
  '- desc: 처음 보는 사람도 이해할 수 있는 한 줄 설명 (40자 이내, "~함" 체).',
].join('\n');

const NAME_SYSTEM = [
  '너는 한국 보드게임 동호회 홈페이지의 번역 담당이다.',
  '보드게임 영문 제목을 한국어 제목으로 옮긴다.',
  '- 한국어판이 출시된 게임은 그 공식 한국어 제목을 쓴다.',
  '- 공식 제목을 모르면 한국 보드게이머들이 흔히 부르는 이름, 그것도 없으면 영문 발음을 자연스럽게 한글로 적는다.',
  '- 부제(콜론 뒤)도 같은 방식으로 옮기고, 숫자·기호는 유지한다.',
].join('\n');

const DESC_SYSTEM = [
  '너는 한국 보드게임 동호회 홈페이지의 번역 담당이다.',
  'BoardGameGeek의 보드게임 소개글을 자연스러운 한국어로 번역한다.',
  '- 내용을 더하거나 빼지 말고, 문단(빈 줄) 구분과 목록 형태를 그대로 유지한다.',
  '- 게임 고유 용어와 카드·자원 이름은 한국어판 용어가 있으면 그것을, 없으면 원어 발음을 한글로 적는다.',
  '- 번역문만 출력한다.',
].join('\n');

function jsonSchema_(itemProps) {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: itemProps,
          required: Object.keys(itemProps),
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  };
}

function termsBody_(terms) {
  const list = terms.map((t) => `- [${TERM_TYPE_LABEL[t.type]}] ${t.en}`).join('\n');
  return {
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: TERM_SYSTEM,
    messages: [{ role: 'user', content: `다음 용어를 번역해줘. en에는 원문을 그대로 적어.\n${list}` }],
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: jsonSchema_({ en: { type: 'string' }, ko: { type: 'string' }, desc: { type: 'string' } }) },
    },
  };
}

function namesBody_(games) {
  const list = games.map((g) => `- id=${g.id}: ${g.name}`).join('\n');
  return {
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: NAME_SYSTEM,
    messages: [{ role: 'user', content: `다음 게임 제목을 한국어로. id는 그대로 돌려줘.\n${list}` }],
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: jsonSchema_({ id: { type: 'string' }, name_ko: { type: 'string' } }) },
    },
  };
}

/** 용어집(운영진 사전 + 기본 사전 + AI)을 붙인 설명 번역 지시문. 모든 설명에서 같아서 캐시됨 */
function descSystem_(glossary) {
  const lines = glossary.filter((g) => g.en && g.ko && g.en !== g.ko).map((g) => `${g.en} = ${g.ko}`).sort();
  const text = lines.length
    ? [DESC_SYSTEM, '- 아래 용어집에 있는 표현은 반드시 용어집의 한국어를 쓴다.', '', '<용어집>', ...lines, '</용어집>'].join('\n')
    : DESC_SYSTEM;
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

function descBody_(system, text) {
  return {
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: text }],
    output_config: { effort: 'low' },
  };
}

// ---------- 무엇을 번역할지 (순수 함수, 테스트 대상) ----------

/** 사전 시트에서 한글이나 설명이 하나도 없는 용어: [{row, type, en}] (row는 시트 행 번호) */
function termsToTranslate_(termRows) {
  const out = [];
  termRows.forEach((r, i) => {
    const type = TERM_TYPE_BY_LABEL[r[T.type - 1]];
    if (!type || !r[T.en - 1]) return;
    const hasKo = r[T.koEdit - 1] || r[T.koBase - 1] || r[T.koAi - 1];
    const hasDesc = r[T.descEdit - 1] || r[T.descBase - 1] || r[T.descAi - 1];
    if (!hasKo || !hasDesc) out.push({ row: i + 2, type, en: r[T.en - 1] });
  });
  return out;
}

/** 운영진 제목도 자동 제목도 없는 게임: [{row, id, name}] */
function namesToTranslate_(gameRows) {
  const out = [];
  gameRows.forEach((r, i) => {
    if (r[G.id - 1] && !r[G.nameKoEdit - 1] && !r[G.nameKoAuto - 1]) {
      out.push({ row: i + 2, id: String(r[G.id - 1]), name: r[G.nameEn - 1] });
    }
  });
  return out;
}

/** 운영진 설명이 없고, 자동 번역이 없거나 영문이 바뀐 게임: [{row, text}] */
function descriptionsToTranslate_(gameRows) {
  const out = [];
  gameRows.forEach((r, i) => {
    const en = r[G.descEn - 1];
    if (!en || r[G.descKoEdit - 1]) return;
    if (r[G.descKoAuto - 1] && r[G.descHash - 1] === hashText_(en)) return;
    out.push({ row: i + 2, text: en });
  });
  return out;
}

/** 설명 번역에 넣을 용어집 */
function glossaryFromTerms_(termRows, builtin) {
  const terms = termsFromRows_(termRows);
  const out = [];
  terms.forEach((_, key) => {
    const type = key.slice(0, key.indexOf('~'));
    const en = key.slice(key.indexOf('~') + 1);
    out.push({ en, ko: resolveTerm_(type, en, terms, builtin).ko });
  });
  return out;
}

// ---------- 동기화 단계 ----------

function stepTerms_(job, deadline) {
  const sh = sheet_(SHEET.terms);
  const todo = termsToTranslate_(readRows_(SHEET.terms, TERM_HEADERS.length));
  if (!job.total) job.total = todo.length;
  const batches = chunk_(todo, TERM_BATCH);
  while (batches.length && Date.now() < deadline) {
    const group = batches.splice(0, 4); // 4개 요청씩 동시에
    const results = claudeFetchAll_(group.map(termsBody_));
    group.forEach((batch, k) => {
      const parsed = claudeJson_(results[k]);
      const byEn = new Map(((parsed && parsed.items) || []).map((it) => [String(it.en).trim(), it]));
      batch.forEach((t) => {
        const hit = byEn.get(t.en);
        // 실패한 용어는 '-'로 표시해서 같은 동기화에서 다시 시도하지 않음 (다음 동기화 때 자동으로 다시 번역)
        const ko = hit && hit.ko ? String(hit.ko).trim() : '';
        const desc = hit && hit.desc ? String(hit.desc).trim() : '';
        sh.getRange(t.row, T.koAi, 1, 2).setValues([[ko || FAILED_MARK, desc || FAILED_MARK]]);
      });
    });
    job.done = job.total - batches.reduce((n, b) => n + b.length, 0);
    job.message = `장르·메커니즘 번역 ${job.done}/${job.total}`;
  }
  if (batches.length) return job;
  return Object.assign(job, { step: 'names', done: 0, total: 0, message: '제목 번역' });
}

function stepNames_(job, deadline) {
  const sh = sheet_(SHEET.games);
  const todo = namesToTranslate_(readRows_(SHEET.games, GAME_HEADERS.length));
  if (!job.total) job.total = todo.length;
  const batches = chunk_(todo, NAME_BATCH);
  while (batches.length && Date.now() < deadline) {
    const group = batches.splice(0, 4);
    const results = claudeFetchAll_(group.map(namesBody_));
    group.forEach((batch, k) => {
      const parsed = claudeJson_(results[k]);
      const byId = new Map(((parsed && parsed.items) || []).map((it) => [String(it.id), it.name_ko]));
      batch.forEach((g) => {
        const ko = byId.get(g.id);
        sh.getRange(g.row, G.nameKoAuto).setValue(ko ? String(ko).trim() : FAILED_MARK); // 실패 표시, 다음 동기화 때 다시
      });
    });
    job.done = job.total - batches.reduce((n, b) => n + b.length, 0);
    job.message = `제목 번역 ${job.done}/${job.total}`;
  }
  if (batches.length) return job;
  return Object.assign(job, { step: 'descriptions', done: 0, total: 0, message: '설명 번역' });
}

function stepDescriptions_(job, deadline) {
  const sh = sheet_(SHEET.games);
  const todo = descriptionsToTranslate_(readRows_(SHEET.games, GAME_HEADERS.length));
  if (!job.total) job.total = todo.length;
  if (job.descFailed == null) job.descFailed = [];
  // 이번 동기화에서 이미 실패한 행은 건너뜀
  const queue = todo.filter((d) => job.descFailed.indexOf(d.row) === -1);
  const system = descSystem_(glossaryFromTerms_(readRows_(SHEET.terms, TERM_HEADERS.length), BUILTIN));
  while (queue.length && Date.now() < deadline) {
    const group = queue.splice(0, DESC_PARALLEL);
    const results = claudeFetchAll_(group.map((d) => descBody_(system, d.text)));
    group.forEach((d, k) => {
      const ko = claudeText_(results[k]);
      if (ko) sh.getRange(d.row, G.descKoAuto, 1, 3).setValues([[ko, d.text, hashText_(d.text)]]);
      else job.descFailed.push(d.row);
    });
    job.done = job.total - queue.length;
    job.message = `설명 번역 ${job.done}/${job.total}`;
  }
  if (queue.length) return job;
  return Object.assign(job, {
    step: 'publish', done: 0, total: 0, descFailed: null,
    message: job.descFailed.length ? `설명 번역 실패 ${job.descFailed.length}개 (영문으로 표시)` : '사이트에 반영하는 중',
  });
}
