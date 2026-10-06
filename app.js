// 카페쇼 준비 코치 — 구글 시트(링크 공개)를 읽어 오늘 할 일·결정·발주를 계산해 보여 준다.
const SHEET_ID = '1k2p3E9k6aNp3Zin-Zr7HOYkKXoKEEIcuhxapFbPHEmU';
// 체크 표시를 시트 '상태' 칸에 써 주는 Apps Script 웹 앱 주소 (apps-script/체크저장.gs). 비어 있으면 이 브라우저에만 저장
const SAVE_URL = '';
const YEAR = 2026;
const SHOW = d(11, 11), READY = d(10, 25), ARRIVE = d(10, 17);

function d(m, day) { return new Date(YEAR, m - 1, day); }
const DAY = 86400000;
function today() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
function diff(a, b) { return Math.round((a - b) / DAY); }
function parseDate(s) { const m = String(s || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/); return m ? d(+m[1], +m[2]) : null; }
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function fmt(dt) { return `${dt.getMonth() + 1}/${dt.getDate()}(${WD[dt.getDay()]})`; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------- CSV ----------
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
// 시트가 날짜·숫자 열의 머리글을 비워 보내므로, 비어 있으면 기본 열 이름을 쓴다
const COLS = {
  '일정표': ['No', '구분', '작업', '담당', '시작', '마감', '선행', '산출물', '상태', '메모'],
  '대표 결정사항': ['No', '결정 항목', '고려할 점', '영향받는 작업', '결정 마감', '결정 내용(입력)'],
  '발주·구매': ['No', '구분', '품목', '컨셉 키워드', '수량', '업체/구매처', '리드타임(일)', '입고 목표일', '발주 마감', '남은 일수', '담당', '상태', '메모'],
};
function table(rows, name) {
  const def = COLS[name];
  const hi = rows.findIndex(r => r.some(c => def.slice(1, 3).includes(c.trim())));
  const head = (rows[hi] || []).map((x, i) => x.trim() || def[i] || '');
  return rows.slice(hi + 1).filter(r => /^\d+$/.test((r[0] || '').trim()))
    .map(r => Object.fromEntries(def.map((k, i) => [k, (r[head.indexOf(k) >= 0 ? head.indexOf(k) : i] || '').trim()])));
}
async function sheet(name) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(name)}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status);
  const t = await r.text();
  if (t.trim().startsWith('<')) throw new Error('not public');
  return table(parseCSV(t), name);
}

// ---------- 시트 연결 전 보여 줄 스냅샷 (10/4 기준) ----------
const SNAP = {
  tasks: [
    [1, '0. 준비·관리', '주최측 참가업체 매뉴얼에서 제출 마감 확인 (부스 도면·전기·급수·간판 문구·출입증 등)', '공동', '10/3', '10/3', '', '마감일 목록', '대기', '상단 로고는 제출완료 / 급배수 안전 서약서 제출요망'],
    [2, '0. 준비·관리', '마스터 일정 확정 (이 파일)', '공동', '10/3', '10/3', '', '확정 일정', '대기', ''],
    [4, '1. 경험 플로우', '경험 플로우 초안 (호객→착석·상차림→시음→리필→구매→굿즈→퇴장)', '하빈', '10/3', '10/3', '', '플로우 1장', '대기', ''],
    [34, '6. 부스 디자인', '부스 레이아웃 초안 (3×2m 동선·소반/좌판 배치·장비·세척 위치)', '하빈', '10/4', '10/4', '1', '도면 초안', '대기', ''],
    [24, '4. 업체 발주', '업체 리드타임·견적 조사 (인쇄·간판·출력·커스텀 보자기/상보)', '하빈', '10/4', '10/4', '', "'발주·구매' 시트 리드타임 입력", '대기', '리드타임 확인 후 발주일 자동 계산'],
    [30, '5. 소품 구매', "소품 리스트·수량 작성 ('발주·구매' 시트)", '하빈', '10/4', '10/4', '', '리스트', '대기', ''],
    [31, '5. 소품 구매', '샘플 구매 (소반·흰 사기잔·상보 1~2개씩)', '하빈', '10/4', '10/4', '30', '샘플 주문', '대기', '실물로 크기·톤 확인'],
    [3, '0. 준비·관리', '전체 예산 범위 확정', '지형(대표)', '10/5', '10/6', '', '예산 상한', '대기', '소품·인쇄 수량 결정의 전제'],
    [5, '1. 경험 플로우', '플로우 운영 검토 (인원·회전율·리필·세척 가능 여부)', '지형(대표)', '10/5', '10/6', '4', '검토 의견', '대기', ''],
    [9, '2. 원두·메뉴', '제공 원두·블렌드 확정 (한상 구성, 구수 포함)', '지형(대표)', '10/5', '10/6', '', '원두 목록·향미 노트', '대기', ''],
    [10, '2. 원두·메뉴', '구수 라떼 레시피·우유·필요 장비 확정', '지형(대표)', '10/5', '10/6', '', '레시피·장비 목록', '대기', '전기 용량 신청과 연결'],
    [11, '2. 원두·메뉴', '판매 품목·가격·혜택 확정 (드립백, 원두 배송, 추가식권/할인코드, 백반 0원 정책)', '지형(대표)', '10/5', '10/6', '3', '가격표 원고', '대기', ''],
    [35, '6. 부스 디자인', '장비·전기·급수 신청 (주최측)', '지형(대표)', '10/5', '10/6', '10,34', '신청 완료', '대기', '마감은 매뉴얼 확인값 우선'],
    [39, '7. 추가(놓친 항목)', '위생·세척 계획 (흰 사기잔 + 리필 → 세척 동선·급수)', '지형(대표)', '10/5', '10/6', '', '세척 방식 결정', '대기', '급수 불가 시 사기잔 수량·회수 방식 재검토'],
    [12, '2. 원두·메뉴', '원산지·향미 정보 원고 전달 (차림표·원산지 표시판용)', '지형(대표)', '10/7', '10/7', '9', '원고 텍스트', '대기', '하빈 10/9 디자인 착수용'],
    [6, '1. 경험 플로우', '[게이트1] 플로우·메뉴·원두 확정 회의', '공동', '10/7', '10/7', '5,9,10,11', '확정안', '대기', '이후 디자인 본작업 착수'],
    [16, '3. 디자인물', '디자인물 목록·사양 확정 (사이즈·재질·수량)', '하빈', '10/8', '10/9', '6', '사양표', '대기', ''],
    [32, '5. 소품 구매', '샘플 확인 후 본구매 (결제 승인은 대표)', '하빈', '10/8', '10/9', '31,3', '주문 완료', '대기', ''],
    [41, '7. 추가(놓친 항목)', "'오늘 차려 낸 상' 집계 방식 결정 (실시간 카운트 방법)", '공동', '10/8', '10/8', '', '집계 방식', '대기', '표시 숫자는 실제 집계값만 사용'],
    [17, '3. 디자인물', '1차 디자인: 손글씨 차림표·원산지 표시판·메뉴판(백반 0원)·손글씨 가격표·식권', '하빈', '10/9', '10/11', '12,16', '1차 시안', '대기', ''],
    [18, '3. 디자인물', '1차 디자인: 부스 그래픽 (상부 간판·벽면)', '하빈', '10/9', '10/11', '1,16', '1차 시안', '대기', '주최측 사양 확인 필수'],
    [36, '6. 부스 디자인', '부스 디자인 시안 (렌더·컬러·소재)', '하빈', '10/9', '10/11', '6', '시안', '대기', ''],
    [25, '4. 업체 발주', '커스텀 제작물 발주 (로고 보자기·상보 등 리드타임 긴 품목)', '하빈', '10/10', '10/11', '16,24', '발주 완료', '대기', '리드타임에 따라 더 당겨질 수 있음'],
    [37, '6. 부스 디자인', '주최측 도면·디자인 제출', '하빈', '10/11', '10/11', '36', '제출 완료', '대기', '실제 마감일로 수정'],
    [7, '1. 경험 플로우', '운영 대본·역할 배치 (4일 교대 포함)', '지형(대표)', '10/12', '10/14', '6', '대본·역할표', '대기', ''],
    [13, '2. 원두·메뉴', '4일 소요량 산정 및 로스팅·드립백 생산 계획', '지형(대표)', '10/12', '10/14', '6', '생산 계획표', '대기', ''],
    [14, '2. 원두·메뉴', '현장 결제·배송 주문 프로세스 (주문서, 배송비, 발송일, 결제 단말기)', '지형(대표)', '10/12', '10/14', '11', '주문서 양식·발송 계획', '대기', '주소 수집 → 개인정보 동의 문구 필요'],
    [19, '3. 디자인물', '1차 시안 피드백', '지형(대표)', '10/12', '10/13', '17,18', '피드백', '대기', ''],
  ].map(r => ({ No: '' + r[0], 구분: r[1], 작업: r[2], 담당: r[3], 시작: r[4], 마감: r[5], 선행: r[6], 산출물: r[7], 상태: r[8], 메모: r[9] })),
  decisions: [
    ['1', '한상 구성 원두·블렌드 (몇 종, 무엇)', '시음 회전율, 리필 무료 시 소요량', '차림표·원산지 표시판·가격표', '10/7', ''],
    ['2', '메인 메뉴 구수 라떼 운영 여부·레시피', '에스프레소 머신·그라인더·우유 냉장 → 전기 용량, 부스 공간', '장비·전기 신청, 부스 레이아웃', '10/7', ''],
    ['3', '리필 무료 범위 (무엇을, 몇 번까지)', '소요량·회전율·세척 부담', '메뉴판, 대본', '10/7', ''],
    ['4', "'메뉴판-백반 0원'의 의미 (전부 무료 시음인지)", '무료 범위와 판매 품목 경계', '메뉴판·가격표', '10/7', ''],
    ['5', '판매 가격·혜택 (드립백, 원두 배송 결제, 추가식권/할인코드)', '현장 결제·후배송 시 발송일 약속, 배송비', '가격표·식권·주문서', '10/7', ''],
    ['6', '사기잔 사용 범위 (전량 사기잔 vs 일부 일회용)', '세척 동선·급수 가능 여부, 파손 여분', '소품 수량, 부스 레이아웃', '10/7', ''],
    ['7', '예산 상한', '소품·인쇄·제작물 수량', '발주·구매 전체', '10/7', ''],
    ['8', '4일 인력 배치·여수 매장 운영', '비즈니스데이 B2B 대응 인원', '근무표·숙박', '10/14', ''],
  ].map(r => ({ No: r[0], '결정 항목': r[1], '고려할 점': r[2], '영향받는 작업': r[3], '결정 마감': r[4], '결정 내용(입력)': r[5] })),
  orders: [
    ['1', '업체 발주', '부스 상부 간판·벽면 그래픽 출력', '메쎄바우 / 031-913-8077', '', '10/25', '하빈', '대기', '주최측 사양 확인'],
    ['2', '업체 발주', '손글씨 차림표', '', '', '10/22', '하빈', '대기', ''],
    ['3', '업체 발주', '원산지 표시판', '', '', '10/22', '하빈', '대기', ''],
    ['4', '업체 발주', '메뉴판 (백반 0원)', '', '', '10/22', '하빈', '대기', ''],
    ['5', '업체 발주', '식권 / 추가식권(추가 할인코드)', '', '', '10/22', '하빈', '대기', ''],
    ['6', '업체 발주', '아카이브 노트 (여수 맛집 비밀장 + 브랜드 소개)', '', '', '10/22', '하빈', '대기', ''],
    ['7', '업체 발주', '커스텀 보자기 (로고 인쇄 시)', '', '', '10/22', '하빈', '대기', "기성품 사용 시 '구매'로 변경"],
    ['8', '업체 발주', '커스텀 물티슈 (로고 인쇄 시)', '', '', '10/22', '하빈', '대기', "기성품 사용 시 '구매'로 변경"],
    ['9', '업체 발주', 'B2B 납품 안내물·명함', '', '', '10/22', '하빈', '대기', ''],
    ['10', '업체 발주', '배송 주문서 양식', '', '', '10/22', '하빈', '대기', '개인정보 동의 문구 포함'],
    ['11', '구매', '소반 (나무 테이블)', '', '', '10/22', '하빈', '대기', '샘플 먼저'],
    ['12', '구매', '상보 (반상 덮개)', '', '', '10/22', '하빈', '대기', '샘플 먼저'],
    ['13', '구매', '흰 사기잔', '', '', '10/22', '하빈', '대기', '파손 여분 포함'],
    ['15', '구매', '나무 상자 (장터 좌판)', '', '', '10/22', '하빈', '대기', ''],
    ['17', '구매', '보자기 (기성품)', '', '', '10/22', '하빈', '대기', ''],
    ['18', '구매', "'오늘 차려 낸 상' 집계 보드", '', '', '10/22', '하빈', '대기', '집계 방식 결정 후'],
    ['19', '구매', '결제 단말기 확인/대여', '', '', '10/22', '지형(대표)', '대기', ''],
    ['20', '구매', '세척 도구·소모품 (리필용)', '', '', '10/22', '지형(대표)', '대기', ''],
  ].map(r => ({ No: r[0], 구분: r[1], 품목: r[2], '업체/구매처': r[3], '리드타임(일)': r[4], '입고 목표일': r[5], 담당: r[6], 상태: r[7], 메모: r[8] })),
};

// ---------- 도움말 (작업 이름의 낱말로 연결) ----------
const HELP = [
  { m: /매뉴얼|제출 마감/, t: '주최측 마감은 이미 확인해 두었어요.', li: ['부대시설 일반 접수는 9/30에 끝남 → 1차 특별접수 10/27~31(1.5배), 급배수는 추가 불가', '부스 추가옵션(메쎄바우) 10/28까지', '반입 11/10(화) 12~20시, 차량은 16시까지 / 11/9 입장 불가', '모바일 초청장 60장 11/14까지 발송', '<b>급배수 안전사용 서약서</b> 제출 여부를 꼭 확인'] },
  { m: /마스터 일정/, t: '이 페이지가 그 일정을 매일 읽어 알려 줘요.', li: ['시트의 시작·마감·상태만 정확하면 돼요', '끝난 일은 상태 칸에 "완료"'] },
  { m: /경험 플로우 초안|플로우 운영 검토/, t: '준비 문서 "메인 프로그램" 탭에 플로우가 이미 있어요. 검토할 때 볼 숫자:', li: ['소반 4개 · 3인 착석이면 동시 최대 약 12명', '한 상 1~1.5분 가정 → 하루 약 300~350상(기획서 추정)', '리필은 4종 중 1회(문서 결정 사항)', '바쁜 손님은 구수 라떼만 테이크아웃(문서 분기)'] },
  { m: /레이아웃|도면 초안/, t: '부스는 가로 3m × 깊이 2m, 벽 높이 2.44m예요.', li: ['앞쪽 통로 쪽에 소반(손님), 뒤쪽 벽에 추출·세척대', '줄은 부스 벽을 따라 한쪽으로만 (옆 CA106·CA108 앞을 막지 않게)', '콘센트 2구 위치와 급배수 위치(트렌치 도면) 먼저 확인', '인포데스크 1개(1000×600)는 기본 제공 → 계산대로 쓰기'] },
  { m: /리드타임|견적 조사/, t: '리드타임을 "발주·구매" 시트에 숫자로 적으면 여기 발주 타이머가 자동으로 마감일을 계산해요.', li: ['인쇄물은 보통 디자인 확정 후 3~5일, 커스텀 보자기·상보는 1~2주를 먼저 확인', '견적은 2곳 이상 받아 메모 칸에'] },
  { m: /소품 리스트|샘플 구매|본구매/, t: '샘플로 확인할 것', li: ['소반: 부스 폭 3m에 4개가 들어가는지(개당 폭 약 60cm 이하)', '사기잔: 1oz 시음량이 보기 좋게 담기는지, 이너컵(1회용 소주잔)이 들어가는지', '상보: 소반을 다 덮는 크기, 걷을 때 사진에 예쁜 색', '기성 보자기 55cm 880원 링크가 문서에 있어요'] },
  { m: /예산/, t: '이미 나간 돈: 부스비 220만원 + 부대시설 44만원(VAT 포함). 준비비는 숙박·교통 빼고 약 200만원으로 이야기했어요.', li: ['인쇄·제작, 소품, 유니폼, 원두·우유·소모품, 촬영으로 나눠 상한만 정하면 하빈이 수량을 정할 수 있어요', '실제 금액은 견적이 나오면 예산 탭에'] },
  { m: /원두·블렌드 확정|한상 구성/, t: '준비 문서 "미결 사항"에 이미 결정이 있어요: 기존 블렌드 + 허브 블렌드, 순서 코스모스 → 허브 → 구수 라떼 → 보통.', li: ['시트의 결정 내용 칸에 옮겨 적으면 끝', '허브 블렌드의 산지·노트를 "제품·원산지 정보" 탭에 채우기'] },
  { m: /구수 라떼|레시피/, t: '전기는 2kW예요. 에스프레소 머신은 그것만으로 2kW를 넘기기 쉬워요.', li: ['추천: 구수 원두로 진한 베이스를 미리 만들어 우유·시럽과 섞어 내기 → 냉장고만 전기 사용', '커피앨리 무상 지원: 오트뮤 우유, 말코닉 X64SD 그라인더, 파라곤 DK4 필터 (사무국 메일로 신청 여부 확인)', '시음 1잔 용량을 먼저 정해야 우유 소요량이 나와요'] },
  { m: /가격|혜택|식권/, t: '정할 것 5개', li: ['드립백 보자기 에디션: 구성(4종), 정가, 현장가', '원두 배송: 현장 결제, 발송일 11/20(문서), 배송비', '추가식권 할인코드: 공통 코드 1개가 관리 쉬움, 사용 기한(예: 12/31)', '"백반 0원" = 시음 전부 무료, 판매는 드립백·원두만', '카드 단말기는 보유'] },
  { m: /장비·전기·급수 신청/, t: '신청은 이미 했어요: 전기 1kW 추가(총 2kW), 급배수 1개소.', li: ['남은 일: 날인 신청서 회신 확인, 급배수 안전사용 서약서', '장비 소비전력 합계가 2,000W를 넘으면 10/27~31 특별접수(1.5배)', '전기포트 하나가 1,500~2,200W라 그것만으로 꽉 차요 → 온수는 보온병·핫워터 디스펜서로'] },
  { m: /위생|세척/, t: '급배수가 있으니 사기잔 세척이 가능해요.', li: ['부스 뒤쪽에 세척통 2개(애벌·헹굼)와 건조망', '피크 시간엔 이너컵(1회용 소주잔) 병행', '폐기물은 전부 가져가야 해요(매뉴얼)'] },
  { m: /원산지·향미|원고/, t: '원산지 표시판 문안 틀', li: ['[원두 이름] 원산지: 나라 / 생산자 / 가공방식', '향미: 노트 3개만 (예: 꽃, 자스민, 복숭아)', '볶은 곳: 전라남도 여수 가치커피', '코스모스·싱글오리진 3종 정보는 문서 "제품·원산지 정보" 탭에 있어요'] },
  { m: /게이트1|확정 회의/, t: '30분 회의 순서 제안', li: ['① 한상 4종 확정 ② 구수 라떼 방식 ③ 리필 범위 ④ "백반 0원" 범위', '⑤ 판매 가격·혜택 ⑥ 사기잔 범위 ⑦ 예산 상한', '결정은 그 자리에서 시트 "대표 결정사항"에 입력'] },
  { m: /디자인물 목록|사양 확정/, t: '사양표 초안 (크기는 제안)', li: ['차림표: A5, 소반마다 1장', '메뉴판(백반 0원): 뒷벽 걸이, A2 정도', '원산지 표시판: A3 또는 나무판', '식권(할인코드): 명함 크기', '아카이브 노트: A6', '부스 벽 디자인 영역: 뒷벽 3000×2440, 옆벽 2000×2440mm'] },
  { m: /집계|차려 낸 상/, t: '숫자는 실제 집계값만 써요(시트 메모).', li: ['가장 쉬운 방법: 손 카운터(클리커)로 세고 정각마다 칠판 갱신', '원하면 이 페이지에 "상 +1" 버튼과 큰 화면 숫자판을 붙일 수 있어요'] },
  { m: /부스 그래픽|상부 간판/, t: '상단 삼각지붕 로고는 이미 제출했어요.', li: ['메쎄바우 켈지 실사 3000×3024mm 54만원(VAT 별도), 현수막 실사 36만원', '신청 마감 10/28, 신청서 날인본을 메쎄바우로 제출', '벽 부착은 아크릴 양면·마스킹 테이프만 가능'] },
  { m: /부스 디자인 시안/, t: '시안에 꼭 들어갈 것', li: ['3초 장면: 상보 덮인 소반이 줄지어 보이는 정면', '뒷벽 메뉴판(백반 0원)과 원산지 표시판 위치', '판매 좌판(나무 상자)과 계산 위치'] },
  { m: /커스텀 제작물/, t: '리드타임이 가장 긴 품목이라 먼저 확정해야 해요.', li: ['로고 인쇄 보자기가 10/17까지 안 되면 기성품 + 스티커로 대체', '상보는 기성 조각보로 충분한지 샘플로 먼저 판단'] },
  { m: /주최측 도면/, t: '커피앨리는 조립식 부스라 별도 도면 제출 의무는 없어요(독립부스만 필수).', li: ['대신 추가옵션(벽 실사·선반 등)을 쓰면 메쎄바우에 10/28까지 신청', '마감일을 10/28로 고쳐도 돼요'] },
  { m: /운영 대본|역할 배치/, t: '현장 3명, 대표님은 자주 이동해요 → 2명 기준으로 짜요.', li: ['상차림 1명(상보·시음·리필), 판매·계산 1명(드립백·원두 주문·식권)', '대표: 호객, 업계 손님 응대(수·목 비즈니스데이)', '대본은 문서 "시뮬레이션 대본" 탭에 이미 초안이 있어요'] },
  { m: /소요량|생산 계획/, t: '기획서 추정치로 시작해요.', li: ['하루 약 300~350상 × 한 상 원두 약 6~7g ≈ 하루 2~2.5kg', '4일 약 9~10kg + 리필·여유 20%', '드립백은 판매 목표 수량을 먼저 정하면 계산돼요', '로스팅은 11/3~7, 신선도 기준으로'] },
  { m: /배송 주문|결제·배송/, t: '구글폼 항목 초안', li: ['이름, 연락처, 주소, 원두·수량, 분쇄 여부', '결제 확인(현장 카드 승인번호 끝 4자리)', '개인정보 동의: "수집 항목(이름·연락처·주소)은 원두 배송에만 쓰며, 발송 완료 후 30일 안에 파기합니다."', '발송일 안내: 11/20 일괄 발송'] },
  { m: /시안 피드백/, t: '피드백할 때 볼 것', li: ['3초 안에 "전라도 커피 한상, 무료"가 읽히는가', '정갈한 톤(나무·흰 사기·조각보)인가, 기사식당처럼 보이지 않는가', '원산지·가격 숫자가 확정값인가'] },
];
function helpFor(text) { return HELP.find(h => h.m.test(text)); }

// ---------- 클로드 의견 (작업 번호별) ----------
// can: 클로드 세션에서 대신 만들어 줄 수 있는 것 / say: 클로드의 한 줄 의견
const CLAUDE = {
  '1': { can: '매뉴얼 PDF를 주시면 마감표로 다시 정리', say: '마감은 planning/행사정보.md에 정리돼 있어요. 남은 건 급배수 안전 서약서 제출 확인 하나예요.' },
  '2': { can: '일정 충돌·선행 관계 점검', say: '이 페이지가 마스터 일정 역할을 해요. 시트의 상태 칸만 관리하면 돼요.' },
  '4': { can: '기획서 "한상 흐름" 6단계로 플로우 1장 초안 작성', say: '기획서 v0.1의 한상 흐름(3초 → 상보 걷기 → 반찬 → 숭늉 → 리필 → 배웅)을 그대로 쓰면 돼요.' },
  '34': { can: '3×2m 부스 배치도 초안(SVG)', say: '줄은 벽에 붙여 세워야 해요(운영 규칙). 옆벽 쪽은 대기줄 자리로 비워 두는 걸 추천해요.' },
  '24': { can: '업체 문의 메시지 문안', say: '커스텀 보자기·상보처럼 리드타임이 긴 것부터 물어보세요.' },
  '30': { can: '소품 수량 계산 엑셀', say: '잔 방식(사기잔/일회용)을 정하기 전에는 잔 수량을 확정할 수 없어요.' },
  '31': { can: '샘플 확인 기준표', say: '종지 잔은 1oz가 보기 좋게 담기는지, 소반은 폭 3m에 몇 개 들어가는지 실물로 확인하세요.' },
  '3': { can: '항목별 예산표 엑셀(인쇄·소품·원두·우유·촬영)', say: '항목별 상한만 정해 주시면 하빈님이 수량을 정할 수 있어요.' },
  '5': { can: '처리량·세척량 계산', say: '추정: 하루 300~350상 × 잔 4개 = 하루 1,200~1,400개 세척. 2명 운영으로는 어려워요 → 일회용 3oz 컵 또는 세척 1명 추가.' },
  '9': { can: '차림표용 향미 노트 문안', say: '"오늘의 상"(요일마다 다른 싱글오리진)을 넣을지와 함께 정해야 해요. 4종이 안 되면 2종을 번갈아 쓰세요.' },
  '10': { can: '장비 소비전력 합계표', say: '에스프레소 머신을 쓰면 2kW가 빠듯해요. 구수 베이스를 미리 추출해 우유와 섞는 방식을 추천해요.' },
  '11': { can: '원가·판매가 엑셀(원가 자료를 주시면)', say: '회의록 기준 드립백 1개 2,500원, "5,000원까지는 낼 만하다"는 의견이 있었어요. 원가 자료는 아직 없어요.' },
  '35': { can: '2kW 전력 계산표', say: '합계가 2,000W를 넘으면 10/27~31 특별접수(1.5배)로 추가해야 해요.' },
  '39': { can: '세척 동선 그림', say: '사기잔 전량은 세척량이 너무 많아요(5번 의견 참고). 사기잔은 진열용 한 상만 쓰는 안을 추천해요.' },
  '12': { can: '원산지 표시판·차림표 원고 초안', say: '생산자 이름(○○ 씨네 커피)은 표시판을 따로 만들지 말고 차림표에 합치세요.' },
  '6': { can: '회의 안건 정리, 결정을 결정사항.md에 기록', say: '이 회의 전에 세부 후보 선택(넣기 11·합치기 3·빼기 3)을 끝내 두면 30분 안에 끝나요.' },
  '16': { can: '디자인물 사양표 엑셀', say: '차림표를 수저 봉투 형태로 할지 먼저 정해야 사양(크기·재질)이 나와요.' },
  '32': { can: '구매처별 비교표', say: '샘플을 확인하고 예산 상한이 정해진 뒤에 결제하세요.' },
  '41': { can: '이 페이지에 "상 +1" 버튼과 큰 숫자판 추가', say: '숫자는 "오늘 차려 드린 상" 하나만 쓰세요. "남은 상"까지 함께 쓰면 헷갈려요.' },
  '17': { can: '차림표·메뉴판(백반 0원) 문구 원고', say: '문구는 클로드가, 손글씨·레이아웃은 일러스트레이터에서 하는 분담이 빨라요.' },
  '18': { can: '벽면 문구와 치수 정리', say: '뒷벽 3000×2440, 옆벽 2000×2440mm. 옆벽은 대기줄 쪽이라 정보를 너무 많이 넣지 마세요.' },
  '36': { can: '시안 체크리스트', say: '3초 장면(상보 덮인 소반 + 움직이는 숫자)이 정면에서 보이는지가 핵심이에요.' },
  '25': { can: '발주 메일 문안', say: '로고 보자기가 10/17까지 안 되면 기성품 + 스티커로 대체하세요.' },
  '37': { can: '추가옵션 신청 항목 정리', say: '커피앨리는 도면 제출 의무가 없어요. 추가옵션은 10/28까지예요.' },
  '7': { can: '스태프 대본·역할표 초안', say: '2명 기준: 찬모(추출) 1 + 상차림(서빙·계산) 1. 주인장은 대표님이 계실 때만 맡아요.' },
  '13': { can: '로스팅·드립백 생산 계획 엑셀', say: '추정: 하루 300~350상 × 한 상 6~7g ≈ 하루 2~2.5kg. 한 상 원두량을 확정하면 다시 계산할게요.' },
  '14': { can: '구글폼 문항과 개인정보 동의 문구', say: '"다음 주 여수에서 갓 볶아 발송"을 지키려면 발송일을 하나로 정해 두세요.' },
  '19': { can: '시안 이미지를 주시면 체크리스트로 검토', say: '3초 안에 "전라도 커피 한상, 무료"가 읽히는지부터 보세요.' },
};
function claudeFor(t) {
  const c = CLAUDE[t.No];
  const h = helpFor(t.작업);
  const can = c ? c.can : '이 작업의 초안이나 계산표';
  const say = c ? c.say : h ? h.t : '아직 의견이 없어요. 클로드 세션에 물어봐 주세요.';
  const ask = `카페쇼 기획 이어서. #${t.No} "${t.작업.split('(')[0].trim()}" 작업 도와줘. ${can} 부탁해.`;
  return { can, say, ask, h };
}

// ---------- 주최측 마감 ----------
const EXTERNAL = [
  [d(10, 1), d(11, 14), '모바일 초청장 60장 발송 (서울·수도권 납품처, 잠재 거래처)'],
  [d(10, 27), d(10, 31), '부대시설 1차 특별접수 (1.5배) · 전력이 모자랄 때만'],
  [d(10, 28), d(10, 28), '부스 추가옵션 신청 마감 (메쎄바우: 벽 실사·선반·조명·목공테이블)'],
  [d(11, 10), d(11, 10), '반입·세팅 12~20시 · 차량은 16시 전 하역 · 11/9는 입장 불가'],
  [d(11, 11), d(11, 14), '카페쇼 (수·목 비즈니스데이, 금·토 퍼블릭데이 · 토 16시 종료)'],
  [d(11, 14), d(11, 14), '반출 16:30~20:00 · 폐기물 전부 가져가기'],
];

// ---------- 상태 ----------
let who = 'all';
try { who = localStorage.getItem('cs-who') || 'all'; } catch (e) { }
let data = SNAP, live = false, last = null;

function mine(owner) {
  if (who === 'all') return true;
  if (who === '지형') return /지형|대표|공동/.test(owner);
  return owner.includes(who) || owner.includes('공동');
}
const done = s => /완료|done/i.test(s || '');

// 체크 표시: 시트 상태가 기준. 저장 전·저장 주소가 없을 때는 이 브라우저의 표시(marks)가 시트보다 앞선다
let marks = {};
try { marks = JSON.parse(localStorage.getItem('cs-checks') || '{}'); } catch (e) { }
function saveMarks() { try { localStorage.setItem('cs-checks', JSON.stringify(marks)); } catch (e) { } }
function isDone(t) { return t.No in marks ? marks[t.No] : done(t.상태); }

function taskCard(t, byNo) {
  const T = today(), due = parseDate(t.마감), start = parseDate(t.시작);
  const deps = (t.선행 || '').split(/[,\s]+/).filter(Boolean).map(n => byNo[n]).filter(x => x && !isDone(x));
  let cls = '', chip = '';
  if (due) {
    const n = diff(due, T);
    if (n < 0) { cls = 'late'; chip = `<span class="chip c-red">${-n}일 늦음</span>`; }
    else if (n === 0) { cls = 'today'; chip = `<span class="chip c-orange">오늘 마감</span>`; }
    else chip = `<span class="chip c-sub">D-${n}</span>`;
  }
  if (/진행/.test(t.상태)) chip += ` <span class="chip c-blue">진행 중</span>`;
  const h = helpFor(t.작업);
  const block = deps.length ? `<div class="block">먼저 끝나야 해요: ${deps.map(x => `#${esc(x.No)} ${esc(x.작업.split('(')[0])} (${esc(x.담당)})`).join(', ')}</div>` : '';
  const ask = deps.length ? askMsg(t, deps) : '';
  return `<article class="card ${cls} ${deps.length ? 'blocked' : ''}">
    <div class="row"><span class="title">${esc(t.작업)}</span><span>${chip}</span></div>
    <div class="meta"><span>#${esc(t.No)} ${esc(t.구분)}</span><span>담당 ${esc(t.담당)}</span>${start ? `<span>${fmt(start)} → ${due ? fmt(due) : ''}</span>` : ''}${t.산출물 ? `<span>결과물: ${esc(t.산출물)}</span>` : ''}</div>
    ${t.메모 ? `<div class="note">${esc(t.메모)}</div>` : ''}
    ${block}
    ${h || ask ? `<details><summary>도와줄게요</summary><div class="help">${h ? `<div>${h.t}</div><ul>${h.li.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}${ask}</div></details>` : ''}
  </article>`;
}
function askMsg(t, deps) {
  const owners = [...new Set(deps.map(x => x.담당))].join(', ');
  const text = `${owners}님, "${t.작업.split('(')[0].trim()}"을 하려면 아래가 먼저 필요해요.\n${deps.map(x => `- ${x.작업.split('(')[0].trim()} (마감 ${x.마감})`).join('\n')}\n오늘 안에 가능할까요?`;
  return `<div>먼저 필요한 일을 요청하는 메시지예요.</div><pre class="msg">${esc(text)}</pre><button class="copy" data-copy="${esc(text)}">메시지 복사</button>`;
}

const REC = {
  '1': '문서 미결 사항에 이미 결정: 기존 블렌드 + 허브 블렌드 (코스모스 → 허브 → 구수 라떼 → 보통). 시트에 옮겨 적기만 하면 돼요.',
  '2': '운영 추천: 구수 원두 진한 베이스 + 우유 + 시럽 두 번을 미리 섞어 두기. 에스프레소 머신 없이 2kW 안에서 가능해요.',
  '3': '문서에 이미 결정: 블렌드 4개 중 1회 리필.',
  '4': '추천: 시음 한상은 전부 무료, 판매는 드립백(현장)과 원두(현장 결제 후 11/20 발송)만.',
  '5': '정할 숫자: 드립백 보자기 에디션 가격, 원두 배송비, 할인코드 할인율·기한.',
  '6': '추천: 기본은 사기잔(급배수 있어 세척 가능), 피크 시간엔 이너컵(1회용 소주잔) 병행.',
  '7': '대화 기준: 숙박·교통 빼고 약 200만원, 초과 가능. 항목별 상한만 정해 주면 하빈이 수량을 정해요.',
  '8': '현장 3명, 대표님 이동이 잦으니 2명 기준 근무표 + 수·목 B2B는 대표님 상주 시간 지정.',
};
function decisionCard(x) {
  const T = today(), due = parseDate(x['결정 마감']);
  const decided = (x['결정 내용(입력)'] || '').trim();
  let chip = '';
  if (decided) chip = '<span class="chip c-green">결정됨</span>';
  else if (due) { const n = diff(due, T); chip = n < 0 ? `<span class="chip c-red">${-n}일 늦음</span>` : n === 0 ? '<span class="chip c-orange">오늘 마감</span>' : `<span class="chip c-sub">D-${n}</span>`; }
  return `<article class="card ${!decided && due && diff(due, T) <= 0 ? (diff(due, T) < 0 ? 'late' : 'today') : ''}">
    <div class="row"><span class="title">${esc(x['결정 항목'])}</span><span>${chip}</span></div>
    <div class="meta"><span>마감 ${due ? fmt(due) : '-'}</span><span>영향: ${esc(x['영향받는 작업'])}</span></div>
    ${decided ? `<div class="note">결정: ${esc(decided)}</div>` : `<div class="note">고려할 점: ${esc(x['고려할 점'])}</div>${REC[x.No] ? `<details><summary>이렇게 하면 어때요</summary><div class="help">${REC[x.No]}</div></details>` : ''}`}
  </article>`;
}

function orderRows(list) {
  const T = today();
  const rows = list.filter(o => !done(o.상태) && mine(o.담당)).map(o => {
    const target = parseDate(o['입고 목표일']), lead = parseInt(o['리드타임(일)'], 10);
    let deadline = null, state;
    if (target && lead >= 0) {
      deadline = new Date(target - lead * DAY);
      const n = diff(deadline, T);
      state = n < 0 ? `<span class="chip c-red">${-n}일 지남</span>` : n <= 2 ? `<span class="chip c-orange">D-${n}</span>` : `<span class="chip c-sub">D-${n}</span>`;
    } else state = '<span class="chip c-blue">리드타임 입력 필요</span>';
    return { o, deadline, state };
  }).sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));
  if (!rows.length) return '<div class="empty">남은 발주가 없어요.</div>';
  return `<div class="tbl"><table><tr><th>품목</th><th>업체</th><th>입고 목표</th><th>발주 마감</th><th>상태</th></tr>${rows.map(({ o, deadline, state }) =>
    `<tr><td>${esc(o.품목)}${o.메모 ? `<div class="meta">${esc(o.메모)}</div>` : ''}</td><td>${esc(o['업체/구매처']) || '<span class="c-sub">미정</span>'}</td><td class="n">${esc(o['입고 목표일'])}</td><td class="n">${deadline ? fmt(deadline) : '-'}</td><td>${state}</td></tr>`).join('')}</table></div>`;
}

function tips(T) {
  const out = [];
  const dow = T.getDay();
  if (dow === 0) out.push('오늘은 일요일, <b>하빈 → 대표님</b> 시안·질문 전달 마감일이에요.');
  if (dow === 3) out.push('오늘은 수요일, <b>대표님 → 하빈</b> 결정 전달 마감일이에요.');
  const undec = data.decisions.filter(x => !(x['결정 내용(입력)'] || '').trim());
  if (undec.length) out.push(`대표님 결정이 <b>${undec.length}개</b> 남았어요. 이 중 1·3번은 준비 문서에 이미 답이 있어서 시트에 옮겨 적기만 하면 돼요.`);
  const noLead = data.orders.filter(o => !done(o.상태) && !o['리드타임(일)']).length;
  if (noLead) out.push(`발주 품목 <b>${noLead}개</b>에 리드타임이 비어 있어요. 숫자만 넣으면 발주 마감일이 자동으로 계산돼요.`);
  out.push('상보를 걷는 장면이 이번 부스의 사진 포인트예요. 촬영(10/18~24) 컷리스트 첫 줄에 두세요.');
  out.push('커피앨리 무상 지원(그라인더·오트뮤 우유·정수 필터)은 사무국 메일 신청이 필요한지 확인해 보세요.');
  return out.map(x => `<div class="tip">${x}</div>`).join('');
}

// ---------- 전체 체크리스트 표 ----------
let hideDone = false;
try { hideDone = localStorage.getItem('cs-hide') === '1'; } catch (e) { }
let picked = null; // 아래 의견 칸에 보여 줄 작업 번호

function checklist(tasks) {
  const T = today();
  const list = tasks.filter(t => mine(t.담당))
    .sort((a, b) => (parseDate(a.마감) || Infinity) - (parseDate(b.마감) || Infinity) || a.No - b.No);
  const n = list.filter(isDone).length;
  document.getElementById('ckCount').textContent = `${n} / ${list.length} 완료`;
  document.getElementById('ckBar').style.width = list.length ? `${Math.round(n / list.length * 100)}%` : '0';
  const rows = list.filter(t => !(hideDone && isDone(t)));
  if (!rows.length) return '<div class="empty">표시할 작업이 없어요.</div>';
  return `<div class="tbl"><table class="ck"><thead><tr><th class="c">완료</th><th>할 일</th><th>담당</th><th>마감</th><th>클로드</th></tr></thead><tbody>${rows.map(t => {
    const ok = isDone(t), due = parseDate(t.마감);
    let chip = '';
    if (ok) chip = '<span class="chip c-green">완료</span>';
    else if (due) { const k = diff(due, T); chip = k < 0 ? `<span class="chip c-red">${-k}일 늦음</span>` : k === 0 ? '<span class="chip c-orange">오늘</span>' : `<span class="chip c-sub">D-${k}</span>`; }
    const pending = t.No in marks && marks[t.No] !== done(t.상태);
    return `<tr data-no="${esc(t.No)}" class="${ok ? 'is-done' : ''} ${picked === t.No ? 'is-picked' : ''}">
      <td class="c"><input type="checkbox" id="ck-${esc(t.No)}" data-no="${esc(t.No)}" ${ok ? 'checked' : ''}></td>
      <td><label for="ck-${esc(t.No)}" class="tt">${esc(t.작업)}</label><div class="meta"><span>#${esc(t.No)} ${esc(t.구분)}</span><span class="who-m">담당 ${esc(t.담당)}</span>${pending ? `<span class="c-orange">${SAVE_URL ? '시트에 저장 중…' : '이 브라우저에만 표시됨'}</span>` : ''}</div></td>
      <td>${esc(t.담당)}</td>
      <td class="n">${due ? fmt(due) : '-'}<br>${chip}</td>
      <td><button class="ai" data-no="${esc(t.No)}" aria-label="#${esc(t.No)} 클로드 의견 보기">✦<span class="w"> 의견</span></button></td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

function claudeHTML(t, full) {
  const c = claudeFor(t);
  return `<div class="ai-say">${esc(c.say)}</div>
    <div class="ai-can"><b>클로드가 해 드릴 수 있는 것</b> ${esc(c.can)}</div>
    ${full && c.h ? `<ul class="ai-li">${c.h.li.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${full ? `<div class="ai-ask"><span>클로드 세션에 붙여 넣을 부탁 문장</span><pre class="msg">${esc(c.ask)}</pre><button class="copy" data-copy="${esc(c.ask)}">부탁 문장 복사</button></div>` : '<div class="ai-hint">누르면 아래 칸에 자세히 보여요</div>'}`;
}
function showPanel(no) {
  const t = data.tasks.find(x => x.No === no);
  const p = document.getElementById('panel');
  if (!t) return;
  picked = no;
  document.getElementById('panelTitle').textContent = `#${t.No} ${t.작업.split('(')[0].trim()}`;
  document.getElementById('panelBody').innerHTML = claudeHTML(t, true);
  p.classList.add('open');
  document.querySelectorAll('table.ck tr.is-picked').forEach(r => r.classList.remove('is-picked'));
  const row = document.querySelector(`table.ck tr[data-no="${CSS.escape(no)}"]`);
  if (row) row.classList.add('is-picked');
}
function hidePanel() {
  picked = null;
  document.getElementById('panel').classList.remove('open');
  document.querySelectorAll('table.ck tr.is-picked').forEach(r => r.classList.remove('is-picked'));
}

function check(no, on) {
  marks[no] = on; saveMarks();
  render();
  const box = document.getElementById(`ck-${no}`); if (box) box.focus();
  if (!SAVE_URL) return;
  fetch(SAVE_URL, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ no, status: on ? '완료' : '대기' }) })
    .then(() => setTimeout(load, 2500)).catch(() => { });
}

function render() {
  const T = today();
  const tasks = data.tasks, byNo = Object.fromEntries(tasks.map(t => [t.No, t]));
  const open = tasks.filter(t => !isDone(t) && mine(t.담당));
  const now = open.filter(t => { const s = parseDate(t.시작), e = parseDate(t.마감); return (e && e <= T) || (s && s <= T); })
    .sort((a, b) => (parseDate(a.마감) || 0) - (parseDate(b.마감) || 0));
  const soon = open.filter(t => { const s = parseDate(t.시작); return s && s > T && diff(s, T) <= 7; })
    .sort((a, b) => parseDate(a.시작) - parseDate(b.시작));
  const late = now.filter(t => { const e = parseDate(t.마감); return e && e < T; }).length;

  const name = who === 'all' ? '' : who === '지형' ? '대표님, ' : '하빈님, ';
  document.getElementById('greet').textContent = now.length ? `${name}지금 할 일이 ${now.length}개 있어요` : `${name}지금 밀린 일은 없어요`;
  document.getElementById('greetSub').textContent = `${T.getMonth() + 1}월 ${T.getDate()}일 ${WD[T.getDay()]}요일` + (late ? ` · 마감이 지난 일 ${late}개부터 처리해요` : '');
  document.getElementById('dday').innerHTML = [
    ['main', diff(SHOW, T), '카페쇼 11/11'], ['', diff(READY, T), '준비 완료 10/25'], ['', diff(ARRIVE, T), '소품 도착 10/17'],
  ].map(([c, n, l]) => `<div class="${c}"><b>${n > 0 ? 'D-' + n : n === 0 ? 'D-DAY' : 'D+' + -n}</b><span>${l}</span></div>`).join('');
  document.getElementById('checklist').innerHTML = checklist(tasks);
  document.getElementById('ckSave').textContent = SAVE_URL ? '체크하면 구글 시트 상태 칸에 "완료"로 저장돼요.' : '지금은 체크가 이 브라우저에만 저장돼요. 하빈님과 함께 보려면 시트 저장을 연결해야 해요.';
  document.getElementById('nowCount').textContent = `${now.length}개`;
  document.getElementById('now').innerHTML = now.length ? now.map(t => taskCard(t, byNo)).join('') : '<div class="empty">지금 할 일이 없어요. 아래 "다가와요"를 미리 봐 두세요.</div>';
  const decs = data.decisions.slice().sort((a, b) => !!(a['결정 내용(입력)']) - !!(b['결정 내용(입력)']));
  document.getElementById('decisions').innerHTML = (who === '하빈' ? decs.filter(x => !(x['결정 내용(입력)'] || '').trim()) : decs).map(decisionCard).join('') || '<div class="empty">결정할 것이 없어요.</div>';
  document.getElementById('orders').innerHTML = orderRows(data.orders);
  document.getElementById('soon').innerHTML = soon.length ? soon.map(t => taskCard(t, byNo)).join('') : '<div class="empty">7일 안에 새로 시작하는 일이 없어요.</div>';
  document.getElementById('external').innerHTML = EXTERNAL.map(([s, e, txt]) => `<div class="${e < T ? 'past' : ''}"><b>${fmt(s)}${+s !== +e ? '~' + fmt(e) : ''}</b> ${txt}</div>`).join('');
  document.getElementById('tips').innerHTML = tips(T);
  document.getElementById('banner').innerHTML = live ? '' : '<div class="banner">구글 시트에 아직 연결되지 않아 10/4 스냅샷을 보여 주고 있어요. 시트 공유를 "링크가 있는 모든 사용자: 뷰어"로 바꾸면 실시간으로 바뀌어요.</div>';
  document.getElementById('sync').textContent = live ? `시트 연결됨 · ${last.getHours()}:${String(last.getMinutes()).padStart(2, '0')}` : '스냅샷';
}

async function load() {
  try {
    const [tasks, decisions, orders] = await Promise.all([sheet('일정표'), sheet('대표 결정사항'), sheet('발주·구매')]);
    if (tasks.length) {
      data = { tasks, decisions: decisions.length ? decisions : SNAP.decisions, orders: orders.length ? orders : SNAP.orders }; live = true; last = new Date();
      // 시트가 브라우저 표시와 같아지면 브라우저 표시는 지운다
      tasks.forEach(t => { if (t.No in marks && marks[t.No] === done(t.상태)) delete marks[t.No]; });
      saveMarks();
    }
  } catch (e) { live = false; }
  render();
}

document.querySelectorAll('.who button').forEach(b => {
  b.setAttribute('aria-pressed', String(b.dataset.who === who));
  b.addEventListener('click', () => {
    who = b.dataset.who; try { localStorage.setItem('cs-who', who); } catch (e) { }
    document.querySelectorAll('.who button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  });
});
// 체크·의견 칸
document.addEventListener('change', e => {
  const box = e.target.closest('table.ck input[type="checkbox"]'); if (box) check(box.dataset.no, box.checked);
});
document.getElementById('hideDone').checked = hideDone;
document.getElementById('hideDone').addEventListener('change', e => {
  hideDone = e.target.checked; try { localStorage.setItem('cs-hide', hideDone ? '1' : '0'); } catch (x) { }
  render();
});
document.getElementById('panelClose').addEventListener('click', hidePanel);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { hidePanel(); hidePop(); } });
document.addEventListener('click', e => {
  if (e.target.closest('table.ck input, table.ck label')) return;
  const b = e.target.closest('.ai') || e.target.closest('table.ck tbody tr');
  if (b) { hidePop(); showPanel(b.dataset.no); }
});
// 마우스 오버 팝업 (마우스를 쓰는 화면에서만)
const pop = document.getElementById('pop');
const fine = matchMedia('(hover:hover) and (pointer:fine)');
function hidePop() { pop.hidden = true; }
document.addEventListener('mouseover', e => {
  if (!fine.matches) return;
  const b = e.target.closest('.ai'); if (!b) return;
  const t = data.tasks.find(x => x.No === b.dataset.no); if (!t) return;
  pop.innerHTML = claudeHTML(t, false); pop.hidden = false;
  const r = b.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8));
  const top = r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8;
  pop.style.left = `${left + scrollX}px`; pop.style.top = `${top + scrollY}px`;
});
document.addEventListener('mouseout', e => { const b = e.target.closest('.ai'); if (b && !b.contains(e.relatedTarget)) hidePop(); });

document.addEventListener('click', e => {
  const b = e.target.closest('.copy'); if (!b) return;
  navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = '복사했어요'; }).catch(() => { b.textContent = '길게 눌러 복사해 주세요'; });
});
document.getElementById('sheetLink').href = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
render(); load(); setInterval(load, 60000);
