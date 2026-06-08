/* Status & confidence semantics (§9). Single source of truth for the four agent
   statuses; colors come from tokens so theming stays consistent. */
import type { Company } from '../types'

export type Status = Company['status']

export const STATUS: Record<Status, { label: string; cls: string; dot: string }> = {
  validated: { label: 'VALIDATED', cls: 'st-ok', dot: 'var(--green)' },
  review: { label: 'NEEDS REVIEW', cls: 'st-review', dot: 'var(--blue)' },
  watching: { label: 'WATCHING', cls: 'st-watch', dot: 'var(--amber)' },
  error: { label: 'ERROR', cls: 'st-err', dot: 'var(--red)' },
}
