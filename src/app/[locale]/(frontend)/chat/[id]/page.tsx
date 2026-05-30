import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound, redirect } from 'next/navigation'
import { ChatInterface } from '@/components/ChatInterface'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export default async function ChatRoomPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsPromise
  const payload = await getPayload({ config })
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const chatRoom = await payload.findByID({
    collection: 'chat-rooms',
    id,
  })

  if (!chatRoom) {
    return notFound()
  }

  const messagesRes = await payload.find({
    collection: 'messages',
    where: {
      chatRoom: { equals: id }
    },
    sort: 'createdAt',
    limit: 100,
  })

  return (
    <div className="container mx-auto py-20 px-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black mb-2">{chatRoom.name}</h1>
        <p className="text-muted-foreground">Welcome to the community chat for your Ilaka.</p>
      </div>

      <ChatInterface
        chatRoomId={id}
        initialMessages={messagesRes.docs.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            sender: {
                id: typeof msg.sender === 'object' ? msg.sender.id : msg.sender,
                name: typeof msg.sender === 'object' ? msg.sender.name : 'Unknown User'
            },
            createdAt: msg.createdAt
        }))}
        currentUser={{
            id: user.id,
            name: user.name
        }}
      />
    </div>
  )
}
