#!/usr/bin/env python3
"""Genera supabase/seed/kb_2026_11.sql desde docs/kb/coffee_kb_research_y_recetas.xlsx y coffee_kb_reglas_ia.json.

Idempotente: inserta con `on conflict (id) do update`. Uso:
    python3 -I scripts/kb_seed.py
"""
import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "docs/kb/coffee_kb_research_y_recetas.xlsx"
RULES = ROOT / "docs/kb/coffee_kb_reglas_ia.json"
OUT = ROOT / "supabase/seed/kb_2026_11.sql"


def table(wb, sheet, key):
    rows = [r for r in wb[sheet].iter_rows(values_only=True)]
    hi = next(i for i, r in enumerate(rows) if r and r[0] == key)
    header = [str(c).strip() if c is not None else "" for c in rows[hi]]
    return [dict(zip(header, r)) for r in rows[hi + 1 :] if r and r[0]]


def lit(v):
    if v is None or v == "":
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    s = str(v).strip()
    if s == "":
        return "null"
    return "'" + s.replace("'", "''") + "'"


def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return v
    m = re.match(r"^\s*(-?\d+(?:[.,]\d+)?)", str(v))
    return float(m.group(1).replace(",", ".")) if m else None


def intnum(v):
    n = num(v)
    return int(round(n)) if n is not None else None


def date(v):
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        return v.date().isoformat() if hasattr(v, "date") else v.isoformat()
    s = str(v).strip()
    return s if re.match(r"^\d{4}-\d{2}-\d{2}$", s) else None


def upsert(tbl, cols, rows):
    lines = []
    for r in rows:
        vals = ", ".join(lit(r.get(c)) for c in cols)
        lines.append(f"({vals})")
    sets = ", ".join(f"{c} = excluded.{c}" for c in cols if c != "id")
    return (
        f"insert into public.{tbl} ({', '.join(cols)}) values\n  "
        + ",\n  ".join(lines)
        + f"\non conflict (id) do update set {sets};\n"
    )


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    S = table(wb, "01_FUENTES", "source_id")
    R = table(wb, "02_RECETAS", "recipe_id")
    P = table(wb, "03_PASOS", "paso_id")
    M = table(wb, "04_METODOS", "método")
    rules = json.loads(RULES.read_text(encoding="utf-8"))

    sources = [
        {
            "id": s["source_id"],
            "editor": s["editor"],
            "author": s["autor"],
            "title": s["titulo"],
            "kind": s["tipo"],
            "year": intnum(s["año"]),
            "url": s["url_directa"],
            "warning": s["advertencia"],
            "consulted_at": date(s["consultado_el"]),
        }
        for s in S
    ]
    method_order = {m["método"]: i for i, m in enumerate(M)}
    methods = [
        {
            "id": m["método"],
            "physics": m["física"],
            "geometry": m["geometría"],
            "filter": m["filtro"],
            "difficulty": m["dificultad"],
            "ratio_type": m["tipo_ratio"],
            "ratio_note": m["rango_descriptivo_no_prescriptivo"],
            "distinctive": m["qué lo hace distinto"],
            "source_id": m["source_id"],
            "url": m["URL_fuente"],
            "sort_order": (i + 1) * 10,
        }
        for i, m in enumerate(M)
    ]
    known_methods = {m["id"] for m in methods}
    recipes = []
    for i, r in enumerate(R):
        if r["método"] not in known_methods:
            raise SystemExit(f"método desconocido en {r['recipe_id']}: {r['método']}")
        recipes.append(
            {
                "id": r["recipe_id"],
                "method_id": r["método"],
                "submethod": r["submétodo"],
                "name": r["nombre_receta"],
                "author": r["autor_atribuido"],
                "source_id": r["source_id"],
                "evidence": r["evidencia"],
                "role": r["rol_IA"],
                "dose_g": num(r["café_g"]),
                "dose_max_g": num(r["café_max_g"]),
                "brew_water_g": num(r["agua_brew_g"]),
                "water_max_g": num(r["agua_max_g"]),
                "bypass_water_g": num(r["agua_bypass_g"]),
                "ice_g": num(r["hielo_g"]),
                "beverage_out_g": num(r["bebida_out_g"]),
                "temp_min_c": num(r["temp_min_C"]),
                "temp_max_c": num(r["temp_max_C"]),
                "grind": r["molienda"],
                "time_min_s": intnum(r["t_min_s"]),
                "time_max_s": intnum(r["t_max_s"]),
                "ratio_brew": num(r["ratio_brew_1_x"]),
                "ratio_espresso": num(r["ratio_espresso_1_x"]),
                "roast": r["tueste"],
                "target_profile": r["perfil_objetivo"],
                "gear": r["equipo"],
                "why": r["por_qué"],
                "limits": r["límites / avisos"],
                "url": r["URL_fuente"],
                "verified_at": date(r["verificado"]),
                "sort_order": (i + 1) * 10,
            }
        )
    recipe_ids = {r["id"] for r in recipes}
    steps = []
    for p in P:
        if p["recipe_id"] not in recipe_ids:
            raise SystemExit(f"paso sin receta: {p['paso_id']}")
        steps.append(
            {
                "id": p["paso_id"],
                "recipe_id": p["recipe_id"],
                "step_order": intnum(p["orden"]),
                "t_from_start_s": intnum(p["t_desde_inicio_s"]),
                "phase": p["fase"],
                "add_water_g": num(p["agregar_agua_g"]),
                "cumulative_water_g": num(p["agua_acumulada_g"]),
                "temp_c": num(p["temp_fase_C"]),
                "instruction": p["instrucción_parafraseada"],
                "why": p["por_qué"],
                "source_id": p["source_id"],
                "url": p["URL_fuente"],
            }
        )
    kb_rules = []
    for x in rules["principles"]:
        kb_rules.append({"id": x["id"], "kind": "principle", "title": x["title"], "rule": x["rule"], "category": x["category"], "caveat": x.get("caveat"), "source_id": x.get("source_id"), "confidence": x.get("confidence")})
    for x in rules["adjustment_rules"]:
        kb_rules.append({"id": x["id"], "kind": "adjustment", "title": None, "rule": None, "category": None, "signal": x["signal"], "method": x["method"], "hypothesis": x["hypothesis"], "action": x["action"], "variable": x["variable"], "magnitude": x["magnitude"], "outcome": x["outcome"], "caveat": x.get("caveat"), "source_id": x.get("source_id"), "confidence": x.get("confidence")})
    for x in rules["prompt_blocks"]:
        kb_rules.append({"id": "PB_" + x["key"], "kind": "prompt_block", "title": x["key"], "rule": x["instruction"]})

    source_ids = {s["id"] for s in sources}
    for coll, name in ((methods, "método"), (recipes, "receta"), (steps, "paso"), (kb_rules, "regla")):
        for row in coll:
            sid = row.get("source_id")
            if sid and sid not in source_ids:
                raise SystemExit(f"{name} {row['id']} apunta a fuente inexistente {sid}")

    sql = [
        "-- Seed de la base de conocimiento de recetas. Generado por scripts/kb_seed.py desde docs/kb/*. No editar a mano.",
        f"-- {len(sources)} fuentes, {len(methods)} métodos, {len(recipes)} recetas, {len(steps)} pasos, {len(kb_rules)} reglas.",
        "begin;",
        upsert("kb_sources", ["id", "editor", "author", "title", "kind", "year", "url", "warning", "consulted_at"], sources),
        upsert("kb_methods", ["id", "physics", "geometry", "filter", "difficulty", "ratio_type", "ratio_note", "distinctive", "source_id", "url", "sort_order"], methods),
        upsert(
            "kb_recipes",
            ["id", "method_id", "submethod", "name", "author", "source_id", "evidence", "role", "dose_g", "dose_max_g", "brew_water_g", "water_max_g", "bypass_water_g", "ice_g", "beverage_out_g", "temp_min_c", "temp_max_c", "grind", "time_min_s", "time_max_s", "ratio_brew", "ratio_espresso", "roast", "target_profile", "gear", "why", "limits", "url", "verified_at", "sort_order"],
            recipes,
        ),
        upsert("kb_recipe_steps", ["id", "recipe_id", "step_order", "t_from_start_s", "phase", "add_water_g", "cumulative_water_g", "temp_c", "instruction", "why", "source_id", "url"], steps),
        upsert("kb_rules", ["id", "kind", "title", "rule", "category", "signal", "method", "hypothesis", "action", "variable", "magnitude", "outcome", "caveat", "source_id", "confidence"], kb_rules),
        "commit;",
    ]
    OUT.write_text("\n".join(sql), encoding="utf-8")
    print(f"ok: {OUT} ({len(sources)} fuentes, {len(methods)} métodos, {len(recipes)} recetas, {len(steps)} pasos, {len(kb_rules)} reglas)")


if __name__ == "__main__":
    main()
