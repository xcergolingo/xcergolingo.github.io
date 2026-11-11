// The GoLingo WKWebView can stay portrait even when the game requests landscape.
// In that case CSS rotates the entire game shell clockwise. Pointer events and
// WebGL scissor rectangles still arrive in unrotated screen coordinates, so
// convert them back to the landscape coordinate system used by the game.
export function isVirtualLandscape(win = window) {
  return win.matchMedia('(orientation: portrait)').matches;
}

export function gameSize(shell) {
  return {width: Math.max(1, shell.clientWidth), height: Math.max(1, shell.clientHeight)};
}

export function pointerInElement(event, element, rotated) {
  const rect = element.getBoundingClientRect();
  return rotated
    ? {x: event.clientY - rect.top, y: rect.right - event.clientX, width: rect.height, height: rect.width}
    : {x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height};
}

export function rectInGame(element, shell, rotated) {
  const rect = element.getBoundingClientRect();
  const outer = shell.getBoundingClientRect();
  return rotated
    ? {x: rect.top - outer.top, y: outer.right - rect.right, width: rect.height, height: rect.width}
    : {x: rect.left - outer.left, y: rect.top - outer.top, width: rect.width, height: rect.height};
}
