'use client'

import React, { useState, useEffect } from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { useField, useForm } from '@payloadcms/ui'
import { Input } from '@payloadcms/ui'
import { Select, SelectItem } from '@payloadcms/ui'
import { Button } from '@payloadcms/ui'
import { Card } from '@payloadcms/ui'
import { HStack, VStack, Spacer } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation'
import { DigitalIDCard } from '@/components/DigitalIDCard'
import { IlakaSelector } from '@/components/admin/IlakaSelector'

interface MemberEntryFormProps {
  initialData?: any
  onSuccess?: (member: any) => void
}

export const MemberEntryForm: React.FC<MemberEntryFormProps> = ({
  initialData,
  onSuccess,
}) => {
  const payload = await getPayload({ config })
  const [form] = useForm({
    collection: 'members',
    draft: true,
    onSubmit: async (values) => {
      try {
        // Create the member first
        const doc = await payload.create({
          collection: 'members',
          data: values,
        })

        // If payment status is "paid", auto-generate membership receipt
        if (values.paymentStatus === 'paid' && values.membershipType) {
          try {
            const typeId = values.membershipType.relationTo 
              ? values.membershipType.relationTo 
              : values.membershipType

            // Fetch the membership type details
            const mtype = await payload.findByID({
              collection: 'membership-types',
              id: String(typeId),
              depth: 0,
            })

            if (mtype) {
              const now = new Date()
              const dateStr = now.toISOString().slice(0, 10)
              const fee = Number(mtype.fee) || 0
              const tenant = values.tenant || 'C00' // default to Central if none selected
              const narration = `${mtype.name} membership fee — ${values.fullName}`

              // Create the membership-receipt document via raw SQL to bypass
              // Payload 3.x local API deadlock with array fields
              const pool = (payload.db as any).pool
              const docInsert = await pool.query(
                `INSERT INTO documents
                   (doc_type, date, narration, status, tax_rate, net_total,
                    tax_total, gross_total, tenant_id, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
                 RETURNING id`,
                ['membership-receipt', dateStr, narration, 'draft', 0, fee, 0, fee, tenant],
              )
              const receiptId: number = docInsert.rows[0].id

              // Insert the line item into the Payload array table
              await pool.query(
                `INSERT INTO documents_lines
                   (_order, _parent_id, id, description, qty, rate, amount)
                 VALUES (0, $1, $2, $3, $4, $5, $6)`,
                [
                  receiptId,
                  `line-${receiptId}-0`,
                  `${mtype.name} membership fee`,
                  1,
                  fee,
                  fee,
                ],
              )

              // Auto-post the receipt using the billing posting engine
              const posted = await payload.create({
                collection: 'documents',
                data: {
                  doc_type: 'membership-receipt',
                  date: dateStr,
                  narration,
                  status: 'posted',
                  tax_rate: 0,
                  net_total: fee,
                  tax_total: 0,
                  gross_total: fee,
                  tenant: tenant,
                  // Link to the member
                  referenceToDocType: 'members',
                  referenceTo: doc.id,
                },
                // Use transaction to avoid deadlock
                req: { transactionID: 'membership-receipt-creation' },
              })

              // Update the member with receipt and payment status
              await payload.update({
                collection: 'members',
                id: doc.id,
                data: {
                  paymentStatus: 'paid',
                  lastReceipt: posted.id,
                  renewalDate: new Date().toISOString().slice(0, 10),
                },
              })
            }
          } catch (receiptError: any) {
            console.error('Error generating membership receipt:', receiptError)
            // Don't fail the member creation if receipt generation fails
          }
        }

        onSuccess?.(doc)
      } catch (error: any) {
        console.error('Error creating member:', error)
      }
    },
  })

  // Initialize form values from initialData if provided
  useEffect(() => {
    if (initialData) {
      form.setFields(initialData)
    }
  }, [initialData, form])

  return (
    <Card width="full" maxWidth="640" shadow="sm">
      <Card.Header>
        <Card.Title>Register New Member</Card.Title>
      </Card.Header>

      <Card.Content>
        <VStack spacing={4}>
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="font-medium text-sm">
              Full Name *
            </label>
            <Input
              id="fullName"
              name="fullName"
              isRequired
              aria-describedby="fullName-help"
              placeholder="Enter full name"
            />
            <p id="fullName-help" className="text-xs text-muted-foreground mt-1">
              Enter the member's full name
            </p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="font-medium text-sm">
              Email *
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              isRequired
              aria-describedby="email-help"
              placeholder="Enter email"
            />
            <p id="email-help" className="text-xs text-muted-foreground mt-1">
              Enter the member's email address
            </p>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phoneNumber" className="font-medium text-sm">
              Phone Number
            </label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              aria-describedby="phoneNumber-help"
              placeholder="Enter phone number"
            />
            <p id="phoneNumber-help" className="text-xs text-muted-foreground mt-1">
              Enter the member's phone number (optional)
            </p>
          </div>

          {/* Membership Type */}
          <div>
            <label htmlFor="membershipType" className="font-medium text-sm">
              Membership Type *
            </label>
            <Select
              id="membershipType"
              name="membershipType"
              isRequired
              aria-describedby="membershipType-help"
              onValueChange={(value) => {
                form.setFieldValue('membershipType', value)
              }}
            >
              <SelectItem value="" disabled>
                Select Membership Type
              </SelectItem>
              {['Basic', 'Standard', 'Premium'].map((type) => (
                <SelectItem
                  key={type}
                  value={type.toLowerCase() as any}
                >
                  {type}
                </SelectItem>
              ))}
            </Select>
            <p id="membershipType-help" className="text-xs text-muted-foreground mt-1">
              Select the member's membership category
            </p>
          </div>

          {/* Tenant / Ilaka Selection */}
          <div>
            <label htmlFor="tenant" className="font-medium text-sm">
              Ilaka / Organization *
            </label>
            <IlakaSelector />
            <p className="text-xs text-muted-foreground mt-1">
              Select the member's ilaka/organization
            </p>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="font-medium text-sm">
              Bio (Optional)
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={3}
              aria-describedby="bio-help"
              placeholder="Short professional biography"
              className="w-full rounded-border border-input my-2"
            ></textarea>
            <p id="bio-help" className="text-xs text-muted-foreground mt-1">
              Short professional biography (optional)
            </p>
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="font-medium text-sm">
              Role *
            </label>
            <Select
              id="role"
              name="role"
              isRequired
              aria-describedby="role-help"
              onValueChange={(value) => {
                form.setFieldValue('role', value)
              }}
            >
              <SelectItem value="" disabled>
                Select Role
              </SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="vip">VIP</select>
            </Select>
            <p id="role-help" className="text-xs text-muted-foreground mt-1">
              Select the member's role
            </p>
          </div>

          {/* Member ID */}
          <div>
            <label htmlFor="memberId" className="font-medium text-sm">
              Member ID (Optional)
            </label>
            <Input
              id="memberId"
              name="memberId"
              aria-describedby="memberId-help"
              placeholder="Auto-generated if left blank"
              className="w-full rounded-border border-input my-2"
            />
            <p id="memberId-help" className="text-xs text-muted-foreground mt-1">
              Auto-generated member ID if left blank
            </p>
          </div>

          {/* Joined Date (auto-set to today) */}
          <div>
            <label className="font-medium text-sm">
              Joined Date
            </label>
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString()}
            </span>
            <input
              type="hidden"
              name="joinedDate"
              value={new Date().toISOString().slice(0, 10)}
            />
          </div>

          {/* Payment Status */}
          <div>
            <label className="font-medium text-sm">
              Payment Status
            </label>
            <Select
              id="paymentStatus"
              name="paymentStatus"
              onValueChange={(value) => {
                form.setFieldValue('paymentStatus', value)
              }}
            >
              <SelectItem value="" disabled>
                Select Payment Status
              </SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="paid" selected>
                Paid
              </SelectItem>
            </Select>
          </div>

          {/* Expiry Date (calculated from membership period) */}
          <div>
            <label className="font-medium text-sm">
              Expiry Date
            </label>
            <span className="text-sm text-muted-foreground" id="expiryDate">
              {['Basic', 'Standard', 'Premium'].map((type) => {
                const periods: any = { Basic: 12, Standard: 12, Premium: 12 }
                const months = periods[type] || 12
                const d = new Date()
                d.setMonth(d.getMonth() + months)
                return d.toLocaleDateString()
              })[0]}
            </span>
            <input
              type="hidden"
              name="renewalDate"
              value={new Date().toISOString().slice(0, 10)}
            />
          </div>
        </VStack>
      </Card.Content>

      <Card.Footer>
        <HStack justify="end" spacing={3}>
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            aria-label="Cancel member registration"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!form.isValid}
            onClick={() => form.submit()}
            aria-label="Register new member"
          >
            Register Member
          </Button>
        </HStack>
      </Card.Footer>
    </Card>
  )
}