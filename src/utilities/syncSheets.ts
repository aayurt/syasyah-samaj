import axios from 'axios'
import { parse } from 'csv-parse/sync'
import type { Payload } from 'payload'

export const syncMembersFromGoogleSheet = async (payload: Payload, sheetUrl: string) => {
  try {
    // Convert regular Google Sheet URL to CSV export URL
    const csvUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv')

    const response = await axios.get(csvUrl)
    const records = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
    })

    payload.logger.info(`Fetched ${records.length} records from Google Sheet`)

    for (const record of records as any[]) {
      const email = record['Email'] || record['email']
      const fullName = record['Full Name'] || record['Name'] || record['fullName']
      const memberId = record['Member ID'] || record['ID'] || record['memberId']
      const phoneNumber = record['Phone'] || record['Phone Number'] || record['phoneNumber']

      if (!email) continue

      // Find or create user
      let user = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
      }).then(res => res.docs[0])

      if (!user) {
        user = await payload.create({
          collection: 'users',
          data: {
            email,
            name: fullName,
            role: 'user',
            password: 'TemporaryPassword123!', // Users should reset this
          },
        })
      }

      // Find or create member
      const existingMember = await payload.find({
        collection: 'members',
        where: { email: { equals: email } },
        limit: 1,
      }).then(res => res.docs[0])

      if (existingMember) {
        await payload.update({
          collection: 'members',
          id: existingMember.id,
          data: {
            fullName,
            memberId,
            phoneNumber: phoneNumber || existingMember.phoneNumber,
            user: user.id,
          },
        })
      } else {
        await payload.create({
          collection: 'members',
          data: {
            fullName,
            email,
            memberId,
            phoneNumber: phoneNumber || 'N/A',
            user: user.id,
          },
        })
      }
    }

    return { success: true, count: records.length }
  } catch (error: any) {
    payload.logger.error({ msg: 'Error syncing from Google Sheet:', error })
    throw error
  }
}
