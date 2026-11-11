const HISTORY_KEY = 'intprepper_history'

function parseHistory(raw) {
  try {
    const value = JSON.parse(raw || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function readLocalHistory() {
  return parseHistory(localStorage.getItem(HISTORY_KEY))
}

export function writeLocalHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
}
