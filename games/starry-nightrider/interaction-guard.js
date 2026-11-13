// Keep long presses and steering drags from selecting game labels on iOS.
// Deliberately leave pointer, touch, click and keyboard events untouched.
const installed=new WeakMap();

export function installGameInteractionGuards(root){
  if(!root?.addEventListener)return()=>{};
  if(installed.has(root))return installed.get(root);
  function preserveNativeEditing(target){
    const element=target?.nodeType===1?target:target?.parentElement;
    return !!(element?.isContentEditable||element?.closest?.('input,textarea,select'));
  }
  function preventGameSelection(event){
    if(!preserveNativeEditing(event.target))event.preventDefault();
  }
  const types=['selectstart','contextmenu','dragstart'];
  for(const type of types)root.addEventListener(type,preventGameSelection,{capture:true});
  const dispose=()=>{
    for(const type of types)root.removeEventListener(type,preventGameSelection,{capture:true});
    installed.delete(root);
  };
  installed.set(root,dispose);
  return dispose;
}
