import { Project } from "@/api";

/** Link with the campaign's own preview (photo, title, amount) in WhatsApp and other apps: see backend/routers/share.py */
export const campaignShareUrl = (projectId: number) => `${window.location.origin}/api/v1/share/campagne/${projectId}`;

export function campaignShareText(project: Project) {
  return `Soutenez « ${project.title} » sur SENJAPO : chaque contribution compte.`;
}

export const whatsappLink = (project: Project) =>
  `https://wa.me/?text=${encodeURIComponent(`${campaignShareText(project)} ${campaignShareUrl(project.id)}`)}`;

/** The phone's own share sheet when there is one (WhatsApp, SMS, Facebook…); false when unavailable or cancelled */
export async function nativeShare(project: Project): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share({ title: project.title, text: campaignShareText(project), url: campaignShareUrl(project.id) });
    return true;
  } catch {
    return false;
  }
}
