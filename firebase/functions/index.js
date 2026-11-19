// 운영진 페이지에서 부르는 서버 함수
//   syncGames    : BGG에서 목록 가져오기 → 번역 안 된 것만 AI 번역 → 사이트 JSON 덮어쓰기
//   publishGames : (BGG·AI 호출 없이) 운영진 수정 내용만 다시 반영
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { fetchGames } from './lib/bgg.js';
import {
  buildPublished, hashText, missingTerms, resolveName, resolveDescription, resolveTerm,
  termKey, termsMap, TERM_TYPES,
} from './lib/build.js';
import {
  createClient, descriptionSystem, mapLimit, translateDescription, translateNames, translateTerms,
} from './lib/translate.js';

initializeApp();
setGlobalOptions({ region: 'asia-northeast3' });

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const BGG_TOKEN = defineSecret('BGG_TOKEN');
const BGG_USERNAME = defineString('BGG_USERNAME');

const db = getFirestore();
const RAW_PATH = 'raw/bgg.json';
const PUBLIC_PATH = 'public/games.json';
const statusRef = () => db.doc('sync/status');

// ---------- 공통 ----------
async function assertAdmin(request) {
  const token = request.auth?.token;
  if (!token?.email || token.email_verified !== true) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  const snap = await db.doc('config/admins').get();
  const emails = snap.get('emails') || [];
  if (!emails.includes(token.email)) throw new HttpsError('permission-denied', '권한이 없습니다.');
  return token.email;
}

// 클라이언트가 넘기는 기본 사전 { ko: {en: ko}, descByKo: {ko: desc} } 검사
function readBuiltin(data) {
  const b = data?.builtin;
  const isMap = (o) => o && typeof o === 'object' && !Array.isArray(o)
    && Object.values(o).every((v) => typeof v === 'string');
  if (!isMap(b?.ko) || !isMap(b?.descByKo)) return { ko: {}, descByKo: {} };
  return { ko: b.ko, descByKo: b.descByKo };
}

async function loadCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadState() {
  const [edits, terms, cache] = await Promise.all(
    ['gameEdits', 'terms', 'aiCache'].map(loadCollection)
  );
  return {
    edits: new Map(edits.map((d) => [d.id, d])),
    stored: termsMap(terms),
    aiCache: new Map(cache.map((d) => [d.id, d])),
  };
}

async function readJson(path) {
  const file = getStorage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buf] = await file.download();
  return JSON.parse(buf.toString('utf8'));
}

async function writeJson(path, data, cacheControl) {
  await getStorage().bucket().file(path).save(JSON.stringify(data), {
    contentType: 'application/json; charset=utf-8',
    resumable: false,
    metadata: { cacheControl },
  });
}

async function publish(raw, builtin) {
  const state = await loadState();
  const out = buildPublished({ raw, builtin, ...state });
  await writeJson(PUBLIC_PATH, out, 'public, max-age=60');
  return out;
}

// Firestore 일괄 쓰기 (한 번에 최대 500개)
async function writeMany(entries) {
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch();
    for (const [ref, data] of entries.slice(i, i + 400)) batch.set(ref, data, { merge: true });
    await batch.commit();
  }
}

// ---------- publishGames ----------
export const publishGames = onCall({ timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  await assertAdmin(request);
  const raw = await readJson(RAW_PATH);
  if (!raw?.games?.length) {
    throw new HttpsError('failed-precondition', '아직 BGG에서 가져온 적이 없어요. 먼저 동기화를 실행하세요.');
  }
  const out = await publish(raw.games, readBuiltin(request.data));
  return { games: out.games.length, updatedAt: out.updatedAt };
});

// ---------- syncGames ----------
const RUNNING_TIMEOUT_MS = 70 * 60 * 1000;

export const syncGames = onCall(
  {
    timeoutSeconds: 3600,
    memory: '1GiB',
    secrets: [ANTHROPIC_API_KEY, BGG_TOKEN],
  },
  async (request) => {
    const by = await assertAdmin(request);
    const builtin = readBuiltin(request.data);

    // 동시에 두 번 돌지 않게 잠금
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(statusRef());
      const s = snap.data();
      const startedAt = s?.startedAt?.toMillis?.() ?? 0;
      if (s?.state === 'running' && Date.now() - startedAt < RUNNING_TIMEOUT_MS) {
        throw new HttpsError('already-exists', '이미 동기화가 진행 중이에요.');
      }
      tx.set(statusRef(), {
        state: 'running', step: 'bgg', done: 0, total: 0, message: 'BGG에서 목록을 가져오는 중',
        startedAt: FieldValue.serverTimestamp(), finishedAt: null, by, error: null,
      });
    });

    let lastWrite = 0;
    const setStatus = async (patch, force = false) => {
      if (!force && Date.now() - lastWrite < 1500) return; // 너무 자주 쓰지 않게
      lastWrite = Date.now();
      await statusRef().set(patch, { merge: true });
    };

    try {
      // 1) BGG
      const raw = await fetchGames({
        username: BGG_USERNAME.value(),
        token: BGG_TOKEN.value(),
        onProgress: (done, total) =>
          setStatus({ step: 'bgg', done, total, message: `BGG 게임 정보 ${done}/${total}` }),
      });
      if (!raw.length) throw new Error('BGG 컬렉션이 비어 있어요. 사용자 이름/공개 설정을 확인하세요.');
      await writeJson(RAW_PATH, { fetchedAt: new Date().toISOString(), games: raw }, 'private, max-age=0');

      const client = createClient(ANTHROPIC_API_KEY.value());
      let { edits, stored, aiCache } = await loadState();

      // 2) 장르/메커니즘: 운영진·기본 사전에 없는 것만
      const terms = missingTerms(raw, stored, builtin);
      await setStatus({ step: 'terms', done: 0, total: terms.length, message: `장르·메커니즘 번역 ${terms.length}개` }, true);
      if (terms.length) {
        const translated = await translateTerms(client, terms);
        await writeMany(
          [...translated.entries()].map(([key, t]) => {
            const [type, ...rest] = key.split('~');
            const en = rest.join('~');
            return [
              db.collection('terms').doc(`${type}~${encodeURIComponent(en)}`),
              { type, en, ko: t.ko, desc: t.desc, source: 'ai', updatedAt: FieldValue.serverTimestamp() },
            ];
          })
        );
        ({ stored } = await loadState());
      }

      // 3) 제목: 운영진 수정·BGG 한글 이름·캐시 모두 없을 때만
      const needNames = raw.filter((g) => !resolveName(g, edits.get(g.id), aiCache.get(g.id)));
      await setStatus({ step: 'names', done: 0, total: needNames.length, message: `제목 번역 ${needNames.length}개` }, true);
      if (needNames.length) {
        const names = await translateNames(client, needNames);
        await writeMany(
          [...names.entries()].map(([id, name_ko]) => [db.collection('aiCache').doc(id), { name_ko }])
        );
      }

      // 4) 설명: 운영진 수정이 없고, 영문이 바뀌었거나 아직 번역 안 된 것만
      const needDesc = raw.filter(
        (g) => g.description && !resolveDescription(g, edits.get(g.id), aiCache.get(g.id))
      );
      const glossary = TERM_TYPES.flatMap((type) =>
        [...new Set(raw.flatMap((g) => g[type] || []))].map((en) => ({
          en,
          ko: resolveTerm(type, en, stored, builtin).ko,
        }))
      );
      const system = descriptionSystem(glossary);
      let descDone = 0;
      await setStatus({ step: 'descriptions', done: 0, total: needDesc.length, message: `설명 번역 0/${needDesc.length}` }, true);
      await mapLimit(needDesc, 5, async (g) => {
        const ko = await translateDescription(client, g.description, system);
        if (ko) {
          await db.collection('aiCache').doc(g.id).set(
            { description_ko: ko, descHash: hashText(g.description) },
            { merge: true }
          );
        }
        descDone += 1;
        await setStatus({ done: descDone, message: `설명 번역 ${descDone}/${needDesc.length}` });
      });

      // 5) 사이트 JSON 덮어쓰기
      await setStatus({ step: 'publish', message: '사이트에 반영하는 중' }, true);
      const out = await publish(raw, builtin);

      await setStatus({
        state: 'done', step: 'done', done: out.games.length, total: out.games.length,
        message: `완료: 게임 ${out.games.length}개`, finishedAt: FieldValue.serverTimestamp(),
      }, true);
      return { games: out.games.length, updatedAt: out.updatedAt };
    } catch (e) {
      console.error(e);
      await setStatus({
        state: 'error', message: '동기화 실패', error: String(e?.message || e),
        finishedAt: FieldValue.serverTimestamp(),
      }, true);
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('internal', String(e?.message || e));
    }
  }
);

// 테스트에서 쓰려고 내보냄
export const _internal = { readBuiltin, termKey };
