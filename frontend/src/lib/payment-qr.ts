// Official Wave / Orange Money QR codes of the collection account, shown to donors (donation page).
// `url` is the link read from the QR images issued by the operators (October 2026): the site redraws
// the QR code from it, sharp at any size, and on a phone the same link opens the operator's app.
// Only ever use links issued for the official account; while `url` is null the card says "coming soon".
export interface PaymentQr {
  id: "wave" | "orange_money";
  name: string;
  url: string | null;
  /** Brand colour of the operator (card accent) */
  color: string;
}

export const PAYMENT_QR: PaymentQr[] = [
  { id: "wave", name: "Wave", url: "https://qr.wave.com/iVVNfc25fazV2MnVjeFBYRnl4/BqvW8Y/Bt_U7W/p", color: "#1DC3E2" },
  { id: "orange_money", name: "Orange Money", url: "https://qrcode.orange.sn/dcXJLAs8Auh70GKcdBUlIW98Vwu", color: "#FF6600" },
];

export const hasPaymentQr = PAYMENT_QR.some((q) => q.url);
