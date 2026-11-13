// GoLingo Goal Club — original shot puzzles. Coordinates are world-space metres.
// The goal plane is z=-11.8. Every goal lane has a verified reachable trajectory.
const defender = (x, z, extra = {}) => ({ x, z, radius: .55, height: 2.17, moving: false, amplitude: 0, speed: .8, phase: 0, keeper: false, ...extra });
const obstacle = (type, x, z, width, depth, height = 1.1, extra = {}) => ({ type, x, z, width, depth, height, moving: false, amplitude: 0, speed: .75, phase: 0, ...extra });
// The keeper's reach includes raised gloves; the visual rig raises them for high shots.
const keeper = (x, amplitude = 2.1, phase = 0) => defender(x, -11.0, { keeper: true, moving: true, amplitude: Math.max(1.05,amplitude*.72), speed: .95, phase, radius: .62, height: 2.8 });

export const LEVELS = [
  {
    name: 'Bend the wall', tip: 'The red wall blocks a straight shot. Sweep around either side.',
    theme: 0, startX: 0, startZ: 9, goalX: 0, goalWidth: 7.2, balls: 3,
    defenders: [defender(-1, -1), defender(0, -1), defender(1, -1)],
    obstacles: [obstacle('cone', -4.9, -6, .8, .8, .9), obstacle('cone', 4.9, -6, .8, .8, .9)]
  },
  {
    name: 'Crossing guard', tip: 'Wait for the runner, then bend past the two guards.',
    theme: 0, startX: -1.5, startZ: 9.5, goalX: 1, goalWidth: 7, balls: 3,
    defenders: [defender(-.6, -3.7), defender(.6, -3.7), defender(0, 2, { moving: true, amplitude: 2.8, speed: 1.05, phase: .4 })],
    obstacles: [obstacle('cone', -4.7, -1.1, 1, 1, 1), obstacle('cone', 4.6, -6.4, 1, 1, 1)]
  },
  {
    name: 'Street blockade', tip: 'Find the outside of the barricade, then bring the ball back.',
    theme: 2, startX: 1, startZ: 10.5, goalX: -.8, goalWidth: 7, balls: 3,
    defenders: [defender(-1.8, -6.7), defender(1.1, -7.4, { moving: true, amplitude: 1.2, speed: .85, phase: 2 })],
    obstacles: [obstacle('wall', 0, .5, 2.8, 1.1, 1.65), obstacle('cone', -4.8, -3, 1.2, 1.2, 1.2)]
  },
  {
    name: 'Timber turn', tip: 'Curl around the logs, or try a controlled chip over the lower pile.',
    theme: 1, startX: -2, startZ: 10, goalX: .8, goalWidth: 7.4, balls: 3,
    defenders: [defender(.5, -7.6), defender(-1.1, -7.6)],
    obstacles: [obstacle('log', -.2, -.7, 3.2, 2.2, 1.2), obstacle('log', 3.8, 3.5, 1.7, 3.2, 1)]
  },
  {
    name: 'Beat the keeper', tip: 'Curve around the wall and time the keeper’s crossing.',
    theme: 0, startX: 0, startZ: 10, goalX: 0, goalWidth: 6.6, balls: 3,
    defenders: [defender(-1.1, -.8), defender(0, -.8), defender(1.1, -.8), keeper(0, 2.1, .4)],
    obstacles: []
  },
  {
    name: 'Cone alley', tip: 'A driven shot threads the cones quickly. Keep an eye on the runner.',
    theme: 2, startX: 2.8, startZ: 10, goalX: -1.2, goalWidth: 7.2, balls: 3,
    defenders: [defender(-.6, -7.8, { moving: true, amplitude: 2.4, speed: .8, phase: 1.4 })],
    obstacles: [obstacle('cone', -2.6, 3, .9, 1, 1.2), obstacle('cone', 2.5, 3, .9, 1, 1.2), obstacle('cone', -2.7, -.6, 1, 1, 1.2), obstacle('cone', 2.6, -.6, 1, 1, 1.2), obstacle('cone', -3.1, -4.5, 1, 1, 1.2), obstacle('cone', 2.5, -4.5, 1, 1, 1.2)]
  },
  {
    name: 'Double red line', tip: 'The second row closes the gap. Try a wider approach.',
    theme: 0, startX: -2.5, startZ: 11, goalX: 1.4, goalWidth: 6.8, balls: 3,
    defenders: [defender(-1.6, 1.6), defender(-.5, 1.6), defender(.6, 1.6), defender(-.3, -5.3), defender(.8, -5.3), defender(1.9, -5.3)],
    obstacles: []
  },
  {
    name: 'Rolling roadblock', tip: 'The barricade slides across the road. Launch into the opening.',
    theme: 2, startX: 0, startZ: 11, goalX: -1.4, goalWidth: 6.8, balls: 3,
    defenders: [defender(-1.8, -6.8), defender(.5, -6.8), keeper(-1.4, 1.8, 2)],
    obstacles: [obstacle('wall', 0, .8, 2.4, 1.2, 1.5, { moving: true, amplitude: 2.4, speed: .7, phase: .5 }), obstacle('cone', 4.2, -4.4, 1, 1, 1.2)]
  },
  {
    name: 'Forest chicane', tip: 'Keep clear of both log piles before turning toward the net.',
    theme: 1, startX: -2.8, startZ: 11, goalX: 1.7, goalWidth: 7, balls: 3,
    defenders: [defender(1.8, -8.8, { moving: true, amplitude: 1.7, speed: 1.05, phase: .5 })],
    obstacles: [obstacle('log', -1, 3.1, 2, 2.8, 1.2), obstacle('log', 2.2, -3.1, 2, 2.7, 1.25), obstacle('cone', -4.8, -5.7, 1, 1, 1.1)]
  },
  {
    name: 'Moving wall', tip: 'Four defenders shift together. Aim outside their moving edge.',
    theme: 0, startX: 1.5, startZ: 11.5, goalX: -1.2, goalWidth: 6.6, balls: 3,
    defenders: [-1.65, -.55, .55, 1.65].map(x => defender(x, -1.6, { moving: true, amplitude: 1, speed: .82, phase: 1.2 })),
    obstacles: [obstacle('cone', -4.7, -6.2, 1.1, 1.1, 1.15), obstacle('cone', 3.8, -7, 1.1, 1.1, 1.15)]
  },
  {
    name: 'Split barricades', tip: 'Pick a side early; the long blocks punish a late turn.',
    theme: 2, startX: 0, startZ: 11, goalX: .8, goalWidth: 6.8, balls: 3,
    defenders: [defender(.8, -8.4, { moving: true, amplitude: 2.2, speed: .9, phase: 1.7 })],
    obstacles: [obstacle('wall', -1.5, 1.2, 1, 3.1, 1.6), obstacle('wall', 1.5, 1.2, 1, 3.1, 1.6), obstacle('wall', -.9, -4.3, 1, 2.6, 1.6), obstacle('wall', 2.1, -4.3, 1, 2.6, 1.6)]
  },
  {
    name: 'Keeper’s forest', tip: 'A wide shot clears the logs. The final opening is all timing.',
    theme: 1, startX: 2.6, startZ: 11.5, goalX: -1.5, goalWidth: 6.4, balls: 3,
    defenders: [defender(-2.5, -4.2), defender(-1.3, -4.2), keeper(-1.5, 1.8, .8)],
    obstacles: [obstacle('log', .4, 2.1, 3.5, 2.1, 1.25), obstacle('log', 3.8, -4.5, 1.4, 2.6, 1.2)]
  },
  {
    name: 'Narrow escape', tip: 'The small goal rewards accuracy. Leave room for your curve.',
    theme: 0, startX: -3, startZ: 12, goalX: 1.8, goalWidth: 5.8, balls: 3,
    defenders: [defender(-.6, 2), defender(.5, 2), defender(1.6, 2), defender(1.8, -6.6, { moving: true, amplitude: 2.8, speed: 1.2, phase: 2.1 }), keeper(1.8, 1.6, .3)],
    obstacles: []
  },
  {
    name: 'City switchback', tip: 'The tall construction screen stops a chip. Curl around its outside.',
    theme: 2, startX: 2.8, startZ: 10.5, goalX: -2, goalWidth: 6.2, balls: 3,
    defenders: [defender(-.7, -8.1, { moving: true, amplitude: 2.6, speed: 1, phase: .8 })],
    obstacles: [obstacle('wall', 1.4, 3, 2.1, 1.4, 3.15), obstacle('wall', -1, -2.6, 2.4, 1.3, 1.7), obstacle('cone', 3.5, -6.8, 1.2, 1.2, 1.3)]
  },
  {
    name: 'Timber gate', tip: 'Slip through the opening, then avoid the patrolling guard.',
    theme: 1, startX: -1.8, startZ: 11.5, goalX: 1.4, goalWidth: 6.2, balls: 3,
    defenders: [defender(1.2, -7.6, { moving: true, amplitude: 2.7, speed: 1.15, phase: 1.7 }), keeper(1.4, 1.6, 2.2)],
    obstacles: [obstacle('log', -3.6, .4, 2.5, 3.5, 1.35), obstacle('log', 2.8, .4, 2.5, 3.5, 1.35), obstacle('cone', -.2, 5.3, 1, 1, 1.1)]
  },
  {
    name: 'Two-way traffic', tip: 'Two crossing runners create a brief window. Watch them both.',
    theme: 0, startX: 0, startZ: 12, goalX: -.8, goalWidth: 6, balls: 3,
    defenders: [defender(-1.2, -5.7), defender(0, -5.7), defender(1.2, -5.7), defender(0, 3.2, { moving: true, amplitude: 3.2, speed: 1.12, phase: 0 }), defender(0, -.5, { moving: true, amplitude: 2.8, speed: .92, phase: 2.4 }), keeper(-.8, 1.8, .5)],
    obstacles: []
  },
  {
    name: 'Barricade slalom', tip: 'Look for a clean sweeping line past three offset barriers.',
    theme: 2, startX: -2.6, startZ: 11.5, goalX: 1.5, goalWidth: 6.4, balls: 3,
    defenders: [keeper(1.5, 1.8, 1.2)],
    obstacles: [obstacle('wall', -.7, 4, 2, 1.1, 1.6), obstacle('wall', 1.3, -.5, 2, 1.1, 1.6), obstacle('wall', -.5, -5.8, 2, 1.1, 1.6), obstacle('cone', -4.5, -1, 1, 1, 1.2)]
  },
  {
    name: 'Deep forest', tip: 'A narrow goal waits beyond the logs and a shifting defensive pair.',
    theme: 1, startX: 2.5, startZ: 12, goalX: -1.8, goalWidth: 5.8, balls: 3,
    defenders: [defender(-1.5, -7.4, { moving: true, amplitude: 1.5, speed: 1.1, phase: .8 }), defender(-.3, -7.4, { moving: true, amplitude: 1.5, speed: 1.1, phase: .8 }), keeper(-1.8, 1.5, 2.5)],
    obstacles: [obstacle('log', .3, 2.2, 3.2, 2.2, 1.4), obstacle('log', 3.9, -3.8, 1.8, 3.3, 1.3), obstacle('cone', -4.9, -3.5, 1.1, 1.1, 1.2)]
  },
  {
    name: 'Final crossing', tip: 'The moving barrier and keeper must both leave your line open.',
    theme: 2, startX: -2, startZ: 12, goalX: 1.3, goalWidth: 5.8, balls: 3,
    defenders: [defender(.2, -5.6), defender(1.3, -5.6), defender(2.4, -5.6), keeper(1.3, 1.6, 1.7)],
    obstacles: [obstacle('wall', -.8, 2.2, 2.2, 1.1, 1.6, { moving: true, amplitude: 2.2, speed: .92, phase: .4 }), obstacle('cone', 4.8, -2.3, 1, 1, 1.3)]
  },
  {
    name: 'High street wall', tip: 'The high screen needs an outside curve. Pick your finish before kicking.',
    theme: 2, startX: -2, startZ: 10, goalX: 1.4, goalWidth: 6, balls: 3,
    defenders: [defender(1.3, -6.9, { moving: true, amplitude: 1.8, speed: 1.1, phase: 1.3 }), keeper(1.4, 1.65, 2.1)],
    obstacles: [obstacle('wall', -.5, 1, 2.7, 1.2, 3.3), obstacle('cone', 4.4, -4.2, 1, 1, 1.2)]
  },
  {
    name: 'Chip and dip', tip: 'Lift over the near logs, then let the ball drop before the keeper.',
    theme: 1, startX: 2.2, startZ: 8.5, goalX: -1.5, goalWidth: 6.2, balls: 3,
    defenders: [defender(-2.8, -5.7), defender(.2, -6.2), keeper(-1.5, 1.9, .8)],
    obstacles: [obstacle('log', 1.5, 4.4, 2.5, 1.4, .95), obstacle('log', -.5, -2.8, 2.2, 2.5, 1.5)]
  },
  {
    name: 'Three-line press', tip: 'Three defensive lines demand a deliberate route. Power changes your timing.',
    theme: 0, startX: -1.8, startZ: 12, goalX: 1, goalWidth: 5.8, balls: 3,
    defenders: [defender(-1.6, 3.4), defender(-.4, 3.4), defender(.4, -2.7, { moving: true, amplitude: 1.6, speed: 1.05, phase: .4 }), defender(1.5, -2.7, { moving: true, amplitude: 1.6, speed: 1.05, phase: .4 }), defender(1, -7.7, { moving: true, amplitude: 2.5, speed: 1.2, phase: 2.1 }), keeper(1, 1.6, 1.4)],
    obstacles: []
  },
  {
    name: 'Last street opening', tip: 'The late screen closes a lofted center shot. Find its side and beat the keeper.',
    theme: 2, startX: 2.8, startZ: 11, goalX: -1.5, goalWidth: 5.8, balls: 3,
    defenders: [defender(-2.7, -6.5), keeper(-1.5, 1.75, 2.3)],
    obstacles: [obstacle('wall', 1.4, 4.8, 2, 1.1, 1.8), obstacle('wall', -.6, -7.8, 1.3, .9, 3.35), obstacle('cone', -4.4, -3, 1.1, 1.1, 1.2)]
  },
  {
    name: 'Club champion', tip: 'Bend past the first wall, thread the second, and beat the keeper.',
    theme: 0, startX: 0, startZ: 12, goalX: 0, goalWidth: 5.6, balls: 3,
    defenders: [defender(-1.65, 1.2), defender(-.55, 1.2), defender(.55, 1.2), defender(1.65, 1.2), defender(-1, -5.7, { moving: true, amplitude: 1, speed: .85, phase: 1.2 }), defender(.2, -5.7, { moving: true, amplitude: 1, speed: .85, phase: 1.2 }), keeper(0, 1.55, .4)],
    obstacles: [obstacle('cone', -4.8, -4.2, 1, 1, 1.2), obstacle('cone', 4.8, -4.2, 1, 1, 1.2)]
  }
];

const styleHints=['curl','drive','chip','chip','curl','drive','chip','curl','chip','curl','drive','chip','curl','curl','drive','curl','chip','chip','curl','curl','chip','drive','curl','curl'];
for(let i=0;i<LEVELS.length;i++){
  const level=LEVELS[i],style=styleHints[i]||'curl';
  level.recommendedStyle=style;
  level.goalHeight=3.05;
  // Beyond the opening wall drill every goal is defended. Lofting over the
  // approach obstacles still requires a finish to the keeper's open side.
  if(i>0&&!level.defenders.some(item=>item.keeper))level.defenders.push(keeper(level.goalX,1.6+(i%3)*.15,1.5+(i%3)*.15));
  // Corner finish targets offer an optional skill bonus. All goals still count.
  level.bonus={x:level.goalX+(i%2?-1:1)*level.goalWidth*.29,y:style==='drive'?.65:style==='chip'?2.2:1.72,radius:i<6?.56:.47};
}

export function getLevel(index, { practice = false, difficulty = 'challenge' } = {}) {
  practice=practice||difficulty==='practice';
  const number = Math.max(0, Math.trunc(Number(index) || 0));
  const level = JSON.parse(JSON.stringify(LEVELS[number % LEVELS.length]));
  const cycle = Math.floor(number / LEVELS.length);
  // Later tours modestly tighten the same readable puzzles; caps preserve room to score.
  const pro=difficulty==='pro'&&!practice;
  const speedMultiplier = practice ? .62 : (pro?1.18:1)*(1+Math.min(cycle,4)*.07);
  if (!practice) level.goalWidth = Math.max(5.1,level.goalWidth-(pro?.35:0)-Math.min(cycle,4)*.10);
  level.bonus.x=level.goalX+(level.bonus.x<level.goalX?-1:1)*level.goalWidth*.29;
  if(pro)level.bonus.radius*=.84;
  level.difficulty=practice?'practice':pro?'pro':'challenge';
  for (const item of [...level.defenders, ...level.obstacles]) {
    if (item.moving) item.speed *= speedMultiplier;
    if (practice && 'radius' in item) item.radius = Math.max(.40, item.radius - .10);
  }
  return level;
}
