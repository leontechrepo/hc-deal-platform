import { useUser } from '@clerk/react'

export function useCurrentActor(): string | undefined {
  const { user } = useUser()
  return user?.fullName || user?.primaryEmailAddress?.emailAddress || undefined
}
