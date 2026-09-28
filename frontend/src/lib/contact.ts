// Public contact details shown on the site (Contact page, footer, legal pages): change them here only.
export const CONTACT_EMAIL = "ccecce035@gmail.com";
export const CONTACT_PHONES = ["+221 78 571 82 81", "+221 77 895 15 15"];
export const CONTACT_PHONE = CONTACT_PHONES[0];
export const CONTACT_ADDRESS = "Sacré Cœur 3, Mermoz, Dakar, Sénégal";

/** tel: link for a displayed number ("+221 78 571 82 81" → "tel:+221785718281") */
export const telHref = (phone: string) => `tel:${phone.replace(/\s+/g, "")}`;
