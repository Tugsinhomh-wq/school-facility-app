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


def bottom_border(p):
    ppr = p._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for k, v in (("w:val", "single"), ("w:sz", "6"), ("w:space", "4"), ("w:color", "000000")):
        bottom.set(qn(k), v)
    borders.append(bottom)
    ppr.append(borders)


def labelled(doc, label, value, **kw):
    p = para(doc, **kw)
    add_text(p, label, bold=True)
    add_text(p, " " + value)
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

    title = para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, after=12)
    add_text(title, "บันทึกข้อความ", bold=True, size=29)

    labelled(doc, "ส่วนราชการ", memo["agency"])

    row = para(doc)
    row.paragraph_format.tab_stops.add_tab_stop(Cm(8))
    add_text(row, "ที่", bold=True)
    add_text(row, " " + memo["refNo"])
    row.add_run("\t")
    add_text(row, "วันที่", bold=True)
    add_text(row, " " + memo["date"])

    subject = labelled(doc, "เรื่อง", memo["subject"], after=6)
    bottom_border(subject)
    labelled(doc, "เรียน", memo["recipient"], after=8)

    for text in memo["paragraphs"]:
        add_text(para(doc, first_line=2.5, after=6), text)
    if memo.get("proposal"):
        add_text(para(doc, first_line=2.5, after=6), memo["proposal"])
    add_text(para(doc, first_line=2.5, after=18), memo["closing"])

    def signature(name, position):
        add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), "ลงชื่อ ................................................")
        if name:
            add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), f"({name})")
        if position:
            add_text(para(doc, align=WD_ALIGN_PARAGRAPH.CENTER, left=8), position)

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
