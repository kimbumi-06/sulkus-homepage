// Claude API로 한국어 번역 (운영진 수정·기본 사전에 없는 것만 호출됨)
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

export const MODEL = 'claude-haiku-5-5';
const BATCH = 40;

export function createClient(apiKey) {
  return new Anthropic({ apiKey, maxRetries: 5 });
}

/** 동시에 limit개씩 실행 */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const chunks = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

// 구조화 출력 요청. 거절·파싱 실패 시 null (해당 항목은 영문 그대로 둠)
async function parseJson(client, { system, content, schema, maxTokens = 8000 }) {
  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'low', format: zodOutputFormat(schema) },
    });
    if (res.stop_reason === 'refusal') return null;
    return res.parsed_output ?? null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.warn(`Claude API ${e.status}: ${e.message}`);
      return null;
    }
    throw e;
  }
}

const TERM_SYSTEM = `너는 한국 보드게임 동호회 홈페이지의 번역 담당이다.
BoardGameGeek의 메커니즘/장르 용어를 한국 보드게이머들이 실제로 쓰는 말로 옮긴다.
- ko: 한국 커뮤니티에서 통용되는 이름 (예: Worker Placement → 일꾼 놓기, Deck, Bag, and Pool Building → 덱 빌딩). 통용 번역이 없으면 자연스러운 한국어로.
- desc: 처음 보는 사람도 이해할 수 있는 한 줄 설명 (40자 이내, 존댓말 없이 "~함" 체).`;

const TermsSchema = z.object({
  items: z.array(z.object({ en: z.string(), ko: z.string(), desc: z.string() })),
});

/** [{type, en}] → Map(`${type}~${en}` → {ko, desc}) */
export async function translateTerms(client, terms) {
  const out = new Map();
  for (const batch of chunks(terms, BATCH)) {
    const list = batch.map((t) => `- [${t.type === 'mechanics' ? '메커니즘' : '장르'}] ${t.en}`).join('\n');
    const parsed = await parseJson(client, {
      system: TERM_SYSTEM,
      content: `다음 용어를 번역해줘. en에는 원문을 그대로 적어.\n${list}`,
      schema: TermsSchema,
    });
    const byEn = new Map((parsed?.items || []).map((i) => [i.en.trim(), i]));
    for (const t of batch) {
      const hit = byEn.get(t.en);
      if (hit?.ko) out.set(`${t.type}~${t.en}`, { ko: hit.ko.trim(), desc: hit.desc.trim() });
    }
  }
  return out;
}

const NAME_SYSTEM = `너는 한국 보드게임 동호회 홈페이지의 번역 담당이다.
보드게임 영문 제목을 한국어 제목으로 옮긴다.
- 한국어판이 출시된 게임은 그 공식 한국어 제목을 쓴다.
- 공식 제목을 모르면 한국 보드게이머들이 흔히 부르는 이름, 그것도 없으면 영문 발음을 자연스럽게 한글로 적는다.
- 부제(콜론 뒤)도 같은 방식으로 옮기고, 숫자·기호는 유지한다.`;

const NamesSchema = z.object({
  items: z.array(z.object({ id: z.string(), name_ko: z.string() })),
});

/** [{id, name_en}] → Map(id → name_ko) */
export async function translateNames(client, games) {
  const out = new Map();
  for (const batch of chunks(games, BATCH)) {
    const list = batch.map((g) => `- id=${g.id}: ${g.name_en}`).join('\n');
    const parsed = await parseJson(client, {
      system: NAME_SYSTEM,
      content: `다음 게임 제목을 한국어로. id는 그대로 돌려줘.\n${list}`,
      schema: NamesSchema,
    });
    for (const item of parsed?.items || []) {
      if (item.name_ko?.trim()) out.set(String(item.id), item.name_ko.trim());
    }
  }
  return out;
}

const DESC_SYSTEM = `너는 한국 보드게임 동호회 홈페이지의 번역 담당이다.
BoardGameGeek의 보드게임 소개글을 자연스러운 한국어로 번역한다.
- 내용을 더하거나 빼지 말고, 문단(빈 줄) 구분과 목록 형태를 그대로 유지한다.
- 게임 고유 용어와 카드·자원 이름은 한국어판 용어가 있으면 그것을, 없으면 원어 발음을 한글로 적는다.
- 번역문만 출력한다.`;

/**
 * 용어집(운영진 사전 + 기본 사전)을 설명 번역 지시문에 붙인다.
 * 모든 설명 번역에서 같은 내용이라 프롬프트 캐시가 걸린다.
 * @param glossary [{en, ko}]
 */
export function descriptionSystem(glossary = []) {
  const lines = glossary
    .filter((g) => g.en && g.ko && g.en !== g.ko)
    .map((g) => `${g.en} = ${g.ko}`)
    .sort();
  const text = lines.length
    ? [
      DESC_SYSTEM,
      '- 아래 용어집에 있는 표현은 반드시 용어집의 한국어를 쓴다.',
      '',
      '<용어집>',
      ...lines,
      '</용어집>',
    ].join('\n')
    : DESC_SYSTEM;
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

/** 설명 하나 번역. 실패하면 null. system 은 descriptionSystem(...) 결과 */
export async function translateDescription(client, text, system = descriptionSystem()) {
  if (!text?.trim()) return '';
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: text }],
      output_config: { effort: 'low' },
    });
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return null;
    return res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim() || null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.warn(`Claude API ${e.status}: ${e.message}`);
      return null;
    }
    throw e;
  }
}
