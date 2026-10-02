import type { DemoMessage, GymboxBrief, GymboxClub, LondonLocation } from "./contract.js";

const normalise = (value: string) => value.toLowerCase().normalize("NFKD")
  .replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

function mentionedClubs(value: string, clubs: readonly GymboxClub[], locations: readonly LondonLocation[]) {
  const input = ` ${normalise(value)} `;
  return clubs.filter(club => [club.name, club.id, ...(locations.find(location => location.id === club.id)?.aliases ?? [])]
    .some(alias => input.includes(` ${normalise(alias)} `))).map(club => club.id);
}

/** Recognise only volunteered age eligibility, never infer age or retain a date of birth. */
export function volunteeredAgeEligibility(messages: readonly DemoMessage[]): GymboxBrief["ageEligibility"] {
  let eligibility: GymboxBrief["ageEligibility"] = "unknown";
  for (const { content } of messages.filter(message => message.role === "user")) {
    for (const part of content.split(/[.!?;,]+|\bbut\b|\bhowever\b|\band (?=I\b)/i)) {
      const value = normalise(part);
      if (/\b(?:im|i am|the client is|my (?:son|daughter|child) is) (?:an? )?(?:adult|over 18|18 or over)\b/.test(value)) eligibility = "adult";
      if (/\b(?:im|i am|the client is|my (?:son|daughter|child) is|for someone) under 18\b|\bfor (?:an? |my )?under 18\b/.test(value)) eligibility = "under-18";
      const age = value.match(/\b(?:im|i am|the client is|my (?:son|daughter|child) is) (\d{1,2})(?: years? old| year old|\b(?= (?:and|but|looking|want|i))|$)/)
        ?? value.match(/\bfor my (\d{1,2}) year old\b/);
      if (age) eligibility = Number(age[1]) < 18 ? "under-18" : "adult";
    }
  }
  return eligibility;
}

/** Latest explicit access statements override model omissions; package labels never grant access. */
export function reconcileExplicitConstraints(
  extracted: GymboxBrief,
  messages: readonly DemoMessage[],
  clubs: readonly GymboxClub[],
  locations: readonly LondonLocation[],
): GymboxBrief {
  const brief: GymboxBrief = { ...extracted, homeClubIds: [...extracted.homeClubIds],
    accessibleClubIds: [...extracted.accessibleClubIds], excludedClubIds: [...extracted.excludedClubIds],
    trainingClubIds: [...(extracted.trainingClubIds ?? [])] };
  let accessMode: GymboxBrief["accessMode"];
  let allowed = new Set<string>();
  const excluded = new Set<string>();
  const liftedExclusions = new Set<string>();
  let trainingClubIds: string[] | undefined;
  for (const [index, message] of messages.entries()) {
    if (message.role !== "user") continue;
    const { content } = message;
    const accessQuestion = normalise(messages[index - 1]?.content ?? "");
    const answeringAccess = /\b(?:which|what) (?:other |additional )?(?:clubs|gyms)\b/.test(accessQuestion)
      && /\b(?:access|use|included)\b/.test(accessQuestion);
    // Sentence-sized assertions keep “home Bank, but only Farringdon now” independent.
    for (const statement of content.replace(/\b(?:except|apart from)\b/gi, ". Exclude ")
      .split(/[.!?;\n]+|\bbut\b|\bhowever\b|,?\s+and I\s+|,?\s+and\s+(?=exclude\b|excluding\b|avoid\b)|,\s*(?=I\b|no\b|not\b|exclude\b|excluding\b|avoid\b)/i)) {
      const value = normalise(statement);
      const ids = mentionedClubs(statement, clubs, locations);
      if (/\b(?:home|main) (?:club|gym)\b/.test(value) && ids.length && !/\b(?:not|no longer)\b/.test(value)) {
        brief.homeClubIds = ids;
      }
      if (ids.length && /\b(?:dont|do not|stop) (?:exclude|excluding|avoid|avoiding)\b|\bno longer (?:excluded|off limits)\b|\b(?:remove|lift)\b.*\bexclusions?\b/.test(value)) {
        ids.forEach(id => { excluded.delete(id); liftedExclusions.add(id); });
        continue;
      }
      if (ids.length && /^not\b|\b(?:exclude|excluding|avoid|not at|not in|not near|cannot use|cant use|cannot access|cant access|can no longer use|can no longer access)\b|\b(?:no longer|dont|do not) have (?:current )?access\b|\b(?:excluded|waitlisted|awaiting access)\b|\b(?:dont|do not) want (?!online\b)/.test(value)) {
        ids.forEach(id => { excluded.add(id); liftedExclusions.delete(id); });
        continue;
      }
      const accessAssertion = /\b(?:can (?:currently |now |also |only |just )*(?:use|access)|have (?:current |confirmed )?access|access (?:is|includes|covers)|membership (?:includes|covers))\b/.test(value);
      const unknownAccess = /\b(?:no longer have|dont have|do not have|dont know|do not know|unsure|not sure|unknown)\b/.test(value)
        && /\b(?:access|which clubs|which gyms|all clubs|all gyms)\b/.test(value);
      const allClubs = /\b(?:all|every) (?:gymbox )?(?:clubs?|gyms?)\b/.test(value)
        && (/\b(?:have|can|access|membership|includes|covers)\b/.test(value) || /^(?:all|every) (?:gymbox )?(?:clubs?|gyms?)$/.test(value))
        && !/\b(?:want|wish|would|could|unsure|not sure|dont|do not|not have|no longer|previously|used to)\b/.test(value);
      if (unknownAccess) { accessMode = "unknown"; allowed = new Set(); }
      else if (allClubs) { accessMode = "all-clubs"; allowed = new Set(); }
      else if (/\b(?:single|one) (?:club|gym) (?:access|membership)\b/.test(value)) {
        accessMode = "single-club"; allowed = new Set(brief.homeClubIds);
      } else if ((accessAssertion || (answeringAccess && !/\b(?:want|prefer|train|training)\b/.test(value))) && ids.length) {
        if (/\b(?:only|just|restricted|limited)\b/.test(value)) {
          accessMode = "restricted-clubs"; allowed = new Set(ids);
        } else {
          if (!accessMode || accessMode === "unknown" || accessMode === "single-club") {
            accessMode = "confirmed-clubs"; allowed = new Set(brief.homeClubIds);
          }
          ids.forEach(id => allowed.add(id));
        }
      }
      if (!accessAssertion && !allClubs && ids.length && /\b(?:only|instead|focus)\b/.test(value)
        && /\b(?:want|train|training|focus|matches|results|prefer)\b/.test(value)) trainingClubIds = ids;
      else if (!accessAssertion && ids.length && /\b(?:also|additionally)\b/.test(value)
        && /\b(?:train|training|want)\b/.test(value)) trainingClubIds = [...new Set([...(trainingClubIds ?? brief.trainingClubIds ?? []), ...ids])];
      const rejectsOnline = /\b(?:dont|do not|not|no longer) (?:want|need|require|looking for|interested in)\b.*\bonline\b|\bno online\b/.test(value);
      if (rejectsOnline) brief.trainingMode = "in-club";
      else if (/\b(?:online only|only online|want online|want an online|looking for online|remote personal training|online personal training|online pt)\b/.test(value)) brief.trainingMode = "online";
      if (/\b(?:want|prefer|instead|happy to|will|would like|can train|can do|open to|fine with|okay with)\b.*\b(?:in club|in gym|in person)\b/.test(value)
        && !/\b(?:dont|do not|not|no longer) (?:want|need|require)\b/.test(value)) brief.trainingMode = "in-club";
    }
  }
  if (accessMode) {
    brief.accessMode = accessMode;
    brief.accessibleClubIds = [...allowed];
    // Exclusions extracted from an earlier superseded access list must not undo a later explicit grant.
    brief.excludedClubIds = [...new Set([...brief.excludedClubIds.filter(id => !allowed.has(id) && !liftedExclusions.has(id)), ...excluded])];
  } else {
    // Additional/all-club entitlement requires an explicit assertion, not model confidence.
    brief.accessMode = "unknown";
    brief.accessibleClubIds = [];
    brief.excludedClubIds = [...new Set([...brief.excludedClubIds.filter(id => !liftedExclusions.has(id)), ...excluded])];
  }
  if (trainingClubIds) {
    brief.trainingClubIds = trainingClubIds;
    brief.locationAnchors = [];
  }
  const ageEligibility = volunteeredAgeEligibility(messages);
  if (ageEligibility !== "unknown") brief.ageEligibility = ageEligibility;
  return brief;
}
