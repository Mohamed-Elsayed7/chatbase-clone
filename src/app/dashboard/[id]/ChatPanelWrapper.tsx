'use client'

import ChatPanel from '../ChatPanel'
import toast from 'react-hot-toast'
import { useEffect } from 'react'

export default function ChatPanelWrapper({ chatbot, chatbotId }: any) {
  useEffect(() => {
    if (!chatbot) {
      toast.error('⚠️ Failed to load chatbot data.')
    }
  }, [chatbot])

  if (!chatbot) {
    return (
      <div className="p-4 text-sm text-red-600">
        Unable to load chatbot. Please try again later.
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-2">Chat with {chatbot.name}</h2>
      <ChatPanel chatbotId={chatbotId} />
    </div>
  )
}
