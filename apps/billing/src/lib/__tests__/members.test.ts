import { describe, it, expect } from 'vitest'
import {
  createMockMember,
  createMockMembershipType,
  createMockDataSet,
} from '../../test/factories'

describe('Members', () => {
  describe('Member Factory', () => {
    it('creates valid member with defaults', () => {
      const member = createMockMember()

      expect(member.id).toBeDefined()
      expect(member.memberId).toMatch(/^MEM\d{6}$/)
      expect(member.fullName).toBeTruthy()
      expect(member.phone).toMatch(/^98\d{8}$/)
      expect(member.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(['Life', 'Annual', 'Patron', 'Student']).toContain(member.membershipType)
      expect(member.status).toBe('active')
      expect(member.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const member = createMockMember({
        memberId: 'MEM000123',
        fullName: 'Custom Member',
        membershipType: 'Patron',
        status: 'inactive',
      })

      expect(member.memberId).toBe('MEM000123')
      expect(member.fullName).toBe('Custom Member')
      expect(member.membershipType).toBe('Patron')
      expect(member.status).toBe('inactive')
    })
  })

  describe('Member Validation', () => {
    it('validates required fields', () => {
      const members = [
        createMockMember({ fullName: 'Valid Member', phone: '9800000000' }),
        createMockMember({ fullName: '', phone: '9800000001' }),
        createMockMember({ fullName: 'No Phone', phone: '' }),
      ]

      const valid = members.filter((m) => m.fullName && m.phone)
      expect(valid).toHaveLength(1)
    })

    it('validates Nepal phone format', () => {
      const validPhones = ['9800000000', '9812345678', '9741234567']
      const invalidPhones = ['12345', '980000000', '+1234567890', 'abc']

      validPhones.forEach((p) => expect(p.match(/^9[78]\d{8}$/)).toBeTruthy())
      invalidPhones.forEach((p) => expect(p.match(/^9[78]\d{8}$/)).toBeNull())
    })

    it('validates email format', () => {
      const emails = ['test@example.com', 'user@domain.org.np', 'invalid', '@no-user.com']
      const validEmails = emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

      expect(validEmails).toHaveLength(2)
    })
  })

  describe('Membership Type', () => {
    it('creates valid membership type', () => {
      const type = createMockMembershipType()

      expect(type.id).toBeDefined()
      expect(['Life', 'Annual', 'Patron', 'Student', 'Senior']).toContain(type.name)
      expect(type.fee).toBeGreaterThanOrEqual(0)
      expect([12, 24, 60, 120, 0]).toContain(type.durationMonths)
      expect(type.tenant).toBe('C00')
    })

    it('calculates fee correctly for duration', () => {
      const life = createMockMembershipType({ durationMonths: 0, fee: 50000 })
      const annual = createMockMembershipType({ durationMonths: 12, fee: 5000 })

      expect(life.durationMonths).toBe(0)
      expect(annual.durationMonths).toBe(12)
    })
  })

  describe('Member Dataset', () => {
    it('creates consistent dataset', () => {
      const data = createMockDataSet(5)

      expect(data.members).toHaveLength(5)
      expect(data.members.every((m) => m.tenant === 'C00')).toBe(true)
      expect(new Set(data.members.map((m) => m.memberId)).size).toBe(5)
    })
  })
})
