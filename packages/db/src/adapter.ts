export interface Condition {
  column: string
  op: string
  value: any
}

export interface OrderBy {
  column: string
  direction: 'ASC' | 'DESC'
}

export interface QueryBuilder {
  select(...columns: string[]): {
    from(table: string): {
      where(condition: Condition): {
        orderBy(...orders: OrderBy[]): {
          all(): Promise<any[]>
          limit(n: number): Promise<any[]>
        }
        all(): Promise<any[]>
        limit(n: number): Promise<any[]>
      }
      orderBy(...orders: OrderBy[]): {
        all(): Promise<any[]>
        limit(n: number): Promise<any[]>
      }
      all(): Promise<any[]>
      limit(n: number): Promise<any[]>
    }
  }
  insert(table: string): {
    values(data: Record<string, any>): Promise<void>
  }
  update(table: string): {
    set(data: Record<string, any>): {
      where(condition: Condition): Promise<void>
    }
  }
  delete(table: string): {
    where(condition: Condition): Promise<void>
  }
}

export interface AuthResult {
  ok: boolean
  userId?: string
  username?: string
  sessionToken?: string
  error?: string
}

export interface DatabaseAdapter {
  db: QueryBuilder
  init(): Promise<void>
  close?(): Promise<void>
  /**
   * Verifies credentials and issues a session token in one atomic,
   * server-side step. Only implemented by adapters that talk to a shared
   * backend over the network (http.ts) — password verification and token
   * issuance must never be split into separate client-orchestrated calls,
   * or the token-issuing step ends up trusting an unauthenticated `id`.
   * Adapters without a network boundary to protect (desktop's local
   * single-file SQLite) can leave this undefined; authStore falls back to
   * verifying client-side against the local DB directly.
   */
  login?(username: string, password: string): Promise<AuthResult>
  register?(username: string, password: string): Promise<AuthResult>
}

export function eq(column: string, value: any): Condition {
  return { column, op: '=', value }
}

export function desc(column: string): OrderBy {
  return { column, direction: 'DESC' }
}

export function asc(column: string): OrderBy {
  return { column, direction: 'ASC' }
}
