"""Zero-width-space insertion for Thai text, from the thai-docx skill (scripts/thai_docx.py).

Word does not know where Thai words end, so it wraps lines early. Inserting U+200B
between the words (segmented with pythainlp's dictionary tokenizer) tells Word where
it may break. English text, numbers and URLs are left untouched.
"""

import re

from pythainlp import word_tokenize

ZWS = "​"
_THAI = re.compile(r"([฀-๿]+)")


def insert_zwsp(text: str, engine: str = "newmm") -> str:
    parts = _THAI.split(text)
    out = []
    for part in parts:
        if _THAI.fullmatch(part):
            out.append(ZWS.join(word_tokenize(part, engine=engine)))
        else:
            out.append(part)
    return "".join(out)
