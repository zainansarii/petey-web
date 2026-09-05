import aliyahPhoto from "../../../assets/trainers/aliyah-rahman.webp";
import marcusPhoto from "../../../assets/trainers/marcus-adebayo.webp";
import mayaPhoto from "../../../assets/trainers/maya-chen.webp";
import rohanPhoto from "../../../assets/trainers/rohan-kapoor.webp";
import leannePhoto from "../../../assets/trainers/leanne-brooks.png";
import johnPhoto from "../../../assets/trainers/john-kim.png";
import aleemPhoto from "../../../assets/trainers/aleem-malik.png";
import yasminPhoto from "../../../assets/trainers/yasmin-okafor.png";
import type { TrainerCardPreview } from "../model/trainer";

export { trainerCardName, matchReasonFor } from "../model/trainer";
export type { Trainer } from "../model/trainer";

// Public landing carousel examples only. Full trainer data and real matches
// come from the backend catalog; local QA loads its own development fixture.
export const TRAINERS: TrainerCardPreview[] = [
  { id: "maya-chen", name: "Maya Chen", photo: mayaPhoto, specialty: "Running and endurance", area: "Battersea · SW11", price: 70, isDemo: true },
  { id: "marcus-adebayo", name: "Marcus Adebayo", photo: marcusPhoto, specialty: "Strength", area: "Shoreditch · E1", price: 80, isDemo: true },
  { id: "aliyah-rahman", name: "Aliyah Rahman", photo: aliyahPhoto, specialty: "Pilates", area: "Islington · N1", price: 65, isDemo: true },
  { id: "rohan-kapoor", name: "Rohan Kapoor", photo: rohanPhoto, specialty: "Boxing & combat fitness", area: "Bethnal Green · E2", price: 75, isDemo: true },
  { id: "leanne-brooks", name: "Leanne Brooks", photo: leannePhoto, specialty: "Calisthenics", area: "Greenwich · SE10", price: 68, isDemo: true },
  { id: "john-kim", name: "John Kim", photo: johnPhoto, specialty: "Running and endurance", area: "Richmond · TW9", price: 72, isDemo: true },
  { id: "aleem-malik", name: "Aleem Malik", photo: aleemPhoto, specialty: "Sport-specific training", area: "Wembley · HA0", price: 76, isDemo: true },
  { id: "yasmin-okafor", name: "Yasmin Okafor", photo: yasminPhoto, specialty: "Strength", area: "Stratford · E15", price: 85, isDemo: true },
];

export const orderTrainersFor = () => [...TRAINERS];
