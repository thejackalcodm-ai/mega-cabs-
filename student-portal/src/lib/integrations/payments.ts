/**
 * Payment provider abstraction. The app records payments in public.payments; a provider only
 * creates checkout sessions and reports outcomes (via a server-side webhook that writes the
 * payment row with the service role). No card data ever touches this app or the database.
 */
export interface CheckoutRequest {
  invoiceId: string
  amount: number
  currency: string
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSession {
  provider: string
  /** URL to redirect the student to (hosted checkout page). */
  redirectUrl: string
  providerReference: string
}

export interface PaymentProvider {
  readonly id: 'manual' | 'stripe' | (string & {})
  readonly label: string
  /** Manual providers return null: payment is recorded by finance staff. */
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession | null>
}

/** Bank transfer / cash recorded by staff. Available now. */
export const manualProvider: PaymentProvider = {
  id: 'manual',
  label: 'Bank transfer',
  async createCheckout() {
    return null
  },
}

// STUB — not implemented. A Stripe provider would call an Edge Function that creates a
// Checkout Session with the secret key; the stripe-webhook function then inserts the payment.
export const PAYMENT_PROVIDERS: PaymentProvider[] = [manualProvider]
