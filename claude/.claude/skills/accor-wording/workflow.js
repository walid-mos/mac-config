export const meta = {
    name: 'audit-wording-fr-en',
    description: 'Audit wording FR/EN de menu-compliance vs proto drinks-menu-compliance',
    phases: [
        { title: 'Lecture', detail: '5 lecteurs sonnet par zone fonctionnelle' },
        { title: 'Vérification', detail: 'un vérificateur opus adversarial par finding' },
    ],
}

const { APP, PROTO } = args

const FINDINGS_SCHEMA = {
    type: 'object',
    required: ['findings', 'filesRead'],
    properties: {
        filesRead: { type: 'array', items: { type: 'string' } },
        findings: {
            type: 'array',
            items: {
                type: 'object',
                required: ['file', 'line', 'category', 'title', 'appText', 'protoText', 'protoRef', 'evidence', 'severity'],
                properties: {
                    file: { type: 'string', description: 'fichier app (chemin repo-relatif depuis apps/menu-compliance)' },
                    line: { type: 'integer' },
                    category: { type: 'string', enum: ['wording-mismatch', 'missing-text', 'extra-text', 'translation-mismatch', 'punctuation-case'] },
                    title: { type: 'string' },
                    appText: { type: 'string', description: 'texte exact affiché par l app, verbatim' },
                    protoText: { type: 'string', description: 'texte exact du proto, verbatim' },
                    protoRef: { type: 'string', description: 'fichier:ligne du proto prouvant le texte source' },
                    evidence: { type: 'string' },
                    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
            },
        },
    },
}

const VERDICT_SCHEMA = {
    type: 'object',
    required: ['isReal', 'reason'],
    properties: {
        isReal: { type: 'boolean' },
        reason: { type: 'string' },
        correctedEvidence: { type: 'string' },
        severity: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
}

const RULES = `
RÈGLES STRICTES (audit de wording, source de vérité = le proto) :
- Liste d'abord les fichiers de ton scope app et lis-les TOUS, ainsi que les fichiers proto indiqués. Reporte filesRead honnêtement.
- Objectif : chaque chaîne VISIBLE PAR L'UTILISATEUR dans l'app (catalogue i18n via t(), chaînes en dur dans les tsx, aria-label, placeholder, title, textes d'erreur, tooltips) doit être STRICTEMENT identique au wording du proto pour le même écran/élément. FR et EN.
- L'app n'implémente qu'un sous-ensemble du proto : ne compare que les écrans/éléments que l'app implémente. Une feature du proto absente de l'app n'est PAS un finding. En revanche, un texte manquant ou différent sur un écran implémenté EST un finding.
- Comparaison au caractère près : accents, majuscules/minuscules, ponctuation, apostrophes typographiques (’ vs '), espaces insécables, points de suspension (… vs ...), pluriels, interpolations.
- Le proto stocke son wording dans src/lib/backoffice-i18n.ts et src/lib/hotel-i18n.ts, et parfois en dur dans ses composants. Trouve la chaîne source correspondante et cite protoRef fichier:ligne.
- INTERDIT : préférences de style, opinions, "pourrait être amélioré", hypothèses. Uniquement des différences objectives et vérifiables entre texte app et texte proto.
- Ne reporte PAS les clés/identifiants techniques, les logs console, ni les textes de tests.
- Si une chaîne de l'app n'a AUCUN équivalent trouvable dans le proto (texte inventé), c'est un finding category=extra-text avec protoText="" et protoRef="introuvable (greps: <patterns essayés>)".
- Chaque finding cite le texte verbatim des deux côtés (appText / protoText) et la preuve (grep/lecture).
- Réponse finale = JSON structuré via le schéma, pas un message humain.`

phase('Lecture')

const UNITS = [
    {
        key: 'catalogue-i18n',
        prompt: `Audit de wording. App: ${APP}. Proto (source de vérité): ${PROTO}.
Ton scope : le catalogue i18n complet de l'app — ${APP}/src/shared/i18n/locales/fr.json et en.json, ainsi que ${APP}/src/shared/i18n/ (mécanique t()).
Pour CHAQUE entrée de fr.json et en.json : trouve la chaîne équivalente dans le proto (${PROTO}/src/lib/backoffice-i18n.ts, ${PROTO}/src/lib/hotel-i18n.ts, ou en dur dans ${PROTO}/src/components/ et ${PROTO}/src/pages/ — greppe le texte français) et compare au caractère près. Vérifie aussi que la valeur EN de l'app correspond à l'EN du proto quand le proto en a un.
${RULES}`,
    },
    {
        key: 'bo-sidebar-workspace',
        prompt: `Audit de wording. App: ${APP}. Proto (source de vérité): ${PROTO}.
Ton scope app : ${APP}/src/widgets/bo-sidebar/, ${APP}/src/entities/workspace/, ${APP}/src/entities/session/ (chaînes affichées : sidebar back-office, switcher de workspace, menu compte, noms/labels affichés issus de constantes).
Côté proto, cherche les composants sidebar/layout back-office dans ${PROTO}/src/components/backoffice/ et le wording dans ${PROTO}/src/lib/backoffice-i18n.ts.
${RULES}`,
    },
    {
        key: 'bo-pages-panels',
        prompt: `Audit de wording. App: ${APP}. Proto (source de vérité): ${PROTO}.
Ton scope app : ${APP}/src/pages/back-office-home/, ${APP}/src/pages/campaigns/, ${APP}/src/pages/analyses/, ${APP}/src/widgets/ (tous les panneaux CRUD : catégories, partenaires, et tout nouveau panneau), ${APP}/src/entities/category/, ${APP}/src/entities/partner/ (titres, boutons, toasts, dialogs, états vides, erreurs).
Côté proto : ${PROTO}/src/pages/backoffice/, ${PROTO}/src/components/backoffice/, ${PROTO}/src/lib/backoffice-i18n.ts.
${RULES}`,
    },
    {
        key: 'hotel-side',
        prompt: `Audit de wording. App: ${APP}. Proto (source de vérité): ${PROTO}.
Ton scope app : ${APP}/src/pages/hotel-home/, ${APP}/src/pages/bar-programme/, ${APP}/src/pages/compliance-files/, ${APP}/src/features/ (côté hôtel : home, bar programme + coming soon, fichiers de conformité).
Côté proto : ${PROTO}/src/components/hotel-home/, ${PROTO}/src/components/hotel-demo/, ${PROTO}/src/components/steps/, ${PROTO}/src/HotelTunnel.tsx si pertinent, ${PROTO}/src/lib/hotel-i18n.ts.
${RULES}`,
    },
    {
        key: 'auth-gates-errors',
        prompt: `Audit de wording. App: ${APP}. Proto (source de vérité): ${PROTO}.
Ton scope app : ${APP}/src/pages/login/, ${APP}/src/pages/forbidden/, ${APP}/src/pages/not-found/, ${APP}/src/app/ui/ (AccessGate, GateError, GateLoading, RoleHome, RequireAuth, RequireRole, layouts), ${APP}/src/app/config/navigation.tsx, ${APP}/src/main.tsx, ${APP}/src/app/App.tsx (login, pages d'erreur, gates, navigation).
Côté proto : ${PROTO}/src/components/auth/, ${PROTO}/src/components/errors/, ${PROTO}/src/components/SsoAccountPicker.tsx, ${PROTO}/docs/pages-erreur.md, et les deux fichiers i18n de ${PROTO}/src/lib/.
${RULES}`,
    },
]

const results = await parallel(UNITS.map(u => () =>
    agent(u.prompt, { label: `lecture:${u.key}`, phase: 'Lecture', model: 'sonnet', schema: FINDINGS_SCHEMA })
))

const ok = results.filter(Boolean)
const filesRead = ok.flatMap(r => r.filesRead)
const raw = ok.flatMap((r, i) => r.findings.map(f => ({ ...f, unit: UNITS[i] ? UNITS[i].key : 'unknown' })))
log(`Lecture terminée : ${ok.length}/${UNITS.length} lecteurs, ${filesRead.length} fichiers lus, ${raw.length} findings bruts`)

const seen = new Map()
for (const f of raw) {
    const key = f.file + '|' + (f.appText || '').slice(0, 60)
    if (!seen.has(key)) seen.set(key, f)
}
const deduped = [...seen.values()]

const EXCLUDED_PATHS = ['pages/forbidden/', 'pages/not-found/', 'app/ui/GateError', 'pages/login/']
const EXCLUDED_KEYS = ['forbidden.', 'notFound.', 'gateError.', 'login.']
const isExcluded = f => {
    const text = `${f.title} ${f.evidence}`
    return EXCLUDED_PATHS.some(p => f.file.includes(p)) || EXCLUDED_KEYS.some(k => text.includes(k))
}
const excluded = deduped.filter(isExcluded)
const toVerify = deduped.filter(f => !isExcluded(f))
log(`Dédup : ${raw.length} → ${deduped.length} ; exclus (écrans 403/404/500 + login) : ${excluded.length} ; à vérifier : ${toVerify.length}`)

phase('Vérification')

const verdicts = await parallel(toVerify.map(f => () =>
    agent(`Tu es un vérificateur adversarial. Un auditeur affirme une différence de wording entre l'app et le proto (source de vérité). Ta mission : le RÉFUTER.
Finding : ${JSON.stringify(f, null, 2)}
App: ${APP} — Proto: ${PROTO}.
Relis les fichiers cités (app ET proto), refais les greps. Cherche si le texte du proto cité est bien celui affiché pour le MÊME écran/élément (attention : le proto peut avoir plusieurs variantes ; l'auditeur a pu comparer au mauvais endroit). Vérifie le verbatim au caractère près (accents, apostrophes ’/', espaces insécables, …/...). Pour un "extra-text", refais les greps du texte app dans TOUT le proto (composants, lib, docs/specs) avant de confirmer qu'il est introuvable.
RÈGLES DE PÉRIMÈTRE (réfutent un finding) :
- Textes d'erreur inventés par l'app pour des états que le proto ne modélise pas (le proto n'émet jamais de toast d'erreur : deleteConflict, undoFailed, error générique, échec réseau) → isReal=false, raison "chemin d'erreur non modélisé par le proto".
- Endroits où le proto laisse du FR figé dans son EN (ex. pagination) alors que l'app traduit proprement → isReal=false.
Différence subjective, hypothétique, ou texte proto mal attribué → isReal=false. Doute → isReal=false.
Retourne {isReal, reason, correctedEvidence?, severity}.`,
        { label: `verif:${f.file.split('/').pop()}:${f.line}`, phase: 'Vérification', model: 'opus', schema: VERDICT_SCHEMA })
        .then(v => ({ f, v }))
))

const confirmed = []
const rejected = []
for (const r of verdicts.filter(Boolean)) {
    if (r.v.isReal) {
        confirmed.push({ ...r.f, severity: r.v.severity ?? r.f.severity, evidence: r.v.correctedEvidence ?? r.f.evidence, verdictReason: r.v.reason })
    } else {
        rejected.push({ ...r.f, refutation: r.v.reason })
    }
}
log(`Vérification : ${confirmed.length} confirmés, ${rejected.length} réfutés`)

return {
    counts: { raw: raw.length, deduped: deduped.length, excluded: excluded.length, confirmed: confirmed.length, rejected: rejected.length, readers: ok.length, filesRead: filesRead.length },
    confirmed,
    rejected,
    excluded,
}
