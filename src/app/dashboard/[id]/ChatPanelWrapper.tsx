'use client'

import ChatPanel from '../ChatPanel'

export default function ChatPanelWrapper({ chatbot, chatbotId }: any) {
  return (
    <div>
      <h2 className="text-lg font-bold mb-2">Chat with {chatbot.name}</h2>
      <ChatPanel chatbotId={chatbotId} />
    </div>
  )
}
