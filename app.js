// 카페쇼 준비 체크리스트 — 구글 시트(할 일·결정·발주)를 1분마다 읽어 표로 보여 주고, 할 일마다 클로드 의견(data.js)을 붙인다.
// 체크는 Apps Script 웹 앱(apps-script/체크저장.gs)으로 시트에 바로 저장한다. 주소가 없으면 기기에 저장하고 "보고 문장"으로 클로드에게 넘긴다.
const SHEET_ID = '1k2p3E9k6aNp3Zin-Zr7HOYkKXoKEEIcuhxapFbPHEmU';
const SAVE_URL = 'https://script.google.com/macros/s/AKfycbzv25FsQW5WY7Nd_ViC0FzwDPTUgeTQ0c1tnvXCsQcqHMqt0vGXlpfcZL8EQcsiEvw5/exec'; // Apps Script 웹 앱 (10/6 배포)
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
function short(s) { return String(s).split(' (')[0].trim(); }
const isDoneStatus = s => /완료|done/i.test(s || '');

// ---------- 구글 시트 읽기 (gviz CSV) ----------
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
// '메모' 탭: 시각 · 항목 · 작성자 · 내용 · 파일명 · 파일 링크
async function loadNotes() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent('메모')}`;
  const r = await fetch(url, { cache: 'no-store' });
  const t = await r.text();
  if (!r.ok || t.trim().startsWith('<')) throw new Error('no notes');
  const rows = parseCSV(t);
  const hi = rows.findIndex(r => r.map(c => c.trim()).includes('항목') && r.map(c => c.trim()).includes('작성자'));
  if (hi < 0) return {}; // 탭이 아직 없으면 시트가 첫 탭을 돌려준다
  const out = {};
  for (const r of rows.slice(hi + 1)) {
    const [when, key, author, text, fileName, url2] = r.map(c => (c || '').trim());
    if (!/^[PTDO]\d+$/.test(key)) continue;
    (out[key] = out[key] || []).push({ when, author, text, fileName, url: /^https:\/\//.test(url2) ? url2 : '' });
  }
  return out;
}
function notesFor(key) {
  const got = notes[key] || [];
  // 방금 보낸 메모가 시트에 보이면 '저장 중' 목록에서 뺀다
  sent = sent.filter(n => !(notes[n.key] || []).some(m => m.text === n.text && m.author === n.author));
  return [...got, ...sent.filter(n => n.key === key)];
}

// 시트 행 → data.js와 같은 모양. 클로드 의견(say·can·help)은 data.js에서 번호로 붙인다
function fromSheet(tasks, decisions, orders) {
  const note = (list, no) => list.find(x => String(x.no) === String(no)) || {};
  return {
    tasks: tasks.map(r => { const n = note(CS.tasks, r.No); return { ...n, no: +r.No, group: r.구분, title: r.작업, owner: r.담당, start: r.시작, due: r.마감,
      deps: (r.선행 || '').split(/[,\s]+/).filter(Boolean).map(Number), output: r.산출물, status: r.상태, memo: r.메모 }; }),
    decisions: decisions.map(r => { const n = note(CS.decisions, r.No); return { ...n, no: +r.No, title: r['결정 항목'], consider: r['고려할 점'], affects: r['영향받는 작업'],
      due: r['결정 마감'], decided: r['결정 내용(입력)'] || n.decided || '', sheetDecided: r['결정 내용(입력)'] }; }),
    orders: orders.map(r => { const n = note(CS.orders, r.No); return { ...n, no: +r.No, kind: r.구분, title: r.품목, vendor: (r['업체/구매처'] || '').split('/')[0].trim(),
      lead: r['리드타임(일)'], target: r['입고 목표일'], owner: r.담당, status: r.상태, memo: r.메모 }; }),
  };
}

// ---------- 표 한 줄씩 ----------
const SECTIONS = [
  { id: 'plan', col: 'colL', name: '기획 단계', sub: '클로드와 함께 정할 것' },
  { id: 'task', col: 'colL', name: '할 일', sub: '마스터 일정' },
  { id: 'dec', col: 'colR', name: '대표님 결정', sub: '결정이 늦으면 디자인 착수가 밀려요' },
  { id: 'order', col: 'colR', name: '발주·구매', sub: '입고 목표일 기준' },
];
let items = [], byKey = {};
// 기획 단계는 시트 표에 칸이 없어서, 체크를 '메모' 탭에 [완료 표시]/[완료 취소] 메모로 남기고 마지막 것을 따른다
const PLAN_ON = '[완료 표시]', PLAN_OFF = '[완료 취소]';
function planDone(x) {
  const last = (notes[x.no] || []).filter(n => n.text === PLAN_ON || n.text === PLAN_OFF).pop();
  return last ? last.text === PLAN_ON : isDoneStatus(x.status);
}
function me() { return who === '하빈' ? '하빈' : who === '지형' ? '지형(대표)' : '페이지'; }
function build(src) {
  items = [
    ...CS.plan.map(x => ({ key: x.no, sec: 'plan', tab: '', no: x.no, title: x.title, owner: x.owner, due: x.due, base: planDone(x), progress: x.status === '진행',
      meta: [x.output && `결과물: ${x.output}`, x.memo], say: x.say, can: x.can, help: x.help })),
    ...src.tasks.map(x => ({ key: 'T' + x.no, sec: 'task', tab: '일정표', sheetNo: x.no, no: '#' + x.no, title: x.title, owner: x.owner, due: x.due, base: isDoneStatus(x.status), progress: /진행/.test(x.status),
      deps: (x.deps || []).map(n => 'T' + n), meta: [x.group, x.output && `결과물: ${x.output}`, x.memo], say: x.say, can: x.can, help: x.help })),
    ...src.decisions.map(x => ({ key: 'D' + x.no, sec: 'dec', tab: '대표 결정사항', sheetNo: x.no, no: '결정 ' + x.no, title: x.title, owner: '지형(대표)', due: x.due, base: !!x.decided,
      meta: [x.decided ? `결정: ${x.decided}` : `고려할 점: ${x.consider}`, `영향: ${x.affects}`], say: x.say, can: x.can, help: x.help })),
    ...src.orders.map(x => ({ key: 'O' + x.no, sec: 'order', tab: '발주·구매', sheetNo: x.no, no: '발주 ' + x.no, title: x.title, owner: x.owner, due: x.target, base: isDoneStatus(x.status),
      meta: [x.kind, x.vendor ? `업체: ${x.vendor}` : '업체 미정', x.lead ? `리드타임 ${x.lead}일` : '', x.memo], say: x.say, can: x.can })),
  ];
  byKey = Object.fromEntries(items.map(x => [x.key, x]));
  // 원본(시트·data.js)에 이미 반영된 표시는 지운다
  for (const k of Object.keys(marks)) if (!byKey[k] || byKey[k].base === marks[k]) delete marks[k];
  save('cs-marks', marks);
}

// ---------- 상태 (이 기기) ----------
function load(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
const who = 'all'; // 사람별 보기는 없앴다(10/7). 상단은 대시보드
let hideDone = load('cs-hide', false);
let marks = load('cs-marks', {});
let live = false, last = null, saving = 0;
let flushed = false;
let notes = {}, sent = []; // 메모: 시트 '메모' 탭에서 읽은 것 / 방금 보내서 아직 시트에 안 보이는 것
let picked = null;

const isDone = x => x.key in marks ? marks[x.key] : x.base;
// 시트에 저장되지 못하고 기기에만 남은 표시 (기획 단계는 시트에 칸이 없어 늘 여기에 남는다)
const pending = () => SAVE_URL ? [] : Object.keys(marks).map(k => byKey[k]).filter(Boolean);
function mine(owner) {
  if (who === 'all') return true;
  if (who === '지형') return /지형|대표|공동/.test(owner);
  return owner.includes(who) || owner.includes('공동');
}
function askText(x) {
  return `카페쇼 기획 이어서. ${x.no} "${short(x.title)}" 도와줘.${x.can ? ` ${x.can} 부탁해.` : ''}`;
}
function reportText() {
  const p = pending();
  const on = p.filter(x => marks[x.key]), off = p.filter(x => !marks[x.key]);
  return ['카페쇼 체크리스트 반영해줘.',
    on.length ? `완료: ${on.map(x => `${x.no} ${short(x.title)}`).join(' / ')}` : '',
    off.length ? `완료 취소: ${off.map(x => `${x.no} ${short(x.title)}`).join(' / ')}` : ''].filter(Boolean).join('\n');
}

// ---------- 그리기 ----------
function chip(x, T) {
  if (isDone(x)) return '<span class="chip c-green">완료</span>';
  const due = parseDate(x.due);
  if (!due) return x.progress ? '<span class="chip c-blue">진행 중</span>' : '<span class="chip c-sub">날짜 미정</span>';
  const n = diff(due, T);
  return n < 0 ? `<span class="chip c-red">${-n}일 늦음</span>` : n === 0 ? '<span class="chip c-orange">오늘</span>' : `<span class="chip c-sub">D-${n}</span>`;
}
function row(x, T) {
  const ok = isDone(x), due = parseDate(x.due);
  const wait = (x.deps || []).map(k => byKey[k]).filter(y => y && !isDone(y));
  const nl = notesFor(x.key), files = nl.filter(n => n.fileName).length;
  const meta = x.meta.filter(Boolean).map(m => `<span>${esc(m)}</span>`).join('')
    + (nl.length ? `<span class="c-blue">메모 ${nl.length - files}${files ? ` · 첨부 ${files}` : ''}</span>` : '');
  const flag = x.key in marks ? (SAVE_URL ? '<span class="c-blue">시트에 저장 중…</span>' : '<span class="c-orange">이 기기에만 표시됨</span>') : '';
  return `<tr data-key="${x.key}" class="${ok ? 'is-done' : ''} ${picked === x.key ? 'is-picked' : ''}">
    <td class="c"><input type="checkbox" id="ck-${x.key}" data-key="${x.key}" aria-label="${esc(x.no)} 완료" ${ok ? 'checked' : ''}></td>
    <td><div class="tt"><span class="no">${esc(x.no)}</span> ${esc(x.title)}</div>
      <div class="meta"><span class="who-m">담당 ${esc(x.owner)}</span>${meta}${flag}</div>
      ${!ok && wait.length ? `<div class="block">먼저: ${wait.map(y => `${esc(y.no)} ${esc(short(y.title))}`).join(', ')}</div>` : ''}</td>
    <td class="who">${esc(x.owner)}</td>
    <td class="n">${due ? fmt(due) : '-'}<br>${chip(x, T)}</td>
    <td class="c"><button class="ai" data-key="${x.key}" aria-label="${esc(x.no)} 클로드 의견">✦<span class="w"> 의견</span></button></td>
  </tr>`;
}
function sortRows(a, b) {
  return isDone(a) - isDone(b) || (parseDate(a.due) || Infinity) - (parseDate(b.due) || Infinity);
}

// ---------- 상단 대시보드: 지금 눈여겨볼 8가지 ----------
function dday(n) { return n > 0 ? 'D-' + n : n === 0 ? 'D-DAY' : 'D+' + -n; }
function noteTime(w) { const m = String(w || '').match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/); return m ? new Date(YEAR, m[1] - 1, +m[2], +m[3], +m[4]) : null; }
function dashboard(T, open, late) {
  const byDue = list => list.slice().sort((a, b) => parseDate(a.due) - parseDate(b.due));
  const names = list => list.slice(0, 2).map(x => esc(short(x.title))).join(' · ') + (list.length > 2 ? ` 외 ${list.length - 2}개` : '');
  const lateL = byDue(open.filter(x => { const e = parseDate(x.due); return e && e < T; }));
  const soonL = byDue(open.filter(x => { const e = parseDate(x.due); return e && diff(e, T) >= 0 && diff(e, T) <= 1; }));
  const weekL = byDue(open.filter(x => { const e = parseDate(x.due); return e && diff(e, T) >= 0 && diff(e, T) <= 7; }));
  const decL = byDue(open.filter(x => x.sec === 'dec'));
  const ordL = byDue(open.filter(x => x.sec === 'order'));
  const noLead = ordL.filter(x => !/리드타임/.test(x.meta.join(' '))).length;
  const ext = CS.external.map(([s, e, t]) => ({ S: parseDate(s), E: parseDate(e), t })).filter(x => x.E >= T && x.S >= T).sort((a, b) => a.S - b.S)[0];
  const since = Date.now() - DAY;
  const recent = Object.entries(notes).flatMap(([k, l]) => l.map(n => ({ ...n, key: k, at: noteTime(n.when) })))
    .filter(n => n.at && n.at.getTime() >= since && n.text !== PLAN_ON && n.text !== PLAN_OFF).sort((a, b) => b.at - a.at);
  const done = items.filter(isDone).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  const card = (tone, label, big, sub, key) => `<button class="dc ${tone}" ${key ? `data-key="${key}"` : 'disabled'}><span class="dl">${label}</span><b>${big}</b><span class="ds">${sub || '&nbsp;'}</span></button>`;
  return [
    card('main', '카페쇼 11/11(수)', dday(diff(SHOW, T)), `준비 완료 10/25 ${dday(diff(READY, T))} · 소품 도착 10/17 ${dday(diff(ARRIVE, T))}`),
    card(lateL.length ? 'red' : 'ok', '마감 지난 일', `${lateL.length}개`, lateL.length ? names(lateL) : '밀린 일 없음', lateL[0]?.key),
    card(soonL.length ? 'orange' : 'ok', '오늘·내일 마감', `${soonL.length}개`, soonL.length ? names(soonL) : '없음', soonL[0]?.key),
    card(decL.length ? 'orange' : 'ok', '대표님 결정 대기', `${decL.length}개`, decL.length ? `가장 급한 것: ${esc(short(decL[0].title))} (${esc(decL[0].due)})` : '모두 결정됨', decL[0]?.key),
    card('', '앞으로 7일 마감', `${weekL.length}개`, weekL.length ? names(weekL) : '없음', weekL[0]?.key),
    card(ext && diff(ext.S, T) <= 7 ? 'orange' : '', '다음 주최측 마감', ext ? dday(diff(ext.S, T)) : '-', ext ? `${fmt(ext.S)} ${esc(ext.t)}` : '남은 마감 없음'),
    card(ordL.length ? '' : 'ok', '발주·구매 남은 것', `${ordL.length}개`, ordL.length ? `가장 이른 입고 ${esc(ordL[0].due)} ${dday(diff(parseDate(ordL[0].due), T))}${noLead ? ` · 리드타임 미입력 ${noLead}개` : ''}` : '모두 끝남', ordL[0]?.key),
    card(recent.length ? 'blue' : '', '최근 24시간 메모', `${recent.length}개`, recent.length ? `${esc(recent[0].author)}: ${esc(recent[0].text || recent[0].fileName).slice(0, 40)}` : `전체 진행률 ${pct}%`, recent[0]?.key),
  ].join('');
}

function render() {
  const T = today();
  const vis = items.filter(x => mine(x.owner));
  const done = vis.filter(isDone).length;
  const open = vis.filter(x => !isDone(x));
  const due = open.filter(x => { const e = parseDate(x.due); return e && e <= T; });
  const late = due.filter(x => parseDate(x.due) < T).length;

  document.getElementById('sync').textContent = live ? `시트 연결됨 · ${last.getHours()}:${String(last.getMinutes()).padStart(2, '0')}` : `시트 연결 안 됨 · ${CS.updated} 사본`;
  document.getElementById('dash').innerHTML = dashboard(T, open, late);
  document.getElementById('total').textContent = `${done} / ${vis.length} 완료`;
  document.getElementById('totalBar').style.width = vis.length ? `${Math.round(done / vis.length * 100)}%` : '0';

  const p = pending();
  document.getElementById('report').innerHTML = p.length ? `<div class="banner"><div><b>이 기기에만 표시된 체크 ${p.length}개</b>가 있어요. 아래 문장을 클로드 세션에 붙여 넣으면 클로드가 반영해요.</div><pre class="msg">${esc(reportText())}</pre><button class="copy" data-copy="${esc(reportText())}">보고 문장 복사</button></div>` : '';

  const html = s => {
    const all = vis.filter(x => x.sec === s.id);
    if (!all.length) return '';
    const n = all.filter(isDone).length;
    const rows = all.filter(x => !(hideDone && isDone(x))).sort(sortRows);
    return `<section id="sec-${s.id}">
      <h2>${s.name} <small>${n} / ${all.length} · ${s.sub}</small></h2>
      ${rows.length ? `<div class="tbl"><table class="ck"><thead><tr><th class="c">완료</th><th>할 일</th><th class="who">담당</th><th>마감</th><th class="c">클로드</th></tr></thead><tbody>${rows.map(x => row(x, T)).join('')}</tbody></table></div>` : '<div class="empty">모두 끝났어요.</div>'}
    </section>`;
  };
  for (const c of ['colL', 'colR']) document.getElementById(c).innerHTML = SECTIONS.filter(s => s.col === c).map(html).join('');

  document.getElementById('external').innerHTML = CS.external.map(([s, e, txt]) => {
    const S = parseDate(s), E = parseDate(e);
    return `<div class="${E < T ? 'past' : ''}"><b>${fmt(S)}${s !== e ? '~' + fmt(E) : ''}</b> ${esc(txt)}</div>`;
  }).join('');
  if (picked && byKey[picked]) setPicked(picked);
  const list = document.getElementById('noteList');
  if (list && picked) list.innerHTML = noteListHTML(picked);
}

async function refresh() {
  if (saving) return; // 저장 직후에는 시트가 바뀔 때까지 기다린다
  try {
    const [t, dcs, o, nt] = await Promise.all([sheet('일정표'), sheet('대표 결정사항'), sheet('발주·구매'), loadNotes().catch(() => null)]);
    if (nt) notes = nt;
    if (!t.length) throw new Error('empty');
    const s = fromSheet(t, dcs, o);
    build({ tasks: s.tasks, decisions: dcs.length ? s.decisions : CS.decisions, orders: o.length ? s.orders : CS.orders });
    live = true; last = new Date();
    // 예전에 이 기기에만 남은 체크가 있으면 한 번 시트로 보낸다
    if (!flushed && SAVE_URL) { flushed = true; for (const k of Object.keys(marks)) if (byKey[k]) send(byKey[k], marks[k]); }
  } catch (e) {
    if (!live) build(CS);
  }
  render();
}

// ---------- 체크 저장 ----------
function check(x, on) {
  if (on === x.base) delete marks[x.key]; else marks[x.key] = on;
  save('cs-marks', marks);
  render();
  const again = document.getElementById(`ck-${x.key}`); if (again) again.focus();
  send(x, on);
}
// 시트(또는 메모 탭)에 체크를 보낸다
function send(x, on) {
  if (!SAVE_URL) return;
  saving++;
  const body = x.tab ? { tab: x.tab, no: String(x.sheetNo), done: on ? '1' : '0' } : { action: 'note', key: x.key, author: me(), text: on ? PLAN_ON : PLAN_OFF };
  fetch(SAVE_URL, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(body) })
    .catch(() => { })
    .finally(() => setTimeout(() => { saving--; refresh(); }, 2500));
}

// ---------- 클로드 의견: 마우스 오버 팝업 + 아래 칸 ----------
function claudeHTML(x, full) {
  return `<div class="ai-say">${esc(x.say || '아직 의견이 없어요. 클로드 세션에 물어봐 주세요.')}</div>
    ${x.can ? `<div class="ai-can"><b>클로드가 해 드릴 수 있는 것</b> ${esc(x.can)}</div>` : ''}
    ${full && x.help ? `<ul class="ai-li">${x.help.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    ${full ? `<div class="ai-ask"><span>클로드 세션에 붙여 넣을 부탁 문장</span><pre class="msg">${esc(askText(x))}</pre><button class="copy" data-copy="${esc(askText(x))}">부탁 문장 복사</button></div>` : '<div class="ai-hint">누르면 아래 칸에 자세히 보여요</div>'}`;
}
function setPicked(key) {
  picked = key;
  document.querySelectorAll('table.ck tr.is-picked').forEach(r => r.classList.remove('is-picked'));
  if (key) document.querySelectorAll(`table.ck tr[data-key="${key}"]`).forEach(r => r.classList.add('is-picked'));
}
function showPanel(key) {
  const x = byKey[key]; if (!x) return;
  document.getElementById('panelTitle').textContent = `${x.no} ${short(x.title)}`;
  document.getElementById('panelBody').innerHTML = `<div class="pcol"><h3>✦ 클로드 의견</h3>${claudeHTML(x, true)}</div>
    <div class="pcol"><h3>메모·첨부</h3><div id="noteList">${noteListHTML(x.key)}</div>${noteFormHTML(x)}</div>`;
  document.getElementById('panel').classList.add('open');
  setPicked(key);
}
function noteListHTML(key) {
  const nl = notesFor(key);
  if (!nl.length) return '<div class="empty">아직 메모가 없어요.</div>';
  return `<ul class="notes">${nl.map(n => `<li><div class="nh"><b>${esc(n.author)}</b> <span>${esc(n.when || '저장 중…')}</span></div>${n.text ? `<div>${esc(n.text)}</div>` : ''}${n.fileName ? (n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">📎 ${esc(n.fileName)}</a>` : `<span>📎 ${esc(n.fileName)} (올리는 중)</span>`) : ''}</li>`).join('')}</ul>`;
}
function noteFormHTML(x) {
  if (!SAVE_URL) return '<div class="note-off">메모·첨부 저장은 Apps Script 웹 앱 주소를 연결하면 켜져요.</div>';
  const me = who === '하빈' ? '하빈' : who === '지형' ? '지형(대표)' : '';
  return `<form id="noteForm" data-key="${x.key}" class="nform">
    <textarea id="nText" rows="3" placeholder="${x.sec === 'dec' ? '결정 내용이나 의견을 적어 주세요' : '의견·진행 상황·링크를 적어 주세요'}"></textarea>
    <div class="nrow">
      <select id="nWho" aria-label="작성자"><option value="">작성자</option>${['지형(대표)', '하빈', '효진', '찬양', '다빈', '서준'].map(n => `<option ${n === me ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <input type="file" id="nFile" aria-label="파일 첨부">
    </div>
    ${x.sec === 'dec' ? '<label class="nrow"><input type="checkbox" id="nDecide"> 이 내용을 시트의 결정 내용 칸에 쓰기</label>' : ''}
    <div class="nrow"><button type="submit" class="btn">저장</button><span id="nMsg" class="ck-note"></span></div>
    <div class="ck-note">메모는 링크가 있는 사람이 볼 수 있는 시트에 저장돼요. 고객 연락처 같은 개인정보는 파일로 올려 주세요(파일은 드라이브에서 공유받은 사람만 열려요). 파일은 10MB까지.</div>
  </form>`;
}
function post(params) {
  return fetch(SAVE_URL, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(params) });
}
function fileToBase64(f) {
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = no; r.readAsDataURL(f); });
}
async function submitNote(form) {
  const x = byKey[form.dataset.key]; if (!x) return;
  const text = form.querySelector('#nText').value.trim();
  const author = form.querySelector('#nWho').value;
  const f = form.querySelector('#nFile').files[0];
  const decide = form.querySelector('#nDecide')?.checked;
  const msg = form.querySelector('#nMsg');
  if (!author) { msg.textContent = '작성자를 골라 주세요.'; return; }
  if (!text && !f) { msg.textContent = '내용이나 파일을 넣어 주세요.'; return; }
  if (f && f.size > 10 * 1024 * 1024) { msg.textContent = '파일이 10MB를 넘어요.'; return; }
  form.querySelector('button[type="submit"]').disabled = true;
  msg.textContent = f ? '파일을 올리는 중…' : '저장하는 중…';
  try {
    if (f) await post({ action: 'upload', key: x.key, author, text, name: f.name, mime: f.type || 'application/octet-stream', data: await fileToBase64(f) });
    else await post({ action: 'note', key: x.key, author, text });
    if (decide && text && x.tab) await post({ action: 'decide', no: String(x.sheetNo), text });
    sent.push({ key: x.key, author, text, fileName: f ? f.name : '', url: '', when: '' });
    form.reset();
    msg.textContent = '보냈어요. 몇 초 뒤 목록에 반영돼요.';
  } catch (e) {
    msg.textContent = '보내지 못했어요. 잠시 뒤 다시 해 주세요.';
  }
  form.querySelector('button[type="submit"]').disabled = false;
  document.getElementById('noteList').innerHTML = noteListHTML(x.key);
  setTimeout(refresh, 4000);
}

function hidePanel() { document.getElementById('panel').classList.remove('open'); setPicked(null); }
const pop = document.getElementById('pop');
const fine = matchMedia('(hover:hover) and (pointer:fine)');
function hidePop() { pop.hidden = true; }

// ---------- 이벤트 ----------
const hd = document.getElementById('hideDone');
hd.checked = hideDone;
hd.addEventListener('change', () => { hideDone = hd.checked; save('cs-hide', hideDone); render(); });

document.addEventListener('change', e => {
  const box = e.target.closest('table.ck input[type="checkbox"]'); if (!box) return;
  check(byKey[box.dataset.key], box.checked);
});
document.addEventListener('click', e => {
  const c = e.target.closest('.copy');
  if (c) {
    navigator.clipboard.writeText(c.dataset.copy).then(() => { c.textContent = '복사했어요'; }).catch(() => { c.textContent = '길게 눌러 복사해 주세요'; });
    return;
  }
  if (e.target.closest('#panelClose')) { hidePanel(); return; }
  if (e.target.closest('table.ck input, table.ck label')) return;
  const dc = e.target.closest('.dc[data-key]');
  if (dc) {
    showPanel(dc.dataset.key);
    const row = document.querySelector(`table.ck tr[data-key="${dc.dataset.key}"]`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const t = e.target.closest('.ai') || e.target.closest('table.ck tbody tr');
  if (t) { hidePop(); showPanel(t.dataset.key); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('#noteForm'); if (!f) return;
  e.preventDefault(); submitNote(f);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.target.closest('#noteForm')) { hidePanel(); hidePop(); } });
document.addEventListener('mouseover', e => {
  if (!fine.matches) return;
  const b = e.target.closest('.ai'); if (!b || !byKey[b.dataset.key]) return;
  pop.innerHTML = claudeHTML(byKey[b.dataset.key], false); pop.hidden = false;
  const r = b.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8));
  const top = r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8;
  pop.style.left = `${left + scrollX}px`; pop.style.top = `${top + scrollY}px`;
});
document.addEventListener('mouseout', e => { const b = e.target.closest('.ai'); if (b && !b.contains(e.relatedTarget)) hidePop(); });
document.getElementById('sheetLink').href = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

build(CS); render();
refresh(); setInterval(refresh, 60000);
