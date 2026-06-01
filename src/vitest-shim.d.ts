declare module 'vitest' {
  export function describe(name: string, fn: () => void): void
  export function it(name: string, fn: () => void): void
  export function expect<T = unknown>(value: T): {
    toBe(expected: unknown): void
    toBeNull(): void
    toHaveLength(expected: number): void
    toMatchObject(expected: Record<string, unknown>): void
  }
}
