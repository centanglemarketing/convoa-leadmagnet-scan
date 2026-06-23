const TEST_APP_URL = process.env.TEST_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export async function apiRequest(path: string, options: RequestInit = {}) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = `${TEST_APP_URL.replace(/\/$/, '')}${cleanPath}`
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  return response
}

export async function apiPost(path: string, body: any, options: RequestInit = {}) {
  return apiRequest(path, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  })
}

export async function apiGet(path: string, options: RequestInit = {}) {
  return apiRequest(path, {
    method: 'GET',
    ...options,
  })
}
