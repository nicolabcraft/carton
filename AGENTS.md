# Travailler sur Carton

Carton est un plugin « desktopApp » de Boite : Tauri 2 + Svelte 5 + TypeScript. Lire le README.

## Commandes

```sh
bun install --frozen-lockfile
bun run check && bun run test && bun run test:scripts && bun run check:manifest
cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

## Règles

- Code et commentaires en anglais ; README, interface et commits en français (`type: résumé`).
- Carton parle à Boite seulement par le RPC du core (`quotas.list`, `usage.history`, `pairing.grant`, événements). Il ne lit aucun fichier de Boite à part `core.json`.
- Toute la logique de calcul vit dans `src/lib/*.ts`, testée par Vitest ; les composants affichent.
- `boite-plugin.json` n'est modifié que par le workflow Release (version, URL, sha256).
- Pas de tiret cadratin ni demi-cadratin dans les textes visibles, pas d'emoji dans l'interface.
