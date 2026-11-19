// 스프레드시트 값 → 사이트용 JSON (순수 함수: 시트/네트워크 접근 없음)
// 번역 우선순위
//   제목: 운영진 수정 → 자동(BGG 한글 이름 또는 AI) → 영문
//   설명: 운영진 수정 → AI 번역(영문이 바뀌면 무효) → 영문
//   장르/메커니즘: 운영진 사전 → 기본 사전 → AI → 영문 (한글·설명 각각)

const TERM_TYPES = ['mechanics', 'categories'];

function hashText_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, text || '', Utilities.Charset.UTF_8);
  return bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

const termKey_ = (type, en) => `${type}~${en}`;

// 번역 실패 표시('-')는 빈칸으로 취급
const FAILED_MARK = '-';
const val_ = (v) => (v === FAILED_MARK ? '' : v || '');

/** 사전 시트 행 → Map(termKey → {koEdit, descEdit, koBase, descBase, koAi, descAi}) */
function termsFromRows_(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const type = TERM_TYPE_BY_LABEL[r[T.type - 1]];
    const en = r[T.en - 1];
    if (!type || !en) return;
    map.set(termKey_(type, en), {
      koEdit: r[T.koEdit - 1], descEdit: r[T.descEdit - 1],
      koBase: r[T.koBase - 1], descBase: r[T.descBase - 1],
      koAi: val_(r[T.koAi - 1]), descAi: val_(r[T.descAi - 1]),
    });
  });
  return map;
}

function resolveTerm_(type, en, terms, builtin) {
  const t = terms.get(termKey_(type, en)) || {};
  const koBase = t.koBase || (builtin.ko[en] || '');
  const descBase = t.descBase || (koBase ? builtin.descByKo[koBase] || '' : '');
  const ko = t.koEdit || koBase || t.koAi || '';
  const desc = t.descEdit || descBase || t.descAi || '';
  let source = 'none';
  if (t.koEdit) source = 'admin';
  else if (koBase) source = 'builtin';
  else if (t.koAi) source = 'ai';
  return { ko: ko || en, desc, source };
}

/** 게임 시트 행 → Map(id → row) */
function gamesFromRows_(rows) {
  const map = new Map();
  rows.forEach((r) => r[G.id - 1] && map.set(String(r[G.id - 1]), r));
  return map;
}

function resolveName_(raw, row) {
  const edit = row ? row[G.nameKoEdit - 1] : '';
  const auto = row ? val_(row[G.nameKoAuto - 1]) : '';
  if (edit) return { text: edit, source: 'admin' };
  if (auto) return { text: auto, source: auto === raw.name_ko_bgg ? 'bgg' : 'ai' };
  if (raw.name_ko_bgg) return { text: raw.name_ko_bgg, source: 'bgg' };
  return { text: '', source: 'none' };
}

function resolveDescription_(raw, row) {
  const edit = row ? row[G.descKoEdit - 1] : '';
  if (edit) return { text: edit, source: 'admin' };
  const auto = row ? row[G.descKoAuto - 1] : '';
  const hash = row ? row[G.descHash - 1] : '';
  if (auto && hash === hashText_(raw.description)) return { text: auto, source: 'ai' };
  return { text: '', source: 'none' };
}

/**
 * @param raw       BGG 원본 게임 배열 (parseThing_ 형태)
 * @param gameRows  게임 시트 행
 * @param termRows  사전 시트 행
 * @param builtin   BUILTIN (Dictionary.gs)
 */
function buildPublished_(raw, gameRows, termRows, builtin, now) {
  const rowsById = gamesFromRows_(gameRows);
  const terms = termsFromRows_(termRows);
  const outTerms = { mechanics: {}, categories: {} };

  const games = raw.map((g) => {
    const row = rowsById.get(g.id);
    const name = resolveName_(g, row);
    const desc = resolveDescription_(g, row);
    const koOf = (type) => (g[type] || []).map((en) => {
      const t = resolveTerm_(type, en, terms, builtin);
      outTerms[type][en] = t;
      return t.ko;
    });
    const out = Object.assign({}, g);
    delete out.name_ko_bgg;
    return Object.assign(out, {
      name_ko: name.text,
      description_ko: desc.text,
      mechanics_ko: koOf('mechanics'),
      categories_ko: koOf('categories'),
      _src: { name: name.source, desc: desc.source },
    });
  });

  return { updatedAt: (now || new Date()).toISOString(), games, terms: outTerms };
}

// ---------- 동기화 때 시트 합치기 ----------

/**
 * BGG 원본으로 게임 시트 행 다시 만들기.
 * 운영진 수정 열과 자동 번역 열은 BGG ID 기준으로 그대로 이어받고, BGG 컬렉션에 없는 게임은 빠진다.
 */
function mergeGameRows_(raw, oldRows) {
  const old = gamesFromRows_(oldRows);
  return raw.map((g) => {
    const r = old.get(g.id) || [];
    const keep = (col) => (r[col - 1] != null ? r[col - 1] : '');
    return [
      g.id, g.name_en,
      keep(G.nameKoEdit), keep(G.descKoEdit),
      val_(keep(G.nameKoAuto)) || g.name_ko_bgg || '', keep(G.descKoAuto),
      g.description, keep(G.descHash),
    ];
  });
}

/**
 * 사전 시트 행 다시 만들기: 기존 행 순서 유지 + 새 용어는 아래에 추가.
 * 기본 사전 열은 매번 Dictionary.gs 값으로 새로 채움. 더 이상 안 쓰는 용어는 운영진이 고친 것만 남김.
 */
function mergeTermRows_(raw, oldRows, builtin) {
  const counts = new Map();
  raw.forEach((g) => TERM_TYPES.forEach((type) => (g[type] || []).forEach((en) => {
    const k = termKey_(type, en);
    counts.set(k, (counts.get(k) || 0) + 1);
  })));

  const seen = new Set();
  const rows = [];
  const pushRow = (type, en, r) => {
    const koBase = builtin.ko[en] || '';
    rows.push([
      TERM_TYPE_LABEL[type], en,
      r ? r[T.koEdit - 1] : '', r ? r[T.descEdit - 1] : '',
      koBase, koBase ? builtin.descByKo[koBase] || '' : '',
      r ? val_(r[T.koAi - 1]) : '', r ? val_(r[T.descAi - 1]) : '',
      counts.get(termKey_(type, en)) || 0,
    ]);
  };

  oldRows.forEach((r) => {
    const type = TERM_TYPE_BY_LABEL[r[T.type - 1]];
    const en = r[T.en - 1];
    if (!type || !en) return;
    const k = termKey_(type, en);
    if (seen.has(k)) return;
    seen.add(k);
    if (!counts.has(k) && !r[T.koEdit - 1] && !r[T.descEdit - 1]) return;
    pushRow(type, en, r);
  });

  TERM_TYPES.forEach((type) => {
    [...counts.keys()]
      .filter((k) => k.startsWith(`${type}~`) && !seen.has(k))
      .sort((a, b) => counts.get(b) - counts.get(a))
      .forEach((k) => pushRow(type, k.slice(type.length + 1), null));
  });
  return rows;
}
