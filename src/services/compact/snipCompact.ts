/**
 * History snipping/compaction for long conversations.
 * Stub implementation - HISTORY_SNIP feature gate.
 */

import type { Message } from '../../types/message.js'

export interface SnipResult {
  messages: Message[]
  tokensFreed: number
}

export function isSnipBoundaryMessage(_message: unknown): boolean {
  return false
}

export function isSnipMarkerMessage(_message: unknown): boolean {
  return false
}

export function snipCompactIfNeeded(
  messages: Message[],
  _options?: { force?: boolean },
): SnipResult {
  return { messages, tokensFreed: 0 }
}
