'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MapPin, Phone, Mail, Droplet, User as UserIcon } from 'lucide-react'

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
}

export const DigitalIDCard: React.FC<DigitalIDCardProps> = ({ member }) => {
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
      paid: 'bg-green-100 text-green-800',
      unpaid: 'bg-red-100 text-red-800',
      overdue: 'bg-orange-100 text-orange-800',
    }
    const colors = statusColors[member.paymentStatus] || 'bg-gray-100 text-gray-800'
    return (
      <span className={colors + ' text-sm px-2 py-1 rounded'}>
        {member.paymentStatus}
      </span>
    )
  }

  return (
    <motion.div
      {...({
        initial: { opacity: 0, scale: 0.9, rotateY: -15 },
        animate: { opacity: 1, scale: 1, rotateY: 0 },
        transition: { duration: 0.8, ease: 'easeOut' },
        whileHover: { scale: 1.02, rotateY: 5 },
        className: "border border-white/20 rounded-xl p-4 bg-gray-900/50 backdrop-blur-md min-h-[280px] flex flex-col justify-between"
      } as any)}
    >
      {/* Background patterns - subtle, removed absolute positions for better responsiveness */}
      <div className="mt-2 h-6 w-6 rounded-full bg-white/5 -ml-2 -mt-2 blur-sm" aria-hidden="true" />

      <div className="flex flex-col h-full">
        <div className="relative z-10 flex justify-between items-start">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold tracking-tight">{member.tenantName || 'Syasyah Samaj'}</h2>
            <span className="text-xs font-medium text-white/70 uppercase tracking-widest">Community Member</span>
          </div>
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center">
              {member.profileImage?.url ? (
                  <img src={member.profileImage.url} alt={member.fullName} className="w-full h-full object-cover" />
              ) : (
                  <UserIcon className="w-6 h-6 text-white/50" />
              )}
          </div>
        </div>

        <div className="relative z-10 mt-4 flex-1">
          <div className="text-2xl font-black uppercase tracking-tighter mb-1">{member.fullName}</div>
          <div className="text-sm font-mono text-white/80">ID: {member.memberId || 'SY-XXXXXX'}</div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3 mt-4 text-xs font-medium flex-1">
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-white/60" aria-hidden="true" />
            <span>{member.phoneNumber}</span>
          </div>
          <div className="flex items-center gap-1">
            <Mail className="w-3 h-3 text-white/60" aria-hidden="true" />
            <span className="truncate">{member.email}</span>
          </div>
          {member.idCardDetails?.bloodGroup && (
            <div className="flex items-center gap-1">
              <Droplet className="w-3 h-3 text-red-400" aria-hidden="true" />
              <span>Blood Group: {member.idCardDetails.bloodGroup}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-white/60" aria-hidden="true" />
            <span>{member.tenantName || 'Main Ilaka'}</span>
          </div>
        </div>

        {/* Membership Info Section */}
        {getMembershipInfo()}

        {/* Payment Status Badge */}
        {getPaymentStatusBadge()}

        <div className="relative z-10 mt-4 flex justify-between items-end border-t border-white/10 pt-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50 uppercase">Issued Date</span>
            <span className="text-xs">Jan 2024</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-white/50 uppercase">Valid Until</span>
            <span className="text-xs font-bold text-yellow-400">Lifetime</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}