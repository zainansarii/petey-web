import type { GymboxClub, LondonLocation } from "./contract.js";

// Sources and precision are recorded in docs/gymbox-sources.md (retrieved 2026-10-02).
// These are approximate geographic anchors, not entrances or journey times.
// Victoria uses its official address postcode centroid; Ealing uses the mapped OSM address.
export const CLUBS: GymboxClub[] = [
  {
    "id": "bank",
    "name": "Bank",
    "address": "71 Lombard Street, London EC3V 9AY",
    "latitude": 51.5129073,
    "longitude": -0.0875166,
    "sourceUrl": "https://gymbox.com/gyms/bank/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://maps.app.goo.gl/dJERHtcFMehr5oePA",
    "coordinatePrecision": "club-map"
  },
  {
    "id": "ealing",
    "name": "Ealing",
    "address": "Unit 15, Dickens Yard, Longfield Avenue, London W5 2TD",
    "latitude": 51.5141116,
    "longitude": -0.3060147,
    "sourceUrl": "https://gymbox.com/gyms/ealing/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://www.openstreetmap.org/node/7804693876",
    "coordinatePrecision": "mapped-address"
  },
  {
    "id": "elephant-and-castle",
    "name": "Elephant & Castle",
    "address": "Unit 7, 38 New Kent Road, London SE1 6TJ",
    "latitude": 51.494731,
    "longitude": -0.0980499,
    "sourceUrl": "https://gymbox.com/gyms/elephant-and-castle/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://maps.app.goo.gl/MVSr2oayvfHGikW29",
    "coordinatePrecision": "club-map"
  },
  {
    "id": "farringdon",
    "name": "Farringdon",
    "address": "12A Leather Lane, London EC1N 7SS",
    "latitude": 51.5189875,
    "longitude": -0.1088356,
    "sourceUrl": "https://gymbox.com/gyms/farringdon/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://maps.app.goo.gl/CgFr5kdkEPZrUV2u6",
    "coordinatePrecision": "club-map"
  },
  {
    "id": "finsbury-park",
    "name": "Finsbury Park",
    "address": "Unit 4 City North Place, Finsbury Park, London N4 3HN",
    "latitude": 51.5644923,
    "longitude": -0.1073901,
    "sourceUrl": "https://gymbox.com/gyms/finsbury-park/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://gymbox.com/gyms/finsbury-park/",
    "coordinatePrecision": "club-map"
  },
  {
    "id": "holborn",
    "name": "Holborn",
    "address": "100 High Holborn, London WC1V 6RD",
    "latitude": 51.517872,
    "longitude": -0.118852,
    "sourceUrl": "https://gymbox.com/gyms/holborn/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://maps.app.goo.gl/y4Mp2QK8Cm5wWQi37",
    "coordinatePrecision": "club-map"
  },
  {
    "id": "old-street",
    "name": "Old Street",
    "address": "201A Old Street, London EC1V 9NP",
    "latitude": 51.5256678,
    "longitude": -0.0898138,
    "sourceUrl": "https://gymbox.com/gyms/old-street/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://maps.app.goo.gl/YdM5prxPjBgC5ycv9",
    "coordinatePrecision": "club-map"
  },
  {
    "id": "victoria",
    "name": "Victoria",
    "address": "10 Greencoat House, Francis Street, London SW1P 1DH",
    "latitude": 51.49597,
    "longitude": -0.136783,
    "sourceUrl": "https://gymbox.com/gyms/victoria/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://api.postcodes.io/postcodes/SW1P1DH",
    "coordinatePrecision": "postcode-centroid"
  },
  {
    "id": "westfield-shepherds-bush",
    "name": "Westfield Shepherds Bush",
    "address": "Westfield Shopping Centre, Ariel Way, London W12 7GF",
    "latitude": 51.5070928,
    "longitude": -0.2201792,
    "sourceUrl": "https://gymbox.com/gyms/westfield-london/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://maps.app.goo.gl/QJwpcAVVM3hNDshc8",
    "coordinatePrecision": "club-map"
  },
  {
    "id": "westfield-stratford",
    "name": "Westfield Stratford",
    "address": "Westfield Stratford City, 6A Chestnut Place, London E20 1GL",
    "latitude": 51.5422981,
    "longitude": -0.0076545,
    "sourceUrl": "https://gymbox.com/gyms/westfield-stratford/",
    "verifiedAt": "2026-10-02",
    "coordinateSourceUrl": "https://www.stratfordcross.co.uk/eat-drink-shop-play/retailers/gymbox/",
    "coordinatePrecision": "club-map"
  }
];

export const LONDON_LOCATIONS: LondonLocation[] = [
  {
    "id": "bank",
    "name": "Bank",
    "aliases": [
      "Bank station",
      "EC3V",
      "EC2R"
    ],
    "latitude": 51.5129073,
    "longitude": -0.0875166
  },
  {
    "id": "ealing",
    "name": "Ealing",
    "aliases": [
      "Ealing Broadway",
      "Dickens Yard",
      "W5"
    ],
    "latitude": 51.5141116,
    "longitude": -0.3060147
  },
  {
    "id": "elephant-and-castle",
    "name": "Elephant & Castle",
    "aliases": [
      "Elephant and Castle",
      "Elephant Castle"
    ],
    "latitude": 51.494731,
    "longitude": -0.0980499
  },
  {
    "id": "farringdon",
    "name": "Farringdon",
    "aliases": [
      "Leather Lane",
      "EC1N"
    ],
    "latitude": 51.5189875,
    "longitude": -0.1088356
  },
  {
    "id": "finsbury-park",
    "name": "Finsbury Park",
    "aliases": [
      "Finsbury Park station",
      "N4"
    ],
    "latitude": 51.5644923,
    "longitude": -0.1073901
  },
  {
    "id": "holborn",
    "name": "Holborn",
    "aliases": [
      "Holborn station",
      "WC1V"
    ],
    "latitude": 51.517872,
    "longitude": -0.118852
  },
  {
    "id": "old-street",
    "name": "Old Street",
    "aliases": [
      "Old Street station",
      "EC1V"
    ],
    "latitude": 51.5256678,
    "longitude": -0.0898138
  },
  {
    "id": "victoria",
    "name": "Victoria",
    "aliases": [
      "Victoria station",
      "SW1P"
    ],
    "latitude": 51.49597,
    "longitude": -0.136783
  },
  {
    "id": "westfield-shepherds-bush",
    "name": "Westfield Shepherds Bush",
    "aliases": [
      "Westfield London",
      "Shepherd's Bush",
      "Shepherds Bush",
      "W12"
    ],
    "latitude": 51.5070928,
    "longitude": -0.2201792
  },
  {
    "id": "westfield-stratford",
    "name": "Westfield Stratford",
    "aliases": [
      "Stratford",
      "Stratford City",
      "Westfield Stratford City",
      "E20"
    ],
    "latitude": 51.5422981,
    "longitude": -0.0076545
  },
  {
    "id": "city",
    "name": "City of London",
    "aliases": [
      "City",
      "EC3",
      "EC3R"
    ],
    "latitude": 51.5101381,
    "longitude": -0.0807211
  },
  {
    "id": "earlsfield",
    "name": "Earlsfield",
    "aliases": [
      "Earlsfield station",
      "SW18"
    ],
    "latitude": 51.442337,
    "longitude": -0.187715
  },
  {
    "id": "liverpool-street",
    "name": "Liverpool Street",
    "aliases": [
      "Liverpool Street station"
    ],
    "latitude": 51.517372,
    "longitude": -0.083182
  },
  {
    "id": "shoreditch",
    "name": "Shoreditch",
    "aliases": [
      "Shoreditch High Street",
      "E2"
    ],
    "latitude": 51.523375,
    "longitude": -0.075246
  },
  {
    "id": "canary-wharf",
    "name": "Canary Wharf",
    "aliases": [
      "Canary Wharf station",
      "E14"
    ],
    "latitude": 51.5047861,
    "longitude": -0.0167412
  },
  {
    "id": "waterloo",
    "name": "Waterloo",
    "aliases": [
      "Waterloo station",
      "South Bank"
    ],
    "latitude": 51.5033,
    "longitude": -0.1147
  }
];
