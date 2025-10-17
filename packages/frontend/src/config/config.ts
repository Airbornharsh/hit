export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:6521'
export const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:6021'
export const IS_PRODUCTION = process.env.NEXT_PUBLIC_IS_PRODUCTION
  ? process.env.NEXT_PUBLIC_IS_PRODUCTION === 'true'
  : false
