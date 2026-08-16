(()=>{
  const card=document.getElementById('hostCenterCard');
  const info=document.getElementById('hostGameInfo');
  if(!card||!info)return;
  let releaseTimer=null;
  let actionActive=false;
  const hide=()=>{clearTimeout(releaseTimer);actionActive=true;card.style.opacity='0';card.style.pointerEvents='none';card.style.visibility='hidden'};
  const showLater=()=>{clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{actionActive=false;card.style.opacity='1';card.style.pointerEvents='';card.style.visibility='visible'},2000)};
  const inspect=()=>{
    const text=(info.textContent||'').trim();
    const moving=/Avanza\s+\d+\s+casillas/i.test(text);
    if(moving){hide();return}
    if(actionActive)showLater();
  };
  new MutationObserver(inspect).observe(info,{subtree:true,childList:true,characterData:true,attributes:true});
  inspect();
})();