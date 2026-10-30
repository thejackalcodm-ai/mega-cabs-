import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import pg from 'pg'

export type Row = Record<string, unknown>
export interface Filters {
  eq?: Row
  in?: Record<string, unknown[]>
  notIn?: Record<string, unknown[]>
}
export interface DemoUser {
  id: string
  email: string
  password: string
  role: 'student' | 'counselor' | 'instructor' | 'admin' | 'super_admin'
  firstName: string
  lastName: string
  phone: string
  country: string
}

/** Everything the seed needs from a backend. Both implementations run as a trusted service. */
export interface SeedTarget {
  name: string
  ensureUser(user: DemoUser): Promise<string>
  /** ignoreDuplicates: insert missing rows only, never touch existing ones. */
  upsert(
    table: string,
    rows: Row[],
    onConflict?: string,
    opts?: { ignoreDuplicates?: boolean },
  ): Promise<void>
  select<T = Row>(table: string, columns: string, filters?: Filters): Promise<T[]>
  update(table: string, values: Row, filters: Filters): Promise<void>
  delete(table: string, filters: Filters): Promise<void>
  rpc(fn: string, args: Row): Promise<unknown>
  upload(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void>
  close(): Promise<void>
}

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))

// ---------------------------------------------------------------------------------------------
// Supabase (the real target): service-role client, Auth admin API, Storage API.
// ---------------------------------------------------------------------------------------------
export class SupabaseTarget implements SeedTarget {
  name = 'supabase'
  private client: SupabaseClient
  private usersByEmail?: Map<string, string>

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  private fail(context: string, error: { message: string } | null): void {
    if (error) throw new Error(`${context}: ${error.message}`)
  }

  private async loadUsers() {
    if (this.usersByEmail) return this.usersByEmail
    const map = new Map<string, string>()
    for (let page = 1; ; page++) {
      const { data, error } = await this.client.auth.admin.listUsers({ page, perPage: 1000 })
      this.fail('listUsers', error)
      data.users.forEach((u) => u.email && map.set(u.email.toLowerCase(), u.id))
      if (data.users.length < 1000) break
    }
    this.usersByEmail = map
    return map
  }

  async ensureUser(u: DemoUser): Promise<string> {
    const users = await this.loadUsers()
    const attrs = {
      password: u.password,
      email_confirm: true,
      app_metadata: { role: u.role },
      user_metadata: { first_name: u.firstName, last_name: u.lastName, phone: u.phone, country: u.country },
    }
    const existing = users.get(u.email)
    if (existing) {
      const { error } = await this.client.auth.admin.updateUserById(existing, attrs)
      this.fail(`updateUser ${u.email}`, error)
      return existing
    }
    const { data, error } = await this.client.auth.admin.createUser({ email: u.email, ...attrs })
    this.fail(`createUser ${u.email}`, error)
    users.set(u.email, data.user!.id)
    return data.user!.id
  }

  async upsert(table: string, rows: Row[], onConflict = 'id', opts: { ignoreDuplicates?: boolean } = {}) {
    for (const part of chunk(rows, 500)) {
      const { error } = await this.client
        .from(table)
        .upsert(part, { onConflict, defaultToNull: false, ignoreDuplicates: opts.ignoreDuplicates ?? false })
      this.fail(`upsert ${table}`, error)
    }
  }

  private apply<
    Q extends {
      eq: (c: string, v: unknown) => Q
      in: (c: string, v: unknown[]) => Q
      not: (c: string, op: string, v: string) => Q
    },
  >(q: Q, f: Filters = {}): Q {
    for (const [c, v] of Object.entries(f.eq ?? {})) q = q.eq(c, v)
    for (const [c, v] of Object.entries(f.in ?? {})) q = q.in(c, v)
    for (const [c, v] of Object.entries(f.notIn ?? {})) if (v.length) q = q.not(c, 'in', `(${v.join(',')})`)
    return q
  }

  async select<T = Row>(table: string, columns: string, filters?: Filters): Promise<T[]> {
    const { data, error } = await this.apply(this.client.from(table).select(columns), filters)
    this.fail(`select ${table}`, error)
    return (data ?? []) as T[]
  }

  async update(table: string, values: Row, filters: Filters) {
    const { error } = await this.apply(this.client.from(table).update(values), filters)
    this.fail(`update ${table}`, error)
  }

  async delete(table: string, filters: Filters) {
    const { error } = await this.apply(this.client.from(table).delete(), filters)
    this.fail(`delete ${table}`, error)
  }

  async rpc(fn: string, args: Row) {
    const { data, error } = await this.client.rpc(fn, args)
    this.fail(`rpc ${fn}`, error)
    return data
  }

  async upload(bucket: string, path: string, bytes: Uint8Array, contentType: string) {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true })
    this.fail(`upload ${bucket}/${path}`, error)
  }

  async close() {}
}

// ---------------------------------------------------------------------------------------------
// Local PostgreSQL (development verification only): same operations as plain SQL against a
// database migrated with supabase/tests/local/supabase-stub.sql. Runs as the table owner,
// i.e. with the same trust as the service role.
// ---------------------------------------------------------------------------------------------
const ident = (s: string) => `"${s.replace(/"/g, '""')}"`

export class PgTarget implements SeedTarget {
  name = 'local-postgres'
  private pool: pg.Pool
  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString })
  }

  private where(f: Filters = {}, params: unknown[]): string {
    const parts: string[] = []
    for (const [c, v] of Object.entries(f.eq ?? {})) parts.push(`${ident(c)} = $${params.push(v)}`)
    for (const [c, v] of Object.entries(f.in ?? {}))
      parts.push(`${ident(c)}::text = any($${params.push(v.map(String))}::text[])`)
    for (const [c, v] of Object.entries(f.notIn ?? {}))
      if (v.length) parts.push(`not (${ident(c)}::text = any($${params.push(v.map(String))}::text[]))`)
    return parts.length ? ` where ${parts.join(' and ')}` : ''
  }

  async ensureUser(u: DemoUser): Promise<string> {
    const meta = { first_name: u.firstName, last_name: u.lastName, phone: u.phone, country: u.country }
    const found = await this.pool.query('select id from auth.users where email = $1', [u.email])
    if (found.rows[0]) {
      await this.pool.query(
        'update auth.users set raw_app_meta_data = $2, raw_user_meta_data = $3 where id = $1',
        [found.rows[0].id, { role: u.role }, meta],
      )
      return found.rows[0].id
    }
    await this.pool.query(
      `insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
       values ($1, $2, crypt($3, gen_salt('bf')), now(), $4, $5)`,
      [u.id, u.email, u.password, { role: u.role }, meta],
    )
    return u.id
  }

  async upsert(table: string, rows: Row[], onConflict = 'id', opts: { ignoreDuplicates?: boolean } = {}) {
    // group rows by key set so missing keys keep column defaults (like PostgREST missing=default)
    const groups = new Map<string, Row[]>()
    for (const r of rows) {
      const key = Object.keys(r).sort().join(',')
      groups.set(key, [...(groups.get(key) ?? []), r])
    }
    for (const [key, group] of groups) {
      const cols = key.split(',')
      const conflict = onConflict.split(',').map((c) => c.trim())
      const updates = cols.filter((c) => !conflict.includes(c))
      const list = cols.map(ident).join(', ')
      const sql =
        `insert into public.${ident(table)} (${list}) select ${list} from jsonb_populate_recordset(null::public.${ident(table)}, $1) ` +
        `on conflict (${conflict.map(ident).join(', ')}) do ` +
        (updates.length && !opts.ignoreDuplicates
          ? `update set ${updates.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}`
          : 'nothing')
      for (const part of chunk(group, 500)) await this.pool.query(sql, [JSON.stringify(part)])
    }
  }

  async select<T = Row>(table: string, columns: string, filters?: Filters): Promise<T[]> {
    const params: unknown[] = []
    const cols =
      columns === '*'
        ? '*'
        : columns
            .split(',')
            .map((c) => ident(c.trim()))
            .join(', ')
    const res = await this.pool.query(
      `select ${cols} from public.${ident(table)}${this.where(filters, params)}`,
      params,
    )
    return res.rows as T[]
  }

  async update(table: string, values: Row, filters: Filters) {
    const params: unknown[] = []
    const sets = Object.entries(values).map(([c, v]) => `${ident(c)} = $${params.push(v)}`)
    await this.pool.query(
      `update public.${ident(table)} set ${sets.join(', ')}${this.where(filters, params)}`,
      params,
    )
  }

  async delete(table: string, filters: Filters) {
    const params: unknown[] = []
    await this.pool.query(`delete from public.${ident(table)}${this.where(filters, params)}`, params)
  }

  async rpc(fn: string, args: Row) {
    const params: unknown[] = []
    const named = Object.entries(args).map(([k, v]) => `${ident(k)} => $${params.push(v)}`)
    const res = await this.pool.query(`select public.${ident(fn)}(${named.join(', ')}) as result`, params)
    return res.rows[0]?.result
  }

  async upload(bucket: string, path: string) {
    await this.pool.query(
      `insert into storage.objects (bucket_id, name, owner) values ($1, $2, null) on conflict (bucket_id, name) do nothing`,
      [bucket, path],
    )
  }

  async close() {
    await this.pool.end()
  }
}
