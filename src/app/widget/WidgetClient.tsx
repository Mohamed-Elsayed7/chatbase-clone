"use client"

import { useSearchParams } from "next/navigation"
import { useState, useRef, useEffect } from "react"

export default function WidgetClient() {
  const searchParams = useSearchParams()
  const chatbotKey = searchParams.get("chatbotKey")
  const chatbotName = searchParams.get("chatbotName") || "Chatbot"

  const [messages, setMessages] = useState<
    { id?: number; role: string; content: string; created_at?: string }[]
  >([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Format timestamp → "21:35, Sep 23"
  const formatTimestamp = (ts?: string) => {
    if (!ts) return ""
    const d = new Date(ts)
    return d.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    })
  }
  // 🔹 Ensure a conversation exists (create on first load)
  useEffect(() => {
    const ensureConversation = async () => {
      if (!chatbotKey) return
      let conv = localStorage.getItem("conversationId")

      if (!conv) {
        try {
          const res = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatbotKey }),
          })
          const data = await res.json()
          if (res.ok && data.conversationId) {
            conv = data.conversationId
            localStorage.setItem("conversationId", conv)
          }
        } catch (e) {
          console.error("Create conversation failed", e)
        }
      }

      if (conv) {
        setConversationId(conv)

        // 🔹 Fetch past messages
        try {
          const res = await fetch(`/api/conversations/${conv}`)
          const data = await res.json()
          if (res.ok && Array.isArray(data.messages)) {
            setMessages(data.messages)
          }
        } catch (err) {
          console.error("Failed to load conversation history:", err)
        }
      }
    }
    ensureConversation()
  }, [chatbotKey])

  const sendMessage = async () => {
    if (!input.trim() || !chatbotKey) return
    const newMsg = { role: "user", content: input }
    setMessages([...messages, newMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotKey,                 // ✅ secure key
          conversationId,             // ✅ pass conversation for saving
          messages: [...messages, newMsg],
        }),
      })
      const data = await res.json()
      if (res.ok && data.answer) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }])
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || "⚠️ Error fetching response" }])
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
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm bg-gray-50">
        {messages.map((m, i) => (
          <div key={m.id || i} className="flex flex-col">
            <div
              className={`p-2 rounded max-w-[80%] ${
                m.role === "user"
                  ? "ml-auto bg-blue-500 text-white"
                  : "bg-white border text-gray-800"
              }`}
            >
              {m.content}
            </div>
            <span
              className={`text-[10px] mt-1 ${
                m.role === "user" ? "ml-auto text-right text-gray-400" : "text-gray-400"
              }`}
            >
              {formatTimestamp(m.created_at)}
            </span>
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