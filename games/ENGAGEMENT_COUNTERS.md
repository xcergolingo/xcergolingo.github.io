# Community campaign counters
Run \`games/game-campaign-engagement.sql\` in Supabase after Cognito integration to enable **per-account published lesson count and share-action count**.

A "share action" means a successful Copy Link click or a resolved native Web Share API action with a public GoLingo lesson link. It is **not proof that the user shared with a recipient** or that a recipient clicked/played. Browsers are not signed in, so their interactions are not added to account counts. The SQL records actions in Supabase and caps counting to 60 per user per hour as a basic abuse mitigation, not prize verification.

The campaign is collapsed by default on the games page. Public milestone totals update while collapsed; personal activity requires Cognito sign-in through the GoLingo app. A new Share Game action creates a reusable game-gallery link and counts successful copy/native share only for signed-in users.

Sharing helps introduce more players to GoLingo and may help the community reach future planned drawing milestones faster; **it currently does not increase individual odds or count as an entry**.

Cash and car drawings remain proposed, not active. Legal review, verified game-learning events, published sentence verification, claim adjudication and rules are required before eligibility/entry logic goes live.
