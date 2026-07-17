const BASE = 'http://localhost:3000/api'

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
  },
]

async function main() {
  // First get an auth token by logging in
  const loginRes = await fetch(`${BASE}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
    }),
  })

  if (!loginRes.ok) {
    const text = await loginRes.text()
    console.error('Login failed:', text)
    // Try API key approach instead
    return
  }

  const { token } = await loginRes.json()
  console.log('Logged in, got token')

  for (const m of members) {
    try {
      const res = await fetch(`${BASE}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(m),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error(`❌ ${m.fullName}: ${err}`)
      } else {
        const created = await res.json()
        console.log(`✅ ${created.doc.fullName} (${created.doc.memberId})`)
      }
    } catch (e) {
      console.error(`❌ ${m.fullName}: ${e.message}`)
    }
  }
}

main().catch(console.error)
