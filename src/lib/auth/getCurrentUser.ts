import { betterAuth } from 'better-auth'
import { betterAuthOptions } from './config'
import { headers } from 'next/headers'

export const getCurrentUser = async () => {
    const auth = betterAuth(betterAuthOptions)
    const session = await auth.api.getSession({
        headers: await headers()
    })
    return session?.user
}
