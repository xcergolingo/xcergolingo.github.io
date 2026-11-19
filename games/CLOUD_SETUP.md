# Cloud synchronization and publishing

This project runs on static GitHub Pages. Cloud syncing is **disabled** unless the owner configures a Supabase backend. Do not replace local history with an unprotected public JSON store.

## Activate

1. Create a Supabase project owned by the GoLingo administrator.
2. Run [cloud-schema.sql](cloud-schema.sql) in the project's SQL editor. This enables Row-Level Security. Keep it enabled.
3. In Supabase Authentication, enable Email magic links or OTP. Configure site URL and authorized redirect URLs for \`https://xcergolingo.github.io/games/\`.
4. Copy \`cloud-config.example.json\` to \`cloud-config.json\`; replace the URL and the **publishable / anon key** from Supabase Project Settings. Never use a service-role or secret key in a browser.
5. Commit \`cloud-config.json\` to GitHub Pages. The publishable anon key is intentionally public; security depends on RLS.
6. Open the gallery, sign in by email, sync lesson history, and opt in to Publish on a saved game lesson.

## Expected behavior

- All locally saved lessons remain private until Publish is clicked and confirmed.
- Authenticated users synchronize histories from the same Supabase project across devices.
- Each game has separate history. The SHA-256 digest of canonical JSON is a per-user, per-game deduplication key.
- Replay moves the lesson to the top without creating a duplicate; published status is not reset by replaying.
- Published lessons are discoverable without authentication. Publication exposes the full lesson JSON.
- The owner can unpublish any of their own lessons. This code does not automatically publish any lesson.
- Local storage remains the offline fallback. Automatic cloud upload attempts on navigation are best-effort; returning to the gallery runs a full reconciliation.
- If browser storage is cleared, cloud lessons can be restored after signing in.
- The gallery only knows about data launched through the gallery. Imports made directly inside individual games require a game-to-gallery callback to be included.
- Data is limited to 100 KB per lesson, 20 recent items per game on-device, and up to 1,500 private cloud items fetched per sync. Add server pagination for larger users.
- Device sign-in in Safari and WKWebView can be separate unless app-side authentication bridges the same account.

## Security

Supabase RLS policies restrict private reads and all writes to their owner. Anonymous users can read only records explicitly marked public. Public sharing is reversible, but third parties may copy published data. Avoid putting sensitive personal information in public lessons. For production, add moderation, rate limiting, abuse reporting, and email verification checks.
