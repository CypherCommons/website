// Shared timing for the homepage story, in story units (one unit is roughly
// one viewport of scrolling). The copy, the scene and the phone screen all
// key off these.
export const STORY_LENGTH = 6.4;

// Each chapter's copy takes over from the previous one at `enter`, over SWAP.
export const CHAPTERS = [
  { enter: 0.14, exit: 2.0 }, // address reuse
  { enter: 2.0, exit: 2.92 }, // one reusable address
  { enter: 2.92, exit: 4.04 }, // each payment lands somewhere new
  { enter: 4.04, exit: null }, // funds appear, links don't
];
export const SWAP = 0.3;

export const HERO_EXIT = 0.02;
export const RISE = [0.02, 0.78];

export const BEATS = {
  payTap: 0.8,
  sendPush: [0.88, 1.02],
  sends: [1.12, 1.34, 1.56],
  flight: 0.26,
  linked: 1.86,
  reuseOut: [1.98, 2.14],
  toReceive: [2.02, 2.34],
  broadcast: [2.42, 2.92],
  land: [3.3, 3.56, 3.82],
  landFlight: 0.24,
  toHome: 4.1,
  toSync: 4.42,
  scan: [4.6, 5.5],
  home: [5.0, 5.2, 5.42],
  returnFlight: 0.24,
  backHome: 5.74,
  rows: 5.9,
};
