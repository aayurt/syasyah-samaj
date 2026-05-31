import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import { DigitalIDCard } from '@/components/DigitalIDCard'

export default async function MemberPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsPromise
  const payload = await getPayload({ config })

  const member = await payload.findByID({
    collection: 'members',
    id,
  })

  if (!member) {
    return notFound()
  }

  // Handle potential tenant data
  const tenant = typeof member.tenant === 'object' ? (member.tenant as any) : null

  return (
    <div className="container mx-auto py-20 flex flex-col items-center min-h-screen">
      <h1 className="text-4xl font-bold mb-10">Member Digital ID</h1>
      <DigitalIDCard
        member={{
          fullName: member.fullName,
          memberId: member.memberId || undefined,
          email: member.email,
          phoneNumber: member.phoneNumber,
          profileImage: member.profileImage,
          idCardDetails: member.idCardDetails ? {
            bloodGroup: member.idCardDetails.bloodGroup || undefined,
            emergencyContact: member.idCardDetails.emergencyContact || undefined,
          } : undefined,
          tenantName: tenant?.name
        }}
      />
      <div className="mt-12 text-center max-w-md text-muted-foreground">
        <p>This is your official community digital identification card. You can present this at any Ilaka event for verification.</p>
      </div>
    </div>
  )
}
