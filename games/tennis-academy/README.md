# GoLingo Tennis Academy — Language Drills

A browser tennis training game with a fixed rear-court camera. One athlete faces
a far-baseline mechanical ball feeder. Serve, forehand, backhand, drop shot,
and lob drills introduce foreign-language vocabulary.

The athlete retains the realistic action artwork, with body-centered pose
alignment, separate preparation/contact/follow-through frames, and subtly
animated footwork during lateral shuffles. One pose is rendered at a time so
the racket stays in the athlete's hand without ghosting across the neck.
Serve balls begin by the non-racket hand, travel above the head on a timed
toss, and meet the contact pose before flying across the net. The opposite end
contains only a ball machine. The court backdrop is a perspective image.

## Play

Open index.html with any static web server. No build step is required. Select a
shot with the top-left menu, move with the joystick or WASD, aim on the far
court, hold HIT to build power, and release to strike. A quick tap charges
automatically.

## GoLingo data

Supports GoLingo primaryLanguage, learningLanguage and words JSON fields.
Example: {"primaryLanguage":"en","learningLanguage":"ja","words":[{"id":"101","word":"水","translation":"water","sentence":"水を飲みます。","sentenceTranslation":"I drink water."}]}

The built-in lesson is used when none is passed from the game hub. Browser
speech synthesis provides pronunciation and example sentences.

Files: index.html, game.js, kinematic-player.js (ball machine drawing),
tennis-court.jpg, athlete-actions.png, athlete-special.png,
three.module.js, cover.svg.
