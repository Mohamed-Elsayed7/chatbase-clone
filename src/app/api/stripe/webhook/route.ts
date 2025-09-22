import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAdminSupabase } from "@/lib/usage"
const supabase = getAdminSupabase()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook error:', err.message)
    return new NextResponse(`Webhook error: ${err.message}`, { status: 400 })
  }

  try {
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const plan = subscription.items.data[0].price.nickname?.toLowerCase() || 'pro'

      await supabase
        .from('profiles')
        .update({
          stripe_subscription_id: subscription.id,
          plan: plan,
        })
        .eq('stripe_customer_id', customerId)
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      await supabase
        .from('profiles')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('stripe_subscription_id', subscription.id)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
  console.error("STRIPE ERROR:", err)
  return NextResponse.json(
    { error: "Stripe request failed" },
    { status: 500 }
  )
}