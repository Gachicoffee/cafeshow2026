// 카페쇼 준비 코치 — 체크리스트에서 누른 완료 표시를 '일정표' 시트의 상태 칸에 써 준다.
// 구글 시트 > 확장 프로그램 > Apps Script 에 이 파일 내용을 그대로 붙여 넣고 웹 앱으로 배포한다.
// 받는 값: no(작업 번호, 숫자) / status('완료' 또는 '대기')만. 다른 값은 무시한다.
function doPost(e) {
  const p = (e && e.parameter) || {};
  const no = String(p.no || '').trim();
  const status = String(p.status || '').trim();
  if (!/^\d+$/.test(no) || ['완료', '대기'].indexOf(status) < 0) return out('bad request');

  const sh = SpreadsheetApp.getActive().getSheetByName('일정표');
  if (!sh) return out('no sheet');
  const v = sh.getDataRange().getValues();
  // 머리글 줄: '구분'이나 '작업'이 있는 첫 줄
  const hr = v.findIndex(r => r.some(c => ['구분', '작업'].indexOf(String(c).trim()) >= 0));
  if (hr < 0) return out('no header');
  let col = v[hr].map(c => String(c).trim()).indexOf('상태');
  if (col < 0) col = 8; // 머리글이 비어 있으면 기본 열 순서(No, 구분, 작업, 담당, 시작, 마감, 선행, 산출물, 상태)

  for (let i = hr + 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === no) {
      sh.getRange(i + 1, col + 1).setValue(status);
      return out('ok');
    }
  }
  return out('not found');
}
function out(s) { return ContentService.createTextOutput(s); }
