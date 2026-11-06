# 원두 주문표 A6 x4 / A4, No.0001~0100, 2번 재단(가운데 가로·세로)
import pathlib
OUT = pathlib.Path(r"D:/gachi-workbench/work/cafeshow/주문표/원두주문표-인쇄용.html")
P = [("코스모스",["18,000","36,000","65,000"]),("구수",["16,000","32,000","58,000"]),
     ("보통",["14,000","28,000","50,000"]),("허벌",["26,000","52,000",None])]
def form(n):
    rows = "".join(
        f"<tr><th>{nm}</th>" + "".join(
            f'<td><span class="pr">{p}원</span></td>' if p else '<td class="none">없음</td>' for p in ps) + "</tr>"
        for nm, ps in P)
    return f'''<div class="form">
<div class="fh"><div><b>가치커피 원두 주문표</b><small>2026 서울카페쇼 · 커피앨리 CA107</small></div><div class="no">No. {n:04d}</div></div>
<div class="lab">① 원하는 원두 칸에 수량을 적어 주세요</div>
<table class="tb"><thead><tr><th></th><th>200g</th><th>500g</th><th>1kg</th></tr></thead><tbody>{rows}</tbody></table>
<div class="sum"><span>합계 <small>(직원이 확인해요)</small></span><span>원</span></div>
<div class="lab">② 받으실 분</div>
<div class="f"><span>이름</span><i></i></div>
<div class="f"><span>연락처</span><i></i></div>
<div class="f"><span>주소</span><i></i></div>
<div class="f"><span></span><i></i></div>
<div class="agree"><span class="bx"></span><span>이름·연락처·주소는 이 주문 배송에만 쓰고, 발송 뒤 파기합니다. 동의합니다.</span></div>
<div class="ship"><b>11월 19일(목)</b>에 갓 볶아 보내 드려요 · 무료배송 · 드립백 증정</div>
<div class="ft"><b>문의</b><span>gachicoffee.com</span><span>instagram.com/gachi_coffee</span><span>0507-1494-7000</span></div>
</div>'''
pages = []
for p in range(25):           # 쌓아서 자르면 칸마다 번호가 이어지게
    nums = [p+1, p+26, p+51, p+76]
    marks = '<i class="m mt"></i><i class="m mb"></i><i class="m ml"></i><i class="m mr"></i>'
    pages.append('<section class="page">' + "".join(form(n) for n in nums) + marks + '</section>')
css = '''@page{size:210mm 297mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:"Pretendard","Malgun Gothic",sans-serif;color:#141414;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;display:grid;grid-template-columns:105mm 105mm;grid-template-rows:148.5mm 148.5mm;page-break-after:always;overflow:hidden}
.page:last-child{page-break-after:auto}
.form{padding:8mm;height:148.5mm;display:flex;flex-direction:column;font-size:9pt}
.fh{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.4px solid #141414;padding-bottom:1.8mm}
.fh b{font-size:13pt;font-weight:800;display:block;line-height:1.25}
.fh small{font-size:7.5pt;color:#666}
.no{font-weight:800;font-size:13pt;font-variant-numeric:tabular-nums;white-space:nowrap}
.lab{font-size:8pt;color:#7a3e10;font-weight:700;margin:3mm 0 1.2mm}
.tb{width:100%;border-collapse:collapse;table-layout:fixed}
.tb thead th{font-size:8pt;color:#666;font-weight:600;padding:.4mm 0;text-align:center}
.tb thead th:first-child,.tb tbody th{width:16mm}
.tb tbody th{text-align:left;font-size:9.5pt;font-weight:700}
.tb td{border:.5px solid #a8a8a8;height:10mm;position:relative;padding:.6mm 1mm;vertical-align:top}
.tb td.none{color:#999;font-size:7.5pt;text-align:center;vertical-align:middle;background:#eee}
.pr{font-size:6.8pt;color:#777;line-height:1}
.sum{display:flex;justify-content:space-between;align-items:flex-end;margin-top:2mm;border-bottom:1px solid #141414;padding-bottom:.7mm;font-weight:700;height:8mm}
.sum small{font-weight:400;font-size:7pt;color:#666}
.f{display:flex;align-items:flex-end;height:9mm}
.f span{width:14mm;flex:none;font-size:8.5pt;font-weight:600;line-height:1;padding-bottom:1.2mm}
.f i{flex:1;align-self:stretch;border-bottom:.5px solid #a8a8a8}
.agree{font-size:7pt;color:#333;margin-top:2mm;display:flex;gap:1.4mm;align-items:flex-start;line-height:1.4}
.bx{flex:none;width:3.2mm;height:3.2mm;border:.7px solid #333;margin-top:.2mm}
.ship{margin-top:auto;font-size:7.6pt;background:#f3eee6;padding:1.6mm 2mm;border-radius:1mm}
.ft{margin-top:1.8mm;padding-top:1.6mm;border-top:.5px solid #bbb;font-size:7.2pt;color:#333;display:flex;flex-wrap:wrap;gap:0 3mm;line-height:1.5}
.ft b{color:#7a3e10}
.m{position:absolute;background:#999}
.mt,.mb{left:105mm;width:.2mm;height:4mm;margin-left:-.1mm}
.mt{top:1.5mm}.mb{bottom:1.5mm}
.ml,.mr{top:148.5mm;height:.2mm;width:4mm;margin-top:-.1mm}
.ml{left:1.5mm}.mr{right:1.5mm}'''
OUT.write_text('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>원두 주문표 인쇄용</title><style>'+css+'</style></head><body>'+"".join(pages)+'</body></html>', encoding="utf-8")
print("ok")
