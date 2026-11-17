# Deploying Daily Gambit (Cloudflare Pages + private login)

The app is a static site: `python3 build.py` produces `dist/`. These steps publish it on Cloudflare Pages for free, rebuild it automatically on every push to `main`, and put a login in front of it so only the people you choose can open it.

## 1. Create the Pages project

1. Create a free Cloudflare account at <https://dash.cloudflare.com/sign-up> (if you don't have one).
2. In the dashboard open **Workers & Pages → Create → Pages → Connect to Git**, authorise GitHub and pick this repository.
3. Build settings:
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** `python3 build.py`
   - **Build output directory:** `dist`
4. **Save and Deploy.** After a minute the app is live at `https://<project>.pages.dev`.

Every push to `main` now redeploys automatically; pushes to other branches get their own preview URL.

`public/_headers` is picked up automatically (no-cache for the service worker and `index.html`, correct type for the Stockfish `.wasm`).

## 2. Allow only your family (Cloudflare Access)

Cloudflare Access is free for up to 50 users. People sign in with a one-time code sent to their email (or Google, if you set it up).

1. In your Pages project go to **Settings** and select **Enable access policy**. This first protects only the preview URLs.
2. Select **Manage** on the Access policy that was created.
3. Under **Access → Applications** select your project, then **Configure**.
4. Under **Public hostname**, in the **Subdomain** field, delete the wildcard `*` and **Save** (rename the application if the dashboard complains). Now `<project>.pages.dev` itself is protected.
5. Go back to the Pages project → **Settings → General** and select **Enable access policy** again, so preview URLs stay protected too. You should now see two Access applications.
6. Edit the **policy** of both applications:
   - **Action:** Allow
   - **Include → Emails:** the email addresses of the people allowed in (e.g. yours and your child's), nothing else.
   - **Login method:** One-time PIN (needs no extra setup).
   - **Session duration:** e.g. 1 month, so you rarely have to sign in again.
7. Open the site in a private window to check: you should see Cloudflare's sign-in page, and only the listed emails receive a code.

Using a custom domain later? Add it to the Pages project, then in **Zero Trust → Access controls → Applications** create a **self-hosted** application for that domain with the same policy — otherwise the sign-in page appears but doesn't work for that domain.

## 3. Install it on the phone

Open the site in Chrome on Android, sign in, and tap **📲 Install app** (or Chrome menu → **Install app / Add to home screen**). After the first visit everything (lessons, puzzles, Stockfish, sounds, fonts) works offline.

- **Progress is stored on the phone.** Use **Log → Backup → Download backup** now and then; **Restore from backup** brings it back on a new phone.
- **Updates:** when a new version is deployed, the app shows *New version — tap to update* the next time it's opened online.
- **Signing in again:** when the Access session expires, the installed app keeps working offline from its saved copy; you only sign in again (when online) to receive updates.

## Moving progress from the claude.ai version

In the claude.ai version open **Log → Backup → Copy backup**, send the text to the phone (e.g. email it to yourself), then in the installed app use **Log → Backup → Restore from backup** and paste it.
