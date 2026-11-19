// BGG XML API2 (bgg-fetch/bgg-fetch.py 를 Apps Script로 옮긴 것)
// 스크립트 속성: BGG_USERNAME, BGG_TOKEN

const BGG_BASE = 'https://boardgamegeek.com/xmlapi2';
const BGG_CHUNK = 20; // thing 호출당 게임 수 (최대 20)

function bggFetch_(path, params) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('BGG_TOKEN');
  const query = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  const url = `${BGG_BASE}/${path}?${query}`;
  for (let i = 0; i < 8; i++) {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: Object.assign(
        { 'User-Agent': 'boardgame-club-sync', Accept: 'application/xml' },
        token ? { Authorization: `Bearer ${token}` } : {}
      ),
    });
    const code = res.getResponseCode();
    if (code === 202) { Utilities.sleep(8000); continue; } // 컬렉션 생성 대기
    if (code === 429) { Utilities.sleep(12000); continue; } // 요청 과다
    if (code !== 200) throw new Error(`BGG ${path} 응답 ${code}`);
    return XmlService.parse(res.getContentText()).getRootElement();
  }
  throw new Error(`BGG ${path} 요청 실패(재시도 초과)`);
}

function bggCollectionIds_() {
  const username = PropertiesService.getScriptProperties().getProperty('BGG_USERNAME');
  if (!username) throw new Error('스크립트 속성 BGG_USERNAME 이 없습니다.');
  const root = bggFetch_('collection', { username, showprivate: 1, version: 2 });
  return root.getChildren('item').map((it) => attr_(it, 'objectid'));
}

function bggThings_(ids) {
  const root = bggFetch_('thing', { id: ids.join(','), stats: 1 });
  return root.getChildren('item').map(parseThing_);
}

// ---------- 파싱 ----------
function attr_(el, name) {
  const a = el && el.getAttribute(name);
  return a ? a.getValue() : '';
}

function childValue_(el, name) {
  return attr_(el && el.getChild(name), 'value');
}

function fmt_(x, digits) {
  const n = parseFloat(x);
  return isFinite(n) ? n.toFixed(digits) : '';
}

const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', bull: '•', middot: '·', times: '×',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', aacute: 'á', agrave: 'à', acirc: 'â', auml: 'ä',
  iacute: 'í', igrave: 'ì', iuml: 'ï', oacute: 'ó', ograve: 'ò', ocirc: 'ô', ouml: 'ö',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ', szlig: 'ß',
  Eacute: 'É', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', deg: '°', copy: '©', reg: '®', trade: '™',
};

function decodeEntities_(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return HTML_ENTITIES[code] != null ? HTML_ENTITIES[code] : m;
  });
}

/** 이중 인코딩된 엔티티까지 풀고 태그 제거 */
function cleanDescription_(text) {
  let s = text || '';
  for (let i = 0; i < 2; i++) s = decodeEntities_(s);
  return s.replace(/<[^>]+>/g, '').trim();
}

function parseThing_(it) {
  const names = it.getChildren('name');
  const primary = names.filter((n) => attr_(n, 'type') === 'primary')[0];
  const nameKoBgg = names.map((n) => attr_(n, 'value')).filter((v) => /[가-힣]/.test(v))[0] || '';

  const ratings = it.getChild('statistics') && it.getChild('statistics').getChild('ratings');
  const ranks = ratings && ratings.getChild('ranks') ? ratings.getChild('ranks').getChildren('rank') : [];
  const boardRank = ranks.filter((r) => attr_(r, 'name') === 'boardgame')[0];
  let rank = attr_(boardRank, 'value');
  if (!rank || rank === 'Not Ranked') rank = 'N/A';

  const links = it.getChildren('link');
  const pick = (type) => links.filter((l) => attr_(l, 'type') === type).map((l) => attr_(l, 'value'));

  const image = it.getChild('image') ? it.getChild('image').getText() : '';
  const thumb = it.getChild('thumbnail') ? it.getChild('thumbnail').getText() : '';

  return {
    id: attr_(it, 'id'),
    name_en: primary ? attr_(primary, 'value') : '',
    name_ko_bgg: nameKoBgg,
    rank,
    rating: fmt_(childValue_(ratings, 'average'), 1),
    mechanics: pick('boardgamemechanic'),
    categories: pick('boardgamecategory'),
    weight: fmt_(childValue_(ratings, 'averageweight'), 2),
    min_players: childValue_(it, 'minplayers'),
    max_players: childValue_(it, 'maxplayers'),
    min_time: childValue_(it, 'minplaytime'),
    max_time: childValue_(it, 'maxplaytime'),
    has_expansion: links.some((l) => attr_(l, 'type') === 'boardgameexpansion') ? 'Yes' : 'No',
    description: cleanDescription_(it.getChild('description') ? it.getChild('description').getText() : ''),
    image: (image || thumb || '').trim(),
  };
}
