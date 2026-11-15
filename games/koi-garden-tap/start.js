import {createLesson} from './words.js?v=3';
const probe=document.createElement('canvas');
const gl=probe.getContext('webgl2')||probe.getContext('webgl');
if(gl){gl.getExtension('WEBGL_lose_context')?.loseContext();import('./main.js?v=3').catch(startFallback);}
else startFallback();
function startFallback(){
  const $=id=>document.getElementById(id);
  const host=$('experience');host.classList.add('flat-pond');$('pond').hidden=true;
  const school=document.createElement('div');school.className='flat-school';school.setAttribute('aria-label','Swimming koi');host.prepend(school);
  const lesson=createLesson(populate);
  const colors=['#eb623e','#303932','#f5be58','#f6e6d2'];
  function populate(){
    school.replaceChildren();
    const pending=lesson.nextWords(),words=pending.length?pending:lesson.words();
    words.slice(0,8).forEach((word,i)=>{
      const f=document.createElement('button');f.className='flat-koi';f.setAttribute('aria-label','Koi '+(i+1));
      f.style.setProperty('--swim',`${8+i%4}s`);f.style.setProperty('--delay',`-${i*.67}s`);
      f.style.left=`${21+(i%3)*28+Math.random()*3}%`;f.style.top=`${30+Math.floor(i/3)*16+Math.random()*3}%`;
      f.innerHTML=`<svg viewBox="0 0 100 54" aria-hidden="true"><path fill="#f5e3ca" opacity=".72" d="M37 19Q45 1 59 4L52 23M37 35Q45 53 59 50L52 31M74 25Q87 16 98 14L91 27L98 40Q86 38 74 30"/><path fill="#fff1d5" d="M10 27C10 12 41 9 62 18L84 26L84 29L62 36C39 45 10 43 10 27Z"/><path fill="${colors[i%4]}" d="M16 18Q27 11 35 17Q41 21 31 31Q29 39 23 38Q13 35 16 18M47 15Q62 17 70 23Q70 30 58 35L46 39Q37 30 47 15Z"/><circle cx="19" cy="21" r="2" fill="#253b31"/><circle cx="19" cy="33" r="2" fill="#253b31"/></svg>`;
      f.onclick=()=>{if(!lesson.isActive())return;lesson.show({lessonWord:word});if(lesson.nextWords().length && !lesson.nextWords().some(w=>w.id===word.id)){const left=lesson.nextWords();const shown=new Set([...school.children].map(el=>el.dataset.word));const next=left.find(w=>!shown.has(w.id));if(next){f.dataset.word=next.id;f.onclick=()=>{lesson.show({lessonWord:next});populate();};}}if(!lesson.nextWords().length)updateHint();};
      f.dataset.word=word.id;school.append(f);
    });
    $('fishCount').textContent=school.children.length;updateHint();
  }
  function updateHint(){$('hint').textContent=lesson.isActive()?(lesson.nextWords().length?'✦ Tap a koi to hear its word':'✦ All words found · Open Basket to hunt again'):'✦ A quiet moment by the pond';}
  $('modeBtn').addEventListener('click',updateHint);
  $('hideBtn').onclick=()=>{host.classList.add('interface-hidden');lesson.stop();};
  $('showBtn').onclick=()=>host.classList.remove('interface-hidden');
  // Scene controls that need WebGL are omitted in this view.
  for(const id of ['soundBtn','calmBtn','clearBtn','rainBtn','vortexBtn','fishPanel'])$(id).style.display='none';
  populate();
}
