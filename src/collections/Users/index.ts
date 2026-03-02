// src/collections/Users/index.ts (vanilla starter uses folder-based collections)
import type { CollectionConfig } from 'payload'
import { betterAuthStrategy } from '@delmaredigital/payload-better-auth'
import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields'
import { isAdmin } from '@/access/admin'
import { isSuperAdminAccess } from '@/access/isSuperAdmin'
import { updateAndDeleteAccess } from './access/updateAndDelete'
import { readAccess } from './access/read'

const defaultTenantArrayField = tenantsArrayField({
  tenantsArrayFieldName: 'tenants',
  tenantsArrayTenantFieldName: 'tenant',
  tenantsCollectionSlug: 'tenants',
  arrayFieldAccess: {},
  tenantFieldAccess: {},
  rowFields: [
    {
      name: 'roles',
      type: 'select',
      defaultValue: ['tenant-viewer'],
      hasMany: true,
      options: ['tenant-admin', 'tenant-viewer'],
      required: true,
    },
  ],
})
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    disableLocalStrategy: true,
    strategies: [betterAuthStrategy()],
    useAPIKey: true,
  },
  access: {
    // read: ({ req }) => {
    //   if (!req.user) return false
    //   if (req.user.role === 'admin') return true
    //   return { id: { equals: req.user.id } }
    // },
    create: () => true,
    delete: updateAndDeleteAccess,
    read: readAccess,
    update: updateAndDeleteAccess,
    // admin: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'super-admin',
  },
  admin: {
    group: 'Users',
    hidden: ({ user }) => {
      if (!user) return true
      if (user.role === 'super-admin') return false
      return true
    },
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'emailVerified', type: 'checkbox', defaultValue: false },
    { name: 'name', type: 'text' },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      // required: true,
    },
    {
      name: 'phoneNumber',
      type: 'text',
      // required: true,
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'user',
      options: [
        { label: 'User', value: 'user' },
        { label: 'Admin', value: 'admin' },
        { label: 'Super Admin', value: 'super-admin' },
      ],
    },
    {
      name: 'gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Other', value: 'other' },
        { label: 'Prefer Not to Say', value: 'prefer-not-to-say' },
      ],
      defaultValue: 'prefer-not-to-say',
    },
    {
      ...defaultTenantArrayField,
      label: 'Tenants',
      admin: {
        ...(defaultTenantArrayField?.admin || {}),
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (!req.user) {
          data.role = 'user'
        }
        if (req.user && !(isAdmin({ req }) || isSuperAdminAccess({ req }))) {
          data.role = 'user'
        }
        if (operation === 'create') {
          // Only apply if tenants array is missing or empty
          if (!data.tenants || data.tenants.length === 0) {
            const getTenant = await req.payload.find({
              collection: 'tenants',
              where: {
                slug: {
                  equals: 'default',
                },
              },
              limit: 1,
            })

            if (getTenant.docs[0]) {
              data.tenants = [
                {
                  tenant: getTenant.docs[0].id,
                  roles: ['tenant-viewer'],
                },
              ]
              // Also set the singular tenant field added by the multi-tenant plugin
              data.tenant = getTenant.docs[0].id
            } else {
              req.payload.logger.warn(
                'No "default" tenant found. User created without tenant assignment.',
              )
            }
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          await req.payload.create({
            collection: 'notifications',
            data: {
              user: doc.id,
              title: 'Welcome to Afno Event!',
              message: `Hello ${doc.name || 'there'}! We're excited to have you here. Start exploring events now!`,
              type: 'info',
            },
          })
        }
      },
    ],
  },
}
