import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "@/components/LegalLayout";
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/contact";

// The donation rules below mirror the backend (routers/payment_checkout.py): keep them in sync.
const UPDATED = "27 septembre 2026";

const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const sections: LegalSection[] = [
  {
    id: "editeur",
    title: "Éditeur du site",
    content: (
      <p>
        Le site Amanah Giving est édité par <strong>Amanah Giving</strong>, {CONTACT_ADDRESS}. Contact : {email} ·{" "}
        {CONTACT_PHONE}.
      </p>
    ),
  },
  {
    id: "objet",
    title: "Objet",
    content: (
      <p>
        Amanah Giving est une plateforme de dons en ligne qui permet de soutenir des projets solidaires (éducation, santé,
        eau potable, alimentation, logement). Les présentes conditions encadrent l'utilisation du site et les dons qui y
        sont faits. En utilisant le site ou en faisant un don, vous les acceptez.
      </p>
    ),
  },
  {
    id: "compte",
    title: "Compte utilisateur",
    content: (
      <>
        <p>
          Il n'est pas nécessaire de créer un compte pour faire un don : une adresse email suffit, pour vous envoyer la
          confirmation. Si vous créez un compte, vous vous engagez à fournir des informations exactes et à garder votre mot
          de passe confidentiel.
        </p>
        <p>
          Par sécurité, la session se ferme automatiquement après une période d'inactivité. Nous pouvons suspendre un
          compte utilisé de manière frauduleuse ou contraire aux présentes conditions.
        </p>
      </>
    ),
  },
  {
    id: "dons",
    title: "Dons",
    content: (
      <>
        <ul>
          <li>Le montant minimum d'un don est de <strong>500 FCFA</strong>.</li>
          <li>
            Vous pouvez payer par <strong>Wave</strong> ou <strong>Orange Money</strong> (via notre prestataire PayDunya),
            ou par <strong>carte bancaire</strong> (via Stripe). Pour la carte, le montant est converti en euros au taux
            fixe FCFA/euro ; votre banque peut appliquer ses propres frais.
          </li>
          <li>
            Le paiement se fait sur la page sécurisée du prestataire. Le don n'est enregistré comme reçu qu'une fois le
            paiement confirmé par celui-ci ; vous recevez alors un email de confirmation avec la référence du don.
          </li>
          <li>Un projet terminé ou clôturé n'accepte plus de nouveaux dons.</li>
          <li>
            L'email de confirmation vaut justificatif de votre don. Il ne constitue pas un reçu fiscal ouvrant droit à une
            réduction d'impôt.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "affectation",
    title: "Utilisation des fonds",
    content: (
      <p>
        Les dons, hors frais prélevés par les prestataires de paiement, sont affectés au projet ou à la cause que vous avez
        choisi. Si un projet ne pouvait pas être mené à son terme, les fonds collectés seraient réaffectés à un projet de
        même nature, et les donateurs concernés en seraient informés.
      </p>
    ),
  },
  {
    id: "remboursement",
    title: "Remboursement",
    content: (
      <>
        <p>
          Un don est en principe définitif. Nous remboursons toutefois un don fait par erreur (mauvais montant, paiement
          en double) ou un paiement non autorisé, sur demande envoyée à {email} dans les <strong>30 jours</strong>, en
          indiquant la référence du don (par exemple AMG-000123) figurant dans l'email de confirmation.
        </p>
        <p>
          Le remboursement est effectué par le même moyen de paiement. Les frais déjà prélevés par le prestataire de
          paiement peuvent ne pas être remboursables.
        </p>
      </>
    ),
  },
  {
    id: "utilisation",
    title: "Bonne utilisation du site",
    content: (
      <p>
        Il est interdit d'utiliser le site à des fins frauduleuses (notamment avec un moyen de paiement qui ne vous
        appartient pas), de tenter d'accéder aux comptes ou aux données d'autrui, ou de perturber le fonctionnement du
        service. Les messages envoyés via le formulaire de contact doivent rester respectueux.
      </p>
    ),
  },
  {
    id: "propriete",
    title: "Propriété intellectuelle",
    content: (
      <p>
        Les textes, logos et éléments graphiques du site appartiennent à Amanah Giving ou sont utilisés avec autorisation.
        Ils ne peuvent pas être reproduits sans accord préalable.
      </p>
    ),
  },
  {
    id: "responsabilite",
    title: "Responsabilité",
    content: (
      <p>
        Nous faisons notre possible pour que le site soit disponible et que les informations sur les projets soient
        exactes et à jour. Le site peut cependant être interrompu pour maintenance ou en cas de panne, y compris chez nos
        prestataires de paiement. Aucun don n'est débité sans confirmation du prestataire.
      </p>
    ),
  },
  {
    id: "donnees",
    title: "Données personnelles",
    content: (
      <p>
        Le traitement de vos données est décrit dans notre{" "}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>
    ),
  },
  {
    id: "droit",
    title: "Droit applicable",
    content: (
      <p>
        Ces conditions sont soumises au droit sénégalais. En cas de difficulté, contactez-nous d'abord : nous chercherons
        une solution amiable. À défaut, les tribunaux de Dakar seront compétents, sans préjudice des protections dont vous
        bénéficiez en tant que consommateur dans votre pays de résidence.
      </p>
    ),
  },
  {
    id: "modifications",
    title: "Modifications",
    content: (
      <p>
        Nous pouvons modifier ces conditions ; la version applicable à un don est celle en vigueur au moment où il est
        fait. La date de dernière mise à jour figure en haut de la page.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Conditions d'utilisation"
      updated={UPDATED}
      intro={
        <p>
          Ces conditions expliquent comment fonctionne Amanah Giving, ce que vous pouvez attendre de nous et ce que nous
          attendons de vous lorsque vous utilisez le site ou faites un don.
        </p>
      }
      sections={sections}
    />
  );
}
