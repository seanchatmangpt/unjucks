---
to: server/utils/auth.ts
---
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import type { User } from '~/types/user'

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d'

export interface JWTPayload {
  user: {
    id: string
    email: string
    role: string
  }
  type: 'access' | 'refresh'
  iat: number
  exp: number
}

/**
 * Extract and verify user from token
 */
export async function getUserFromToken(event: any): Promise<User | null> {
  try {
    // Try cookie first, then Authorization header
    const token = getCookie(event, 'auth-token') || 
                  getHeader(event, 'authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return null
    }
    
    // Verify JWT token
    const payload = await verifyJWT(token) as JWTPayload
    
    if (payload.type !== 'access') {
      return null
    }
    
    // Get user from database
    const user = await getUserById(payload.user.id)
    
    if (!user || !user.isActive) {
      return null
    }
    
    return user
    
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

/**
 * Generate JWT access token
 */
export async function generateAccessToken(user: User): Promise<string> {
  const payload: Partial<JWTPayload> = {
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    },
    type: 'access'
  }
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'interview-sim',
    audience: 'interview-sim-users'
  })
}

/**
 * Generate JWT refresh token
 */
export async function generateRefreshToken(user: User): Promise<string> {
  const payload: Partial<JWTPayload> = {
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    },
    type: 'refresh'
  }
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'interview-sim',
    audience: 'interview-sim-users'
  })
}

/**
 * Verify JWT token
 */
export async function verifyJWT(token: string): Promise<JWTPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, {
      issuer: 'interview-sim',
      audience: 'interview-sim-users'
    }, (error, decoded) => {
      if (error) {
        reject(error)
      } else {
        resolve(decoded as JWTPayload)
      }
    })
  })
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  
  return result
}

/**
 * Set authentication cookies
 */
export function setAuthCookies(event: any, accessToken: string, refreshToken: string) {
  // Access token cookie (shorter expiry)
  setCookie(event, 'auth-token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/'
  })
  
  // Refresh token cookie (longer expiry)
  setCookie(event, 'refresh-token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    path: '/api/auth'
  })
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(event: any) {
  deleteCookie(event, 'auth-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  })
  
  deleteCookie(event, 'refresh-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth'
  })
}

/**
 * Require authentication middleware
 */
export async function requireAuth(event: any): Promise<User> {
  const user = await getUserFromToken(event)
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }
  
  return user
}

/**
 * Require specific role middleware
 */
export async function requireRole(event: any, requiredRole: string): Promise<User> {
  const user = await requireAuth(event)
  
  if (user.role !== requiredRole && user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Insufficient permissions'
    })
  }
  
  return user
}

/**
 * Rate limiting by IP
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  // In production, implement with Redis or similar
  // This is a simplified in-memory implementation
  const key = `rate_limit:${action}:${identifier}`
  const window = Math.floor(Date.now() / 1000 / windowSeconds)
  const fullKey = `${key}:${window}`
  
  // Mock implementation - replace with actual cache
  return true
}

/**
 * Get client IP address
 */
export function getClientIP(event: any): string {
  // Check various headers for the real IP
  const forwarded = getHeader(event, 'x-forwarded-for')
  const realIP = getHeader(event, 'x-real-ip')
  const cfIP = getHeader(event, 'cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (cfIP) {
    return cfIP
  }
  
  return 'unknown'
}

// Mock database functions - replace with actual database implementation
async function getUserById(id: string): Promise<User | null> {
  // Mock user data
  return {
    id,
    email: 'user@example.com',
    name: 'Test User',
    role: 'user',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}