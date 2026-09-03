import aliyahPhoto from "../../../assets/trainers/aliyah-rahman.webp";
import marcusPhoto from "../../../assets/trainers/marcus-adebayo.webp";
import mayaPhoto from "../../../assets/trainers/maya-chen.webp";
import rohanPhoto from "../../../assets/trainers/rohan-kapoor.webp";

export type Trainer = {
  id: string;
  name: string;
  photo: string;
  specialty: string;
  specialties: string[];
  area: string;
  price: number;
  tenPackPrice: number;
  monthlyPrice: number;
  distanceMiles: number;
  coachingStyles: string[];
  venues: string[];
  qualifications: string[];
  availability: string[];
  bio: string;
};

export const trainerCardName = (trainer: Pick<Trainer, "name">) => (
  trainer.name.trim().split(/\s+/)[0] || trainer.name
);

export const TRAINERS: Trainer[] = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    photo: mayaPhoto,
    specialty: "Running & endurance",
    specialties: ["General fitness", "Mobility", "Fat loss", "Functional fitness"],
    area: "Battersea · SW11",
    price: 70,
    tenPackPrice: 630,
    monthlyPrice: 360,
    distanceMiles: 2.4,
    coachingStyles: ["Encouraging", "Friendly", "Educational"],
    venues: ["Outdoors", "Your home", "Private studio", "Remote"],
    qualifications: [
      "Level 3 Personal Training",
      "Leader in Running Fitness",
      "Emergency First Aid at Work",
    ],
    availability: ["Weekday mornings", "Weekday evenings", "Weekend mornings"],
    bio: "Maya makes movement feel achievable. Her sessions blend practical strength, running confidence and steady encouragement for people building a routine that lasts.",
  },
  {
    id: "marcus-adebayo",
    name: "Marcus Adebayo",
    photo: marcusPhoto,
    specialty: "Strength",
    specialties: ["Muscle building", "Powerlifting", "Body recomposition", "Functional fitness"],
    area: "Shoreditch · E1",
    price: 80,
    tenPackPrice: 720,
    monthlyPrice: 480,
    distanceMiles: 3.2,
    coachingStyles: ["Data-driven", "Accountable", "Educational"],
    venues: ["Commercial gym", "Private studio", "Your office", "Remote"],
    qualifications: [
      "Level 3 Personal Training",
      "Level 4 Strength & Conditioning",
      "Emergency First Aid at Work",
    ],
    availability: ["Weekday lunchtimes", "Weekday evenings", "Weekend lunchtimes"],
    bio: "Marcus combines clear technique with measurable progress. Expect focused sessions, honest feedback and a plan that makes every hour in the gym count.",
  },
  {
    id: "aliyah-rahman",
    name: "Aliyah Rahman",
    photo: aliyahPhoto,
    specialty: "Pilates",
    specialties: ["Mobility", "Body recomposition", "General fitness", "Functional fitness"],
    area: "Islington · N1",
    price: 65,
    tenPackPrice: 590,
    monthlyPrice: 340,
    distanceMiles: 4.1,
    coachingStyles: ["Calm", "Friendly", "Educational"],
    venues: ["Commercial gym", "Outdoors", "Your home", "Your office", "Private studio", "Remote"],
    qualifications: [
      "Level 3 Personal Training",
      "Level 3 Mat Pilates",
      "Emergency First Aid at Work",
    ],
    availability: [
      "Weekday mornings",
      "Weekday lunchtimes",
      "Weekday evenings",
      "Weekend mornings",
      "Weekend lunchtimes",
    ],
    bio: "Aliyah brings calm, precise coaching to Pilates-led strength and mobility. Her sessions build confidence, control and everyday ease from wherever you are starting.",
  },
  {
    id: "rohan-kapoor",
    name: "Rohan Kapoor",
    photo: rohanPhoto,
    specialty: "Boxing & combat fitness",
    specialties: ["HIIT", "Strength", "Body recomposition", "General fitness"],
    area: "Bethnal Green · E2",
    price: 75,
    tenPackPrice: 680,
    monthlyPrice: 420,
    distanceMiles: 3.8,
    coachingStyles: ["High-energy", "Accountable", "Educational"],
    venues: ["Commercial gym", "Outdoors", "Your home", "Your office", "Private studio", "Remote"],
    qualifications: [
      "Level 3 Personal Training",
      "Level 2 Boxing Coach",
      "Emergency First Aid at Work",
    ],
    availability: ["Weekday mornings", "Weekday lunchtimes", "Weekday evenings", "Weekend mornings"],
    bio: "Rohan blends boxing technique, conditioning and focused accountability. His high-energy sessions turn hard work into clear progress without losing sight of good form.",
  },
];

export const orderTrainersFor = () => [...TRAINERS];

export const matchReasonFor = (trainer: Trainer) => (
  `${trainer.specialty} · ${trainer.coachingStyles[0] ?? "Personal training"}`
);
