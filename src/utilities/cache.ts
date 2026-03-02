import { redis } from '@/payload.config'
import type { Payload } from 'payload'
import type { Event } from '@/payload-types'

const DEFAULT_EXPIRATION = 3600 // 1 hour

export const getCachedEvents = async (payload: Payload): Promise<Event[]> => {
    const cacheKey = 'events:list'

    try {
        const cachedData = await redis.get(cacheKey)

        if (cachedData) {
            return JSON.parse(cachedData)
        }
    } catch (err) {
        console.error('Redis GET error (events:list):', err)
    }

    const events = await payload.find({
        collection: 'events',
        limit: 1000,
        pagination: false,
    })

    try {
        await redis.set(cacheKey, JSON.stringify(events.docs), 'EX', DEFAULT_EXPIRATION)
    } catch (err) {
        console.error('Redis SET error (events:list):', err)
    }

    return events.docs
}

export const getCachedEvent = async (
    payload: Payload,
    id: string | number,
): Promise<Event | null> => {
    const cacheKey = `events:${id}`

    try {
        const cachedData = await redis.get(cacheKey)
        if (cachedData) {
            return JSON.parse(cachedData)
        }
    } catch (err) {
        console.error(`Redis GET error (${cacheKey}):`, err)
    }

    const event = await payload.findByID({
        collection: 'events',
        id: id as any,
    })

    if (event) {
        try {
            await redis.set(cacheKey, JSON.stringify(event), 'EX', DEFAULT_EXPIRATION)
        } catch (err) {
            console.error(`Redis SET error (${cacheKey}):`, err)
        }
    }

    return event
}

export const invalidateEventsCache = async (id?: string | number) => {
    try {
        const keys = ['events:list']
        if (id) {
            keys.push(`events:${id}`)
        }
        await redis.del(...keys)
    } catch (err) {
        console.error('Redis DEL error (events):', err)
    }
}
