import { useI18n, type Lang } from "./index";

// Public page "Tontines" for visitors who are not signed in (also what search engines read).
// French is the source; Wolof and Arabic are drafts to be reviewed by fluent readers.

const fr = {
  eyebrow: "Tontines, natt et mbootaay",
  title: "Le cahier numérique de votre tontine",
  lead:
    "Gérez votre tontine, votre natt ou votre mbootaay sur votre téléphone : cotisations du jour, reçus WhatsApp, dépôts vérifiés par deux personnes, relevé du mois. Gratuit, en français et en wolof.",
  start: "Créer ma tontine gratuitement",
  signIn: "J'ai déjà un compte",
  safety:
    "SENJAPO ne touche jamais votre argent : les membres paient leur trésorier, qui dépose sur le compte bancaire de l'association. La plateforme enregistre tout et prévient en cas de problème.",
  formulasTitle: "Trois formules, comme dans la vie",
  formulas: [
    { title: "Épargne", text: "Chacun cotise chaque jour, semaine ou mois, et récupère ce qu'il a versé en fin de période." },
    { title: "Natt tournante", text: "Chacun cotise, et la cagnotte revient à un membre à chaque tour, dans l'ordre choisi." },
    { title: "Mbootaay", text: "Une caisse de solidarité qui aide les membres pour un baptême, un mariage, un décès ou une maladie." },
  ],
  featuresTitle: "Fini le cahier perdu et les disputes",
  features: [
    "Feuille du jour : la trésorière coche qui a payé, un seul bouton enregistre tout.",
    "Reçu WhatsApp ou email à chaque cotisation : aucun versement « oublié ».",
    "Chaque dépôt à la banque est validé par une deuxième personne, avec la photo du bordereau.",
    "Alerte quand l'argent reste trop longtemps chez la trésorière.",
    "Chaque membre voit son propre compte : ce qu'il a payé, son retard, ce qu'il va recevoir.",
    "Rien ne s'efface : chaque correction reste inscrite avec son motif.",
  ],
  plansTitle: "Gratuit pour commencer",
  free: "Gratuit : une association, membres illimités, toutes les fonctions de base.",
  premium: (price: string) => `Premium (${price} par mois) : plusieurs associations, reçus par email, relevé PDF, alertes par email, badge « vérifiée ».`,
  faqTitle: "Questions fréquentes",
  faq: [
    { q: "Est-ce que SENJAPO garde l'argent de la tontine ?", a: "Non. L'argent reste chez votre trésorière puis sur le compte bancaire de votre association. SENJAPO tient seulement le cahier." },
    { q: "Les membres doivent-ils avoir un smartphone ?", a: "Non. La trésorière enregistre les cotisations ; les membres reçoivent un reçu WhatsApp. Ceux qui ont un compte voient leur solde." },
    { q: "Est-ce disponible en wolof ?", a: "Oui : les écrans des tontines existent en français, en wolof, en anglais et en arabe." },
    { q: "Combien ça coûte ?", a: "La formule gratuite suffit pour une association. Le Premium ajoute les relevés PDF, les reçus par email et les alertes." },
  ],
};

export type TontineLandingText = typeof fr;

const wo: TontineLandingText = {
  eyebrow: "Natt, tontine ak mbootaay",
  title: "Kayitu natt bi ci sa telefon",
  lead:
    "Toppal sa natt walla sa mbootaay ci sa telefon : natt bu tey, kayitu fey ci WhatsApp, denc yu ñaari nit dëggal, rapoor bu weer wi. Ñeel la, ci wolof ak ci faranse.",
  start: "Sos sama natt, ñeel",
  signIn: "Am naa kont",
  safety:
    "SENJAPO du jàpp sa xaalis : way-bokk yi dañuy fey seen tresoriye, mu denc ko ci kontu bànku mbootaay bi. Platform bi dafay bind lépp te xamle bu am jafe-jafe.",
  formulasTitle: "Ñetti xeet, ni ci dund bi",
  formulas: [
    { title: "Denc", text: "Ku nekk dafay natt bés bu nekk, ayubés walla weer, te jot li mu fey ci mujjantal bi." },
    { title: "Natt buy wër", text: "Ku nekk dafay natt, te natt bi dafay dem ci benn way-bokk ci wër wu nekk." },
    { title: "Mbootaay", text: "Kees ndimbal bu dimbali way-bokk yi ci ngénte, takk, dee walla feebar." },
  ],
  featuresTitle: "Kayit bu réer ak xuloo jeex na",
  features: [
    "Natt bu tey : tresoriye bi dafay tànn ñi fey, benn bës rekk bind lépp.",
    "Kayitu fey ci WhatsApp walla email ci natt bu nekk.",
    "Denc bu nekk ci bànk, keneen dina ko dëggal, ak nataalu bordereau bi.",
    "Xamle su xaalis bi yàggee ci loxou tresoriye bi.",
    "Way-bokk bu nekk dafay gis kontam : li mu fey, li mu yéex, li muy jot.",
    "Dara du far : defar bu nekk dañu koy bind ak li ko waral.",
  ],
  plansTitle: "Ñeel ngir tàmbali",
  free: "Ñeel : benn mbootaay, way-bokk yu dul jeex, lépp lu am solo.",
  premium: (price: string) => `Premium (${price} weer wu nekk) : ay mbootaay, kayit ci email, rapoor PDF, xamle ci email, màndarga « dëggal nañu ko ».`,
  faqTitle: "Laaj yi ñuy faral di laaj",
  faq: [
    { q: "Ndax SENJAPO dafay denc xaalisu natt bi ?", a: "Déedéet. Xaalis bi ngi des ci tresoriye bi, ba noppi ci kontu bànku mbootaay bi. SENJAPO dafay yor kayit bi rekk." },
    { q: "Ndax way-bokk yi war nañu am smartphone ?", a: "Déedéet. Tresoriye bi mooy bind natt yi ; way-bokk yi dañuy jot kayit ci WhatsApp." },
    { q: "Ndax am na ci wolof ?", a: "Waaw : am na ci wolof, faranse, angale ak araab." },
    { q: "Ñaata la ?", a: "Ñeel bi doy na ngir benn mbootaay. Premium dafay yokk rapoor PDF, kayit ci email ak xamle yi." },
  ],
};

const en: TontineLandingText = {
  eyebrow: "Tontines, natt and mbootaay",
  title: "The digital ledger of your savings group",
  lead:
    "Run your tontine, natt or mbootaay from your phone: today's payments, WhatsApp receipts, deposits checked by two people, a monthly statement. Free, in French and in Wolof.",
  start: "Create my group for free",
  signIn: "I already have an account",
  safety:
    "SENJAPO never touches your money: members pay their treasurer, who deposits it on the group's bank account. The platform records everything and warns when something is wrong.",
  formulasTitle: "Three formulas, just like in real life",
  formulas: [
    { title: "Savings", text: "Everyone pays every day, week or month, and gets back what they paid at the end of the period." },
    { title: "Rotating natt", text: "Everyone pays, and the pot goes to one member at each round, in the chosen order." },
    { title: "Mbootaay", text: "A solidarity fund that helps members for a baptism, a wedding, a death or an illness." },
  ],
  featuresTitle: "No more lost notebooks and disputes",
  features: [
    "Daily sheet: the treasurer ticks who paid, one button saves everything.",
    "A WhatsApp or email receipt for every payment: nothing gets \"forgotten\".",
    "Every bank deposit is validated by a second person, with a photo of the slip.",
    "An alert when the money stays too long with the treasurer.",
    "Each member sees their own account: what they paid, what is late, what they will receive.",
    "Nothing is erased: every correction stays recorded with its reason.",
  ],
  plansTitle: "Free to start",
  free: "Free: one group, unlimited members, all the basic features.",
  premium: (price: string) => `Premium (${price} per month): several groups, email receipts, PDF statement, email alerts, "verified" badge.`,
  faqTitle: "Frequently asked questions",
  faq: [
    { q: "Does SENJAPO hold the group's money?", a: "No. The money stays with your treasurer, then on your group's bank account. SENJAPO only keeps the ledger." },
    { q: "Do members need a smartphone?", a: "No. The treasurer records the payments; members get a WhatsApp receipt. Those with an account see their balance." },
    { q: "Is it available in Wolof?", a: "Yes: the tontine screens exist in French, Wolof, English and Arabic." },
    { q: "How much does it cost?", a: "The free plan is enough for one group. Premium adds PDF statements, email receipts and alerts." },
  ],
};

const ar: TontineLandingText = {
  eyebrow: "جمعيات الادخار: النات والمبوتاي",
  title: "الدفتر الرقمي لجمعيتكم",
  lead:
    "أديروا جمعيتكم من هاتفكم: مساهمات اليوم، إيصالات واتساب، إيداعات يتحقق منها شخصان، كشف شهري. مجاني، بالفرنسية والولوفية.",
  start: "أنشئ جمعيتي مجانًا",
  signIn: "لدي حساب",
  safety:
    "لا تمسك SENJAPO أموالكم أبدًا: يدفع الأعضاء لأمين الصندوق الذي يودعها في الحساب البنكي للجمعية. تسجّل المنصة كل شيء وتنبّه عند حدوث مشكلة.",
  formulasTitle: "ثلاث صيغ كما في الحياة",
  formulas: [
    { title: "ادخار", text: "يساهم كل عضو يوميًا أو أسبوعيًا أو شهريًا ويسترجع ما دفعه في نهاية المدة." },
    { title: "نات دوري", text: "يساهم الجميع ويحصل عضو واحد على المبلغ في كل دورة حسب الترتيب." },
    { title: "مبوتاي", text: "صندوق تضامن يساعد الأعضاء في العقيقة والزواج والوفاة والمرض." },
  ],
  featuresTitle: "وداعًا للدفتر الضائع والخلافات",
  features: [
    "ورقة اليوم: يحدد أمين الصندوق من دفع، وزر واحد يسجّل الكل.",
    "إيصال واتساب أو بريد لكل مساهمة.",
    "كل إيداع بنكي يصادق عليه شخص ثانٍ مع صورة الوصل.",
    "تنبيه عندما يبقى المال طويلًا عند أمين الصندوق.",
    "يرى كل عضو حسابه: ما دفعه، ما تأخر فيه، ما سيستلمه.",
    "لا شيء يُمحى: كل تصحيح يبقى مسجلًا مع سببه.",
  ],
  plansTitle: "مجاني للبدء",
  free: "مجاني: جمعية واحدة، أعضاء بلا حدود، كل الوظائف الأساسية.",
  premium: (price: string) => `مميز (${price} شهريًا): عدة جمعيات، إيصالات بالبريد، كشف PDF، تنبيهات، شارة «موثّقة».`,
  faqTitle: "أسئلة شائعة",
  faq: [
    { q: "هل تحتفظ SENJAPO بمال الجمعية؟", a: "لا. يبقى المال عند أمين الصندوق ثم في الحساب البنكي للجمعية. تمسك SENJAPO الدفتر فقط." },
    { q: "هل يحتاج الأعضاء إلى هاتف ذكي؟", a: "لا. يسجّل أمين الصندوق المساهمات ويتلقى الأعضاء إيصالًا عبر واتساب." },
    { q: "هل هي متوفرة بالولوفية؟", a: "نعم: بالفرنسية والولوفية والإنجليزية والعربية." },
    { q: "كم التكلفة؟", a: "الصيغة المجانية تكفي لجمعية واحدة. المميز يضيف الكشوف والإيصالات بالبريد والتنبيهات." },
  ],
};

const TEXTS: Record<Lang, TontineLandingText> = { fr, wo, en, ar };

export const useTontineLandingText = () => TEXTS[useI18n().lang];
