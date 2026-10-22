(() => {
  "use strict";
  const keyFor = el => {
    const card=el.closest('.card');
    return card?.id || el.id || (card?.querySelector('h2')?.textContent||'resultats').trim();
  };
  const states=new Map();
  function install() {
    const containers=document.querySelectorAll('#results .table, #trainingResultsCard .training-table-wrap');
    containers.forEach((table,index)=>{
      if(table.dataset.epsCollapsible==='yes')return;
      const card=table.closest('.card');
      if(!card || card.id==='sessionResultsOverview')return;
      const key=keyFor(table)+':'+index;
      const isOpen=states.has(key)?states.get(key):false;
      const button=document.createElement('button');
      button.type='button';
      button.className='eps-table-toggle';
      button.setAttribute('aria-expanded',String(isOpen));
      button.innerHTML='<span class="eps-table-toggle-icon">▸</span><span class="eps-table-toggle-title">Tableau détaillé des résultats</span><span class="eps-table-toggle-hint">'+(isOpen?'Masquer':'Afficher')+'</span>';
      table.parentNode.insertBefore(button,table);
      table.dataset.epsCollapsible='yes';
      table.hidden=!isOpen;
      button.addEventListener('click',()=>{
        const next=table.hidden;
        table.hidden=!next;
        button.setAttribute('aria-expanded',String(next));
        button.querySelector('.eps-table-toggle-hint').textContent=next?'Masquer':'Afficher';
        states.set(key,next);
      });
    });
  }
  let pending=false;
  const observer=new MutationObserver(()=>{
    if(pending)return;
    pending=true;
    requestAnimationFrame(()=>{pending=false;install();});
  });
  function start(){
    install();
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
