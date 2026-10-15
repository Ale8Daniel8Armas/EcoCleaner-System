export function resolveDemoMode(value: unknown): 'demo' | 'off' {
  return value === undefined || value === 'demo' ? 'demo' : 'off'
}

export function canShowDemo(role: unknown, mode: unknown): boolean {
  return role === 'supervisor' && resolveDemoMode(mode) === 'demo'
}
