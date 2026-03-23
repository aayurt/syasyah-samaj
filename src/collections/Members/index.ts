import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'

export const Members: CollectionConfig = {
  slug: 'members',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: () => true, // Publicly viewable; change to isAdmin if private
    update: isAdmin,
  },
  admin: {
    useAsTitle: 'fullName',
    group: 'User Management',
    defaultColumns: ['fullName', 'email', 'role', 'status'],
  },
  fields: [
    {
      name: 'fullName',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bio',
      type: 'textarea',
      admin: {
        description: 'Short professional biography',
      },
      localized: true,
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'member',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Moderator', value: 'moderator' },
        { label: 'Member', value: 'member' },
        { label: 'VIP', value: 'vip' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'socialLinks',
      type: 'group',
      fields: [
        { name: 'twitter', type: 'text' },
        { name: 'linkedin', type: 'text' },
        { name: 'website', type: 'text' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Suspended', value: 'suspended' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'joinedDate',
      type: 'date',
      defaultValue: () => new Date(),
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
    },
  ],
}
