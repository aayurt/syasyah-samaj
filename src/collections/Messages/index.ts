import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { sendFCMNotification } from '@/utilities/sendFCMNotification'

export const Messages: CollectionConfig = {
  slug: 'messages',
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'content',
    group: 'Messaging',
  },
  fields: [
    {
      name: 'chatRoom',
      type: 'relationship',
      relationTo: 'chat-rooms',
      required: true,
      index: true,
    },
    {
      name: 'sender',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
    },
    {
      name: 'readBy',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation === 'create') {
          const chatRoom = await req.payload.findByID({
            collection: 'chat-rooms',
            id: doc.chatRoom,
          })

          const sender = await req.payload.findByID({
            collection: 'users',
            id: doc.sender,
          })

          const otherMembers = chatRoom.members.filter((m: any) =>
            (typeof m === 'object' ? m.id : m) !== doc.sender
          )

          for (const memberId of otherMembers) {
            const userId = typeof memberId === 'object' ? memberId.id : memberId
            const user = await req.payload.findByID({
              collection: 'users',
              id: userId,
            })

            // In-app notification
            await req.payload.create({
              collection: 'notifications',
              data: {
                user: userId,
                title: `New message from ${sender.name || 'someone'}`,
                message: doc.content,
                type: 'info',
                link: `/chat/${doc.chatRoom}`,
              },
            })

            // FCM Notification if tokens exist (assuming tokens are stored on user)
            if (user.fcmTokens && user.fcmTokens.length > 0) {
                await sendFCMNotification({
                    tokens: user.fcmTokens.map((t: any) => t.token),
                    notification: {
                        title: `New message in ${chatRoom.name}`,
                        body: doc.content,
                        link: `/chat/${doc.chatRoom}`,
                    }
                })
            }
          }
        }
      }
    ]
  },
  timestamps: true,
}
