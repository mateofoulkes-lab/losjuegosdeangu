(()=>{
  const card=document.getElementById('hostCenterCard');
  if(!card)return;
  let releaseTimer=null;
  let cinematic=false;
  const hide=()=>{
    clearTimeout(releaseTimer);
    cinematic=true;
    card.style.opacity='0';
    card.style.pointerEvents='none';
    card.style.visibility='hidden';
  };
  const showLater=()=>{
    clearTimeout(releaseTimer);
    releaseTimer=setTimeout(()=>{
      cinematic=false;
      card.style.opacity='1';
      card.style.pointerEvents='';
      card.style.visibility='visible';
    },1200);
  };
  const inspect=()=>{
    if(card.classList.contains('hidden')){hide();return}
    if(cinematic)showLater();
    else{
      card.style.opacity='1';
      card.style.pointerEvents='';
      card.style.visibility='visible';
    }
  };
  new MutationObserver(inspect).observe(card,{attributes:true,attributeFilter:['class']});
  inspect();
})();