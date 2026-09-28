import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "@/components/LegalLayout";
import { CONTACT_EMAIL, CONTACT_PHONES } from "@/lib/contact";
import { BRAND_NAME, CARRIER_NAME, CARRIER_RECEIPT, CARRIER_SHORT } from "@/lib/brand";

// Describes what the site actually collects and stores (see backend models, services/login_throttle.py,
// core/session.py). Update this page whenever that changes.
const UPDATED = "27 septembre 2026";

const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const sections: LegalSection[] = [
  {
    id: "responsable",
    title: "Responsable du traitement",
    content: (
      <p>
        Les données personnelles collectées sur {BRAND_NAME} sont traitées par le{" "}
        <strong>{CARRIER_NAME} ({CARRIER_SHORT})</strong>, récépissé {CARRIER_RECEIPT}, porteur de la plateforme.
        Pour toute question sur vos données : {email} ou {CONTACT_PHONES.join(" / ")}.
      </p>
    ),
  },
  {
    id: "donnees",
    title: "Données que nous collectons",
    content: (
      <>
        <p>Nous ne collectons que ce qui est nécessaire au service :</p>
        <ul>
          <li>
            <strong>Lors d'un don</strong> : prénom, nom, adresse email, téléphone (facultatif), montant, projet ou cause
            choisi, moyen de paiement, message facultatif, statut et référence du paiement.
          </li>
          <li>
            <strong>Si vous créez un compte</strong> : nom, adresse email, mot de passe (enregistré uniquement sous forme
            chiffrée irréversible, jamais en clair), date de création et de dernière connexion.
          </li>
          <li>
            <strong>Lorsque vous nous écrivez</strong> via le formulaire de contact : nom, email, téléphone (facultatif),
            sujet et message.
          </li>
          <li>
            <strong>Si vous proposez une campagne</strong> : nom, structure, email, téléphone, région, et les
            informations sur votre projet (nom, cause, stade, besoin de financement, description).
          </li>
          <li>
            <strong>Pour la sécurité</strong> : l'adresse IP et l'email utilisés lors des tentatives de connexion
            échouées, et l'historique des actions effectuées par les administrateurs.
          </li>
        </ul>
        <p>
          <strong>Nous ne recevons jamais vos données bancaires ni vos identifiants Wave ou Orange Money</strong> : ils
          sont saisis directement chez nos prestataires de paiement (voir la section 4).
        </p>
      </>
    ),
  },
  {
    id: "finalites",
    title: "Pourquoi nous les utilisons",
    content: (
      <ul>
        <li>Enregistrer votre don, l'affecter au projet choisi et vous envoyer un email de confirmation (exécution de votre demande).</li>
        <li>Gérer votre compte et votre connexion (exécution du service).</li>
        <li>Répondre à vos messages et étudier les campagnes proposées (votre demande).</li>
        <li>Protéger les comptes contre les tentatives d'intrusion et garder une trace des actions d'administration (intérêt légitime de sécurité).</li>
        <li>Conserver les justificatifs des dons reçus (obligations comptables).</li>
        <li>Publier des statistiques globales (montant total collecté, nombre de donateurs), qui ne permettent pas de vous identifier.</li>
      </ul>
    ),
  },
  {
    id: "destinataires",
    title: "Qui peut y accéder",
    content: (
      <>
        <p>
          Vos données sont accessibles uniquement aux administrateurs de {BRAND_NAME} et aux prestataires strictement
          nécessaires au fonctionnement du service :
        </p>
        <ul>
          <li>nos <strong>prestataires de paiement</strong> agréés, pour les paiements Wave, Orange Money et par carte bancaire ;</li>          <li><strong>Google (Gmail)</strong> pour l'envoi des emails de confirmation et de réinitialisation de mot de passe ;</li>
          <li>notre hébergeur, qui stocke la base de données du site.</li>
        </ul>
        <p>
          Certains de ces prestataires peuvent traiter des données hors du Sénégal (notamment en Europe ou aux
          États-Unis), avec des garanties de sécurité adaptées. <strong>Nous ne vendons ni ne louons vos données</strong>,
          et nous ne les utilisons pas à des fins publicitaires.
        </p>
      </>
    ),
  },
  {
    id: "conservation",
    title: "Durée de conservation",
    content: (
      <ul>
        <li>Dons et justificatifs de paiement : 10 ans, durée des obligations comptables.</li>
        <li>Compte : tant qu'il est actif, puis suppression sur simple demande.</li>
        <li>Messages de contact : jusqu'à 3 ans après notre dernier échange.</li>
        <li>Tentatives de connexion échouées : 24 heures au maximum.</li>
        <li>Liens de réinitialisation de mot de passe : valables 1 heure, utilisables une seule fois.</li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "Cookies et stockage local",
    content: (
      <>
        <p>Le site n'utilise <strong>aucun cookie publicitaire ni outil de mesure d'audience</strong>. Il utilise uniquement :</p>
        <ul>
          <li>
            un cookie de session (<code>senjapo_session</code>), déposé seulement si vous vous connectez. Il est
            inaccessible aux scripts de la page et expire après une période d'inactivité (15 minutes pour les
            administrateurs, 60 minutes pour les autres comptes) et au plus tard 12 heures après la connexion ;
          </li>
          <li>
            le stockage local de votre navigateur, pour retenir le thème clair ou sombre choisi et l'heure de votre
            dernière activité (déconnexion automatique).
          </li>
        </ul>
        <p>
          Ces éléments sont indispensables au fonctionnement du site et ne nécessitent pas votre consentement. Pour toute
          question, écrivez-nous depuis la page <Link to="/contact">Contact</Link>.
        </p>
      </>
    ),
  },
  {
    id: "securite",
    title: "Sécurité",
    content: (
      <p>
        Mots de passe chiffrés de manière irréversible, session protégée contre la lecture par des scripts,
        verrouillage temporaire après plusieurs échecs de connexion, déconnexion automatique après inactivité, accès aux
        données réservé aux administrateurs et journal de leurs actions. Aucun système n'étant infaillible, nous vous
        informerons si un incident touchait vos données.
      </p>
    ),
  },
  {
    id: "droits",
    title: "Vos droits",
    content: (
      <>
        <p>
          Vous pouvez à tout moment demander l'accès à vos données, leur rectification, leur suppression, ou vous opposer
          à leur traitement, en écrivant à {email}. Nous répondons dans un délai d'un mois. Les données de dons soumises à
          une obligation comptable ne peuvent pas être supprimées avant la fin de leur durée de conservation.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la Commission de Protection des Données
          Personnelles du Sénégal (CDP), conformément à la loi n° 2008-12 du 25 janvier 2008. Si vous résidez dans
          l'Union européenne, vous pouvez aussi vous adresser à l'autorité de protection des données de votre pays.
        </p>
      </>
    ),
  },
  {
    id: "mineurs",
    title: "Mineurs",
    content: (
      <p>
        Les personnes de moins de 18 ans doivent obtenir l'accord d'un parent ou tuteur avant de faire un don ou de créer
        un compte.
      </p>
    ),
  },
  {
    id: "modifications",
    title: "Modifications",
    content: (
      <p>
        Cette politique peut évoluer, par exemple si nous ajoutons un nouveau service. La date de dernière mise à jour
        figure en haut de la page.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      updated={UPDATED}
      intro={
        <p>
          Chez {BRAND_NAME}, la confiance est au cœur de notre démarche, y compris pour vos données personnelles. Cette
          page explique simplement ce que nous collectons, pourquoi, avec qui nous le partageons et comment exercer vos
          droits.
        </p>
      }
      sections={sections}
    />
  );
}
