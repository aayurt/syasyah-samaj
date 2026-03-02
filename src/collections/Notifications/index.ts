import { isSuperAdminAccess } from '@/access/isSuperAdmin'
import type { CollectionConfig } from 'payload'
import { updateAndDeleteAccess } from '../Users/access/updateAndDelete'

export const Notifications: CollectionConfig = {
    slug: 'notifications',
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'user', 'type', 'read', 'createdAt'],
        group: 'Users',
        hidden: ({ user }) => {
            if (!user) return true
            if (user.role === 'super-admin') return false
            return true
        },
    },
    endpoints: [
        {
            path: '/mark-all-read',
            method: 'post',
            handler: async (req) => {
                if (!req.user) {
                    return Response.json({ error: 'Unauthorized' }, { status: 401 })
                }

                try {
                    await req.payload.update({
                        collection: 'notifications',
                        where: {
                            and: [
                                {
                                    user: {
                                        equals: req.user.id,
                                    },
                                },
                                {
                                    read: {
                                        equals: false,
                                    },
                                },
                            ],
                        },
                        data: {
                            read: true,
                        },
                    })

                    return Response.json({ success: true })
                } catch (error) {
                    req.payload.logger.error(`Error marking all notifications as read: ${error}`)
                    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
                }
            },
        },
    ],
    access: {
        create: isSuperAdminAccess,
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
        delete: isSuperAdminAccess,
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
        },
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'message',
            type: 'textarea',
            required: true,
        },
        {
            name: 'type',
            type: 'select',
            defaultValue: 'info',
            options: [
                { label: 'Information', value: 'info' },
                { label: 'Event Alert', value: 'event' },
                { label: 'Reminder', value: 'reminder' },
                { label: 'System', value: 'system' },
            ],
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'read',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                position: 'sidebar',
            },
        },
        {
            name: 'link',
            type: 'text',
            admin: {
                description: 'Optional link to redirect the user (e.g. /events/123)',
            },
        },
    ],
    timestamps: true,
}
