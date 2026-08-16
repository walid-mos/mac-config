# Audit des skills `nextnode-deploy` & `nextnode-infra`

**Date** : 2026-08-16
**Cibles** : `claude/.claude/skills/nextnode-deploy/` (17 fichiers) et `claude/.claude/skills/nextnode-infra/` (2 fichiers)
**Référentiel de vérité** : `~/Development/nextnode/core` @ `7185a94` (HEAD main)
**Méthode** : double review adversariale par subagents indépendants —
- **Grok 4.6** (`xai/grok-4.6`) : réfutation factuelle des affirmations contre le code source à HEAD
- **DeepSeek v4 Flash** (`openrouter/deepseek/deepseek-v4-flash`) : qualité structurelle, contradictions internes, portabilité pi

## Contexte : le problème de synchronisation

| Skill | `synced-at` | Retard sur HEAD |
|---|---|---|
| nextnode-deploy | `e2d2030` (2026-07-22) | **65 commits** |
| nextnode-infra | `444e619` (2026-06-03) | **230 commits** |

Les skills décrivent le code tel qu'il était à ces commits. Une partie des findings est du drift pur ; une autre part (contradictions internes) existait déjà au point de sync.

---

## CRITIQUE

### C1 — `nextnode-infra` documente Supabase comme service vivant
- `cicd-checklist.md` : section entière « Supabase (self-hosted stack) » (`[services.supabase]`, `DASHBOARD_PASSWORD`, `ANON_KEY`…), avec lien mort vers `supabase-service.md` (inexistant).
- `SKILL.md` infra : gate d'audit « R2/Postgres/Supabase ».
- **Réalité** : `grep supabase packages/infrastructure/src` = 0 hit. `SERVICE_NAMES` ne contient pas `supabase`. Le skill deploy dit explicitement « removed — do not document it as available ».
- **Impact** : un audit suivant `/nextnode-infra` exige un service inexistant.

### C2 — Barrières Workers (`rate_limit` / `public_paths` / `limits` / `[[rate_limiters]]`) fantômes
- Documentées en détail : règle 35 du SKILL.md deploy + chapitre complet de `cloudflare-workers.md` (schéma TOML, defaults, validation « refused at load », règles Pro/Paid).
- **Réalité** : aucun de ces 4 champs n'existe dans `WorkerServiceConfig` (`config/types.ts`) ; aucun fichier firewall sous `src/`. Valibot `object()` non-strict → un `rate_limit` écrit dans `nextnode.toml` est **silencieusement ignoré**.
- **Impact** : config morte en production, sécurité crue active mais absente.

### C3 — Snapshot pre-migrate : infra l'exige, le code l'a retiré
- `cicd-checklist.md` : « snapshot taken automatically before each migrate-remote run ».
- **Réalité** : `migrate-remote.command.ts` : « No pre-migrate snapshot is taken » (wal-g couvre). Le skill deploy (règle 29) dit aussi non → contradiction interne.

### C4 — Gating D1 par `detect-migration-changes` : retiré à HEAD
- `pipeline.md` + `cloudflare-workers.md` : DAG `detect-migrations` → migrate si `has_d1 && migrations_changed`.
- **Réalité** (commit `0aa6399`) : `deploy-workers.yml` n'a plus de job `detect-migrations` ; `migrate` tourne à chaque deploy dès que `[services.d1]` est déclaré. `PIPELINE_BASE_SHA` ne sert plus que pour postgres/Hetzner.

### C5 — Drift-guard `generate-worker-types` retiré ; package `worker-types` non documenté
- Règle 33 + `cloudflare-workers.md` : « types committed, CI regenerates + `git diff --exit-code` dans le job plan ».
- **Réalité** (commit `e105987`) : types générés au build, plus de drift-guard, plus d'appel dans les workflows. Et `@nextnode-solutions/worker-types` (package publié, `bin: worker-types`, workflow dédié) est absent de la table des packages d'infra.

### C6 — Commande `check-secrets` absente des deux skills
- Ajoutée post-sync (commit `bf6945d`) : `DEPLOY_COMMANDS` dans `index.ts`, job dédié dans les 3 pipelines (`deploy.yml`, `deploy-workers.yml`, `deploy-static.yml`), `provision`/`build-image` en dépendent.
- Aucune mention dans la table CLI ni les DAG documentés.

### C7 — Mauvais nom du secret org HCP : `TF_API_TOKEN` vs `TF_CLOUD_TOKEN`
- `config.md` + `cloudflare-workers.md` : « org secret `TF_API_TOKEN` ».
- **Réalité** : tous les workflows mappent `TF_TOKEN_app_terraform_io: ${{ secrets.TF_CLOUD_TOKEN }}`. Déjà faux au point de sync.
- **Impact** : provision Workers meurt sur `TF_TOKEN_app_terraform_io env var is required`.

### C8 — Checklist infra exige un `docker-compose.yml` caller : le code l'interdit
- `cicd-checklist.md` : « minimal `docker-compose.yml` with one compose service key per declared service ».
- **Réalité** : `hetzner-caller.md` + `compute-image-ref.command.ts` : « the caller ships **no** `docker-compose.yml` » — compose rendu par l'infra.
- **Impact** : faux positifs et faux négatifs d'audit garantis.

---

## MAJEUR

| # | Skill | Finding |
|---|---|---|
| M1 | deploy | `compute-image-ref` classé `standalone` ; c'est un `DEPLOY_COMMAND` (skip pour `type=package`, exige `PIPELINE_CONFIG_FILE`) |
| M2 | deploy | « `migrate-remote` no-op without postgres » : faux, il dispatche aussi D1 (`wrangler d1 migrations apply --remote`) |
| M3 | deploy | `DeployableConfig` documenté comme union à 2 membres ; le code en a 3 (`CloudflareWorkersDeployableConfig`). Snippet `WorkerServiceConfig` amputé de `observability` |
| M4 | deploy | `SERVICE_NAMES` n'est plus dans `config/types.ts` mais `config/service-config.ts` ; d'autres defaults vivent dans `wrangler-document.ts` et `plan.command.ts` (règle 4 à nuancer) |
| M5 | deploy | `compatibility_date` documentée `2026-07-14` ; code = `'2026-06-01'`. Le `compatibility-drift.test.ts` et le dossier `standards/workers/` cités n'existent pas |
| M6 | infra | Checklist exige `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` pour tous targets ; le target Workers ne projette plus de creds R2 (bindings wrangler) depuis `61ee0e6` |
| M7 | deploy | `hetzner-vps.md` : cloud-init décrit comme installant Docker/Caddy/Vector ; le code (`renderProjectCloudInit`) ne fait que Tailscale + UFW (tout est dans la golden image) |
| M8 | deploy | Carte des modules morte : `provision-vps.ts`, `hcloud-*.ts`, `ssh-session.ts`, `terraform-*.ts`, `cloudflare-pages-env.ts` ont tous été déplacés/renommés (sous-dossiers `provision/`, `api/`, `ssh/`, `domain/cloudflare/workers/`, `cloudflare/pages/`) |
| M9 | deploy | Healthcheck documenté `http://localhost:<port>/healthz` ; le code utilise `127.0.0.1` (bug IPv6 `::1` corrigé par `474da69`) — copier le skill réintroduit le bug |
| M10 | infra | Monitoring décrit « Astro 5 » ; package.json = Astro `^6.1.9`. Table des packages incomplète (7 packages à HEAD) |
| M11 | infra | Checklist workflows omet `deploy-workers.yml` (workflow canonique du target Workers) |
| M12 | deploy | `structure.md` prétend que `worker-vars.ts` injecte des « symmetric URLs » ; la règle 31 dit l'inverse (jamais de `<NAME>_URL` sibling sur Workers) — le code suit la règle 31 |
| M13 | infra | Table des packages : `infrastructure` « never published » vs checklist « installed == npm latest » pour ce même package (item inexécutable) |
| M14 | deploy | Règle 25 : « REVERSES the earlier rule » — la règle révoquée n'existe plus dans le fichier (trace historique confuse) |
| M15 | deploy | `pipeline.md` omet les workflows ops `prune-postgres-backups.yml` et `reconcile-tailnet-acl.yml` (existants au point de sync — incohérence interne, pas du drift) |

## MINEUR

- Numérotation des règles infra : 1, 2, 3, **6** (4-5 supprimées sans renumérotation)
- `wipeBackups` (cicd-checklist) vs `--wipe-backups` partout ailleurs
- DAG de la checklist infra incomplet (omet `detect-migration-changes` + `migrate`)
- `pipeline.md` : « Four reusable workflows » puis en liste cinq ; nom de job `detect-migration-changes` vs `detect-migrations` dans le YAML
- `migrations_folder` default écrit `drizzle/` ; le littéral code est `drizzle`
- `canary_on_label` utilisé dans 2 `nextnode.toml` du repo mais ni parsé ni documenté nulle part
- `deploy-workers.yml` ne forwarde pas `PLANETSCALE_SERVICE_TOKEN_*` (résiduel côté source)
- Duplication substance dans SKILL.md deploy : sections Observability/cron/SEO guard ≈ leurs références (risque de drift — déjà matérialisé par C3/C8)
- Références `CLAUDE.md` (convention Claude Code) — sous pi c'est `AGENTS.md` qui est auto-chargé

## Portabilité pi (findings DeepSeek)

1. **5 références de skills frères mortes sous pi** : `/nextnode-standards`, `/nextnode-logger`, `/nextnode-design`, `cloudflare-cost`, `/ssh-nextnode` — aucun n'est importé dans `~/.pi/agent/skills/`. La dispatch MANDATORY d'infra en dépend.
2. **Syntaxe `/skill`** = convention Claude Code, non résolue par pi → réécrire en noms de skills ou chemins.
3. **Frontmatter** : `user-invocable` et `synced-at` non standard pour pi (à déplacer dans le corps). Les `description` sont en revanche déjà excellentes (triggers concrets).
4. Points sains vérifiés : liens relatifs 100 % valides (hors `supabase-service.md`), zéro chemin absolu, table CLI exacte au point de sync, hub-and-spoke bien construit.

---

## Verdict

**« Bien construit, mal synchronisé, partiellement contradictoire. »**

- `nextnode-infra` (230 commits de retard) est le plus dangereux : il prescrit Supabase, un compose caller et un snapshot pre-migrate — trois comportements que le code rejette — et omet Workers, `worker-types` et `check-secrets`.
- `nextnode-deploy` (65 commits) reste fiable sur le cœur Hetzner/postgres/cron, mais ment sur trois contrats Workers (barrières fantômes, gating D1, drift-guard types) et sur le nom du secret HCP.
- La règle 1 du skill (« Check the code, not assumptions ») est violée par les skills eux-mêmes.

## Plan d'action (exécuté le 2026-08-16)

1. **Resync des deux skills contre HEAD `7185a94`** — correction des C1-C8, M1-M15 et mineurs, vérification de chaque correction contre le code, mise à jour `synced-at`.
2. **Import dans pi** (`~/.pi/agent/skills/`) — adaptation frontmatter, réécriture des références `/skill`, import des skills frères pour rendre la dispatch fonctionnelle.
3. Recommandation durable : traiter `synced-at` comme un contrat — toute PR touchant `packages/infrastructure` devrait déclencher une revue des skills.
