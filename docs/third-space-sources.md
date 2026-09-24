# Third Space demo: sources and matching boundaries

Verified on **24 September 2026** against Third Space's public website. The catalogue is a deliberately small snapshot: **40 real trainers across all 16 current directory locations**, with at least two trainers per club. It is not the complete live trainer inventory.

## What the source provides

- [Find a trainer](https://www.thirdspace.london/find-a-trainer/): real names, portraits, club assignments, short introductions and filters for location, expertise and training tier.
- Individual profile pages: expertise, qualifications, coaching biographies and occasional testimonials. The demo uses concise editorial paraphrases for summaries and biographies; expertise and qualification labels retain their source meaning. Every record links to its official profile and carries a verification date.
- [Club directory](https://www.thirdspace.london/clubs/): exact published map-pin coordinates. Addresses come from each club's `FIND US` section. `LONDON_LOCATIONS` contains 73 geographic anchors: 16 club points and 57 additional neighbourhood/station points. Neighbourhoods and postcode districts remain curated approximations, not official Third Space locations or a live geocoder. Distances must not be presented as journey times.
- Distinct named stations use their own coordinates rather than aliases of nearby places. On 24 September 2026, 23 station points were checked against TfL's public [Tube StopPoint API](https://api.tfl.gov.uk/StopPoint/Mode/tube) and [Overground StopPoint API](https://api.tfl.gov.uk/StopPoint/Mode/overground). The station IDs below identify the exact records used; TfL coordinates represent stations, not a home, workplace or entire postcode district.
- Chelsea and Paternoster Square currently omit trainer cards from their individual club pages. Their assignments were verified with the directory's [Chelsea filter](https://www.thirdspace.london/find-a-trainer/?filter-t-location=chelsea) and [Paternoster Square filter](https://www.thirdspace.london/find-a-trainer/?filter-t-location=paternoster-square).

## Membership and location logic

- Club membership grants access to the named club. [The Wharf membership](https://www.thirdspace.london/clubs/wood-wharf/) covers Canary Wharf and Wood Wharf.
- [Group membership](https://www.thirdspace.london/clubs/the-whiteley/) excludes Mayfair and Chelsea; Group Plus covers all clubs. Initial access can be staggered or waitlisted, so a member's stated exclusions must take priority over general membership eligibility.
- Ask whether someone is a member and, if so, which membership and existing club access they have. Ask where training fits their day—an area, postcode district, station, home/work anchors—then infer relevant clubs. Do not ask them to select a preferred Third Space club before matching.
- [Queen's Park](https://www.thirdspace.london/clubs/queens-park/) is advertised as opening October 2026 and is excluded from the current club catalogue. The Queen's Park neighbourhood remains a valid geographic anchor for nearby existing clubs.
- The [Help Centre](https://www.thirdspace.london/help-centre/) says there are no public day passes. Nonmembers may explore matches without implying that club entry is included or confirmed.

### Verified station anchors

London Bridge is separate from Tower Bridge; Old Street, Hoxton and Shoreditch High Street are separate from Shoreditch; White City is separate from Shepherd's Bush; Pimlico is separate from Victoria; and Parsons Green is separate from Fulham. The same correction applies to the additional distinct stations below. Area aliases that describe approximately the same point, such as Fulham Broadway for the central Fulham anchor, remain supported. District aliases are retained as coarse areas: `EC1V` uses Old Street and `SW1V` uses Pimlico.

| Station anchor | TfL StopPoint ID |
|---|---|
| London Bridge | `9400ZZLULNB` |
| Old Street | `9400ZZLUODS` |
| Hoxton | `910GHOXTON` |
| White City | `9400ZZLUWCY` |
| Pimlico | `9400ZZLUPCO` |
| Parsons Green | `9400ZZLUPSG` |
| Nine Elms | `9400ZZNEUGST` |
| Monument | `9400ZZLUMMT` |
| Green Park | `9400ZZLUGPK` |
| Piccadilly Circus | `9400ZZLUPCC` |
| Bayswater | `9400ZZLUBWT` |
| Queensway | `9400ZZLUQWY` |
| Mansion House | `9400ZZLUMSH` |
| Leicester Square | `9400ZZLULSQ` |
| Cambridge Heath | `910GCAMHTH` |
| Aldgate East | `9400ZZLUADE` |
| Clapham North | `9400ZZLUCPN` |
| Clapham South | `9400ZZLUCPS` |
| East Putney | `9400ZZLUEPY` |
| Putney Bridge | `9400ZZLUPYB` |
| Turnham Green | `9400ZZLUTNG` |
| Shoreditch High Street | `910GSHRDHST` |
| Liverpool Street | `9400ZZLULVT` |

## Budget: retained following the user's correction

[Membership Add-Ons](https://www.thirdspace.london/membership/) publishes a **starting PT rate of £85 per hour**. This is personal training, separate from monthly club membership. The [PT FAQ](https://www.thirdspace.london/personal-training/) says prices vary by training tier.

Use the agreed budget suggestions **£85–£100**, **£100–£125**, and **Not sure yet**, while accepting free text. These are user budget preferences, not published Third Space tariff bands. No public numeric Elite rate, club-specific PT rate, or pack price was found. Do not assign a price to an individual trainer or claim confirmed budget compatibility.

The [Help Centre](https://www.thirdspace.london/help-centre/) describes joining packs, 3/10/20-session packs, a one-time five-for-four offer and direct-debit subscriptions, but provides no numeric prices for them. Booking and pack purchasing take place in the member app. The publicly accessible [PT enquiry form](https://www.thirdspace.london/find-pt/?preferred_trainer=Alish_Hamdi) provides no prices.

## Onboarding adaptations and data quality

Retain free-form goals, experience, confidence and coaching-style preferences. Allow optional specialist needs such as returning after injury, pre/postnatal training or menopause. Profiles contain useful evidence for these distinctions, including gym confidence, running, swimming, boxing, strength and nutrition.

Remove account creation and marketplace/trainer-side flows from the demo. In-club training is implicit. Public profiles do not establish live availability, acceptance of new clients, response times or individual prices. Avoid fabricated session slots, availability badges, match percentages or demographic classifications.

Tier is populated only when explicitly verified in a source profile. A missing tier stays `null`; it does not mean Personal Training. Ross Sutton's source labels him both Senior and Elite, so his tier is left unresolved. Testimonials are omitted: Olivia Galvin's page includes a testimonial naming another trainer. Qualifications marked “in progress” remain explicitly marked that way. Alison Walsh is a swim coach listed in the trainer directory; her qualifications and specialism are preserved accurately.

## Reproducing the import

Run from the web repository:

```sh
node scripts/import-third-space.mjs --profiles --write
```

The script caches public HTML in `/tmp/petey-third-space-sources`, extracts the fixed reviewed sample, generates the two shared data modules, and downloads the original official imagery into `public/third-space-demo/`. The snapshot date and editorial paraphrases are intentionally reviewed values; updating the sample requires reviewing them as well. No contact forms are submitted.

Validation performed: 40 unique trainer IDs; at least two per current club; nonempty expertise and qualifications; successful HTTP downloads for every portrait, hero and logo; genuine WebP signatures for all 41 raster assets. All media is local at runtime. The supplied white wordmark is the official site's SVG, and the hero is its personal-training photograph.

## Profile and media provenance

The following table lists every sampled profile and its exact downloaded portrait source. Club membership is sourced from its official club page unless the filtered directory exception above applies.

| Trainer | Club | Downloaded image |
|---|---|---|
| [Amy Leese](https://www.thirdspace.london/trainer/amy-leese/) | [Battersea](https://www.thirdspace.london/clubs/battersea/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/260303-TS-PT-MARCH-02_Amy_Leese-0202-640x427.webp) |
| [Sam Egerton](https://www.thirdspace.london/trainer/sam-egerton/) | [Battersea](https://www.thirdspace.london/clubs/battersea/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/HR_Battersea_ThirdSpace_JonPaynePhoto240628_ThirdSpace_Battersea_Shot_04_070-BW-1-683x1024.webp) |
| [Katie Morris](https://www.thirdspace.london/trainer/katie-morris/) | [Canary Wharf](https://www.thirdspace.london/clubs/canary-wharf/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space-PT-13_Katie_Morris-2105-640x427.webp) |
| [Darren Bruce](https://www.thirdspace.london/trainer/darren-bruce/) | [Canary Wharf](https://www.thirdspace.london/clubs/canary-wharf/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third-Space-PT-Darren-Bruce-1-BW-640x427.webp) |
| [Mike Davis](https://www.thirdspace.london/trainer/mike-davis/) | [Canary Wharf](https://www.thirdspace.london/clubs/canary-wharf/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/250114-TS_PT_Jan-10_Michael_Davis-0795-1-640x427.webp) |
| [Claire Burton](https://www.thirdspace.london/trainer/claire-burton/) | [Canary Wharf](https://www.thirdspace.london/clubs/canary-wharf/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/241008-Third_Space_PT_Oct-09_Claire_Burton-1487-e1731335471277-640x346.webp) |
| [Sam Lynch](https://www.thirdspace.london/trainer/sam-lynch/) | [Chelsea](https://www.thirdspace.london/clubs/chelsea/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space-PT-03_Sam_Lynch-0469-e1727780289691-640x271.webp) |
| [Ross Sutton](https://www.thirdspace.london/trainer/ross-sutton/) | [Chelsea](https://www.thirdspace.london/clubs/chelsea/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/240917-Third_Space_PT_MOOR-04_Ross_Sutton-0775-640x427.webp) |
| [Danny Webster](https://www.thirdspace.london/trainer/danny-webster/) | [City](https://www.thirdspace.london/clubs/city/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space_PT-22_Danny_Webster-3850-e1727779363368-640x263.webp) |
| [Hannah Ross](https://www.thirdspace.london/trainer/hannah-ross-2/) | [City](https://www.thirdspace.london/clubs/city/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space-PT-09_Hannah_Ross-1632-640x427.webp) |
| [Pandora Porter](https://www.thirdspace.london/trainer/pandora-porter/) | [Clapham Junction](https://www.thirdspace.london/clubs/clapham-junction/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2025/02/250114-TS_PT_Jan-18_Pandora_Porter-1886-640x426.webp) |
| [Ola Sogbanmu](https://www.thirdspace.london/trainer/ola-sogbanmu/) | [Clapham Junction](https://www.thirdspace.london/clubs/clapham-junction/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/241105-Third_Space_PT_Nov-16_Ola_Sogbanmu-3134-640x427.webp) |
| [Aliyah Spacey-Smith](https://www.thirdspace.london/trainer/aliyah-spacey-smith/) | [Islington](https://www.thirdspace.london/clubs/islington/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space_PT-19_Aliyah_Spacey-Smith-4445-e1727864130318-640x413.webp) |
| [Matthew Dwornik](https://www.thirdspace.london/trainer/matthew-dwornik-2/) | [Islington](https://www.thirdspace.london/clubs/islington/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space_PT-23_Matthew_Dwornik-5392-e1727782552711-640x263.webp) |
| [Kirsty Farquharson](https://www.thirdspace.london/trainer/kirsty-farquharson/) | [Islington](https://www.thirdspace.london/clubs/islington/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2026/09/260901-TS-PT-SEPT-10_Kirsty_Farquharson-1181-640x427.webp) |
| [Ethan Chen](https://www.thirdspace.london/trainer/ethan-chen/) | [Islington](https://www.thirdspace.london/clubs/islington/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/12/ClaphamJunction_ThirdSpace_Sept24_HR_240910-TS_Clapham-Shot_03-0610-640x427.webp) |
| [Chloe Hubbard](https://www.thirdspace.london/trainer/chloe-hubbard/) | [Marylebone](https://www.thirdspace.london/clubs/marylebone/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2026/09/260901-TS-PT-SEPT-04_Chloe_Hubbard-0466-640x427.webp) |
| [Tom Mans](https://www.thirdspace.london/trainer/tom-mans/) | [Marylebone](https://www.thirdspace.london/clubs/marylebone/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2026/08/260804-TS-PT-AUG-09_Tom_Mans-0865-640x427.webp) |
| [Olivia Galvin](https://www.thirdspace.london/trainer/olivia-galvin/) | [Mayfair](https://www.thirdspace.london/clubs/mayfair/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2026/04/260106-TS_PT-08_Olivia_Galvin-1787-640x427.webp) |
| [Ayden Isaac-George](https://www.thirdspace.london/trainer/ayden-isaac-george/) | [Mayfair](https://www.thirdspace.london/clubs/mayfair/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/Third-Space-PT-Ayden-Isaac-George-3-BW-scaled-e1727792165485-640x556.webp) |
| [Amy Kerr](https://www.thirdspace.london/trainer/amy-kerr/) | [Moorgate](https://www.thirdspace.london/clubs/moorgate/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/Third-Space-PT-Amy-Kerr-2-BW-640x427.webp) |
| [Marek Polnik](https://www.thirdspace.london/trainer/marek-polnik/) | [Moorgate](https://www.thirdspace.london/clubs/moorgate/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/Third-Space-PT-Marek-Polnik-1-BW-scaled-e1727860496555-640x454.webp) |
| [Michael Gilburt](https://www.thirdspace.london/trainer/michael-gilburt/) | [Paternoster Square](https://www.thirdspace.london/clubs/paternoster-square/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/250507-TS_PT_May-08_Michael_Gilburt-1354-640x427.webp) |
| [Candi Bryant](https://www.thirdspace.london/trainer/candi-bryant/) | [Paternoster Square](https://www.thirdspace.london/clubs/paternoster-square/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2025/08/250708-TS_PT_July-03_Candi_Bryant-0739-640x427.webp) |
| [Dylan McMahon](https://www.thirdspace.london/trainer/dylan-mcmahon/) | [Richmond](https://www.thirdspace.london/clubs/richmond/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/12/241105-Third_Space_PT_Nov-07_Dylan_McMahon-1541-640x427.webp) |
| [Ella Bear](https://www.thirdspace.london/trainer/ella-bear/) | [Richmond](https://www.thirdspace.london/clubs/richmond/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/12/241105-Third_Space_PT_Nov-04_Ella_Bear-0644-640x427.webp) |
| [Cathy Brown](https://www.thirdspace.london/trainer/cathy-brown/) | [Soho](https://www.thirdspace.london/clubs/soho/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space_PT-20_Catherine_Brown-3786-e1727795454775-640x427.webp) |
| [Liam Santos](https://www.thirdspace.london/trainer/liam-santos/) | [Soho](https://www.thirdspace.london/clubs/soho/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space_PT-07_Liam_Santos-1094-e1727796164448-640x327.webp) |
| [Alish Hamdi](https://www.thirdspace.london/trainer/alish-hamdi/) | [The Whiteley](https://www.thirdspace.london/clubs/the-whiteley/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space-PT-17_Alish_Hamdi-2944-e1731335946511-640x270.webp) |
| [Maddie Pearce](https://www.thirdspace.london/trainer/maddie-pearce/) | [The Whiteley](https://www.thirdspace.london/clubs/the-whiteley/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2025/12/251104-TS-PT-NOV-13-Maddie-Pearce-2034-640x426.webp) |
| [Kirsty McLean](https://www.thirdspace.london/trainer/kirsty-mclean/) | [The Whiteley](https://www.thirdspace.london/clubs/the-whiteley/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2026/06/260707-TS-PT-JULY-05_Kirsty_Mclean-0783-640x427.webp) |
| [Michael Searless](https://www.thirdspace.london/trainer/michael-searless/) | [The Whiteley](https://www.thirdspace.london/clubs/the-whiteley/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/ThirdSpace_gym_personal_training-640x640.webp) |
| [Antonia Garton-Sprenger](https://www.thirdspace.london/trainer/antonia-garton-sprenger/) | [Tower Bridge](https://www.thirdspace.london/clubs/tower-bridge/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space-PT-06_Antonia_Garton_Sprenger-1018-e1727772241634-640x279.webp) |
| [Andrea Mora](https://www.thirdspace.london/trainer/andrea-mora/) | [Tower Bridge](https://www.thirdspace.london/clubs/tower-bridge/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/240917-Third_Space_PT_MOOR-03_Andrea_Mora-0563-640x427.webp) |
| [Juliette Barron](https://www.thirdspace.london/trainer/juliette-barron/) | [Tower Bridge](https://www.thirdspace.london/clubs/tower-bridge/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/10/240917-Third_Space_PT_MOOR-21_Juliette_Barron-4387-1-640x427.webp) |
| [Moe Metwally](https://www.thirdspace.london/trainer/moe-metwally/) | [Wimbledon](https://www.thirdspace.london/clubs/wimbledon/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/09/Third_Space-PT-07_Moe_Metwally-1190-e1731335772389-640x227.webp) |
| [Alison Walsh](https://www.thirdspace.london/trainer/alison-walsh/) | [Wimbledon](https://www.thirdspace.london/clubs/wimbledon/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2024/12/241203-Third_Space_PT_Dec-05_Alison_Walsh-0611-640x427.webp) |
| [Noor Yasser](https://www.thirdspace.london/trainer/noor-yasser/) | [Wimbledon](https://www.thirdspace.london/clubs/wimbledon/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2026/09/260707-TS-PT-JULY-02_Noor_Yasser-0301-640x427.webp) |
| [Doug Anderson](https://www.thirdspace.london/trainer/doug-anderson/) | [Wood Wharf](https://www.thirdspace.london/clubs/wood-wharf/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2025/11/251202-Third_Space-PT-Dec-07_Douglas_Anderson-1119-640x427.webp) |
| [Alessandra Lumina](https://www.thirdspace.london/trainer/alessandra-lumina/) | [Wood Wharf](https://www.thirdspace.london/clubs/wood-wharf/) | [Portrait](https://www.thirdspace.london/wp-content/uploads/2026/04/260407-Third_Space-PT-APRIL-01_Alessandra_Lumina-0139-640x427.webp) |

Hero: [official PT page](https://www.thirdspace.london/personal-training/), [source image](https://www.thirdspace.london/wp-content/uploads/2024/10/ThirdSpace_PTImagery_JonPaynePhoto_LOCATION_3_539-1619x1080.webp). Wordmark: [official SVG](https://www.thirdspace.london/wp-content/uploads/2024/07/art_1.svg).
