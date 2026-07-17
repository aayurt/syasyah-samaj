import { getPayload } from 'payload'
import config from '@payload-config'

const tenantIds = [3, 4, 5, 6, 8] // Ilaka 1 through Ilaka 5

const members = [
  {
    fullName: 'Asmita Sharma',
    email: 'asmita.sharma@example.com',
    phoneNumber: '9841234567',
    role: 'admin',
    status: 'active',
    bio: 'Community organizer and cultural event coordinator',
    idCardDetails: { bloodGroup: 'O+', emergencyContact: '9851234567' },
    memberId: 'MEM-001',
    socialLinks: { twitter: '@asmitasharma', linkedin: 'asmitasharma' },
    tenant: tenantIds[0],
  },
  {
    fullName: 'Rajan Thapa',
    email: 'rajan.thapa@example.com',
    phoneNumber: '9842345678',
    role: 'moderator',
    status: 'active',
    bio: 'Digital content manager and social media lead',
    idCardDetails: { bloodGroup: 'A+', emergencyContact: '9852345678' },
    memberId: 'MEM-002',
    socialLinks: { twitter: '@rajanthapa', website: 'rajanthapa.com.np' },
    tenant: tenantIds[1],
  },
  {
    fullName: 'Sita Gurung',
    email: 'sita.gurung@example.com',
    phoneNumber: '9843456789',
    role: 'vip',
    status: 'active',
    bio: 'Community elder and cultural preservation advocate',
    idCardDetails: { bloodGroup: 'B+', emergencyContact: '9853456789' },
    memberId: 'MEM-003',
    socialLinks: { linkedin: 'sitagurung' },
    tenant: tenantIds[2],
  },
  {
    fullName: 'Prakash Adhikari',
    email: 'prakash.adhikari@example.com',
    phoneNumber: '9844567890',
    role: 'member',
    status: 'active',
    bio: 'Volunteer and event photographer',
    idCardDetails: { bloodGroup: 'AB+', emergencyContact: '9854567890' },
    memberId: 'MEM-004',
    tenant: tenantIds[3],
  },
  {
    fullName: 'Maya Rai',
    email: 'maya.rai@example.com',
    phoneNumber: '9845678901',
    role: 'member',
    status: 'inactive',
    bio: 'Former committee member, currently on leave',
    idCardDetails: { bloodGroup: 'O-', emergencyContact: '9855678901' },
    memberId: 'MEM-005',
    socialLinks: { twitter: '@mayarai' },
    tenant: tenantIds[4],
  },
]

async function main() {
  const payload = await getPayload({ config })

  for (const m of members) {
    try {
      const created = await payload.create({
        collection: 'members',
        data: m,
      })
      console.log(`✅ ${created.fullName} (${created.memberId})`)
    } catch (e) {
      console.error(`❌ ${m.fullName}: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.log('\nDone.')
  process.exit(0)
}

main()
