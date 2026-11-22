import type { IaqHack } from '../types';

export const STATIC_IAQ_HACKS: IaqHack[] = [
  { 
    id: 'kitchen-lid-exhaust',
    title: 'Cross-Draft + Lid-First Cooking Protocol',
    room: 'Kitchen',
    budget: 'Zero-Cost Hacks',
    steps:
      'Turn on the chimney or exhaust fan 3 minutes before igniting the burner, keep pot lids on during boiling/simmering, and open only a kitchen-adjacent window during high-heat tadka.',
    directImpact:
      'Captures up to 65–75% of cooking ultrafine PM2.5 and peak NO₂ plumes before they drift into bedrooms.',
    reductionPercent: 68,
  },
  {
    id: 'kitchen-induction-swap',
    title: 'Single-Burner Induction for Morning & Tea Prep',
    room: 'Kitchen',
    budget: 'Low-Cost DIY',
    steps:
      'Shift boiling water, milk, and daily sautéing from open LPG/gas flames onto a portable induction cooktop to eliminate combustion NO₂ and CO indoors.',
    directImpact:
      'Eliminates 100% of gas-flame nitrogen dioxide emissions indoors, cutting peak kitchen NO₂ spikes by ~55%.',
    reductionPercent: 55,
  },
  {
    id: 'bedroom-towel-seal',
    title: 'Draft-Door Gap Seal & Wet Window Sill Wipe',
    room: 'Bedroom',
    budget: 'Zero-Cost Hacks',
    steps:
      'Place a rolled damp cotton towel along exterior door bottom gaps during overnight inversion hours and wipe window ledges with a damp cloth every evening instead of dry dusting.',
    directImpact:
      'Blocks 30–40% of nocturnal outdoor smog infiltration and stops settled coarse PM10 dust from resuspending.',
    reductionPercent: 35,
  },
  {
    id: 'bedroom-cr-box',
    title: 'DIY Corsi-Rosenthal 4-Filter Cube Purifier',
    room: 'Bedroom',
    budget: 'Low-Cost DIY',
    steps:
      'Tape four MERV-13 furnace filters into a cube with a cardboard floor and seal a 20-inch box fan facing upward on top using duct tape.',
    directImpact:
      'Delivers 350–500 CFM clean air delivery rate (CADR), trapping ~85–92% of indoor PM2.5 at a fraction of commercial purifier cost.',
    reductionPercent: 88,
  },
  {
    id: 'living-wet-mop',
    title: 'Microfiber Wet-Mop & Shoes-Off Entry Zone',
    room: 'Living Room',
    budget: 'Zero-Cost Hacks',
    steps:
      'Leave outdoor footwear on a washable tray outside the main door and switch from dry brooming to daily damp microfiber mopping across high-traffic floors.',
    directImpact:
      'Prevents tracked-in brake dust and heavy-metal PM10 from aerosolizing indoors, lowering settled dust exposure by ~45%.',
    reductionPercent: 45,
  },
  {
    id: 'living-hepa-smart',
    title: 'Automated H13 HEPA + PM2.5 Laser Sensor Loop',
    room: 'Living Room',
    budget: 'Smart Tech',
    steps:
      'Position an H13 True HEPA purifier 18 inches away from walls in the main lounge and link its Auto/Turbo trigger to a threshold above 35 µg/m³.',
    directImpact:
      'Maintains 4–5 air changes per hour (ACH), cutting indoor fine particulate concentrations by up to 94% within 30 minutes.',
    reductionPercent: 94,
  },
  {
    id: 'office-desk-microzone',
    title: 'Midday Thermal Flush & Humidified Nasal Barrier',
    room: 'Home Office',
    budget: 'Zero-Cost Hacks',
    steps:
      'Flush your study for 10 minutes strictly during the afternoon lowest-AQI window, then keep indoor relative humidity between 40–50% with a bowl of clean water near warm radiators.',
    directImpact:
      'Clears accumulated CO₂ drowsiness while preserving airway mucociliary clearance and helping airborne dust settle faster.',
    reductionPercent: 32,
  },
  {
    id: 'office-co2-pm-monitor',
    title: 'Dual CO₂ + Laser PM2.5 Desk Monitor',
    room: 'Home Office',
    budget: 'Smart Tech',
    steps:
      'Place a calibrated NDIR CO₂ + laser PM2.5 monitor beside your workstation to distinguish stuffy indoor CO₂ (>1,000 ppm) from outdoor smog intrusion.',
    directImpact:
      'Prevents blind window-opening during toxic spikes, cutting unnecessary outdoor PM2.5 ingress by ~60%.',
    reductionPercent: 60,
  },
];
