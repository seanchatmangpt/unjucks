---
to: server/api/user/settings.put.ts
---
import { z } from 'zod'
import type { UserSettingsResponse, ApiError } from '~/types/api'

const userSettingsSchema = z.object({
  profile: z.object({
    name: z.string().min(2).max(50).optional(),
    bio: z.string().max(200).optional(),
    avatar: z.string().url().optional(),
    timezone: z.string().optional(),
    language: z.enum(['en', 'es', 'fr', 'de', 'zh']).optional()
  }).optional(),
  preferences: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    weeklyReports: z.boolean().optional(),
    achievementAlerts: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    defaultDifficulty: z.enum(['junior', 'mid', 'senior']).optional(),
    preferredLanguages: z.array(z.string()).optional()
  }).optional(),
  privacy: z.object({
    profilePublic: z.boolean().optional(),
    showAchievements: z.boolean().optional(),
    shareAnalytics: z.boolean().optional(),
    allowDataCollection: z.boolean().optional()
  }).optional(),
  interview: z.object({
    defaultDuration: z.number().min(15).max(180).optional(),
    autoRecording: z.boolean().optional(),
    aiAssistance: z.boolean().optional(),
    feedbackDetail: z.enum(['minimal', 'standard', 'detailed']).optional()
  }).optional()
})

export default defineEventHandler(async (event): Promise<UserSettingsResponse | ApiError> => {
  try {
    // Validate request method
    assertMethod(event, 'PUT')
    
    // Authentication check
    const user = await getUserFromToken(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }
    
    // Parse and validate request body
    const body = await readBody(event)
    const validated = userSettingsSchema.parse(body)
    
    // Get current user settings
    const currentSettings = await getUserSettings(user.id)
    
    // Prepare update data
    const updateData: any = {}
    
    if (validated.profile) {
      updateData.profile = { ...currentSettings.profile, ...validated.profile }
      
      // Validate avatar URL if provided
      if (validated.profile.avatar) {
        const isValidAvatar = await validateAvatarUrl(validated.profile.avatar)
        if (!isValidAvatar) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid avatar URL'
          })
        }
      }
    }
    
    if (validated.preferences) {
      updateData.preferences = { ...currentSettings.preferences, ...validated.preferences }
    }
    
    if (validated.privacy) {
      updateData.privacy = { ...currentSettings.privacy, ...validated.privacy }
    }
    
    if (validated.interview) {
      updateData.interview = { ...currentSettings.interview, ...validated.interview }
    }
    
    // Update settings in database
    const updatedSettings = await updateUserSettings(user.id, updateData)
    
    // Log settings change for audit
    await logSettingsChange({
      userId: user.id,
      changes: validated,
      timestamp: new Date(),
      ip: getClientIP(event),
      userAgent: getHeader(event, 'user-agent')
    })
    
    // Handle special cases
    if (validated.profile?.timezone) {
      // Update user timezone for session scheduling
      await updateUserTimezone(user.id, validated.profile.timezone)
    }
    
    if (validated.preferences?.emailNotifications === false) {
      // Unsubscribe from email notifications
      await unsubscribeFromEmails(user.id)
    }
    
    // Invalidate relevant caches
    await invalidateUserCache(user.id)
    
    return {
      success: true,
      data: {
        settings: {
          profile: updatedSettings.profile,
          preferences: updatedSettings.preferences,
          privacy: updatedSettings.privacy,
          interview: updatedSettings.interview
        },
        message: 'Settings updated successfully'
      }
    }
    
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        data: {
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }
      })
    }
    
    // Re-throw HTTP errors
    if (error.statusCode) {
      throw error
    }
    
    // Handle unexpected errors
    console.error('Update user settings error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

// Helper functions
async function getUserSettings(userId: string) {
  // Get current user settings from database
  return {
    profile: {
      name: 'John Doe',
      bio: '',
      avatar: '/avatars/default.png',
      timezone: 'UTC',
      language: 'en'
    },
    preferences: {
      emailNotifications: true,
      pushNotifications: true,
      weeklyReports: true,
      achievementAlerts: true,
      theme: 'auto',
      defaultDifficulty: 'mid',
      preferredLanguages: ['javascript', 'typescript']
    },
    privacy: {
      profilePublic: false,
      showAchievements: true,
      shareAnalytics: true,
      allowDataCollection: true
    },
    interview: {
      defaultDuration: 60,
      autoRecording: false,
      aiAssistance: true,
      feedbackDetail: 'standard'
    }
  }
}

async function updateUserSettings(userId: string, updateData: any) {
  // Update settings in database
  // Return updated settings
  return {
    profile: updateData.profile || {},
    preferences: updateData.preferences || {},
    privacy: updateData.privacy || {},
    interview: updateData.interview || {}
  }
}

async function validateAvatarUrl(url: string): Promise<boolean> {
  try {
    // Check if URL is accessible and returns an image
    const response = await fetch(url, { method: 'HEAD' })
    const contentType = response.headers.get('content-type')
    return response.ok && contentType?.startsWith('image/')
  } catch {
    return false
  }
}

async function logSettingsChange(data: any) {
  // Log for audit trail
}

async function updateUserTimezone(userId: string, timezone: string) {
  // Update timezone for scheduling
}

async function unsubscribeFromEmails(userId: string) {
  // Handle email unsubscription
}

async function invalidateUserCache(userId: string) {
  // Invalidate relevant cache entries
}