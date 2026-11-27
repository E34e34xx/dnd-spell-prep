"""Build a self-contained offline HTML page and validate the locale catalog."""
import csv
import json
import re
from pathlib import Path

APP = Path(__file__).resolve().parent
ROOT = APP.parent
LANGS = ("zh-Hant", "zh-Hans", "en", "ja", "ko")


def read_catalog():
    with (APP / "messages.tsv").open(encoding="utf-8", newline="") as file:
        rows = csv.reader(file, delimiter="\t")
        if tuple(next(rows)) != LANGS:
            raise ValueError("Unexpected locale columns")
        messages = {}
        for line, row in enumerate(rows, 2):
            if len(row) != len(LANGS) or any(not word.strip() for word in row):
                raise ValueError(f"Incomplete translation on row {line}")
            key, *translations = row
            if key in messages:
                raise ValueError(f"Duplicate translation key: {key}")
            args = sorted(re.findall(r"\{\d+\}", key))
            if any(sorted(re.findall(r"\{\d+\}", text)) != args for text in translations):
                raise ValueError(f"Placeholders do not match: {key}")
            messages[key] = translations
        return messages


def build():
    messages = read_catalog()
    page = (APP / "page.html").read_text(encoding="utf-8")
    # Escape markup in the generated JavaScript string table.
    catalog = json.dumps(messages, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    assets = {"MESSAGES": f"const MESSAGES = {catalog};"}
    for marker, filename in {
        "STYLES": "styles.css", "I18N": "i18n.js", "RULES": "rules.js", "APP": "app.js"
    }.items():
        assets[marker] = (APP / filename).read_text(encoding="utf-8")
    for marker, code in assets.items():
        slot = f"/* {marker} */"
        if page.count(slot) != 1:
            raise ValueError(f"Expected one template marker: {slot}")
        page = page.replace(slot, code)
    output = ROOT / "docs" / "index.html"
    output.parent.mkdir(exist_ok=True)
    output.write_text(page, encoding="utf-8", newline="\n")
    print(f"Built {output.relative_to(ROOT)} with {len(messages)} messages in {len(LANGS)} languages")


if __name__ == "__main__":
    build()
