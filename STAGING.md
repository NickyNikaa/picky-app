# Staging-Branch — picky.

Diese Version ist die **Testumgebung**. Hier landen neue Features, bevor sie auf Production gehen.

## URLs

| Umgebung    | Branch     | URL                                       |
|-------------|------------|-------------------------------------------|
| Production  | `main`     | https://picky-app-puce.vercel.app         |
| Staging     | `staging`  | siehe Vercel-Dashboard (automatisch generiert) |

## Workflow

Lokal/Chat → ich pushe nach `staging` → Vercel deployed automatisch → du testest auf Preview-URL → wenn ok: merge in `main` → Vercel deployed Production.

## Daten

Staging teilt sich aktuell dieselben Daten mit Production (gleicher Gist, gleiche Env-Vars). Wenn du separate Test-Daten willst, sag Bescheid.

## Promote Staging → Production

```bash
git checkout main && git merge staging && git push origin main
```
