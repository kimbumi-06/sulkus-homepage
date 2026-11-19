// Apps Script 서비스 흉내 (테스트용, 메모리 안에서만 동작)

class FakeRange {
  constructor(sheet, row, col, rows, cols) {
    Object.assign(this, { sheet, row, col, rows, cols });
  }
  cells(fn) {
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => fn(this.row + r, this.col + c)));
  }
  getValues() { return this.cells((r, c) => this.sheet.get(r, c)); }
  getDisplayValues() { return this.cells((r, c) => String(this.sheet.get(r, c) ?? '')); }
  setValues(values) {
    if (values.length !== this.rows || values.some((v) => v.length !== this.cols)) {
      throw new Error(`범위 크기 불일치 ${values.length}x${values[0]?.length} vs ${this.rows}x${this.cols}`);
    }
    values.forEach((row, r) => row.forEach((v, c) => this.sheet.set(this.row + r, this.col + c, v)));
    return this;
  }
  setValue(v) { this.sheet.set(this.row, this.col, v); return this; }
  clearContent() { this.cells((r, c) => this.sheet.set(r, c, '')); return this; }
  setBackground() { return this; }
  setFontWeight() { return this; }
  protect() { return { setDescription() { return this; }, setWarningOnly() { return this; } }; }
}

class FakeSheet {
  constructor(name, id) { this.name = name; this.id = id; this.data = new Map(); this.hidden = false; }
  key(r, c) { return `${r},${c}`; }
  get(r, c) { return this.data.get(this.key(r, c)) ?? ''; }
  set(r, c, v) { if (v === '' || v == null) this.data.delete(this.key(r, c)); else this.data.set(this.key(r, c), v); }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  getRange(row, col, rows = 1, cols = 1) { return new FakeRange(this, row, col, rows, cols); }
  getLastRow() { return Math.max(0, ...[...this.data.keys()].map((k) => Number(k.split(',')[0]))); }
  getLastColumn() { return Math.max(0, ...[...this.data.keys()].map((k) => Number(k.split(',')[1]))); }
  getMaxRows() { return 1000; }
  setFrozenRows() {}
  hideSheet() { this.hidden = true; }
  hideColumns() {}
  setColumnWidth() {}
  setColumnWidths() {}
  clearContents() { this.data.clear(); }
}

export function createFakes({ editors = ['owner@club.kr'], bgg, claude, tokens = {} } = {}) {
  const sheets = new Map();
  let nextId = 1;
  const spreadsheet = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => { const s = new FakeSheet(n, nextId++); sheets.set(n, s); return s; },
    getId: () => 'SHEET123',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/SHEET123/edit',
    getEditors: () => editors.map((e) => ({ getEmail: () => e })),
    getOwner: () => ({ getEmail: () => editors[0] }),
    toast() {},
  };
  let active = spreadsheet;

  const props = new Map();
  const cache = new Map();
  const triggers = [];
  const log = { claude: [], bgg: [] };

  const response = (code, text, headers = {}) => ({
    getResponseCode: () => code,
    getContentText: () => text,
    getHeaders: () => headers,
  });

  const fetchOne = (url, opts = {}) => {
    if (url.startsWith('https://boardgamegeek.com/')) {
      log.bgg.push(url);
      return bgg(url);
    }
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      const tok = decodeURIComponent(url.split('id_token=')[1]);
      const info = tokens[tok];
      return info ? response(200, JSON.stringify(info)) : response(400, '{"error":"invalid_token"}');
    }
    if (url === 'https://api.anthropic.com/v1/messages') {
      const body = JSON.parse(opts.payload);
      log.claude.push({ body, headers: opts.headers });
      return claude(body);
    }
    throw new Error(`예상 못 한 요청 ${url}`);
  };

  const services = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => active,
      openById: (id) => { if (id !== 'SHEET123') throw new Error('no sheet'); return spreadsheet; },
      getUi: () => ({
        createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => {} }; return m; },
        alert: () => 'OK', ButtonSet: { OK_CANCEL: 1, OK: 0 }, Button: { OK: 'OK' },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, String(v)),
        deleteProperty: (k) => props.delete(k),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => cache.set(k, v),
        putAll: (o) => Object.entries(o).forEach(([k, v]) => cache.set(k, v)),
        getAll: (keys) => Object.fromEntries(keys.filter((k) => cache.has(k)).map((k) => [k, cache.get(k)])),
        remove: (k) => cache.delete(k),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ScriptApp: {
      newTrigger: (fn) => {
        const t = { fn, getHandlerFunction: () => fn };
        const b = { timeBased: () => b, after: () => b, everyMinutes: () => b, create: () => { triggers.push(t); return t; } };
        return b;
      },
      getProjectTriggers: () => [...triggers],
      deleteTrigger: (t) => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); },
    },
    UrlFetchApp: {
      fetch: fetchOne,
      fetchAll: (reqs) => reqs.map((r) => fetchOne(r.url, r)),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    Session: { getActiveUser: () => ({ getEmail: () => editors[0] }) },
  };

  return {
    services, sheets, props, cache, triggers, log, response,
    // 웹 앱/트리거처럼 "열린 시트"가 없는 상황 흉내
    detach: () => { active = null; },
    attach: () => { active = spreadsheet; },
  };
}
