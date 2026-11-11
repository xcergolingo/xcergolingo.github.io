import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isVirtualLandscape, gameSize, pointerInElement, rectInGame} from './layout.js';

const element = rect => ({getBoundingClientRect: () => rect});
const physicalPortrait = {left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844};
const shell = {...element(physicalPortrait), clientWidth: 844, clientHeight: 390};
assert.equal(isVirtualLandscape({matchMedia: () => ({matches: true})}), true);
assert.equal(isVirtualLandscape({matchMedia: () => ({matches: false})}), false);
assert.deepEqual(gameSize(shell), {width: 844, height: 390});

// A 60-by-200 throttle at landscape x:40-100, y:160-360 appears in
// portrait screen coordinates at x:30-230, y:40-100 after rotation.
const throttle = element({left: 30, top: 40, right: 230, bottom: 100, width: 200, height: 60});
assert.deepEqual(pointerInElement({clientX: 190, clientY: 70}, throttle, true),
  {x: 30, y: 40, width: 60, height: 200});
assert.deepEqual(pointerInElement({clientX: 50, clientY: 200},
  element({left: 20, top: 170, right: 80, bottom: 370, width: 60, height: 200}), false),
  {x: 30, y: 30, width: 60, height: 200});

// Joystick left/right moves along portrait screen up/down, while pitch moves
// along portrait screen right/left. Neither axis should be swapped or inverted.
const stick = element({left: 210, top: 100, right: 340, bottom: 230, width: 130, height: 130});
assert.deepEqual(pointerInElement({clientX: 310, clientY: 130}, stick, true),
  {x: 30, y: 30, width: 130, height: 130});
assert.deepEqual(pointerInElement({clientX: 340, clientY: 230}, stick, true),
  {x: 130, y: 0, width: 130, height: 130});

// Onboard camera inset is a rectangle in the unrotated WebGL canvas. Its
// origin is top-left for CSS, bottom-left for WebGL scissor coordinates.
const inset = element({left: 245, top: 680, right: 325, bottom: 810, width: 80, height: 130});
assert.deepEqual(rectInGame(inset, shell, true), {x: 680, y: 65, width: 130, height: 80});
assert.equal(gameSize(shell).height - rectInGame(inset, shell, true).y - 80, 245);
assert.deepEqual(rectInGame(element({left: 680, top: 65, right: 810, bottom: 145, width: 130, height: 80}),
  {...element({left: 0, top: 0}), clientWidth: 844, clientHeight: 390}, false),
  {x: 680, y: 65, width: 130, height: 80});

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
assert.match(css, /#game-shell\{position:fixed;inset:0;/);
assert.match(css, /#game-shell\{inset:auto;left:100vw;top:0;width:100dvh;height:100dvw;transform:rotate\(90deg\)/);
assert.doesNotMatch(css, /body\.flying #rotatePrompt\{display:flex/);

console.log('Virtual landscape layout and pointer coordinate checks passed.');
