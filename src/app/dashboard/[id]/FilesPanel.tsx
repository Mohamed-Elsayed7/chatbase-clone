'use client'

import ChatbotFiles from '../ChatbotFiles'

export default function FilesPanel({ chatbot, chatbotId }: any) {
  return (
    <div>
      <h2 className="text-lg font-bold mb-2">Manage Files</h2>
      <ChatbotFiles chatbotId={chatbotId} userId={chatbot.user_id} />
    </div>
  )
}
