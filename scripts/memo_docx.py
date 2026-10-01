#!/usr/bin/env python3
"""Builds the memo (บันทึกข้อความ) as a Word file, following the thai-docx skill.

Reads the memo JSON (the MemoDoc shape from src/lib/memo/model.ts) on stdin and
writes the .docx bytes to stdout. Uses python-docx with LEFT alignment and
zero-width-space word breaks so Thai text fills each line.

    pip install -r scripts/requirements.txt
"""

import io
import json
import sys

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.shared import Cm, Pt

from thai_zwsp import insert_zwsp

FONT = "TH Sarabun New"
SIZE = 16
SCHOOL = "โรงเรียนละหานทรายรัชดาภิเษก"


def style_run(run, bold=False, size=SIZE, font=FONT):
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    rpr = run._r.get_or_add_rPr()
    fonts = rpr.get_or_add_rFonts()
    fonts.set(qn("w:cs"), font)  # complex script (Thai) font
    for tag, val in (("w:szCs", str(size * 2)),):
        el = OxmlElement(tag)
        el.set(qn("w:val"), val)
        rpr.append(el)
    if bold:
        rpr.append(OxmlElement("w:bCs"))
    lang = OxmlElement("w:lang")
    lang.set(qn("w:val"), "th-TH")
    lang.set(qn("w:bidi"), "th-TH")
    rpr.append(lang)


def add_text(p, text, bold=False, size=SIZE, font=FONT):
    run = p.add_run(insert_zwsp(text))
    style_run(run, bold, size, font)
    return run


def para(doc, *, align=WD_ALIGN_PARAGRAPH.LEFT, first_line=None, left=None, before=0, after=0):
    p = doc.add_paragraph()
    p.alignment = align
    f = p.paragraph_format
    f.line_spacing = 1.0
    f.space_before = Pt(before)
    f.space_after = Pt(after)
    if first_line is not None:
        f.first_line_indent = Cm(first_line)
    if left is not None:
        f.left_indent = Cm(left)
    return p


def labelled(doc, label, value, size=SIZE, bold_value=False, **kw):
    """label (bold) + value, then a dotted leader out to the right margin."""
    p = para(doc, **kw)
    p.paragraph_format.tab_stops.add_tab_stop(Cm(16), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
    add_text(p, label, bold=True, size=size)
    add_text(p, " " + value, bold=bold_value, size=size)
    p.add_run("\t")
    return p


def build(memo: dict) -> bytes:
    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(SIZE)
    normal.element.rPr.rFonts.set(qn("w:cs"), FONT)

    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.top_margin, sec.bottom_margin = Cm(2.5), Cm(2.0)
    sec.left_margin, sec.right_margin = Cm(3.0), Cm(2.0)

    # Header: garuda (1.5 cm high) at the left, the title centred; borderless 3 + 10 + 3 cm table.
    header = doc.add_table(rows=1, cols=3)
    header.alignment = WD_TABLE_ALIGNMENT.LEFT
    header.autofit = False
    for col, cell, width in zip(header.columns, header.rows[0].cells, (3, 10, 3)):
        col.width = Cm(width)
        cell.width = Cm(width)
    garuda_cell, title_cell, _ = header.rows[0].cells
    garuda_cell.paragraphs[0].add_run().add_picture(memo["garuda"], height=Cm(2.2))
    title_p = title_cell.paragraphs[0]
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_p.paragraph_format.space_before = Pt(18)
    add_text(title_p, "บันทึกข้อความ", bold=True, size=24)

    repair = memo.get("variant") == "repair"
    labelled(doc, "ส่วนราชการ", memo["agency"], before=6)

    row = para(doc)
    row.paragraph_format.tab_stops.add_tab_stop(Cm(7.8), WD_TAB_ALIGNMENT.LEFT, WD_TAB_LEADER.DOTS)
    row.paragraph_format.tab_stops.add_tab_stop(Cm(8))
    row.paragraph_format.tab_stops.add_tab_stop(Cm(16), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
    add_text(row, "ที่", bold=True)
    add_text(row, " " + memo["refNo"])
    row.add_run("\t\t")
    add_text(row, "วันที่", bold=True)
    add_text(row, " " + memo["date"])
    row.add_run("\t")

    labelled(doc, "เรื่อง", memo["subject"])
    labelled(doc, "เรียน", memo["recipient"], after=6)

    for text in memo["paragraphs"]:
        add_text(para(doc, first_line=2.5, after=2), text)
    if memo.get("proposal"):
        add_text(para(doc, first_line=2.5, after=2), memo["proposal"])
    add_text(para(doc, first_line=2.5, after=18), memo["closing"])

    def signature(name, position):
        add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), "ลงชื่อ ................................................")
        if name:
            add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), f"({name})")
        if position:
            add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), position)

    if repair:
        add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), "(ลงชื่อ)...................... ผู้รายงาน")
        add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), f"({memo.get('signerName') or '...........................................'})")
        add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), f"ตำแหน่ง {memo.get('signerPosition') or '..........................................'}")
        if memo.get("decisionBlock"):
            def dotted_line():
                p = para(doc)
                p.paragraph_format.tab_stops.add_tab_stop(Cm(16), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
                p.add_run("\t")

            def sign(position=None):
                add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8, before=14), "ลงชื่อ ..............................")
                add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), "(..............................)")
                if position:
                    add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), position)

            add_text(para(doc, before=14), "ความเห็นของหัวหน้างานอาคารสถานที่ / รองผู้อำนวยการกลุ่มบริหารทั่วไป", bold=True)
            dotted_line()
            sign()
            add_text(para(doc, before=14), "คำสั่งการ / การพิจารณาของผู้อำนวยการโรงเรียน", bold=True)
            add_text(para(doc, left=0.5), "☐ อนุมัติ        ☐ ไม่อนุมัติ")
            dotted_line()
            sign("ผู้อำนวยการโรงเรียน")
    else:
        signature(memo.get("signerName", ""), memo.get("signerPosition", ""))
        if memo.get("decisionBlock"):
            add_text(para(doc, before=24, after=4), "ความเห็นของผู้อำนวยการ", bold=True)
            add_text(para(doc, after=12), "☐ อนุมัติ        ☐ ไม่อนุมัติ        ☐ อื่น ๆ ..........................................")
            signature("................................................", f"ผู้อำนวยการ{SCHOOL}")

    doc.core_properties.author = SCHOOL
    doc.core_properties.title = memo["subject"]

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


if __name__ == "__main__":
    data = json.load(sys.stdin)
    sys.stdout.buffer.write(build(data))
