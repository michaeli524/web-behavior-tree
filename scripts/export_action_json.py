#!/usr/bin/env python3
"""Export the designer-maintained Action XLSX table to frontend JSON."""

from __future__ import annotations

import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = ROOT / "public" / "config" / "Actions.xlsx"
JSON_PATH = ROOT / "public" / "config" / "Actions.json"

NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

FIELD_MAP = {
    "ActionId": "actionId",
    "ActionName": "actionName",
    "GifPath": "gifPath",
    "Comment": "comment",
}

REQUIRED_HEADERS = ["ActionId", "ActionName", "GifPath", "Comment"]


def column_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    index = 0
    for ch in letters:
        index = index * 26 + (ord(ch.upper()) - 64)
    return index - 1


def read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        xml = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []

    root = ET.fromstring(xml)
    values: list[str] = []
    for si in root.findall("main:si", NS):
      parts = [node.text or "" for node in si.findall(".//main:t", NS)]
      values.append("".join(parts))
    return values


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        text_node = cell.find(".//main:t", NS)
        return text_node.text if text_node is not None and text_node.text is not None else ""

    value_node = cell.find("main:v", NS)
    if value_node is None or value_node.text is None:
        return ""

    if cell_type == "s":
        return shared_strings[int(value_node.text)]

    return value_node.text


def normalize_media_path(value: str) -> str:
    return value.strip().replace("\\", "/")


def read_rows() -> list[list[str]]:
    with zipfile.ZipFile(XLSX_PATH) as zf:
        shared_strings = read_shared_strings(zf)
        sheet = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))

    rows: list[list[str]] = []
    for row in sheet.findall(".//main:row", NS):
        values: dict[int, str] = {}
        for cell in row.findall("main:c", NS):
            ref = cell.attrib.get("r", "")
            values[column_index(ref)] = cell_value(cell, shared_strings).strip()
        if values:
            max_col = max(values)
            rows.append([values.get(i, "") for i in range(max_col + 1)])
    return rows


def export_actions() -> list[dict[str, str]]:
    rows = read_rows()
    if len(rows) < 2:
        raise ValueError("Actions.xlsx must contain English headers and Chinese comments.")

    headers = rows[0]
    missing = [header for header in REQUIRED_HEADERS if header not in headers]
    if missing:
        raise ValueError(f"Actions.xlsx missing required headers: {', '.join(missing)}")

    actions: list[dict[str, str]] = []
    for row in rows[2:]:
        record: dict[str, str] = {}
        for index, header in enumerate(headers):
            key = FIELD_MAP.get(header)
            if key:
                value = row[index].strip() if index < len(row) else ""
                if key == "gifPath":
                    record[key] = normalize_media_path(value)
                else:
                    record[key] = value

        if not record.get("actionId"):
            continue
        actions.append(record)

    JSON_PATH.write_text(json.dumps(actions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return actions


def main() -> None:
    actions = export_actions()
    print(json.dumps({
        "ok": True,
        "source": str(XLSX_PATH.relative_to(ROOT)),
        "target": str(JSON_PATH.relative_to(ROOT)),
        "count": len(actions),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
