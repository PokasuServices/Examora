import type { CheckoutSession } from "@examora/types";

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color: string };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load the payment gateway"));
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Opens Razorpay's hosted checkout widget for a session returned by
 * POST /commerce/orders. The `handler` callback fires on the client the
 * moment the user completes payment in the widget, but per ADR-0018
 * entitlement is only ever granted by the server-verified webhook — callers
 * should treat `onPaymentSubmitted` as "start polling order status", not as
 * confirmation of purchase.
 */
export async function openRazorpayCheckout(
  session: CheckoutSession,
  handlers: { onPaymentSubmitted: () => void; onDismiss: () => void },
): Promise<void> {
  await loadCheckoutScript();
  if (!window.Razorpay) {
    throw new Error("Payment gateway failed to load");
  }
  const checkout = new window.Razorpay({
    key: session.gatewayKeyId,
    amount: Math.round(session.amount * 100),
    currency: session.currency,
    order_id: session.gatewayOrderId,
    name: "Examora",
    description: session.order.courseTitle,
    handler: () => handlers.onPaymentSubmitted(),
    modal: { ondismiss: handlers.onDismiss },
    theme: { color: "#4f46e5" },
  });
  checkout.open();
}
