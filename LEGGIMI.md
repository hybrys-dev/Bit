# Kit di bootstrap di Bit

Questo kit trasforma un repository vuoto nella fabbrica descritta nel documento di design: issue, agente cloud, PR, CI, sicurezza e review AI, merge automatico. Contiene tutto ciò che gli agenti non possono scrivere da soli, a partire dai workflow.

## Contenuto

| Percorso | Cosa fa |
| --- | --- |
| `repo/.github/workflows/ci.yml` | CI con un solo check obbligatorio, `ci-ok`: lint, typecheck, test, build, Rust, titolo PR, dependency review, zizmor |
| `repo/.github/workflows/ai-review.yml` | Review di Claude in sola lettura; il check `ai-review` fallisce se ci sono problemi bloccanti |
| `repo/.github/workflows/agent-implement.yml` | Corsia Autopilota: prende le issue `agent:ready` e apre le PR |
| `repo/.github/workflows/agent-fix.yml` | Se CI o review falliscono, Claude corregge la PR, al massimo 3 volte |
| `repo/.github/workflows/agent-plan.yml` | Planner: nei giorni feriali crea le prossime issue dalla roadmap |
| `repo/.github/workflows/automerge.yml` | Auto-merge per le PR fidate e per gli aggiornamenti Dependabot patch e minor |
| `repo/.github/workflows/release.yml` | release-please e build Tauri; spento fino alla fase 5 |
| `repo/.github/workflows/repo-setup.yml` | Crea le etichette, da lanciare una volta |
| `repo/.github/CODEOWNERS` | Guardrail: le modifiche a `.github/`, `.claude/`, `AGENTS.md`, `CLAUDE.md` aspettano il tuo ok |
| `repo/AGENTS.md`, `repo/CLAUDE.md`, `repo/.claude/` | Regole e ambiente per tutti gli agenti, comprese le sessioni Claude Code on the web |
| `repo/docs/ARCHITECTURE.md`, `repo/docs/ROADMAP.md` | Il contratto che gli agenti implementano e il piano che il planner legge |
| `setup/ruleset-main.json` | Ruleset da importare se il repo è di un'organizzazione (con merge queue) |
| `setup/ruleset-main-personal.json` | Variante per un repo personale, senza merge queue |

Le Actions sono fissate per SHA alle versioni di ottobre 2026. I workflow passano actionlint, zizmor e gli schemi ufficiali di GitHub.

## Setup, tutto dal browser (circa mezz'ora)

1. **Organizzazione e repo.** Crea un'organizzazione GitHub gratuita e, dentro, il repo pubblico `bit` con un README iniziale.
2. **CODEOWNERS.** Nel file `repo/.github/CODEOWNERS` sostituisci `@OWNER` con il tuo username GitHub. Con un owner non valido GitHub ignora la regola e i guardrail non proteggono nulla.
3. **Primo commit.** Nella pagina del repo scegli *Add file → Upload files* e trascina il **contenuto** della cartella `repo/`, comprese le cartelle che iniziano col punto (nel Finder di macOS `Cmd+Shift+.` le mostra). Messaggio: `chore: bootstrap`. È l'unico commit manuale, perché l'app di Claude non può scrivere i workflow.
4. **App Claude.** Installa github.com/apps/claude e concedila al solo repo `bit`.
5. **Token per i modelli**, uno dei due:
   - abbonamento Claude: apri un Codespace qualsiasi (va bene il modello *Blank* su github.com/codespaces), esegui `npm i -g @anthropic-ai/claude-code`, poi `claude setup-token`, e copia il token;
   - consumo a token: crea una chiave nella console Anthropic.
6. **App `bit-automation`.** Impostazioni dell'organizzazione → *Developer settings* → *GitHub Apps* → *New GitHub App*:
   - Webhook: disattivato.
   - Permessi del repository: Actions, Contents, Issues e Pull requests in *Read and write*; Metadata in sola lettura (obbligatorio). Tutto il resto *No access*, in particolare Workflows e Administration.
   - Installabile solo su questo account.
   - Dopo la creazione: annota il **Client ID**, genera una **private key** (file .pem) e installa l'app sul solo repo `bit`.
7. **Variabili** (repo → *Settings → Secrets and variables → Actions → Variables*):
   - `BIT_APP_CLIENT_ID` = il Client ID dell'app
   - `AUTOMATION_ENABLED` = `true`
   - `MAX_AGENT_PRS` = `3`
   - `RELEASE_ENABLED` = `false`
   - opzionali: `CLAUDE_MODEL_IMPLEMENT`, `CLAUDE_MODEL_REVIEW`, `CLAUDE_MODEL_PLAN` (default `opus`) e `PLANNER_QUEUE_SIZE` (default `5`)
8. **Segreti** (stessa pagina, scheda *Secrets*):
   - `BIT_APP_PRIVATE_KEY` = il contenuto del file .pem
   - `CLAUDE_CODE_OAUTH_TOKEN` oppure `ANTHROPIC_API_KEY`
9. **Pull request** (*Settings → General*): lascia attivo solo *Allow squash merging*, con messaggio predefinito "Pull request title and description"; attiva *Allow auto-merge* e *Automatically delete head branches*.
10. **Actions** (*Settings → Actions → General*): *Workflow permissions* su "Read repository contents and packages permissions"; lascia spento "Allow GitHub Actions to create and approve pull requests".
11. **Sicurezza** (*Settings → Advanced Security*): Dependabot alerts e security updates, Secret scanning con Push protection, CodeQL in *Default setup*, Private vulnerability reporting.
12. **Ruleset** (*Settings → Rules → Rulesets → New ruleset → Import a ruleset*): `setup/ruleset-main.json`, oppure la variante personale.
13. **Avvio.** In *Actions* lancia "Repo setup", poi "Agent plan". Da qui la pipeline gira da sola.

## Dopo l'avvio

- Il planner crea le issue della fase corrente; "Agent implement" le prende in ordine, fino a 3 lavori in parallelo.
- Ogni PR passa da `ci-ok` e `ai-review`; con i check verdi entra nella merge queue e si unisce da sola.
- Se un check fallisce, "Agent fix" ci riprova fino a 3 volte; poi mette l'etichetta `needs-human` e ti avvisa.
- Le PR che toccano i guardrail aspettano la tua approvazione, compresi gli aggiornamenti settimanali di Dependabot sulle Actions.
- Puoi lavorare anche in Claude Code on the web o con Agent HQ: quelle PR seguono gli stessi cancelli.

## Come intervenire

- **Pausa totale:** variabile `AUTOMATION_ENABLED` = `false`.
- **Proporre un task:** apri una issue col modello "Agent task", poi aggiungi tu l'etichetta `agent:ready`.
- **Bloccare un merge:** etichetta `do-not-merge` sulla PR.
- **Etichetta `needs-human`:** leggi l'ultimo commento dell'agente, chiarisci la issue oppure chiudi la PR.

## Da verificare al primo giro

- **Ruleset:** "0 approvazioni + review dei code owner" serve a chiedere il tuo ok solo sui guardrail. Se GitHub non accetta la combinazione, la soluzione è un secondo ruleset dedicato ai guardrail.
- **Merge queue:** è disponibile solo nei repo pubblici di un'organizzazione; per un repo personale usa la variante senza.
- **CodeQL:** la configurazione predefinita parte davvero solo quando nel repo c'è codice analizzabile.
- **Release:** `release.yml` è una bozza spenta. Va validata in fase 5 con una release di prova, insieme alle chiavi dell'updater e all'environment `release` (consenti solo il branch `main`).

## Costi

Su un repo pubblico Actions, CodeQL e secret scanning sono gratuiti. Il costo vero sono i modelli: con `CLAUDE_CODE_OAUTH_TOKEN` la pipeline consuma i limiti del tuo abbonamento, con `ANTHROPIC_API_KEY` paghi a consumo. Per contenerlo usa `MAX_AGENT_PRS`, `PLANNER_QUEUE_SIZE` e modelli più piccoli nelle variabili `CLAUDE_MODEL_*`.
