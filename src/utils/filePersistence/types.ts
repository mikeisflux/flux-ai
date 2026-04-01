export const DEFAULT_UPLOAD_CONCURRENCY = 5
export const FILE_COUNT_LIMIT = 100
export const OUTPUTS_SUBDIR = '.outputs'

export interface FailedPersistence {
  path: string
  error: string
}

export interface PersistedFile {
  path: string
  fileId: string
}

export interface FilesPersistedEventData {
  files_persisted: number
  files_failed: number
  tokens_freed?: number
}

export type TurnStartTime = number
