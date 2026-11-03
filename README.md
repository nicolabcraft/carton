# Carton

Carton est une extension de [Boite](https://github.com/beboite/boite) : une petite fenêtre qui montre, pour chaque abonnement IA branché dans Boite (Claude, Codex, Copilot...), où en sont ses limites et s'il est rentabilisé.

*English below.*

## Ce que fait la version actuelle

- **Fenêtres de limite** : 5 heures, hebdomadaire, mensuel, telles que Boite les lit chez chaque fournisseur (`quotas.list`).
- **Rythme** : pour chaque fenêtre, la part du temps déjà écoulée avant le reset. C'est la consommation « rentable » attendue à cet instant.
  - Barre verte : consommé jusqu'au rythme.
  - Barre rouge : consommé au-delà du rythme (trop rapide, la limite arrivera avant le reset).
  - Texte : « Encore 5 % à consommer pour tenir le rythme », « Trop rapide : +20 %, limite dans 1 h 30 » ou « Dans le rythme » (écart de 2 points ou moins).
- **Ce mois-ci** : l'équivalent API (au prix public des modèles) des tours passés par Boite depuis le 1er du mois, comparé au prix de l'abonnement. Au-dessus de 100 %, l'abonnement est rentabilisé. Les prix connus sont pré-remplis (Claude Max x5 = 100 $, Max x20 = 200 $, Pro = 20 $...) et se corrigent dans la fenêtre ; ils restent sur ce PC.

- **Boite dans un navigateur** :
  - « Ouvrir sur ce PC » ouvre l'application web de Boite dans le navigateur par défaut, déjà connectée.
  - « Lien pour un autre appareil » donne un lien à copier pour un téléphone ou un autre ordinateur. L'appareil doit joindre ce PC sur le réseau (Réglages de Boite, « Accessible sur le réseau local »).
  - Chaque lien est à usage unique et valable 10 minutes (`pairing.grant`) ; le jeton de Boite ne quitte jamais ce PC.

À part les liens d'accès web, Carton lit seulement ; il ne change rien dans Boite.

## Installation dans Boite

1. Ouvrir Boite, puis **Réglages > Plugins**.
2. Dans **Ajouter depuis une URL git**, coller `https://github.com/nicolabcraft/carton` et laisser la branche vide (branche par défaut).
3. Cliquer **Aperçu** : Boite affiche le nom, la version, l'URL de téléchargement et le SHA-256. Rien n'est téléchargé à cette étape.
4. Cliquer **Installer**. Boite télécharge l'exécutable de la dernière version publiée, vérifie son SHA-256 et lance Carton. La fenêtre « Carton » s'ouvre.
5. Vérifier : la fenêtre affiche « lu à l'instant » et vos abonnements. Si elle reste sur « En attente de Boite », relancer Carton depuis la ligne du plugin (**Redémarrer**).

Mise à jour : refaire les étapes 2 à 4 ; l'aperçu indique la version remplacée.
Désinstallation : bouton **Désinstaller** sur la ligne du plugin. Les prix saisis restent dans le stockage de la fenêtre (dossier `dev.nicolabcraft.carton` des données d'application).

**Sécurité** : comme tout plugin « desktopApp », Carton reçoit le jeton propriétaire de Boite. Il ne l'utilise que pour lire `quotas.list`, `usage.history` et les événements `quotas.updated` et `turn.finished`, et pour demander un lien d'accès web (`pairing.grant`) quand on clique sur un bouton « Boite dans un navigateur ». Le code est ici, et chaque exécutable est construit par GitHub Actions depuis ce dépôt.

## Développement

Prérequis : [Bun](https://bun.sh) 1.4, Rust stable, et sous Linux `libwebkit2gtk-4.1-dev`.

```sh
bun install --frozen-lockfile
bun run check          # types Svelte et TypeScript
bun run test           # calcul du rythme et de la rentabilité
bun run test:scripts   # scripts de release
bun run check:manifest # boite-plugin.json
bun run tauri dev      # la fenêtre, branchée sur le Boite qui tourne (core.json)
```

Hors de la coque, la page se branche avec `?core=http://127.0.0.1:<port>&token=<jeton>`.

Structure :

| Chemin | Rôle |
|---|---|
| `src/lib/core-client.ts` | client JSON-RPC du core de Boite (WebSocket `/rpc`, `hello` en client `plugin`) |
| `src/lib/pace.ts` | rythme d'une fenêtre de limite |
| `src/lib/worth.ts`, `src/lib/plans.ts` | rentabilité du mois et prix des abonnements |
| `src/lib/web-access.ts` | liens d'accès web à Boite |
| `src/lib/store.svelte.ts` | état de l'application |
| `src/components/` | écran (style « Tableau sobre ») |
| `src-tauri/` | coque Tauri 2 : fenêtre, instance unique, adresse du core |
| `scripts/` | vérification et mise à jour de `boite-plugin.json` |

## Publier une version

1. GitHub > **Actions > Release > Run workflow**, saisir la version (`0.2.0`).
2. Le workflow construit les exécutables (Windows x64 obligatoire, les autres plateformes en bonus), publie la release `v0.2.0` avec `SHA256SUMS.txt`, puis ouvre une PR qui écrit les URL et les SHA-256 dans `boite-plugin.json`.
3. Fusionner cette PR : Boite propose alors la nouvelle version.

## Feuille de route

Les fonctionnalités arrivent petit à petit. Idées suivantes : alertes de rythme, historique des fenêtres, conseils de bascule entre comptes, vue par modèle.

---

## English

Carton is a [Boite](https://github.com/beboite/boite) desktop-app plugin. It shows each AI subscription's limit windows (5 hours, weekly, monthly) with their pace: green up to the share of the window's time already elapsed, red beyond it, and how many points are left to use or how far ahead you are. It also weighs the month's API-equivalent cost of Boite's turns against each subscription's price, and opens Boite's web app in a browser with a one-time link (this PC, or another device).

Install: Boite, Settings > Plugins > Add from a git URL, `https://github.com/nicolabcraft/carton`, Preview, Install.

Licence: MIT.
