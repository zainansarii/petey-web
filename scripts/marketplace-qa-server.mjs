/** Local UI harness backed by the real service layer and disposable emulator data.
 * Never deploy. Auth/App Check are covered separately; roles here are synthetic.
 * Start after functions:build, with Firestore on 8085 and Storage on 9199.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.GCLOUD_PROJECT = 'demo-petey-pilot-browser';
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
const core = await import('../functions/lib/functions/src/marketplace/core.js');
const access = await import('../functions/lib/functions/src/marketplace/access.js');
const enquiries = await import('../functions/lib/functions/src/marketplace/enquiries.js');
const profiles = await import('../functions/lib/functions/src/marketplace/profile.js');
const applications = await import('../functions/lib/functions/src/webTrainerApplications.js');
const { marketplaceRequestSchema } = await import('../functions/lib/src/features/marketplace/model.js');
const { matchingProfileHash } = await import('../functions/lib/functions/src/webMatching.js');
const now = new Date();
const context = role => ({ db, actor: { uid: `qa-${role}`, email: `${role}@example.com` }, now: new Date(), pilotEnabled: true, siteUrl: 'http://127.0.0.1:5173/petey-web' });
await fetch(`http://127.0.0.1:8085/emulator/v1/projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
const form = { schemaVersion: 1, formId: 'browser-qa', responseId: 'qa-trainer', observedAt: now.toISOString(), submittedAt: now.toISOString(), editUrl: 'https://docs.google.com/forms/d/e/qa/viewform', items: [], answers: { fullName: 'Alex Morgan', email: 'trainer@example.com', bio: 'Build confidence and strength at your own pace. I work with people who want training to fit their life, from their first gym session to their next hiking adventure.', specialties: ['Strength', 'Confidence'], coachingStyle: 'Calm, supportive coaching', venues: ['Online', 'Commercial gym'], serviceAreas: 'North London', availability: 'Monday and Wednesday evenings\nWeekend mornings by arrangement', acceptingClients: 'Yes, now', sessionPrice: '65', sessionDuration: '60 minutes', qualification: 'Level 3 Personal Training' }, photo: { fileId: 'photo-file', modifiedAt: now.toISOString(), size: 10, mimeType: 'image/jpeg' } };
const { applicationId: trainerId } = await applications.importApplication(db, form, now);
const appRef = db.collection('webTrainerApplications').doc(trainerId);
let app = (await appRef.get()).data();
const verification = { ...app.verification, qualification: { checked: true, title: 'Level 3 Personal Training', provider: 'CIMSPA', expiresOn: null, reference: 'QA evidence' }, insurance: { checked: true, provider: 'QA insurer', expiresOn: '2028-12-31', reference: 'QA policy' } };
await appRef.update({ photo: { state: 'ready', path: `web-trainer-applications/${trainerId}/revisions/1/profile-${'a'.repeat(64)}.webp`, error: null, revision: 1 } });
await applications.saveApplication(db, trainerId, app.version, app.draft, verification, 'qa-reviewer', now);
app = (await appRef.get()).data();
await applications.reviewApplication(db, { applicationId: trainerId, expectedVersion: app.version, decision: 'approve', requestId: randomUUID() }, 'qa-reviewer', now);
await access.invite(context('reviewer'), trainerId, randomUUID());
const pilot = (await db.collection('webTrainerPilot').doc(trainerId).get()).data();
const invitation = (await db.collection('webNotificationQueue').doc(`invite_${pilot.invitationHash}`).get()).data();
await access.redeem(context('trainer'), new URL(invitation.link).searchParams.get('invite'));
const summary = { goals: 'Build strength and feel more confident in the gym', area: 'North London', settings: 'Commercial gym or online', budget: 'Around £70 per session', availability: 'Weekday evenings', frequency: 'Twice a week with a trainer', goalCategory: 'Strength' };
for (let index = 0; index < 12; index++) {
  const uid = index === 0 ? 'qa-trainee' : `qa-trainee-${index}`;
  const client = { ...context('trainee'), actor: { uid, email: `${uid}@example.com` }, now: new Date(now.getTime() - index * 86400_000) };
  const profileMarkdown = 'Goal: strength. North London. Weekday evenings. Budget £70.';
  const profileVersion = (await db.collection('webTrainerCatalog').doc(trainerId).get()).data().profileVersion;
  await db.collection('webClientProfiles').doc(uid).set({ identity: { fullName: ['Sam Ellis', 'Priya Shah', 'James Wilson', 'Oliver Reed', 'Amelia Clarke', 'Maya Patel', 'George Smith', 'Sofia Evans', 'Isla Jones', 'Leo Brown', 'Freya Davis', 'Noah Lee'][index] }, profileMarkdown, matching: { version: 2, profileHash: matchingProfileHash(profileMarkdown), catalogHash: 'a'.repeat(64), model: 'qa', evaluatedCount: 1, matchKind: 'compatible', matches: [{ trainerId, profileVersion, score: 92, reason: 'Good fit', dealbreakers: { budget: 'met', venue: 'met', location: 'met', availability: 'met', trainerGender: 'not_required', otherRequirements: 'not_required' }, tradeoffs: [] }] } });
  await access.access(client);
  const { enquiryId } = await enquiries.enquire(client, trainerId, { ...summary, goalCategory: index % 3 === 0 ? 'Fitness' : 'Strength' }, "Hello Alex! I’d love some help finding a training routine that fits around work. Could we have a chat about getting started?");
  if (index > 3) await enquiries.unlock(context('trainer'), enquiryId);
  if (index > 6) await enquiries.send(context('trainer'), enquiryId, randomUUID(), 'Hi! Thanks for getting in touch. What would a good first month of training look like for you?');
  if (index > 7) await enquiries.tracking(context('trainer'), enquiryId, { notes: 'Ask about preferred gym and evening availability.', followUp: new Date(now.getTime() + (index - 9) * 86400_000).toISOString().slice(0,10), outcome: index === 11 ? 'started' : 'consultation' }, 0);
}
async function execute(ctx, request) {
  switch (request.action) {
    case 'access': return access.access(ctx);
    case 'inbox': return enquiries.inbox(ctx, request.cursor);
    case 'dashboard': return enquiries.dashboard(ctx, request.days);
    case 'profile': return profiles.profile(ctx);
    case 'detail': return enquiries.detail(ctx, request.enquiryId);
    case 'unlock': return enquiries.unlock(ctx, request.enquiryId);
    case 'withdraw': return enquiries.withdraw(ctx, request.enquiryId);
    case 'messages': return enquiries.messages(ctx, request.enquiryId, request.before);
    case 'send': return enquiries.send(ctx, request.enquiryId, request.requestId, request.text);
    case 'read': return enquiries.acknowledge(ctx, request.enquiryId, request.through);
    case 'block': return enquiries.block(ctx, request.enquiryId);
    case 'report': return enquiries.report(ctx, request.enquiryId, request.reason, request.requestId);
    case 'tracking': return enquiries.tracking(ctx, request.enquiryId, { notes: request.notes, outcome: request.outcome, followUp: request.followUp }, request.expectedVersion);
    case 'draft': return profiles.saveDraft(ctx, request.draft, request.expectedDraftVersion, request.baseVersion);
    case 'publish': return profiles.publish(ctx, request.expectedVersion, request.expectedDraftVersion);
    case 'capacity': return profiles.capacity(ctx, request.accepting, request.expectedVersion);
    case 'photo': return profiles.uploadPhoto(ctx, request.file.base64, request.expectedDraftVersion);
    case 'credentials': return profiles.submitCredentials(ctx, request);
    case 'credentialList': return profiles.credentialList(ctx, request.trainerId);
    case 'preferences': return enquiries.preferences(ctx, request.preferences);
    case 'prepare': return enquiries.prepare(ctx, request.trainerId, async () => summary);
    case 'enquire': return enquiries.enquire(ctx, request.trainerId, request.summary, request.introduction);
    case 'availability': { const ids = []; for (const id of request.trainerIds) { try { await core.eligible(ctx, id); ids.push(id); } catch { /* Ineligible QA trainers stay unavailable. */ } } return { trainerIds: ids }; }
    default: throw new Error('Unsupported local QA action');
  }
}
createServer(async (req, res) => {
  if (req.headers.origin !== 'http://127.0.0.1:5173') { res.writeHead(403); res.end(); return; }
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url !== '/marketplace' || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  try { let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8_000_000) throw new Error('Request too large'); }
    const payload = JSON.parse(body); if (!['trainer', 'trainee'].includes(payload.role)) throw new Error('Invalid QA role');
    const request = marketplaceRequestSchema.parse(payload.request); const result = await execute(context(payload.role), request);
    if (result && 'photoUrl' in result) { result.photoUrl = '/petey-web/src/assets/trainers/john-kim.png'; result.draftPhotoUrl = result.photoUrl; }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
  } catch (error) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: error.code ?? 'invalid-argument', message: error.message })); }
}).listen(5063, '127.0.0.1', () => console.log(`Local pilot QA ready. Trainer ${trainerId}. Open /trainer/?pilotQa=trainer or /messages/?pilotQa=trainee on port 5173.`));
