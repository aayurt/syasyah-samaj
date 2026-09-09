'use client'

import React from 'react'
import { motion, type MotionProps } from 'framer-motion'
import { MapPin, Phone, Mail, Droplet, User as UserIcon } from 'lucide-react'

// framer-motion@11.11.17 builds motion.div's prop types from React's `ReactHTML` /
// `DetailedHTMLFactory`, which are no longer exported by @types/react@19. Under
// skipLibCheck the broken import silently degrades and `motion.div` only accepts
// MotionProps (no className). Re-attach the standard div attributes until the
// framer-motion / @types/react pair is aligned.
type MotionDivProps = MotionProps & React.HTMLAttributes<HTMLDivElement>
const MotionDiv = motion.div as unknown as React.FC<MotionDivProps>

interface DigitalIDCardProps {
  member: {
    fullName: string
    memberId?: string
    email: string
    phoneNumber?: string
    profileImage?: any
    idCardDetails?: {
      bloodGroup?: string
      emergencyContact?: string
    }
    tenantName?: string
    membershipType?: {
      name: string
      fee: number
    }
    renewalDate?: string
    paymentStatus?: string
  }
  issuedDate?: string
  validUntil?: string
}

export const DigitalIDCard: React.FC<DigitalIDCardProps> = ({ member, issuedDate, validUntil }) => {
  const getMembershipInfo = () => {
    if (!member.membershipType) return null
    return (
      <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-md">
        <div className="text-sm font-medium text-primary">
          {member.membershipType.name} Membership
        </div>
        <div className="text-xs text-primary/80">
          Annual Fee: NRs {member.membershipType.fee} | 
          Valid Until: {member.renewalDate || 'Lifetime'}
        </div>
      </div>
    )
  }

  const getPaymentStatusBadge = () => {
    if (!member.paymentStatus) return null
    const statusColors: any = {
      paid: 'bg-success/20 text-success',
      unpaid: 'bg-error/20 text-error',
      overdue: 'bg-warning/20 text-warning',
    }
    const colors = statusColors[member.paymentStatus] || 'bg-gray-100 text-gray-800'
    return (
      <span className={colors + ' text-sm px-2 py-1 rounded'}>
        {member.paymentStatus}
      </span>
    )
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.9, rotateY: -15 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, rotateY: 5 }}
      className="relative w-full max-w-md aspect-[1.586/1] bg-gradient-to-br from-primary via-secondary to-primary rounded-2xl shadow-2xl overflow-hidden text-white p-6 flex flex-col justify-between border border-white/20"
    >
      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/20 rounded-full -ml-16 -mb-16 blur-2xl" />

      <div className="relative z-10 flex justify-between items-start">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight">{member.tenantName || 'Syasyah Samaj'}</h2>
          <span className="text-xs font-medium text-white/70 uppercase tracking-widest">Community Member</span>
        </div>
        <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/30 rounded-xl overflow-hidden flex items-center justify-center">
            {member.profileImage?.url ? (
                <img src={member.profileImage.url} alt={member.fullName} className="w-full h-full object-cover" />
            ) : (
                <UserIcon className="w-8 h-8 text-white/50" />
            )}
        </div>
      </div>

      <div className="relative z-10 mt-4">
        <div className="text-3xl font-black uppercase tracking-tighter mb-1">{member.fullName}</div>
        <div className="text-sm font-mono text-white/80">ID: {member.memberId || 'SY-XXXXXX'}</div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-4 mt-4 text-xs font-medium">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-white/60" />
          <span>{member.phoneNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-white/60" />
          <span className="truncate">{member.email}</span>
        </div>
        {member.idCardDetails?.bloodGroup && (
          <div className="flex items-center gap-2">
            <Droplet className="w-3.5 h-3.5 text-red-400" />
            <span>Blood Group: {member.idCardDetails.bloodGroup}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-white/60" />
          <span>{member.tenantName || 'Main Ilaka'}</span>
        </div>
      </div>

      {/* Membership Info Section */}
      {getMembershipInfo()}

      {/* Payment Status Badge */}
      {getPaymentStatusBadge()}

      <div className="relative z-10 mt-6 flex justify-between items-end border-t border-white/10 pt-4">
        <div className="flex flex-col">
          <span className="text-[10px] text-white/50 uppercase">Issued Date</span>
          <span className="text-xs">{issuedDate || 'Jan 2024'}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[10px] text-white/50 uppercase">Valid Until</span>
          <span className="text-xs font-bold text-warning">{validUntil || member.renewalDate || 'Lifetime'}</span>
        </div>
      </div>
    </MotionDiv>
  )
}