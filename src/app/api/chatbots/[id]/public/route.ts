import { NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/usage"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const chatbotId = Number(params.id)
    if (!chatbotId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const admin = getAdminSupabase()
    const { data, error } = await admin
      .from("chatbots")
      .select(`
        id,
        name,
        brand_name,
        widget_theme,
        widget_primary_color,
        widget_logo_url,
        widget_greeting,
        widget_position,
        widget_open_by_default
      `)
      .eq("id", chatbotId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return new NextResponse(
      JSON.stringify({
        id: data.id,
        name: data.name,
        brandName: data.brand_name,
        theme: data.widget_theme,
        primaryColor: data.widget_primary_color,
        logoUrl: data.widget_logo_url,
        greeting: data.widget_greeting,
        position: data.widget_position,
        openByDefault: !!data.widget_open_by_default,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0", // 🚀 disable caching
        },
      }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
