import crypto from "node:crypto";
import postgres from "postgres";

export type PgRole = "service_role" | "authenticated" | "anon";

export type QueryFilter =
  | { type: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "ilike" | "is"; col: string; val: unknown }
  | { type: "in"; col: string; val: unknown[] }
  | { type: "not"; col: string; op: string; val: unknown }
  | { type: "or"; expr: string };

export type QueryOrder = { col: string; ascending: boolean };

export type QueryPayload = {
  table: string;
  op: "select" | "insert" | "update" | "upsert" | "delete";
  selectCols?: string | undefined;
  selectOpts?: { count?: "exact" | "planned" | "estimated"; head?: boolean } | undefined;
  body?: unknown;
  upsertOpts?: { onConflict?: string } | undefined;
  filters: QueryFilter[];
  orders: QueryOrder[];
  limit?: number | undefined;
  range?: [number, number] | undefined;
  singleMode?: "single" | "maybeSingle" | null | undefined;
};

const ident = (name: string) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return `"${name}"`;
};

const getSecret = () => process.env["SESSION_SECRET"] || "teleshop-render-fallback-secret-change-me";

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export function signJwt(userId: string, ttlSeconds = 60 * 60 * 24 * 30): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub: userId, role: "authenticated", iat: now, exp: now + ttlSeconds }));
  const sig = crypto.createHmac("sha256", getSecret()).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyJwt(token: string): { sub: string; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = crypto.createHmac("sha256", getSecret()).update(`${h}.${p}`).digest();
    const actual = Buffer.from(s!, "base64url");
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    const claims = JSON.parse(Buffer.from(p!, "base64url").toString("utf8")) as { sub?: string; role?: string; exp?: number };
    if (!claims.sub || (claims.exp && claims.exp < Math.floor(Date.now() / 1000))) return null;
    return { sub: claims.sub, role: claims.role ?? "authenticated" };
  } catch {
    return null;
  }
}

let _sql: postgres.Sql | undefined;
export function getPg(): postgres.Sql {
  if (!_sql) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("Missing DATABASE_URL");
    const useSsl = url.includes("render.com") || process.env["NODE_ENV"] === "production";
    _sql = postgres(url, { ssl: useSsl ? "require" : undefined, max: 10 });
  }
  return _sql;
}

type RelationSpec = {
  alias: string;
  table: string;
  inner: boolean;
  cols: string;
  nested: RelationSpec[];
};

function splitTopLevel(str: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseSelect(spec: string | undefined): { baseCols: string[]; relations: RelationSpec[] } {
  if (!spec || spec.trim() === "*") return { baseCols: ["*"], relations: [] };
  const parts = splitTopLevel(spec);
  const baseCols: string[] = [];
  const relations: RelationSpec[] = [];
  for (const p of parts) {
    const m = p.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:!([a-zA-Z_]+))?\(([\s\S]*)\)$/);
    if (m) {
      const table = m[1]!;
      const inner = m[2] === "inner";
      const innerParsed = parseSelect(m[3]!);
      relations.push({
        alias: table,
        table,
        inner,
        cols: innerParsed.baseCols.join(","),
        nested: innerParsed.relations,
      });
    } else {
      baseCols.push(p);
    }
  }
  return { baseCols: baseCols.length ? baseCols : ["*"], relations };
}

// Known FK hints when table name != singular_id (or one-to-many children)
const MANY_TO_ONE_FK: Record<string, Record<string, string>> = {
  orders: { shops: "shop_id", products: "product_id" },
  products: { shops: "shop_id" },
  product_codes: { products: "product_id", orders: "order_id" },
  disputes: { orders: "order_id" },
  code_issues: { orders: "order_id" },
  vouchers: { shops: "shop_id" },
  reward_tasks: { shops: "shop_id" },
  lucky_draws: { shops: "shop_id" },
  buyer_product_referrals: { product_referrals: "referral_id" },
};

const ONE_TO_MANY_FK: Record<string, Record<string, string>> = {
  lucky_draws: { draw_winners: "draw_id" },
};

function parseOrExpr(expr: string, params: unknown[]): string {
  const parts = expr.split(",").map((s) => s.trim()).filter(Boolean);
  const clauses: string[] = [];
  for (const part of parts) {
    const m = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.(eq|neq|ilike|gt|gte|lt|lte|is)\.([\s\S]*)$/);
    if (!m) continue;
    const [, col, op, rawVal] = m;
    const c = `t.${ident(col!)}`;
    if (op === "is") {
      clauses.push(rawVal === "null" ? `${c} IS NULL` : `${c} IS NOT NULL`);
    } else {
      params.push(rawVal);
      const p = `$${params.length}`;
      const sqlOp = op === "eq" ? "=" : op === "neq" ? "!=" : op === "ilike" ? "ILIKE" : op === "gt" ? ">" : op === "gte" ? ">=" : op === "lt" ? "<" : "<=";
      clauses.push(`${c} ${sqlOp} ${p}`);
    }
  }
  return clauses.length ? `(${clauses.join(" OR ")})` : "TRUE";
}

function buildWhere(
  table: string,
  filters: QueryFilter[],
  params: unknown[],
  relJoins: Map<string, { alias: string; sql: string; inner: boolean }>,
): string {
  const clauses: string[] = [];
  for (const f of filters) {
    if (f.type === "or") {
      clauses.push(parseOrExpr(f.expr, params));
      continue;
    }
    let colSql: string;
    if (f.col.includes(".")) {
      const [rel, col] = f.col.split(".");
      const fk = MANY_TO_ONE_FK[table]?.[rel!] ?? `${rel!.replace(/s$/, "")}_id`;
      if (!relJoins.has(rel!)) {
        relJoins.set(rel!, {
          alias: `_rel_${rel}`,
          sql: `JOIN public.${ident(rel!)} _rel_${rel} ON _rel_${rel}.id = t.${ident(fk)}`,
          inner: true,
        });
      }
      colSql = `_rel_${rel}.${ident(col!)}`;
    } else {
      colSql = `t.${ident(f.col)}`;
    }

    if (f.type === "in") {
      if (!f.val.length) {
        clauses.push("FALSE");
      } else {
        const placeholders = f.val.map((v) => {
          params.push(v);
          return `$${params.length}`;
        });
        clauses.push(`${colSql} IN (${placeholders.join(",")})`);
      }
    } else if (f.type === "is") {
      clauses.push(f.val === null ? `${colSql} IS NULL` : `${colSql} IS NOT DISTINCT FROM ${(() => { params.push(f.val); return `$${params.length}`; })()}`);
    } else if (f.type === "not") {
      if (f.op === "is" && f.val === null) clauses.push(`${colSql} IS NOT NULL`);
      else if (f.op === "in" && Array.isArray(f.val)) {
        if (!f.val.length) clauses.push("TRUE");
        else {
          const ph = f.val.map((v) => { params.push(v); return `$${params.length}`; });
          clauses.push(`${colSql} NOT IN (${ph.join(",")})`);
        }
      } else {
        params.push(f.val);
        clauses.push(`NOT (${colSql} = $${params.length})`);
      }
    } else {
      params.push(f.val);
      const p = `$${params.length}`;
      const op =
        f.type === "eq" ? "=" :
        f.type === "neq" ? "!=" :
        f.type === "gt" ? ">" :
        f.type === "gte" ? ">=" :
        f.type === "lt" ? "<" :
        f.type === "lte" ? "<=" :
        "ILIKE";
      clauses.push(`${colSql} ${op} ${p}`);
    }
  }
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

async function hydrateRelations(
  tx: { unsafe: postgres.Sql["unsafe"] },
  parentTable: string,
  rows: Record<string, unknown>[],
  relations: RelationSpec[],
): Promise<Record<string, unknown>[]> {
  if (!rows.length || !relations.length) return rows;
  let result = rows;
  for (const rel of relations) {
    const childFk = ONE_TO_MANY_FK[parentTable]?.[rel.table];
    if (childFk) {
      const ids = [...new Set(result.map((r) => r["id"]).filter((x) => x != null))];
      const children = ids.length
        ? await tx.unsafe<Record<string, unknown>[]>(
            `SELECT ${rel.cols === "*" ? "*" : rel.cols.split(",").map((c) => ident(c.trim())).join(",")} , ${ident(childFk)} AS _fk FROM public.${ident(rel.table)} WHERE ${ident(childFk)} = ANY($1::uuid[])`,
            [ids],
          )
        : [];
      const map = new Map<unknown, Record<string, unknown>[]>();
      for (const c of children) {
        const k = c["_fk"];
        const copy = { ...c };
        if (!rel.cols.split(",").map((x) => x.trim()).includes(childFk) && rel.cols !== "*") delete copy["_fk"];
        else copy["_fk"] = undefined;
        const arr = map.get(k) ?? [];
        arr.push(copy);
        map.set(k, arr);
      }
      result = result.map((r) => ({ ...r, [rel.alias]: map.get(r["id"]) ?? [] }));
    } else {
      const fk = MANY_TO_ONE_FK[parentTable]?.[rel.table] ?? `${rel.table.replace(/s$/, "")}_id`;
      const fkIds = [...new Set(result.map((r) => r[fk]).filter((x) => x != null))];
      const colsList = rel.cols === "*" ? "*" : [...new Set(["id", ...rel.cols.split(",").map((c) => c.trim())])].map(ident).join(",");
      let relRows: Record<string, unknown>[] = fkIds.length
        ? await tx.unsafe<Record<string, unknown>[]>(
            `SELECT ${colsList} FROM public.${ident(rel.table)} WHERE id = ANY($1::uuid[])`,
            [fkIds],
          )
        : [];
      if (rel.nested.length) {
        relRows = await hydrateRelations(tx, rel.table, relRows, rel.nested);
      }
      const map = new Map(relRows.map((rr) => [rr["id"], rr]));
      result = result
        .map((r) => ({ ...r, [rel.alias]: r[fk] ? (map.get(r[fk]) ?? null) : null }))
        .filter((r) => !rel.inner || r[rel.alias] !== null);
    }
  }
  return result;
}

type PgParam = postgres.ParameterOrJSON<never>;
const asParams = (p: unknown[]) => p as PgParam[];

export async function executePgQuery(
  payload: QueryPayload,
  role: PgRole,
  userId?: string | null,
): Promise<{ data: unknown; error: { message: string; code?: string | undefined } | null; count?: number | null }> {
  const sql = getPg();
  try {
    return await sql.begin(async (tx) => {
      if (role !== "service_role") {
        await tx.unsafe(`SET LOCAL ROLE ${role}`);
        await tx.unsafe(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
      }

      const tbl = `public.${ident(payload.table)}`;

      if (payload.op === "select") {
        const { baseCols, relations } = parseSelect(payload.selectCols);
        const relJoins = new Map<string, { alias: string; sql: string; inner: boolean }>();
        for (const r of relations) {
          if (r.inner && !ONE_TO_MANY_FK[payload.table]?.[r.table]) {
            const fk = MANY_TO_ONE_FK[payload.table]?.[r.table] ?? `${r.table.replace(/s$/, "")}_id`;
            relJoins.set(r.table, {
              alias: `_rel_${r.table}`,
              sql: `JOIN public.${ident(r.table)} _rel_${r.table} ON _rel_${r.table}.id = t.${ident(fk)}`,
              inner: true,
            });
          }
        }
        const params: unknown[] = [];
        const whereSql = buildWhere(payload.table, payload.filters, params, relJoins);
        const joinSql = [...relJoins.values()].map((j) => j.sql).join(" ");

        let count: number | null = null;
        if (payload.selectOpts?.count === "exact") {
          const cr = await tx.unsafe<{ c: number }[]>(`SELECT count(*)::int AS c FROM ${tbl} t ${joinSql} ${whereSql}`, asParams(params));
          count = cr[0]?.c ?? 0;
          if (payload.selectOpts.head) return { data: null, error: null, count };
        }

        const selectNeeded = new Set<string>(baseCols);
        if (!selectNeeded.has("*")) {
          for (const r of relations) {
            if (!ONE_TO_MANY_FK[payload.table]?.[r.table]) {
              const fk = MANY_TO_ONE_FK[payload.table]?.[r.table] ?? `${r.table.replace(/s$/, "")}_id`;
              selectNeeded.add(fk);
            } else {
              selectNeeded.add("id");
            }
          }
        }
        const colsSql = selectNeeded.has("*") ? "t.*" : [...selectNeeded].map((c) => `t.${ident(c)}`).join(", ");
        const orderSql = payload.orders.length
          ? `ORDER BY ${payload.orders.map((o) => `t.${ident(o.col)} ${o.ascending ? "ASC" : "DESC"}`).join(", ")}`
          : "";
        let limitSql = "";
        if (payload.range) {
          const [from, to] = payload.range;
          limitSql = `LIMIT ${Math.max(0, to - from + 1)} OFFSET ${Math.max(0, from)}`;
        } else if (payload.limit != null) {
          limitSql = `LIMIT ${Math.max(0, payload.limit)}`;
        }

        let rows: Record<string, unknown>[] = await tx.unsafe<Record<string, unknown>[]>(
          `SELECT ${colsSql} FROM ${tbl} t ${joinSql} ${whereSql} ${orderSql} ${limitSql}`,
          asParams(params),
        );
        rows = await hydrateRelations(tx, payload.table, rows, relations);

        if (payload.singleMode === "single") {
          if (rows.length === 0) return { data: null, error: { message: "Row not found", code: "PGRST116" }, count };
          return { data: rows[0], error: null, count };
        }
        if (payload.singleMode === "maybeSingle") {
          return { data: rows[0] ?? null, error: null, count };
        }
        return { data: rows, error: null, count };
      }

      if (payload.op === "insert" || payload.op === "upsert") {
        const arr = (Array.isArray(payload.body) ? payload.body : [payload.body]) as Record<string, unknown>[];
        if (!arr.length) return { data: [], error: null, count: null };
        const keys = [...new Set(arr.flatMap((r) => Object.keys(r)))];
        const params: unknown[] = [];
        const valuesSql = arr
          .map((row) => {
            const ph = keys.map((k) => {
              params.push(row[k] === undefined ? null : row[k]);
              return `$${params.length}`;
            });
            return `(${ph.join(",")})`;
          })
          .join(",");
        let conflictSql = "";
        if (payload.op === "upsert") {
          const conflictCols = (payload.upsertOpts?.onConflict ?? "id").split(",").map((c) => ident(c.trim())).join(",");
          const updateCols = keys.filter((k) => k !== "id");
          conflictSql = updateCols.length
            ? `ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateCols.map((k) => `${ident(k)} = EXCLUDED.${ident(k)}`).join(", ")}`
            : `ON CONFLICT (${conflictCols}) DO NOTHING`;
        }
        const retSql = payload.selectCols ? `RETURNING ${payload.selectCols === "*" ? "*" : payload.selectCols.split(",").map((c) => ident(c.trim())).join(",")}` : "RETURNING *";
        const rows = await tx.unsafe<Record<string, unknown>[]>(
          `INSERT INTO ${tbl} (${keys.map(ident).join(",")}) VALUES ${valuesSql} ${conflictSql} ${retSql}`,
          asParams(params),
        );
        if (payload.singleMode === "single") return { data: rows[0] ?? null, error: rows[0] ? null : { message: "Insert failed" }, count: null };
        if (payload.singleMode === "maybeSingle") return { data: rows[0] ?? null, error: null, count: null };
        return { data: rows, error: null, count: null };
      }

      if (payload.op === "update") {
        const patch = payload.body as Record<string, unknown>;
        const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
        const params: unknown[] = [];
        const setSql = keys.map((k) => {
          params.push(patch[k]);
          return `${ident(k)} = $${params.length}`;
        }).join(", ");
        const relJoins = new Map<string, { alias: string; sql: string; inner: boolean }>();
        const whereSql = buildWhere(payload.table, payload.filters, params, relJoins);
        const rows = await tx.unsafe<Record<string, unknown>[]>(
          `UPDATE ${tbl} t SET ${setSql} ${whereSql} RETURNING *`,
          asParams(params),
        );
        if (payload.singleMode === "single") {
          if (!rows.length) return { data: null, error: { message: "Row not found", code: "PGRST116" }, count: null };
          return { data: rows[0], error: null, count: null };
        }
        if (payload.singleMode === "maybeSingle") return { data: rows[0] ?? null, error: null, count: null };
        return { data: rows, error: null, count: null };
      }

      if (payload.op === "delete") {
        const params: unknown[] = [];
        const relJoins = new Map<string, { alias: string; sql: string; inner: boolean }>();
        const whereSql = buildWhere(payload.table, payload.filters, params, relJoins);
        const rows = await tx.unsafe<Record<string, unknown>[]>(`DELETE FROM ${tbl} t ${whereSql} RETURNING *`, asParams(params));
        return { data: rows, error: null, count: null };
      }

      return { data: null, error: { message: "Unsupported operation" }, count: null };
    });
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    return { data: null, error: { message: err.message ?? String(e), code: err.code }, count: null };
  }
}

export async function executePgRpc(fnName: string, args: Record<string, unknown> | undefined, role: PgRole, userId?: string | null) {
  const sql = getPg();
  try {
    return await sql.begin(async (tx) => {
      if (role !== "service_role") {
        await tx.unsafe(`SET LOCAL ROLE ${role}`);
        await tx.unsafe(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
      }
      const entries = Object.entries(args ?? {}).filter(([, v]) => v !== undefined);
      const params = entries.map(([, v]) => v);
      const argsSql = entries.map(([k], i) => `${ident(k)} => $${i + 1}`).join(", ");
      const rows = await tx.unsafe<Record<string, unknown>[]>(`SELECT public.${ident(fnName)}(${argsSql}) AS res`, asParams(params));
      return { data: rows[0]?.["res"] ?? null, error: null };
    });
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    return { data: null, error: { message: err.message ?? String(e), code: err.code } };
  }
}

class PgQueryBuilder implements PromiseLike<{ data: unknown; error: { message: string; code?: string | undefined } | null; count?: number | null }> {
  private payload: QueryPayload;
  private role: PgRole;
  private userId?: string | null | undefined;

  constructor(table: string, role: PgRole, userId?: string | null) {
    this.role = role;
    this.userId = userId;
    this.payload = { table, op: "select", filters: [], orders: [] };
  }

  select(cols = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    if (this.payload.op === "select") {
      this.payload.selectCols = cols;
      if (opts) this.payload.selectOpts = opts;
    } else {
      this.payload.selectCols = cols;
    }
    return this;
  }
  insert(body: unknown) { this.payload.op = "insert"; this.payload.body = body; return this; }
  update(body: unknown) { this.payload.op = "update"; this.payload.body = body; return this; }
  upsert(body: unknown, opts?: { onConflict?: string }) { this.payload.op = "upsert"; this.payload.body = body; this.payload.upsertOpts = opts; return this; }
  delete() { this.payload.op = "delete"; return this; }
  eq(col: string, val: unknown) { this.payload.filters.push({ type: "eq", col, val }); return this; }
  neq(col: string, val: unknown) { this.payload.filters.push({ type: "neq", col, val }); return this; }
  gt(col: string, val: unknown) { this.payload.filters.push({ type: "gt", col, val }); return this; }
  gte(col: string, val: unknown) { this.payload.filters.push({ type: "gte", col, val }); return this; }
  lt(col: string, val: unknown) { this.payload.filters.push({ type: "lt", col, val }); return this; }
  lte(col: string, val: unknown) { this.payload.filters.push({ type: "lte", col, val }); return this; }
  ilike(col: string, val: unknown) { this.payload.filters.push({ type: "ilike", col, val }); return this; }
  is(col: string, val: unknown) { this.payload.filters.push({ type: "is", col, val }); return this; }
  in(col: string, val: unknown[]) { this.payload.filters.push({ type: "in", col, val }); return this; }
  not(col: string, op: string, val: unknown) { this.payload.filters.push({ type: "not", col, op, val }); return this; }
  or(expr: string) { this.payload.filters.push({ type: "or", expr }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.payload.orders.push({ col, ascending: opts?.ascending ?? true }); return this; }
  limit(n: number) { this.payload.limit = n; return this; }
  range(from: number, to: number) { this.payload.range = [from, to]; return this; }
  single() { this.payload.singleMode = "single"; return this; }
  maybeSingle() { this.payload.singleMode = "maybeSingle"; return this; }

  then<TResult1 = { data: unknown; error: { message: string; code?: string | undefined } | null; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string; code?: string | undefined } | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return executePgQuery(this.payload, this.role, this.userId).then(onfulfilled, onrejected);
  }
}

export function createPgClient(role: PgRole, userId?: string | null) {
  return {
    from: (table: string) => new PgQueryBuilder(table, role, userId),
    rpc: (fnName: string, args?: Record<string, unknown>) => executePgRpc(fnName, args, role, userId),
    auth: {
      admin: {
        createUser: async ({ id }: { email?: string; password?: string; email_confirm?: boolean; user_metadata?: unknown; id?: string }) => {
          const sql = getPg();
          const uid = id ?? crypto.randomUUID();
          await sql`INSERT INTO auth.users (id) VALUES (${uid}::uuid) ON CONFLICT (id) DO NOTHING`;
          return { data: { user: { id: uid } }, error: null };
        },
      },
    },
  };
}
