# GoLingo 365-Day Game Challenge — launch checklist

## Tracking
The gallery records **one authenticated game launch per UTC calendar date** in Supabase, attached to the Cognito \`sub\`. The first launch creates day 1; an additional launch on the same date does not increase the streak. Following calendar days increase the streak; a missing UTC day resets the displayed current streak. The longest streak and the date of first 365-day milestone are retained. Dates are assigned by the Supabase server, not the phone clock.

To enable, run \`games/game-streak-schema.sql\` once in your Supabase SQL Editor. There is no backfill of earlier play counts. The account must be logged in before the game launch. The website waits briefly for its server acknowledgment before opening a game.

**Limitations:** a click opening a game is not proof of playing or learning; a user may launch games directly rather than through the gallery; an offline launch might fail to register; and a token/session/network error can miss the day. Therefore, this is a game-launch streak **beta**, not sufficient to adjudicate cash eligibility. A prize campaign requires verified in-game activity events, anti-abuse measures, robust event ingestion, replay protection, a claim review process and failure/appeal procedures.

## Cash award campaign — pending approval
The marketing page says **“365-day challenge — potential $365 reward”** and **“Campaign coming soon; official rules and eligibility pending.”** It makes NO promise that current tracking earns money. Do not activate the cash offer or advertise it as guaranteed until the operator has:
1. Established budget, reward cap and whether all qualifying people are paid; e.g., 100 winners = $36,500.
2. Published terms (start/end dates, time zone, age/location eligibility, what counts as a verified play/day, missed-day and outage policy, how winners claim, time to payout, verification and disputes, taxes).
3. Obtained promotion/legal review for every target jurisdiction. In Florida, certain promotions with prize values exceeding $5,000 in the aggregate have registration and financial security requirements if their structure qualifies under the state's game promotion rules.
4. Implemented an authenticated verified-gameplay event service and payout workflow. No automatic cash transfers are made by this feature.

GoLingo founder/administrator must decide activation date. Today's beta events must not be retroactively treated as a binding reward offer unless expressly included in finalized official rules.
