import type { DavidLloydClub, LondonLocation } from './contract.js';

// Official club addresses and map pins, verified 2026-09-29. See docs/david-lloyd-sources.md.
export const CLUBS: DavidLloydClub[] = [
  {
    "id": "acton-park",
    "name": "Acton Park",
    "address": "East Acton Lane, West London W3 7HB",
    "latitude": 51.5101678,
    "longitude": -0.2553252,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/acton-park/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "beckenham",
    "name": "Beckenham",
    "address": "Stanhope Grove, Beckenham, Kent BR3 3HL",
    "latitude": 51.3961187,
    "longitude": -0.035121,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/beckenham/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "cheam",
    "name": "Cheam",
    "address": "Ewell Road, Cheam, Sutton SM3 8DP",
    "latitude": 51.3575183,
    "longitude": -0.2197891,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/cheam/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "colliers-wood",
    "name": "Colliers Wood",
    "address": "29 Chapter Way, London SW19 2RF",
    "latitude": 51.4141068,
    "longitude": -0.1804335,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/colliers-wood/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "cricklewood-lane",
    "name": "Cricklewood Lane",
    "address": "108-110 Cricklewood Lane, London NW2 2DS",
    "latitude": 51.5593615,
    "longitude": -0.2099867,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/cricklewood-lane/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "enfield",
    "name": "Enfield",
    "address": "Carterhatch Lane, Enfield, Middlesex EN1 4LF",
    "latitude": 51.660224,
    "longitude": -0.0610693,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/enfield/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "finchley",
    "name": "Finchley",
    "address": "Leisure Way, High Road, Finchley, London N12 0QZ",
    "latitude": 51.6046188,
    "longitude": -0.1749255,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/finchley/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "fulham",
    "name": "Fulham",
    "address": "Unit 24, Fulham Broadway Retail Centre, Fulham Road, London SW6 1BW",
    "latitude": 51.4803403,
    "longitude": -0.194502,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/fulham/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "gidea-park",
    "name": "Gidea Park",
    "address": "Squirrels Heath Lane, Gidea Park, Romford, Essex RM11 2DY",
    "latitude": 51.5830686,
    "longitude": 0.2173299,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/gidea-park/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "hampton",
    "name": "Hampton",
    "address": "Staines Road, Hampton, Middlesex TW2 5JD",
    "latitude": 51.438079,
    "longitude": -0.3681089,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/hampton/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "heston",
    "name": "Heston",
    "address": "Southall Lane, Hounslow, Middlesex TW5 9PE",
    "latitude": 51.4936493,
    "longitude": -0.4019602,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/heston/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "kensington",
    "name": "Kensington",
    "address": "Point West, 116 Cromwell Road, London SW7 4XR",
    "latitude": 51.4952981,
    "longitude": -0.1866185,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/kensington/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "kidbrooke-village",
    "name": "Kidbrooke Village",
    "address": "Kidbrooke Park Road, Corner of Weigall Road, London SE12 8HG",
    "latitude": 51.45874,
    "longitude": 0.026309,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/kidbrooke-village/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "kingston",
    "name": "Kingston",
    "address": "2nd Floor The Rotunda, Clarence Street, Kingston upon Thames, Surrey KT1 1QJ",
    "latitude": 51.4116317,
    "longitude": -0.2992154,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/kingston/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "northwood",
    "name": "Northwood",
    "address": "Ducks Hill Road, Northwood, London HA6 2DR",
    "latitude": 51.5980386,
    "longitude": -0.4446848,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/northwood/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "notting-hill",
    "name": "Notting Hill",
    "address": "1 Alfred Road, London W2 5EU",
    "latitude": 51.5208435,
    "longitude": -0.1940686,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/notting-hill/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "purley",
    "name": "Purley",
    "address": "Hannibal Way, Croydon, Surrey CR0 4RW",
    "latitude": 51.3577884,
    "longitude": -0.124404,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/purley/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "raynes-park",
    "name": "Raynes Park",
    "address": "Bushey Road, Raynes Park, London SW20 8TE",
    "latitude": 51.4059884,
    "longitude": -0.2225384,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/raynes-park/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "sidcup",
    "name": "Sidcup",
    "address": "Baugh Road, Rectory Lane, Sidcup, Kent DA14 5ED",
    "latitude": 51.4199787,
    "longitude": 0.1199535,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/sidcup/",
    "verifiedAt": "2026-09-29"
  },
  {
    "id": "sudbury-hill",
    "name": "Sudbury Hill",
    "address": "Greenford Road, Greenford, Middlesex UB6 0HX",
    "latitude": 51.5567517,
    "longitude": -0.3359298,
    "sourceUrl": "https://www.davidlloyd.co.uk/clubs/sudbury-hill/",
    "verifiedAt": "2026-09-29"
  }
];

// Approximate neighbourhood anchors and separate TfL station points. Not journey times.
export const LONDON_LOCATIONS: LondonLocation[] = [
  {
    "id": "acton-park",
    "name": "Acton Park",
    "latitude": 51.5101678,
    "longitude": -0.2553252,
    "aliases": []
  },
  {
    "id": "beckenham",
    "name": "Beckenham",
    "latitude": 51.3961187,
    "longitude": -0.035121,
    "aliases": []
  },
  {
    "id": "cheam",
    "name": "Cheam",
    "latitude": 51.3575183,
    "longitude": -0.2197891,
    "aliases": []
  },
  {
    "id": "colliers-wood",
    "name": "Colliers Wood",
    "latitude": 51.4141068,
    "longitude": -0.1804335,
    "aliases": []
  },
  {
    "id": "cricklewood-lane",
    "name": "Cricklewood Lane",
    "latitude": 51.5593615,
    "longitude": -0.2099867,
    "aliases": []
  },
  {
    "id": "enfield",
    "name": "Enfield",
    "latitude": 51.660224,
    "longitude": -0.0610693,
    "aliases": []
  },
  {
    "id": "finchley",
    "name": "Finchley",
    "latitude": 51.6046188,
    "longitude": -0.1749255,
    "aliases": []
  },
  {
    "id": "fulham",
    "name": "Fulham",
    "latitude": 51.4803403,
    "longitude": -0.194502,
    "aliases": [
      "Fulham Broadway",
      "SW6"
    ]
  },
  {
    "id": "gidea-park",
    "name": "Gidea Park",
    "latitude": 51.5830686,
    "longitude": 0.2173299,
    "aliases": []
  },
  {
    "id": "hampton",
    "name": "Hampton",
    "latitude": 51.438079,
    "longitude": -0.3681089,
    "aliases": []
  },
  {
    "id": "heston",
    "name": "Heston",
    "latitude": 51.4936493,
    "longitude": -0.4019602,
    "aliases": []
  },
  {
    "id": "kensington",
    "name": "Kensington",
    "latitude": 51.4952981,
    "longitude": -0.1866185,
    "aliases": []
  },
  {
    "id": "kidbrooke-village",
    "name": "Kidbrooke Village",
    "latitude": 51.45874,
    "longitude": 0.026309,
    "aliases": []
  },
  {
    "id": "kingston",
    "name": "Kingston",
    "latitude": 51.4116317,
    "longitude": -0.2992154,
    "aliases": []
  },
  {
    "id": "northwood",
    "name": "Northwood",
    "latitude": 51.5980386,
    "longitude": -0.4446848,
    "aliases": []
  },
  {
    "id": "notting-hill",
    "name": "Notting Hill",
    "latitude": 51.5208435,
    "longitude": -0.1940686,
    "aliases": []
  },
  {
    "id": "purley",
    "name": "Purley",
    "latitude": 51.3577884,
    "longitude": -0.124404,
    "aliases": []
  },
  {
    "id": "raynes-park",
    "name": "Raynes Park",
    "latitude": 51.4059884,
    "longitude": -0.2225384,
    "aliases": []
  },
  {
    "id": "sidcup",
    "name": "Sidcup",
    "latitude": 51.4199787,
    "longitude": 0.1199535,
    "aliases": []
  },
  {
    "id": "sudbury-hill",
    "name": "Sudbury Hill",
    "latitude": 51.5567517,
    "longitude": -0.3359298,
    "aliases": []
  },
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
  },
  {
    "id": "earlsfield",
    "name": "Earlsfield",
    "aliases": [
      "Earlsfield station",
      "Earlsfield Rail Station",
      "SW18"
    ],
    "latitude": 51.442337,
    "longitude": -0.187715
  },
  {
    "id": "notting-hill-gate",
    "name": "Notting Hill Gate",
    "aliases": [
      "Notting Hill Gate station",
      "W11"
    ],
    "latitude": 51.5094,
    "longitude": -0.1967
  },
  {
    "id": "high-street-kensington",
    "name": "High Street Kensington",
    "aliases": [
      "High Street Kensington station",
      "W8"
    ],
    "latitude": 51.5009,
    "longitude": -0.1926
  }
];
