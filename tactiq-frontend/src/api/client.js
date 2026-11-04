// All requests go to /api, which Vite proxies to the FastAPI server (see vite.config.js).
const BASE = '/api'
const TOKEN_KEY = 'tactiq_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

function errorMessage(body, status) {
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    // FastAPI validation errors: show the first one in plain words.
    const d = detail[0]
    const field = d.loc?.[d.loc.length - 1]
    const msg = (d.msg || '').replace(/^Value error, /, '')
    return field && field !== 'body' ? `${String(field).replaceAll('_', ' ')}: ${msg}` : msg
  }
  if (status === 0) return 'Cannot reach the TactiQ server. Is the API running?'
  return `Request failed (${status}).`
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(errorMessage(null, 0), 0)
  }

  if (res.status === 401 && token) {
    clearToken()
    window.dispatchEvent(new Event('tactiq:logout'))
  }
  if (res.status === 204) return null

  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status)
  return data
}
