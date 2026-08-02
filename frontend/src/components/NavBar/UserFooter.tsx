import { useClerk } from '@clerk/react'
import { useCurrentActor } from '../../hooks/useCurrentActor'
import styles from './NavBar.module.css'

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function UserFooter() {
  const actor = useCurrentActor() ?? 'Signed in'
  const { signOut } = useClerk()

  return (
    <button
      type="button"
      className={styles.userFooter}
      onClick={() => signOut({ redirectUrl: '/' })}
      title={`Sign out — ${actor}`}
    >
      <span className={styles.userAvatar}>{initialsFor(actor)}</span>
      <span className={styles.userName}>{actor}</span>
    </button>
  )
}
