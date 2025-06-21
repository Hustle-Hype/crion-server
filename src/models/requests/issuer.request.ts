import { z } from 'zod'

export const UpdateProfileRequestSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
    website: z.string().url().optional(),
    metadata: z
      .object({
        preferences: z
          .object({
            notifications: z.boolean().optional(),
            language: z.string().optional(),
            timezone: z.string().optional()
          })
          .optional(),
        customFields: z.record(z.unknown()).optional()
      })
      .optional()
  })
})

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>['body']
