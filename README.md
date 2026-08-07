# Osteoporosis Workout Plan

A private, IST-aware workout and recovery tracker for a family-managed osteoporosis exercise plan.

The app includes:

- password-gated patient/admin access
- a weekly workout plan
- guided workout flow with exercise previews
- YouTube demo embeds
- walk countdown timer
- pain-before and pain-after tracking
- session history
- admin editing for doses and video URLs

This repository is a sanitized public template. It does not include real patient details, production passwords, or deployment credentials.

## Stack

- Vinext / Next-style app routing
- Cloudflare D1 for plan and session storage
- Cloudflare Worker-compatible build
- TypeScript

## Requirements

- Node.js `>=22.13.0`

## Local Setup

```bash
npm install
npm run dev
```

The app expects auth users and a session secret in local/private environment values.

Create `.dev.vars` locally:

```env
SESSION_SECRET=replace-with-a-long-random-secret
AUTH_USERS=[{"email":"patient@example.com","role":"viewer","salt":"replace-salt","hash":"replace-hash"},{"email":"admin@example.com","role":"admin","salt":"replace-salt","hash":"replace-hash"}]
```

`AUTH_USERS` stores salted SHA-256 hashes in the shape expected by `app/lib/auth.ts`.

Do not commit `.dev.vars`, `.env`, real email addresses, real patient data, or generated passwords.

## Deployment Notes

`.openai/hosting.json` is intentionally sanitized. Set the real Sites `project_id` only in your private deployment copy.

The D1 binding name is `DB`.

## Safety

This app is software for organizing a prescribed exercise plan. It is not medical advice. Any progression should be reviewed against the patient's clinician/physiotherapist guidance, symptoms, fracture history, and medication context.

The sample plan avoids loaded spinal flexion, twisting, jerky movements, and high-impact work.

## Useful Commands

```bash
npm test
npm run build
```
