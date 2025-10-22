"use strict";

/* ----------------------------- Helpers & état ----------------------------- */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const num = v => Number((v ?? 0).toString().replace(',', '.'));
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

const KEY = "oa360_progress";
const state = JSON.parse(localStorage.getItem(KEY) || '{"score":0,"done":0,"streak":0}');
const save  = () => localStorage.setItem(KEY, JSON.stringify(state));
const renderKPIs = () => {
  const ratio = state.done ? Math.round(state.score*100/state.done) : 0;
  $("#kpi-score") && ($("#kpi-score").textContent = ratio + "%");
  $("#kpi-done")  && ($("#kpi-done").textContent  = state.done);
  $("#kpi-streak")&& ($("#kpi-streak").textContent= state.streak);
};

/* ------------------------------ Navigation SPA --------------------------- */
function show(view){
  $$(".view").forEach(v => v.classList.remove("show"));
  $("#view-"+view).classList.add("show");
  $$("#nav button").forEach(b=> b.classList.toggle("active", b.dataset.view === view));
  history.replaceState(null,"","#"+view);
  renderKPIs();
}
function initNav(){
  $$("#nav button, .go").forEach(b => b.addEventListener("click", e => {
    const v = e.currentTarget.dataset.view;
    if(v) show(v);
  }));
  const hash = location.hash.replace("#","");
  if(hash && $("#view-"+hash)) show(hash);
  else show("home");
}

/* ------------------------------ Module TU -------------------------------- */
function decideTU(){
  const t = $$("input[name='tu-type']").find(x=>x.checked)?.value;
  const contrat = $("#tu-contrat").value; // standard | FV16BOA | S21SUP100
  const ech = $("#tu-ech").checked;
  const unit= $("#tu-unit").checked;
  const ceil= $("#tu-ceil").checked;
  const wrong=$("#tu-wrong").checked;
  const gedko=$("#tu-gedko").checked;
  const out = $("#tu-out");

  if(!t) return out.className="warn", out.innerHTML="Choisis AF ou E.";
  if(gedko && t==="E") {
    out.className="info";
    out.innerHTML = "ℹ️ Facture <b>E</b> : <b>FTN/GED KO</b> → <b>corriger la facture FTN</b> "
                  + "et ajouter le commentaire « <i>erreur de saisie Majorel</i> ».";
    return;
  }
  if(!ech) return out.className="bad",  out.innerHTML="❌ Échéancier KO → ticket <b>Redmine ASSET SU</b>.";

  if(unit)  return out.className="ok",   out.innerHTML = (t==="AF")
       ? "✅ Inversion d’unités (même valeur) → <b>corriger l’unité</b> dans l’AF. (Seule tolérance)"
       : "✅ Inversion d’unités (même valeur) → échéancier OK → <b>BAP</b>.";

  if(ceil)  {
    const cap = (contrat==="FV16BOA") ? "0,000 c€/kWh"
              : (contrat==="S21SUP100") ? "4,000 c€/kWh"
              : "plafond du contrat";
    out.className = (t==="AF" ? "ok" : "bad");
    out.innerHTML = (t==="AF")
      ? `✅ Au-dessus du plafond (<b>${cap}</b>) → <b>appliquer le plafond</b> dans l’AF.`
      : `❌ Au-dessus du plafond côté producteur (<b>${cap}</b>) → <b>BAR facture E</b>.`;
    return;
  }

  if(wrong) return out.className="bad", out.innerHTML = (t==="AF")
       ? "❌ Tarif unitaire faux côté AF → <b>corriger l’AF</b> (aucune tolérance)."
       : "❌ Tarif unitaire faux côté producteur → <b>BAR</b>.";

  out.className="ok";
  out.innerHTML = "✅ Rien d’anormal détecté côté tarif unitaire.<br>"
                + "<span class='k'>Rappel : <b>Tarif échéancier = Rémunération × coef&nbsp;L</b> (utiliser la calculatrice L si besoin).</span>";
}
function resetTU(){
  $$("input[name='tu-type']").forEach(x=>x.checked=false);
  $("#tu-contrat").value="standard";
  $("#tu-ech").checked = true;
  ["tu-unit","tu-ceil","tu-wrong","tu-gedko"].forEach(id => $("#"+id).checked=false);
  $("#tu-out").className="warn"; $("#tu-out").innerHTML="👉 Coche/choisis puis « Décider ».";
}

/* --------------------------- Module Montant total ------------------------- */
function decideMT(){
  const t = $$("input[name='mt-type']").find(x=>x.checked)?.value;
  const f = num($("#mt-futu").value), c = num($("#mt-compta").value);
  const cause = $("#mt-cause").checked;
  const out = $("#mt-out");

  if(!t) return out.className="warn", out.innerHTML="Choisis AF ou E.";
  if(f===c) return out.className="ok", out.innerHTML="✅ Montants identiques → <b>OK</b>.";

  if(t==="AF"){
    const d = Math.abs(c-f).toFixed(2);
    out.className="bad"; out.innerHTML = `❌ Écart de ${d} € sur AF → <b>corriger le 2ᵉ montant total</b> (même si &lt; 1 €).`;
    return;
  }
  const delta = Math.abs(c-f);
  if(delta<=1){
    out.className = cause ? "bad" : "ok";
    out.innerHTML = cause
      ? "❌ Facture E : écart ≤ 1 € mais <b>causé par un tarif unitaire faux</b> → <b>BAR</b>."
      : "✅ Facture E : écart ≤ 1 € lié à <b>Q×TU/arrondis</b> → <b>BAP</b>.";
  }else{
    out.className="bad"; out.innerHTML="❌ Facture E : écart &gt; 1 € → <b>BAR</b> (demander facture corrigée).";
  }
}
function rese
