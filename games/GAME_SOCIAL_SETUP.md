# GoLingo community and global game statistics

## Apply the new database migration

Open your Supabase project **SQL Editor** and run [game-social-schema.sql](game-social-schema.sql). This creates:
- Public aggregate launch/like counts for all visitors.
- A like record per Cognito account and game; repeat likes from the same account don't double-count.
- Private favorites per Cognito account, readable/writable only by that user.
- A per-device, per-game ten-second cooldown for counted launches.
- RPC functions that atomically update counts; browser clients never get direct write access to aggregate totals.

**The migration has not been run by GitHub commits.** Until you run it, counts are not globally available. Device-only historical counts are **not** automatically summed: doing so would overcount visitors across devices.

## Public lessons

Published lessons are stored in \`golingo_game_lessons\` with \`is_public = true\`. The existing Cognito RLS policy permits public SELECT for \`anon\` and \`authenticated\`. The gallery now shows an expanded community lesson list with a count and a refresh button. When a visitor cannot see published lessons, inspect the gallery's community status message and verify in SQL Editor:

\`\`\`sql
select game_id,title,is_public,last_played_at
from public.golingo_game_lessons
where is_public = true
order by last_played_at desc limit 20;
\`\`\`

If rows exist but the list is blank, check that the \`game_id\` exists in the current gallery and that the browser can query the published rows anonymously. Do not disable RLS or expose private lessons.

## Privacy and limitations

- Public counts are **recorded gallery launches**, not actual completed gameplay sessions, and exclude historical device-only totals.
- Guests may launch games and contribute to launch totals after the gallery can reach the cloud.
- Likes/favorites require Cognito login. Favorites follow the account across browsers/app.
- The play counter's basic ten-second per-device guard is not a fraud-proof analytics system. For high-volume launches, implement server-side rate-limiting/bot protection and table maintenance.
- Apple-only native login still requires verified Cognito federation/account linking before cloud favorites can follow that identity.
