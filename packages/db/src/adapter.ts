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

export interface DatabaseAdapter {
  db: QueryBuilder
  init(): Promise<void>
  close?(): Promise<void>
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
