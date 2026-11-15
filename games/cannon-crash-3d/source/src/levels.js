// Each layout is handcrafted. Target coordinates are relative to the shelf they
// occupy: shelf 0 is the main deck, shelves 1+ are the elevated mini-decks.
// The moving chevron bumpers travel across a deck's front edge. `shots` is a
// par target for optional star ratings only: actual cannon ammo is unlimited.
export const THEMES = [
  { id:'desert', name:'DUSTY FRONTIER', sky:'#e99a72', accent:'#ffda74', platform:'#885c44' },
  { id:'neon', name:'NEON AFTERDARK', sky:'#171a50', accent:'#43fae9', platform:'#354169' },
  { id:'ice', name:'FROZEN KINGDOM', sky:'#7ac7e7', accent:'#e4ffff', platform:'#5aa5c4' }
];

const row=(type,xs,z,tier=0)=>xs.map(x=>({type,x,z,tier}));
const stack=(type,x,z,n)=>Array.from({length:n},(_,tier)=>({type,x,z,tier}));
const onShelf=(shelf,items)=>items.map(item=>({...item,shelf}));
const elevated=(x,y,z,width,depth=1.65)=>({x,y,z,width,depth});
const bumper=(shelf,z,range=1.5,speed=1.35,phase=0)=>({shelf,z,range,speed,phase});

export const LEVELS = [
  {name:'First Strike',theme:0,shots:6,targets:[
    ...row('barrel',[-1.8,-.9,0,.9,1.8],-.25),
  ]},
  {name:'Tin Can Alley',theme:0,shots:6,
    shelves:[elevated(0,4.15,-8.4,5.4)],targets:[
    ...row('can',[-2.5,-1.5,-.5,.5,1.5,2.5],.1),
    ...onShelf(1,row('can',[-1.5,-.5,.5,1.5],0)),
  ]},
  {name:'Crate Collapse',theme:0,shots:6,
    shelves:[elevated(0,4.3,-8.45,5.25)],targets:[
    ...row('crate',[-1.6,-.8,0,.8,1.6],0),
    ...onShelf(1,row('crate',[-1.35,-.45,.45,1.35],0)),
    ...stack('crate',0,0,3).slice(1),
  ]},
  {name:'Canyon Crossfire',theme:0,shots:6,
    shelves:[elevated(0,4.4,-8.5,5.55)],
    hazards:[bumper(0,1.82,1.9,1.3)],targets:[
    ...row('barrel',[-3,-2.1,2.1,3],-.6),
    ...row('crate',[-2.7,-1.8,0,1.8,2.7],.65),
    ...onShelf(1,row('can',[-1.65,-.55,.55,1.65],0)),
  ]},
  {name:'The Last Outpost',theme:0,shots:5,
    shelves:[elevated(0,4.65,-8.65,5.75)],
    hazards:[bumper(0,1.92,2.1,1.5),bumper(1,.47,1.25,1.05,2)],targets:[
    ...row('barrel',[-2.7,-1.8,-.9,0,.9,1.8,2.7],.75),
    ...row('crate',[-2.2,-1.1,0,1.1,2.2],-.35),
    ...onShelf(1,row('can',[-1.8,-.6,.6,1.8],-.18)),
  ]},
  {name:'Electric Avenue',theme:1,shots:6,
    shelves:[elevated(0,4.2,-8.4,5.65)],
    hazards:[bumper(0,1.82,2,1.25)],targets:[
    ...row('neon',[-2.7,-1.8,-.9,0,.9,1.8,2.7],-.35),
    ...onShelf(1,row('neon',[-1.8,-.9,0,.9,1.8],0)),
  ]},
  {name:'Twin Towers',theme:1,shots:6,
    shelves:[elevated(-1.45,4.45,-8.4,3.45),elevated(1.45,5.4,-9.95,3.45)],
    hazards:[bumper(0,1.92,1.9,1.45)],targets:[
    ...stack('neon',-2.3,-.55,3),...stack('neon',-1.45,-.55,3),
    ...onShelf(1,row('neon',[-.87,0,.87],0)),
    ...onShelf(2,row('neon',[-.87,0,.87],0)),
    ...row('neon',[-.55,.55],.7),
  ]},
  {name:'Neon Overload',theme:1,shots:5,
    shelves:[elevated(-1.65,4.35,-8.4,3.6),elevated(1.6,5.35,-9.85,3.6)],
    hazards:[bumper(0,1.92,2.2,1.65,.5),bumper(1,.45,.75,1.3,1.8)],targets:[
    ...row('neon',[-2.7,-1.8,-.9,0,.9,1.8,2.7],.85),
    ...row('neon',[-2.5,-1.5,-.5,.5,1.5,2.5],-.25),
    ...onShelf(1,row('neon',[-.9,0,.9],0)),
    ...onShelf(2,row('neon',[-.9,0,.9],0)),
  ]},
  {name:'Icebreaker',theme:2,shots:6,
    shelves:[elevated(0,4.45,-8.4,5.75)],
    hazards:[bumper(0,1.9,2,1.5)],targets:[
    ...row('ice',[-2.6,-1.7,-.8,.1,1,1.9,2.8],.75),
    ...onShelf(1,row('ice',[-2.2,-1.3,-.4,.5,1.4,2.3],0)),
    ...stack('ice',0,-.45,2),
  ]},
  {name:'The Frozen Fortress',theme:2,shots:6,
    shelves:[elevated(-1.55,4.55,-8.5,3.65),elevated(1.6,5.5,-9.95,3.6)],
    hazards:[bumper(0,1.85,2.1,1.6),bumper(1,.48,.75,1.2,1.7)],targets:[
    ...stack('ice',-2.6,-1.05,3),...stack('ice',2.6,-1.05,3),
    ...row('ice',[-1.65,-.85,0,.85,1.65],-1.05),
    ...row('ice',[-2.6,-1.7,-.8,0,.8,1.7,2.6],.65),
    ...onShelf(1,row('ice',[-.9,0,.9],0)),
    ...onShelf(2,row('ice',[-.9,0,.9],0)),
  ]},
];

export const TOTAL_LEVELS=LEVELS.length;
