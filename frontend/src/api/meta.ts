import type { Features } from '../types'
import { apiFetch } from './client'

/** Effective capability state reported by the backend; the UI must trust only this. */
export type FeaturesInfo = Features

export function fetchFeatures(): Promise<FeaturesInfo> {
  return apiFetch('/api/meta/features')
}
