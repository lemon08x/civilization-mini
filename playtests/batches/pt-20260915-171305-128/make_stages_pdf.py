# -*- coding: utf-8 -*-
"""Download fpdf2 wheel into workspace, unpack, and build the stages overview PDF.
Writes only under the workspace (no reliance on pip/system temp)."""
import sys, os, urllib.request, zipfile, json, pathlib

BASE = pathlib.Path(__file__).resolve().parent          # batch dir
VENDOR = BASE / "vendor"
VENDOR.mkdir(parents=True, exist_ok=True)
WHL = VENDOR / "fpdf2-2.8.8-py3-none-any.whl"

# 1) download wheel if absent
if not WHL.exists():
    url = "https://files.pythonhosted.org/packages/f5/be/af012eda9507494f28b99b077423806c43a11573eb6225dd46f19ae2d263/fpdf2-2.8.8-py3-none-any.whl"
    print("downloading fpdf2 wheel ...")
    urllib.request.urlretrieve(url, WHL)
    print("downloaded", WHL.stat().st_size, "bytes")

# 2) unpack wheel into vendor/fpdf2 (wheel is a zip)
PKG = VENDOR / "fpdf2_pkg"
if not (PKG / "fpdf").exists():
    PKG.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(WHL) as z:
        z.extractall(PKG)
    print("unpacked to", PKG)
sys.path.insert(0, str(PKG))
from fpdf import FPDF  # noqa: E402

# 3) build PDF with embedded CJK font (Microsoft YaHei)
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\msyh.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]
FONT = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
if not FONT:
    sys.exit("no CJK font found")

pdf = FPDF(format="A4")
pdf.set_auto_page_break(True, margin=16)
pdf.add_font("cjk", "", FONT)
pdf.add_page()

M = 16  # margin
W = pdf.w - 2 * M

def heading(text, size=15, color=(29, 61, 92), space=4):
    pdf.set_text_color(*color)
    pdf.set_font("cjk", "", size)
    pdf.set_x(M)
    pdf.multi_cell(W, size * 0.55, text, align="L")
    pdf.ln(space)

def para(text, size=10.5, color=(34, 34, 34)):
    pdf.set_text_color(*color)
    pdf.set_font("cjk", "", size)
    pdf.set_x(M)
    pdf.multi_cell(W, size * 0.5, text, align="L")
    pdf.ln(2)

def table(headers, rows, widths=None):
    n = len(headers)
    widths = widths or [W / n] * n
    col_x = []
    x = M
    for wdt in widths:
        col_x.append(x)
        x += wdt
    # header
    pdf.set_fill_color(232, 238, 244)
    pdf.set_text_color(29, 61, 92)
    pdf.set_font("cjk", "", 9.5)
    pdf.set_x(M)
    for i, h in enumerate(headers):
        pdf.set_xy(col_x[i], pdf.get_y())
        pdf.cell(widths[i], 7, h, border=1, fill=True)
    pdf.ln()
    # rows
    pdf.set_font("cjk", "", 9)
    for r_i, row in enumerate(rows):
        if r_i % 2 == 1:
            pdf.set_fill_color(247, 249, 251)
            fill = True
        else:
            pdf.set_fill_color(255, 255, 255)
            fill = False
        # compute row height from longest cell
        max_lines = 1
        for i, cell in enumerate(row):
            lines = pdf.multi_cell(widths[i], 5, str(cell), dry_run=True, output="LINES")
            max_lines = max(max_lines, len(lines))
        rh = max_lines * 5 + 2
        y0 = pdf.get_y()
        if y0 + rh > pdf.h - 16:
            pdf.add_page()
            y0 = pdf.get_y()
        pdf.set_text_color(34, 34, 34)
        for i, cell in enumerate(row):
            pdf.set_xy(col_x[i], y0)
            pdf.multi_cell(widths[i], 5, str(cell), border=1, fill=fill, align="L")
        pdf.set_y(y0 + rh)
    pdf.ln(3)

# ---------- content ----------
heading("文明迷你 · 不同发展阶段能做什么", 18)
para("规则版本 0.26.0（rulesets/social-eras.v26.json）。整理依据：规则文档 docs/CIVILIZATION_ERAS_V26.md、"
     "游戏实现（src/game）与三局试玩观察（v24/v25/v26 各一局）。四阶段依次为：农业村落 → 集镇分工 → 工业城镇 → 现代社会，"
     "每阶段默认 192 季时间预算。", 9.5)

pdf.set_fill_color(255, 248, 230); pdf.set_draw_color(224, 192, 96)
pdf.set_font("cjk", "", 9.5); pdf.set_text_color(60, 50, 20)
pdf.set_x(M); pdf.multi_cell(W, 5.5,
    "v26 核心变化：社会是文明背景，不再用建成水井/泵/轴工位来结束时代。玩家可随时主动结算（erasettle）进入下一社会；"
    "每个时代锁定一部分科技；同时提供不依赖科技树的公共服务。家庭建设（井/泵/轴工位）是可选优化，不是过关条件。",
    border=1, fill=True)
pdf.ln(4)

heading("〇、所有阶段通用的行动（无阶段限制）", 13)
table(
    ["类别", "具体行动"],
    [
        ["生存与采集", "采集食物 / 木材 / 黏土（农业阶段食物采集 +1）；临时做工；卖货（sell / sellfood 各类商品与材料）"],
        ["农业", "播种 / 管理收获小麦、大豆、亚麻；持续耕作（farmcycle，安排后季末自动收获复种）；施用堆肥（学 A3 后）"],
        ["生活安排", "食品策略（自给优先 / 市场生活 / 保留储备）；每季购粮预算；饭后储备目标；委托社会配送或本人赶集；休息；营养疗养；季末交接（后辈满 18 岁后）"],
        ["商城", "购物车增减商品、清空；确认整单采购（现货立即交付，订货下季到）；维修设备；委托培训雇工"],
        ["回合与社会", "结束本季；结算当前社会并进入下一段（erasettle:stage）——按当前产能推算剩余时间并兑现本阶段回报，不要求建成水井或泵"],
        ["学习", "branchlearn / 留存 / 教导（课程按阶段锁定，见下）"],
    ],
    widths=[W * 0.22, W * 0.78],
)

heading("一、农业村落（第 1 阶段，开局）", 13)
table(
    ["项目", "内容"],
    [
        ["阶段定位", "农社靠天吃饭。公地采食与帮工不耗科技；收获回报权重最高（foodWeight 3）。成形、流体、泵、工厂知识尚未开放。"],
        ["可学课程", "农学 A0/A1/A3/A4；材料 M0（识别）/M3（食品储存）；力学 L0；组织 O0（劳动分工）；数学 Q0（基础数学）；井渠 A2"],
        ["社会服务", "公地采食 +1（gatherBonus）；村社帮工收入 +1（workBonus）；食品到货 4、服务容量 3"],
        ["可建设（可选）", "人工供水（学 A1 后）；家庭水井（学 A2 + 4 木 + 2 黏土）——建井提升本阶段结算产能推算，但不要求"],
        ["回报要点", "收获凭证权重大；无公共供水时旱季收成按当地气候折减"],
    ],
    widths=[W * 0.22, W * 0.78],
)

heading("二、集镇分工（第 2 阶段）", 13)
table(
    ["项目", "内容"],
    [
        ["阶段定位", "集镇提供公井灌溉，不必先造泵。市集扩大；密封、流体、泵和分工课程在此开放。产出权重 food 2 / craft 2。"],
        ["新开放课程", "材料 M1（成形与连接）/M2（密封工艺）；力学 L1（机械传动）/L2（压力与流体）/L3（泵与供水）；组织 O1（生产工序）/O2（采购与交付）；数学 Q1（应用数学）/Q2（账目与计量）；核算 O3（集镇生产核算，凭证 +25%）"],
        ["新社会服务：集镇公井", "旱季自动为家庭田补水，无需泵科技、无需建泵；供水保障（waterSecured）由社会承担"],
        ["其他服务", "食品到货 3、服务容量 4；无采食/帮工加成"],
        ["新解锁行动", "雇佣普通雇工（学 O0 后）；雇佣熟练农工 / 工匠（学 O1 后）；可制造密封件、锻打工具组、阀门、活塞泵等（对应课程+材料）"],
        ["回报要点", "公井保障旱季灌溉，收成推算不再折减"],
    ],
    widths=[W * 0.22, W * 0.78],
)

heading("三、工业城镇（第 3 阶段）", 13)
table(
    ["项目", "内容"],
    [
        ["阶段定位", "公共采购提供稳定铁料和电工材料；公共磨坊可把小麦磨成面粉。水力、发电和工厂管理在此开放。产出权重 food 1 / craft 3（加工回报高）。"],
        ["新开放课程", "力学 L4（水力动力）/L5（电磁转换基础）/L6（发电机系统）；材料 M4（电工绝缘）/M5（导线与绕组工艺）；核算 O4（工厂批次管理，凭证 +25%）"],
        ["新社会服务：公共磨坊", "2 小麦 → 1 面粉，付 1 钱，每季一次，无需磨粮知识或设备（私人磨粮产量更高，作为保底手段）"],
        ["其他服务", "公共采购：稳定铁料与电工材料市场；集镇公井仍有效（publicWell=true）；食品到货 4、服务容量 6"],
        ["新解锁行动", "制造链：密封件 → 锻打工具组 → 阀门 → 活塞泵 → 传动轴；建设单工位轴加工、排水设施、水力/发电设备等"],
        ["回报要点", "加工凭证权重最高；公共磨坊可低门槛转化面粉"],
    ],
    widths=[W * 0.22, W * 0.78],
)

heading("四、现代社会（第 4 阶段）", 13)
table(
    ["项目", "内容"],
    [
        ["阶段定位", "市政配送口粮、可付费自来水。配电课程和最终家业试炼在此开放。自来水不追溯取消前期水井的价值。产出权重 food 1 / craft 3。"],
        ["新开放课程", "力学 L7（基础配电）；核算 O5（当代生产调度，凭证 +25%）"],
        ["新社会服务", "市政口粮配送（现代零售提供配送，无需切换/赶集）；付费自来水（tap:on，每个确实缺水的季节支付 1 钱由公共服务人员补 2 水分，无需求不收费）；最终副本跨代家业试炼"],
        ["社会卡「重视教育」", "首次学习少 1 时间；生产回报凭证按九成计算——教育投入与当期回报需要取舍"],
        ["供水变化", "集镇公井停用（publicWell=false），改为自来水；接入后供水保障恢复（tap + waterSecured）"],
        ["最终副本（仅此阶段）", "进入后通过 4 种工作推进进度至 6 格：交付 4 份家庭余粮（+1）、交付 2 根传动轴（+2）、支付 10 钱委托专业施工（+1）、完成一轮数学方案验算（需 Q1+L0，+1）。副本完成并主动结算后即旅程胜利；副本只影响胜负，不是离开现代的条件。"],
    ],
    widths=[W * 0.22, W * 0.78],
)

heading("需要注意的阶段锁与机制", 13)
pdf.set_fill_color(253, 236, 234); pdf.set_draw_color(217, 138, 138)
pdf.set_font("cjk", "", 9.5); pdf.set_text_color(80, 30, 30)
notes = [
    "科技按阶段锁定：每门课有 unlockEra（0-3），当前社会未开放的课程显示“当前社会尚未开放”，无法提前学（v25 的自由点科技在 v26 已回退为锁课）。",
    "核算课不叠乘：O3 / O4 / O5 三门各自使实际生产阶段回报凭证 +25%，三门不叠乘。",
    "社会服务替代科技线：集镇公井 → 泵线非必需；工业公共磨坊 → 磨粮知识/设备非必需；现代自来水 → 供水保障改由付费服务。",
    "主动结算的取舍：随时可结算进入下一社会，但按当前产能推算剩余时间兑现——未建井/泵/轴工位时旱季收成折减，结算收益低于建设完备后。快节奏与富收益二选一。",
    "持续耕作预留：安排持续耕作后每季预留农事时间/精力（可暂停腾出），与阶段无关，三局观察一致。",
]
pdf.set_x(M)
body = "\n".join("• " + t for t in notes)
pdf.multi_cell(W, 5.5, body, border=1, fill=True)
pdf.ln(6)

pdf.set_text_color(119, 119, 119)
pdf.set_font("cjk", "", 8.5)
pdf.set_x(M)
pdf.multi_cell(W, 4.5,
    "整理时间：2026-09-15 · 规则版本 0.26.0 · 依据 docs/CIVILIZATION_ERAS_V26.md、src/game/model/eras.ts、"
    "src/game/model/branches.ts、src/game/actions/eras.ts 及三局试玩观察（river/clay-valley/woodland）。")

OUT = BASE / "v26-各阶段能力对照.pdf"
pdf.output(str(OUT))
print("PDF written:", OUT, OUT.stat().st_size, "bytes")