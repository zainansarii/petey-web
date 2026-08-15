# Petey web

A trainee-only web adaptation of Petey's mobile discovery and onboarding experience. The flow starts with a trainer carousel, moves into a compressed matching questionnaire after one scroll gesture, and asks for identity plus email magic-link authentication only at the end.

## Run locally

```bash
npm install
npm run dev
```

`npm run verify` runs linting, type-checking, unit tests, and a production build.

## Firebase email-link authentication

The app works as a complete interaction prototype without Firebase. In that mode, the final screen offers a **Preview matched feed** action instead of sending email. Trainer profiles and introduction requests are demo-only in every mode; the UI never claims that a request was delivered.

For real web magic links, copy `.env.example` to `.env.local` and provide a Firebase Web app configuration. Enable Email/Password > Email link in Firebase Authentication and add both `localhost` and the deployed GitHub Pages domain to Firebase Authentication's authorised domains.

The mobile app's current callable and redirect are intentionally not reused: they enforce App Check and hand links to the native app. This web build uses Firebase's Web SDK and returns to the current GitHub Pages URL.

## GitHub Pages

The included workflow builds and deploys `dist/` on pushes to `main`.

1. In the GitHub repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. Push this repository to GitHub.
3. Optional: add the following repository variables under **Settings → Secrets and variables → Actions → Variables** to enable real email delivery:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

Vite uses relative asset paths, so the same build works at a project Pages URL such as `https://zainansarii.github.io/petey-web/` and at a custom domain.

Use the default project Pages URL for the Firebase-free prototype. Before enabling real authentication or collecting user information, use a dedicated custom domain: every repository under `username.github.io/*` shares the same browser-storage origin.

## Product integration note

Non-sensitive choice answers are kept in session storage. Postcode, optional free text, health consent, name, and date of birth stay in memory. The email address is saved only as required to complete a Firebase email-link sign-in and is removed after successful authentication or a failed send. An abandoned or expired flow may leave it in browser storage until that site data is cleared.

Firebase Web configuration enables the email sign-in round trip, but it does not persist the signup profile or send trainer introductions. A production handoff still needs a short-lived server-side signup draft so a link opened in a new tab or device can safely recover the trainee's answers without putting personal data in the URL.

The existing mobile completion endpoint also requires verified phone state, while its OTP implementation is native-only. Shipping this lower-friction web flow against the production backend therefore requires a deliberate backend policy/API update (or a web phone-verification step after sign-in); this repository does not bypass that requirement.
