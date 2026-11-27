import { createHash, randomBytes } from 'crypto'
import { describe, expect, it } from 'vitest'
import { sha1Hex } from '@shared/gsync/sha1'
import { googleIdFor } from '@shared/gsync/write'

const node = (s: string): string => createHash('sha1').update(s).digest('hex')

describe('sha1Hex', () => {
  it('matches Node for the ids the app makes and for edge lengths', () => {
    const samples = ['', 'a', 'abc', 'ä€😀', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'y'.repeat(1000)]
    for (let i = 0; i < 50; i++) samples.push(randomBytes(i * 3).toString('base64'), crypto.randomUUID())
    for (const s of samples) expect(sha1Hex(s)).toBe(node(s))
  })

  it('keeps Google ids of events created before the move', () => {
    expect(googleIdFor('ev-123')).toBe(node('ev-123'))
  })
})
