import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminSupabase } from "@/lib/usage"
const supabase = getAdminSupabase()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)


export async function POST(req: Request) {
  try {
    const { userId, priceId } = await req.json()

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle()

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { supabaseUserId: userId } })
      customerId = customer.id
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?canceled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
  console.error("STRIPE ERROR:", err)
  return NextResponse.json(
    { error: "Stripe request failed" },
    { status: 500 }
  )
}
