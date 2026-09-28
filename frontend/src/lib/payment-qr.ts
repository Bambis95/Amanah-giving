// Official Wave / Orange Money QR codes of the collection account, shown to donors (donation page,
// stand screen). Put the image files in public/qr/ and set `image`; while `image` is null the card
// says the QR code is coming soon. Only ever use the QR codes issued for the official account.
export interface PaymentQr {
  id: "wave" | "orange_money";
  name: string;
  /** e.g. "/qr/wave.png" */
  image: string | null;
  /** Brand colour of the operator (card accent) */
  color: string;
}

export const PAYMENT_QR: PaymentQr[] = [
  { id: "wave", name: "Wave", image: null, color: "#1DC3E2" },
  { id: "orange_money", name: "Orange Money", image: null, color: "#FF6600" },
];

export const hasPaymentQr = PAYMENT_QR.some((q) => q.image);
