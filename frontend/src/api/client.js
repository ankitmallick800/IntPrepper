export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export async function apiRequest(path, { method = 'GET', json, body, headers } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: API_BASE ? 'omit' : 'include',
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : body,
  })

  const contentType = response.headers.get('content-type') || ''
  let data
  if (contentType.includes('application/json')) {
    data = await response.json()
  } else if (contentType.startsWith('audio/') || contentType.includes('octet-stream')) {
    data = await response.blob()
  } else {
    const text = await response.text()
    data = text ? { error: text } : null
  }

  if (!response.ok) {
    const message = data && typeof data === 'object' && data.error
      ? data.error
      : `Request failed (${response.status})`
    throw new ApiError(message, response.status, data)
  }

  return data
}

export const api = {
  health: () => apiRequest('/api/health'),
  generateQuestions: (payload) => apiRequest('/api/generate-questions', { method: 'POST', json: payload }),
  uploadAudio: (formData) => apiRequest('/api/upload-audio', { method: 'POST', body: formData }),
  generateAudio: (text) => apiRequest('/api/generate-audio', { method: 'POST', json: { text } }),
  evaluateAnswer: (payload) => apiRequest('/api/evaluate-answer', { method: 'POST', json: payload }),
  saveInterview: (payload) => apiRequest('/api/save-interview', { method: 'POST', json: payload }),
  interviewHistory: () => apiRequest('/api/interview-history'),
  deleteInterview: (id) => apiRequest(`/api/interviews/${id}`, { method: 'DELETE' }),
  clearInterviews: () => apiRequest('/api/interviews/clear', { method: 'POST' }),
}
