import type { LondonLocation, GymboxBrief, GymboxClub, GymboxTrainer } from "./contract.js";

const normalise = (value: string) => value.toLowerCase().normalize("NFKD")
  .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Volunteered full postcodes become broad outward districts before matching or returning a brief.
export const coarseLocationAnchor = (value: string) => value.replace(
  /\b([a-z]{1,2}\d[a-z\d]?)\s*\d[a-z]{2}\b/gi,
  (_postcode, outward: string) => outward.toUpperCase(),
);

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude);
  const lon = radians(b.longitude - a.longitude);
  const value = Math.sin(lat / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function accessibleClubs(brief: GymboxBrief, clubs: readonly GymboxClub[]): GymboxClub[] {
  const excluded = new Set(brief.excludedClubIds);
  const explicit = new Set(brief.accessibleClubIds);
  const home = new Set(brief.homeClubIds);
  return clubs.filter(club => {
    if (excluded.has(club.id)) return false;
    // A non-member is exploring clubs; this is never a claim of membership access.
    if (brief.membership === "non-member") return true;
    if (brief.accessMode === "all-clubs" && brief.membership === "member") return true;
    if (brief.accessMode === "restricted-clubs") return explicit.has(club.id);
    if (brief.accessMode === "single-club") return home.has(club.id);
    // A package label alone never verifies club access. Include only home clubs and
    // other clubs the member explicitly confirmed; exclusions always take precedence.
    return home.has(club.id) || explicit.has(club.id);
  });
}

export function resolveLocation(anchor: string, locations: readonly LondonLocation[]): LondonLocation | null {
  const input = normalise(coarseLocationAnchor(anchor));
  if (!input) return null;
  const exact = locations.filter(location => [location.id, location.name, ...location.aliases]
    .some(alias => normalise(alias) === input));
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;
  // Recognise an area embedded in a short natural answer, without guessing an unknown place.
  const found = locations.flatMap(location => [...new Set([location.name, ...location.aliases].map(normalise))]
    .filter(alias => (alias.length >= 3 || /^[a-z]{1,2}\d[a-z\d]?$/.test(alias)) && (` ${input} `).includes(` ${alias} `))
    .map(alias => ({ location, start: (` ${input} `).indexOf(` ${alias} `), length: alias.length })));
  // "South Kensington" contains "Kensington", but "Soho or Canary Wharf" names two separate anchors.
  // Suppress only contained shorter aliases; do not silently pick the longest of several places.
  const distinct = found.filter(item => !found.some(other => other.length > item.length
    && other.start <= item.start && other.start + other.length >= item.start + item.length));
  const unique = [...new Map(distinct
    .map(item => [item.location.id, item.location])).values()];
  return unique.length === 1 ? unique[0]! : null;
}

export function locationAnchorLabel(anchor: string, locations: readonly LondonLocation[]): string {
  const coarse = coarseLocationAnchor(anchor).trim();
  if (/^[a-z]{1,2}\d[a-z\d]?$/i.test(coarse)) return coarse.toUpperCase();
  const location = resolveLocation(anchor, locations);
  if (!location) return coarseLocationAnchor(anchor);
  const input = ` ${normalise(coarseLocationAnchor(anchor))} `;
  const label = [location.name, ...location.aliases]
    .filter(alias => !/^[a-z]{1,2}\d[a-z\d]?$/i.test(alias) && input.includes(` ${normalise(alias)} `))
    .sort((a, b) => b.length - a.length)[0];
  return label ?? location.name;
}

const expertiseWords = (value: string) => normalise(value)
  .replace(/\bolympic lifting\b/g, "olympic weightlifting")
  .replace(/\bpower lifting\b/g, "powerlifting")
  .replace(/\bpost natal\b/g, "postnatal")
  .replace(/\bpre natal\b/g, "prenatal")
  .replace(/\bpre (?:and )?postnatal\b/g, "prenatal postnatal")
  .replace(/\b(?:running|runners?)\b/g, "run")
  .replace(/\bweightlifting\b/g, "weightlift")
  .split(/\s+/);

const expertiseStopWords = new Set(["a", "an", "the", "and", "both", "in", "of", "for", "to", "with", "someone", "who",
  "expertise", "specialist", "specialism", "specialisms", "experience", "experienced", "coaching", "coach", "training", "support", "help"]);

export function supportsSpecialistNeed(trainer: GymboxTrainer, need: string): boolean {
  const alternatives = need.split(/\s+or\s+|\s*\/\s*/i);
  if (alternatives.length > 1) return alternatives.some(alternative => supportsSpecialistNeed(trainer, alternative));
  const required = expertiseWords(need).filter(word => word && !expertiseStopWords.has(word));
  if (!required.length) return false;
  const evidence = new Set(expertiseWords([
    ...trainer.expertise, ...trainer.qualifications, trainer.summary, trainer.bio,
  ].join(" ")));
  // This conservative check prevents a named discipline from being substituted with generic fitness.
  // The AI still ranks candidates and explains fit; absent catalogue specialist evidence is not invented.
  return required.every(word => evidence.has(word) || evidence.has(`${word}s`));
}

export interface GymboxCandidate {
  trainer: GymboxTrainer;
  clubId: string;
  locationReason: string;
  location: { anchor: string; source: "home-club" | "training-preference"; distanceKm: number; atHomeClub: boolean };
}

export interface CandidateSelection {
  candidates: GymboxCandidate[];
  unconfirmed: string[];
  emptyReason?: string;
}

export function selectCandidates(
  brief: GymboxBrief,
  trainers: readonly GymboxTrainer[],
  clubs: readonly GymboxClub[],
  locations: readonly LondonLocation[],
): CandidateSelection {
  const unconfirmed = ["Session availability needs to be confirmed."];
  const removeNegatedNeeds = (value: string) => value.replace(/\b(?:no|not|without|don['’]?t (?:need|want|require)|do not (?:need|want|require))\s+(?:any\s+)?(?:clinical\s+)?(?:rehab(?:ilitation)?|physiotherap(?:y|ist)|clinical|post[ -]surg(?:ery|ical))(?:\s+(?:needs?|support|expertise|specialists?))?/gi, "");
  const requested = removeNegatedNeeds([brief.goal, ...brief.specialistNeeds].join(" "));
  if (brief.ageEligibility === "under-18") return { candidates: [], unconfirmed,
    emptyReason: "Gymbox personal training is for members aged 18 or over. This demo cannot suggest PT matches for someone under 18." };
  if (brief.trainingMode === "online") return { candidates: [], unconfirmed,
    emptyReason: "Gymbox offers online PT enquiries, but this demo covers in-club trainers. We do not have verified online provision in this sample." };
  if (/\b(?:rehab(?:ilitation)?|physiotherap(?:y|ist)|clinical|post[ -]surg(?:ery|ical))\b/i.test(requested)) return { candidates: [], unconfirmed,
    emptyReason: "This demo sample has no verified rehabilitation or clinical specialists. General mobility coaching would not establish the expertise you need." };
  if (/\b(?:group classes|out the box)\b/i.test(requested)) {
    return { candidates: [], unconfirmed,
      emptyReason: "Group classes and Out the Box are separate from the personal training covered by this demo." };
  }
  if (brief.additionalPreferences.length) {
    unconfirmed.push(`Other preferences still need confirming: ${brief.additionalPreferences.join("; ")}.`);
  }
  if (brief.membership === "non-member") unconfirmed.push("Confirm membership and club access before arranging personal training.");
  if (brief.membership === "unsure") unconfirmed.push("Your membership access is unconfirmed; only a home club you confirmed can be considered.");
  // A volunteered training preference wins; otherwise members train around their home club.
  // Use the club's exact map point, not an ambiguous neighbourhood alias such as "City".
  const useHomeClub = !brief.locationAnchors.length && !brief.trainingClubIds?.length && brief.membership !== "non-member";
  const anchorClubIds = useHomeClub ? brief.homeClubIds : brief.trainingClubIds ?? [];
  const anchors = brief.locationAnchors.length
    ? brief.locationAnchors.map(anchor => ({ label: locationAnchorLabel(anchor, locations), location: resolveLocation(anchor, locations) }))
    : clubs.filter(club => anchorClubIds.includes(club.id)).map(club => ({ label: club.name, location: club }));
  if (!anchors.length) return {
    candidates: [], unconfirmed,
    emptyReason: brief.membership === "member"
      ? "Tell us your home club so we can find trainers around it."
      : "Tell us the London area where you would like to train so we can narrow down the clubs.",
  };
  if (anchors.some(({ location }) => !location)) return {
    candidates: [], unconfirmed,
    emptyReason: "We could not confidently locate every area you mentioned. Try a nearby London neighbourhood or station.",
  };
  const accessible = accessibleClubs(brief, clubs);
  if (!accessible.length) return {
    candidates: [], unconfirmed,
    emptyReason: "We need to confirm which clubs your membership currently includes before suggesting trainers.",
  };
  if (brief.membership === "member" && brief.accessMode !== "all-clubs" && !brief.accessibleClubIds.length) {
    unconfirmed.push("We have used only the home clubs you confirmed; your wider membership access is unconfirmed.");
  }
  const trainingClubIds = new Set(brief.trainingClubIds ?? []);
  const eligible = accessible.filter(club => !trainingClubIds.size || trainingClubIds.has(club.id));
  unconfirmed.push("Distances are approximate straight-line distances, not travel times.");
  const preferred = new Map<string, { distance: number; label: string }>();
  for (const { label, location } of anchors) {
    const nearest = eligible.map(club => ({ club, distance: distanceKm(location!, club) }))
      .filter(({ distance }) => brief.maxDistanceKm === undefined || brief.maxDistanceKm === null || distance <= brief.maxDistanceKm)
      .sort((a, b) => a.distance - b.distance || a.club.id.localeCompare(b.club.id));
    // Member entitlements define the pool; distance is a ranking preference, not a hidden access limit.
    // Non-members still explore the nearest clubs to their stated area.
    const considered = brief.membership === "member" ? nearest : nearest.slice(0, 3);
    for (const { club, distance } of considered) {
      if (!preferred.has(club.id) || distance < preferred.get(club.id)!.distance) {
        preferred.set(club.id, { distance, label });
      }
    }
  }
  if (!preferred.size) return {
    candidates: [], unconfirmed,
    emptyReason: "No clubs meet your confirmed access and training-location limits. Refine your area, distance limit or club access.",
  };
  const clubById = new Map(clubs.map(club => [club.id, club]));
  const candidates: GymboxCandidate[] = trainers.flatMap(trainer => {
    const clubId = trainer.clubIds.filter(id => preferred.has(id))
      .sort((a, b) => preferred.get(a)!.distance - preferred.get(b)!.distance || a.localeCompare(b))[0];
    if (!clubId) return [];
    const { label, distance } = preferred.get(clubId)!;
    const atHomeClub = brief.membership === "member" && brief.homeClubIds.includes(clubId);
    const name = clubById.get(clubId)!.name;
    return [{ trainer, clubId,
      location: { anchor: label, source: useHomeClub ? "home-club" as const : "training-preference" as const,
        distanceKm: Math.round(distance * 100) / 100, atHomeClub },
      locationReason: useHomeClub && atHomeClub ? `${name} is your home club.`
        : `${name} is about ${distance.toFixed(1)} km from ${useHomeClub ? `your ${label} home club` : label}.`,
    }];
  }).sort((a, b) => a.location.distanceKm - b.location.distanceKm || a.trainer.id.localeCompare(b.trainer.id));
  const specialists = candidates.filter(candidate => brief.specialistNeeds.every(need => supportsSpecialistNeed(candidate.trainer, need)));
  if (candidates.length && !specialists.length && brief.specialistNeeds.length) return {
    candidates: [], unconfirmed: [...unconfirmed, `Requested expertise is not evidenced in this eligible demo sample: ${brief.specialistNeeds.join(", ")}.`],
    emptyReason: `No eligible trainers in this demo sample have profile evidence for ${brief.specialistNeeds.join(", ")}. Refine that preference or your club limits.`,
  };
  return {
    candidates: specialists, unconfirmed,
    ...(!candidates.length ? { emptyReason: "This demo sample has no trainers at the clubs meeting your access and location limits. Refine your preferences or access." } : {}),
  };
}
