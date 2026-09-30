import { Link } from "react-router-dom";
import { ArrowRight, Megaphone } from "lucide-react";

const style =
  "group mx-auto mb-6 flex w-fit max-w-full items-center gap-2 rounded-full bg-highlight px-4 py-2 text-left text-sm font-semibold text-highlight-foreground shadow-lg transition-transform motion-safe:hover:scale-[1.02]";

/** Announcement at the top of the home page (Réglages du site); nothing when empty */
export default function AnnouncementBanner({ text, link }: { text: string | null; link: string | null }) {
  if (!text) return null;
  const content = (
    <>
      <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{text}</span>
      {link && <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
    </>
  );
  if (!link) return <p className={style}>{content}</p>;
  return link.startsWith("/") ? (
    <Link to={link} className={style}>{content}</Link>
  ) : (
    <a href={link} target="_blank" rel="noopener noreferrer" className={style}>{content}</a>
  );
}
