# GoLingo Streak Medals & Prize Campaign Proposal

## Implemented preview
- Public: total accounts still on a streak (last recorded launch UTC today/yesterday), total ever reaching 365 days, total currently at 365+ consecutive days; aggregate counts by highest-earned medal (silver 365+, gold 730+, diamond 1095+). No identities exposed.
- Signed-in account: displays highest **earned** medal based on longest consecutive recorded launch streak, and a separate **current** streak. A medal remains after a streak break; draw qualification would still require a currently unbroken streak of 365+.
- Data comes from Supabase server-created UTC daily gallery-launch records; not verified gameplay. No prizes or lottery are activated.
- SQL setup: run games/game-streak-public-totals.sql after game-streak-schema.sql.

## Proposed marketing (not live offers)
- 365-day milestone: silver medal; proposed $100 participation reward after validated daily game learning and sentence publishing under official rules.
- 730 days: gold medal. 1,095 days: diamond medal.
- **Recurring cohorts, not one-time milestones:** for **every complete group of 100 unique Silver achievers**, conduct one proposed drawing for **one $1,000 winner**; for **every complete group of 1,000 unique qualifying achievers**, conduct one proposed drawing for **one $10,000 winner**; for **every complete group of 10,000 unique qualifying achievers**, conduct one proposed drawing for **one Tesla Model 3 winner**. Examples: 300 distinct Silver achievers = 3 proposed $1,000 drawings; 2,000 distinct eligible achievers = 2 proposed $10,000 drawings. These counts are illustrative only; actual award cohorts have not begun.
- Eligibility and cohort design must be fixed in official rules: uniquely count each achiever, specify who enters each successive drawing, whether previous non-winners remain eligible or winners may re-enter, whether gold/diamond achievers also count toward Silver cohorts, cutoff dates, drawing timing, caps, privacy, geographic eligibility, vehicle model/specification/retail value, taxes, fulfillment, verification and appeals. A current, verified streak of 365 or more days is required at each proposed draw deadline.
- A person must have a currently active verified 365+ day streak at any drawing deadline for proposed eligibility.
- Paid GoLingo subscription is NOT required.
- An App Store review must NOT be required to receive a reward, or incentivized by any cash prize. Apple does not permit this. Optional, honest feedback may be invited independently, without any effect on eligibility, prizes or odds.
- Referral or share-based extra lottery entries are NOT active. Do not promise increased odds until counsel has confirmed a legally compliant no-purchase alternative with equal access, transparent odds and anti-spam restrictions.
- Any sentence publishing must be confirmed with a trusted server-side event, and checked for user consent and content quality before qualification.
- No automatic winner selection, automatic cash payouts, vehicle purchases, or claims of confirmed eligibility are included.

## Proposed enrollment deadline policy — requires approval before activation
- After publication of official rules, GoLingo may prospectively extend or amend **future enrollment deadlines** with advance public notice, only where permitted by the binding rules and applicable law.
- A user who is officially enrolled and has started documented qualifying daily learning before the previously published enrollment cutoff is **grandfathered**: their eligibility to pursue the $100 completion reward, and the relevant completion window and conditions in the official rules, cannot be withdrawn retroactively because GoLingo changes or closes enrollment to newcomers.
- A missed day, fraud, noncompliance, or inability to verify genuine play and sentence publication can still affect qualification under the original rules. Grandfathering is not a payment guarantee absent verified completion, and today's beta streaks do not count as official enrollment by themselves.
- The final terms must define when a user becomes an entrant, how a qualifying start is recorded, how long existing entrants have to complete 365 days after enrollment closes, what announcements are required and whether authorities must approve any modification. Never advertise an unrestricted right to change an active prize promotion's rules or deadline at any time.

## Before launch
Get counsel to draft jurisdiction-specific Official Rules, funding/escrow, winner vetting, taxes, privacy, promotion registrations and an appeal mechanism. For Florida, consult F.S. §849.094 and FDACS game promotions guidance for prizes over $5,000. Public counter metrics can be displayed only as telemetry; they are not authoritative winner counts. All reward language should clearly say "planned" / "coming soon".
