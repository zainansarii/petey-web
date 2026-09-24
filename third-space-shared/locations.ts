import type { ThirdSpaceClub, LondonLocation } from './contract.js';

// Club coordinates are official directory map pins, checked 2026-09-24.
export const CLUBS: ThirdSpaceClub[] = [
  {
    "id": "battersea",
    "name": "Battersea",
    "address": "Ground Floor, Prospect Way, Battersea Power Station, SW11 8BH",
    "latitude": 51.480377,
    "longitude": -0.1441587,
    "sourceUrl": "https://www.thirdspace.london/clubs/battersea/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "canary-wharf",
    "name": "Canary Wharf",
    "address": "16-19 Canada Square, London E14 5ER",
    "latitude": 51.5047861,
    "longitude": -0.0167412,
    "sourceUrl": "https://www.thirdspace.london/clubs/canary-wharf/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "chelsea",
    "name": "Chelsea",
    "address": "19 Mallord Street, London, SW3 6AP",
    "latitude": 51.4855223,
    "longitude": -0.1746629,
    "sourceUrl": "https://www.thirdspace.london/clubs/chelsea/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "city",
    "name": "City",
    "address": "40 Mark Lane, London EC3R 7AT",
    "latitude": 51.5101381,
    "longitude": -0.0807211,
    "sourceUrl": "https://www.thirdspace.london/clubs/city/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "clapham-junction",
    "name": "Clapham Junction",
    "address": "Clapham Junction, Lavender Hill, London, SW11 1LN",
    "latitude": 51.4637335,
    "longitude": -0.1665724,
    "sourceUrl": "https://www.thirdspace.london/clubs/clapham-junction/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "islington",
    "name": "Islington",
    "address": "15 Esther Anne Place, London, N1 1UL",
    "latitude": 51.5389189,
    "longitude": -0.1036773,
    "sourceUrl": "https://www.thirdspace.london/clubs/islington/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "marylebone",
    "name": "Marylebone",
    "address": "Bulstrode Place, Marylebone, London, W1U 2HU",
    "latitude": 51.5182686,
    "longitude": -0.1501857,
    "sourceUrl": "https://www.thirdspace.london/clubs/marylebone/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "mayfair",
    "name": "Mayfair",
    "address": "22 Clarges Street, London, W1J 5FA",
    "latitude": 51.5075645,
    "longitude": -0.1460225,
    "sourceUrl": "https://www.thirdspace.london/clubs/mayfair/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "moorgate",
    "name": "Moorgate",
    "address": "16 South Place, London EC2M 2AQ",
    "latitude": 51.5189856,
    "longitude": -0.087239,
    "sourceUrl": "https://www.thirdspace.london/clubs/moorgate/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "paternoster-square",
    "name": "Paternoster Square",
    "address": "31 Warwick Lane, London, EC4M 7BW",
    "latitude": 51.5143089,
    "longitude": -0.0990718,
    "sourceUrl": "https://www.thirdspace.london/clubs/paternoster-square/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "richmond",
    "name": "Richmond",
    "address": "4 Golden Ct, Richmond, TW9 1EU",
    "latitude": 51.4673351,
    "longitude": -0.2995367,
    "sourceUrl": "https://www.thirdspace.london/clubs/richmond/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "soho",
    "name": "Soho",
    "address": "67 Brewer Street, Soho, London, W1F 9US",
    "latitude": 51.5111909,
    "longitude": -0.1359601,
    "sourceUrl": "https://www.thirdspace.london/clubs/soho/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "the-whiteley",
    "name": "The Whiteley",
    "address": "The Whiteley, Queensway, London, W2 4YN",
    "latitude": 51.5137446,
    "longitude": -0.1877384,
    "sourceUrl": "https://www.thirdspace.london/clubs/the-whiteley/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "tower-bridge",
    "name": "Tower Bridge",
    "address": "2b More London Riverside, London SE1 2AP",
    "latitude": 51.5052396,
    "longitude": -0.0804341,
    "sourceUrl": "https://www.thirdspace.london/clubs/tower-bridge/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "wimbledon",
    "name": "Wimbledon",
    "address": "4 Queen’s Rd, Wimbledon, London, SW19 8YE",
    "latitude": 51.4208125,
    "longitude": -0.205039,
    "sourceUrl": "https://www.thirdspace.london/clubs/wimbledon/",
    "verifiedAt": "2026-09-24"
  },
  {
    "id": "wood-wharf",
    "name": "Wood Wharf",
    "address": "14 Charter St, London E14 5GZ",
    "latitude": 51.5021297,
    "longitude": -0.0116749,
    "sourceUrl": "https://www.thirdspace.london/clubs/wood-wharf/",
    "verifiedAt": "2026-09-24"
  }
];

// Approximate neighbourhood anchors and TfL station points. See docs/third-space-sources.md.
// Separate named stations retain their own coordinates; these do not represent journey times.
export const LONDON_LOCATIONS: LondonLocation[] = [
  {
    "id": "battersea",
    "name": "Battersea",
    "aliases": [
      "Battersea Power Station",
      "SW8"
    ],
    "latitude": 51.480377,
    "longitude": -0.1441587
  },
  {
    "id": "canary-wharf",
    "name": "Canary Wharf",
    "aliases": [
      "Canary Wharf station",
      "Canada Square",
      "E14"
    ],
    "latitude": 51.5047861,
    "longitude": -0.0167412
  },
  {
    "id": "chelsea",
    "name": "Chelsea",
    "aliases": [
      "Kings Road",
      "King's Road",
      "SW3"
    ],
    "latitude": 51.4855223,
    "longitude": -0.1746629
  },
  {
    "id": "city",
    "name": "City",
    "aliases": [
      "City of London",
      "Fenchurch Street",
      "EC3",
      "EC3R"
    ],
    "latitude": 51.5101381,
    "longitude": -0.0807211
  },
  {
    "id": "clapham-junction",
    "name": "Clapham Junction",
    "aliases": [
      "Clapham Junction station",
      "Lavender Hill",
      "SW11"
    ],
    "latitude": 51.4637335,
    "longitude": -0.1665724
  },
  {
    "id": "islington",
    "name": "Islington",
    "aliases": [
      "Upper Street",
      "N1"
    ],
    "latitude": 51.5389189,
    "longitude": -0.1036773
  },
  {
    "id": "marylebone",
    "name": "Marylebone",
    "aliases": [
      "Marylebone High Street",
      "Bulstrode Place",
      "W1U"
    ],
    "latitude": 51.5182686,
    "longitude": -0.1501857
  },
  {
    "id": "mayfair",
    "name": "Mayfair",
    "aliases": [
      "Clarges Street",
      "W1J"
    ],
    "latitude": 51.5075645,
    "longitude": -0.1460225
  },
  {
    "id": "moorgate",
    "name": "Moorgate",
    "aliases": [
      "South Place",
      "EC2",
      "EC2M"
    ],
    "latitude": 51.5189856,
    "longitude": -0.087239
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
    "id": "paternoster-square",
    "name": "Paternoster Square",
    "aliases": [
      "St Paul's",
      "St Pauls",
      "Saint Pauls",
      "Warwick Lane",
      "EC4",
      "EC4M"
    ],
    "latitude": 51.5143089,
    "longitude": -0.0990718
  },
  {
    "id": "richmond",
    "name": "Richmond",
    "aliases": [
      "Richmond station",
      "TW9"
    ],
    "latitude": 51.4673351,
    "longitude": -0.2995367
  },
  {
    "id": "soho",
    "name": "Soho",
    "aliases": [
      "Brewer Street",
      "W1F",
      "W1D"
    ],
    "latitude": 51.5111909,
    "longitude": -0.1359601
  },
  {
    "id": "the-whiteley",
    "name": "The Whiteley",
    "aliases": [
      "Whiteley",
      "W2"
    ],
    "latitude": 51.5137446,
    "longitude": -0.1877384
  },
  {
    "id": "tower-bridge",
    "name": "Tower Bridge",
    "aliases": [
      "More London",
      "SE1"
    ],
    "latitude": 51.5052396,
    "longitude": -0.0804341
  },
  {
    "id": "wimbledon",
    "name": "Wimbledon",
    "aliases": [
      "Wimbledon station",
      "SW19"
    ],
    "latitude": 51.4208125,
    "longitude": -0.205039
  },
  {
    "id": "wood-wharf",
    "name": "Wood Wharf",
    "aliases": [
      "Charter Street",
      "Wood Wharf E14"
    ],
    "latitude": 51.5021297,
    "longitude": -0.0116749
  },
  {
    "id": "brixton",
    "name": "Brixton",
    "aliases": [
      "Brixton station",
      "SW2",
      "SW9"
    ],
    "latitude": 51.4626,
    "longitude": -0.1146
  },
  {
    "id": "shoreditch",
    "name": "Shoreditch",
    "aliases": [
      "E2"
    ],
    "latitude": 51.5246,
    "longitude": -0.0787
  },
  {
    "id": "fulham",
    "name": "Fulham",
    "aliases": [
      "Fulham Broadway",
      "SW6"
    ],
    "latitude": 51.4805,
    "longitude": -0.1958
  },
  {
    "id": "stratford",
    "name": "Stratford",
    "aliases": [
      "Stratford station",
      "Olympic Park",
      "E15",
      "E20"
    ],
    "latitude": 51.5413,
    "longitude": -0.0033
  },
  {
    "id": "angel",
    "name": "Angel",
    "aliases": [
      "Angel station",
      "City Road",
      "EC1"
    ],
    "latitude": 51.5322,
    "longitude": -0.1058
  },
  {
    "id": "highbury",
    "name": "Highbury",
    "aliases": [
      "Highbury and Islington",
      "Highbury & Islington",
      "N5"
    ],
    "latitude": 51.5463,
    "longitude": -0.1033
  },
  {
    "id": "paddington",
    "name": "Paddington",
    "aliases": [
      "Paddington station",
      "Paddington Basin"
    ],
    "latitude": 51.5154,
    "longitude": -0.1755
  },
  {
    "id": "notting-hill",
    "name": "Notting Hill",
    "aliases": [
      "Notting Hill Gate",
      "W11"
    ],
    "latitude": 51.5094,
    "longitude": -0.1967
  },
  {
    "id": "kensington",
    "name": "Kensington",
    "aliases": [
      "High Street Kensington",
      "W8"
    ],
    "latitude": 51.5009,
    "longitude": -0.1926
  },
  {
    "id": "south-kensington",
    "name": "South Kensington",
    "aliases": [
      "South Kensington station",
      "SW7"
    ],
    "latitude": 51.4941,
    "longitude": -0.1738
  },
  {
    "id": "hammersmith",
    "name": "Hammersmith",
    "aliases": [
      "Hammersmith station",
      "W6"
    ],
    "latitude": 51.4928,
    "longitude": -0.2237
  },
  {
    "id": "shepherds-bush",
    "name": "Shepherd's Bush",
    "aliases": [
      "Shepherds Bush",
      "W12"
    ],
    "latitude": 51.5048,
    "longitude": -0.2188
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
  },
  {
    "id": "victoria",
    "name": "Victoria",
    "aliases": [
      "Victoria station",
      "SW1"
    ],
    "latitude": 51.4965,
    "longitude": -0.1447
  },
  {
    "id": "bank",
    "name": "Bank",
    "aliases": [
      "Bank station",
      "EC2R"
    ],
    "latitude": 51.5134,
    "longitude": -0.089
  },
  {
    "id": "kings-cross",
    "name": "King's Cross",
    "aliases": [
      "Kings Cross",
      "St Pancras",
      "King Cross",
      "N1C"
    ],
    "latitude": 51.5308,
    "longitude": -0.1238
  },
  {
    "id": "camden",
    "name": "Camden",
    "aliases": [
      "Camden Town",
      "NW1"
    ],
    "latitude": 51.5392,
    "longitude": -0.1426
  },
  {
    "id": "fitzrovia",
    "name": "Fitzrovia",
    "aliases": [
      "Goodge Street",
      "W1T",
      "W1W"
    ],
    "latitude": 51.5206,
    "longitude": -0.1341
  },
  {
    "id": "covent-garden",
    "name": "Covent Garden",
    "aliases": [
      "WC2",
      "WC2E"
    ],
    "latitude": 51.5129,
    "longitude": -0.1243
  },
  {
    "id": "holborn",
    "name": "Holborn",
    "aliases": [
      "Holborn station",
      "WC1",
      "WC1V"
    ],
    "latitude": 51.5174,
    "longitude": -0.12
  },
  {
    "id": "hackney",
    "name": "Hackney",
    "aliases": [
      "Hackney Central",
      "E8",
      "E9"
    ],
    "latitude": 51.5471,
    "longitude": -0.0551
  },
  {
    "id": "bethnal-green",
    "name": "Bethnal Green",
    "aliases": [
      "Bethnal Green station"
    ],
    "latitude": 51.527,
    "longitude": -0.0552
  },
  {
    "id": "whitechapel",
    "name": "Whitechapel",
    "aliases": [
      "E1"
    ],
    "latitude": 51.5194,
    "longitude": -0.0597
  },
  {
    "id": "greenwich",
    "name": "Greenwich",
    "aliases": [
      "Cutty Sark",
      "SE10"
    ],
    "latitude": 51.4815,
    "longitude": -0.0096
  },
  {
    "id": "bermondsey",
    "name": "Bermondsey",
    "aliases": [
      "Bermondsey station",
      "SE16"
    ],
    "latitude": 51.4979,
    "longitude": -0.0637
  },
  {
    "id": "clapham-common",
    "name": "Clapham Common",
    "aliases": [
      "Clapham",
      "SW4"
    ],
    "latitude": 51.4618,
    "longitude": -0.1383
  },
  {
    "id": "balham",
    "name": "Balham",
    "aliases": [
      "Balham station",
      "SW12"
    ],
    "latitude": 51.4433,
    "longitude": -0.1525
  },
  {
    "id": "tooting",
    "name": "Tooting",
    "aliases": [
      "Tooting Broadway",
      "SW17"
    ],
    "latitude": 51.4275,
    "longitude": -0.168
  },
  {
    "id": "putney",
    "name": "Putney",
    "aliases": [
      "SW15"
    ],
    "latitude": 51.4613,
    "longitude": -0.2166
  },
  {
    "id": "ealing",
    "name": "Ealing",
    "aliases": [
      "Ealing Broadway",
      "W5"
    ],
    "latitude": 51.5149,
    "longitude": -0.3017
  },
  {
    "id": "chiswick",
    "name": "Chiswick",
    "aliases": [
      "W4"
    ],
    "latitude": 51.4927,
    "longitude": -0.2577
  },
  {
    "id": "finsbury-park",
    "name": "Finsbury Park",
    "aliases": [
      "Finsbury Park station",
      "N4"
    ],
    "latitude": 51.5646,
    "longitude": -0.1063
  },
  {
    "id": "hampstead",
    "name": "Hampstead",
    "aliases": [
      "Hampstead station",
      "NW3"
    ],
    "latitude": 51.5567,
    "longitude": -0.1781
  },
  {
    "id": "queens-park-area",
    "name": "Queen's Park",
    "aliases": [
      "Queens Park",
      "NW6"
    ],
    "latitude": 51.5342,
    "longitude": -0.2054
  },
  {
    "id": "london-bridge",
    "name": "London Bridge",
    "aliases": [
      "London Bridge station"
    ],
    "latitude": 51.505721,
    "longitude": -0.088873
  },
  {
    "id": "old-street",
    "name": "Old Street",
    "aliases": [
      "Old Street station",
      "EC1V"
    ],
    "latitude": 51.525864,
    "longitude": -0.08777
  },
  {
    "id": "hoxton",
    "name": "Hoxton",
    "aliases": [
      "Hoxton station"
    ],
    "latitude": 51.531512,
    "longitude": -0.075681
  },
  {
    "id": "white-city",
    "name": "White City",
    "aliases": [
      "White City station"
    ],
    "latitude": 51.511959,
    "longitude": -0.224297
  },
  {
    "id": "pimlico",
    "name": "Pimlico",
    "aliases": [
      "Pimlico station",
      "SW1V"
    ],
    "latitude": 51.489097,
    "longitude": -0.133761
  },
  {
    "id": "parsons-green",
    "name": "Parsons Green",
    "aliases": [
      "Parsons Green station"
    ],
    "latitude": 51.475277,
    "longitude": -0.20117
  },
  {
    "id": "nine-elms",
    "name": "Nine Elms",
    "aliases": [
      "Nine Elms station"
    ],
    "latitude": 51.479912,
    "longitude": -0.128476
  },
  {
    "id": "monument",
    "name": "Monument",
    "aliases": [
      "Monument station"
    ],
    "latitude": 51.5107,
    "longitude": -0.085969
  },
  {
    "id": "green-park",
    "name": "Green Park",
    "aliases": [
      "Green Park station"
    ],
    "latitude": 51.506947,
    "longitude": -0.142787
  },
  {
    "id": "piccadilly-circus",
    "name": "Piccadilly Circus",
    "aliases": [
      "Piccadilly Circus station"
    ],
    "latitude": 51.51005,
    "longitude": -0.133798
  },
  {
    "id": "bayswater",
    "name": "Bayswater",
    "aliases": [
      "Bayswater station"
    ],
    "latitude": 51.512284,
    "longitude": -0.187938
  },
  {
    "id": "queensway",
    "name": "Queensway",
    "aliases": [
      "Queensway station"
    ],
    "latitude": 51.510312,
    "longitude": -0.187152
  },
  {
    "id": "mansion-house",
    "name": "Mansion House",
    "aliases": [
      "Mansion House station"
    ],
    "latitude": 51.512117,
    "longitude": -0.094009
  },
  {
    "id": "leicester-square",
    "name": "Leicester Square",
    "aliases": [
      "Leicester Square station"
    ],
    "latitude": 51.511386,
    "longitude": -0.128426
  },
  {
    "id": "cambridge-heath",
    "name": "Cambridge Heath",
    "aliases": [
      "Cambridge Heath station"
    ],
    "latitude": 51.531973,
    "longitude": -0.057279
  },
  {
    "id": "aldgate-east",
    "name": "Aldgate East",
    "aliases": [
      "Aldgate East station"
    ],
    "latitude": 51.515037,
    "longitude": -0.072384
  },
  {
    "id": "clapham-north",
    "name": "Clapham North",
    "aliases": [
      "Clapham North station"
    ],
    "latitude": 51.465135,
    "longitude": -0.130016
  },
  {
    "id": "clapham-south",
    "name": "Clapham South",
    "aliases": [
      "Clapham South station"
    ],
    "latitude": 51.452654,
    "longitude": -0.147582
  },
  {
    "id": "east-putney",
    "name": "East Putney",
    "aliases": [
      "East Putney station"
    ],
    "latitude": 51.459205,
    "longitude": -0.211
  },
  {
    "id": "putney-bridge",
    "name": "Putney Bridge",
    "aliases": [
      "Putney Bridge station"
    ],
    "latitude": 51.468262,
    "longitude": -0.208731
  },
  {
    "id": "turnham-green",
    "name": "Turnham Green",
    "aliases": [
      "Turnham Green station"
    ],
    "latitude": 51.495148,
    "longitude": -0.254555
  },
  {
    "id": "shoreditch-high-street",
    "name": "Shoreditch High Street",
    "aliases": [
      "Shoreditch High Street station"
    ],
    "latitude": 51.523375,
    "longitude": -0.075246
  }
];
