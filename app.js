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
function resetMT(){
  $$("input[name='mt-type']").forEach(x=>x.checked=false);
  $("#mt-futu").value="2031.60"; $("#mt-compta").value="2031.60"; $("#mt-cause").checked=false;
  $("#mt-out").className="warn"; $("#mt-out").innerHTML="👉 Renseigne les montants puis « Décider ».";
}

/* -------------------------------- Module TVA ------------------------------ */
function decideTVA(){
  const ttcPaper = $("#tva-ttc").checked;
  const m = $("#tva-mention").value;
  const ftnTTC = $("#tva-ftn-ttc").checked;
  const out = $("#tva-out");

  if(ttcPaper) return out.className="bad", out.innerHTML="❌ Facture papier en <b>TTC</b> → <b>BAR</b>.";
  if(m!=="autoliquidation") return out.className="bad", out.innerHTML="❌ PRO sans la mention « autoliquidation » → <b>BAR</b>.";
  if(ftnTTC) return out.className="info", out.innerHTML="ℹ️ FTN affiche <b>TTC</b> mais c’est bien un <b>montant HT</b> (simple erreur d’affichage).";
  out.className="ok"; out.innerHTML="✅ Papier HT + mention « autoliquidation » → <b>OK</b>.";
}
function resetTVA(){
  $("#tva-ttc").checked=false; $("#tva-mention").value="autoliquidation"; $("#tva-ftn-ttc").checked=false;
  $("#tva-out").className="warn"; $("#tva-out").innerHTML="👉 Coche/choisis puis « Décider ».";
}

/* -------------------------------- Exercices ------------------------------- */
/* Banque embarquée → fonctionne offline et en prod */
const EXOS = [
  {q:"E. Échéancier OK. TU déclaré 12,900 c€/kWh ; attendu 13,906 c€/kWh (pas une histoire d’unités).", ok:"BAR",
   why:"Le tarif unitaire déclaré ne correspond pas à l’échéancier.", rule:"E + TU faux = BAR", action:"Renvoie la facture au producteur (BAR)."},
  {q:"AF. 0,13906 € au lieu de 13,906 c€/kWh (même valeur).", ok:"Corriger AF (unité)",
   why:"Seule tolérance : inversion des unités €↔c€ à valeur identique.", rule:"Inversion d’unités = OK", action:"Corrige l’unité côté AF, pas le prix."},
  {q:"E. FUTUNOA 2031,60 € ; compta 2032,20 € ; cause = arrondis.", ok:"BAP",
   why:"Écart ≤ 1 € expliqué par Q×TU/arrondis.", rule:"E ±1 € (arrondis) = BAP", action:"Valide le paiement (BAP)."},
  {q:"AF. FUTUNOA 2031,60 € ; compta 2032,20 €.", ok:"Corriger total",
   why:"AF : pas de tolérance opérationnelle.", rule:"AF = corriger 2ᵉ montant", action:"Corrige le 2ᵉ montant total."},
  {q:"Facture papier : TTC.", ok:"BAR",
   why:"Autoliquidation depuis 01/04/2012 : pas de TVA facturée.", rule:"Papier TTC = BAR", action:"Demande facture corrigée HT (BAR)."},
  {q:"PRO : mention « 293 B » au lieu d’« autoliquidation ».", ok:"BAR",
   why:"Pour un PRO, la mention obligatoire est « autoliquidation ». ", rule:"PRO sans autoliquidation = BAR", action:"Demande correction (BAR)."},
  {q:"AF. TU au-dessus du plafond pour S21SUP100.", ok:"Corriger AF (plafond)",
   why:"Plafond S21SUP100 = 4,000 c€/kWh.", rule:"Plafond → appliquer", action:"Corrige la valeur avec le plafond."},
  {q:"E. Contrat FV16BOA, TU non nul.", ok:"BAR",
   why:"Plafond FV16BOA = 0,000 c€/kWh ; tout dépassement = erreur côté producteur.", rule:"E + plafond dépassé = BAR", action:"Renvoie la facture (BAR)."},
  {q:"E. FTN/GED KO à la réception.", ok:"Corriger FTN",
   why:"Flux GED KO → corriger FTN.", rule:"GED KO = corriger FTN", action:"Corriger FTN et ajouter le commentaire « erreur de saisie Majorel »."},
  {q:"FTN affiche TTC mais c’est bien HT.", ok:"BAP",
   why:"Erreur d’affichage FTN, pas de TVA appliquée.", rule:"Affichage FTN TTC = HT", action:"Poursuivre, pas de BAR."}
];

function sample8(){ return shuffle([...EXOS]).slice(0,8); }

function renderExos(){
  const list = $("#exos-list");
  list.innerHTML = "";
  sample8().forEach((o,idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="k">🧩 Cas ${idx+1}</div>
      <div style="margin:8px 0">${o.q}</div>
      <div class="row">
        <button class="btn ghost">BAP</button>
        <button class="btn ghost">BAR</button>
        <button class="btn ghost">Corriger AF (unité)</button>
        <button class="btn ghost">Corriger AF (plafond)</button>
        <button class="btn ghost">Corriger FTN</button>
        <button class="btn ghost">Corriger total</button>
      </div>
      <div class="explain"></div>
    `;
    card.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      const ans = b.textContent.trim();
      const ok = ans === o.ok;
      state.done++; if(ok) state.score++; save(); renderKPIs();
      const box = card.querySelector(".explain");
      box.innerHTML = `
        <div class="${ok?'ok':'bad'}">
          <b>${ok?'Bonne réponse':'Mauvaise réponse'}</b><br>
          Décision attendue : <b>${o.ok}</b>
          <div class="rule">Règle : ${o.rule}</div>
          <p class="k">Pourquoi : ${o.why}</p>
          <p><b>Action :</b> ${o.action}</p>
        </div>`;
    }));
    list.appendChild(card);
  });
}

/* --------------------------------- Init ----------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  renderKPIs();

  // TU
  $("#tu-decide").addEventListener("click", decideTU);
  $("#tu-reset").addEventListener("click", resetTU);

  // Montant
  $("#mt-decide").addEventListener("click", decideMT);
  $("#mt-reset").addEventListener("click", resetMT);

  // TVA
  $("#tva-decide").addEventListener("click", decideTVA);
  $("#tva-reset").addEventListener("click", resetTVA);

  // Exercices
  $("#exos-reload").addEventListener("click", renderExos);
  $("#exos-reset").addEventListener("click", () => { localStorage.removeItem(KEY); location.reload(); });
  renderExos();
});
