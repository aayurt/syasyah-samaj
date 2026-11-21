import {
  isBillingUser,
  resolveScopedTenant,
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig } from 'payload'
import { round2, toNum } from '@/utilities/journalValidation'
import { getBillingSettings } from '@/utilities/billingSettings'
import { assignTenant } from '@/utilities/tenantScope'

/**
 * Asset management (P4).
 *
 * A fixed asset is purchased (cost, purchase date), located somewhere, and
 * depreciated straight-line over a useful life down to a salvage value. The
 * depreciation engine posts journal entries against the depreciation expense
 * and accumulated-depreciation accounts from billing settings:
 *
 *   Dr. Depreciation Expense          X
 *       Cr. Accumulated Depreciation       X
 *
 * Depreciation is posted period-by-period through the `/depreciate` endpoint
 * (one journal entry per posting, straight-line monthly amount). The asset
 * keeps a schedule of depreciation postings (`depreciationRows`) so the
 * register can show cost, accumulated depreciation, and net book value.
 */

type DepreciationRow = {
  date: string
  amount: number
  journalEntry: number | string | { id: number | string } | null
}

function vErr(message: string): Error {
  return new Error(message)
}

/** Whole calendar months between two dates (asOf >= from). */
function wholeMonths(from: string, asOf: string): number {
  const a = new Date(from)
  const b = new Date(asOf)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (months < 0) months = 0
  return months
}

export const FixedAssets: CollectionConfig = {
  slug: 'fixed-assets',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['code', 'name', 'category', 'purchaseCost', 'location', 'status', 'updatedAt'],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  endpoints: [
    {
      // Asset register: cost, accumulated depreciation (from the posting
      // schedule), net book value, and depreciation-to-date per asset.
      path: '/register',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const where: any = {}
        if (tenant) where.tenant = { equals: tenant }
        const res = await req.payload.find({
          collection: 'fixed-assets',
          where,
          limit: 1000,
          depth: 0,
          sort: 'purchaseDate',
        })

        const docs = (res.docs as any[]).map((a) => {
          const rows: DepreciationRow[] = a.depreciationRows || []
          const accumulated = round2(
            rows.reduce((s, r) => s + toNum(r.amount), 0),
          )
          const cost = toNum(a.purchaseCost)
          const salvage = toNum(a.salvageValue)
          const bookValue = round2(cost - accumulated)
          const depreciableBase = Math.max(0, cost - salvage)
          return {
            id: a.id,
            code: a.code,
            name: a.name,
            category: a.category,
            location: a.location,
            status: a.status,
            purchaseDate: a.purchaseDate,
            purchaseCost: cost,
            salvageValue: salvage,
            usefulLifeYears: toNum(a.usefulLifeYears),
            accumulatedDepreciation: accumulated,
            netBookValue: bookValue,
            depreciatedPct:
              depreciableBase > 0
                ? round2((accumulated / depreciableBase) * 100)
                : 0,
          }
        })

        const totalCost = round2(docs.reduce((t, r) => t + r.purchaseCost, 0))
        const totalAccumulated = round2(
          docs.reduce((t, r) => t + r.accumulatedDepreciation, 0),
        )
        const totalBook = round2(docs.reduce((t, r) => t + r.netBookValue, 0))
        return Response.json({
          docs,
          totals: {
            cost: totalCost,
            accumulatedDepreciation: totalAccumulated,
            netBookValue: totalBook,
          },
        })
      },
    },
    {
      // Post depreciation for the next period(s) of an asset.
      //
      // Straight-line: monthly = (cost − salvage) / (useful life in months).
      // Depreciates from the last posted period (or purchase date) up to
      // `asOf` (defaults to today) and posts one journal entry per elapsed
      // month, capped so accumulated depreciation never exceeds the
      // depreciable base.
      path: '/:id/depreciate',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing asset id' }, { status: 400 })
        }
        const asset = (await req.payload.findByID({
          collection: 'fixed-assets',
          id,
          depth: 0,
        })) as any
        if (!asset) {
          return Response.json({ error: 'Asset not found' }, { status: 404 })
        }
        const settings = await getBillingSettings(req.payload)
        const depreciationAccount = settings?.depreciationAccount
        const accumulatedAccount = settings?.accumulatedDepreciationAccount
        if (!depreciationAccount || !accumulatedAccount) {
          return Response.json(
            {
              error:
                'Depreciation accounts are not configured. Set Depreciation Expense and Accumulated Depreciation in Billing Settings.',
            },
            { status: 409 },
          )
        }

        let asOf = new Date().toISOString().slice(0, 10)
        try {
          const body = (await req.json!()) as any
          if (body?.asOf) asOf = String(body.asOf).slice(0, 10)
        } catch {
          // no body — depreciate to today
        }

        const rows: DepreciationRow[] = asset.depreciationRows || []
        const alreadyDepreciated = round2(
          rows.reduce((s, r) => s + toNum(r.amount), 0),
        )
        const cost = toNum(asset.purchaseCost)
        const salvage = toNum(asset.salvageValue)
        const lifeYears = toNum(asset.usefulLifeYears)
        const depreciableBase = Math.max(0, cost - salvage)
        if (lifeYears <= 0) {
          return Response.json(
            { error: 'Asset has no useful life (usefulLifeYears must be > 0).' },
            { status: 409 },
          )
        }
        const monthly =
          depreciableBase === 0
            ? 0
            : round2(depreciableBase / (lifeYears * 12))

        // From the last posted period (or purchase date) to asOf.
        const lastPosted = rows[rows.length - 1]?.date
        const from =
          lastPosted || (asset.purchaseDate ? String(asset.purchaseDate).slice(0, 10) : asOf)
        const months = wholeMonths(from, asOf)
        if (months <= 0 || monthly <= 0) {
          return Response.json(
            { error: 'Nothing to depreciate for this period.' },
            { status: 409 },
          )
        }
        // Cap at the remaining depreciable base.
        const remaining = Math.max(0, round2(depreciableBase - alreadyDepreciated))
        const allowed = Math.min(months, Math.ceil(remaining / monthly))
        if (allowed <= 0) {
          return Response.json(
            { error: 'Asset is fully depreciated.' },
            { status: 409 },
          )
        }

        const transactionID =
          (await req.payload.db.beginTransaction()) ?? undefined
        try {
          const created: any[] = []
          for (let i = 0; i < allowed; i++) {
            const periodDate = new Date(from)
            periodDate.setMonth(periodDate.getMonth() + i + 1)
            const date = periodDate.toISOString().slice(0, 10)
            const amount = round2(monthly)
            const periodNarration = `Depreciation — ${asset.name} (${String(date).slice(0, 7)})`
            const entry = await req.payload.create({
              collection: 'journal-entries',
              data: {
                date,
                narration: periodNarration,
                status: 'posted',
                lines: [
                  { account: depreciationAccount, debit: amount },
                  { account: accumulatedAccount, credit: amount },
                ],
                tenant: asset.tenant,
              },
              req: { transactionID },
            })
            created.push({ date, amount, journalEntry: entry.id })
          }

          const updated = await req.payload.update({
            collection: 'fixed-assets',
            id: asset.id,
            data: { depreciationRows: [...rows, ...created] },
            req: { transactionID },
          })

          if (transactionID) {
            await req.payload.db.commitTransaction(transactionID)
          }

          const nowAccumulated = round2(
            alreadyDepreciated + created.reduce((s, c) => s + c.amount, 0),
          )
          return Response.json({
            assetId: asset.id,
            postings: created.length,
            entries: created.map((c) => c.journalEntry),
            totalAmount: round2(created.reduce((s, c) => s + c.amount, 0)),
            accumulatedDepreciation: nowAccumulated,
            netBookValue: round2(cost - nowAccumulated),
            updated,
          })
        } catch (err) {
          if (transactionID) {
            await req.payload.db.rollbackTransaction(transactionID)
          }
          const message = err instanceof Error ? err.message : 'Depreciation failed'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
    {
      // Batch depreciation run: posts one journal entry per eligible asset
      // for elapsed periods since its last depreciation posting.
      // Request body: { asOf?: string, dryRun?: boolean }
      path: '/depreciation-run',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        let asOf = new Date().toISOString().slice(0, 10)
        let dryRun = false
        try {
          const body = (await req.json!()) as any
          if (body?.asOf) asOf = String(body.asOf).slice(0, 10)
          if (body?.dryRun !== undefined) dryRun = Boolean(body.dryRun)
        } catch {
          // no body
        }

        const where: any = { status: { equals: 'active' } }
        if (tenant) where.tenant = { equals: tenant }
        const res = await req.payload.find({
          collection: 'fixed-assets',
          where,
          limit: 1000,
          depth: 0,
          sort: 'purchaseDate',
        })

        const settings = await getBillingSettings(req.payload)
        const depreciationAccount = settings?.depreciationAccount
        const accumulatedAccount = settings?.accumulatedDepreciationAccount
        if (!depreciationAccount || !accumulatedAccount) {
          return Response.json(
            { error: 'Depreciation accounts not configured in Billing Settings.' },
            { status: 409 },
          )
        }

        const results: any[] = []
        const transactionID = dryRun ? undefined : (await req.payload.db.beginTransaction()) ?? undefined

        try {
          for (const asset of (res.docs as any[])) {
            const cost = toNum(asset.purchaseCost)
            const salvage = toNum(asset.salvageValue)
            const lifeYears = toNum(asset.usefulLifeYears)
            if (lifeYears <= 0 || cost <= 0) continue

            const rows: DepreciationRow[] = asset.depreciationRows || []
            const alreadyDepreciated = round2(rows.reduce((s, r) => s + toNum(r.amount), 0))
            const depreciableBase = Math.max(0, cost - salvage)
            const remaining = Math.max(0, round2(depreciableBase - alreadyDepreciated))
            if (remaining <= 0) continue

            const monthly = round2(depreciableBase / (lifeYears * 12))
            if (monthly <= 0) continue

            const lastPosted = rows[rows.length - 1]?.date
            const from = lastPosted || (asset.purchaseDate ? String(asset.purchaseDate).slice(0, 10) : asOf)
            const months = wholeMonths(from, asOf)
            if (months <= 0) continue

            const allowed = Math.min(months, Math.ceil(remaining / monthly))
            if (allowed <= 0) continue

            const totalAmount = round2(monthly * allowed)
            const created: any[] = []

            if (!dryRun) {
              for (let i = 0; i < allowed; i++) {
                const periodDate = new Date(from)
                periodDate.setMonth(periodDate.getMonth() + i + 1)
                const date = periodDate.toISOString().slice(0, 10)
                const entry = await req.payload.create({
                  collection: 'journal-entries',
                  data: {
                    date,
                    narration: `Depreciation — ${asset.name} (${String(date).slice(0, 7)})`,
                    status: 'posted',
                    lines: [
                      { account: depreciationAccount, debit: monthly },
                      { account: accumulatedAccount, credit: monthly },
                    ],
                    tenant: asset.tenant,
                  },
                  req: { transactionID },
                })
                created.push({ date, amount: monthly, journalEntry: entry.id })
              }

              await req.payload.update({
                collection: 'fixed-assets',
                id: asset.id,
                data: { depreciationRows: [...rows, ...created] },
                req: { transactionID },
              })
            }

            results.push({
              assetId: asset.id,
              name: asset.name,
              code: asset.code,
              category: asset.category,
              postings: allowed,
              totalAmount,
              monthly,
              from,
              to: asOf,
            })
          }

          if (transactionID) {
            await req.payload.db.commitTransaction(transactionID)
          }

          return Response.json({
            dryRun,
            asOf,
            processed: results.length,
            totalAmount: round2(results.reduce((s, r) => s + r.totalAmount, 0)),
            results,
          })
        } catch (err) {
          if (transactionID) {
            await req.payload.db.rollbackTransaction(transactionID)
          }
          const message = err instanceof Error ? err.message : 'Depreciation run failed'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
    {
      // Asset disposal: calculate depreciation up to disposal date, compute
      // NBV and gain/loss, post compound journal entry, mark asset disposed.
      // Request body: { disposalDate: string, disposalType: 'sale' | 'retirement' | 'write_off' | 'donation',
      //   proceeds: number, proceedsAccount?: number, remarks?: string }
      path: '/:id/dispose',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing asset id' }, { status: 400 })
        }
        const asset = (await req.payload.findByID({
          collection: 'fixed-assets',
          id,
          depth: 0,
        })) as any
        if (!asset) {
          return Response.json({ error: 'Asset not found' }, { status: 404 })
        }
        if (asset.status === 'disposed') {
          return Response.json({ error: 'Asset is already disposed.' }, { status: 409 })
        }

        let disposalDate = new Date().toISOString().slice(0, 10)
        let disposalType = 'sale'
        let proceeds = 0
        let proceedsAccount: number | string | null = null
        let remarks = ''
        try {
          const body = (await req.json!()) as any
          if (body?.disposalDate) disposalDate = String(body.disposalDate).slice(0, 10)
          if (body?.disposalType) disposalType = String(body.disposalType)
          if (body?.proceeds != null) proceeds = Number(body.proceeds) || 0
          if (body?.proceedsAccount != null) proceedsAccount = body.proceedsAccount
          if (body?.remarks) remarks = String(body.remarks)
        } catch {
          // no body
        }

        const settings = await getBillingSettings(req.payload)
        const costAccount = settings?.fixedAssetCostAccount
        const accumulatedAccount = settings?.accumulatedDepreciationAccount
        const gainLossAccount = settings?.disposalGainLossAccount
        if (!costAccount || !accumulatedAccount || !gainLossAccount) {
          return Response.json(
            {
              error:
                'Fixed asset disposal accounts not configured. Set Fixed Asset at Cost, Accumulated Depreciation, and Gain/Loss on Disposal in Billing Settings.',
            },
            { status: 409 },
          )
        }

        const cost = toNum(asset.purchaseCost)
        const salvage = toNum(asset.salvageValue)
        const rows: DepreciationRow[] = asset.depreciationRows || []
        const accumulated = round2(rows.reduce((s, r) => s + toNum(r.amount), 0))
        const nbv = round2(cost - accumulated)
        const gainLoss = round2(proceeds - nbv)

        const transactionID = (await req.payload.db.beginTransaction()) ?? undefined
        try {
          // Post depreciation up to disposal date (straight-line, remaining months).
          const lifeYears = toNum(asset.usefulLifeYears)
          let depreciationPosted = 0
          if (lifeYears > 0) {
            const depreciableBase = Math.max(0, cost - salvage)
            const monthly = depreciableBase === 0 ? 0 : round2(depreciableBase / (lifeYears * 12))
            const remaining = Math.max(0, round2(depreciableBase - accumulated))
            const lastPosted = rows[rows.length - 1]?.date
            const from = lastPosted || (asset.purchaseDate ? String(asset.purchaseDate).slice(0, 10) : disposalDate)
            const months = wholeMonths(from, disposalDate)
            const allowed = months > 0 ? Math.min(months, Math.ceil(remaining / monthly)) : 0
            if (allowed > 0 && monthly > 0) {
              const created: any[] = []
              for (let i = 0; i < allowed; i++) {
                const periodDate = new Date(from)
                periodDate.setMonth(periodDate.getMonth() + i + 1)
                const date = periodDate.toISOString().slice(0, 10)
                if (date > disposalDate) break
                const entry = await req.payload.create({
                  collection: 'journal-entries',
                  data: {
                    date,
                    narration: `Depreciation — ${asset.name} (${String(date).slice(0, 7)})`,
                    status: 'posted',
                    lines: [
                      { account: settings?.depreciationAccount, debit: monthly },
                      { account: accumulatedAccount, credit: monthly },
                    ],
                    tenant: asset.tenant,
                  },
                  req: { transactionID },
                })
                created.push({ date, amount: monthly, journalEntry: entry.id })
                depreciationPosted += monthly
              }
              await req.payload.update({
                collection: 'fixed-assets',
                id: asset.id,
                data: { depreciationRows: [...rows, ...created] },
                req: { transactionID },
              })
            }
          }

          const finalAccumulated = round2(accumulated + depreciationPosted)
          const finalNbv = round2(cost - finalAccumulated)
          const finalGainLoss = round2(proceeds - finalNbv)

          // Compound disposal journal entry:
          // Dr. Proceeds Account      proceeds
          // Dr. Accumulated Depreciation  finalAccumulated
          //   Cr. Fixed Asset at Cost       cost
          //   Cr./Dr. Gain/Loss on Disposal  finalGainLoss (positive = credit gain, negative = debit loss)
          const lines: any[] = []
          if (proceeds > 0 && proceedsAccount) {
            lines.push({ account: proceedsAccount, debit: proceeds })
          }
          if (finalAccumulated > 0) {
            lines.push({ account: accumulatedAccount, debit: finalAccumulated })
          }
          lines.push({ account: costAccount, credit: cost })
          if (finalGainLoss > 0) {
            lines.push({ account: gainLossAccount, credit: finalGainLoss })
          } else if (finalGainLoss < 0) {
            lines.push({ account: gainLossAccount, debit: Math.abs(finalGainLoss) })
          }

          const entry = await req.payload.create({
            collection: 'journal-entries',
            data: {
              date: disposalDate,
              narration: `Disposal — ${asset.name} (${disposalType})${remarks ? ': ' + remarks : ''}`,
              status: 'posted',
              lines,
              tenant: asset.tenant,
            },
            req: { transactionID },
          })

          await req.payload.update({
            collection: 'fixed-assets',
            id: asset.id,
            data: { status: 'disposed' },
            req: { transactionID },
          })

          await req.payload.db.commitTransaction(transactionID)

          return Response.json({
            assetId: asset.id,
            disposalDate,
            disposalType,
            proceeds,
            cost,
            accumulatedDepreciation: finalAccumulated,
            netBookValue: finalNbv,
            gainLoss: finalGainLoss,
            journalEntry: entry.id,
          })
        } catch (err) {
          await req.payload.db.rollbackTransaction(transactionID)
          const message = err instanceof Error ? err.message : 'Disposal failed'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
  ],
  hooks: {
    beforeValidate: [
      assignTenant,
      ({ data }) => {
        const d = data as any
        const cost = toNum(d.purchaseCost)
        const salvage = toNum(d.salvageValue)
        if (cost < 0) {
          throw new Error('Purchase cost cannot be negative.')
        }
        if (salvage < 0) {
          throw new Error('Salvage value cannot be negative.')
        }
        if (salvage > cost) {
          throw new Error('Salvage value cannot exceed the purchase cost.')
        }
        const life = toNum(d.usefulLifeYears)
        if (life < 0) {
          throw new Error('Useful life cannot be negative.')
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      admin: {
        description: 'Asset code / tag number.',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Asset name (e.g. "Projector — Hall A").',
      },
    },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'other',
      options: [
        { label: 'Vehicle', value: 'vehicle' },
        { label: 'Equipment', value: 'equipment' },
        { label: 'Furniture', value: 'furniture' },
        { label: 'Computer', value: 'computer' },
        { label: 'Building', value: 'building' },
        { label: 'Land', value: 'land' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Asset category (drives reporting).',
      },
    },
    {
      name: 'purchaseDate',
      type: 'date',
      admin: {
        description: 'Date the asset was acquired. Depreciation starts the following month.',
        position: 'sidebar',
      },
    },
    {
      name: 'purchaseCost',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Purchase / acquisition cost.',
        position: 'sidebar',
      },
    },
    {
      name: 'salvageValue',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Estimated residual value at end of useful life.',
        position: 'sidebar',
      },
    },
    {
      name: 'usefulLifeYears',
      type: 'number',
      required: true,
      defaultValue: 5,
      admin: {
        description: 'Straight-line useful life in years.',
        position: 'sidebar',
      },
    },
    {
      name: 'location',
      type: 'text',
      admin: {
        description: 'Where the asset is kept.',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Disposed', value: 'disposed' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'depreciationRows',
      type: 'array',
      labels: {
        singular: 'Depreciation posting',
        plural: 'Depreciation postings',
      },
      admin: {
        description: 'Journal entries posted by the depreciation engine (read-only).',
        readOnly: true,
      },
      fields: [
        {
          name: 'date',
          type: 'date',
          required: true,
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
        },
        {
          name: 'journalEntry',
          type: 'relationship',
          relationTo: 'journal-entries',
        },
      ],
    },
    // Illaka scoping — required; auto-assigned from the user's illaka (or C00).
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}