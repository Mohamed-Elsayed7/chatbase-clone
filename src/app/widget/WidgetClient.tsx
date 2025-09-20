"use client"

import { useSearchParams } from "next/navigation"
import { useState, useRef, useEffect } from "react"

type Msg = { role: "user" | "assistant"; content: string }

export default function WidgetClient() {
  const searchParams = useSearchParams()
  const chatbotId = Number(searchParams.get("chatbotId"))
  const qp = (key: string) => searchParams.get(key) || ""

  // query param overrides (may be empty)
  const qpBrand   = qp("brandName")
  const qpTheme   = qp("theme") as "light" | "dark" | ""
  const qpPrimary = qp("primary")
  const qpLogo    = qp("logoUrl")
  const qpPos     = qp("position") as "left" | "right" | ""
  const qpOpen    = qp("openByDefault")

  // fetched server config (public)
  const [brandName, setBrandName] = useState<string>("")
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [primary, setPrimary] = useState<string>("#2563eb")
  const [logoUrl, setLogoUrl] = useState<string>("")
  const [greeting, setGreeting] = useState<string>("👋 Hi! How can I help you?")
  const [position, setPosition] = useState<"left" | "right">("right")

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // pull server defaults, then apply query param overrides
  useEffect(() => {
    let mounted = true
    async function boot() {
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/public`, { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          if (!mounted) return
          setBrandName(data.brandName || data.name || "Chatbot")
          setTheme((data.theme === "dark" ? "dark" : "light"))
          setPrimary(data.primaryColor || "#2563eb")
          setLogoUrl(data.logoUrl || "")
          setGreeting(data.greeting || "👋 Hi! How can I help you?")
          setPosition(data.position === "left" ? "left" : "right")
        }
      } catch {}
    }
    if (chatbotId) boot()
    return () => { mounted = false }
  }, [chatbotId])

  // apply query param overrides after fetch
  useEffect(() => {
    if (qpBrand) setBrandName(qpBrand)
    if (qpTheme === "dark" || qpTheme === "light") setTheme(qpTheme)
    if (qpPrimary) setPrimary(qpPrimary)
    if (qpLogo) setLogoUrl(qpLogo)
    if (qpPos === "left" || qpPos === "right") setPosition(qpPos)
  }, [qpBrand, qpTheme, qpPrimary, qpLogo, qpPos])

  // initial assistant greeting
  useEffect(() => {
    setMessages([{ role: "assistant", content: greeting }])
  }, [greeting])

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return
    const newMsg: Msg = { role: "user", content: input }
    const pending = [...messages, newMsg]
    setMessages(pending)
    setInput("")
    setLoading(true)

    try {
      // get top matches to form context
      const q = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatbotId, query: input }),
      })
      const qData = await q.json()
      const context = (qData.matches || []).map((m: any) => m.content).join("\n\n")

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId,
          messages: pending,
          retrievedContext: context,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: "assistant", content: data.answer || "…" }])
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ " + (e.message || "Error") }])
    } finally {
      setLoading(false)
    }
  }

  // theming
  const bg = theme === "dark" ? "#0f172a" : "#ffffff"
  const fg = theme === "dark" ? "#e2e8f0" : "#111827"
  const bubbleUser = primary
  const bubbleBotBg = theme === "dark" ? "#1f2937" : "#ffffff"
  const bubbleBotBorder = theme === "dark" ? "#334155" : "#e5e7eb"

  return (
    <div className="flex flex-col h-full w-full rounded-lg overflow-hidden font-sans" style={{ background: bg, color: fg }}>
      {/* Header */}
      <div className="flex-none px-3 py-2 flex items-center justify-between" style={{ background: primary, color: "white" }}>
        <div className="flex items-center space-x-2">
          {logoUrl ? <img src={logoUrl} alt="logo" className="w-5 h-5 rounded" /> : <span>🤖</span>}
          <span className="font-semibold text-sm">{brandName || "Chatbot"}</span>
        </div>
        <span className="text-xs opacity-80">Powered by GSM</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded max-w-[80%] ${m.role === "user" ? "ml-auto text-white" : "border"}`}
            style={
              m.role === "user"
                ? { background: bubbleUser }
                : { background: bubbleBotBg, borderColor: bubbleBotBorder }
            }
          >
            {m.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none border-t p-2 flex" style={{ borderColor: bubbleBotBorder }}>
        <input
          className="flex-1 border px-2 py-1 rounded text-sm"
          style={{ borderColor: bubbleBotBorder, background: theme === "dark" ? "#0b1220" : "#fff", color: fg }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="ml-2 px-3 py-1 rounded text-sm"
          style={{ background: primary, color: "white", opacity: loading ? 0.8 : 1 }}
        >
          {loading ? "…" : "Send"}
        </button>
      </div>
    </div>
  )
}
