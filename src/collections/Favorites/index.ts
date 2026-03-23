import type { CollectionConfig } from 'payload'

export const Favorites: CollectionConfig = {
  slug: 'favorites',
  admin: {
    useAsTitle: 'id',
    group: 'Users',
    hidden: ({ user }) => {
      if (!user) return true
      if (user.role === 'super-admin') return false
      return true
    },
  },
  endpoints: [
    {
      path: '/sync',
      method: 'post',
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let body: { eventIds?: string[] }
        try {
          if (!req.json) {
            return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
          }
          body = await req.json()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { eventIds = [] } = body

        if (!Array.isArray(eventIds)) {
          return Response.json({ error: 'eventIds must be an array' }, { status: 400 })
        }

        try {
          // Get current favorites for this user
          const current = await req.payload.find({
            collection: 'favorites' as any,
            where: {
              user: {
                equals: req.user.id,
              },
            },
            limit: 1000,
            pagination: false,
          })

          const currentEventIds: string[] = current.docs.map((doc: any) =>
            typeof doc.event === 'object' ? doc.event.id : doc.event,
          )

          // Events to delete: in current but not in new list
          const toDelete = current.docs.filter((doc: any) => {
            const eventId = typeof doc.event === 'object' ? doc.event.id : doc.event
            return !eventIds.includes(eventId)
          })

          // Events to add: in new list but not in current
          const toAdd = eventIds.filter((id) => !currentEventIds.includes(id))

          // Delete stale favorites
          await Promise.all(
            toDelete.map((doc: any) =>
              req.payload.delete({
                collection: 'favorites' as any,
                id: doc.id,
              }),
            ),
          )

          // Create new favorites
          await Promise.all(
            toAdd.map((eventId) =>
              req.payload.create({
                collection: 'favorites' as any,
                data: {
                  user: req.user!.id,
                  event: eventId,
                },
              }),
            ),
          )
          console.log({ req: req.user.id })
          const updated = await req.payload.find({
            collection: 'favorites',
            where: {
              user: {
                equals: req.user.id,
              },
            },
            limit: 1000,
            pagination: false,
          })
          return Response.json(updated)
        } catch (error) {
          req.payload.logger.error(`Error syncing favorites: ${error}`)
          return Response.json({ error: 'Internal Server Error' }, { status: 500 })
        }
      },
    },
  ],
  access: {
    create: ({ req }) => !!req.user,
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'super-admin') return true
      return {
        user: {
          equals: req.user.id,
        },
      }
    },
    update: ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'super-admin') return true
      return {
        user: {
          equals: req.user.id,
        },
      }
    },
    delete: ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'super-admin') return true
      return {
        user: {
          equals: req.user.id,
        },
      }
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
      },
      defaultValue: ({ user }: { user: any }) => user?.id,
    },
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      required: true,
      index: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          if (!data) return data

          // If not super-admin, force the user to be the logged-in user
          if (req.user && req.user.role !== 'super-admin') {
            data.user = req.user.id
          }

          // Prevent duplicate favorites (same user and same event)
          if (operation === 'create' && data.user && data.event) {
            const existing = await req.payload.find({
              collection: 'favorites' as any,
              where: {
                and: [
                  {
                    user: {
                      equals: data.user,
                    },
                  },
                  {
                    event: {
                      equals: data.event,
                    },
                  },
                ],
              },
              limit: 1,
            })

            if (existing.docs.length > 0) {
              throw new Error('This event is already in your favorites.')
            }
          }
        }
        return data
      },
    ],
  },
  timestamps: true,
}
