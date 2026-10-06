// 카페쇼 체크리스트 — 웹 페이지에서 누른 체크를 이 시트에 써 준다.
// 구글 시트 > 확장 프로그램 > Apps Script 에 이 파일 내용을 그대로 붙여 넣고 '웹 앱'으로 배포한다.
// 받는 값: tab(일정표 | 발주·구매 | 대표 결정사항), no(번호), done('1' 또는 '0'). 다른 값은 무시한다.
//  - 일정표·발주·구매: '상태' 칸을 완료 / 대기로 바꾼다.
//  - 대표 결정사항: 결정 내용 칸이 비어 있을 때만 '결정함'을 쓰고, 체크를 풀면 '결정함'일 때만 지운다(직접 쓴 내용은 건드리지 않음).
const TARGET = {
  '일정표': { head: '상태', fallback: 8 },
  '발주·구매': { head: '상태', fallback: 11 },
  '대표 결정사항': { head: '결정 내용(입력)', fallback: 5 },
};
const MARK = '결정함';

function doPost(e) {
  const p = (e && e.parameter) || {};
  const tab = String(p.tab || ''), no = String(p.no || '').trim(), done = p.done === '1';
  const t = TARGET[tab];
  if (!t || !/^\d+$/.test(no) || ['0', '1'].indexOf(p.done) < 0) return out('bad request');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(tab);
    if (!sh) return out('no sheet');
    const v = sh.getDataRange().getValues();
    // 머리글 줄: 첫 칸이 'No'인 줄
    const hr = v.findIndex(r => String(r[0]).trim() === 'No');
    if (hr < 0) return out('no header');
    let col = v[hr].map(c => String(c).trim()).indexOf(t.head);
    if (col < 0) col = t.fallback;

    for (let i = hr + 1; i < v.length; i++) {
      if (String(v[i][0]).trim() !== no) continue;
      const cell = sh.getRange(i + 1, col + 1), now = String(cell.getValue()).trim();
      if (tab === '대표 결정사항') {
        if (done && !now) cell.setValue(MARK);
        if (!done && now === MARK) cell.setValue('');
      } else {
        cell.setValue(done ? '완료' : '대기');
      }
      return out('ok');
    }
    return out('not found');
  } finally {
    lock.releaseLock();
  }
}
function out(s) { return ContentService.createTextOutput(s); }
