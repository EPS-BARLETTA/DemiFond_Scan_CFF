(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TAGS = ['Allure régulière','Départ trop rapide','Bonne gestion de l’effort','Objectif atteint','Estimation à améliorer','Engagement positif','Passages irréguliers','Progrès constatés'];
  function open(student, onClose, locked=false) {
    if (!student) return;
    let d=document.getElementById('dfStudentFollowup');
    if (!d) {d=document.createElement('dialog');d.id='dfStudentFollowup';document.body.appendChild(d);}
    const previous=student.pedagogicalFollowup || {};
    const selected=new Set(Array.isArray(previous.tags)?previous.tags:[]);
    const title=[student.last||student.lastName||'',student.first||student.firstName||''].join(' ').trim()||student.name||'Élève';
    d.innerHTML='<form method="dialog" class="df-followup-form"><div class="df-followup-head"><div><small>SUIVI PÉDAGOGIQUE</small><h2>'+esc(title)+'</h2></div><button type="button" data-close aria-label="Fermer">✕</button></div>'+
      '<div class="df-followup-body"><h3>Observations rapides</h3><div class="df-followup-tags">'+TAGS.map((tag,i)=>'<label><input type="checkbox" data-tag="'+i+'" '+(selected.has(tag)?'checked':'')+' '+(locked?'disabled':'')+'><span>'+esc(tag)+'</span></label>').join('')+'</div>'+
      '<label class="df-followup-label">Commentaire pédagogique<textarea id="dfFollowupComment" rows="4" maxlength="1500" '+(locked?'readonly':'')+' placeholder="Observation, conseil ou point de vigilance...">'+esc(previous.comment||'')+'</textarea></label>'+
      '<label class="df-followup-label">Objectif pour la prochaine séance<input id="dfFollowupGoal" maxlength="250" '+(locked?'readonly':'')+' value="'+esc(previous.goal||'')+'" placeholder="Ex. stabiliser les passages aux 250 m"></label></div>'+
      '<div class="df-followup-actions"><button type="button" data-close>Fermer</button>'+(locked?'':'<button type="button" id="dfFollowupSave">Enregistrer les annotations</button>')+'</div></form>';
    d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{d.close();onClose?.();});
    d.addEventListener('cancel',()=>onClose?.(),{once:true});
    d.querySelector('#dfFollowupSave')?.addEventListener('click',()=>{
      student.pedagogicalFollowup={
        tags:TAGS.filter((tag,i)=>d.querySelector('[data-tag="'+i+'"]').checked),
        comment:d.querySelector('#dfFollowupComment').value.trim(),
        goal:d.querySelector('#dfFollowupGoal').value.trim(),
        updatedAt:Date.now()
      };
      if(typeof save==='function')save();
      d.close();onClose?.();
      if(typeof toast==='function')toast('Suivi pédagogique enregistré.');
    });
    d.showModal();
  }
  window.DFStudentFollowup={open};
})();
