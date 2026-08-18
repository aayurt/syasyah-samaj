import type { CollectionConfig } from 'payload'

/**
 * P5 org-wide immutable audit trail (§11, §20 of docs/illaka/PLAN.md).
 *
 * Every create/update/delete across scoped billing collections writes a row
 * here. The collection is append-only: no update or delete access is granted.
 */
export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  labels: { singular: 'Audit Log', plural: 'Audit Logs' },
  admin: {
    useAsTitle: 'action',
    group: 'Billing',
    defaultColumns: ['action', 'entityType', 'userName', 'createdAt'],
  },
  access: {
    // Only central roles and super-admin can read audit logs.
    read: ({ req }) => {
      if (!req.user) return false
      const role = (req.user as any)?.role
      return (
        role === 'super-admin' ||
        role === 'admin' ||
        role === 'central-auditor' ||
        role === 'central-treasurer' ||
        role === 'central-exec'
      )
    },
    // Audit logs are append-only — no update or delete.
    create: () => true,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'action',
      type: 'select',
      required: true,
      options: [
        { label: 'Create', value: 'create' },
        { label: 'Update', value: 'update' },
        { label: 'Delete', value: 'delete' },
        { label: 'Post', value: 'post' },
        { label: 'Void', value: 'void' },
        { label: 'Transfer', value: 'transfer' },
      ],
    },
    {
      name: 'entityType',
      type: 'text',
      required: true,
      admin: { description: 'Collection slug (e.g. documents, gl-accounts)' },
    },
    {
      name: 'entityId',
      type: 'text',
      required: true,
    },
    {
      name: 'entityLabel',
      type: 'text',
      admin: { description: 'Human-readable identifier (e.g. voucher number)' },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
    },
    {
      name: 'userName',
      type: 'text',
      admin: { description: 'Display name or email of the user who performed the action' },
    },
    {
      name: 'userRole',
      type: 'text',
    },
    {
      name: 'before',
      type: 'json',
      admin: { description: 'Snapshot of the entity before the change (null on create)' },
    },
    {
      name: 'after',
      type: 'json',
      admin: { description: 'Snapshot of the entity after the change' },
    },
    {
      name: 'meta',
      type: 'json',
      admin: { description: 'Extra context (e.g. transferRef, posting details)' },
    },
  ],
}
