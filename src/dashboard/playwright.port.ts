import { createHash } from 'node:crypto'

// Stable per checkout so parallel worktrees get their own preview server; the variable pins it on a collision.
export function localPort(variable: string, base: number, directory: string): number {
  const pinned = Number(process.env[variable])
  if (Number.isInteger(pinned) && pinned > 0) return pinned
  return base + (createHash('sha256').update(directory).digest().readUInt32BE(0) % 1000)
}
