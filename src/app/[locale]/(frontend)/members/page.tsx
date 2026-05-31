import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Media } from '@/components/Media'
import Link from 'next/link'
import { User as UserIcon, Search } from 'lucide-react'

export default async function MembersDirectory() {
  const payload = await getPayload({ config })

  const members = await payload.find({
    collection: 'members',
    limit: 100,
  })

  return (
    <div className="container mx-auto py-20 px-4">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-16">
        <div className="max-w-2xl">
            <h1 className="text-5xl font-black tracking-tight mb-4">Member Directory</h1>
            <p className="text-xl text-muted-foreground">Find and connect with fellow community members from all Ilakas.</p>
        </div>
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
                type="text"
                placeholder="Search members..."
                className="w-full pl-10 pr-4 py-2 rounded-full border bg-muted/50 focus:bg-background transition-all outline-none focus:ring-2 ring-primary/20"
            />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {members.docs.map((member: any) => (
          <Link href={`/members/${member.id}`} key={member.id} className="group p-6 rounded-3xl border bg-card hover:border-primary transition-all duration-300 hover:shadow-xl text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full overflow-hidden border-4 border-muted group-hover:border-primary/20 transition-all duration-500 relative">
              {member.profileImage?.url ? (
                <img src={member.profileImage.url} alt={member.fullName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                    <UserIcon className="w-10 h-10" />
                </div>
              )}
            </div>
            <h3 className="text-xl font-bold mb-1">{member.fullName}</h3>
            <p className="text-sm text-muted-foreground mb-4">{member.role}</p>
            <div className="text-xs px-3 py-1 bg-muted rounded-full inline-block text-muted-foreground font-medium">
                ID: {member.memberId || 'SY-NEW'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
