import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '../../../../lib/razorpay';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  if (!verifyWebhookSignature(rawBody, signature)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  const eventId = request.headers.get('x-razorpay-event-id');
  if (!eventId) return NextResponse.json({ error: 'Missing event id.' }, { status: 400 });
  // Webhook validation is intentionally kept separate from checkout confirmation.
  // The client handler performs immediate server-side API verification; this endpoint
  // is ready for idempotent reconciliation once webhook event storage is added.
  return NextResponse.json({ received: true });
}
