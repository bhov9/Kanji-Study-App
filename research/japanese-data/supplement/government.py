"""Extract government tables from the pinned page and PDF snapshots."""
import json
import re
from collections import Counter
from lxml import html
import pdfplumber
from acquire import HERE, RAW

STAGES = ["elementary","junior_high","senior_high"]


def lines(cell):
    for br in cell.xpath(".//br"):
        br.tail = "\n" + (br.tail or "")
    return [s.strip() for s in cell.text_content().split("\n")]


def agency():
    tree = html.fromstring((RAW/"joyo.html").read_bytes().decode("cp932"))
    entries = []
    for kanji, reading, examples, notes in tree.xpath('//table[@summary="kanji"]/tbody/tr'):
        forms = lines(kanji)[0]
        readings = list(filter(None,lines(reading)))
        groups = []
        for line in lines(examples):
            if groups and groups[-1].endswith("，"):
                groups[-1] += line
            else:
                groups.append(line)
        if len(groups) != len(readings):
            filled = [g for g in groups if g]
            if len(filled) == len(readings):
                groups = filled
            else:
                while len(groups) > len(readings) and not groups[-1]:
                    groups.pop()
        assert len(groups) == len(readings), forms
        entries.append(dict(kanji=forms[0], heading=forms, readings=readings,
                            examples_by_reading=[g.split("，") if g else [] for g in groups], note_lines=lines(notes)))
    representatives = {}
    for path in sorted(RAW.glob("table_*.html")):
        page = html.fromstring(path.read_bytes())
        for row in page.xpath("//tr[td[2]/img]"):
            number = int(row[0].text_content().strip())
            representatives[number] = dict(kanji=row[1].xpath(".//img")[0].get("alt"),
                reading=row[2].text_content().strip(), source=path.name)
    assert len(entries) == len(representatives) == 2136
    for i, entry in enumerate(entries,1):
        entry["representative_index"] = representatives[i]
    return entries


def write(name, records):
    with (HERE/name).open("w",encoding="utf8") as f:
        for r in records:
            f.write(json.dumps(r,ensure_ascii=False)+"\n")


def mext(pages):
    stages, appendix = [], []
    for i, words in enumerate(pages[1:],1):
        main = i < 50
        width = 240.2 if main else 237.5
        for column in range(3):
            offset = column * width
            region = [w for w in words if 55 <= w["x0"]-offset < 55+width]
            marks = sorted((w for w in region if w["text"]=="○"),key=lambda w:w["top"])
            for j, mark in enumerate(marks):
                y = mark["top"]
                stage = STAGES[round((mark["x0"]-offset-(192 if main else 195))/(40 if main else 38))]
                row = [w for w in region if abs(w["top"]-y)<4]
                def cell(lo, hi):
                    return "".join(w["text"] for w in sorted(row,key=lambda w:w["x0"]) if lo<=w["x0"]-offset<hi)
                if main:
                    heading = cell(60,88)
                    # The heading for this row is absent from the PDF text layer.
                    if i == 19 and column == 2 and cell(110,180) == "シツ" and abs(y-185)<1:
                        heading = "𠮟"
                    if heading:
                        kanji, grade = heading,cell(88,110)
                    reading = cell(110,180)
                    assert reading
                    stages.append(dict(kanji=kanji, reading=reading, stage=stage,
                        limited_usage=any(126<=w["x0"]-offset<132 for w in row if w["text"]==reading),
                        character_grade=int(grade) if grade else None,pdf_page=i+1))
                else:
                    end = marks[j+1]["top"]-4 if j+1<len(marks) else y+18
                    contents = [w for w in region if y-4<=w["top"]<min(end,y+18) and w["text"] not in ("漢","字","音","訓")]
                    forms = [w["text"] for w in contents if 65<=w["x0"]-offset<120]
                    reading = "".join(w["text"] for w in contents if 125<=w["x0"]-offset<178)
                    assert forms and reading
                    appendix.append(dict(forms=forms,reading=reading,stage=stage,pdf_page=i+1,
                        appendix=2 if i==51 and column==1 and y>200 else 1))
    assert len(stages)==4388 and len({r["kanji"] for r in stages})==2136
    return stages,appendix


if __name__ == "__main__":
    entries = agency()
    pages = []
    with pdfplumber.open(RAW/"mext.pdf") as doc:
        for page in doc.pages:
            pages.append(page.extract_words(x_tolerance=1,y_tolerance=2))
            page.close()
    stages, appendix = mext(pages)
    assert {(r["kanji"], v) for r in entries for v in r["readings"]} == {
        (r["kanji"], r["reading"]) for r in stages}
    assert all(r["readings"][0] == r["representative_index"]["reading"] for r in entries)
    write("joyo.jsonl",entries)
    write("stages.jsonl",stages)
    write("appendices.jsonl",appendix)
    print(len(entries),len(stages),len(appendix),Counter(r["stage"] for r in stages))
