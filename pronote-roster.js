(() => {
"use strict";
const norm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g," ").replace(/[^a-zA-Z0-9 -]/g," ").replace(/\s+/g," ").trim().toLowerCase();
const name = s => [s.last||s.lastName||s.nom||"",s.first||s.firstName||s.prenom||""].join(" ").trim() || s.name || "";
const esc = v => String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function parse(text) {
  text=String(text).replace(/^\uFEFF/,"");
  const first=text.split(/\r?\n/,1)[0];
  const sep=(first.match(/;/g)||[]).length >= (first.match(/,/g)||[]).length ? ";" : ",";
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===sep&&!quoted){row.push(cell);cell="";}
    else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell="";}
    else cell+=c;
  }
  if(quoted)throw Error("Guillemets non fermés dans le CSV.");
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
function convert(text) {
 const rows=parse(text);if(rows.length<2)throw Error("Fichier vide ou sans élèves.");
 const h=rows.shift().map(norm), col=(...names)=>h.findIndex(x=>names.includes(x));
 const combined=col("eleves","eleve","nom prenom","nom et prenom");
 const last=col("nom","nom de famille"),first=col("prenom","prenoms");
 const sex=col("sexe","genre"),classCol=col("classe","division");
 if((combined<0&&(last<0||first<0))||classCol<0)throw Error("Colonnes Élèves (ou Nom et Prénom) et Classe introuvables.");
 const students=[],seen=new Set();
 for(const r of rows){let l="",f="";
  if(combined>=0){const v=(r[combined]||"").trim();const parts=v.split(/\s+/);if(parts.length<2)continue;
   const firstLower=parts.findIndex(p=>/[a-zà-ÿ]/.test(p)&&p!==p.toUpperCase());
   const cut=firstLower>0?firstLower:1;l=parts.slice(0,cut).join(" ");f=parts.slice(cut).join(" ");
  }else{l=(r[last]||"").trim();f=(r[first]||"").trim();}
  const classroom=(r[classCol]||"").trim();if(!l||!f)continue;
  const k=norm(l+" "+f);if(seen.has(k))continue;seen.add(k);
  const sx=norm(sex>=0?r[sex]:"");
  students.push({last:l,first:f,sex:sx.startsWith("f")?"F":sx.startsWith("m")?"M":"",classroom});
 }
 if(!students.length)throw Error("Aucun élève valide détecté.");
 return students;
}
function compare(roster, scanned) {
 const keys=new Map(),duplicates=[];
 for(const s of scanned){const k=norm(name(s));if(!k)continue;if(keys.has(k))duplicates.push(name(s));keys.set(k,s);}
 const missing=roster.filter(s=>!keys.has(norm(name(s))));
 const extra=scanned.filter(s=>!roster.some(r=>norm(name(r))===norm(name(s))));
 return {missing,extra,duplicates,found:roster.length-missing.length};
}
function dialog(title,inner) {
 let d=document.getElementById("dfRosterDialog");if(!d){d=document.createElement("dialog");d.id="dfRosterDialog";document.body.appendChild(d);}
 d.style.cssText="width:min(94vw,640px);max-height:85vh;overflow:auto;border:1px solid #cbd5e1;border-radius:16px;padding:20px";
 d.innerHTML='<h2>'+esc(title)+'</h2>'+inner+'<p><button type="button" id="dfRosterClose">Fermer</button></p>';
 d.querySelector("#dfRosterClose").onclick=()=>d.close();d.showModal();return d;
}
function open(group,refresh) {
 if(!group)return;
 const d=dialog("Liste PRONOTE · "+group.name,
 '<p>Option facultative. Seuls nom, prénom, sexe et classe sont conservés sur cet iPad.</p>'+
 '<p>Liste actuelle : <strong>'+((group.rosterPronote||[]).length)+' élèves</strong></p>'+
 '<label>Importer un CSV PRONOTE <input id="dfRosterFile" type="file" accept=".csv,text/csv,text/plain"></label>'+
 '<div id="dfRosterPreview" style="margin:12px 0"></div>'+
 '<button type="button" id="dfRosterConfirm" disabled>Valider l’import</button> '+
 '<button type="button" id="dfRosterClear" '+(!(group.rosterPronote||[]).length?'disabled':'')+'>Retirer la liste facultative</button>');
 let pending=null;
 d.querySelector("#dfRosterFile").onchange=async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
   let text=await f.text();if(text.includes("\uFFFD")){const bytes=await f.arrayBuffer();text=new TextDecoder("windows-1252").decode(bytes);}
   pending=convert(text);
   d.querySelector("#dfRosterPreview").innerHTML='<strong>'+pending.length+' élèves détectés</strong><p>Classes : '+esc([...new Set(pending.map(s=>s.classroom))].join(", "))+'</p><p>Exemples : '+esc(pending.slice(0,4).map(name).join(" · "))+'</p><p>La liste précédente sera remplacée uniquement après confirmation.</p>';
   d.querySelector("#dfRosterConfirm").disabled=false;
  }catch(err){pending=null;d.querySelector("#dfRosterConfirm").disabled=true;d.querySelector("#dfRosterPreview").textContent=err.message;}
 };
 d.querySelector("#dfRosterConfirm").onclick=()=>{
  if(!pending)return;
  group.rosterPronote=pending.map(s=>({...s}));save();d.close();refresh();
 };
 d.querySelector("#dfRosterClear").onclick=()=>{
  if(!confirm("Retirer uniquement la liste PRONOTE de cette classe ? Les résultats scannés restent intacts."))return;
  delete group.rosterPronote;save();d.close();refresh();
 };
}
window.DFRoster={open,compare,name,convert};
})();