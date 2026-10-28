from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(r"D:\codex-ai\models\qwen2.5-1.5b-instruct")
PROVIDED_PATH = ROOT / "scripts" / "provided-recipes.json"
OUTPUT_PATH = ROOT / "src" / "lib" / "recipe-data.json"


def salt_group(step_description: str) -> dict[str, Any]:
    return {
        "id": "salt-level",
        "label": "盐量",
        "kind": "salt",
        "defaultOptionId": "medium",
        "options": [
            {"id": "low", "label": "偏少", "effect": {"salt": -5}, "simulation": {"seasoningId": "salt", "amountLevel": "little"}},
            {"id": "medium", "label": "适中", "effect": {"salt": 5, "umami": 2}, "simulation": {"seasoningId": "salt", "amountLevel": "moderate"}},
            {"id": "high", "label": "偏多", "effect": {"salt": 15}, "simulation": {"seasoningId": "salt", "amountLevel": "lot"}, "warning": f"{step_description}时盐量偏多，会压住食材本味并增加咸味。"},
        ],
    }


def acid_group(default: str = "medium") -> dict[str, Any]:
    return {
        "id": "acid-level",
        "label": "酸味",
        "kind": "acid",
        "defaultOptionId": default,
        "options": [
            {"id": "low", "label": "少", "effect": {"acid": 2}, "simulation": {"seasoningId": "vinegar", "amountLevel": "little"}},
            {"id": "medium", "label": "适中", "effect": {"acid": 8, "aroma": 3}, "simulation": {"seasoningId": "vinegar", "amountLevel": "moderate"}},
            {"id": "high", "label": "多", "effect": {"acid": 14}, "simulation": {"seasoningId": "vinegar", "amountLevel": "lot"}, "warning": "醋量偏多会明显压住甜味和鲜味。"},
        ],
    }


def sugar_group() -> dict[str, Any]:
    return {
        "id": "sugar-level",
        "label": "糖量",
        "kind": "sugar",
        "defaultOptionId": "low",
        "options": [
            {"id": "none", "label": "不加", "effect": {"acid": 3}, "simulation": {"seasoningId": "sugar", "amountLevel": "little"}},
            {"id": "low", "label": "少许", "effect": {"sugar": 5, "acid": -1}, "simulation": {"seasoningId": "sugar", "amountLevel": "little"}},
            {"id": "high", "label": "偏多", "effect": {"sugar": 13}, "simulation": {"seasoningId": "sugar", "amountLevel": "lot"}, "warning": "糖偏多会掩盖番茄或酱汁本身的酸鲜层次。"},
        ],
    }


def heat_group() -> dict[str, Any]:
    return {
        "id": "heat-level",
        "label": "火力",
        "kind": "heat",
        "defaultOptionId": "high",
        "options": [
            {"id": "low", "label": "小火", "effect": {"temperature": -8, "duration": 4}, "simulation": {"heatLevel": "low"}},
            {"id": "medium", "label": "中火", "effect": {"temperature": 0}, "simulation": {"heatLevel": "medium"}},
            {"id": "high", "label": "大火", "effect": {"temperature": 8, "aroma": 4}, "simulation": {"heatLevel": "high"}},
        ],
    }


def duration_group(negative_warning: str) -> dict[str, Any]:
    return {
        "id": "duration-level",
        "label": "加热时长",
        "kind": "duration",
        "defaultOptionId": "medium",
        "options": [
            {"id": "short", "label": "偏短", "effect": {"duration": -5, "safety": -3}, "simulation": {"durationMin": 2}, "warning": "加热时间偏短时要确认高风险食材已经熟透。"},
            {"id": "medium", "label": "适中", "effect": {"duration": 3, "aroma": 3}, "simulation": {"durationMin": 4}},
            {"id": "long", "label": "偏长", "effect": {"duration": 9, "water": -4}, "simulation": {"durationMin": 7}, "warning": negative_warning},
        ],
    }


def timing_group() -> dict[str, Any]:
    return {
        "id": "acid-timing",
        "label": "放醋时机",
        "kind": "timing",
        "defaultOptionId": "late",
        "options": [
            {"id": "early", "label": "早放", "effect": {"acid": 6, "crispness": 5, "aroma": -2}, "simulation": {"seasoningId": "vinegar", "timing": "early"}},
            {"id": "late", "label": "出锅前", "effect": {"acid": 5, "aroma": 6}, "simulation": {"seasoningId": "vinegar", "timing": "late"}},
        ],
    }


SOURCE_PLAN: dict[int, dict[str, Any]] = {
    7: {"slug": "garlic-broccoli", "category": "素菜", "ingredients": [("西兰花", "main"), ("胡萝卜", "supporting"), ("大蒜", "supporting"), ("食盐", "seasoning")], "steps": ["切小朵并清洗", "沸水短焯", "蒜末爆香后快炒", "断生调味出锅"], "variables": {2: ["duration"], 3: ["heat", "salt"]}, "summary": "用短焯和快炒保留西兰花颜色与爽脆口感。"},
    8: {"slug": "dry-fried-green-beans", "category": "素菜", "ingredients": [("四季豆", "main"), ("大蒜", "supporting"), ("干辣椒", "seasoning"), ("生抽", "seasoning"), ("食盐", "seasoning")], "steps": ["摘洗并彻底控水", "煸至表皮起皱", "下蒜辣炒香", "调味并确认熟透"], "variables": {1: ["heat"], 2: ["duration"], 3: ["salt"]}, "summary": "四季豆必须彻底加热熟透，以干煸手法形成焦香。"},
    9: {"slug": "pepper-pork", "category": "畜肉", "ingredients": [("里脊肉", "main"), ("青椒", "main"), ("大蒜", "supporting"), ("生抽", "seasoning"), ("淀粉", "seasoning")], "steps": ["切丝并上浆", "滑炒肉丝", "爆香蒜末与青椒", "合炒调味出锅"], "variables": {1: ["heat"], 3: ["salt"]}, "summary": "肉丝先上浆滑炒，青椒后放以保持脆嫩和清香。"},
    10: {"slug": "yuxiang-pork", "category": "畜肉", "ingredients": [("里脊肉", "main"), ("木耳", "supporting"), ("竹笋", "supporting"), ("大蒜", "supporting"), ("生抽", "seasoning"), ("醋", "seasoning"), ("糖", "seasoning"), ("淀粉", "seasoning")], "steps": ["切丝并把肉上浆", "调好酸甜汁", "滑炒肉丝与配料", "倒入碗汁快速收浓"], "variables": {1: ["sugar", "acid"], 2: ["heat"], 3: ["salt"]}, "summary": "酸甜咸鲜来自碗汁比例和最后收汁，不在高温下久炒。"},
    11: {"slug": "potato-beef-stew", "category": "畜肉", "ingredients": [("牛腩", "main"), ("土豆", "supporting"), ("胡萝卜", "supporting"), ("生抽", "seasoning"), ("老抽", "seasoning")], "steps": ["切块并把牛肉焯水", "煸香牛肉和酱香", "加水炖至牛肉变软", "放土豆收汁"], "variables": {1: ["heat"], 2: ["duration"], 3: ["salt"]}, "summary": "先让牛肉达到安全熟度，再放土豆避免土豆过烂。"},
    12: {"slug": "tomato-beef-brisket", "category": "畜肉", "ingredients": [("牛腩", "main"), ("番茄", "supporting"), ("生抽", "seasoning"), ("食盐", "seasoning")], "steps": ["牛肉切块焯水", "炒出番茄汁", "加入牛肉炖软", "调味并收浓"], "variables": {1: ["heat"], 2: ["duration"], 3: ["salt"]}, "summary": "番茄先炒出汁，牛肉炖到熟软后收汁形成浓汤。"},
    13: {"slug": "braised-pork", "category": "畜肉", "ingredients": [("五花肉", "main"), ("糖", "seasoning"), ("老抽", "seasoning"), ("料酒", "seasoning"), ("八角", "seasoning")], "steps": ["切块并焯水擦干", "煸出部分油脂", "炒糖色并加水焖煮", "大火收汁"], "variables": {1: ["heat"], 2: ["duration", "sugar"], 3: ["duration"]}, "summary": "先煸油再慢焖，最后收汁让颜色和味道集中到肉表面。"},
    14: {"slug": "twice-cooked-pork", "category": "畜肉", "ingredients": [("五花肉", "main"), ("白菜", "supporting"), ("大蒜", "supporting"), ("豆瓣酱", "seasoning"), ("生抽", "seasoning")], "steps": ["五花肉煮至熟透后切片", "煸炒肉片出油", "下豆瓣酱炒香", "放白菜快速合炒"], "variables": {0: ["duration"], 1: ["heat"], 3: ["salt"]}, "summary": "五花肉先煮到安全熟度，再切片回锅快速煸香。"},
    15: {"slug": "kung-pao-chicken", "category": "禽肉", "ingredients": [("鸡腿肉", "main"), ("黄瓜", "supporting"), ("干辣椒", "seasoning"), ("生抽", "seasoning"), ("醋", "seasoning"), ("糖", "seasoning"), ("淀粉", "seasoning")], "steps": ["鸡肉切丁腌制上浆", "调好酸甜碗汁", "滑炒鸡丁并爆香辣椒", "下黄瓜和碗汁快速翻匀"], "variables": {1: ["sugar", "acid"], 2: ["heat"], 3: ["salt"]}, "summary": "鸡丁彻底熟透，酸甜汁最后下锅，避免黄瓜出水变软。"},
    16: {"slug": "mushroom-chicken", "category": "禽肉", "ingredients": [("鸡腿肉", "main"), ("香菇", "supporting"), ("生抽", "seasoning"), ("淀粉", "seasoning"), ("食盐", "seasoning")], "steps": ["鸡肉腌制上浆，香菇切片", "先炒鸡肉至变色", "下香菇炒出香气", "调味收汁"], "variables": {1: ["heat"], 3: ["salt"]}, "summary": "鸡肉先受热至安全熟度，香菇吸收鸡肉和酱汁的鲜味。"},
    17: {"slug": "steamed-sea-bass", "category": "水产", "ingredients": [("鲈鱼", "main"), ("料酒", "seasoning"), ("生抽", "seasoning"), ("食盐", "seasoning")], "steps": ["鱼身处理干净并改刀", "短时盐酒腌制", "水开后上锅蒸熟", "倒掉蒸汁并补豉油"], "variables": {1: ["duration"], 2: ["duration"]}, "summary": "水开后蒸制，鱼肉刚熟时取出，避免长时间加热导致发柴。"},
    18: {"slug": "poached-shrimp", "category": "水产", "ingredients": [("虾", "main"), ("料酒", "seasoning"), ("生抽", "seasoning")], "steps": ["虾清洗并去虾线", "水烧开后下虾", "短时煮至变色卷曲", "捞出蘸汁"], "variables": {1: ["duration"], 3: ["salt"]}, "summary": "虾肉蛋白受热很快凝固，变色卷曲后马上捞出。"},
    19: {"slug": "garlic-vermicelli-shrimp", "category": "水产", "ingredients": [("虾", "main"), ("粉丝", "supporting"), ("大蒜", "supporting"), ("生抽", "seasoning"), ("食用油", "seasoning")], "steps": ["粉丝泡软，虾开背", "炒香一半蒜末", "调蒜蓉酱汁", "蒸至虾熟后补葱蒜"], "variables": {1: ["heat"], 2: ["salt"], 3: ["duration"]}, "summary": "粉丝吸汁，蒜蓉一次炒香一次后放，保留香气和辛辣层次。"},
    20: {"slug": "home-style-tofu", "category": "豆制品", "ingredients": [("老豆腐", "main"), ("青椒", "supporting"), ("木耳", "supporting"), ("大蒜", "supporting"), ("生抽", "seasoning"), ("淀粉", "seasoning")], "steps": ["豆腐切块并擦干", "煎至两面定型", "下配料和酱汁", "勾薄芡收汁"], "variables": {1: ["heat"], 3: ["salt"]}, "summary": "豆腐先煎定型，后期收汁让表面挂味而不易碎。"},
    21: {"slug": "mapo-tofu", "category": "豆制品", "ingredients": [("豆腐", "main"), ("牛肉末", "supporting"), ("大蒜", "supporting"), ("豆瓣酱", "seasoning"), ("花椒", "seasoning"), ("淀粉", "seasoning")], "steps": ["豆腐切块并焯水", "炒香豆瓣酱和牛肉末", "加水放豆腐轻推", "分次勾芡并补花椒香"], "variables": {1: ["heat"], 3: ["salt"]}, "summary": "豆腐焯水去豆腥并定型，分次勾芡让汤汁均匀挂住豆腐。"},
    22: {"slug": "chive-egg", "category": "禽肉", "ingredients": [("韭菜", "main"), ("鸡蛋", "main"), ("食盐", "seasoning"), ("食用油", "seasoning")], "steps": ["韭菜切段，鸡蛋打散", "先炒蛋至刚凝固", "下韭菜大火快炒", "合炒调味立即出锅"], "variables": {1: ["heat"], 2: ["duration"], 3: ["salt"]}, "summary": "鸡蛋刚凝固就盛出，韭菜最后快炒以保持香气和脆嫩。"},
    23: {"slug": "spinach-tofu-soup", "category": "汤羹", "ingredients": [("菠菜", "main"), ("豆腐", "supporting"), ("食盐", "seasoning")], "steps": ["菠菜洗净，豆腐切块", "水开下豆腐煮热", "放菠菜短时煮熟", "少量盐调味"], "variables": {2: ["duration"], 3: ["salt"]}, "summary": "叶菜最后放，短时加热即可，避免汤色发暗和菜叶软烂。"},
    24: {"slug": "winter-melon-rib-soup", "category": "汤羹", "ingredients": [("冬瓜", "main"), ("排骨", "main"), ("食盐", "seasoning"), ("料酒", "seasoning")], "steps": ["排骨冷水下锅焯洗", "加水炖至排骨熟软", "放冬瓜煮至透明", "最后少量盐调味"], "variables": {1: ["duration", "heat"], 3: ["salt"]}, "summary": "排骨先炖至熟透，冬瓜后放，避免冬瓜化为碎块。"},
    25: {"slug": "egg-fried-rice", "category": "主食", "ingredients": [("米饭", "main"), ("鸡蛋", "main"), ("生抽", "seasoning"), ("食盐", "seasoning")], "steps": ["米饭打散，鸡蛋搅匀", "热锅炒蛋并划散", "下米饭大火翻炒", "少量调味后出锅"], "variables": {1: ["heat"], 3: ["salt"]}, "summary": "先把蛋液炒散，再用足温快速炒开米饭，减少结块和粘锅。"},
}

INGREDIENT_IDS = {
    "上海青": "greens",
    "土豆": "potato",
    "鸡蛋": "egg",
    "番茄": "tomato",
    "豆腐": "tofu",
    "牛里脊": "beef",
    "五花肉": "pork",
    "鲈鱼": "fish",
    "里脊肉": "pork-loin",
    "排骨": "pork-ribs",
    "牛腩": "beef-brisket",
    "牛腱子": "beef-shank",
    "鸡胸肉": "chicken-breast",
    "鸡腿肉": "chicken-thigh",
    "草鱼": "grass-carp",
    "鲫鱼": "crucian-carp",
    "虾": "shrimp",
    "花甲": "clam",
    "鱿鱼": "squid",
    "白菜": "napa-cabbage",
    "菠菜": "spinach",
    "油麦菜": "youmaicai",
    "生菜": "lettuce",
    "韭菜": "chives",
    "香菜": "cilantro",
    "芹菜": "celery",
    "空心菜": "water-spinach",
    "黄瓜": "cucumber",
    "冬瓜": "winter-melon",
    "南瓜": "pumpkin",
    "丝瓜": "luffa",
    "茄子": "eggplant",
    "青椒": "green-pepper",
    "彩椒": "bell-pepper",
    "胡萝卜": "carrot",
    "白萝卜": "daikon",
    "莲藕": "lotus-root",
    "山药": "yam",
    "芋头": "taro",
    "莴笋": "celtuce",
    "香菇": "shiitake",
    "金针菇": "enoki",
    "杏鲍菇": "king-oyster",
    "木耳": "wood-ear",
    "老豆腐": "firm-tofu",
    "豆干": "dried-tofu",
    "腐竹": "yuba",
    "粉条": "glass-noodles",
    "粉丝": "vermicelli",
    "竹笋": "bamboo-shoots",
    "西兰花": "greens",
    "四季豆": "greens",
    "米饭": "glass-noodles",
    "牛肉末": "beef-brisket",
}

SEASONING_IDS = {
    "食盐": "salt",
    "生抽": "light-soy",
    "老抽": "dark-soy",
    "醋": "vinegar",
    "白醋": "vinegar",
    "白糖": "sugar",
    "糖": "sugar",
    "料酒": "wine",
    "食用油": "oil",
    "淀粉": "starch",
    "蚝油": "oyster-sauce",
    "鱼露": "fish-sauce",
    "干辣椒": "chili",
    "花椒": "sichuan-pepper",
    "八角": "star-anise",
    "桂皮": "cinnamon",
    "香叶": "bay-leaf",
    "白胡椒": "white-pepper",
    "黑胡椒": "black-pepper",
    "豆瓣酱": "doubanjiang",
    "甜面酱": "sweet-bean-sauce",
    "豆豉": "fermented-black-beans",
    "鸡精": "chicken-bouillon",
    "味精": "msg",
}

MODIFIER_IDS = {
    "大蒜": "garlic",
    "小葱": "scallion",
    "葱": "scallion",
    "姜": "ginger",
}


def hydrate_ingredient_refs(recipe: dict[str, Any]) -> dict[str, Any]:
    hydrated = []
    for ingredient in recipe["ingredients"]:
        name = ingredient["name"]
        ref = dict(ingredient)
        if name in SEASONING_IDS:
            ref["seasoningId"] = SEASONING_IDS[name]
        elif name in MODIFIER_IDS:
            ref["modifierId"] = MODIFIER_IDS[name]
        elif name in INGREDIENT_IDS:
            ref["ingredientId"] = INGREDIENT_IDS[name]
        hydrated.append(ref)
    return {**recipe, "ingredients": hydrated}


def finalize_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    for step in recipe["steps"]:
        if recipe["id"] == 8 and "手部感染" in step["aiWarning"]:
            step["aiWarning"] = "四季豆表面水分未控干会造成油花飞溅，也可能影响均匀受热。"
        if step["aiWarning"].strip() in {"无需特别注意", ""}:
            step["aiWarning"] = "继续观察食材中心熟度与表面状态；高风险食材未熟透时不要出锅。"
        if recipe["id"] == 21 and "烫伤" in step["aiWarning"]:
            step["aiWarning"] = "豆腐易碎，推锅时不要大力翻动；花椒最后补香，避免高温久炒发苦。"
        for group in step["variableGroups"]:
            for option in group["options"]:
                if option.get("warning") is None:
                    option.pop("warning", None)
                if group["kind"] == "method" and not option.get("simulation"):
                    if "少油" in option["label"]:
                        option["simulation"] = {
                            "seasoningId": "oil",
                            "amountLevel": "little",
                            "heatMethod": "braise",
                        }
                    else:
                        option["simulation"] = {
                            "seasoningId": "oil",
                            "amountLevel": "lot",
                            "heatMethod": "pan-fry",
                        }
    return hydrate_ingredient_refs(recipe)


def variable_group_for_kind(kind: str) -> dict[str, Any]:
    if kind == "salt":
        return salt_group("调味")
    if kind == "acid":
        return acid_group()
    if kind == "sugar":
        return sugar_group()
    if kind == "heat":
        return heat_group()
    if kind == "duration":
        return duration_group("加热时间偏长，食材可能失水、变软或失去鲜绿色。")
    raise ValueError(kind)


def adjust_group_id(group: dict[str, Any], step_id: int) -> dict[str, Any]:
    return {
        **group,
        "id": f"{group['id']}-{step_id}",
        "options": [
            option
            | {
                "id": f"{option['id']}-{step_id}",
            }
            for option in group["options"]
        ],
        "defaultOptionId": f"{group['defaultOptionId']}-{step_id}",
    }


def safe_effect_for_option(label: str, kind: str) -> tuple[dict[str, int], dict[str, Any], str | None]:
    mapping = {
        "salt": {
            "偏少": ({"salt": -5}, {"seasoningId": "salt", "amountLevel": "little"}, None),
            "盐偏少": ({"salt": -5}, {"seasoningId": "salt", "amountLevel": "little"}, None),
            "适中": ({"salt": 5, "umami": 2}, {"seasoningId": "salt", "amountLevel": "moderate"}, None),
            "盐适中": ({"salt": 5, "umami": 2}, {"seasoningId": "salt", "amountLevel": "moderate"}, None),
            "偏多": ({"salt": 15}, {"seasoningId": "salt", "amountLevel": "lot"}, "盐量偏多会压住食材本味。"),
            "盐偏多": ({"salt": 15}, {"seasoningId": "salt", "amountLevel": "lot"}, "盐量偏多会压住食材本味。"),
            "盐多": ({"salt": 15}, {"seasoningId": "salt", "amountLevel": "lot"}, "盐量偏多会压住食材本味。"),
            "盐少": ({"salt": -5}, {"seasoningId": "salt", "amountLevel": "little"}, None),
        },
        "acid": {
            "醋少": ({"acid": 3}, {"seasoningId": "vinegar", "amountLevel": "little"}, None),
            "醋多": ({"acid": 14}, {"seasoningId": "vinegar", "amountLevel": "lot"}, "醋量偏多会压住鲜甜味。"),
            "早放醋": ({"acid": 7, "crispness": 4, "aroma": -1}, {"seasoningId": "vinegar", "timing": "early"}, None),
            "晚放醋": ({"acid": 5, "aroma": 5}, {"seasoningId": "vinegar", "timing": "late"}, None),
        },
        "sugar": {
            "加糖少": ({"sugar": 4}, {"seasoningId": "sugar", "amountLevel": "little"}, None),
            "加糖多": ({"sugar": 12}, {"seasoningId": "sugar", "amountLevel": "lot"}, "糖偏多会掩盖酸鲜层次。"),
        },
        "heat": {
            "小火": ({"temperature": -8, "duration": 4}, {"heatLevel": "low"}, "小火可能让叶菜或土豆丝失去脆感。"),
            "中火": ({"temperature": 0}, {"heatLevel": "medium"}, None),
            "大火": ({"temperature": 7, "aroma": 4}, {"heatLevel": "high"}, None),
        },
        "duration": {
            "炒制时间短": ({"duration": -4, "safety": -2}, {"durationMin": 2}, "时间偏短时先确认食材已经熟透。"),
            "炒制时间长": ({"duration": 8, "water": -3}, {"durationMin": 7}, "加热过久会让食材失水、发黄或变软。"),
            "焯水短": ({"duration": -3, "safety": -2}, {"durationMin": 1}, "焯水过短时要确认内部已经受热。"),
            "焯水久": ({"duration": 7, "water": -3}, {"durationMin": 5}, "焯水过久会损失颜色、口感和部分水溶性营养。"),
        },
        "method": {
            "少油焖煮": ({"water": 5, "tenderness": 5}, {}, None),
            "多油煸炒": ({"water": -4, "aroma": 6}, {}, "油脂偏多会明显增加油腻感。"),
        },
    }
    return mapping[kind][label]


def group_from_optional(options: list[str], step_id: int) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    def ensure(group_id: str, label: str, kind: str, options_list: list[dict[str, Any]]):
        groups.setdefault(
            group_id,
            {
                "id": group_id,
                "label": label,
                "kind": kind,
                "defaultOptionId": "",
                "options": options_list,
            },
        )
        return groups[group_id]
    for label in options:
        if "醋" in label and ("早" in label or "晚" in label):
            effect, simulation, warning = safe_effect_for_option(label, "acid")
            ensure("timing", "放醋时机", "timing", []).setdefault("options", [])
            groups["timing"]["options"].append({"id": label, "label": label, "effect": effect, "simulation": simulation, "warning": warning})
        elif "醋" in label:
            effect, simulation, warning = safe_effect_for_option(label, "acid")
            ensure("acid", "酸味", "acid", []).setdefault("options", [])
            groups["acid"]["options"].append({"id": label, "label": label, "effect": effect, "simulation": simulation, "warning": warning})
        elif "盐" in label:
            effect, simulation, warning = safe_effect_for_option(label, "salt")
            ensure("salt", "盐量", "salt", []).setdefault("options", [])
            groups["salt"]["options"].append({"id": label, "label": label, "effect": effect, "simulation": simulation, "warning": warning})
        elif "糖" in label:
            effect, simulation, warning = safe_effect_for_option(label, "sugar")
            ensure("sugar", "糖量", "sugar", []).setdefault("options", [])
            groups["sugar"]["options"].append({"id": label, "label": label, "effect": effect, "simulation": simulation, "warning": warning})
        elif "火" in label:
            effect, simulation, warning = safe_effect_for_option(label, "heat")
            ensure("heat", "火力", "heat", []).setdefault("options", [])
            groups["heat"]["options"].append({"id": label, "label": label, "effect": effect, "simulation": simulation, "warning": warning})
        elif "时间" in label or "焯水" in label:
            effect, simulation, warning = safe_effect_for_option(label, "duration")
            ensure("duration", "加热时长", "duration", []).setdefault("options", [])
            groups["duration"]["options"].append({"id": label, "label": label, "effect": effect, "simulation": simulation, "warning": warning})
        elif "油" in label:
            effect, simulation, warning = safe_effect_for_option(label, "method")
            ensure("method", "用油方式", "method", []).setdefault("options", [])
            groups["method"]["options"].append({"id": label, "label": label, "effect": effect, "simulation": simulation, "warning": warning})
    for idx, group in enumerate(groups.values()):
        group["id"] = f"{group['id']}-{step_id}-{idx}"
        for option in group["options"]:
            option["id"] = f"{option['id']}-{step_id}-{idx}"
        preferred = next(
            (
                option
                for option in group["options"]
                if option["label"] in {"适中", "中火", "晚放醋", "加糖少", "炒制时间短", "焯水短"}
            ),
            group["options"][0],
        )
        group["defaultOptionId"] = preferred["id"]
    return list(groups.values())


def convert_provided(item: dict[str, Any]) -> dict[str, Any]:
    steps = []
    for step in item["steps"]:
        options = step.get("optional") or []
        groups = group_from_optional(options, step["stepId"])
        steps.append({
            "stepId": step["stepId"],
            "title": f"步骤 {step['stepId']}",
            "description": step["desc"],
            "actionLabel": "完成本步",
            "knowledge": step["knowledge"],
            "aiWarning": step["ai_warning"],
            "variableGroups": groups,
        })
    return {
        "id": item["id"],
        "slug": f"provided-{item['id']}",
        "name": item["name"],
        "category": item["category"],
        "summary": item.get("knowledge") or f"按标准步骤完成{item['name']}。",
        "ingredients": [
            {"name": name, "role": "seasoning" if name in {"食盐","生抽","老抽","醋","白醋","白糖","料酒","食用油","蚝油","鱼露","豆瓣酱","淀粉","干辣椒","花椒","八角"} else ("main" if idx == 0 else "supporting")}
            for idx, name in enumerate(item["ingredients"])
        ],
        "steps": steps,
        "safetyNotes": [{"title": "烹饪安全", "detail": "食材应清洗干净；畜禽和水产需彻底加热，实际烹饪请结合食材厚度与当地食品安全建议。"}],
        "source": "provided",
    }


def fallback_generated(seed: dict[str, Any]) -> dict[str, Any]:
    step_titles = seed["steps"]
    steps = []
    for index, title in enumerate(step_titles, start=1):
        variables = []
        for kind in seed.get("variables", {}).get(index, []):
            variables.append(adjust_group_id(variable_group_for_kind(kind), index))
        steps.append({
            "stepId": index,
            "title": title,
            "description": f"按标准操作完成“{title}”，观察颜色、气味和质地变化后再进入下一步。",
            "actionLabel": "完成本步",
            "knowledge": f"{title}会改变食材的受热、水分或风味状态；根据当前锅温和表面变化判断操作时机。",
            "aiWarning": "不要跳过本步直接进入下一阶段；如果颜色、气味或熟度异常，应先调整火候。",
            "variableGroups": variables,
        })
    safety = []
    names = [name for name, _ in seed["ingredients"]]
    if any(name in {"牛肉","牛腩","里脊肉","五花肉","排骨","鸡腿肉","鸡胸肉","鸡蛋","鲈鱼","鱼","虾"} for name in names):
        safety.append({"title": "彻底加热", "detail": "肉类、水产和鸡蛋应彻底加热到安全熟度，生熟器具分开。"})
    if "四季豆" in names:
        safety.append({"title": "四季豆必须熟透", "detail": "四季豆未熟透可能引起中毒，应炒至颜色变深、质地变软且无生豆味。"})
    safety.append({"title": "操作边界", "detail": "本页用于教学模拟；实际烹饪需结合食材厚度、锅具和当地食品安全要求。"})
    return {
        "id": seed["id"],
        "slug": seed["slug"],
        "name": seed["name"],
        "category": seed["category"],
        "summary": seed["summary"],
        "ingredients": [
            {"name": name, "role": role}
            for name, role in seed["ingredients"]
        ],
        "steps": steps,
        "safetyNotes": safety,
        "source": "generated",
    }


def extract_json(text: str) -> dict[str, Any] | None:
    cleaned = re.sub(r"```(?:json)?", "", text).replace("```", "")
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        return json.loads(cleaned[start:end+1])
    except Exception:
        return None


def generate_with_model(model, tokenizer, seed: dict[str, Any]) -> dict[str, Any] | None:
    prompt = f"""你是严谨的中式烹饪实训课程编辑。请根据以下菜品信息生成教学步骤。
菜品：{seed['name']}
分类：{seed['category']}
食材：{', '.join(name for name,_ in seed['ingredients'])}
步骤计划：{json.dumps(seed['steps'], ensure_ascii=False)}
要求：只输出JSON；steps数量必须与步骤计划一致；每个步骤包含 title、description、actionLabel、knowledge、aiWarning；description不超过80字；knowledge和aiWarning各不超过100字；不要夸大，不要声称料酒消毒，不要生成生肉安全建议。安全信息必须准确。
输出格式示例：{{"summary":"一句话","steps":[{{"title":"标题","description":"描述","actionLabel":"完成本步","knowledge":"原理","aiWarning":"错误提示"}}]}}"""
    messages = [
        {"role": "system", "content": "你只输出合法JSON，不使用Markdown代码围栏。"},
        {"role": "user", "content": prompt},
    ]
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    torch.manual_seed(20261027 + seed["id"])
    with torch.no_grad():
        generated = model.generate(
            **inputs,
            max_new_tokens=1000,
            do_sample=True,
            temperature=0.35,
            top_p=0.9,
            repetition_penalty=1.05,
            pad_token_id=tokenizer.eos_token_id,
        )
    output = tokenizer.decode(generated[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
    return extract_json(output)


def merge_generated(seed: dict[str, Any], generated: dict[str, Any]) -> dict[str, Any] | None:
    raw_steps = generated.get("steps")
    if not isinstance(raw_steps, list) or len(raw_steps) != len(seed["steps"]):
        return None
    steps = []
    for index, (title, raw) in enumerate(zip(seed["steps"], raw_steps), start=1):
        if not isinstance(raw, dict):
            return None
        desc = str(raw.get("description", "")).strip()
        knowledge = str(raw.get("knowledge", "")).strip()
        warning = str(raw.get("aiWarning", "")).strip()
        if len(desc) < 5 or len(knowledge) < 5 or len(warning) < 5:
            return None
        variables = [
            adjust_group_id(variable_group_for_kind(kind), index)
            for kind in seed.get("variables", {}).get(index, [])
        ]
        steps.append({
            "stepId": index,
            "title": str(raw.get("title") or title).strip()[:20],
            "description": desc[:120],
            "actionLabel": str(raw.get("actionLabel") or "完成本步").strip()[:20],
            "knowledge": knowledge[:160],
            "aiWarning": warning[:160],
            "variableGroups": variables,
        })
    fallback = fallback_generated(seed)
    return {
        **fallback,
        "summary": str(generated.get("summary") or fallback["summary"]).strip()[:160],
        "steps": steps,
    }


def validate(recipes: list[dict[str, Any]]) -> None:
    if len(recipes) != 25:
        raise RuntimeError(f"Expected 25 recipes, got {len(recipes)}")
    ids = [r["id"] for r in recipes]
    names = [r["name"] for r in recipes]
    if len(set(ids)) != 25 or len(set(names)) != 25:
        raise RuntimeError("Recipe ids and names must be unique")
    banned = ["料酒消毒", "白酒消毒", "生肉可食", "豆角半生"]
    for recipe in recipes:
        if not 3 <= len(recipe["steps"]) <= 8:
            raise RuntimeError(f"{recipe['name']} has invalid step count")
        for step in recipe["steps"]:
            if not all(step.get(key) for key in ["description", "knowledge", "aiWarning"]):
                raise RuntimeError(f"{recipe['name']} has empty teaching text")
            for group in step["variableGroups"]:
                if not 2 <= len(group["options"]) <= 4:
                    raise RuntimeError(f"{recipe['name']} has invalid choice group")
        text = json.dumps(recipe, ensure_ascii=False)
        if any(term in text for term in banned):
            raise RuntimeError(f"{recipe['name']} contains unsafe claim")


def main() -> int:
    provided = json.loads(PROVIDED_PATH.read_text(encoding="utf-8"))
    converted = [convert_provided(item) for item in provided]
    if not MODEL_PATH.exists():
        print(f"Model missing: {MODEL_PATH}", file=sys.stderr)
        return 2
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_PATH), trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        str(MODEL_PATH),
        torch_dtype=torch.float16,
        device_map="cuda",
        trust_remote_code=True,
    )
    model.eval()
    random.seed(20261027)
    generated_recipes = []
    for dish_id in range(7, 26):
        seed = {"id": dish_id, **SOURCE_PLAN[dish_id], "name": SOURCE_PLAN[dish_id].get("name", "")}
        seed["name"] = {
            7:"清炒西兰花",8:"干煸四季豆",9:"青椒肉丝",10:"鱼香肉丝",11:"土豆炖牛肉",12:"番茄牛腩",13:"红烧五花肉",14:"回锅肉",15:"宫保鸡丁",16:"香菇滑鸡",17:"清蒸鲈鱼",18:"白灼虾",19:"蒜蓉粉丝虾",20:"家常豆腐",21:"麻婆豆腐",22:"韭菜炒鸡蛋",23:"菠菜豆腐汤",24:"冬瓜排骨汤",25:"蛋炒饭"
        }[dish_id]
        generated = None
        for _ in range(2):
            candidate = generate_with_model(model, tokenizer, seed)
            generated = merge_generated(seed, candidate) if candidate else None
            if generated:
                break
        generated_recipes.append(generated or fallback_generated(seed))
        print(f"generated {dish_id}: {seed['name']} ({'model' if generated else 'fallback'})", flush=True)
    recipes = sorted(converted + generated_recipes, key=lambda item: item["id"])
    recipes = [finalize_recipe(recipe) for recipe in recipes]
    validate(recipes)
    OUTPUT_PATH.write_text(json.dumps(recipes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {len(recipes)} recipes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
