"""
Excel & CSV Smart Importer Engine for FrameForge OS.
Zero-external-dependency fallback with XML/ZIP parsing for standard .xlsx and UTF-8 / GBK CSV.
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from xml.etree import ElementTree as ET

# Comprehensive Field Aliases Dictionary (Spec Section 115)
ALIASES: dict[str, list[str]] = {
    "number": ["镜号", "镜头编号", "编号", "shot", "shot no", "shot number", "序号", "no", "id", "分镜号"],
    "name": ["镜头标题", "标题", "内容", "镜头内容", "shot title", "title", "name", "镜头名称"],
    "chapter": ["篇章", "章节", "幕", "chapter", "act", "sequence", "seq", "篇章名称"],
    "scene": ["场景", "地点", "场景/地点", "scene", "location", "int/ext", "内外景"],
    "description": ["画面描述", "画面内容", "画面", "分镜画面", "description", "visual", "action", "画面设计", "画面构图"],
    "voiceover": ["对应旁白", "旁白", "解说词", "配音", "voiceover", "vo", "narration", "dialogue", "对白", "台词"],
    "duration": ["时长", "时长(秒)", "时长（秒）", "duration", "seconds", "sec", "length", "建议时长"],
    "duration_frames": ["帧数", "frames", "frame count", "duration frames", "规划帧数"],
    "shot_size": ["景别", "shot size", "framing", "size", "镜头景别"],
    "lens_mm": ["焦段", "建议焦段", "镜头焦段", "镜头", "lens", "focal", "镜头毫米数"],
    "movement": ["机位/运镜", "运镜", "镜头运动", "movement", "camera movement", "camera", "机位运镜", "运镜方式"],
    "camera_angle": ["机位角度", "角度", "angle", "camera angle", "拍摄角度"],
    "primary_method": ["制作方式", "执行方式", "拍摄方式", "制作类型", "method", "production method", "execution", "制作属性"],
    "department": ["责任部门", "责任组", "部门", "department", "dept", "制作部门"],
    "owner_id": ["负责人", "执行人", "owner", "assignee", "artist", "责任人"],
    "director_notes": ["备注", "制作备注", "导演备注", "notes", "director notes", "comment", "注意事项"],
    "vfx": ["vfx", "特效", "视效", "cg", "vfx requirement", "视效需求"]
}


def parse_csv(content: bytes) -> list[list[str]]:
    """Parse CSV with automatic UTF-8 / GBK / GB18030 decoding."""
    text = ""
    for enc in ["utf-8-sig", "utf-8", "gb18030", "gbk", "latin-1"]:
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    if not text:
        return []

    reader = csv.reader(io.StringIO(text))
    rows: list[list[str]] = []
    for r in reader:
        if any(c.strip() for c in r):
            rows.append([c.strip() for c in r])
    return rows


def parse_xlsx_stdlib(content: bytes) -> list[list[str]]:
    """Zero-dependency standard library .xlsx parser using zipfile + ElementTree."""
    rows: list[list[str]] = []
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            # 1. Read shared strings if present
            shared_strings: list[str] = []
            if "xl/sharedStrings.xml" in zf.namelist():
                ss_tree = ET.fromstring(zf.read("xl/sharedStrings.xml"))
                for si in ss_tree.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                    t_nodes = si.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                    shared_strings.append("".join(t.text or "" for t in t_nodes))

            # 2. Read first sheet
            sheet_name = "xl/worksheets/sheet1.xml"
            if sheet_name not in zf.namelist():
                # find first sheet
                for name in zf.namelist():
                    if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
                        sheet_name = name
                        break

            if sheet_name in zf.namelist():
                sheet_tree = ET.fromstring(zf.read(sheet_name))
                for row_node in sheet_tree.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
                    row_cells: list[str] = []
                    for c_node in row_node.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                        cell_type = c_node.get("t")
                        v_node = c_node.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                        val = v_node.text if v_node is not None and v_node.text else ""

                        if cell_type == "s" and val.isdigit():
                            idx = int(val)
                            val = shared_strings[idx] if idx < len(shared_strings) else val

                        row_cells.append(str(val).strip())

                    if any(row_cells):
                        rows.append(row_cells)
    except Exception as exc:
        print(f"Error parsing xlsx via stdlib: {exc}")

    return rows


def parse_table(content: bytes, filename: str) -> list[list[str]]:
    """Dispatch table parsing based on filename extension."""
    if filename.lower().endswith(".csv"):
        return parse_csv(content)
    return parse_xlsx_stdlib(content)


def map_headers(headers: list[str]) -> dict[str, dict]:
    """
    Intelligently match table header strings to domain fields.
    Returns mapping with column index, matched alias, and confidence score.
    """
    mapping: dict[str, dict] = {}

    for col_idx, raw_header in enumerate(headers):
        clean = re.sub(r"[\s_（）()\-_]+", "", str(raw_header).lower())
        if not clean:
            continue

        best_field: str | None = None
        best_score = 0.0

        for field, alias_list in ALIASES.items():
            for alias in alias_list:
                clean_alias = re.sub(r"[\s_（）()\-_]+", "", alias.lower())
                if clean == clean_alias:
                    score = 1.0
                elif clean_alias in clean or clean in clean_alias:
                    score = 0.8
                else:
                    score = 0.0

                if score > best_score:
                    best_score = score
                    best_field = field

        if best_field and best_score >= 0.8 and best_field not in mapping:
            mapping[best_field] = {
                "col": col_idx,
                "raw_header": raw_header,
                "confidence": best_score
            }

    return mapping
