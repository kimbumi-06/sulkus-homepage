// 스프레드시트 메뉴, 처음 설정, 수정 자동 반영

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sulkus')
    .addItem('BGG 동기화 (가져오기 + 번역 + 반영)', 'menuSync')
    .addItem('수정 내용 사이트에 반영', 'menuPublish')
    .addItem('진행 상황 보기', 'menuStatus')
    .addSeparator()
    .addItem('처음 설정 (시트·자동 반영 만들기)', 'setup')
    .addToUi();
}

/** 운영진이 노란 열을 고치면 표시만 해두고, 5분마다 autoPublish 가 반영 */
function onEdit(e) {
  const name = e && e.range && e.range.getSheet().getName();
  if (name !== SHEET.games && name !== SHEET.terms) return;
  PropertiesService.getScriptProperties().setProperty('DIRTY', '1');
}

/** 시간 트리거 (5분마다) */
function autoPublish() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('DIRTY') !== '1') return;
  if (isRunning_(loadJob_())) return; // 동기화가 끝나면서 어차피 반영됨
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    publish_();
  } finally {
    lock.releaseLock();
  }
}

function menuSync() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert(
    'BGG 동기화',
    'BGG에서 목록을 새로 가져오고, 번역 안 된 것을 AI로 번역해서 사이트 데이터를 덮어써요.\n' +
      '처음엔 몇 분 걸리고, 시간이 모자라면 1분 뒤 자동으로 이어서 진행돼요. 진행할까요?',
    ui.ButtonSet.OK_CANCEL
  );
  if (ok !== ui.Button.OK) return;
  const status = startSync_(Session.getActiveUser().getEmail(), SLICE_MS);
  ss_().toast(status.job ? status.job.message : '', 'BGG 동기화', 10);
}

function menuPublish() {
  const count = publish_();
  ss_().toast(`게임 ${count}개 반영 완료`, '사이트에 반영', 5);
}

function menuStatus() {
  const s = getStatus_();
  const j = s.job;
  const lines = [
    j ? `동기화: ${j.state} · ${j.message}${j.error ? `\n오류: ${j.error}` : ''}` : '동기화한 적 없음',
    `마지막 반영: ${s.publishedAt || '없음'}`,
    s.pendingEdits ? '반영 안 된 수정 있음 (5분 안에 자동 반영)' : '',
  ].filter(Boolean);
  SpreadsheetApp.getUi().alert('진행 상황', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

/** 처음 한 번: 시트 만들기 + 서식 + 자동 반영 트리거 */
function setup() {
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss_().getId());
  const games = ensureSheet_(SHEET.games, GAME_HEADERS, false);
  const terms = ensureSheet_(SHEET.terms, TERM_HEADERS, false);
  ensureSheet_(SHEET.bgg, ['BGG ID', '데이터(JSON)'], true);
  ensureSheet_(SHEET.bggTmp, ['BGG ID', '데이터(JSON)'], true);
  ensureSheet_(SHEET.published, null, true);

  // 운영진이 고치는 열: 노란색
  const yellow = '#FFF2B3';
  games.getRange(1, G.nameKoEdit, games.getMaxRows(), 2).setBackground(yellow);
  terms.getRange(1, T.koEdit, terms.getMaxRows(), 2).setBackground(yellow);
  games.getRange(1, 1, 1, GAME_HEADERS.length).setBackground('#FFD54F');
  terms.getRange(1, 1, 1, TERM_HEADERS.length).setBackground('#FFD54F');
  games.setColumnWidths(1, GAME_HEADERS.length, 160);
  games.setColumnWidth(G.descKoEdit, 360);
  games.setColumnWidth(G.descKoAuto, 360);
  games.setColumnWidth(G.descEn, 360);
  games.hideColumns(G.descHash);
  terms.setColumnWidths(1, TERM_HEADERS.length, 150);
  terms.setColumnWidth(T.descEdit, 300);

  // 자동 열을 실수로 고치지 않도록 (경고만)
  [[games, G.nameKoAuto, GAME_HEADERS.length - G.nameKoAuto + 1], [games, 1, 2], [terms, 1, 2], [terms, T.koBase, TERM_HEADERS.length - T.koBase + 1]]
    .forEach(([sh, col, width]) => {
      sh.getRange(1, col, sh.getMaxRows(), width).protect()
        .setDescription('동기화가 채우는 열이에요. 고치려면 노란 열에 쓰세요.')
        .setWarningOnly(true);
    });

  // 5분마다 수정 내용 반영
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'autoPublish')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('autoPublish').timeBased().everyMinutes(5).create();

  ss_().toast('설정 완료. 이제 Sulkus > BGG 동기화를 실행하세요.', 'Sulkus', 8);
}
