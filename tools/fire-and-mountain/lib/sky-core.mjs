import * as Astronomy from 'astronomy-engine';

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

const PHASES = [
  ['new', 'New Moon'],
  ['waxing-crescent', 'Waxing Crescent'],
  ['first-quarter', 'First Quarter'],
  ['waxing-gibbous', 'Waxing Gibbous'],
  ['full', 'Full Moon'],
  ['waning-gibbous', 'Waning Gibbous'],
  ['last-quarter', 'Last Quarter'],
  ['waning-crescent', 'Waning Crescent'],
];

const halifaxHour = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Halifax', hour: 'numeric', hourCycle: 'h23',
});

/** 12:00 local time in Halifax on an ISO date, as a UTC Date. Halifax is UTC-4 (AST) or UTC-3 (ADT). */
export function noonHalifaxUtc(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  for (const utcHour of [15, 16]) {
    const candidate = new Date(Date.UTC(year, month - 1, day, utcHour));
    if (Number(halifaxHour.format(candidate)) === 12) return candidate;
  }
  throw new Error(`could not find noon in Halifax for ${isoDate}`);
}

/** Phase angle in degrees (0 = new, 180 = full) to one of eight phase slugs, using 45-degree bands. */
export function phaseBucket(phaseAngle) {
  const index = Math.floor(((phaseAngle + 22.5) % 360) / 45);
  return PHASES[index][0];
}

function phaseName(slug) {
  return PHASES.find(([phaseSlug]) => phaseSlug === slug)[1];
}

/** Real moon data for one date, computed at noon in Halifax. */
export function skyForDate(isoDate) {
  const instant = noonHalifaxUtc(isoDate);
  const phase = phaseBucket(Astronomy.MoonPhase(instant));
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, instant).phase_fraction;
  const longitude = Astronomy.EclipticGeoMoon(instant).lon;
  return {
    phase,
    phaseName: phaseName(phase),
    illumination: Math.round(illumination * 100) / 100,
    moonSign: SIGNS[Math.floor(longitude / 30) % 12],
  };
}

/** Inclusive list of ISO dates from start to end. */
export function dateRange(startIso, endIso) {
  const dates = [];
  const end = Date.parse(`${endIso}T00:00:00Z`);
  for (let time = Date.parse(`${startIso}T00:00:00Z`); time <= end; time += 86_400_000) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}
