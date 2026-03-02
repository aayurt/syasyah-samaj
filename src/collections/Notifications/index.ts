import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/admin'
import { updateAndDeleteAccess } from '../Users/access/updateAndDelete'
import { isSuperAdminAccess } from '@/access/isSuperAdmin'

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
    access: {
        create: isSuperAdminAccess,
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.role === 'admin' || req.user.role === 'super-admin') return true
            return {
                user: {
                    equals: req.user.id,
                },
            }
        },
        update: updateAndDeleteAccess,
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
