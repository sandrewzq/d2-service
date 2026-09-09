#!/usr/bin/env python3
"""生成 T20 单 CSV 武器推荐知识库。

规则：
- 来源 Hash 和 Manifest 版本用于证明官方身份、Perk 和可用版本，运行时仍允许同一英文身份跨版本匹配。
- 正式 CSV 按官方英文武器身份汇总，一个武器身份 + 一个推荐来源一行；同一身份的历史/高阶版本共用推荐池，官方中文同名但英文身份不同的武器保持独立。
- 玩家判断使用实例实际拥有的第三栏、第四栏 Perk；枪管、弹匣、大师和起源特性是加分条件。
- 附加推荐只在部分同名版本中存在时保留并标注“部分版本具备”；所有同名版本都无法证明时标记为已忽略，不参与匹配。
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sqlite3
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
GUIDE_DIR = ROOT / "攻略"
OUTPUT_DIR = GUIDE_DIR / "T20-武器推荐知识库"
CLASS_ITEM_OUTPUT_DIR = GUIDE_DIR / "T20-异域职业物品推荐"
TMP_DIR = ROOT / ".local-data" / "tmp" / "T20-推荐知识库生成"
APP_DATA = Path.home() / "Library" / "Application Support" / "d2-tools"
MANIFEST_DIR = APP_DATA / "manifest" / "sqlite" / "zh-chs" / "active"
WORLD_DB = MANIFEST_DIR / "world.sqlite"
SEARCH_EN_DB = MANIFEST_DIR / "search-en.sqlite"
STATUS_JSON = MANIFEST_DIR / "status.json"

YX_SOURCE = GUIDE_DIR / "YXCRALLXY推荐表.xlsx"
SAYALARRY_SOURCE = GUIDE_DIR / "Sayalarry推荐表.xlsx"
STARSIDE_AEGIS = GUIDE_DIR / "Starside-PVE终局刷取数据快照" / "Aegis武器推荐.csv"
AEGIS_OFFICIAL_WEAPONS = GUIDE_DIR / "aegis推荐表_官方中文CSV" / "03_传奇武器.csv"
STARSIDE_LGPIG_LEGENDARY = GUIDE_DIR / "Starside-PVE终局刷取数据快照" / "LGpig传说武器推荐.csv"
STARSIDE_LGPIG_EXOTIC = GUIDE_DIR / "Starside-PVE终局刷取数据快照" / "LGpig异域武器推荐.csv"
DEFAULT_DIM = ROOT / ".local-data" / "tmp" / "dim-voltron-reference.txt"
DEFAULT_DIM_REVISION = "ce2cbcc3b3b3d4b7ebc62f2ddf0502b00f4dadfd"

WEAPON_OUTPUT = OUTPUT_DIR / "武器推荐.csv"
CLASS_ITEM_OUTPUT = CLASS_ITEM_OUTPUT_DIR / "异域职业物品推荐组合.csv"
WEAPON_CANDIDATE_OUTPUT = TMP_DIR / "武器推荐候选.csv"
CLASS_ITEM_CANDIDATE_OUTPUT = TMP_DIR / "异域职业物品推荐组合候选.csv"
ISSUE_OUTPUT = TMP_DIR / "异常报告.csv"
RECORD_OUTPUT = TMP_DIR / "生成记录.txt"
MAX_CSV_NOTE_LENGTH = 4_000
TRUNCATED_NOTE_SUFFIX = "……（原文过长已截断，完整出处见‘来源URL’和‘来源位置’）"

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

SOURCE_ORDER = {
    "aegis": 0,
    "lgpig": 1,
    "yxcrallxy": 2,
    "sayalarry": 3,
    "dim_voltron": 4,
}
SOURCE_LABELS = {
    "aegis": "Aegis推荐",
    "lgpig": "LGpig推荐",
    "yxcrallxy": "YXCRALLXY推荐表",
    "sayalarry": "Sayalarry推荐表",
    "dim_voltron": "DIM社区愿望单",
}
SOURCE_URLS = {
    "aegis": "https://docs.google.com/spreadsheets/d/1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY/edit?gid=346832350#gid=346832350",
    "lgpig": "https://starside.work/pve-farming/index.html",
    "yxcrallxy": "https://docs.qq.com/sheet/DYkR5enNIdUt1VFhK?tab=000001&_t=1788087335795&nlc=1",
    "sayalarry": "https://sa7vp10ytxr.feishu.cn/wiki/W3ySwdahTiNRUJklJNBc0CMPnkb",
    "dim_voltron": "https://github.com/48klocs/dim-wish-list-sources",
}
PURPOSE_ORDER = {"PVE": 0, "PVP": 1, "通用": 2, "未标注": 3}

WEAPON_FIELDS = [
    "页面", "分类", "武器", "评级", "排名", "来源URL", "页面更新时间", "来源位置", "图标", "图标图标URL",
    "属性", "框架", "赛季", "来源", "勇士", "勇士图标URL", "弹药生成", "枪管", "弹匣", "大师",
    "Perk 1", "Perk 2", "起源特性", "注解", "护盾", "充能效率",
    "武器ID", "英文名称", "版本", "推荐来源", "用途",
]
CLASS_ITEM_FIELDS = [
    "组合ID", "物品ID", "物品名称", "英文名称", "职业", "物品类型", "品质", "用途", "使用场景",
    "第一特性", "第一特性ID", "第二特性", "第二特性ID", "来源", "说明", "来源数据",
]
ISSUE_FIELDS = ["级别", "来源", "来源位置", "武器名称", "候选武器ID", "问题类型", "问题说明"]
VERSION_MATCH_ISSUE_TYPES = {"来源核心Perk不属于候选版本", "候选版本缺少完整两栏推荐"}

MASTERWORK_TRANSLATIONS = {
    "range": "射程", "handling": "操控性", "reload": "填装速度", "reload speed": "填装速度",
    "stability": "稳定性", "velocity": "弹头速度", "charge time": "充能时间", "impact": "冲击",
    "blast radius": "爆炸范围", "draw time": "拔枪速度", "shield duration": "护盾持续时间",
    "cooling efficiency": "冷却效率",
    "换弹": "填装速度", "操控": "操控性", "稳定": "稳定性", "加速": "充能时间",
    "爆炸": "爆炸范围", "爆炸半径": "爆炸范围", "拉弓速度": "拔枪速度", "拉弓时间": "拔枪速度",
    "弹速": "弹头速度", "操控射程": "操控性 / 射程",
}
AEGIS_MASTERWORK_CATEGORY_SUFFIXES = {
    "range": "range",
    "handling": "handling",
    "reload": "reload",
    "reload speed": "reload",
    "stability": "stability",
    "velocity": "velocity",
    "charge time": "charge_time",
    "impact": "damage",
    "blast radius": "blast_radius",
    "draw time": "draw_time",
    "shield duration": "shield_duration",
    "cooling efficiency": "heat_efficiency",
}
TERM_ALIASES = {
    "自填": "自动填装枪套",
    "suros协同": "SUROS协同",
}
IGNORED_SOURCE_TERMS = {"无", "无特殊要求", "有啥用啥", "无特别适配的perk", "待确认", "-", "none", "n/a"}
SOURCE_TERM_ALIASES = {
    ("lgpig", "starside:legendary-primary:table-8:row-49", "高爆弹药"): "高爆载荷",
    ("lgpig", "starside:legendary-primary:table-8:row-49:3218302023", "高爆弹药"): "高爆载荷",
    ("sayalarry", "Sheet1:96:PVE", "战壕炮管"): "战嚎炮管",
    ("sayalarry", "Sheet1:176:PVE", "嫉妒"): "嫉妒军械库",
    ("sayalarry", "Sheet1:176:PVE", "回转"): "回转弹药",
    ("sayalarry", "Sheet1:176:PVE", "聚合"): "聚合充能",
    ("sayalarry", "Sheet1:176:PVE", "诱导"): "诱导推销",
    ("sayalarry", "Sheet1:176:PVE", "元素"): "元素磨砺",
    ("sayalarry", "Sheet1:176:PVE", "战壕炮管"): "战嚎炮管",
    ("sayalarry", "Sheet1:187:PVE", "小丑皇蛋筒"): "小丑皇弹药筒",
    ("sayalarry", "Sheet1:198:PVP", "柔缓??"): "柔缓",
    ("sayalarry", "Sheet1:198:PVP", "高地??"): "高地",
    ("sayalarry", "Sheet1:69:PVE", "战壕炮管"): "战嚎炮管",
    ("sayalarry", "Sheet1:147:PVP", "打样时间"): "打烊时间",
    ("sayalarry", "Sheet1:148:PVE", "超充"): "超充弹匣",
    ("sayalarry", "Sheet1:148:PVE", "涓流"): "涓流充能",
    ("sayalarry", "Sheet1:81:PVP", "打烊时刻"): "打烊时间",
}
SOURCE_GLOBAL_TERM_ALIASES = {
    ("lgpig", "不稳定弹药"): "失衡弹药",
    ("lgpig", "嫉妒军火库"): "嫉妒军械库",
    ("lgpig", "换档"): "换挡",
    ("lgpig", "战壕炮管"): "战嚎炮管",
    ("lgpig", "福特子弹"): "伏特子弹",
    ("lgpig", "冷却饰品"): "冷却饰物",
    ("lgpig", "高强度备弹"): "高强度型弹药储备",
    ("lgpig", "小时牛刀"): "小试牛刀",
    ("lgpig", "爆炸分配器"): "爆破分配器",
    ("lgpig", "嫉妒军火"): "嫉妒军械库",
    ("lgpig", "精装工具"): "精准工具",
    ("lgpig", "光之触碰"): "光能之触",
    ("lgpig", "战壕"): "战嚎炮管",
    ("lgpig", "三连击"): "精准连击",
    ("aegis", "b 计划"): "B计划",
}
SOURCE_IGNORED_TERMS = {
    ("lgpig", "任意合适增伤"),
    ("lgpig", "余下三个 perk"),
}
SOURCE_CORE_SLOT_OVERRIDES = {
    ("aegis", "starside:shopping-primary:table-4:row-180", "辅助炸药"): 4,
    ("aegis", "starside:shopping-primary:table-4:row-180:830651379", "辅助炸药"): 4,
    ("lgpig", "starside:legendary-primary:table-5:row-27", "高爆载荷"): 4,
    ("lgpig", "starside:legendary-primary:table-5:row-27", "边打边劫"): 3,
    ("lgpig", "starside:legendary-primary:table-5:row-27:3245446311", "高爆载荷"): 4,
    ("lgpig", "starside:legendary-primary:table-5:row-27:3245446311", "边打边劫"): 3,
    ("yxcrallxy", "Sheet1:162:BM:PVE", "切割"): 3,
    ("yxcrallxy", "Sheet1:170:BM:PVE", "幼雏"): 3,
    ("yxcrallxy", "Sheet1:56:CI:PVP", "b计划"): 4,
    ("yxcrallxy", "Sheet1:64:AQ:PVE", "转向"): 3,
    ("yxcrallxy", "Sheet1:80:EA:PVE", "冷冻钢铁"): 4,
    ("yxcrallxy", "Sheet1:146:AQ:PVE", "混沌重塑"): 4,
    ("yxcrallxy", "Sheet1:148:EA:PVE", "解构"): 4,
    ("yxcrallxy", "Sheet1:152:DE:PVE", "霜华窃取者"): 3,
    ("yxcrallxy", "Sheet1:6:AQ:PVE", "辅助炸药"): 4,
    ("yxcrallxy", "Sheet1:86:AQ:PVE", "萤火虫"): 3,
}
SOURCE_WEAPON_NAME_ALIASES = {
    ("yxcrallxy", "Sheet1:40:AQ"): "受托",
    ("yxcrallxy", "Sheet1:92:U"): "明日回答",
    ("yxcrallxy", "Sheet1:42:BM"): "第七炽天使CQC-12",
    ("yxcrallxy", "Sheet1:78:BM"): "爱与死亡",
    ("yxcrallxy", "Sheet1:80:CI"): "无效安慰",
    ("yxcrallxy", "Sheet1:98:EA"): "萨耳珀冬-D",
    ("yxcrallxy", "Sheet1:106:EA"): "狮子鱼-4fr",
    ("yxcrallxy", "Sheet1:110:AQ"): "伊尔·约特的尖牙",
    ("yxcrallxy", "Sheet1:114:U"): "昨日问题",
    ("yxcrallxy", "Sheet1:118:AQ"): "断剑者",
    ("yxcrallxy", "Sheet1:120:AQ"): "伊尔·约特之歌",
    ("yxcrallxy", "Sheet1:136:EA"): "艾尔西的步枪",
    ("yxcrallxy", "Sheet1:142:DE"): "奥术之拥",
    ("yxcrallxy", "Sheet1:150:BM"): "环形逻辑",
    ("yxcrallxy", "Sheet1:200:EA"): "史赛克的老练",
    ("sayalarry", "Sheet1:80"): "霍桑的战铸霰弹枪",
}
STARSIDE_WEAPON_NAME_ALIASES = {
    "ikelos_微型冲锋枪_v1.0.3": "IKELOS_SMG_v1.0.3",
}
SOURCE_EXCLUDED_TERMS = {}
DIM_TAG_TRANSLATIONS = {
    "pve": "PVE", "god-pve": "PVE高优先级", "pve-god": "PVE高优先级",
    "pvp": "PVP", "god-pvp": "PVP高优先级", "pve-minor": "PVE小怪",
    "pve-minorspec": "PVE小怪", "pve-groupadd": "PVE群怪", "pve-endgame": "PVE高难",
    "pve-boss": "PVE首领", "pve-majorspec": "PVE精英", "pve-utility": "PVE功能",
    "pve-champion": "PVE勇士", "pve-sustaineddamage": "PVE持续输出",
    "m+kb": "键鼠", "mkb": "键鼠", "controller": "手柄",
}
BUCKET_LABELS = {1498876634: "动能", 2465295065: "能量", 953998645: "威能"}
AMMO_LABELS = {1: "主弹药", 2: "特殊弹药", 3: "重型弹药"}
ELEMENT_LABELS = {
    3373582085: "动能", 1847026933: "烈日", 2303181850: "电弧", 3454344768: "虚空",
    3949783978: "缚丝", 151347233: "冰影",
}
CLASS_LABELS = {0: "泰坦", 1: "猎人", 2: "术士"}


def unsigned_hash(value: int) -> int:
    return value + 2**32 if value < 0 else value


def is_weapon_definition(definition: dict) -> bool:
    inventory = definition.get("inventory") or {}
    equipping = definition.get("equippingBlock") or {}
    return (
        bool(definition.get("equippable"))
        and int(definition.get("itemType") or -1) == 3
        and int(inventory.get("bucketTypeHash") or 0) in BUCKET_LABELS
        and int(equipping.get("ammoType") or 0) in AMMO_LABELS
    )


def is_exotic_class_item_definition(definition: dict) -> bool:
    inventory = definition.get("inventory") or {}
    return (
        bool(definition.get("equippable"))
        and int(definition.get("itemType") or -1) == 2
        and int(definition.get("itemSubType") or -1) == 30
        and int(inventory.get("tierType") or 0) == 6
    )


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = value.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", value.strip()).casefold()


def compact_name(value: str) -> str:
    return "".join(
        character
        for character in normalize(value)
        if not character.isspace() and not unicodedata.category(character).startswith(("P", "Z"))
    )


def folded_name(value: str) -> str:
    """忽略空格、标点和拉丁字母变音符，仅用于唯一名称匹配。"""
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", compact_name(value))
        if not unicodedata.combining(character)
    )


def plug_semantic_role(definition: dict) -> str:
    """按 Bungie Plug 元数据识别组件语义，不依赖武器的物理插槽编号。"""
    category = normalize(((definition.get("plug") or {}).get("plugCategoryIdentifier") or ""))
    item_type = normalize(definition.get("itemTypeDisplayName") or "")
    if "masterwork" in category or any(value in item_type for value in ["大师杰作", "masterwork"]):
        return "masterwork"
    if "origin" in category or any(value in item_type for value in ["起源特性", "原始特性", "origin trait"]):
        return "origin"
    if any(value in category for value in [
        "barrel", "scope", "sight", "bowstring", "bow.string", "blade", "haft", "tube", "rail",
    ]):
        return "barrel"
    if any(value in category for value in ["magazine", "batter", "arrow", "guard", "stock", "grip", "bolt"]):
        return "magazine"
    return ""


def column_letters(cell_ref: str) -> str:
    match = re.match(r"([A-Z]+)", cell_ref)
    return match.group(1) if match else ""


def column_name(number: int) -> str:
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def cell_text(value: object) -> str:
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def unique(values):
    result = []
    seen = set()
    for value in values:
        if value in (None, "") or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def source_terms(value: str | list[str]) -> list[str]:
    values = value if isinstance(value, list) else [value]
    result = []
    for raw in values:
        for part in re.split(r"[\n；;、]|\s+/\s+|/", raw or ""):
            cleaned = re.sub(r"[（(][^）)]*[）)]", "", part).strip().strip("*•- ")
            if re.match(r"^(?:【|\[)?已(?:划除|删除)(?:】|\])?", cleaned):
                continue
            cleaned = TERM_ALIASES.get(normalize(cleaned), cleaned)
            if cleaned and normalize(cleaned) not in IGNORED_SOURCE_TERMS:
                result.append(cleaned)
    return unique(result)


def map_source_term(source_id: str, source_key: str, raw_term: str) -> str:
    normalized = normalize(raw_term)
    source_base_key = re.sub(r":\d+$", "", source_key)
    return SOURCE_TERM_ALIASES.get(
        (source_id, source_key, normalized),
        SOURCE_TERM_ALIASES.get(
            (source_id, source_base_key, normalized),
            SOURCE_GLOBAL_TERM_ALIASES.get((source_id, normalized), raw_term),
        ),
    )


def source_slot_override(source_id: str, source_key: str, mapped_term: str, default_slot: int | str) -> int | str:
    normalized = normalize(mapped_term)
    source_base_key = re.sub(r":\d+$", "", source_key)
    return SOURCE_CORE_SLOT_OVERRIDES.get(
        (source_id, source_key, normalized),
        SOURCE_CORE_SLOT_OVERRIDES.get((source_id, source_base_key, normalized), default_slot),
    )


def is_ignored_source_term(source_id: str, raw_term: str) -> bool:
    return (source_id, normalize(raw_term)) in SOURCE_IGNORED_TERMS


def excluded_source_terms(source_id: str, source_key: str) -> set[str]:
    return {
        normalize(term)
        for raw_term in SOURCE_EXCLUDED_TERMS.get((source_id, source_key), [])
        for term in source_terms(raw_term)
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


class WorkbookReader:
    def __init__(self, path: Path):
        self.archive = ZipFile(path)
        self.shared_strings = self._load_shared_strings()
        workbook = ET.fromstring(self.archive.read("xl/workbook.xml"))
        rels = ET.fromstring(self.archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {entry.attrib["Id"]: entry.attrib["Target"] for entry in rels}
        self.sheets = {}
        sheets_node = workbook.find(f"{{{MAIN_NS}}}sheets")
        for sheet in list(sheets_node) if sheets_node is not None else []:
            relation_id = sheet.attrib[f"{{{REL_NS}}}id"]
            self.sheets[sheet.attrib["name"]] = "xl/" + rel_map[relation_id].lstrip("/")

    def _load_shared_strings(self) -> list[str]:
        if "xl/sharedStrings.xml" not in self.archive.namelist():
            return []
        root = ET.fromstring(self.archive.read("xl/sharedStrings.xml"))
        return [
            "".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t"))
            for item in root.findall(f"{{{MAIN_NS}}}si")
        ]

    def _value(self, cell: ET.Element) -> str:
        value = cell.find(f"{{{MAIN_NS}}}v")
        kind = cell.attrib.get("t")
        if kind == "s" and value is not None:
            return self.shared_strings[int(value.text or "0")]
        if kind == "inlineStr":
            return "".join(node.text or "" for node in cell.iter(f"{{{MAIN_NS}}}t"))
        return value.text or "" if value is not None else ""

    def read_sheet(self, name: str) -> list[dict[str, str]]:
        root = ET.fromstring(self.archive.read(self.sheets[name]))
        rows = []
        for row in root.findall(f".//{{{MAIN_NS}}}sheetData/{{{MAIN_NS}}}row"):
            record = {"_row": row.attrib.get("r", "")}
            for cell in row.findall(f"{{{MAIN_NS}}}c"):
                record[column_letters(cell.attrib["r"])] = self._value(cell)
            rows.append(record)
        return rows


@dataclass
class SocketIndex:
    by_hash: dict[int, set[int]] = field(default_factory=lambda: defaultdict(set))
    by_slot_name: dict[int, dict[str, list[int]]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(list)))
    by_role_name: dict[str, dict[str, list[int]]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(list)))
    display_by_hash: dict[int, str] = field(default_factory=dict)
    english_by_hash: dict[int, str] = field(default_factory=dict)


class Manifest:
    def __init__(self):
        status = json.loads(STATUS_JSON.read_text(encoding="utf-8"))
        self.version = status["manifestVersion"]
        self.items = self._load_table("DestinyInventoryItemDefinition")
        self.plug_sets = self._load_table("DestinyPlugSetDefinition")
        self.english_names = self._load_english_names()
        self.weapon_hashes_by_zh: dict[str, list[int]] = defaultdict(list)
        self.weapon_hashes_by_en: dict[str, list[int]] = defaultdict(list)
        self.weapon_hashes_by_compact_zh: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
        self.weapon_hashes_by_compact_en: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
        self.socket_cache: dict[int, SocketIndex] = {}
        for item_hash, definition in self.items.items():
            if not is_weapon_definition(definition):
                continue
            zh_name = ((definition.get("displayProperties") or {}).get("name") or "")
            en_name = self.english_names.get(item_hash, "")
            if zh_name:
                self.weapon_hashes_by_zh[normalize(zh_name)].append(item_hash)
                self.weapon_hashes_by_compact_zh[compact_name(zh_name)][normalize(zh_name)].append(item_hash)
            if en_name:
                self.weapon_hashes_by_en[normalize(en_name)].append(item_hash)
                self.weapon_hashes_by_compact_en[compact_name(en_name)][normalize(en_name)].append(item_hash)

    def _load_table(self, table: str) -> dict[int, dict]:
        connection = sqlite3.connect(WORLD_DB)
        try:
            rows = connection.execute(f'SELECT id, json FROM "{table}"').fetchall()
        finally:
            connection.close()
        return {unsigned_hash(int(raw_id)): json.loads(raw_json) for raw_id, raw_json in rows}

    def _load_english_names(self) -> dict[int, str]:
        connection = sqlite3.connect(SEARCH_EN_DB)
        try:
            rows = connection.execute("SELECT hash, name FROM search_documents WHERE kind = 'item'").fetchall()
        finally:
            connection.close()
        return {unsigned_hash(int(raw_hash)): name for raw_hash, name in rows}

    def socket_index(self, item_hash: int) -> SocketIndex:
        if item_hash in self.socket_cache:
            return self.socket_cache[item_hash]
        index = SocketIndex()
        definition = self.items.get(item_hash) or {}
        entries = ((definition.get("sockets") or {}).get("socketEntries") or [])
        for socket_number, entry in enumerate(entries):
            candidates = []
            initial = int(entry.get("singleInitialItemHash") or 0)
            if initial:
                candidates.append(initial)
            for plug in entry.get("reusablePlugItems") or []:
                plug_hash = int(plug.get("plugItemHash") or 0)
                if plug_hash:
                    candidates.append(plug_hash)
            for field_name in ["reusablePlugSetHash", "randomizedPlugSetHash"]:
                set_hash = int(entry.get(field_name) or 0)
                for plug in (self.plug_sets.get(set_hash) or {}).get("reusablePlugItems") or []:
                    plug_hash = int(plug.get("plugItemHash") or 0)
                    if plug_hash:
                        candidates.append(plug_hash)
            for plug_hash in set(candidates):
                plug = self.items.get(plug_hash) or {}
                zh_name = ((plug.get("displayProperties") or {}).get("name") or "")
                en_name = self.english_names.get(plug_hash, "")
                semantic_role = plug_semantic_role(plug)
                index.by_hash[plug_hash].add(socket_number)
                index.display_by_hash[plug_hash] = zh_name
                index.english_by_hash[plug_hash] = en_name
                for name in [zh_name, en_name]:
                    if name:
                        index.by_slot_name[socket_number][normalize(name)].append(plug_hash)
                        if semantic_role:
                            index.by_role_name[semantic_role][normalize(name)].append(plug_hash)
        self.socket_cache[item_hash] = index
        return index

    def resolve_term(self, item_hash: int, target: int | str, raw_term: str) -> tuple[str, list[int], str] | None:
        cleaned = source_terms(raw_term)
        if len(cleaned) != 1:
            return None
        term = cleaned[0]
        index = self.socket_index(item_hash)
        candidates_by_name = index.by_slot_name[target] if isinstance(target, int) else index.by_role_name[target]
        normalized_term = normalize(term)
        hashes = sorted(set(candidates_by_name.get(normalized_term, [])))
        method = "官方名称精确匹配"
        if not hashes:
            compact_term = compact_name(term)
            compact_matches = [
                candidate_hashes
                for official_name, candidate_hashes in candidates_by_name.items()
                if compact_name(official_name) == compact_term
            ]
            hashes = sorted(set(value for values in compact_matches for value in values))
            method = "官方名称仅空格和标点格式不同"
        if not hashes:
            folded_term = folded_name(term)
            folded_matches = [
                candidate_hashes
                for official_name, candidate_hashes in candidates_by_name.items()
                if folded_name(official_name) == folded_term
            ]
            hashes = sorted(set(value for values in folded_matches for value in values))
            method = "官方名称仅拉丁变音符格式不同"
        if not hashes:
            return None
        names = unique(index.display_by_hash.get(value, "") for value in hashes)
        if len(names) != 1:
            return None
        return names[0], hashes, method

    def resolve_terms(
        self,
        item_hash: int,
        target: int | str,
        raw_values: str | list[str],
    ) -> tuple[list[str], dict[str, list[int]], list[str], list[dict]]:
        names = []
        hashes_by_name: dict[str, list[int]] = {}
        unresolved = []
        contained_matches = []
        for term in source_terms(raw_values):
            resolved = self.resolve_term(item_hash, target, term)
            if not resolved:
                unresolved.append(term)
                continue
            name, hashes, method = resolved
            names.append(name)
            hashes_by_name[name] = sorted(set(hashes_by_name.get(name, []) + hashes))
            if method != "官方名称精确匹配" and normalize(term) != normalize(name):
                contained_matches.append({"来源原文": term, "官方名称": name, "匹配方式": method})
        return unique(names), hashes_by_name, unresolved, contained_matches

    def resolve_aegis_masterworks(self, item_hash: int, raw_values: str | list[str]) -> tuple[list[str], list[str]]:
        """按 Aegis 原始英文语义定位当前武器官方大师 Plug，不使用中文简称或包含匹配。"""
        index = self.socket_index(item_hash)
        names = []
        unresolved = []
        masterwork_hashes = [
            plug_hash
            for plug_hash in index.by_hash
            if plug_semantic_role(self.items.get(plug_hash) or {}) == "masterwork"
        ]
        for raw_term in source_terms(raw_values):
            normalized_term = normalize(raw_term)
            exact_hashes = [
                plug_hash
                for plug_hash in masterwork_hashes
                if normalized_term in {
                    normalize(index.display_by_hash.get(plug_hash, "")),
                    normalize(re.sub(r"^大师杰作\s*[：:]\s*", "", index.display_by_hash.get(plug_hash, ""))),
                }
            ]
            if not exact_hashes:
                category_suffix = AEGIS_MASTERWORK_CATEGORY_SUFFIXES.get(normalized_term)
                if category_suffix:
                    exact_hashes = [
                        plug_hash
                        for plug_hash in masterwork_hashes
                        if normalize(((self.items.get(plug_hash) or {}).get("plug") or {}).get("plugCategoryIdentifier") or "")
                        .endswith(f".stat.{category_suffix}")
                    ]
            official_names = unique(
                match.group(1).strip()
                for plug_hash in exact_hashes
                for match in [re.match(
                    r"^(?:大师杰作|\d+阶)\s*[：:]\s*(.+)$",
                    index.display_by_hash.get(plug_hash, "").strip(),
                )]
                if match
            )
            if len(official_names) != 1:
                unresolved.append(raw_term)
                continue
            names.append(official_names[0])
        return unique(names), unique(unresolved)

    def release_rank(self, item_hash: int) -> int:
        ranks = []
        for trait_id in (self.items.get(item_hash) or {}).get("traitIds") or []:
            match = re.fullmatch(r"releases\.v(\d+)\.(?:core|season|annual|dlc)", trait_id)
            if match:
                ranks.append(int(match.group(1)))
        return max(ranks, default=0)

    def release_label(self, item_hash: int) -> str:
        rank = self.release_rank(item_hash)
        if not rank:
            return ""
        digits = str(rank)
        return "v" + ".".join(digits)

    def socket_signature(self, item_hash: int) -> tuple:
        index = self.socket_index(item_hash)
        return tuple(
            (slot, tuple(sorted(normalized_name for normalized_name in names if normalized_name)))
            for slot, names in sorted(
                (slot, set(index.by_slot_name.get(slot, {})))
                for slot in [1, 2, 3, 4, 8]
            )
        )

    def resolve_plug_hash(self, item_hash: int, plug_hash: int) -> dict:
        """将 DIM Plug Hash 绑定到目标武器插槽；旧 Hash 只允许官方名称精确映射。"""
        index = self.socket_index(item_hash)
        direct_slots = sorted(index.by_hash.get(plug_hash, set()))
        if direct_slots:
            definition = self.items.get(plug_hash) or {}
            return {
                "source_hash": plug_hash,
                "name": index.display_by_hash.get(plug_hash, ""),
                "hashes": [plug_hash],
                "slots": direct_slots,
                "role": plug_semantic_role(definition),
                "method": "DIM精确Hash",
            }
        definition = self.items.get(plug_hash) or {}
        source_names = unique([
            ((definition.get("displayProperties") or {}).get("name") or ""),
            self.english_names.get(plug_hash, ""),
        ])
        matches_by_slot: dict[int, list[int]] = defaultdict(list)
        for slot, names in index.by_slot_name.items():
            for source_name in source_names:
                matches_by_slot[slot].extend(names.get(normalize(source_name), []))
        matches_by_slot = {
            slot: sorted(set(hashes))
            for slot, hashes in matches_by_slot.items()
            if hashes
        }
        official_names = unique(
            index.display_by_hash.get(value, "")
            for hashes in matches_by_slot.values()
            for value in hashes
        )
        if not matches_by_slot or len(official_names) != 1:
            return {
                "source_hash": plug_hash,
                "name": source_names[0] if source_names else "",
                "hashes": [],
                "slots": [],
                "role": "",
                "method": "无法映射",
            }
        roles = unique(plug_semantic_role(self.items.get(value) or {}) for value in (
            value for hashes in matches_by_slot.values() for value in hashes
        ))
        return {
            "source_hash": plug_hash,
            "name": official_names[0],
            "hashes": sorted(set(value for hashes in matches_by_slot.values() for value in hashes)),
            "slots": sorted(matches_by_slot),
            "role": roles[0] if len(roles) == 1 else "",
            "method": "官方Plug名称精确匹配",
        }

    def resolve_weapon(self, name_zh: str, name_en: str, slot_terms: dict[int, list[str]]) -> tuple[list[int], str]:
        candidates = list(self.weapon_hashes_by_en.get(normalize(name_en), [])) if name_en else []
        method = "英文官方名称精确匹配" if candidates else ""
        if not candidates and name_zh:
            candidates = list(self.weapon_hashes_by_zh.get(normalize(name_zh), []))
            method = "中文官方名称精确匹配" if candidates else ""
        candidates = sorted(set(candidates))
        if len(candidates) <= 1:
            return candidates, method
        exact = []
        for item_hash in candidates:
            valid = True
            for slot, terms in slot_terms.items():
                for term in source_terms(terms):
                    if not self.resolve_term(item_hash, slot, term):
                        valid = False
                        break
                if not valid:
                    break
            if valid:
                exact.append(item_hash)
        return exact, method + "+全部推荐Perk官方插槽校验"


@dataclass
class SourceRecord:
    item_hash: int
    source_id: str
    source_key: str
    purpose: str
    scene: str
    barrels: list[str]
    magazines: list[str]
    perk3: list[str]
    perk4: list[str]
    masterworks: list[str]
    origins: list[str]
    note: str
    hashes: dict[str, dict[str, list[int]]]
    pairs: set[tuple[str, str]] | None = None
    evidence: dict = field(default_factory=dict)


def add_source_facts(
    source_facts: dict[tuple[int, str], dict[str, list[str]]],
    item_hash: int,
    source_id: str,
    **values,
) -> None:
    target = source_facts.setdefault((item_hash, source_id), defaultdict(list))
    for field_name, raw_value in values.items():
        candidates = raw_value if isinstance(raw_value, (list, tuple, set)) else [raw_value]
        for value in candidates:
            text = str(value or "").strip()
            if text and text not in target[field_name]:
                target[field_name].append(text)


def source_fact_text(facts: dict[str, list[str]], field_name: str, separator: str = "；") -> str:
    return separator.join(facts.get(field_name, []))


def truncate_csv_note(value: str) -> str:
    """限制汇总注解长度，避免电子表格软件把超长字段拆成伪来源行。"""
    if len(value) <= MAX_CSV_NOTE_LENGTH:
        return value
    available = MAX_CSV_NOTE_LENGTH - len(TRUNCATED_NOTE_SUFFIX)
    prefix = value[:available]
    minimum_boundary = int(available * 0.72)
    boundary = prefix.rfind("；原文：", minimum_boundary)
    if boundary < 0:
        boundary = prefix.rfind(". ", minimum_boundary)
        if boundary >= 0:
            boundary += 1
    if boundary < 0:
        boundary = available
    return value[:boundary].rstrip("；,，。 .") + TRUNCATED_NOTE_SUFFIX


def add_issue(issues: list[dict], source: str, location: str, weapon_name: str, candidates, issue_type: str, description: str, severity: str = "阻塞"):
    issues.append({
        "级别": severity,
        "来源": source,
        "来源位置": location,
        "武器名称": weapon_name,
        "候选武器ID": " / ".join(str(value) for value in candidates),
        "问题类型": issue_type,
        "问题说明": description,
    })


def build_source_record(
    manifest: Manifest,
    issues: list[dict],
    *,
    item_hash: int,
    source_id: str,
    source_key: str,
    purpose: str,
    scene: str,
    barrels,
    magazines,
    perk3,
    perk4,
    masterworks,
    origins,
    note: str,
    pairs: set[tuple[str, str]] | None = None,
    evidence: dict | None = None,
    wildcard_core_slots: set[int] | None = None,
) -> SourceRecord | None:
    wildcard_core_slots = wildcard_core_slots or set()
    field_specs = [
        ("枪管", "barrel", barrels), ("弹匣", "magazine", magazines), ("第三栏", 3, perk3),
        ("第四栏", 4, perk4), ("起源特性", "origin", origins),
    ]
    prepared_by_target: dict[int | str, list[str]] = defaultdict(list)
    name_mappings = []
    slot_corrections = []
    excluded_terms = excluded_source_terms(source_id, source_key)
    for label, target, values in field_specs:
        for raw_term in source_terms(values):
            if is_ignored_source_term(source_id, raw_term) or normalize(raw_term) in excluded_terms:
                continue
            mapped_term = map_source_term(source_id, source_key, raw_term)
            if mapped_term != raw_term:
                name_mappings.append({"原文": raw_term, "官方名称": mapped_term})
            resolved_target = source_slot_override(source_id, source_key, mapped_term, target)
            if resolved_target != target and isinstance(target, int) and isinstance(resolved_target, int):
                slot_corrections.append({
                    "Perk": mapped_term,
                    "原栏位": "第三栏" if target == 3 else "第四栏",
                    "官方栏位": "第三栏" if resolved_target == 3 else "第四栏",
                })
            prepared_by_target[resolved_target].append(mapped_term)
    resolved = {}
    unresolved_by_label: dict[str, list[str]] = defaultdict(list)
    contained_matches_by_label: dict[str, list[dict]] = defaultdict(list)
    for label, target, _values in field_specs:
        if target in wildcard_core_slots and not prepared_by_target[target]:
            resolved[label] = {"任意": []}
            continue
        names, hashes, unresolved, contained_matches = manifest.resolve_terms(
            item_hash,
            target,
            unique(prepared_by_target[target]),
        )
        resolved[label] = {name: hashes[name] for name in names}
        unresolved_by_label[label].extend(unresolved)
        contained_matches_by_label[label].extend(contained_matches)
    resolved_masterworks, unresolved_masterworks = manifest.resolve_aegis_masterworks(item_hash, masterworks)
    weapon_name = ((manifest.items.get(item_hash) or {}).get("displayProperties") or {}).get("name") or str(item_hash)
    core_unresolved = [
        f"{label}:{value}"
        for label in ["第三栏", "第四栏"]
        for value in unresolved_by_label.get(label, [])
    ]
    if core_unresolved:
        add_issue(
            issues,
            SOURCE_LABELS[source_id],
            source_key,
            weapon_name,
            [item_hash],
            "来源核心Perk不属于候选版本",
            "已排除无法由该武器版本官方插槽证明的候选：" + "；".join(core_unresolved),
            "提示",
        )
    optional_unresolved = [
        f"{label}:{value}"
        for label in ["枪管", "弹匣", "起源特性"]
        for value in unresolved_by_label.get(label, [])
    ]
    optional_unresolved.extend(f"大师:{value}" for value in unresolved_masterworks)
    perk3_names = list(resolved["第三栏"])
    perk4_names = list(resolved["第四栏"])
    if not perk3_names or not perk4_names:
        add_issue(
            issues,
            SOURCE_LABELS[source_id],
            source_key,
            weapon_name,
            [item_hash],
            "候选版本缺少完整两栏推荐",
            "排除无法映射的来源候选后，第三栏或第四栏为空；该模式未进入正式来源 Perk 池",
            "提示",
        )
        return None
    evidence_data = dict(evidence or {})
    if core_unresolved:
        evidence_data["按该版本排除的核心Perk"] = core_unresolved
    if optional_unresolved:
        evidence_data["已忽略未映射附加栏位原文"] = optional_unresolved
    if name_mappings:
        evidence_data["Perk名称映射"] = name_mappings
    contained_name_mappings = [
        {"栏位": label, **mapping}
        for label in ["枪管", "弹匣", "第三栏", "第四栏", "起源特性"]
        for mapping in contained_matches_by_label.get(label, [])
    ]
    if contained_name_mappings:
        evidence_data["官方名称唯一包含匹配"] = contained_name_mappings
    if slot_corrections:
        evidence_data["Perk栏位修正"] = slot_corrections
    excluded_term_labels = SOURCE_EXCLUDED_TERMS.get((source_id, source_key), [])
    if excluded_term_labels:
        evidence_data["按最新版本排除的来源Perk"] = excluded_term_labels
    return SourceRecord(
        item_hash=item_hash,
        source_id=source_id,
        source_key=source_key,
        purpose=purpose,
        scene=scene,
        barrels=list(resolved["枪管"]),
        magazines=list(resolved["弹匣"]),
        perk3=perk3_names,
        perk4=perk4_names,
        masterworks=resolved_masterworks,
        origins=list(resolved["起源特性"]),
        note=note,
        hashes=resolved,
        pairs=pairs,
        evidence=evidence_data,
    )


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def parse_yx() -> list[dict]:
    rows = WorkbookReader(YX_SOURCE).read_sheet("Sheet1")
    by_number = {int(row["_row"]): row for row in rows}
    records = []
    sections: dict[int, str] = defaultdict(str)
    for row_number in sorted(by_number):
        row = by_number[row_number]
        next_row = by_number.get(row_number + 1, {})
        for start in [21, 43, 65, 87, 109, 131]:
            name = cell_text(row.get(column_name(start), ""))
            weapon_type = cell_text(row.get(column_name(start + 2), ""))
            has_other_block_content = any(
                cell_text(row.get(column_name(start + offset), ""))
                for offset in range(1, 21)
            )
            if name and not weapon_type and not has_other_block_content and name != "武器名称":
                sections[start] = name
                continue
            if not name or not weapon_type or name == "武器名称":
                continue
            record = {
                "row": row_number,
                "block": column_name(start),
                "section": sections[start],
                "name_zh": name,
                "weapon_type": weapon_type,
                "pve3": [cell_text(row.get(column_name(start + offset), "")) for offset in range(3, 7)],
                "pve4": [cell_text(row.get(column_name(start + offset), "")) for offset in range(7, 11)],
                "pvp3": [cell_text(row.get(column_name(start + offset), "")) for offset in range(12, 16)],
                "pvp4": [cell_text(row.get(column_name(start + offset), "")) for offset in range(16, 21)],
                "notes": [],
            }
            for offset in [0, 3, 7, 11, 12, 16]:
                note = cell_text(next_row.get(column_name(start + offset), ""))
                if note:
                    record["notes"].append(note)
            records.append(record)
    return records


def parse_sayalarry() -> list[dict]:
    rows = WorkbookReader(SAYALARRY_SOURCE).read_sheet("Sheet1")
    records = []
    current_section = ""
    current = None
    for row in rows:
        row_number = int(row["_row"])
        if cell_text(row.get("B")) == "武器名称":
            current_section = cell_text(row.get("A"))
            current = None
            continue
        name_cell = cell_text(row.get("B"))
        mode = cell_text(row.get("F"))
        if name_cell.startswith("掉落：") and not cell_text(row.get("E")):
            current = None
            continue
        if name_cell and (cell_text(row.get("C")) or cell_text(row.get("D"))) and mode:
            lines = source_terms(name_cell)
            name_zh = lines[0] if lines else name_cell
            name_en = next((line for line in re.split(r"[\n；;]", name_cell) if re.search(r"[A-Za-z]", line) and not re.search(r"(?:射速|充能|拉弓|散射)", line)), "")
            current = {
                "section": current_section,
                "row": row_number,
                "name_zh": name_zh,
                "name_en": cell_text(name_en),
                "weapon_type": cell_text(row.get("C")),
                "frame": cell_text(row.get("D")),
                "element": cell_text(row.get("E")),
                "modes": [],
            }
            records.append(current)
        elif not name_cell and mode and current is not None:
            pass
        else:
            if name_cell:
                current = None
            continue
        current["modes"].append({
            "row": row_number,
            "mode": mode,
            "barrel": source_terms(cell_text(row.get("G"))),
            "mag": source_terms(cell_text(row.get("H"))),
            "perk3": source_terms(cell_text(row.get("I"))),
            "perk4": source_terms(cell_text(row.get("J"))),
            "origin": source_terms(cell_text(row.get("K"))),
            "masterwork": cell_text(row.get("L")),
            "priority": cell_text(row.get("M")),
            "notes": cell_text(row.get("N")),
        })
    return records


def translate_masterworks(value: str | list[str]) -> list[str]:
    translated = []
    for part in source_terms(value):
        translated.extend(source_terms(MASTERWORK_TRANSLATIONS.get(normalize(part), part)))
    return unique(translated)


def prepared_core_terms(source_id: str, source_key: str, perk3, perk4) -> dict[int, list[str]]:
    prepared: dict[int, list[str]] = defaultdict(list)
    excluded_terms = excluded_source_terms(source_id, source_key)
    for slot, values in [(3, perk3), (4, perk4)]:
        for raw_term in source_terms(values):
            if is_ignored_source_term(source_id, raw_term) or normalize(raw_term) in excluded_terms:
                continue
            mapped_term = map_source_term(source_id, source_key, raw_term)
            target_slot = source_slot_override(source_id, source_key, mapped_term, slot)
            prepared[target_slot].append(mapped_term)
    return {slot: unique(prepared[slot]) for slot in [3, 4]}


def select_latest_release_candidates(manifest: Manifest, candidates: list[int], *, section: str = "") -> tuple[list[int], str]:
    candidates = sorted(set(candidates))
    if not candidates:
        return [], ""
    section_normalized = normalize(section)
    if any(marker in section_normalized for marker in ["万神殿", "众神殿", "玖的仪式"]):
        holofoil = [item_hash for item_hash in candidates if bool(manifest.items[item_hash].get("isHolofoil"))]
        if holofoil:
            candidates = holofoil
    else:
        standard = [item_hash for item_hash in candidates if not bool(manifest.items[item_hash].get("isHolofoil"))]
        if standard:
            candidates = standard
    highest_rank = max((manifest.release_rank(item_hash) for item_hash in candidates), default=0)
    if highest_rank:
        candidates = [item_hash for item_hash in candidates if manifest.release_rank(item_hash) == highest_rank]
        return sorted(candidates), f"按官方发布标记选择最新{manifest.release_label(candidates[0])}"
    return sorted(candidates), "没有官方发布标记，保留精确名称候选"


def order_release_candidates(manifest: Manifest, candidates: list[int], *, section: str = "") -> tuple[list[int], str]:
    candidates = sorted(set(candidates))
    if not candidates:
        return [], ""
    section_normalized = normalize(section)
    if any(marker in section_normalized for marker in ["万神殿", "众神殿", "玖的仪式"]):
        holofoil = [item_hash for item_hash in candidates if bool(manifest.items[item_hash].get("isHolofoil"))]
        if holofoil:
            candidates = holofoil
    else:
        standard = [item_hash for item_hash in candidates if not bool(manifest.items[item_hash].get("isHolofoil"))]
        if standard:
            candidates = standard
    candidates.sort(key=lambda item_hash: (-manifest.release_rank(item_hash), item_hash))
    releases = unique(manifest.release_label(item_hash) or "无发布标记" for item_hash in candidates)
    return candidates, "按官方发布标记从新到旧检查同名版本：" + " / ".join(releases)


def split_starside_weapon_name(raw_name: str) -> tuple[str, str]:
    match = re.fullmatch(r"(.+?)\s*/\s*((?:众神殿|万神殿|玖的仪式|猛攻)版本)", raw_name.strip())
    if match:
        return match.group(1).strip(), match.group(2).strip()
    composite = re.fullmatch(r"(.+?)\s*/\s*([（(].+?[）)]\s*/\s*.+)", raw_name.strip())
    if composite:
        return composite.group(1).strip(), composite.group(2).strip()
    return raw_name.strip(), ""


def resolve_starside_weapon_candidates(manifest: Manifest, raw_name: str) -> tuple[list[int], dict]:
    weapon_name, section = split_starside_weapon_name(raw_name)
    alias_name = STARSIDE_WEAPON_NAME_ALIASES.get(normalize(weapon_name), "")
    lookup_name = alias_name or weapon_name
    candidates = list(manifest.weapon_hashes_by_zh.get(normalize(lookup_name), []))
    method = "中文官方名称精确匹配" if candidates else ""
    if not candidates:
        compact_groups = manifest.weapon_hashes_by_compact_zh.get(compact_name(lookup_name), {})
        if len(compact_groups) == 1:
            candidates = list(next(iter(compact_groups.values())))
            method = "中文官方名称忽略空格和标点后唯一匹配"
    if not candidates:
        candidates = list(manifest.weapon_hashes_by_en.get(normalize(lookup_name), []))
        method = "英文官方名称精确匹配" if candidates else ""
    if not candidates:
        compact_groups = manifest.weapon_hashes_by_compact_en.get(compact_name(lookup_name), {})
        if len(compact_groups) == 1:
            candidates = list(next(iter(compact_groups.values())))
            method = "英文官方名称忽略空格和标点后唯一匹配"
    original_candidates = sorted(set(candidates))
    candidates, version_method = order_release_candidates(manifest, candidates, section=section)
    evidence = {
        "武器匹配方式": method,
        "来源武器名称": raw_name,
        "匹配武器名称": lookup_name,
        "来源版本标记": section,
        "原始候选Hash": original_candidates,
        "版本选择规则": version_method,
    }
    if alias_name:
        evidence["来源武器名称映射"] = {"原文": weapon_name, "官方名称": alias_name}
    return candidates, evidence


def resolve_source_weapon_candidates(
    manifest: Manifest,
    *,
    source_id: str,
    source_key: str,
    name_zh: str,
    name_en: str = "",
    section: str = "",
) -> tuple[list[int], dict]:
    alias_name = SOURCE_WEAPON_NAME_ALIASES.get((source_id, source_key), "")
    lookup_zh = alias_name or name_zh
    candidates = list(manifest.weapon_hashes_by_en.get(normalize(name_en), [])) if name_en and not alias_name else []
    method = "英文官方名称精确匹配" if candidates else ""
    if not candidates and lookup_zh:
        candidates = list(manifest.weapon_hashes_by_zh.get(normalize(lookup_zh), []))
        method = "中文官方名称精确匹配" if candidates else ""
    original_candidates = sorted(set(candidates))
    candidates, version_method = order_release_candidates(manifest, candidates, section=section)
    evidence = {
        "武器匹配方式": method,
        "版本选择规则": version_method,
        "原始候选Hash": original_candidates,
        "来源分区": section,
    }
    if alias_name:
        evidence["来源武器名称映射"] = {"原文": name_zh, "官方名称": alias_name}
    return candidates, evidence


def dim_title_weapon_candidates(manifest: Manifest, roll_title: str) -> tuple[list[int], str]:
    exact = list(manifest.weapon_hashes_by_en.get(normalize(roll_title), []))
    if exact:
        return exact, "DIM标题与官方英文名精确匹配"
    title_normalized = normalize(roll_title)
    matches = []
    for official_name, hashes in manifest.weapon_hashes_by_en.items():
        if title_normalized.startswith(official_name + " (") or title_normalized.startswith(official_name + " -"):
            matches.append((len(official_name), official_name, hashes))
    if not matches:
        return [], ""
    longest = max(length for length, _name, _hashes in matches)
    names = [(name, hashes) for length, name, hashes in matches if length == longest]
    if len(names) != 1:
        return [], ""
    return list(names[0][1]), "DIM标题以完整官方英文名开头，后接作者场景括号"


def parse_dim_purpose(tags: str) -> str:
    tokens = [token.casefold() for token in re.split(r"[\s,]+", tags or "") if token]
    if any("pvp" in token for token in tokens):
        return "PVP"
    if any("pve" in token for token in tokens):
        return "PVE"
    return "未标注"


def parse_dim_scene(tags: str) -> str:
    tokens = unique(token for token in re.split(r"[\s,]+", tags or "") if token)
    return " / ".join(unique(DIM_TAG_TRANSLATIONS.get(token.casefold(), token) for token in tokens)) or "DIM原始标签未标注用途"


def parse_dim_masterworks(note: str) -> list[str]:
    match = re.search(r"Recommended MW:\s*([^.|]+)", note or "", re.IGNORECASE)
    return translate_masterworks(match.group(1)) if match else []


def load_aegis_original_masterworks() -> dict[str, list[str]]:
    """读取 Aegis 原始英文 MW；同名重复行只有内容一致时才可复用。

    Aegis 会在部分特殊武器名称后追加 ``BRAVE version`` 等版本后缀，
    而 Manifest 的英文名称通常只保留基础名称；同时建立去版本后缀别名，
    让这些行仍能复用原始表的主实体证据。
    """
    values_by_name: dict[str, list[list[str]]] = defaultdict(list)
    for row in read_csv(AEGIS_OFFICIAL_WEAPONS):
        name = normalize(row.get("Name", ""))
        if name:
            values_by_name[name].append(source_terms(row.get("MW", "")))
    result = {}
    for name, candidates in values_by_name.items():
        unique_candidates = unique(tuple(candidate) for candidate in candidates)
        if len(unique_candidates) == 1:
            result[name] = list(unique_candidates[0])
    for name, values in list(result.items()):
        base_name = re.sub(r"\s+(?:brave|pantheon)\s+version$", "", name, flags=re.IGNORECASE).strip()
        if base_name and base_name not in result:
            result[base_name] = list(values)
    return result


def load_aegis(
    manifest: Manifest,
    issues: list[dict],
    records: list[SourceRecord],
    source_facts: dict[tuple[int, str], dict[str, list[str]]],
    weapon_facts: dict[int, dict],
):
    original_masterworks = load_aegis_original_masterworks()
    for row in read_csv(STARSIDE_AEGIS):
        source_location = row.get("来源位置", "")
        source_key = f"starside:{source_location}"
        candidates, weapon_evidence = resolve_starside_weapon_candidates(manifest, row.get("武器", ""))
        if not candidates:
            add_issue(
                issues,
                SOURCE_LABELS["aegis"],
                source_key,
                row.get("武器", ""),
                [],
                "武器身份无法确认",
                "Starside 校对表名称无法与当前 Manifest 官方武器名称唯一匹配",
            )
            continue
        attempts = []
        matched_count = 0
        for item_hash in candidates:
            english_name = manifest.english_names.get(item_hash, "")
            source_masterworks = original_masterworks.get(normalize(english_name), [])
            resolved_masterworks, unresolved_masterworks = manifest.resolve_aegis_masterworks(
                item_hash,
                source_masterworks,
            )
            # 旧版武器在当前 Manifest 中只有通用“大师杰作”升级插槽，
            # 不再暴露具体属性 Plug；原始 Aegis 官方表已用主实体 Hash
            # 记录了英文 MW，因此此处可直接复用其官方语义，避免把历史
            # 复刻版本误报为阻塞项。
            if unresolved_masterworks and source_masterworks:
                translated_masterworks = translate_masterworks(source_masterworks)
                if len(translated_masterworks) == len(source_masterworks):
                    resolved_masterworks = translated_masterworks
                    unresolved_masterworks = []
            if unresolved_masterworks or (row.get("大师", "").strip() and not source_masterworks):
                add_issue(
                    issues,
                    SOURCE_LABELS["aegis"],
                    f"{source_key}:{item_hash}",
                    row.get("武器", ""),
                    [item_hash],
                    "Aegis大师属性无法按官方数据确认",
                    "原始英文大师项无法在当前武器官方 Masterwork Plug 中唯一定位："
                    + " / ".join(unresolved_masterworks or source_terms(row.get("大师", ""))),
                )
            weapon_facts[item_hash] = {
                "acquisition": row.get("来源", ""),
                "aegis_rating": f"Tier {row.get('评级', '')}".strip(),
                "aegis_note": row.get("注解", ""),
            }
            candidate_issues = []
            record = build_source_record(
                manifest,
                candidate_issues,
                item_hash=item_hash,
                source_id="aegis",
                source_key=f"{source_key}:{item_hash}",
                purpose="未标注",
                scene=" / ".join(unique([row.get("页面", ""), row.get("分类", ""), "作者推荐用途未单独标注"])),
                barrels=row.get("枪管", ""),
                magazines=row.get("弹匣", ""),
                perk3=row.get("Perk 1", ""),
                perk4=row.get("Perk 2", ""),
                masterworks=resolved_masterworks or source_terms(row.get("大师", "")),
                origins=row.get("起源特性", ""),
                note=row.get("注解", ""),
                evidence={
                    **weapon_evidence,
                    "目标武器Hash": item_hash,
                    "Starside来源URL": row.get("来源URL", ""),
                    "Starside页面更新时间": row.get("页面更新时间", ""),
                    "Starside来源位置": source_location,
                },
            )
            attempts.append(candidate_issues)
            if record:
                matched_count += 1
                issues.extend(issue for issue in candidate_issues if issue["问题类型"] not in VERSION_MATCH_ISSUE_TYPES)
                records.append(record)
                add_source_facts(
                    source_facts,
                    item_hash,
                    "aegis",
                    **{field_name: row.get(field_name, "") for field_name in WEAPON_FIELDS[:26]},
                )
        if not matched_count and attempts:
            issues.extend(attempts[0])


def lgpig_note(row: dict[str, str], *, exotic: bool) -> str:
    parts = []
    if exotic:
        parts.extend(row.get(field_name, "") for field_name in ["理由一", "理由二", "理由三"])
    else:
        parts.append(row.get("评级理由", ""))
    for label, field_name in [("DPS", "DPS"), ("总伤", "总伤"), ("切换DPS", "切换 DPS")]:
        value = row.get(field_name, "")
        if value:
            parts.append(f"{label}：{value}")
    if row.get("备注"):
        parts.append(row["备注"])
    return "；".join(unique(parts))


def load_lgpig(
    manifest: Manifest,
    issues: list[dict],
    records: list[SourceRecord],
    source_facts: dict[tuple[int, str], dict[str, list[str]]],
    weapon_facts: dict[int, dict],
):
    for path, exotic in [(STARSIDE_LGPIG_LEGENDARY, False), (STARSIDE_LGPIG_EXOTIC, True)]:
        for row in read_csv(path):
            source_location = row.get("来源位置", "")
            source_key = f"starside:{source_location}"
            candidates, weapon_evidence = resolve_starside_weapon_candidates(manifest, row.get("武器", ""))
            if exotic:
                candidates = [
                    item_hash
                    for item_hash in candidates
                    if int(((manifest.items.get(item_hash) or {}).get("inventory") or {}).get("tierType") or 0) == 6
                ]
                weapon_evidence["异域来源约束"] = "LGpig异域武器表只接受官方异域品质候选"
            if not candidates:
                add_issue(
                    issues,
                    SOURCE_LABELS["lgpig"],
                    source_key,
                    row.get("武器", ""),
                    [],
                    "武器身份无法确认",
                    "Starside LGpig 名称无法与当前 Manifest 官方武器名称唯一匹配",
                )
                continue
            attempts = []
            matched_count = 0
            for item_hash in candidates:
                note = lgpig_note(row, exotic=exotic)
                if exotic:
                    weapon_facts.setdefault(item_hash, {})["fixed_exotic"] = True
                    record = None
                else:
                    has_perk3 = bool(source_terms(row.get("Perk 三号位", "")))
                    has_perk4 = bool(source_terms(row.get("Perk 四号位", "")))
                    wildcard_core_slots = set()
                    if has_perk3 != has_perk4:
                        if not has_perk3:
                            wildcard_core_slots.add(3)
                        if not has_perk4:
                            wildcard_core_slots.add(4)
                    wildcard_labels = [
                        label
                        for slot, label in [(3, "第三栏"), (4, "第四栏")]
                        if slot in wildcard_core_slots
                    ]
                    evidence = {
                        **weapon_evidence,
                        "目标武器Hash": item_hash,
                        "Starside来源URL": row.get("来源URL", ""),
                        "Starside页面更新时间": row.get("页面更新时间", ""),
                        "Starside来源位置": source_location,
                    }
                    if wildcard_labels:
                        evidence.update({"通配栏位": wildcard_labels, "通配规则": "原表空白栏不限制Perk"})
                    candidate_issues = []
                    record = build_source_record(
                        manifest,
                        candidate_issues,
                        item_hash=item_hash,
                        source_id="lgpig",
                        source_key=f"{source_key}:{item_hash}",
                        purpose="PVE",
                        scene=" / ".join(unique([row.get("页面", ""), row.get("分类", "")])),
                        barrels=[],
                        magazines=[],
                        perk3=row.get("Perk 三号位", ""),
                        perk4=row.get("Perk 四号位", ""),
                        masterworks=[],
                        origins=[],
                        note=note,
                        evidence=evidence,
                        wildcard_core_slots=wildcard_core_slots,
                    )
                    attempts.append(candidate_issues)
                    if record:
                        matched_count += 1
                        issues.extend(issue for issue in candidate_issues if issue["问题类型"] not in VERSION_MATCH_ISSUE_TYPES)
                        records.append(record)
                if exotic or record:
                    add_source_facts(
                        source_facts,
                        item_hash,
                        "lgpig",
                        页面=row.get("页面", ""),
                        分类=row.get("分类", ""),
                        武器=row.get("武器", ""),
                        评级=row.get("评级", ""),
                        排名=row.get("排名", ""),
                        来源URL=row.get("来源URL", ""),
                        页面更新时间=row.get("页面更新时间", ""),
                        来源位置=source_location,
                        图标=row.get("图标", ""),
                        图标图标URL=row.get("图标图标URL", ""),
                        属性=row.get("属性", ""),
                        框架=row.get("框架 / 射速", ""),
                        来源=row.get("获取地点", ""),
                        勇士=row.get("勇士", ""),
                        勇士图标URL=row.get("勇士图标URL", ""),
                        **{
                            "Perk 1": row.get("Perk 三号位", ""),
                            "Perk 2": row.get("Perk 四号位", ""),
                        },
                        注解=note,
                    )
            if not exotic and not matched_count and attempts:
                issues.extend(attempts[0])


def load_yx(
    manifest: Manifest,
    issues: list[dict],
    records: list[SourceRecord],
    source_facts: dict[tuple[int, str], dict[str, list[str]]],
):
    for row in parse_yx():
        source_key = f"Sheet1:{row['row']}:{row['block']}"
        resolved, weapon_evidence = resolve_source_weapon_candidates(
            manifest,
            source_id="yxcrallxy",
            source_key=source_key,
            name_zh=row["name_zh"],
            section=row.get("section", ""),
        )
        if not resolved:
            add_issue(
                issues,
                SOURCE_LABELS["yxcrallxy"],
                source_key,
                row["name_zh"],
                [],
                "武器身份无法确认",
                "官方中英文名称与已审核来源级别名均没有候选",
            )
            continue
        for purpose, p3_key, p4_key in [("PVE", "pve3", "pve4"), ("PVP", "pvp3", "pvp4")]:
            if not source_terms(row[p3_key]) or not source_terms(row[p4_key]):
                continue
            mode_key = f"{source_key}:{purpose}"
            attempts = []
            matched_count = 0
            for item_hash in resolved:
                candidate_issues = []
                record = build_source_record(
                    manifest,
                    candidate_issues,
                    item_hash=item_hash,
                    source_id="yxcrallxy",
                    source_key=mode_key,
                    purpose=purpose,
                    scene=" / ".join(unique([row.get("section", ""), f"{purpose}（原表未进一步细分）"])),
                    barrels=[],
                    magazines=[],
                    perk3=row[p3_key],
                    perk4=row[p4_key],
                    masterworks=[],
                    origins=[],
                    note="；".join(unique(row["notes"])),
                    evidence={**weapon_evidence, "目标武器Hash": item_hash},
                )
                attempts.append(candidate_issues)
                if record:
                    matched_count += 1
                    issues.extend(issue for issue in candidate_issues if issue["问题类型"] not in VERSION_MATCH_ISSUE_TYPES)
                    records.append(record)
                    add_source_facts(
                        source_facts,
                        item_hash,
                        "yxcrallxy",
                        页面="YXCRALLXY推荐表",
                        分类=row.get("section", ""),
                        武器=row["name_zh"],
                        来源URL=SOURCE_URLS["yxcrallxy"],
                        来源位置=mode_key,
                        来源=row.get("section", ""),
                        注解="；".join(unique(row["notes"])),
                    )
            if not matched_count and attempts:
                issues.extend(attempts[0])


def load_sayalarry(
    manifest: Manifest,
    issues: list[dict],
    records: list[SourceRecord],
    source_facts: dict[tuple[int, str], dict[str, list[str]]],
):
    for row in parse_sayalarry():
        source_key = f"Sheet1:{row['row']}"
        resolved, weapon_evidence = resolve_source_weapon_candidates(
            manifest,
            source_id="sayalarry",
            source_key=source_key,
            name_zh=row["name_zh"],
            name_en=row["name_en"],
            section=row.get("section", ""),
        )
        if not resolved:
            add_issue(
                issues,
                SOURCE_LABELS["sayalarry"],
                source_key,
                row["name_zh"],
                [],
                "武器身份无法确认",
                "官方中英文名称与已审核来源级别名均没有候选",
            )
            continue
        for mode in row["modes"]:
            purpose = "PVP" if "PVP" in mode["mode"].upper() else "PVE"
            has_perk3 = bool(source_terms(mode["perk3"]))
            has_perk4 = bool(source_terms(mode["perk4"]))
            if not has_perk3 and not has_perk4:
                continue
            wildcard_core_slots = set()
            if has_perk3 != has_perk4:
                if not has_perk3:
                    wildcard_core_slots.add(3)
                if not has_perk4:
                    wildcard_core_slots.add(4)
            wildcard_labels = [label for slot, label in [(3, "第三栏"), (4, "第四栏")] if slot in wildcard_core_slots]
            attempts = []
            matched_count = 0
            for item_hash in resolved:
                evidence = {**weapon_evidence, "目标武器Hash": item_hash}
                if wildcard_labels:
                    evidence.update({"通配栏位": wildcard_labels, "通配规则": "原表空白栏不限制Perk"})
                candidate_issues = []
                record = build_source_record(
                    manifest,
                    candidate_issues,
                    item_hash=item_hash,
                    source_id="sayalarry",
                    source_key=f"Sheet1:{mode['row']}:{purpose}",
                    purpose=purpose,
                    scene=" / ".join(source_terms(mode["mode"])),
                    barrels=mode["barrel"],
                    magazines=mode["mag"],
                    perk3=mode["perk3"],
                    perk4=mode["perk4"],
                    masterworks=translate_masterworks(mode["masterwork"]),
                    origins=mode["origin"],
                    note="；".join(unique([
                        mode["notes"],
                        f"原表{'、'.join(wildcard_labels)}空白，按已确认规则解释为任意" if wildcard_labels else "",
                    ])),
                    evidence=evidence,
                    wildcard_core_slots=wildcard_core_slots,
                )
                attempts.append(candidate_issues)
                if record:
                    matched_count += 1
                    issues.extend(issue for issue in candidate_issues if issue["问题类型"] not in VERSION_MATCH_ISSUE_TYPES)
                    records.append(record)
                    add_source_facts(
                        source_facts,
                        item_hash,
                        "sayalarry",
                        页面="Sayalarry推荐表",
                        分类=row.get("section", ""),
                        武器=row["name_zh"],
                        评级=f"{purpose}：{mode['priority']}" if mode["priority"] else "",
                        来源URL=SOURCE_URLS["sayalarry"],
                        来源位置=f"Sheet1:{mode['row']}:{purpose}",
                        属性=row.get("element", ""),
                        框架=row.get("frame", ""),
                        来源=row.get("section", ""),
                        注解=record.note,
                    )
            if not matched_count and attempts:
                issues.extend(attempts[0])


def load_dim(
    manifest: Manifest,
    issues: list[dict],
    records: list[SourceRecord],
    class_item_rows: list[dict],
    dim_path: Path,
    dim_revision: str,
):
    dataset_title = ""
    roll_title = ""
    current_note = ""
    current_tags = ""
    block_id = 0
    block_meta = {}
    grouped: dict[tuple[int, int, str, str], dict] = {}
    class_item_grouped: dict[tuple[int, int, int, int], list[int]] = defaultdict(list)
    blocked_counts: dict[tuple[str, int], int] = defaultdict(int)
    warning_counts: dict[tuple[str, int], int] = defaultdict(int)
    for line_number, line in enumerate(dim_path.read_text(encoding="utf-8").splitlines(), 1):
        if line.startswith(("title:", "@title:")):
            dataset_title = line.split(":", 1)[1].strip()
            roll_title = ""
            current_note = ""
            current_tags = ""
            continue
        if line.startswith("// ") and not line.startswith("// ("):
            roll_title = line[3:].strip()
            current_note = ""
            current_tags = ""
            continue
        if line.startswith("//notes:"):
            raw = line[len("//notes:"):]
            note_parts = raw.split("|tags:", 1)
            current_note = note_parts[0].strip()
            current_tags = note_parts[1].strip() if len(note_parts) > 1 else ""
            block_id += 1
            block_meta[block_id] = {
                "dataset_title": dataset_title,
                "roll_title": roll_title,
                "note": current_note,
                "tags": current_tags,
                "notes_line": line_number,
            }
            continue
        match = re.fullmatch(r"dimwishlist:item=(\d+)&perks=([\d,]+)", line)
        if not match:
            continue
        item_hash = int(match.group(1))
        original_item_hash = item_hash
        item_mapping = ""
        original_definition = manifest.items.get(item_hash) or {}
        should_remap_item = item_hash not in manifest.items or (
            original_definition
            and not is_weapon_definition(original_definition)
            and not is_exotic_class_item_definition(original_definition)
        )
        if should_remap_item:
            name_candidates, title_method = dim_title_weapon_candidates(manifest, roll_title)
            name_candidates, latest_method = select_latest_release_candidates(manifest, name_candidates)
            if len(name_candidates) != 1:
                blocked_counts[("Hash不在当前Manifest", item_hash)] += 1
                continue
            item_hash = name_candidates[0]
            original_reason = "不存在" if not original_definition else f"是itemType={original_definition.get('itemType')}的非武器定义"
            item_mapping = f"原始Hash {original_item_hash} {original_reason}；{title_method}，{latest_method}"
        definition = manifest.items[item_hash]
        perk_hashes = [int(value) for value in match.group(2).split(",")]
        if is_exotic_class_item_definition(definition):
            if len(perk_hashes) != 2 or any(
                not ((manifest.items.get(plug_hash) or {}).get("displayProperties") or {}).get("name")
                for plug_hash in perk_hashes
            ):
                blocked_counts[("DIM异域职业物品特性无法确认", item_hash)] += 1
                continue
            class_item_grouped[(item_hash, block_id, perk_hashes[0], perk_hashes[1])].append(line_number)
            continue
        if not is_weapon_definition(definition):
            blocked_counts[("DIM目标不是武器", item_hash)] += 1
            continue
        resolved_plugs = [manifest.resolve_plug_hash(item_hash, plug_hash) for plug_hash in perk_hashes]
        by_slot: dict[int, list[dict]] = defaultdict(list)
        ambiguous_core = []
        unknown_hashes = []
        for plug in resolved_plugs:
            slots = set(plug["slots"])
            core_slots = slots & {3, 4}
            if core_slots == {3, 4}:
                ambiguous_core.append(plug)
            elif len(slots) == 1:
                by_slot[next(iter(slots))].append(plug)
            elif not slots:
                unknown_hashes.append(plug["source_hash"])
        core3 = list(by_slot.get(3, []))
        core4 = list(by_slot.get(4, []))
        if len(core3) == 1 and not core4 and len(ambiguous_core) == 1:
            core4 = [ambiguous_core[0]]
            ambiguous_core = []
        elif len(core4) == 1 and not core3 and len(ambiguous_core) == 1:
            core3 = [ambiguous_core[0]]
            ambiguous_core = []
        if len(core3) != 1 or len(core4) != 1 or ambiguous_core:
            inventory = definition.get("inventory") or {}
            if int(inventory.get("tierType") or 0) == 6 and (not core3 or not core4):
                issue_type = "DIM特殊武器不使用标准第三/第四栏"
            elif len(core3) > 1 or len(core4) > 1 or ambiguous_core:
                issue_type = "DIM规则包含多项同栏或跨栏必需Perk"
            else:
                issue_type = "DIM规则缺少标准第三栏或第四栏"
            warning_counts[(issue_type, item_hash)] += 1
            continue
        if unknown_hashes:
            warning_counts[("DIM附加Hash无法映射但核心两栏有效", item_hash)] += 1
        perk3 = core3[0]
        perk4 = core4[0]
        key = (item_hash, block_id, perk3["name"], perk4["name"])
        group = grouped.setdefault(key, {
            "lines": [], "barrels": set(), "magazines": set(), "origins": set(),
            "original_item_hashes": set(), "item_mappings": set(), "plug_mappings": [],
            "source_rule_hashes": set(), "perk3_hashes": set(), "perk4_hashes": set(),
        })
        group["lines"].append(line_number)
        group["source_rule_hashes"].add(tuple(perk_hashes))
        group["perk3_hashes"].update(perk3["hashes"])
        group["perk4_hashes"].update(perk4["hashes"])
        if item_mapping:
            group["original_item_hashes"].add(original_item_hash)
            group["item_mappings"].add(item_mapping)
        for plug in resolved_plugs:
            if plug["method"] != "DIM精确Hash" and plug["method"] != "无法映射":
                group["plug_mappings"].append({
                    "原始Hash": plug["source_hash"],
                    "官方名称": plug["name"],
                    "目标Hash": plug["hashes"],
                    "目标插槽": plug["slots"],
                    "规则": plug["method"],
                })
        role_targets = {"barrel": "barrels", "magazine": "magazines", "origin": "origins"}
        for plug in resolved_plugs:
            target = role_targets.get(plug.get("role", ""))
            if target and plug["name"]:
                group[target].add(plug["name"])

    for (item_hash, source_block, perk1_hash, perk2_hash), line_numbers in class_item_grouped.items():
        definition = manifest.items[item_hash]
        display = definition.get("displayProperties") or {}
        inventory = definition.get("inventory") or {}
        meta = block_meta.get(source_block, {})
        perk1_name = ((manifest.items[perk1_hash].get("displayProperties") or {}).get("name") or "")
        perk2_name = ((manifest.items[perk2_hash].get("displayProperties") or {}).get("name") or "")
        source_key = f"voltron:{min(line_numbers)}:{max(line_numbers)}"
        payload = json.dumps({
            "item": item_hash,
            "source": "dim_voltron",
            "record": source_key,
            "perk1": perk1_hash,
            "perk2": perk2_hash,
        }, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        source_data = {
            "来源记录": source_key,
            "DIM数据集标题": meta.get("dataset_title", ""),
            "DIM组合标题": meta.get("roll_title", ""),
            "DIM原始标签": meta.get("tags", ""),
            "DIM Revision": dim_revision,
            "DIM规则行": line_numbers,
        }
        class_item_rows.append({
            "组合ID": "class-rec-" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20],
            "物品ID": item_hash,
            "物品名称": display.get("name") or "",
            "英文名称": manifest.english_names.get(item_hash, ""),
            "职业": CLASS_LABELS.get(int(definition.get("classType") or 0), ""),
            "物品类型": definition.get("itemTypeDisplayName") or "",
            "品质": inventory.get("tierTypeName") or "",
            "用途": parse_dim_purpose(meta.get("tags", "")),
            "使用场景": parse_dim_scene(meta.get("tags", "")),
            "第一特性": perk1_name,
            "第一特性ID": perk1_hash,
            "第二特性": perk2_name,
            "第二特性ID": perk2_hash,
            "来源": SOURCE_LABELS["dim_voltron"],
            "说明": "原文：" + (meta.get("note", "") or meta.get("roll_title", "") or meta.get("dataset_title", "")),
            "来源数据": json.dumps(source_data, ensure_ascii=False, separators=(",", ":")),
        })

    for (item_hash, source_block, p3_name, p4_name), group in grouped.items():
        meta = block_meta.get(source_block, {})
        barrel_names = sorted(group["barrels"])
        magazine_names = sorted(group["magazines"])
        origin_names = sorted(group["origins"])
        source_key = f"voltron:{min(group['lines'])}:{max(group['lines'])}"
        record = build_source_record(
            manifest,
            issues,
            item_hash=item_hash,
            source_id="dim_voltron",
            source_key=source_key,
            purpose=parse_dim_purpose(meta.get("tags", "")),
            scene=parse_dim_scene(meta.get("tags", "")),
            barrels=barrel_names,
            magazines=magazine_names,
            perk3=[p3_name],
            perk4=[p4_name],
            masterworks=parse_dim_masterworks(meta.get("note", "")),
            origins=origin_names,
            note="原文：" + (meta.get("note", "") or meta.get("roll_title", "") or meta.get("dataset_title", "")),
            pairs={(p3_name, p4_name)},
            evidence={
                "DIM数据集标题": meta.get("dataset_title", ""),
                "DIM组合标题": meta.get("roll_title", ""),
                "DIM原始标签": meta.get("tags", ""),
                "DIM Revision": dim_revision,
                "DIM规则行": group["lines"],
                "DIM原始规则Hash": [list(values) for values in sorted(group["source_rule_hashes"])],
                "DIM映射后核心Hash": {
                    "第三栏": sorted(group["perk3_hashes"]),
                    "第四栏": sorted(group["perk4_hashes"]),
                },
                **({
                    "DIM Plug映射": [
                        json.loads(value)
                        for value in unique(json.dumps(item, ensure_ascii=False, sort_keys=True) for item in group["plug_mappings"])
                    ]
                } if group["plug_mappings"] else {}),
                **({"DIM原始武器Hash": sorted(group["original_item_hashes"])} if group["original_item_hashes"] else {}),
                **({"DIM武器映射": sorted(group["item_mappings"])} if group["item_mappings"] else {}),
            },
        )
        if record:
            records.append(record)
    for (issue_type, item_hash), count in blocked_counts.items():
        weapon_name = ((manifest.items.get(item_hash) or {}).get("displayProperties") or {}).get("name") or str(item_hash)
        add_issue(issues, SOURCE_LABELS["dim_voltron"], "Voltron", weapon_name, [item_hash], issue_type, f"共 {count} 条规则未进入主表")
    for (issue_type, item_hash), count in warning_counts.items():
        weapon_name = ((manifest.items.get(item_hash) or {}).get("displayProperties") or {}).get("name") or str(item_hash)
        description = (
            f"共 {count} 条规则保留核心两栏并记录映射提示"
            if issue_type == "DIM附加Hash无法映射但核心两栏有效"
            else f"共 {count} 条规则未进入标准第三栏+第四栏 Perk 池"
        )
        add_issue(issues, SOURCE_LABELS["dim_voltron"], "Voltron", weapon_name, [item_hash], issue_type, description, "提示")


def weapon_meta(manifest: Manifest, item_hash: int, facts: dict) -> dict:
    item = manifest.items[item_hash]
    display = item.get("displayProperties") or {}
    inventory = item.get("inventory") or {}
    equipping = item.get("equippingBlock") or {}
    damage_hashes = item.get("damageTypeHashes") or []
    index = manifest.socket_index(item_hash)
    frame_names = unique(index.display_by_hash.get(value, "") for value, slots in index.by_hash.items() if 0 in slots)
    version = facts.get("version", "")
    if not version and manifest.release_label(item_hash):
        version = f"官方发布{manifest.release_label(item_hash)}"
    if item.get("isHolofoil") and "全息箔" not in version:
        version = " / ".join(unique([version, "全息箔"]))
    icon = display.get("icon") or ""
    return {
        "武器ID": item_hash,
        "武器": display.get("name") or "",
        "英文名称": manifest.english_names.get(item_hash, ""),
        "品质": inventory.get("tierTypeName") or "",
        "武器位置": BUCKET_LABELS.get(int(inventory.get("bucketTypeHash") or 0), ""),
        "武器类型": item.get("itemTypeDisplayName") or "",
        "弹药类型": AMMO_LABELS.get(int(equipping.get("ammoType") or 0), ""),
        "框架": frame_names[0] if len(frame_names) == 1 else " / ".join(frame_names),
        "属性": ELEMENT_LABELS.get(int(damage_hashes[0]), "") if damage_hashes else "",
        "版本": version,
        "来源": facts.get("acquisition", ""),
        "图标": icon,
        "图标图标URL": f"https://www.bungie.net{icon}" if icon else "",
    }


def weapon_family_key(manifest: Manifest, item_hash: int) -> str:
    definition = manifest.items.get(item_hash) or {}
    display = definition.get("displayProperties") or {}
    return normalize(manifest.english_names.get(item_hash, "") or display.get("name") or str(item_hash))


def representative_weapon_hash(manifest: Manifest, item_hashes: set[int]) -> int:
    """优先选择最新、有收藏品定义的官方武器作为展示元数据。"""
    return max(
        item_hashes,
        key=lambda item_hash: (
            manifest.release_rank(item_hash),
            bool((manifest.items.get(item_hash) or {}).get("collectibleHash")),
            not bool((manifest.items.get(item_hash) or {}).get("isHolofoil")),
            item_hash,
        ),
    )


def source_record_location(record: SourceRecord) -> str:
    suffix = f":{record.item_hash}"
    return record.source_key[:-len(suffix)] if record.source_key.endswith(suffix) else record.source_key


def collapse_family_optional_issues(
    manifest: Manifest,
    issues: list[dict],
    records: list[SourceRecord],
) -> list[dict]:
    """同一英文武器身份任一官方版本能证明的附加推荐不再按单一 Hash 报警。"""
    available: dict[tuple[str, str, str], set[str]] = defaultdict(set)
    family_hashes: dict[tuple[str, str], set[int]] = defaultdict(set)
    for record in records:
        key = (weapon_family_key(manifest, record.item_hash), SOURCE_LABELS[record.source_id])
        family_hashes[key].add(record.item_hash)
        for label, values in [
            ("枪管", record.barrels),
            ("弹匣", record.magazines),
            ("起源特性", record.origins),
        ]:
            available[(key[0], key[1], label)].update(compact_name(value) for value in values)

    remaining = []
    for issue in issues:
        if issue["问题类型"] != "附加栏位无法精确映射":
            remaining.append(issue)
            continue
        candidate_families = unique(
            weapon_family_key(manifest, int(value))
            for value in re.findall(r"\d+", issue.get("候选武器ID", ""))
            if int(value) in manifest.items
        )
        family_key = candidate_families[0] if len(candidate_families) == 1 else normalize(issue["武器名称"])
        key = (family_key, issue["来源"])
        unresolved = []
        for value in issue["问题说明"].split("；"):
            label, separator, term = value.partition(":")
            if not separator or compact_name(term) not in available.get((key[0], key[1], label), set()):
                unresolved.append(value)
        if not unresolved:
            continue
        updated = dict(issue)
        updated["问题说明"] = "；".join(unresolved)
        if family_hashes.get(key):
            updated["候选武器ID"] = " / ".join(str(value) for value in sorted(family_hashes[key]))
        remaining.append(updated)
    deduplicated = []
    seen = set()
    for issue in remaining:
        issue_key = tuple(issue.get(field_name, "") for field_name in ISSUE_FIELDS)
        if issue_key in seen:
            continue
        seen.add(issue_key)
        deduplicated.append(issue)
    return deduplicated


def aggregate_source_rows(
    manifest: Manifest,
    records: list[SourceRecord],
    source_facts: dict[tuple[int, str], dict[str, list[str]]],
    weapon_facts: dict[int, dict],
) -> list[dict]:
    records_by_key: dict[tuple[str, str], list[SourceRecord]] = defaultdict(list)
    facts_by_key: dict[tuple[str, str], dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    hashes_by_key: dict[tuple[str, str], set[int]] = defaultdict(set)
    for record in records:
        key = (weapon_family_key(manifest, record.item_hash), record.source_id)
        records_by_key[key].append(record)
        hashes_by_key[key].add(record.item_hash)
    for (item_hash, source_id), facts in source_facts.items():
        key = (weapon_family_key(manifest, item_hash), source_id)
        hashes_by_key[key].add(item_hash)
        target = facts_by_key[key]
        for field_name, values in facts.items():
            for value in values:
                if value not in target[field_name]:
                    target[field_name].append(value)
    keys = sorted(
        set(records_by_key) | set(facts_by_key),
        key=lambda key: (key[0], SOURCE_ORDER[key[1]]),
    )
    rows = []
    for family_key, source_id in keys:
        key = (family_key, source_id)
        grouped_records = records_by_key.get(key, [])
        facts = facts_by_key.get(key, {})
        item_hashes = hashes_by_key[key]
        item_hash = representative_weapon_hash(manifest, item_hashes)
        meta = weapon_meta(manifest, item_hash, weapon_facts.get(item_hash, {}))
        version_labels = unique(
            f"官方发布{manifest.release_label(candidate_hash)}"
            for candidate_hash in sorted(item_hashes, key=lambda value: (manifest.release_rank(value), value), reverse=True)
            if manifest.release_label(candidate_hash)
        )
        version_text = " / ".join(version_labels)
        if len(item_hashes) > 1:
            version_text = "跨版本汇总" + (f"：{version_text}" if version_text else "")
        if any((manifest.items.get(candidate_hash) or {}).get("isHolofoil") for candidate_hash in item_hashes):
            version_text = "；".join(unique([version_text, "含全息箔版本"]))
        record_hashes = {record.item_hash for record in grouped_records}
        optional_support: dict[str, set[int]] = defaultdict(set)
        for record in grouped_records:
            for label, values in [
                ("枪管", record.barrels),
                ("弹匣", record.magazines),
                ("起源特性", record.origins),
            ]:
                for value in values:
                    optional_support[f"{label}：{value}"].add(record.item_hash)
        partial_optional = [
            value for value, supported_hashes in optional_support.items()
            if record_hashes and supported_hashes != record_hashes
        ]
        if partial_optional:
            version_text = "；".join(unique([
                version_text,
                "部分版本具备：" + " / ".join(partial_optional),
            ]))
        row = {field_name: "" for field_name in WEAPON_FIELDS}
        for field_name in WEAPON_FIELDS[:26]:
            row[field_name] = source_fact_text(facts, field_name)
        row.update({
            "页面": row["页面"] or SOURCE_LABELS[source_id],
            "分类": row["分类"] or meta["武器类型"],
            "武器": meta["武器"],
            "来源URL": row["来源URL"] or SOURCE_URLS[source_id],
            "图标": row["图标"] or meta["图标"],
            "图标图标URL": row["图标图标URL"] or meta["图标图标URL"],
            "属性": row["属性"] or meta["属性"],
            "框架": row["框架"] or meta["框架"],
            "来源": row["来源"] or meta["来源"],
            # 严格栏位只能来自已通过当前 Manifest 精确确认的 SourceRecord。
            # 原始来源字段仍保留在注解和证据中，但不得在过滤后再次回填进正式 CSV。
            "枪管": " / ".join(unique(value for record in grouped_records for value in record.barrels)),
            "弹匣": " / ".join(unique(value for record in grouped_records for value in record.magazines)),
            "大师": " / ".join(unique(value for record in grouped_records for value in record.masterworks)),
            "Perk 1": " / ".join(unique(value for record in grouped_records for value in record.perk3)),
            "Perk 2": " / ".join(unique(value for record in grouped_records for value in record.perk4)),
            "起源特性": " / ".join(unique(value for record in grouped_records for value in record.origins)),
            "注解": truncate_csv_note("；".join(unique([
                *facts.get("注解", []),
                *[record.note for record in grouped_records],
            ]))),
            "来源位置": "；".join(unique([
                *facts.get("来源位置", []),
                *[source_record_location(record) for record in grouped_records],
            ])),
            "武器ID": " / ".join(
                str(value)
                for value in sorted(item_hashes, key=lambda candidate: (manifest.release_rank(candidate), candidate), reverse=True)
            ),
            "英文名称": meta["英文名称"],
            "版本": version_text or meta["版本"],
            "推荐来源": SOURCE_LABELS[source_id],
            "用途": " / ".join(sorted(unique(record.purpose for record in grouped_records), key=lambda value: PURPOSE_ORDER.get(value, 9))) or "PVE",
        })
        rows.append(row)
    return sorted(rows, key=lambda row: (normalize(row["英文名称"] or row["武器"]), SOURCE_ORDER.get(next(
        source_id for source_id, label in SOURCE_LABELS.items() if label == row["推荐来源"]
    ), 9)))


def generate(dim_path: Path, dim_revision: str) -> dict:
    required = [
        STARSIDE_AEGIS,
        AEGIS_OFFICIAL_WEAPONS,
        STARSIDE_LGPIG_LEGENDARY,
        STARSIDE_LGPIG_EXOTIC,
        YX_SOURCE,
        SAYALARRY_SOURCE,
        dim_path,
        WORLD_DB,
        SEARCH_EN_DB,
        STATUS_JSON,
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("缺少生成输入：\n" + "\n".join(missing))

    manifest = Manifest()
    issues: list[dict] = []
    records: list[SourceRecord] = []
    class_item_rows: list[dict] = []
    source_facts: dict[tuple[int, str], dict[str, list[str]]] = {}
    weapon_facts: dict[int, dict] = {}

    load_aegis(manifest, issues, records, source_facts, weapon_facts)
    load_lgpig(manifest, issues, records, source_facts, weapon_facts)
    load_yx(manifest, issues, records, source_facts)
    load_sayalarry(manifest, issues, records, source_facts)
    load_dim(manifest, issues, records, class_item_rows, dim_path, dim_revision)

    issues = collapse_family_optional_issues(manifest, issues, records)
    weapon_rows = aggregate_source_rows(manifest, records, source_facts, weapon_facts)
    class_item_rows.sort(key=lambda row: (
        row["职业"], row["物品ID"], PURPOSE_ORDER.get(row["用途"], 9), row["使用场景"],
        row["第一特性"], row["第二特性"], row["组合ID"],
    ))
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    write_csv(WEAPON_CANDIDATE_OUTPUT, weapon_rows, WEAPON_FIELDS)
    write_csv(CLASS_ITEM_CANDIDATE_OUTPUT, class_item_rows, CLASS_ITEM_FIELDS)
    if issues:
        write_csv(ISSUE_OUTPUT, issues, ISSUE_FIELDS)
    elif ISSUE_OUTPUT.exists():
        ISSUE_OUTPUT.unlink()

    input_files = [
        STARSIDE_AEGIS,
        AEGIS_OFFICIAL_WEAPONS,
        STARSIDE_LGPIG_LEGENDARY,
        STARSIDE_LGPIG_EXOTIC,
        YX_SOURCE,
        SAYALARRY_SOURCE,
        dim_path,
    ]
    blocking_count = sum(issue["级别"] == "阻塞" for issue in issues)
    warning_count = sum(issue["级别"] == "提示" for issue in issues)
    activated = blocking_count == 0
    if activated:
        write_csv(WEAPON_OUTPUT, weapon_rows, WEAPON_FIELDS)
        write_csv(CLASS_ITEM_OUTPUT, class_item_rows, CLASS_ITEM_FIELDS)
    record_lines = [
        f"生成时间：{datetime.now().astimezone().isoformat(timespec='seconds')}",
        f"Manifest版本：{manifest.version}",
        f"DIM Revision：{dim_revision}",
        *[f"SHA256 {path.relative_to(ROOT)}：{sha256(path)}" for path in input_files],
        f"武器来源行数：{len(weapon_rows)}",
        f"唯一武器名称数：{len(set(normalize(row['英文名称'] or row['武器']) for row in weapon_rows))}",
        f"关联官方武器ID数：{len(set(value for row in weapon_rows for value in row['武器ID'].split(' / ') if value))}",
        f"异域职业物品组合行数：{len(class_item_rows)}",
        f"阻塞异常行数：{blocking_count}",
        f"非阻塞提示行数：{warning_count}",
    ]
    RECORD_OUTPUT.write_text("\n".join(record_lines) + "\n", encoding="utf-8")
    return {
        "manifest_version": manifest.version,
        "weapon_source_rows": len(weapon_rows),
        "weapons": len(set(normalize(row["英文名称"] or row["武器"]) for row in weapon_rows)),
        "weapon_item_hashes": len(set(value for row in weapon_rows for value in row["武器ID"].split(" / ") if value)),
        "class_item_combinations": len(class_item_rows),
        "blocking_issues": blocking_count,
        "warnings": warning_count,
        "activated": activated,
        "outputs": [
            str(WEAPON_OUTPUT if activated else WEAPON_CANDIDATE_OUTPUT),
            str(CLASS_ITEM_OUTPUT if activated else CLASS_ITEM_CANDIDATE_OUTPUT),
        ],
        "temporary_issue_report": str(ISSUE_OUTPUT) if issues else "",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="生成 T20 五来源统一武器推荐 CSV 和异域职业物品补充表")
    parser.add_argument("--dim", type=Path, default=DEFAULT_DIM, help="固定 revision 的 DIM Voltron 文本")
    parser.add_argument("--dim-revision", default=DEFAULT_DIM_REVISION, help="DIM Voltron 对应 Git commit SHA")
    args = parser.parse_args()
    print(json.dumps(generate(args.dim.resolve(), args.dim_revision), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
