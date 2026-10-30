#!/usr/bin/env python3
"""LOCAL FALLBACK ONLY: emits src/types/database.ts in the same shape as
`supabase gen types typescript` by reading the catalog of a locally migrated
database. Prefer `npm run db:types` against a linked project."""
import json, subprocess, sys

DB = sys.argv[1] if len(sys.argv) > 1 else "portal_rls_test"

def q(sql):
    out = subprocess.run(["su", "postgres", "-c", f"psql -X -At -d {DB}"], input=f"select coalesce(json_agg(t), '[]') from ({sql}) t",
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)

enums = q("""select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' group by t.typname order by 1""")
enum_names = {e["name"] for e in enums}

cols = q("""select c.relname as tbl, c.relkind as kind, a.attname as col, a.attnum,
    format_type(a.atttypid, a.atttypmod) as fmt, t.typname, t.typcategory as cat,
    et.typname as elem, not a.attnotnull as nullable,
    (a.atthasdef or a.attidentity <> '') as has_default, a.attgenerated <> '' as generated
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
  where n.nspname = 'public' and c.relkind in ('r','v') and a.attnum > 0 and not a.attisdropped
  order by c.relname, a.attnum""")

fks = q("""select c.conname, src.relname as tbl, dst.relname as ref,
    (select array_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n) as columns,
    (select array_agg(a.attname order by k.ord) from unnest(c.confkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n) as refcols,
    exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indisunique and i.indkey::int2[] @> c.conkey and array_length(i.indkey::int2[],1) = array_length(c.conkey,1)) as one
  from pg_constraint c join pg_class src on src.oid = c.conrelid join pg_class dst on dst.oid = c.confrelid
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace and dst.relnamespace = 'public'::regnamespace order by 1""")

funcs = q("""select p.proname as name, pg_get_function_identity_arguments(p.oid) as ident,
    p.proargnames as argnames, p.proargmodes as modes,
    (select array_agg(format_type(x, null)) from unnest(p.proallargtypes) x) as alltypes,
    (select array_agg(format_type(x, null)) from unnest(p.proargtypes::oid[]) x) as intypes,
    p.pronargdefaults as ndefaults, format_type(p.prorettype, null) as ret, p.proretset as setof,
    rt.typtype as rettyptype, rc.relname as retrel
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
  left join pg_class rc on rc.oid = rt.typrelid and rc.relkind = 'r'
  where n.nspname = 'public' and p.prokind = 'f' and rt.typname <> 'trigger'
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname not in ('set_updated_at','try_uuid','path_segment','request_header')
    and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  order by 1""")

def ts_scalar(name):
    name = name.replace('public.', '')
    if name in enum_names: return f'Database["public"]["Enums"]["{name}"]'
    if name in ('json', 'jsonb'): return 'Json'
    if name in ('boolean', 'bool'): return 'boolean'
    if name.split('(')[0] in ('integer','int4','int2','int8','bigint','smallint','numeric','real','double precision','float4','float8'): return 'number'
    return 'string'

def col_type(c):
    if c["cat"] == "A":
        return ts_scalar(c["elem"]) + "[]" if not c["elem"] in enum_names else f'Database["public"]["Enums"]["{c["elem"]}"][]'
    return ts_scalar(c["typname"])

tables, views = {}, {}
for c in cols:
    (tables if c["kind"] == "r" else views).setdefault(c["tbl"], []).append(c)

def rels(tbl):
    out = []
    for f in fks:
        if f["tbl"] != tbl: continue
        out.append(f"""          {{
            foreignKeyName: "{f['conname']}"
            columns: {json.dumps(f['columns'])}
            isOneToOne: {'true' if f['one'] else 'false'}
            referencedRelation: "{f['ref']}"
            referencedColumns: {json.dumps(f['refcols'])}
          }},""")
    return "[\n" + "\n".join(out) + "\n        ]" if out else "[]"

L = []
L.append("// Generated from the migrated schema (format of `supabase gen types typescript`).")
L.append("// Regenerate against your linked project with: npm run db:types")
L.append("export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]\n")
L.append("export type Database = {\n  public: {\n    Tables: {")
for t, cs in sorted(tables.items()):
    L.append(f"      {t}: {{\n        Row: {{")
    for c in cs: L.append(f"          {c['col']}: {col_type(c)}{' | null' if c['nullable'] else ''}")
    L.append("        }\n        Insert: {")
    for c in cs:
        if c["generated"]: L.append(f"          {c['col']}?: never"); continue
        opt = "?" if (c["nullable"] or c["has_default"]) else ""
        L.append(f"          {c['col']}{opt}: {col_type(c)}{' | null' if c['nullable'] else ''}")
    L.append("        }\n        Update: {")
    for c in cs:
        if c["generated"]: L.append(f"          {c['col']}?: never"); continue
        L.append(f"          {c['col']}?: {col_type(c)}{' | null' if c['nullable'] else ''}")
    L.append(f"        }}\n        Relationships: {rels(t)}\n      }}")
L.append("    }\n    Views: {")
for v, cs in sorted(views.items()):
    L.append(f"      {v}: {{\n        Row: {{")
    for c in cs: L.append(f"          {c['col']}: {col_type(c)} | null")
    L.append("        }\n        Relationships: []\n      }")
L.append("    }\n    Functions: {")
seen = set()
for f in funcs:
    if f["name"] in seen: continue
    seen.add(f["name"])
    names = f["argnames"] or []; modes = f["modes"]; types = f["alltypes"] or f["intypes"] or []
    ins, outs = [], []
    for i, n in enumerate(names):
        m = modes[i] if modes else 'i'
        (ins if m in ('i','b') else outs).append((n, types[i] if i < len(types) else 'text'))
    nopt = f["ndefaults"] or 0
    if ins:
        args = []
        for i, (n, ty) in enumerate(ins):
            opt = "?" if i >= len(ins) - nopt else ""
            base = ty.replace('[]','')
            tsty = ts_scalar(base) + ("[]" if ty.endswith('[]') else "")
            if base.replace('public.','') in ('quiz_questions',): tsty = 'never'
            args.append(f"{n}{opt}: {tsty}")
        argstr = "{ " + "; ".join(args) + " }"
    else:
        argstr = "Record<PropertyKey, never>"
    if outs:
        row = "{ " + "; ".join(f"{n}: {ts_scalar(t)}" for n, t in outs) + " }"
        ret = row + "[]"
    elif f["retrel"]:
        ret = f'Database["public"]["Tables"]["{f["retrel"]}"]["Row"]' + ("[]" if f["setof"] else "")
    else:
        ret = ("undefined" if f["ret"] == "void" else ts_scalar(f["ret"])) + ("[]" if f["setof"] else "")
    L.append(f"      {f['name']}: {{\n        Args: {argstr}\n        Returns: {ret}\n      }}")
L.append("    }\n    Enums: {")
for e in enums: L.append(f"      {e['name']}: " + " | ".join(json.dumps(x) for x in e["labels"]))
L.append("    }\n    CompositeTypes: {\n      [_ in never]: never\n    }\n  }\n}\n")
L.append('''type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
export type Functions<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]
''')
print("\n".join(L))
