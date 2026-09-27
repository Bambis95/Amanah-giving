# Amanah Giving - Plateforme de Dons en Ligne

## Design Guidelines

### Design References
- **GoFundMe.com**: Interface de don claire et intuitive
- **LaunchGood.com**: Plateforme de dons islamique, design chaleureux
- **Style**: Moderne, chaleureux, inspirant confiance, avec touches islamiques subtiles

### Color Palette
- Primary: #0D7C66 (Vert émeraude - confiance, générosité)
- Primary Dark: #095C4B (Vert foncé - hover states)
- Secondary: #F59E0B (Or/Ambre - accents, CTAs)
- Background: #FAFAF8 (Blanc cassé chaud)
- Dark: #1A1A2E (Bleu nuit - texte principal, sections sombres)
- Light Gray: #F3F4F6 (Fond de sections alternées)
- Accent: #E8F5F0 (Vert très clair - badges, highlights)
- Text: #374151 (Gris foncé - corps de texte)
- Text Light: #6B7280 (Gris - texte secondaire)

### Typography
- Headings: Inter font-weight 700/600
- Body: Inter font-weight 400
- Accent/Numbers: Inter font-weight 700

### Key Component Styles
- **Buttons primaires**: Vert émeraude (#0D7C66), texte blanc, 8px rounded, hover: #095C4B
- **Buttons secondaires**: Or (#F59E0B), texte blanc, hover: darken
- **Cards**: Blanc, ombre douce, 12px rounded, border subtle
- **Badges**: Fond vert clair (#E8F5F0), texte vert
- **Sections héroïques**: Fond sombre avec overlay gradient

### Layout & Spacing
- Hero: Full viewport avec image de fond et overlay
- Grille projets: 3 colonnes desktop, 2 tablette, 1 mobile
- Section padding: 80px vertical
- Container max-width: 1200px

### Images to Generate
1. **hero-charity-hands.jpg** - Mains tendues en geste de don et de solidarité, lumière chaude dorée, ambiance inspirante et chaleureuse (Style: photorealistic, warm tones)
2. **cause-education.jpg** - Enfants africains souriants dans une salle de classe, livres et cahiers, lumière naturelle (Style: photorealistic, warm)
3. **cause-health.jpg** - Scène médicale humanitaire en Afrique, médecin soignant un patient, ambiance d'espoir (Style: photorealistic, hopeful)
4. **cause-water.jpg** - Communauté africaine autour d'un puits d'eau propre, joie et gratitude, paysage ensoleillé (Style: photorealistic, bright)

---

## Development Tasks

### Files to Create (7 files max)
1. **src/pages/Index.tsx** - Page d'accueil complète (Hero, Stats, Causes en vedette, Témoignages, CTA)
2. **src/pages/Donate.tsx** - Page de formulaire de don (montants, paiement, infos donateur)
3. **src/pages/Projects.tsx** - Page des projets/causes avec barres de progression
4. **src/pages/About.tsx** - Page à propos (mission, valeurs, transparence)
5. **src/pages/Contact.tsx** - Page contact (formulaire, coordonnées, carte)
6. **src/components/Navbar.tsx** - Barre de navigation responsive
7. **src/components/Footer.tsx** - Footer complet avec infos et liens

### Routes
- `/` → Index (Accueil)
- `/donate` → Donate (Faire un don)
- `/projects` → Projects (Nos Projets)
- `/about` → About (À propos)
- `/contact` → Contact