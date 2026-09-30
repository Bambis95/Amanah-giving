import { useSiteSettings } from "@/hooks/use-site-settings";

/** The contact email from the site settings, as a mailto link */
export function ContactEmail() {
  const { contact_email } = useSiteSettings();
  return <a href={`mailto:${contact_email}`}>{contact_email}</a>;
}

/** "email ou tél. / tél." from the site settings, for sentences of the legal pages and printed material */
export default function ContactLine({ separator = " · ", link = true }: { separator?: string; link?: boolean }) {
  const site = useSiteSettings();
  return (
    <>
      {link ? <a href={`mailto:${site.contact_email}`}>{site.contact_email}</a> : site.contact_email}
      {separator}
      {site.contact_phones.join(" / ")}
    </>
  );
}
