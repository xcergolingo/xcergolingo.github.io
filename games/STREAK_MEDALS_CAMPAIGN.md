# GoLingo Streak Medals & Prize Campaign Proposal

## Implemented preview
- Public: total accounts still on a streak (last recorded launch UTC today/yesterday), total ever reaching 365 days, total currently at 365+ consecutive days; aggregate counts by highest-earned medal (silver 365+, gold 730+, diamond 1095+). No identities exposed.
- Signed-in account: displays highest **earned** medal based on longest consecutive recorded launch streak, and a separate **current** streak. A medal remains after a streak break; draw qualification would still require a currently unbroken streak of 365+.
- Data comes from Supabase server-created UTC daily gallery-launch records; not verified gameplay. No prizes or lottery are activated.
- SQL setup: run games/game-streak-public-totals.sql after game-streak-schema.sql.

## Proposed marketing (not live offers)
- 365-day milestone: silver medal; proposed $365 participation reward after validated daily game learning and sentence publishing under official rules.
- 730 days: gold medal. 1,095 days: diamond medal.
- Potential prize drawings for 100 silver medal holders (one $1,000 award), 1,000 verified eligible participants (one $10,000 award), and 10,000 verified eligible participants (one Model 3 or equivalent prize). The definitions of thresholds, caps, drawing frequencies, geographic eligibility, vehicle specification, approximate retail value, tax burden and the handling of repeat medals/winners must be fixed in the official rules.
- A person must have a currently active verified 365+ day streak at any drawing deadline for proposed eligibility.
- Paid GoLingo subscription is NOT required.
- An App Store review must NOT be required to receive a reward, or incentivized by any cash prize. Apple does not permit this. Optional, honest feedback may be invited independently, without any effect on eligibility, prizes or odds.
- Referral or share-based extra lottery entries are NOT active. Do not promise increased odds until counsel has confirmed a legally compliant no-purchase alternative with equal access, transparent odds and anti-spam restrictions.
- Any sentence publishing must be confirmed with a trusted server-side event, and checked for user consent and content quality before qualification.
- No automatic winner selection, automatic cash payouts, vehicle purchases, or claims of confirmed eligibility are included.

## Before launch
Get counsel to draft jurisdiction-specific Official Rules, funding/escrow, winner vetting, taxes, privacy, promotion registrations and an appeal mechanism. For Florida, consult F.S. §849.094 and FDACS game promotions guidance for prizes over $5,000. Public counter metrics can be displayed only as telemetry; they are not authoritative winner counts. All reward language should clearly say "planned" / "coming soon".
