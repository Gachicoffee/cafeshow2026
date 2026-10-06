// 카페쇼 준비 체크리스트 — data.js(구글 시트를 옮겨 온 원본)를 표로 보여 주고, 할 일마다 클로드 의견을 붙인다.
// 체크는 이 기기에 먼저 저장되고, "클로드에게 보고"로 보내면 클로드가 data.js에 반영해 모두에게 보인다.
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

// ---------- data.js → 표 한 줄씩 ----------
const SECTIONS = [
  { id: 'plan', name: '기획 단계', sub: '클로드와 함께 정할 것', label: '기획' },
  { id: 'task', name: '할 일', sub: '마스터 일정', label: '일정' },
  { id: 'dec', name: '대표님 결정', sub: '결정이 늦으면 디자인 착수가 밀려요', label: '결정' },
  { id: 'order', name: '발주·구매', sub: '입고 목표일 기준', label: '발주' },
];
const items = [
  ...CS.plan.map(x => ({ key: x.no, sec: 'plan', no: x.no, title: x.title, owner: x.owner, due: x.due, base: isDoneStatus(x.status), progress: x.status === '진행',
    meta: [x.output && `결과물: ${x.output}`, x.memo], say: x.say, can: x.can, help: x.help })),
  ...CS.tasks.map(x => ({ key: 'T' + x.no, sec: 'task', no: '#' + x.no, title: x.title, owner: x.owner, due: x.due, base: isDoneStatus(x.status), progress: x.status === '진행',
    deps: x.deps.map(n => 'T' + n), meta: [x.group, x.output && `결과물: ${x.output}`, x.memo], say: x.say, can: x.can, help: x.help })),
  ...CS.decisions.map(x => ({ key: 'D' + x.no, sec: 'dec', no: '결정 ' + x.no, title: x.title, owner: '지형(대표)', due: x.due, base: !!x.decided,
    meta: [x.decided ? `결정: ${x.decided}` : `고려할 점: ${x.consider}`, `영향: ${x.affects}`], say: x.say, can: x.can })),
  ...CS.orders.map(x => ({ key: 'O' + x.no, sec: 'order', no: '발주 ' + x.no, title: x.title, owner: x.owner, due: x.target, base: isDoneStatus(x.status),
    meta: [x.kind, x.vendor ? `업체: ${x.vendor}` : '업체 미정', x.lead ? `리드타임 ${x.lead}일` : '', x.memo], say: x.say, can: x.can })),
];
const byKey = Object.fromEntries(items.map(x => [x.key, x]));

// ---------- 상태 (이 기기) ----------
function load(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
let who = load('cs-who', 'all');
let hideDone = load('cs-hide', false);
let marks = load('cs-marks', {});
// data.js에 이미 반영된 표시는 지운다
for (const k of Object.keys(marks)) if (!byKey[k] || byKey[k].base === marks[k]) delete marks[k];
save('cs-marks', marks);
let picked = null;

const isDone = x => x.key in marks ? marks[x.key] : x.base;
const pending = () => Object.keys(marks).map(k => byKey[k]).filter(Boolean);
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
  return ['카페쇼 체크리스트 data.js에 반영해줘.',
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
  const meta = x.meta.filter(Boolean).map(m => `<span>${esc(m)}</span>`).join('');
  return `<tr data-key="${x.key}" class="${ok ? 'is-done' : ''} ${picked === x.key ? 'is-picked' : ''}">
    <td class="c"><input type="checkbox" id="ck-${x.key}" data-key="${x.key}" ${ok ? 'checked' : ''}></td>
    <td><label for="ck-${x.key}" class="tt"><span class="no">${esc(x.no)}</span> ${esc(x.title)}</label>
      <div class="meta"><span class="who-m">담당 ${esc(x.owner)}</span>${meta}${x.key in marks ? '<span class="c-orange">이 기기에만 표시됨</span>' : ''}</div>
      ${!ok && wait.length ? `<div class="block">먼저: ${wait.map(y => `${esc(y.no)} ${esc(short(y.title))}`).join(', ')}</div>` : ''}</td>
    <td class="who">${esc(x.owner)}</td>
    <td class="n">${due ? fmt(due) : '-'}<br>${chip(x, T)}</td>
    <td class="c"><button class="ai" data-key="${x.key}" aria-label="${esc(x.no)} 클로드 의견">✦<span class="w"> 의견</span></button></td>
  </tr>`;
}
function sortRows(a, b) {
  return isDone(a) - isDone(b) || (parseDate(a.due) || Infinity) - (parseDate(b.due) || Infinity);
}

function render() {
  const T = today();
  const vis = items.filter(x => mine(x.owner));
  const done = vis.filter(isDone).length;
  const open = vis.filter(x => !isDone(x));
  const due = open.filter(x => { const e = parseDate(x.due); return e && e <= T; });
  const late = due.filter(x => parseDate(x.due) < T).length;
  const name = who === 'all' ? '' : who === '지형' ? '대표님, ' : '하빈님, ';

  document.getElementById('greet').textContent = due.length ? `${name}오늘까지 할 일이 ${due.length}개 있어요` : `${name}오늘까지 밀린 일은 없어요`;
  document.getElementById('greetSub').textContent = `${T.getMonth() + 1}월 ${T.getDate()}일 ${WD[T.getDay()]}요일` + (late ? ` · 마감이 지난 일 ${late}개부터 처리해요` : '') + ` · 데이터 ${CS.updated} 기준`;
  document.getElementById('dday').innerHTML = [
    ['main', diff(SHOW, T), '카페쇼 11/11'], ['', diff(READY, T), '준비 완료 10/25'], ['', diff(ARRIVE, T), '소품 도착 10/17'],
  ].map(([c, n, l]) => `<div class="${c}"><b>${n > 0 ? 'D-' + n : n === 0 ? 'D-DAY' : 'D+' + -n}</b><span>${l}</span></div>`).join('');
  document.getElementById('total').textContent = `${done} / ${vis.length} 완료`;
  document.getElementById('totalBar').style.width = vis.length ? `${Math.round(done / vis.length * 100)}%` : '0';

  const p = pending();
  document.getElementById('report').innerHTML = p.length ? `<div class="banner"><div><b>이 기기에서 바꾼 체크 ${p.length}개</b>가 아직 확정되지 않았어요. 아래 문장을 클로드 세션에 붙여 넣으면 클로드가 반영해 모두에게 보여요.</div><pre class="msg">${esc(reportText())}</pre><button class="copy" data-copy="${esc(reportText())}">보고 문장 복사</button></div>` : '';

  document.getElementById('lists').innerHTML = SECTIONS.map(s => {
    const all = vis.filter(x => x.sec === s.id);
    if (!all.length) return '';
    const n = all.filter(isDone).length;
    const rows = all.filter(x => !(hideDone && isDone(x))).sort(sortRows);
    return `<section>
      <h2>${s.name} <small>${n} / ${all.length} · ${s.sub}</small></h2>
      ${rows.length ? `<div class="tbl"><table class="ck"><thead><tr><th class="c">완료</th><th>할 일</th><th class="who">담당</th><th>마감</th><th class="c">클로드</th></tr></thead><tbody>${rows.map(x => row(x, T)).join('')}</tbody></table></div>` : '<div class="empty">모두 끝났어요.</div>'}
    </section>`;
  }).join('');

  document.getElementById('external').innerHTML = CS.external.map(([s, e, txt]) => {
    const S = parseDate(s), E = parseDate(e);
    return `<div class="${E < T ? 'past' : ''}"><b>${fmt(S)}${s !== e ? '~' + fmt(E) : ''}</b> ${esc(txt)}</div>`;
  }).join('');
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
  document.getElementById('panelBody').innerHTML = claudeHTML(x, true);
  document.getElementById('panel').classList.add('open');
  setPicked(key);
}
function hidePanel() { document.getElementById('panel').classList.remove('open'); setPicked(null); }
const pop = document.getElementById('pop');
const fine = matchMedia('(hover:hover) and (pointer:fine)');
function hidePop() { pop.hidden = true; }

// ---------- 이벤트 ----------
document.querySelectorAll('.who-btn button').forEach(b => {
  b.setAttribute('aria-pressed', String(b.dataset.who === who));
  b.addEventListener('click', () => {
    who = b.dataset.who; save('cs-who', who);
    document.querySelectorAll('.who-btn button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  });
});
const hd = document.getElementById('hideDone');
hd.checked = hideDone;
hd.addEventListener('change', () => { hideDone = hd.checked; save('cs-hide', hideDone); render(); });

document.addEventListener('change', e => {
  const box = e.target.closest('table.ck input[type="checkbox"]'); if (!box) return;
  const x = byKey[box.dataset.key];
  if (box.checked === x.base) delete marks[x.key]; else marks[x.key] = box.checked;
  save('cs-marks', marks);
  render();
  const again = document.getElementById(`ck-${x.key}`); if (again) again.focus();
});
document.addEventListener('click', e => {
  const c = e.target.closest('.copy');
  if (c) {
    navigator.clipboard.writeText(c.dataset.copy).then(() => { c.textContent = '복사했어요'; }).catch(() => { c.textContent = '길게 눌러 복사해 주세요'; });
    return;
  }
  if (e.target.closest('#panelClose')) { hidePanel(); return; }
  if (e.target.closest('table.ck input, table.ck label')) return;
  const t = e.target.closest('.ai') || e.target.closest('table.ck tbody tr');
  if (t) { hidePop(); showPanel(t.dataset.key); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { hidePanel(); hidePop(); } });
document.addEventListener('mouseover', e => {
  if (!fine.matches) return;
  const b = e.target.closest('.ai'); if (!b) return;
  pop.innerHTML = claudeHTML(byKey[b.dataset.key], false); pop.hidden = false;
  const r = b.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8));
  const top = r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8;
  pop.style.left = `${left + scrollX}px`; pop.style.top = `${top + scrollY}px`;
});
document.addEventListener('mouseout', e => { const b = e.target.closest('.ai'); if (b && !b.contains(e.relatedTarget)) hidePop(); });

render();
// 자정을 넘기면 D-day가 바뀌므로 10분마다 다시 그린다
setInterval(render, 600000);
