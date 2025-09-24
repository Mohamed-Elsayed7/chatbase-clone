"use client"

import { useSearchParams } from "next/navigation"
import { useState, useRef, useEffect } from "react"

export default function WidgetClient() {
  const searchParams = useSearchParams()
  const chatbotKey = searchParams.get("chatbotKey") // ✅ secure key
  const chatbotName = searchParams.get("chatbotName") || "Chatbot"

  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 🔹 Load existing conversation from localStorage
  useEffect(() => {
    const conv = localStorage.getItem("conversationId")
    if (conv) {
      setConversationId(conv)
      fetch(`/api/conversations/${conv}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.messages)) {
            setMessages(data.messages)
          }
        })
        .catch((err) => console.error("Failed to load conversation history:", err))
    } else {
      // if no conv yet, show greeting only
      setMessages([
        { role: "assistant", content: `👋 Hi! I’m ${chatbotName}. How can I help you today?` },
      ])
    }
  }, [chatbotKey, chatbotName])

  const sendMessage = async () => {
    if (!input.trim() || !chatbotKey) return
    const newMsg = { role: "user", content: input }
    setMessages((prev) => [...prev, newMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotKey,
          conversationId,
          messages: [...messages, newMsg],
        }),
      })
      const data = await res.json()
      if (res.ok && data.answer) {
        if (data.conversationId && !conversationId) {
          setConversationId(data.conversationId)
          localStorage.setItem("conversationId", data.conversationId)
        }
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "⚠️ Error fetching response" },
        ])
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error: " + e.message }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-lg overflow-hidden font-sans">
      {/* Header */}
      <div className="flex-none bg-blue-600 text-white p-3 font-semibold flex items-center justify-between">
        <span>🤖 {chatbotName}</span>
        <span className="text-xs opacity-75">Powered by GSM</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm bg-gray-50">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded max-w-[80%] ${
              m.role === "user"
                ? "ml-auto bg-blue-500 text-white"
                : "bg-white border text-gray-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none border-t p-2 flex bg-white">
        <input
          className="flex-1 border px-2 py-1 rounded text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="ml-2 px-3 py-1 bg-blue-600 text-white rounded text-sm"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  )
}
