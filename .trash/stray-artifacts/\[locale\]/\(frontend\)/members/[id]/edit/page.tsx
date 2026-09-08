'use client'

import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { useField, useForm } from '@payloadcms/ui'
import { Input } from '@payloadcms/ui'
import { Select, SelectItem } from '@payloadcms/ui'
import { Button } from '@payloadcms/ui'
import { Card } from '@payloadcms/ui'
import { VStack, HStack, Spacer } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation'
import { IlakaSelector } from '@/components/admin/IlakaSelector'

interface MemberEditProps {
  params: { id: string }
}

export const MemberEditPage = async ({ params }: MemberEditProps) => {
  const payload = await getPayload({ config })
  const { id } = params

  // Fetch the member data first
  const member = await payload.findByID({
    collection: 'members',
    id,
    depth: 0,
  })

  if (!member) {
    return (
      <div className="container mx-auto py-20">
        <h1 className="text-3xl font-bold">Member Not Found</h1>
        <p>The member you're looking for could not be found.</p>
      </div>
    )
  }

  const [form] = useForm({
    collection: 'members',
    draft: true,
    state: member,
    onSubmit: async (values) => {
      try {
        await payload.update({
          collection: 'members',
          id,
          data: values,
        })
        // Reload or redirect on success
        window.location.href = `/members/${id}`
      } catch (error: any) {
        console.error('Error updating member:', error)
      }
    },
  })

  // Initialize form with member data
  useEffect(() => {
    if (member) {
      form.setFields({
        fullName: member.fullName,
        email: member.email,
        phoneNumber: member.phoneNumber,
        membershipType: member.membershipType?.relationTo ?? member.membershipType,
        tenant: member.tenant,
        bio: member.bio,
        role: member.role,
        socialLinks: member.socialLinks,
        status: member.status,
        joinedDate: member.joinedDate,
        expiryDate: member.expiryDate,
        phoneNumber: member.phoneNumber,
        memberId: member.memberId,
        idCardDetails: member.idCardDetails,
        lastReceipt: member.lastReceipt,
        paymentStatus: member.paymentStatus,
        renewalDate: member.renewalDate,
      })
    }
  }, [member, form])

  return (
    <Card width="full" maxWidth="640" shadow="sm">
      <Card.Header>
        <Card.Title>Edit Member</Card.Title>
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
              defaultValue={member.fullName}
            />
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
              defaultValue={member.email}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phoneNumber" className="font-medium text-sm">
              Phone Number
            </label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              defaultValue={member.phoneNumber || ''}
            />
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
          </div>

          {/* Tenant / Ilaka Selection */}
          <div>
            <label htmlFor="tenant" className="font-medium text-sm">
              Ilaka / Organization *
            </label>
            <IlakaSelector />
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
              defaultValue={member.bio || ''}
              className="w-full rounded-border border-input my-2"
            ></textarea>
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
          </div>

          {/* Member ID */}
          <div>
            <label htmlFor="memberId" className="font-medium text-sm">
              Member ID
            </label>
            <Input
              id="memberId"
              name="memberId"
              defaultValue={member.memberId || ''}
            />
          </div>

          {/* Joined Date */}
          <div>
            <label className="font-medium text-sm">
              Joined Date
            </label>
            <input
              type="date"
              name="joinedDate"
              defaultValue={member.joinedDate ? member.joinedDate.slice(0, 10) : new Date().toISOString().slice(0, 10)}
            />
          </div>

          {/* Expiry Date */}
          <div>
            <label className="font-medium text-sm">
              Expiry Date
            </label>
            <input
              type="date"
              name="expiryDate"
              defaultValue={member.expiryDate ? member.expiryDate.slice(0, 10) : ''}
            />
          </div>

          {/* Payment Status */}
          <div>
            <label htmlFor="paymentStatus" className="font-medium text-sm">
              Payment Status *
            </label>
            <Select
              id="paymentStatus"
              name="paymentStatus"
              isRequired
              onValueChange={(value) => {
                form.setFieldValue('paymentStatus', value)
              }}
            >
              <SelectItem value="" disabled>
                Select Payment Status
              </SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</select>
            </Select>
          </div>

          {/* Last Receipt */}
          <div>
            <label htmlFor="lastReceipt" className="font-medium text-sm">
              Last Receipt ID
            </label>
            <Input
              id="lastReceipt"
              name="lastReceipt"
              defaultValue={member.lastReceipt?.toString() || ''}
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
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!form.isValid}
            onClick={() => form.submit()}
          >
            Update Member
          </Button>
        </HStack>
      </Card.Footer>
    </Card>
  )
}