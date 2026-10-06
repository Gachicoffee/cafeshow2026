// 카페쇼 체크리스트 — 웹 페이지에서 보낸 체크·메모·첨부·결정 내용을 이 시트(와 드라이브)에 저장한다.
// 구글 시트 > 확장 프로그램 > Apps Script 에 이 파일 내용을 그대로 붙여 넣고 '웹 앱'으로 배포한다.
// 코드를 바꾸면 배포 > 배포 관리 > 연필 > 버전 '새 버전' > 배포 (주소는 그대로).
//
// POST action (없으면 check):
//  - check : tab(일정표 | 발주·구매 | 대표 결정사항), no, done('1'|'0')
//            일정표·발주·구매는 '상태'를 완료/대기로. 대표 결정사항은 결정 내용이 비어 있을 때만 '결정함'을 쓰고, 풀면 '결정함'일 때만 지운다.
//  - decide: no, text → 대표 결정사항의 '결정 내용(입력)' 칸에 그대로 쓴다.
//  - note  : key(P1·T5·D2·O7 같은 항목 번호), author, text, ask('1'이면 클로드에게 요청) → '메모' 탭에 한 줄 추가.
//  - upload: note와 같고 name, mime, data(base64)를 더 받아 드라이브 '카페쇼2026_첨부' 폴더에 저장하고 링크를 남긴다.
//            파일은 공유 설정을 바꾸지 않는다(소유자와 폴더를 공유받은 사람만 열 수 있음).
//  - reply : row(요청이 적힌 '메모' 탭 줄 번호), text, [name, mime, data] → 같은 항목에 작성자 '클로드'로 답을 남기고 요청을 '완료'로 바꾼다.
// GET:
//  - (없음)          : 연결 확인 문장
//  - action=requests : '요청 상태'가 '대기'인 메모 목록(JSON) — 클로드 정기 확인용
const TARGET = {
  '일정표': { head: '상태', fallback: 8 },
  '발주·구매': { head: '상태', fallback: 11 },
  '대표 결정사항': { head: '결정 내용(입력)', fallback: 5 },
};
const MARK = '결정함';
const NOTE_TAB = '메모';
const NOTE_HEAD = ['시각', '항목', '작성자', '내용', '파일명', '파일 링크', '요청 상태'];
const ASK_COL = 7; // '요청 상태' 칸 (G)
const FOLDER = '카페쇼2026_첨부';
const MAX_BYTES = 10 * 1024 * 1024;
const VERSION = 4;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'requests') return json(requests());
  const ss = SpreadsheetApp.getActive();
  return out(`가치커피 카페쇼 체크 저장 · 버전 ${VERSION} · 연결된 시트: ${ss ? ss.getName() : '없음(시트의 확장 프로그램 메뉴에서 만든 스크립트가 아님)'}`);
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (p.action || 'check') {
      case 'check': return out(check(p));
      case 'decide': return out(decide(p));
      case 'note': return out(note(p, '', ''));
      case 'upload': return out(upload(p));
      case 'reply': return out(reply(p));
      default: return out('bad action');
    }
  } finally {
    lock.releaseLock();
  }
}
function out(s) { return ContentService.createTextOutput(s); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// 표에서 번호(no)가 있는 줄의 칸을 찾는다
function findCell(tab, no) {
  const t = TARGET[tab];
  if (!t || !/^\d+$/.test(String(no))) return null;
  const sh = SpreadsheetApp.getActive().getSheetByName(tab);
  if (!sh) return null;
  const v = sh.getDataRange().getValues();
  const hr = v.findIndex(r => String(r[0]).trim() === 'No');
  if (hr < 0) return null;
  let col = v[hr].map(c => String(c).trim()).indexOf(t.head);
  if (col < 0) col = t.fallback;
  for (let i = hr + 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === String(no)) return sh.getRange(i + 1, col + 1);
  }
  return null;
}

function check(p) {
  if (['0', '1'].indexOf(p.done) < 0) return 'bad request';
  const cell = findCell(String(p.tab || ''), String(p.no || '').trim());
  if (!cell) return 'not found';
  const done = p.done === '1', now = String(cell.getValue()).trim();
  if (p.tab === '대표 결정사항') {
    if (done && !now) cell.setValue(MARK);
    if (!done && now === MARK) cell.setValue('');
  } else {
    cell.setValue(done ? '완료' : '대기');
  }
  return 'ok';
}

function decide(p) {
  const text = String(p.text || '').trim().slice(0, 1000);
  const cell = findCell('대표 결정사항', String(p.no || '').trim());
  if (!cell) return 'not found';
  cell.setValue(text);
  return 'ok';
}

function noteSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(NOTE_TAB);
  if (!sh) {
    sh = ss.insertSheet(NOTE_TAB);
    sh.appendRow(NOTE_HEAD);
    sh.setFrozenRows(1);
  } else if (String(sh.getRange(1, ASK_COL).getValue()).trim() !== NOTE_HEAD[ASK_COL - 1]) {
    sh.getRange(1, ASK_COL).setValue(NOTE_HEAD[ASK_COL - 1]); // 버전 3에서 만든 탭에 칸을 더한다
  }
  return sh;
}

// 시트가 수식으로 읽지 않도록 맨 앞의 = + - @ 는 막는다
function safe(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }

function note(p, fileName, fileUrl) {
  const key = String(p.key || '').trim();
  if (!/^[PTDO]\d+$/.test(key)) return 'bad key';
  const text = String(p.text || '').trim().slice(0, 2000);
  if (!text && !fileUrl) return 'empty';
  const author = String(p.author || '').trim().slice(0, 20) || '익명';
  const when = Utilities.formatDate(new Date(), 'Asia/Seoul', 'M/d HH:mm');
  noteSheet().appendRow([when, key, safe(author), safe(text), safe(fileName), fileUrl, p.ask === '1' ? '대기' : '']);
  return 'ok';
}

function saveFile(p, key) {
  const name = String(p.name || '첨부').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
  const bytes = Utilities.base64Decode(String(p.data || ''));
  if (!bytes.length) return null;
  if (bytes.length > MAX_BYTES) throw new Error('too big');
  const it = DriveApp.getFoldersByName(FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER);
  const file = folder.createFile(Utilities.newBlob(bytes, String(p.mime || 'application/octet-stream'), `${key}_${name}`));
  return { name, url: file.getUrl() };
}

function upload(p) {
  try {
    const f = saveFile(p, String(p.key || ''));
    if (!f) return 'empty';
    return note(p, f.name, f.url);
  } catch (err) {
    return 'too big';
  }
}

function requests() {
  const sh = noteSheet();
  const v = sh.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][ASK_COL - 1]).trim() !== '대기') continue;
    list.push({ row: i + 1, when: String(v[i][0]), key: String(v[i][1]), author: String(v[i][2]), text: String(v[i][3]), fileName: String(v[i][4]), fileUrl: String(v[i][5]) });
  }
  return { version: VERSION, requests: list };
}

function reply(p) {
  const sh = noteSheet();
  const row = parseInt(p.row, 10);
  if (!(row >= 2 && row <= sh.getLastRow())) return 'bad row';
  const key = String(sh.getRange(row, 2).getValue()).trim();
  let f = null;
  try { if (p.data) f = saveFile(p, key); } catch (err) { return 'too big'; }
  const r = note({ key: key, author: '클로드', text: p.text }, f ? f.name : '', f ? f.url : '');
  if (r !== 'ok') return r;
  sh.getRange(row, ASK_COL).setValue('완료');
  return 'ok';
}
