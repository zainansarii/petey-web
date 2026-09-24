import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const run = promisify(execFile);
const cache = '/tmp/petey-third-space-sources';
await mkdir(cache, { recursive: true });
const clean = value => (value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
async function fetchPage(url, key) {
  const path = `${cache}/${key}.html`;
  try { return await readFile(path, 'utf8'); } catch { /* Cache miss. */ }
  await run('curl', ['--http1.1', '--fail', '--location', '--silent', '--show-error', '--max-time', '45', url, '-o', path]);
  return readFile(path, 'utf8');
}
const documentFor = html => new JSDOM(html).window.document;
const clubDoc = documentFor(await fetchPage('https://www.thirdspace.london/clubs/', 'clubs'));
const clubs = [...clubDoc.querySelectorAll('.club[data-lat]')].map(node => ({
  id: new URL(node.dataset.url).pathname.split('/').filter(Boolean).at(-1),
  name: node.dataset.title,
  address: clean(node.dataset.address.replaceAll('|', ', ')).replace(/,\s*,/g, ',').replace(/,\s*$/, ''),
  latitude: Number(node.dataset.lat), longitude: Number(node.dataset.lng),
  sourceUrl: node.dataset.url, verifiedAt: '2026-09-24',
})).filter(club => club.id !== 'queens-park');
const cards = [];
for (const club of clubs) {
  let doc = documentFor(await fetchPage(club.sourceUrl, club.id));
  const addressLabel = [...doc.querySelectorAll('p')].find(node => clean(node.textContent) === 'FIND US');
  if (addressLabel?.nextElementSibling) {
    club.address = clean(addressLabel.nextElementSibling.innerHTML.replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]*>/g, '')).replace(/,\s*,/g, ',').replace(/,\s*$/, '');
  }
  if (!doc.querySelector('a.Post__Grid-content[href*="/trainer/"]')) {
    doc = documentFor(await fetchPage(`https://www.thirdspace.london/find-a-trainer/?filter-t-location=${club.id}`, `${club.id}-trainers`));
  }
  for (const node of doc.querySelectorAll('a.Post__Grid-content[href*="/trainer/"]')) {
    cards.push({
      clubId: club.id,
      id: new URL(node.href).pathname.split('/').filter(Boolean).at(-1),
      name: clean(node.querySelector('.sr-only')?.textContent),
      photoUrl: node.querySelector('img')?.src,
      sourceUrl: node.href,
      excerpt: clean(node.querySelector('.post__excerpt')?.textContent),
    });
  }
}
await writeFile(`${cache}/clubs.json`, JSON.stringify(clubs, null, 2));
await writeFile(`${cache}/cards.json`, JSON.stringify(cards, null, 2));
// Preserve the separately reviewed London anchors when refreshing official club data.
// Station aliases and coordinates have their own sources in docs/third-space-sources.md.
if (process.argv.includes('--write')) {
  const existing = await readFile('third-space-shared/locations.ts', 'utf8');
  const anchors = existing.match(/export const LONDON_LOCATIONS:[\s\S]*/)?.[0];
  if (!anchors) throw new Error('The curated location catalogue is missing; restore it before importing.');
  await writeFile('third-space-shared/locations.ts', `import type { ThirdSpaceClub, LondonLocation } from './contract.js';\n\n// Club coordinates are official directory map pins, checked 2026-09-24.\nexport const CLUBS: ThirdSpaceClub[] = ${JSON.stringify(clubs, null, 2)};\n\n// Curated approximate area/station anchors; see source notes. These do not represent journey times.\n${anchors}`);
}
if (process.argv.includes('--inspect')) {
  for (const club of clubs) console.log(`${club.name}: ${cards.filter(card => card.clubId === club.id).map(card => card.id).join(', ')}`);
}
console.log(`Found ${clubs.length} current clubs and ${cards.length} source trainer cards. Cache: ${cache}`);

const selected = {
  battersea: ['amy-leese', 'sam-egerton'],
  'canary-wharf': ['katie-morris', 'darren-bruce', 'mike-davis', 'claire-burton'],
  chelsea: ['sam-lynch', 'ross-sutton'],
  city: ['danny-webster', 'hannah-ross-2'],
  'clapham-junction': ['pandora-porter', 'ola-sogbanmu'],
  islington: ['aliyah-spacey-smith', 'matthew-dwornik-2', 'kirsty-farquharson', 'ethan-chen'],
  marylebone: ['chloe-hubbard', 'tom-mans'],
  mayfair: ['olivia-galvin', 'ayden-isaac-george'],
  moorgate: ['amy-kerr', 'marek-polnik'],
  'paternoster-square': ['michael-gilburt', 'candi-bryant'],
  richmond: ['dylan-mcmahon', 'ella-bear'],
  soho: ['cathy-brown', 'liam-santos'],
  'the-whiteley': ['alish-hamdi', 'maddie-pearce', 'kirsty-mclean', 'michael-searless'],
  'tower-bridge': ['antonia-garton-sprenger', 'andrea-mora', 'juliette-barron'],
  wimbledon: ['moe-metwally', 'alison-walsh', 'noor-yasser'],
  'wood-wharf': ['doug-anderson', 'alessandra-lumina'],
};
function field(doc, name) {
  const label = [...doc.querySelectorAll('.meta-small')].find(node => clean(node.textContent).toLowerCase() === name);
  const value = label?.nextElementSibling;
  if (!value) return [];
  return new JSDOM(value.innerHTML.replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n')).window.document.body.textContent.split('\n').map(clean).filter(Boolean);
}
if (process.argv.includes('--profiles')) {
  const profiles = [];
  for (const [clubId, ids] of Object.entries(selected)) {
    for (const id of ids) {
      const card = cards.find(candidate => candidate.id === id && candidate.clubId === clubId);
      if (!card) throw new Error(`Missing verified directory card: ${clubId}/${id}`);
      const doc = documentFor(await fetchPage(card.sourceUrl, `trainer-${id}`));
      const photo = doc.querySelector('.trainer-banner source[type="image/webp"]');
      const variants = (photo?.getAttribute('srcset') ?? '').split(',').map(item => item.trim().split(/\s+/)).map(([url, width]) => ({ url, width: Number.parseInt(width, 10) })).filter(item => item.width >= 640).sort((a, b) => a.width - b.width);
      profiles.push({ ...card, photoUrl: variants[0]?.url ?? card.photoUrl, expertise: field(doc, 'expertise'), qualifications: field(doc, 'qualifications'), intro: clean(doc.querySelector('.trainer-bio')?.textContent), bio: field(doc, 'bio').join(' '), tier: /is an? Elite Personal Trainer/i.test(doc.querySelector('article')?.textContent ?? '') ? 'elite' : null });
    }
  }
  await writeFile(`${cache}/profiles.json`, JSON.stringify(profiles, null, 2));
  for (const profile of profiles) console.log(`${profile.id}: ${JSON.stringify({expertise:profile.expertise, qualifications:profile.qualifications, intro:profile.intro, bio:profile.bio})}`);
}

// Editorial paraphrases reviewed against each linked official profile, not synthetic coach claims.
const copy = {
  'amy-leese': ['Hybrid training and confidence, with support through pregnancy, menopause and hormonal changes.', 'Amy combines her HYROX and marathon experience with empathetic fitness and life coaching. Her approach centres on habits that clients can maintain, alongside strength, running and women’s health.'],
  'sam-egerton': ['Energetic strength, functional fitness and hybrid training.', 'Sam draws on Muay Thai, CrossFit and Olympic lifting to build varied sessions. He aims to make training enjoyable and adapts his approach to each person’s fitness and lifestyle goals.'],
  'katie-morris': ['Strength, nutrition and support through pre- and post-menopause.', 'Katie brings a professional football background and two decades in fitness. Her coaching connects exercise with nutrition, mindset and recovery, with a particular focus on women navigating menopause.'],
  'darren-bruce': ['Boxing and strength coaching informed by a professional sporting career.', 'Darren is a former professional boxer and British kickboxing champion. He uses his sporting experience to tailor one-to-one strength and performance training, with an encouraging approach to individual goals.'],
  'mike-davis': ['Martial arts and conditioning in lively, challenging sessions.', 'Mike combines MMA experience with boxing, kickboxing and functional fitness. His coaching aims to develop confidence and ability through progressive martial arts and conditioning work.'],
  'claire-burton': ['Body composition, muscle development and practical nutrition support.', 'Claire draws on competitive natural bodybuilding and a background in kickboxing and group exercise. She tailors training and nutrition around each client’s goals and everyday lifestyle.'],
  'sam-lynch': ['Individualised strength and nutrition coaching for sustainable progress.', 'Sam combines exercise science, nutrition and experience in endurance sport. His coaching addresses behaviour change, body composition and performance, with qualifications in cardiac rehabilitation and exercise physiology.'],
  'ross-sutton': ['Running, movement and stress-resilience coaching with an empathetic approach.', 'Ross has more than a decade of health and wellness experience. He adapts running and functional movement work to each client’s circumstances and considers wellbeing beyond individual gym sessions.'],
  'danny-webster': ['Structured strength training and nutrition built around your routine.', 'Danny brings a decade of fitness experience to personalised programming. He supports strength, body composition and confidence through training structure, lifestyle guidance and ongoing motivation.'],
  'hannah-ross-2': ['Collaborative strength coaching that fits everyday life.', 'Hannah works with a range of abilities and focuses on movement quality and confidence. Her sessions support muscle development, conditioning and body composition while encouraging an enjoyable, sustainable routine.'],
  'pandora-porter': ['Strength, body composition and pre- or postnatal coaching.', 'Pandora has more than a decade of coaching experience. She adapts exercise mechanics and strength programming to personal preferences, including support during pregnancy and the return to training afterwards.'],
  'ola-sogbanmu': ['Performance, nutrition and injury-prevention support grounded in sustainable habits.', 'Ola combines over a decade of coaching with interests in sport, physiology and behaviour. His approach develops resilience and practical habits that support progress both during training and in daily life.'],
  'aliyah-spacey-smith': ['Women’s strength coaching for confidence and lasting habits.', 'Aliyah is a competitive powerlifter who combines weight training with nutrition and lifestyle support. Her coaching spans menstrual health, pregnancy and menopause, with an emphasis on empathy and realistic routines.'],
  'matthew-dwornik-2': ['Sports performance, calisthenics and rehabilitation-informed strength coaching.', 'Matthew combines extensive athletics and coaching experience with postgraduate sports-performance study. His background includes gymnastics, Olympic weightlifting and work with international athletes, alongside support for people beginning their gym journey.'],
  'kirsty-farquharson': ['Strength training for runners, marathoners and triathletes.', 'Kirsty combines her own strength-training and endurance-sport experience. She supports beginners, returning exercisers and athletes with training that develops strength alongside running and triathlon performance.'],
  'ethan-chen': ['Supportive strength and conditioning with a broad sporting background.', 'Ethan draws on rugby, weightlifting and bodybuilding experience to create individual training programmes. He places importance on supportive relationships and helping clients build motivation as they progress.'],
  'chloe-hubbard': ['Build confidence through strength, technique and bodyweight movement.', 'Chloe uses education and movement practice to help clients understand their capabilities. Her background in golf and music informs her attention to coordination, control and training technique.'],
  'tom-mans': ['Strength, longevity and endurance coaching for busy lives.', 'Tom brings more than 16 years of personal-training experience and a professional-sport background. He works with professionals and parents on practical fitness, nutrition and recovery habits, including preparation for endurance events.'],
  'olivia-galvin': ['Approachable strength and body-composition coaching, including pre- and postnatal support.', 'Olivia focuses on confidence, wellbeing and lasting training habits. Her areas of specialism include muscle development, fat loss and coaching through pregnancy and the return to exercise.'],
  'ayden-isaac-george': ['Experienced strength and physique coaching focused on consistency.', 'Ayden combines a sports-science degree with competitive sporting and physique experience. His individual programmes encourage clients to challenge themselves while developing consistency in training and everyday habits.'],
  'amy-kerr': ['Women’s health and strength coaching with close attention to movement.', 'Amy’s professional-dance background informs her focus on posture and exercise quality. She supports women across life stages, including pre- and postnatal training, and holds Pilates and trauma-informed coaching qualifications.'],
  'marek-polnik': ['Brazilian jiu-jitsu, strength and conditioning, and nutrition.', 'Marek combines a BJJ black belt with strength-and-conditioning and nutrition qualifications. His own competition experience informs coaching for martial arts and physical performance.'],
  'michael-gilburt': ['Progressive strength coaching built on technique and accountability.', 'Michael moved from a professional dance career into coaching in 2018. He emphasises movement fundamentals, care and consistency, working with both people new to strength training and experienced athletes.'],
  'candi-bryant': ['Encouraging strength, mobility and HYROX coaching.', 'Candi draws on dance, yoga and HYROX experience. Her tailored sessions combine strength and body-composition work with practical habits, aiming to help clients feel more confident and consistent.'],
  'dylan-mcmahon': ['Strength, powerlifting and body-composition coaching with nutrition support.', 'Dylan combines an anatomy degree with experience across athletics and powerlifting. He uses personalised training and habit coaching, informed by his own experiences of injury and changes in body weight.'],
  'ella-bear': ['Women’s strength, mobility and confidence on the gym floor.', 'Ella combines weight training with flexibility and mobility work. Her coaching considers lifestyle, stress and women’s health, helping clients become more comfortable and confident with lifting.'],
  'cathy-brown': ['Boxing coaching with a focus on confidence and mental strength.', 'Cathy is a former British and European professional boxing champion. Her coaching combines boxing and physical preparation with her background in cognitive behavioural therapy and empowerment work.'],
  'liam-santos': ['Muscle-building, calisthenics and technique-focused training.', 'Liam brings a musical-theatre background and experience in resistance training to his coaching. He gives close attention to movement and lifting technique, with additional interests in mobility and HYROX.'],
  'alish-hamdi': ['Precise resistance training, muscle development and nutrition.', 'Alish adapts exercise selection to each client’s biomechanics and ability. His bodybuilding experience and nutrition coaching inform programmes for building muscle, improving body composition and establishing an active routine.'],
  'maddie-pearce': ['Supportive strength, running and pre- or postnatal coaching.', 'Maddie combines a sports-science degree with international hockey experience. She supports beginners and athletes through practical functional training, including returning to exercise after pregnancy.'],
  'kirsty-mclean': ['Welcoming strength and functional training to build gym confidence.', 'Kirsty draws on athletics, hockey and sports-coaching experience. She aims to make sessions engaging and enjoyable so clients of different experience levels can build a lasting relationship with exercise.'],
  'michael-searless': ['Time-efficient strength training with attention to movement history.', 'Michael brings 15 years of coaching alongside experience in a multidisciplinary pain clinic and dance. He adapts strength, mobility and body-composition work to each client’s needs and available time.'],
  'antonia-garton-sprenger': ['Motivating strength and running coaching in a supportive setting.', 'Antonia’s athletics and hockey background shapes her dynamic approach. She works on strength, general fitness and body composition, encouraging clients to grow in confidence while pursuing their goals.'],
  'andrea-mora': ['Strength and movement coaching for sustainable lifestyle changes.', 'Andrea draws on ballet and bodybuilding experience to develop strength and body awareness. She focuses on practical habits and sharing knowledge, with expertise in body composition and pre- and postnatal training.'],
  'juliette-barron': ['Strength, mobility and flexibility with a focus on long-term wellbeing.', 'Juliette has a professional dance and musical-theatre background. Her approach combines purposeful training with enjoyment and education, helping clients pursue their goals and maintain a healthier routine.'],
  'moe-metwally': ['Detailed strength and body-composition coaching with a hybrid-training background.', 'Moe combines exercise-science study with experience in rowing, boxing, BJJ and endurance events. His coaching brings together resistance training, nutrition and conditioning for individual physique and performance goals.'],
  'alison-walsh': ['Swim coaching for water confidence, technique and endurance.', 'Alison works with swimmers from beginners through to triathlon and long-distance goals. She offers structured swim training and open-water guidance, adapting programmes to each client’s lifestyle.'],
  'noor-yasser': ['Strength and practical nutrition coaching for demanding schedules.', 'Noor has a sports-nutrition degree and works with busy professionals on body composition and sustainable routines. Their experience also includes helping long-distance runners with nutrition around training.'],
  'doug-anderson': ['Functional strength, Olympic lifting and HYROX preparation.', 'Doug brings experience in CrossFit and snowboard instruction to the gym. He supports a range of abilities, from people starting training through to clients preparing for fitness competitions.'],
  'alessandra-lumina': ['Structured strength coaching with a clear emphasis on accountability.', 'Alessandra draws on a karate background and sport-science education. Her coaching prioritises purposeful progression, efficient sessions and routines that fit the client’s everyday life.'],
};

if (process.argv.includes('--write')) {
  const profiles = JSON.parse(await readFile(`${cache}/profiles.json`, 'utf8'));
  const trainers = profiles.map(profile => ({
    id: profile.id, name: profile.name, clubIds: [profile.clubId],
    photoUrl: `/third-space-demo/trainers/${profile.id}.webp`,
    expertise: profile.expertise, qualifications: profile.qualifications,
    summary: copy[profile.id][0], bio: copy[profile.id][1],
    // Ross's own page calls him both Senior and Elite; do not resolve conflicting source claims.
    tier: profile.id === 'ross-sutton' ? null : profile.tier,
    sourceUrl: profile.sourceUrl, verifiedAt: '2026-09-24',
  }));
  if (trainers.length !== 40 || new Set(trainers.map(trainer => trainer.id)).size !== 40) throw new Error('Expected exactly 40 unique trainers.');
  for (const club of clubs) if (trainers.filter(trainer => trainer.clubIds.includes(club.id)).length < 2) throw new Error(`Insufficient coverage: ${club.id}`);
  for (const trainer of trainers) if (!trainer.expertise.length || !trainer.qualifications.length) throw new Error(`Missing profile fields: ${trainer.id}`);
  await writeFile('third-space-shared/catalogue.ts', `import type { ThirdSpaceTrainer } from './contract.js';\n\n// Real Third Space profiles, checked 2026-09-24. Editorial bios are sourced paraphrases.\n// Prices, availability and unverified personal characteristics are deliberately absent.\nexport const TRAINERS: ThirdSpaceTrainer[] = ${JSON.stringify(trainers, null, 2)};\n`);
  await mkdir('public/third-space-demo/trainers', { recursive: true });
  const assets = [
    ...profiles.map(profile => ({ path: `public/third-space-demo/trainers/${profile.id}.webp`, url: profile.photoUrl })),
    { path: 'public/third-space-demo/hero.webp', url: 'https://www.thirdspace.london/wp-content/uploads/2024/10/ThirdSpace_PTImagery_JonPaynePhoto_LOCATION_3_539-1619x1080.webp' },
    { path: 'public/third-space-demo/third-space-logo.svg', url: 'https://www.thirdspace.london/wp-content/uploads/2024/07/art_1.svg' },
  ];
  for (const asset of assets) {
    await run('curl', ['--http1.1', '--fail', '--location', '--silent', '--show-error', '--max-time', '45', asset.url, '-o', asset.path]);
    const data = await readFile(asset.path);
    if (data.length < 200) throw new Error(`Empty or invalid asset: ${asset.path}`);
    if (asset.path.endsWith('.webp') && data.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`Expected genuine WebP: ${asset.path}`);
  }
  await writeFile(`${cache}/assets.json`, JSON.stringify(assets, null, 2));
  console.log('Wrote 40 verified trainers and downloaded 42 source assets. The curated club/location catalogue is maintained separately.');
}
