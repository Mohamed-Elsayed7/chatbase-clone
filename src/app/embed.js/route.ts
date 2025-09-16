import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const js = `
    (function() {
      var scriptTag = document.currentScript
      var chatbotId = scriptTag.getAttribute("data-chatbot-id")
      if (!chatbotId) return

      var iframe = document.createElement("iframe")
      iframe.src = "${process.env.NEXT_PUBLIC_APP_URL}/widget?chatbotId=" + chatbotId
      iframe.style.position = "fixed"
      iframe.style.bottom = "20px"
      iframe.style.right = "20px"
      iframe.style.width = "350px"
      iframe.style.height = "500px"
      iframe.style.border = "none"
      iframe.style.borderRadius = "12px"
      iframe.style.boxShadow = "0 4px 10px rgba(0,0,0,0.15)"
      iframe.style.zIndex = "999999"

      document.body.appendChild(iframe)
    })();
  `
  return new NextResponse(js, {
    headers: { 'Content-Type': 'application/javascript' },
  })
}
