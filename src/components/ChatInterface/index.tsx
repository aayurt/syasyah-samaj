'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, User as UserIcon, MessageCircle } from 'lucide-react'

interface Message {
  id: string
  content: string
  sender: {
    id: string
    name?: string
  }
  createdAt: string
}

interface ChatInterfaceProps {
  chatRoomId: string
  initialMessages: Message[]
  currentUser: {
    id: string
    name?: string
  }
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatRoomId,
  initialMessages,
  currentUser
}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim()) return

    const newMessage = {
        content: inputValue,
        chatRoom: chatRoomId,
        sender: currentUser.id,
    }

    // Optimistic update
    const tempId = Math.random().toString()
    setMessages([...messages, {
        ...newMessage,
        id: tempId,
        sender: currentUser,
        createdAt: new Date().toISOString()
    }])
    setInputValue('')

    try {
        await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newMessage)
        })
    } catch (error) {
        console.error("Failed to send message", error)
    }
  }

  return (
    <div className="flex flex-col h-[70vh] w-full max-w-2xl mx-auto border rounded-3xl overflow-hidden bg-background shadow-2xl">
      <div className="p-6 border-b bg-muted/30 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
            <h3 className="font-bold">Community Chat</h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Active now
            </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/5 scrollbar-thin"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.sender.id === currentUser.id
            return (
              <motion.div
                key={msg.id}
                {...({
                  initial: { opacity: 0, y: 10, scale: 0.95 },
                  animate: { opacity: 1, y: 0, scale: 1 },
                  className: `flex ${isMe ? 'justify-end' : 'justify-start'}`
                } as any)}
              >
                <div className={`flex gap-3 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                    )}
                    <div>
                        <div className={`px-4 py-2 rounded-2xl text-sm ${
                            isMe
                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                            : 'bg-card border rounded-tl-none'
                        }`}>
                            {msg.content}
                        </div>
                        <div className={`text-[10px] mt-1 text-muted-foreground ${isMe ? 'text-right' : 'text-left'}`}>
                            {msg.sender.name || 'User'} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-muted/50 border-none rounded-full px-6 py-2 outline-none focus:ring-2 ring-primary/20 transition-all"
            />
            <button
                onClick={handleSend}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  )
}
