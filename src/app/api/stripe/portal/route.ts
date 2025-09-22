import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminSupabase } from "@/lib/usage"
const supabase = getAdminSupabase()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

    return NextResponse.json({ url: portal.url })
  } catch (err: any) {
    console.error("STRIPE ERROR:", err)
    return NextResponse.json(
      { error: "Stripe request failed" },
      { status: 500 }
    )
  }
}
