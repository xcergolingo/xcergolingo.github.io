// Shared perspective framing for both native WebGL and Canvas compatibility mode.
// The camera stays close behind the shooter, leaving room for the compact HUD.
export function configureCamera(camera, width, height, { startX = 0, startZ = 8, goalX = 0 } = {}) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  camera.aspect = aspect;
  const run = startX - goalX;
  const fieldDistance = Math.max(12, startZ + 11.8);
  if (aspect < 1.05) {
    camera.fov = aspect < .48 ? 53 : 50;
    camera.position.set(startX + run * 11 / fieldDistance, 10.5, startZ + 11);
    camera.lookAt(startX - run * 8 / fieldDistance, .2, startZ - 8);
  } else {
    camera.fov = 50;
    camera.position.set(startX + run * 11 / fieldDistance, 10.5, startZ + 11);
    camera.lookAt(startX - run * 5.5 / fieldDistance, .2, startZ - 5.5);
  }
  camera.near = .1;
  camera.far = 160;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}
