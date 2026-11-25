import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const RENDER_SESSION_KEY = 'ts_render_session';

type RenderSession = {
  access_token: string;
  refresh_token: string;
  user: { id: string };
};

function decodeJwtSub(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(b64)) as { sub?: string; exp?: number };
    if (!json.sub) return null;
    if (json.exp && json.exp < Math.floor(Date.now() / 1000)) return null;
    return json.sub;
  } catch {
    return null;
  }
}

function createRenderBrowserClient() {
  const listeners = new Set<(event: string, session: RenderSession | null) => void>();

  const readSession = (): RenderSession | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(RENDER_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RenderSession;
      if (!parsed?.access_token || !decodeJwtSub(parsed.access_token)) {
        localStorage.removeItem(RENDER_SESSION_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const emit = (event: string, session: RenderSession | null) => {
    for (const cb of listeners) cb(event, session);
  };

  const callDb = async (body: unknown) => {
    const session = readSession();
    const res = await fetch('/api/public/db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return (await res.json()) as { data: unknown; error: { message: string; code?: string } | null; count?: number | null };
  };

  class BrowserQueryBuilder implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null; count?: number | null }> {
    private payload: {
      table: string;
      op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
      selectCols?: string;
      selectOpts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };
      body?: unknown;
      upsertOpts?: { onConflict?: string } | undefined;
      filters: unknown[];
      orders: unknown[];
      limit?: number;
      range?: [number, number];
      singleMode?: 'single' | 'maybeSingle' | null;
    };

    constructor(table: string) {
      this.payload = { table, op: 'select', filters: [], orders: [] };
    }

    select(cols = '*', opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
      this.payload.selectCols = cols;
      if (opts && this.payload.op === 'select') this.payload.selectOpts = opts;
      return this;
    }
    insert(body: unknown) { this.payload.op = 'insert'; this.payload.body = body; return this; }
    update(body: unknown) { this.payload.op = 'update'; this.payload.body = body; return this; }
    upsert(body: unknown, opts?: { onConflict?: string }) { this.payload.op = 'upsert'; this.payload.body = body; this.payload.upsertOpts = opts; return this; }
    delete() { this.payload.op = 'delete'; return this; }
    eq(col: string, val: unknown) { this.payload.filters.push({ type: 'eq', col, val }); return this; }
    neq(col: string, val: unknown) { this.payload.filters.push({ type: 'neq', col, val }); return this; }
    gt(col: string, val: unknown) { this.payload.filters.push({ type: 'gt', col, val }); return this; }
    gte(col: string, val: unknown) { this.payload.filters.push({ type: 'gte', col, val }); return this; }
    lt(col: string, val: unknown) { this.payload.filters.push({ type: 'lt', col, val }); return this; }
    lte(col: string, val: unknown) { this.payload.filters.push({ type: 'lte', col, val }); return this; }
    ilike(col: string, val: unknown) { this.payload.filters.push({ type: 'ilike', col, val }); return this; }
    is(col: string, val: unknown) { this.payload.filters.push({ type: 'is', col, val }); return this; }
    in(col: string, val: unknown[]) { this.payload.filters.push({ type: 'in', col, val }); return this; }
    not(col: string, op: string, val: unknown) { this.payload.filters.push({ type: 'not', col, op, val }); return this; }
    or(expr: string) { this.payload.filters.push({ type: 'or', expr }); return this; }
    order(col: string, opts?: { ascending?: boolean }) { this.payload.orders.push({ col, ascending: opts?.ascending ?? true }); return this; }
    limit(n: number) { this.payload.limit = n; return this; }
    range(from: number, to: number) { this.payload.range = [from, to]; return this; }
    single() { this.payload.singleMode = 'single'; return this; }
    maybeSingle() { this.payload.singleMode = 'maybeSingle'; return this; }

    then<TResult1 = { data: unknown; error: { message: string; code?: string } | null; count?: number | null }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: { message: string; code?: string } | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return callDb({ kind: 'query', payload: this.payload }).then(onfulfilled, onrejected);
    }
  }

  return {
    from: (table: string) => new BrowserQueryBuilder(table),
    rpc: (fn: string, args?: Record<string, unknown>) => callDb({ kind: 'rpc', fn, args }),
    auth: {
      getSession: async () => ({ data: { session: readSession() }, error: null }),
      getUser: async () => {
        const s = readSession();
        return { data: { user: s?.user ?? null }, error: null };
      },
      setSession: async ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) => {
        const sub = decodeJwtSub(access_token);
        if (!sub) return { data: { session: null }, error: { message: 'Invalid session token' } };
        const session: RenderSession = { access_token, refresh_token, user: { id: sub } };
        if (typeof window !== 'undefined') localStorage.setItem(RENDER_SESSION_KEY, JSON.stringify(session));
        emit('SIGNED_IN', session);
        return { data: { session }, error: null };
      },
      signOut: async () => {
        if (typeof window !== 'undefined') localStorage.removeItem(RENDER_SESSION_KEY);
        emit('SIGNED_OUT', null);
        return { error: null };
      },
      onAuthStateChange: (cb: (event: string, session: RenderSession | null) => void) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => { listeners.delete(cb); } } } };
      },
    },
  } as unknown as ReturnType<typeof createClient<Database>>;
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function serverSupabaseUrl(publicUrl: string, supabaseKey: string): string | undefined {
  if (typeof window !== 'undefined' || typeof process === 'undefined') return undefined;
  const serverUrl = process.env['SUPABASE_URL']?.replace(/\/+$/, '');
  if (!serverUrl || serverUrl === publicUrl || process.env['SUPABASE_PUBLISHABLE_KEY'] !== supabaseKey) return undefined;
  return serverUrl;
}

function createSupabaseFetch(supabaseUrl: string, supabaseKey: string): typeof fetch {
  const publicUrl = supabaseUrl.replace(/\/+$/, '');
  const serverUrl = serverSupabaseUrl(publicUrl, supabaseKey);
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    if (serverUrl) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(`${publicUrl}/`)) {
        const target = serverUrl + url.slice(publicUrl.length);
        const request = typeof input === 'string' || input instanceof URL ? target : new Request(target, input);
        return fetch(request, { ...init, headers });
      }
    }
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient() {
  const useRenderDb =
    import.meta.env['VITE_USE_RENDER_DB'] === 'true' ||
    (typeof process !== 'undefined' && !!process.env['DATABASE_URL']);

  if (useRenderDb) {
    return createRenderBrowserClient();
  }

  const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return createRenderBrowserClient();
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
