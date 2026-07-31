type TokenGetter = () => Promise<string | null>

let _getToken: TokenGetter | null = null

export function registerTokenGetter(fn: TokenGetter | null): void {
  _getToken = fn
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders: Record<string, string> = {}
  if (_getToken) {
    const token = await _getToken()
    if (token) authHeaders['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(init?.headers as Record<string, string> | undefined),
    },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const authHeaders: Record<string, string> = {}
  if (_getToken) {
    const token = await _getToken()
    if (token) authHeaders['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(path, { headers: authHeaders })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API GET ${path} → ${res.status}: ${text}`)
  }
  return res.blob()
}
