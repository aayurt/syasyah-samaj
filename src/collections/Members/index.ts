import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'
import { syncMembersFromGoogleSheet } from '@/utilities/syncSheets'
import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import { assignTenant } from '@/utilities/tenantScope'
import { postDocument } from '@/collections/Documents'

export const Members: CollectionConfig = {
  slug: 'members',
  access: {
    create: scopedCreate,
    delete: scopedDelete,
    read: scopedRead,
    update: scopedUpdate,
  },
  hooks: {
    beforeValidate: [assignTenant],
  },
  admin: {
    useAsTitle: 'fullName',
    group: 'User Management',
    defaultColumns: ['fullName', 'email', 'role', 'status', 'user'],
    components: {
      beforeListTable: ['@/components/admin/SyncSheets/index#SyncSheets'],
    },
  },
  endpoints: [
    {
      path: '/sync-sheets',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !isAdmin({ req })) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const { sheetUrl, tenantId, selectedIndices, removeIndices } = (await req.json!()) as {
            sheetUrl: string
            tenantId?: number | string
            selectedIndices?: number[]
            removeIndices?: number[]
          }
          const result = await syncMembersFromGoogleSheet(req.payload, sheetUrl, { tenantId, selectedIndices, removeIndices })
          return Response.json(result)
        } catch (error: any) {
          return Response.json({ error: error.message }, { status: 500 })
        }
      },
    },
    // P2: pay membership fee → creates membership-receipt + auto-posts
    {
      path: '/:id/pay-fee',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !isAdmin({ req })) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing member id' }, { status: 400 })
        }
        try {
          const member = (await req.payload.findByID({
            collection: 'members',
            id,
            depth: 0,
          })) as any
          if (!member) {
            return Response.json({ error: 'Member not found' }, { status: 404 })
          }
          const typeId = member.membershipType as number | null | undefined
          if (!typeId) {
            return Response.json(
              { error: 'Member has no membership type assigned.' },
              { status: 400 },
            )
          }
          const mtype = (await req.payload.findByID({
            collection: 'membership-types',
            id: String(typeId),
            depth: 0,
          })) as any
          if (!mtype) {
            return Response.json(
              { error: 'Membership type not found.' },
              { status: 404 },
            )
          }
          // Use the member's illaka (or C00 if unassigned)
          const tenant = member.tenant as number | null
          if (!tenant) {
            return Response.json(
              { error: 'Member has no illaka assigned.' },
              { status: 400 },
            )
          }
          // Get settings for cash/bank account mapping
          const settings = (await req.payload.findGlobal({
            slug: 'billing-settings',
          })) as any
          // Compute totals
          const fee = Number(mtype.fee) || 0
          const now = new Date()
          const dateStr = now.toISOString().slice(0, 10)
          const narration = `${mtype.name} membership fee — ${member.fullName}`

          // Create the membership-receipt document directly via the DB
          // pool to bypass Payload 3.x local API's inability to flatten
          // array field data before validation hooks run. The REST API
          // works but internal payload.create() deadlocks; raw SQL is
          // the reliable path. Then call postDocument() for the journal
          // entry + voucher number (which uses payload.findByID and
          // works fine for reading).
          const pool = (req.payload.db as any).pool
          const docInsert = await pool.query(
            `INSERT INTO documents
               (doc_type, date, narration, status, tax_rate, net_total,
                tax_total, gross_total, tenant_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
             RETURNING id`,
            ['membership-receipt', dateStr, narration, 'draft', 0, fee, 0, fee, tenant],
          )
          const docId: number = docInsert.rows[0].id

          // Insert the line item into the Payload array table
          await pool.query(
            `INSERT INTO documents_lines
               (_order, _parent_id, id, description, qty, rate, amount)
             VALUES (0, $1, $2, $3, $4, $5, $6)`,
            [
              docId,
              `line-${docId}-0`,
              `${mtype.name} membership fee`,
              1,
              fee,
              fee,
            ],
          )

          // Auto-post the receipt: builds the journal entry (Cash/Bank ←
          // Membership Fees), assigns the voucher number, and marks the
          // document posted. Reuses the billing posting engine.
          const posted = await postDocument(req.payload, docId, {
            request: req,
          })
          // Calculate renewal date from periodMonths
          const period = mtype.periodMonths || 12
          const renewal = new Date(now)
          renewal.setMonth(renewal.getMonth() + period)
          // Update the member
          await req.payload.update({
            collection: 'members',
            id,
            data: {
              paymentStatus: 'paid',
              lastReceipt: docId,
              renewalDate: renewal.toISOString().slice(0, 10),
            },
          })
          return Response.json({
            message: 'Fee paid successfully',
            receiptId: docId,
            journalEntry: posted.journalEntry,
            receiptNumber: posted.number,
            amount: mtype.fee,
            renewalDate: renewal.toISOString().slice(0, 10),
          })
        } catch (error: any) {
          return Response.json({ error: error.message }, { status: 500 })
        }
      },
    },
  ],
  fields: [
    {
      name: 'fullName',
      type: 'text',
      required: true,
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
      },
    },
    {
      name: 'phoneNumber',
      type: 'text',
    },
    {
      name: 'memberId',
      type: 'text',
      admin: {
        description: 'Unique Member ID from community records',
        position: 'sidebar',
      },
      index: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'expiryDate',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'idCardDetails',
      type: 'group',
      fields: [
        {
          name: 'bloodGroup',
          type: 'text',
        },
        {
          name: 'emergencyContact',
          type: 'text',
        },
      ],
    },
    // P2 membership fields
    {
      name: 'membershipType',
      type: 'relationship',
      relationTo: 'membership-types',
      admin: {
        description: 'Membership category (Basic, Standard, Premium, etc.)',
        position: 'sidebar',
      },
    },
    {
      name: 'renewalDate',
      type: 'date',
      admin: {
        description: 'When the current membership period expires',
        position: 'sidebar',
      },
    },
    {
      name: 'lastReceipt',
      type: 'relationship',
      relationTo: 'documents',
      admin: {
        description: 'Link to the latest membership fee receipt',
        position: 'sidebar',
      },
    },
    {
      name: 'paymentStatus',
      type: 'select',
      defaultValue: 'unpaid',
      options: [
        { label: 'Unpaid', value: 'unpaid' },
        { label: 'Paid', value: 'paid' },
        { label: 'Overdue', value: 'overdue' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
