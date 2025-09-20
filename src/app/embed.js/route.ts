import { NextResponse } from 'next/server'

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const js = `
    (function() {
      var scriptTag = document.currentScript;
      if (!scriptTag) return;

      var chatbotId = scriptTag.getAttribute("data-chatbot-id");
      var chatbotName = scriptTag.getAttribute("data-chatbot-name") || "Chatbot";

      // Optional overrides (fallback to API/widget defaults)
      var brandName   = scriptTag.getAttribute("data-brand-name");
      var theme       = scriptTag.getAttribute("data-theme");              // 'light' | 'dark'
      var primary     = scriptTag.getAttribute("data-primary-color");      // '#2563eb'
      var logoUrl     = scriptTag.getAttribute("data-logo-url");
      var position    = scriptTag.getAttribute("data-position");           // 'right' | 'left'
      var openDefault = scriptTag.getAttribute("data-open-by-default") === "true";

      if (!chatbotId) return;

      // Floating toggle button
      var button = document.createElement("div");
      button.innerHTML = "💬";
      button.style.position = "fixed";
      button.style.bottom = "20px";
      button.style.width = "50px";
      button.style.height = "50px";
      button.style.borderRadius = "50%";
      button.style.background = primary || "#2563eb";
      button.style.color = "white";
      button.style.display = "flex";
      button.style.alignItems = "center";
      button.style.justifyContent = "center";
      button.style.fontSize = "24px";
      button.style.cursor = "pointer";
      button.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
      button.style.zIndex = "999998";

      // position
      var side = (position === "left") ? "left" : "right";
      button.style[side] = "20px";

      // Iframe widget
      var iframe = document.createElement("iframe");
      var params = new URLSearchParams({
        chatbotId: String(chatbotId),
        chatbotName: chatbotName || "",
        brandName: brandName || "",
        theme: theme || "",
        primary: primary || "",
        logoUrl: logoUrl || "",
        position: side,
        openByDefault: String(openDefault || "")
      });
      iframe.src = "${appUrl}/widget?" + params.toString();
      iframe.style.position = "fixed";
      iframe.style.bottom = "80px";
      iframe.style[side] = "20px";
      iframe.style.width = "350px";
      iframe.style.height = "500px";
      iframe.style.border = "none";
      iframe.style.borderRadius = "12px";
      iframe.style.boxShadow = "0 4px 10px rgba(0,0,0,0.15)";
      iframe.style.zIndex = "999999";
      iframe.style.transform = "translateY(20px)";
      iframe.style.opacity = "0";
      iframe.style.transition = "all 0.25s ease";
      iframe.style.pointerEvents = "none";

      var isOpen = !!openDefault;
      function renderOpenState() {
        if (isOpen) {
          iframe.style.opacity = "1";
          iframe.style.transform = "translateY(0)";
          iframe.style.pointerEvents = "auto";
          button.innerHTML = "✖";
        } else {
          iframe.style.opacity = "0";
          iframe.style.transform = "translateY(20px)";
          iframe.style.pointerEvents = "none";
          button.innerHTML = "💬";
        }
      }
      renderOpenState();

      button.onclick = function() {
        isOpen = !isOpen;
        renderOpenState();
      };

      document.body.appendChild(button);
      document.body.appendChild(iframe);
    })();
  `
  return new NextResponse(js, {
    headers: { 'Content-Type': 'application/javascript' },
  })
}
