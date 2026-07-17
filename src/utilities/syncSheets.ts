import type { Payload } from 'payload'
import { parseCSV } from './csv'

const COLUMN_MAP: Record<string, string> = {
  'full name': 'fullName',
  'fullname': 'fullName',
  'name': 'fullName',
  'email': 'email',
  'member id': 'memberId',
  'id': 'memberId',
  'memberid': 'memberId',
  'phone': 'phoneNumber',
  'phone number': 'phoneNumber',
  'phonenumber': 'phoneNumber',
  'role': 'role',
  'status': 'status',
  'bio': 'bio',
  'twitter': 'socialLinks.twitter',
  'linkedin': 'socialLinks.linkedin',
  'website': 'socialLinks.website',
  'expiry date': 'expiryDate',
  'expiry': 'expiryDate',
  'expirydate': 'expiryDate',
  'joined date': 'joinedDate',
  'joined': 'joinedDate',
  'joineddate': 'joinedDate',
  'blood group': 'idCardDetails.bloodGroup',
  'blood': 'idCardDetails.bloodGroup',
  'bloodgroup': 'idCardDetails.bloodGroup',
  'emergency contact': 'idCardDetails.emergencyContact',
  'emergency': 'idCardDetails.emergencyContact',
  'emergencycontact': 'idCardDetails.emergencyContact',
}

function pickValue(record: Record<string, string>, key: string): string | undefined {
  const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const match = Object.entries(COLUMN_MAP).find(
    ([header]) => normalize(header) === normalize(key),
  )
  if (match) {
    const mapKey = match[0]
    const actualKey = Object.keys(record).find((k) => normalize(k) === normalize(mapKey))
    return actualKey ? record[actualKey] : record[key]
  }
  const fallbackKey = Object.keys(record).find((k) => normalize(k) === normalize(key))
  return fallbackKey ? record[fallbackKey] : record[key]
}

interface SyncResult {
  created: number
  updated: number
  skipped: number
  removed: number
  errors: string[]
}

export const syncMembersFromGoogleSheet = async (
  payload: Payload,
  sheetUrl: string,
  options?: {
    tenantId?: number | string
    selectedIndices?: number[]
    removeIndices?: number[]
  },
): Promise<SyncResult> => {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, removed: 0, errors: [] }
  let tenantId = options?.tenantId
  const selectedSet = options?.selectedIndices ? new Set(options.selectedIndices) : null
  const removeSet = options?.removeIndices ? new Set(options.removeIndices) : null

  try {
    if (!tenantId) {
      const firstTenant = await payload.find({
        collection: 'tenants',
        limit: 1,
        depth: 0,
      })
      if (firstTenant.docs.length > 0) {
        tenantId = firstTenant.docs[0]!.id as number | string
        payload.logger.info(`No tenant selected, defaulting to tenant ID: ${tenantId}`)
      }
    }
    const csvUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv')
    const response = await fetch(csvUrl)
    const csvText = await response.text()

    const records: Record<string, string>[] = parseCSV(csvText)
    payload.logger.info(`Fetched ${records.length} records from Google Sheet`)

    for (let idx = 0; idx < records.length; idx++) {
      const record = records[idx]!

      if (selectedSet && !selectedSet.has(idx)) {
        result.skipped++
        continue
      }

      try {
        const email = pickValue(record, 'email')
        if (!email) {
          result.skipped++
          continue
        }

        const memberId = pickValue(record, 'memberId') || ''

        let existingMember = null as any
        if (memberId) {
          existingMember = await payload.find({
            collection: 'members',
            where: { memberId: { equals: memberId } },
            limit: 1,
          }).then((res) => res.docs[0] as any)
        }
        if (!existingMember) {
          existingMember = await payload.find({
            collection: 'members',
            where: { email: { equals: email } },
            limit: 1,
          }).then((res) => res.docs[0] as any)
        }

        // Auto-link to user if a user exists with the same email
        let linkedUserId: number | string | undefined
        const matchingUser = await payload.find({
          collection: 'users',
          where: { email: { equals: email } },
          limit: 1,
          depth: 0,
        }).then((res) => res.docs[0] as any)
        if (matchingUser) {
          linkedUserId = matchingUser.id as number | string
        }

        if (removeSet?.has(idx)) {
          if (existingMember) {
            await payload.delete({ collection: 'members', id: existingMember.id })
            result.removed++
          } else {
            result.skipped++
          }
          continue
        }

        const fullName = pickValue(record, 'fullName') || ''
        const phoneNumber = pickValue(record, 'phoneNumber') || ''
        const status = pickValue(record, 'status') || 'active'
        const bio = pickValue(record, 'bio') || ''
        const expiryDate = pickValue(record, 'expiryDate') || undefined
        const joinedDate = pickValue(record, 'joinedDate') || undefined

        const twitter = pickValue(record, 'twitter') || ''
        const linkedin = pickValue(record, 'linkedin') || ''
        const website = pickValue(record, 'website') || ''

        const bloodGroup = pickValue(record, 'bloodGroup') || ''
        const emergencyContact = pickValue(record, 'emergencyContact') || ''

        const memberData: Record<string, unknown> = {
          fullName,
          email,
          memberId,
          phoneNumber,
          status,
          bio,
          socialLinks: { twitter, linkedin, website },
          idCardDetails: { bloodGroup, emergencyContact },
        }

        if (expiryDate) memberData.expiryDate = expiryDate
        if (joinedDate) memberData.joinedDate = joinedDate
        if (tenantId) memberData.tenant = tenantId
        if (linkedUserId) memberData.user = linkedUserId

        if (existingMember) {
          await payload.update({
            collection: 'members',
            id: existingMember.id,
            data: memberData as any,
          })
          result.updated++
        } else {
          await payload.create({
            collection: 'members',
            data: memberData as any,
          } as any)
          result.created++
        }
      } catch (err: any) {
        result.errors.push(`${record['Email'] || record['email'] || 'unknown'}: ${err.message}`)
      }
    }
  } catch (err: any) {
    payload.logger.error({ msg: 'Error syncing from Google Sheet:', err })
    throw err
  }

  return result
}
