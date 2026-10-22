
const HUB_MODE=window.HUB_MODE||"single",BASE="/portfolio/",PAGE=window.HUB_PAGE||null;
const D=window.HUB_DATA||null;
const LOGO_MARK="assets/logo-mark.png";
const AS_OF="12 Oct 2026";
const P=D.P, SECTORS=D.S, IND7=D.IND7||[];
const byId=Object.fromEntries(P.map(p=>[p.id,p]));
const secBy=Object.fromEntries(SECTORS.map(s=>[s.slug,s]));
const asset=s=>String(s).startsWith("data:")?s:BASE+s;
function U(r,q){
  if(HUB_MODE!=="site")return "#"+r+(q?"?"+q:"");
  let f;
  if(r==="home")f="/";
  else if(r.startsWith("sector-"))f="/sectors/"+r.slice(7)+"/";
  else if(r.startsWith("project-")){const p=byId[+r.slice(8)];f="/projects/"+(p?p.slug:"missing")+"/";}
  else f="/"+r+"/";
  return "/portfolio"+f+(q?"#"+q:"");
}
const AI_ORDER=["GenAI / LLM","Other AI / ML","Traditional"];
const AI_VAR={"GenAI / LLM":"--ai-genai","Other AI / ML":"--ai-ml","Traditional":"--ai-trad"};
const ST_ORDER=["Live / Production","MVP / V1","In active development","Ongoing engagement","Not disclosed","Pre-build"];
const ST_VAR={"Live / Production":"--st-live","MVP / V1":"--st-mvp","In active development":"--st-dev","Ongoing engagement":"--st-ongoing","Not disclosed":"--st-undis","Pre-build":"--st-pre"};
const CAT_ORDER=["AI & LLM","Cloud & DevOps","Frontend & Mobile","Backend","Data & Messaging","Integrations"];
const NOT7="Not in the 7 target industries";
const cnt=(a,k,v)=>a.filter(x=>x[k]===v).length;
const UC_ORDER=[...new Set(P.map(p=>p.useCase))].sort((a,b)=>cnt(P,"useCase",b)-cnt(P,"useCase",a)||a.localeCompare(b));
const S={safe:false,route:"home",Q:{},dd:null,more:false,pitchAll:false,help:false,heat:null,techq:"",pitch:{sector:"",uc:"",ai:"",roi:false,q:""},picked:[],cmp:[29,32,27]};
try{S.safe=localStorage.getItem("cc-hub-safe")==="1";}catch(e){}

/* ---------- helpers ---------- */
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const hid=p=>S.safe&&p.conf==="Confidential";
const hideName=p=>S.safe&&(p.conf==="Confidential"||!p.cc);
const cap=s=>String(s||"").charAt(0).toUpperCase()+String(s||"").slice(1);
const extLabel=p=>`${cap(p.actualIndustry)} · ${p.useCase}`;
function mk(p,s){if(!hideName(p)||!s)return s;let t=String(s);for(const m of p.mask){t=t.split(m).join("the client");}return t.replace(/^the client/,"The client");}
const T=(p,s)=>esc(mk(p,s));
const pname=p=>!hideName(p)?p.full:(p.cc?mk(p,p.desc).replace(/\s*\(the client\)/g,""):`${extLabel(p)} (external project)`);
const pshort=p=>!hideName(p)?p.short:(p.cc?"Confidential client":extLabel(p));
const pclient=p=>!hideName(p)?p.client:(p.cc?"Confidential client":"External client (name hidden)");
const ptitle=p=>!hideName(p)?p.short:(p.cc?mk(p,p.desc).replace(/\s*\(the client\)/g,""):extLabel(p));
const psub=p=>!hideName(p)?p.desc.replace(/\s*\(Non CC Project \/ External\)\s*/,""):(p.cc?"":"External project");
const imgs=p=>hideName(p)?[]:p.images.map(g=>({...g,src:asset(g.src)}));
const plural=(n,w)=>`${n} ${n===1?w:(/[^aeiou]y$/.test(w)?w.slice(0,-1)+"ies":/(s|x|ch|sh)$/.test(w)?w+"es":w+"s")}`;
let COPY=[];
function cpb(text,label){const i=COPY.push(text)-1;return `<button class="copy" type="button" data-act="copy" data-i="${i}">${label||"Copy"}</button>`;}
const stRank=p=>ST_ORDER.indexOf(p.status);
const dot=v=>`<i class="dot" style="background:var(${v})"></i>`;
const sq=v=>`<i class="sq" style="background:var(${v})"></i>`;
const aiTag=p=>`<span class="tag">${sq(AI_VAR[p.ai])}${esc(p.ai)}</span>`;
const stTag=p=>`<span class="tag">${dot(ST_VAR[p.status])}${esc(p.status)}</span>`;
const confTag=p=>p.conf==="Confidential"?`<span class="tag t-red">Confidential</span>`:`<span class="tag">Public</span>`;
const roiTag=p=>p.roi?`<span class="tag t-accent">Measured ROI</span>`:"";
const ccPill=p=>p.cc?"":`<span class="tag t-amber">Non-CC · External</span>`;
const flags=p=>`${p.roi?'<span class="tag t-accent">Measured ROI</span>':""}${p.conf==="Confidential"?'<span class="tag t-red">Confidential</span>':""}${p.cc?"":'<span class="tag t-amber">External</span>'}`;
const chev=`<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICO_S=`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="M13.5 13.5 17 17"/></svg>`;
const aiTxt=p=>p.aiExt?mk(p,[p.aiExt.useCase,...p.aiExt.caps].join(" ")):"";
const provLine=p=>p.status==="Pre-build"?"Scoped by CodingCops (pre-build)":p.cc?"Delivered by CodingCops":"External build (non-CC project, kept for reference)";
const ICO_EXT=`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h4v4M13 3 7.5 8.5M12 9.5V13H3V4h3.5"/></svg>`;
const protoBtn=(p,cls="")=>{if(!p.proto)return "";if(hideName(p))return `<span class="proto off ${cls}" title="Link hidden in client-safe mode">Prototype available</span>`;return `<a class="proto ${cls}" href="${esc(p.proto)}" target="_blank" rel="noopener noreferrer" aria-label="Open the ${esc(ptitle(p))} prototype in a new tab">Prototype available ${ICO_EXT}</a>`;};
const plink=p=>`<a href="${U("project-"+p.id)}">${esc(pshort(p))}</a>${p.cc?"":' <span class="muted">(external)</span>'}`;

function stackBar(list,{legend=true,h=8}={}){
  const n=list.length||1;
  const segs=AI_ORDER.map(k=>[k,cnt(list,"ai",k)]).filter(x=>x[1]);
  const bar=`<div class="stack" style="height:${h}px" role="img" aria-label="AI mix: ${segs.map(([k,v])=>`${k} ${v}`).join(", ")}">${segs.map(([k,v])=>`<span data-tip="${esc(k)}: ${v} of ${list.length} (${Math.round(v/n*100)}%)" style="flex:${v};background:var(${AI_VAR[k]})"></span>`).join("")}</div>`;
  const lg=legend?`<div class="legend" style="margin-top:10px">${AI_ORDER.map(k=>`<span>${sq(AI_VAR[k])}${k} <b>${cnt(list,"ai",k)}</b></span>`).join("")}</div>`:"";
  return bar+lg;
}
function barList(rows,{act="",color="--accent"}={}){
  const max=Math.max(1,...rows.map(r=>r.v));
  return `<div class="bars">${rows.map(r=>{
    const tag=act?"button":"div";
    const attrs=act?`type="button" data-act="${act}" data-k="${esc(r.k)}"${r.sel?' aria-pressed="true"':''}`:"";
    return `<${tag} class="barrow${r.sel?" sel":""}" ${attrs} data-tip="${esc(r.label||r.k)}: ${plural(r.v,"project")}"><span class="bl">${r.dot?dot(r.dot):""}${esc(r.label||r.k)}</span><span class="bv">${r.v}</span><span class="bt"><i style="width:${r.v/max*100}%;background:var(${r.color||color})"></i></span></${tag}>`;}).join("")}</div>`;
}
function aiKey(){return AI_ORDER.map(k=>`<span class="meta">${sq(AI_VAR[k])}${k}</span>`).join("");}
function pcard(p,o={}){
  const im=imgs(p)[0],sub=psub(p),tech=p.techs.slice(0,4).map(t=>t.n);
  return `<article class="pcard">${im?`<div class="pthumb"><img src="${im.src}" alt="${esc(im.cap)}" loading="lazy"></div>`:""}
  <div class="pc-b"><div class="pc-k"><span>${o.noSector?"":esc(p.sectorName)+" · "}${esc(p.useCase)}</span></div><h3><a href="${U("project-"+p.id)}">${esc(ptitle(p))}</a></h3>${sub?`<p class="pc-s">${esc(sub)}</p>`:""}
  <p class="pc-m">${hid(p)?'<span class="muted">Result hidden in client-safe mode</span>':T(p,p.top)}</p>
  ${tech.length?`<div class="pc-t">${tech.map(t=>`<span>${esc(t)}</span>`).join('<span aria-hidden="true">·</span>')}${p.techs.length>4?`<span class="muted">+${p.techs.length-4}</span>`:""}</div>`:""}
  <div class="pc-f"><span class="meta">${dot(ST_VAR[p.status])}${esc(p.status)}</span><span class="meta">${sq(AI_VAR[p.ai])}${esc(p.ai)}</span>${flags(p)}${protoBtn(p,"sm")}<a class="pc-go" href="${U("project-"+p.id)}" tabindex="-1" aria-hidden="true">View project →</a></div></div></article>`;
}
function bestProof(L){return [...L].sort((a,b)=>(b.cc-a.cc)||(b.roi-a.roi)||(stRank(a)-stRank(b))||(AI_ORDER.indexOf(a.ai)-AI_ORDER.indexOf(b.ai)))[0];}
function crumbs(items){return `<nav class="crumbs" aria-label="Breadcrumb">${items.map((it,i)=>i<items.length-1?`<a href="${it[1]}">${esc(it[0])}</a><span aria-hidden="true">/</span>`:`<span aria-current="page">${esc(it[0])}</span>`).join("")}</nav>`;}
function techCounts(L){const m={};L.forEach(p=>p.techs.forEach(t=>{m[t.n]=(m[t.n]||0)+1;}));return Object.entries(m).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));}
function sortList(L,s){
  s=s||S.Q.sort||"status";const a=[...L];
  if(s==="name")a.sort((x,y)=>ptitle(x).localeCompare(ptitle(y)));
  else if(s==="ai")a.sort((x,y)=>AI_ORDER.indexOf(x.ai)-AI_ORDER.indexOf(y.ai)||stRank(x)-stRank(y));
  else if(s==="roi")a.sort((x,y)=>(y.roi-x.roi)||(y.cc-x.cc)||stRank(x)-stRank(y));
  else if(s==="recent")a.sort((x,y)=>y.id-x.id);
  else a.sort((x,y)=>stRank(x)-stRank(y)||(y.cc-x.cc)||(y.roi-x.roi));
  return a;
}
function listView(L,o={}){
  if(!L.length)return `<div class="empty"><b>No projects match these filters.</b><br>Remove a filter, clear the search, or use Clear all above. Tip: the global search (Ctrl K) also searches project stories.</div>`;
  if((S.Q.view||"cards")==="table")return `<div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Project</th><th scope="col">Sector</th><th scope="col">Use case</th><th scope="col">AI type</th><th scope="col">Status</th><th scope="col">Top result</th></tr></thead><tbody>${L.map(p=>`<tr><td><a href="${U("project-"+p.id)}" style="font-weight:600;text-decoration:none">${esc(ptitle(p))}</a><div class="sm">${esc(pclient(p))}</div><div class="tags" style="margin-top:6px">${flags(p)}${protoBtn(p,"sm")}</div></td><td>${esc(p.sectorName)}<div class="sm">${esc(p.sub)}</div></td><td>${esc(p.useCase)}</td><td><span class="meta">${sq(AI_VAR[p.ai])}${esc(p.ai)}</span></td><td><span class="meta">${dot(ST_VAR[p.status])}${esc(p.status)}</span></td><td>${hid(p)?'<span class="muted">Hidden</span>':T(p,p.top)}</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="pgrid">${L.map(p=>pcard(p,o)).join("")}</div>`;
}

/* ---------- query state + filters ---------- */
function cur(){
  if(HUB_MODE==="site"){const h=location.hash.slice(1);return {r:PAGE||"home",q:h.includes("=")?h:""};}
  const h=(location.hash||"#home").slice(1),i=h.indexOf("?");
  return {r:(i<0?h:h.slice(0,i))||"home",q:i<0?"":h.slice(i+1)};
}
function parseQ(q){const o={};(q||"").split("&").filter(Boolean).forEach(kv=>{const i=kv.indexOf("=");if(i<0)return;try{o[decodeURIComponent(kv.slice(0,i).replace(/\+/g," "))]=decodeURIComponent(kv.slice(i+1).replace(/\+/g," "));}catch(e){}});return o;}
function serQ(o){return Object.entries(o).filter(([k,v])=>v!==""&&v!=null).map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(v).replace(/%7C/gi,"|").replace(/%2F/gi,"/").replace(/%20/g,"+")).join("&");}
function syncURL(){const q=serQ(S.Q);const url=HUB_MODE==="site"?(location.pathname+location.search+(q?"#"+q:"")):("#"+S.route+(q?"?"+q:""));try{history.replaceState(null,"",url);}catch(e){}}
const getArr=k=>S.Q[k]?S.Q[k].split("|").filter(Boolean):[];
const setArr=(k,a)=>{S.Q[k]=a.join("|");};
const DIMS={
  s:{label:"Industry",get:p=>[p.sector],name:v=>secBy[v]?secBy[v].name:v,order:()=>SECTORS.map(s=>s.slug)},
  ind:{label:"Target industry",get:p=>[p.ind7||NOT7],order:()=>[...IND7,NOT7]},
  sub:{label:"Sub-industry",get:p=>[p.sub]},
  uc:{label:"Use case",get:p=>[p.useCase]},
  ai:{label:"AI type",get:p=>[p.ai],order:()=>AI_ORDER},
  st:{label:"Status",get:p=>[p.status],order:()=>ST_ORDER},
  src:{label:"Delivered by",get:p=>[p.cc?"CodingCops":"External (non-CC)"],order:()=>["CodingCops","External (non-CC)"]},
  conf:{label:"Visibility",get:p=>[p.conf],order:()=>["Public","Confidential"]},
  tech:{label:"Technology",get:p=>p.techs.map(t=>t.n)}
};
const TOGS={roi:{label:"Measured ROI only",test:p=>p.roi},vis:{label:"Has visuals",test:p=>p.visuals},proto:{label:"Has prototype",test:p=>!!p.proto}};
const SORTS=[["status","Delivery status"],["roi","Measured ROI first"],["recent","Recently added"],["ai","AI type"],["name","Name"]];
const hay=p=>[pname(p),pclient(p),p.sub,p.useCase,p.sectorName,p.ai,p.status,p.tags.join(" "),p.techs.map(t=>t.n).join(" "),mk(p,p.oneLiner),mk(p,p.problem),mk(p,p.solution),aiTxt(p)].join(" ").toLowerCase();
function applyF(L,dims,skip){
  const q=(S.Q.q||"").trim().toLowerCase();
  return L.filter(p=>{
    for(const k of dims){if(k===skip)continue;const sel=getArr(k);if(sel.length&&!DIMS[k].get(p).some(v=>sel.includes(v)))return false;}
    for(const k in TOGS)if(S.Q[k]==="1"&&!TOGS[k].test(p))return false;
    if(q&&!hay(p).includes(q))return false;return true;});
}
function facet(k,L,dims){
  const base=applyF(L,dims,k),m={},all=new Set();
  base.forEach(p=>DIMS[k].get(p).forEach(v=>m[v]=(m[v]||0)+1));
  L.forEach(p=>DIMS[k].get(p).forEach(v=>all.add(v)));
  const ord=DIMS[k].order?DIMS[k].order():null;
  return [...all].sort((a,b)=>ord?(ord.indexOf(a)-ord.indexOf(b)):((m[b]||0)-(m[a]||0)||a.localeCompare(b))).map(v=>({v,n:m[v]||0}));
}
function ddHtml(k,L,dims){
  const sel=getArr(k),open=S.dd===k;
  return `<div class="dd"><button type="button" class="ddb${sel.length?" on":""}" data-act="dd" data-k="${k}" aria-expanded="${open}" aria-haspopup="listbox">${esc(DIMS[k].label)}${sel.length?`<span class="ddn">${sel.length}</span>`:""}${chev}</button>${open?`<div class="ddm" role="listbox" aria-label="${esc(DIMS[k].label)}" aria-multiselectable="true">${facet(k,L,dims).map(({v,n})=>{const on=sel.includes(v);return `<button type="button" class="opt" role="option" data-act="fopt" data-k="${k}" data-v="${esc(v)}" aria-pressed="${on}" aria-selected="${on}"${!n&&!on?" disabled":""}><span class="cb"></span><span class="ol">${esc(DIMS[k].name?DIMS[k].name(v):v)}</span><span class="on">${n}</span></button>`;}).join("")}${sel.length?`<div class="ddfoot"><button type="button" class="linkbtn" data-act="fclr" data-k="${k}">Clear ${esc(DIMS[k].label.toLowerCase())}</button></div>`:""}</div>`:""}</div>`;
}
function fbar(dims,L,o={}){
  const core=o.core||dims,more=dims.filter(k=>!core.includes(k)),togs=o.toggles||[];
  const tg=togs.map(k=>`<button type="button" class="ftog" data-act="ftog" data-k="${k}" aria-pressed="${S.Q[k]==="1"}">${TOGS[k].label}</button>`).join("");
  const hasMore=more.length>0;
  const moreN=more.reduce((n,k)=>n+getArr(k).length,0)+togs.filter(k=>S.Q[k]==="1").length;
  const moreOpen=hasMore&&(S.more||moreN>0);
  const right=o.list?`<div class="fright"><select id="fsort" class="inp" aria-label="Sort projects">${SORTS.map(([v,l])=>`<option value="${v}"${(S.Q.sort||"status")===v?" selected":""}>Sort: ${l}</option>`).join("")}</select><div class="seg" role="group" aria-label="View"><button type="button" data-act="fview" data-k="cards" aria-pressed="${(S.Q.view||"cards")==="cards"}">Grid</button><button type="button" data-act="fview" data-k="table" aria-pressed="${S.Q.view==="table"}">List</button></div></div>`:"";
  return `<div class="fbar" role="search"><div class="frow"><div class="fs">${ICO_S}<input id="fq" class="inp" type="search" placeholder="${esc(o.ph||"Search these projects")}" value="${esc(S.Q.q||"")}" aria-label="Search within results"></div>${right}</div>
  <div class="frow">${core.map(k=>ddHtml(k,L,dims)).join("")}${hasMore?`<button type="button" class="ddb${moreOpen?" on":""}" data-act="more" aria-expanded="${moreOpen}" aria-controls="fmore">More filters${moreN?`<span class="ddn">${moreN}</span>`:""}${chev}</button>`:tg}</div>
  ${moreOpen?`<div class="fmore" id="fmore"><span class="fl">More filters</span>${more.map(k=>ddHtml(k,L,dims)).join("")}${tg}</div>`:""}</div>`;
}
function fhead(n,dims,noun){
  const chips=[];
  dims.forEach(k=>getArr(k).forEach(v=>chips.push(`<span class="fchip">${esc(DIMS[k].label)}: ${esc(DIMS[k].name?DIMS[k].name(v):v)}<button type="button" data-act="fx" data-k="${k}" data-v="${esc(v)}" aria-label="Remove filter ${esc(DIMS[k].label)}: ${esc(v)}">×</button></span>`)));
  Object.keys(TOGS).forEach(k=>{if(S.Q[k]==="1")chips.push(`<span class="fchip">${TOGS[k].label}<button type="button" data-act="fx" data-k="${k}" aria-label="Remove filter ${TOGS[k].label}">×</button></span>`);});
  if(S.Q.q)chips.push(`<span class="fchip">“${esc(S.Q.q)}”<button type="button" data-act="fx" data-k="q" aria-label="Clear search">×</button></span>`);
  return `<div class="fhead"><span class="count">${plural(n,noun||"project")}</span>${chips.join("")}${chips.length?`<button type="button" class="linkbtn" data-act="fall">Clear all</button><button type="button" class="linkbtn" data-act="share" style="margin-left:auto">Copy link to this view</button>`:""}</div>`;
}
let RES=null;
function resBlock(fn){RES=fn;return `<div id="fres">${fn()}</div>`;}

/* ---------- home ---------- */
const SEC_ICO={
healthcare:'<path d="M10 3v14M3 10h14"/><circle cx="10" cy="10" r="7.5"/>',
finance:'<ellipse cx="10" cy="5.5" rx="6" ry="2.5"/><path d="M4 5.5v9c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-9M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5"/>',
"built-environment":'<path d="M3 17h14M5 17V7l5-3 5 3v10M8 17v-4h4v4M8 9h1M11 9h1M8 12h1M11 12h1"/>',
"enterprise-it":'<path d="M10 2.5 16 5v5c0 4-2.6 6.6-6 7.5-3.4-.9-6-3.5-6-7.5V5l6-2.5Z"/><path d="M7.5 10l1.8 1.8L12.8 8"/>',
"business-ops":'<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><path d="M11 14h6M14 11v6"/>',
automotive:'<path d="M3.5 12l1.6-4.2A2 2 0 0 1 7 6.5h6a2 2 0 0 1 1.9 1.3L16.5 12M3 12h14v3.5H3z"/><circle cx="6" cy="15.5" r="1.5"/><circle cx="14" cy="15.5" r="1.5"/>',
"travel-consumer":'<path d="M3 15.5l3-1 4.5-4.5 5.5 2 1-1-4.5-3.5 1.5-4-1-1-3 3.5L5 4.5l-1 1 4 2.5L5 11.5l-2 .5z"/>',
"media-marketing":'<path d="M3 11.5V8.5l9-4v11l-9-4Z"/><path d="M12 7.5a3 3 0 0 1 0 5M4.5 11.5v4"/>',
"education-public":'<path d="M2.5 8 10 4.5 17.5 8 10 11.5 2.5 8Z"/><path d="M5.5 9.5v4c0 1.2 2 2.5 4.5 2.5s4.5-1.3 4.5-2.5v-4M17.5 8v4"/>',
manufacturing:'<path d="M3 17V9l4 2.5V9l4 2.5V9l4 2.5V17H3Z"/><path d="M14 9V4h2v5M3 17h14"/>'};
const SEC_HUE={healthcare:"var(--hx-em)",finance:"var(--hx-num)","built-environment":"var(--hx-co)","enterprise-it":"var(--hx-pr)","business-ops":"var(--hx-num)",automotive:"var(--hx-co)","travel-consumer":"var(--hx-em)","media-marketing":"var(--hx-co)","education-public":"var(--hx-pr)",manufacturing:"var(--hx-num)"};
const secIco=slug=>`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SEC_ICO[slug]||SEC_ICO["business-ops"]}</svg>`;
const bigNum=s=>{const m=String(s||"").match(/[~<>]?\d[\d,.]*(?:[%x+]|s\b|k\+)?/);return m?m[0]:null;};
function featuredPick(){
  return [...P].sort((a,b)=>(imgs(b).length>0)-(imgs(a).length>0)||(b.cc-a.cc)||(b.roi-a.roi)||((!hid(b))-(!hid(a)))||(stRank(a)-stRank(b))||(a.id-b.id)).slice(0,3);
}
function vHome(){
  const genai=cnt(P,"ai","GenAI / LLM"),live=cnt(P,"status","Live / Production"),roi=P.filter(p=>p.roi),ext=P.filter(p=>!p.cc).length,tc=techCounts(P),nt=tc.length;
  /* hero visualization: projects per sector, stacked by AI type */
  const secRows=SECTORS.map(s=>({s,L:P.filter(p=>p.sector===s.slug)})).sort((a,b)=>b.L.length-a.L.length);
  const mx=Math.max(...secRows.map(r=>r.L.length));
  const viz=`<div class="hx-viz" role="img" aria-label="Projects per sector, split by AI type">
    <div class="hx-vt"><span>Projects by sector</span><span class="hx-vl">${AI_ORDER.map(k=>`<span>${sq(AI_VAR[k])}${k.replace(" / LLM","")}</span>`).join("")}</span></div>
    ${secRows.map(({s,L})=>`<a class="hx-row" href="${U("sector-"+s.slug)}" data-tip="${esc(s.name)}: ${plural(L.length,"project")}"><span class="hx-rn">${esc(s.name.replace(/ &.*$/,"").replace(", Hospitality","").replace(", Government",""))}</span><span class="hx-rb">${AI_ORDER.map(k=>{const v=cnt(L,"ai",k);return v?`<i style="flex:${v};background:var(${AI_VAR[k]})"></i>`:"";}).join("")}<i class="hx-sp" style="flex:${mx-L.length}"></i></span><span class="hx-rv">${L.length}</span></a>`).join("")}
    <div class="hx-vf"><span><b>${genai}</b> GenAI / LLM</span><span><b>${live}</b> live</span><span><b>${roi.length}</b> measured ROI</span></div></div>`;
  const lgD=(document.querySelector(".logo-d")||{}).src||"";
  const hero=`<section class="hx-hero"><div class="hx-hl">${lgD?`<img class="hx-logo" src="${lgD}" alt="CodingCops">`:""}<div class="hx-eyebrow"><i></i>Portfolio hub · snapshot ${esc(AS_OF)}</div>
    <h1>Every project we've shipped, organised for the next pitch.</h1>
    <p class="hx-lede">${P.length} projects across ${SECTORS.length} industry sectors: ${UC_ORDER.length} solution types, ${nt} technologies, ${genai} GenAI / LLM builds and client-measured outcomes on ${roi.length}. ${ext} external reference builds are included and flagged wherever they appear.</p>
    <div class="hx-cta"><a class="btn hx-b1" href="${U("projects")}">Explore projects</a><a class="btn hx-b2" href="${U("pitch")}">Build a pitch</a><button type="button" class="hx-help" data-act="help" aria-expanded="${!!S.help}" aria-controls="hx-helpbox">How to use this hub</button></div>
    <div id="hx-helpbox" class="hx-helpbox"${S.help?"":" hidden"}><b>How to use this hub</b><p>Start with an industry, or filter all projects by use case, technology and status. Every project page carries the full case study, tech stack, campaign copy and evidence.</p><p>Turn on <b>Client-safe mode</b> (bottom of the sidebar) before screen-sharing: it hides confidential names, results and screenshots, and shows external projects by industry and use case only.</p><p>Press <kbd>Ctrl K</kbd> to search projects, clients, sectors and technologies from anywhere.</p></div></div>
    <div class="hx-hr">${viz}</div></section>`;
  /* metrics band */
  const kb=(v,l,href,s,cls="")=>`<a class="hx-k ${cls}" href="${href}"><span class="v">${v}</span><span class="l">${l}</span>${s?`<span class="s">${s}</span>`:""}</a>`;
  const kpis=`<div class="hx-kband">${kb(P.length,"Projects",U("projects"),`${P.length-ext} by CodingCops · ${ext} external`,"lead")}${kb(SECTORS.length,"Industry sectors",U("industries"))}${kb(genai,"GenAI / LLM projects",U("projects","ai=GenAI+/+LLM"),`${Math.round(genai/P.length*100)}% of the portfolio`)}${kb(live,"Live in production",U("projects","st=Live+/+Production"))}${kb(roi.length,"With measured ROI",U("projects","roi=1"),"client-measured outcomes")}</div>`;
  /* featured work */
  const feat=featuredPick().map((p,i)=>{const G=imgs(p),im=G[0],H=hid(p),tech=p.techs.slice(0,3).map(t=>t.n),hue=({"var(--hx-em)":"#00A85D","var(--hx-num)":"#004CF8","var(--hx-co)":"#EE6352","var(--hx-pr)":"#1A1660"})[SEC_HUE[p.sector]]||"#004CF8";
    const cover=im?`<img src="${im.src}" alt="${esc(im.cap)}" loading="${i?"lazy":"eager"}">`:`<div class="hx-cover" style="--hue:${hue}"><span class="hx-ci">${secIco(p.sector)}</span><span class="hx-cm">${H?"Result hidden in client-safe mode":T(p,p.top)}</span></div>`;
    return `<article class="hx-f${i===0?" lead":""}"><div class="hx-fi">${cover}${G.length>1?`<span class="hx-fn">${plural(G.length,"screen")}</span>`:""}</div>
    <div class="hx-fb"><div class="hx-fk">${secIco(p.sector)}<span>${esc(p.sectorName)}</span>${p.cc?"":'<span class="tag t-amber">External</span>'}${p.conf==="Confidential"?'<span class="tag t-red">Confidential</span>':""}</div>
    <h3><a href="${U("project-"+p.id)}">${esc(ptitle(p))}</a></h3><p class="hx-fd">${esc(psub(p)||mk(p,p.useCase))}</p>
    <div class="hx-ft">${tech.map(t=>`<span>${esc(t)}</span>`).join("")}</div>
    ${p.proto?`<div style="position:relative;z-index:1">${protoBtn(p,"sm")}</div>`:""}<div class="hx-fo"><span class="k">${p.roi?"Measured outcome":"Delivery result"}</span><b>${H?'<span class="muted">Hidden in client-safe mode</span>':T(p,p.top)}</b></div></div></article>`;}).join("");
  /* industry cards */
  const cards=SECTORS.map(s=>{
    const L=P.filter(p=>p.sector===s.slug),b=bestProof(L),pub=cnt(L,"conf","Public"),x=L.filter(p=>!p.cc).length,lv=cnt(L,"status","Live / Production"),g=cnt(L,"ai","GenAI / LLM"),r=L.filter(p=>p.roi).length;
    const dots=`<span class="sdots">${[...L].sort((a,c)=>stRank(a)-stRank(c)).map(p=>`<i class="sdot" style="background:var(${ST_VAR[p.status]})" data-tip="${esc(pshort(p))}: ${esc(p.status)}"></i>`).join("")}</span>`;
    return `<article class="scard" style="--hue:${SEC_HUE[s.slug]||"var(--hx-num)"}"><div class="top"><span class="sico">${secIco(s.slug)}</span><span class="n" aria-label="${plural(L.length,"project")}">${L.length}</span></div>
    <h3><a href="${U("sector-"+s.slug)}">${esc(s.name)}</a></h3><p class="d">${esc(s.desc)}</p>
    <div class="row"><span class="meta">${dot("--st-live")}${lv} live</span><span class="meta">${sq("--ai-genai")}${g} GenAI</span>${r?`<span class="meta">${r} ROI</span>`:""}${x?`<span class="meta">${x} external</span>`:""}</div>
    <div class="proof"><span class="k">Strongest proof</span><b>${esc(pshort(b))}</b>${hid(b)?`<span>Result hidden in client-safe mode</span>`:`<span>${T(b,b.top)}</span>`}</div>
    <details><summary>Delivery mix</summary><div>${stackBar(L,{legend:true,h:6})}<div class="meta">Status by project:</div>${dots}<span class="meta">${pub} public · ${L.length-pub} confidential</span></div></details></article>`;}).join("");
  /* technology capabilities */
  const catC={};P.forEach(p=>{const seen=new Set();p.techs.forEach(t=>{if(!seen.has(t.c)){seen.add(t.c);catC[t.c]=(catC[t.c]||0)+1;}});});
  const catN={};P.forEach(p=>p.techs.forEach(t=>{(catN[t.c]=catN[t.c]||new Set()).add(t.n);}));
  const top=tc.slice(0,8),tmx=top[0][1];
  const techSec=`<section class="section hx-tech"><div class="hx-tw"><div class="sh"><div><h2>AI &amp; technology capabilities</h2><p>${nt} technologies detected across ${CAT_ORDER.filter(c=>catN[c]).length} layers, from every project's recorded stack. Counts are projects using each technology.</p></div><a class="btn ghost sm" href="${U("tech")}">Open AI &amp; Technologies</a></div>
    <div class="hx-tg"><div class="hx-tbars"><div class="label" style="margin-bottom:12px">Most-used technologies</div>${top.map(([n,v])=>`<a class="hx-tb" href="${U("tech","t="+encodeURIComponent(n))}"><span class="n">${esc(n)}</span><span class="b"><i style="width:${v/tmx*100}%"></i></span><span class="v">${v}</span></a>`).join("")}</div>
    <div class="hx-tside"><div class="label" style="margin-bottom:12px">AI classification</div>${stackBar(P,{h:12})}
      <div class="label" style="margin:22px 0 10px">Technology layers</div><div class="hx-cats">${CAT_ORDER.filter(c=>catN[c]).map(c=>`<a class="hx-cat" href="${U("tech")}"><b>${catN[c].size}</b><span>${esc(c)}</span><small>${plural(catC[c],"project")}</small></a>`).join("")}</div></div></div></div></section>`;
  /* outcomes */
  const outs=`<section class="section hx-outs"><div class="sh"><div><h2>Proven business outcomes</h2><p>The ${roi.length} projects with client-measured results, shown exactly as recorded. Confidential ones need client sign-off before external use; all other projects carry delivery results rather than measured ROI.</p></div><a class="linkbtn" href="${U("projects","roi=1")}">Open with filters →</a></div>
    <div class="hx-og">${roi.map(p=>{const H=hid(p),n=H?null:bigNum(mk(p,p.top));return `<article class="hx-o"><div class="hx-on">${H?'<span class="hx-oh">Hidden</span>':esc(n||"Measured")}</div><div class="hx-ot">${H?'<span class="muted">Result hidden in client-safe mode</span>':T(p,p.top)}</div><h3><a href="${U("project-"+p.id)}">${esc(ptitle(p))}</a></h3><div class="meta">${esc(p.sectorName)} · ${esc(p.sub)}</div><div class="tags">${stTag(p)}${confTag(p)}${ccPill(p)}</div></article>`;}).join("")}</div></section>`;
  return hero+kpis+`
  <section class="section"><div class="sh"><div><h2>Featured work</h2><p>Three projects chosen from the data: screenshots first, then CodingCops delivery, measured ROI and delivery status.</p></div><a class="linkbtn" href="${U("projects","vis=1")}">All projects with visuals →</a></div><div class="hx-fg">${feat}</div></section>
  <section class="section hx-ind" id="sectors"><div class="sh"><div><h2>Explore by industry</h2><p>Open a sector for its projects, capabilities and sales intelligence. Expand “Delivery mix” on a card for AI and status detail.</p></div><div class="legend" style="margin:0">${aiKey()}</div></div><div class="scards">${cards}</div></section>
  ${techSec}${outs}
  <section class="section"><div class="sh"><div><h2>Portfolio insights</h2><p>Computed from the current data. Each insight links to the view that backs it.</p></div></div><div class="hx-ig">${insights().map(i=>`<a class="ins ${i.c||""}" href="${i.l}"><span class="k">${esc(i.k)}</span><h3>${esc(i.h)}</h3><p>${esc(i.t)}</p><span class="go">${esc(i.g||"Open")} →</span></a>`).join("")}</div></section>
  ${industrySection()}`;
}
function insights(){
  const out=[],genai=P.filter(p=>p.ai==="GenAI / LLM"),cop=genai.filter(p=>p.useCase==="GenAI Copilot / Assistant").length;
  out.push({k:"AI depth",h:`${genai.length} of ${P.length} projects are GenAI / LLM builds`,t:`${cop} of them are copilots or assistants, the largest use case in the portfolio.`,g:"See AI & Technologies",l:U("tech")});
  const sz=SECTORS.map(s=>[s,P.filter(p=>p.sector===s.slug)]).sort((a,b)=>b[1].length-a[1].length);
  const topN=sz[0][1].length,tops=sz.filter(x=>x[1].length===topN).map(x=>x[0].name);
  out.push({k:"Depth",h:`${tops.join(" and ")} ${tops.length>1?"lead":"leads"} with ${topN} projects${tops.length>1?" each":""}`,t:`That's where the most reference work sits for new pursuits.`,g:"Open sector",l:U("sector-"+sz[0][0].slug)});
  const noGen=sz.filter(x=>!x[1].some(p=>p.ai==="GenAI / LLM")).map(x=>x[0].name);
  if(noGen.length)out.push({c:"warn",k:"Whitespace",h:`No GenAI project yet in ${noGen.join(" or ")}`,t:`${noGen.length>1?"Each has":"It has"} delivery depth to build on. That's the clearest gap for the next GenAI case study.`,g:"See use cases",l:U("usecases")});
  const roi=P.filter(p=>p.roi),rc=roi.filter(p=>p.conf==="Confidential").length;
  out.push({c:"good",k:"Proof",h:`${roi.length} projects carry measured client outcomes`,t:`${rc} of them are Confidential, so they need client sign-off before external use.`,g:"See ROI projects",l:U("projects","roi=1")});
  const nv=P.filter(p=>p.conf==="Public"&&!p.visuals).length;
  out.push({c:"warn",k:"Marketing",h:`${nv} public projects have no visuals`,t:`Screenshots or a short deck would make each of them publish-ready.`,g:"Open case study readiness",l:U("marketing")});
  const tc=techCounts(P);
  out.push({k:"Stack",h:`${tc[0][0]} appears in ${tc[0][1]} projects, ${tc[1][0]} in ${tc[1][1]}`,t:`${tc[2][0]} (${tc[2][1]}) completes the most repeated stack across the portfolio.`,g:"See technology index",l:U("tech")});
  return out;
}
function industrySection(){
  const mapped=P.filter(p=>p.ind7),out=P.filter(p=>!p.ind7);
  const rows=IND7.map((n,i)=>({n,i:i+1,L:P.filter(p=>p.ind7===n).sort((a,b)=>a.indRank-b.indRank)}));
  const hasCC=r=>r.L.some(p=>p.cc),covered=rows.filter(hasCC).length,extOnly=rows.filter(r=>r.L.length&&!hasCC(r)).length,max=Math.max(1,...rows.map(r=>r.L.length));
  const t1=`<div class="tablewrap"><table class="tbl" style="min-width:820px"><thead><tr><th scope="col">#</th><th scope="col">Target industry</th><th scope="col" style="width:200px">Projects</th><th scope="col">Coverage</th><th scope="col">Which projects</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td class="idx">${r.i}</td><td><b style="font-weight:600">${esc(r.n)}</b></td><td><div class="cbar" data-tip="${esc(r.n)}: ${r.L.filter(p=>p.cc).length} CodingCops · ${r.L.filter(p=>!p.cc).length} external"><span class="t"><i style="width:${r.L.length/max*100}%"></i></span><b>${r.L.length}</b></div></td>
      <td>${hasCC(r)?'<span class="cov ok">Covered</span>':r.L.length?'<span class="cov ext">External only</span>':'<span class="cov gap">Gap</span>'}</td><td class="plinks">${r.L.length?r.L.map(plink).join(", "):'<span class="muted">None</span>'}</td></tr>`).join("")}
    <tr class="sum"><td></td><td>Mapped to the 7</td><td class="num">${mapped.length}</td><td>${covered} of ${IND7.length} covered by CodingCops${extOnly?` · ${extOnly} external only`:""}</td><td class="muted" style="font-weight:400">${mapped.filter(p=>!p.cc).length} of these are external (non-CC)</td></tr>
    <tr class="sum"><td></td><td>Not in the 7</td><td class="num">${out.length}</td><td></td><td class="muted" style="font-weight:400">Listed in the full mapping below</td></tr>
    <tr class="sum"><td></td><td>Total</td><td class="num">${P.length}</td><td></td><td></td></tr></tbody></table></div>`;
  const f=S.Q.indf||"all",L2=[...P].sort((a,b)=>a.indRank-b.indRank).filter(p=>f==="all"||(f==="mapped"?p.ind7:!p.ind7));
  const t2=`<div class="tablewrap"><table class="tbl" style="min-width:880px"><thead><tr><th scope="col">#</th><th scope="col">Project</th><th scope="col">Actual industry</th><th scope="col">Sub-industry</th><th scope="col">Maps to (the 7)</th></tr></thead><tbody>
    ${L2.map((p,k)=>`<tr><td class="idx">${k+1}</td><td class="plinks"><a href="${U("project-"+p.id)}">${esc(pshort(p))}</a>${p.cc?"":' <span class="tag t-amber" style="margin-left:4px">Non-CC · External</span>'}</td><td>${esc(cap(p.actualIndustry))}</td><td>${esc(p.sub)}</td><td>${p.ind7?`<a class="maps" style="color:var(--ink)" href="${U("projects","ind="+encodeURIComponent(p.ind7))}">${esc(p.ind7)}</a>`:'<span class="maps none">Not in the 7</span>'}</td></tr>`).join("")}</tbody></table></div>`;
  const gaps=rows.filter(r=>!hasCC(r)).map(r=>r.n);
  return `<section class="section" id="industry-summary"><div class="sh"><div><h2>Coverage against the 7 target industries</h2><p>Each project is counted once, by the client's actual business. External (non-CC) projects are listed but do not count as coverage. Insurance projects are counted under Fintech / Financial services.</p></div></div>
  <div class="kpis"><div class="kpi"><span class="v">${covered}<small>/${IND7.length}</small></span><span class="l">Target industries covered by CodingCops</span></div>
    <div class="kpi"><span class="v">${mapped.length}</span><span class="l">Projects mapped to the 7</span></div>
    <div class="kpi"><span class="v">${out.length}</span><span class="l">Projects outside the 7</span></div>
    <div class="kpi"><span class="v" style="color:var(--red)">${gaps.length}</span><span class="l">No CodingCops project yet</span><span class="s">${esc(gaps.map(g=>g.split(" / ")[0]).join(", "))}</span></div></div>
  <div style="margin-top:16px">${t1}</div>
  <details class="more"${S.Q.indf?" open":""}><summary>Full mapping: all ${P.length} projects by actual industry and sub-industry</summary><div><div style="margin-bottom:12px"><div class="seg" role="group" aria-label="Filter projects"><button type="button" data-act="indf" data-k="all" aria-pressed="${f==="all"}">All ${P.length}</button><button type="button" data-act="indf" data-k="mapped" aria-pressed="${f==="mapped"}">Mapped ${mapped.length}</button><button type="button" data-act="indf" data-k="out" aria-pressed="${f==="out"}">Not in the 7 ${out.length}</button></div></div>${t2}</div></details></section>`;
}
/* ---------- projects explorer ---------- */
const PDIMS=["s","uc","tech","st","ind","sub","ai","src","conf"];
const PCORE=["s","uc","tech","st"];
function vProjects(){
  return crumbs([["Overview",U("home")],["All projects"]])+`<div class="ph"><div><h1>All projects</h1><p class="lede">Search by name, industry, technology or business problem, then narrow with filters. Every filter is saved in the page link, so you can share the exact view.</p></div></div>
  ${fbar(PDIMS,P,{core:PCORE,toggles:["roi","vis","proto"],list:true,ph:"Search projects, industries, technologies, or business problems"})}
  ${resBlock(()=>{const L=sortList(applyF(P,PDIMS));return fhead(L.length,PDIMS)+listView(L);})}`;
}
/* ---------- sector ---------- */
const SDIMS=["sub","uc","tech","st","ai","src","conf"];
const SCORE=["sub","uc","tech","st"];
function vSector(slug){
  const s=secBy[slug];if(!s)return vMissing();
  const all=P.filter(p=>p.sector===slug),tab=S.Q.tab==="insights"?"insights":"projects";
  const subs=new Set(all.map(p=>p.sub)).size,ext=all.filter(p=>!p.cc).length,b=bestProof(all);
  const ucRows=Object.entries(all.reduce((m,p)=>(m[p.useCase]=(m[p.useCase]||0)+1,m),{})).sort((a,c)=>c[1]-a[1]);
  const head=crumbs([["Overview",U("home")],["Industries",U("industries")],[s.name]])+`<div class="ph"><div><div class="kicker">Industry sector</div><h1>${esc(s.name)}</h1><p class="lede">${esc(s.desc)}</p>
    <div class="tags" style="margin-top:14px"><span class="meta" style="margin-right:4px">Primary capabilities:</span>${ucRows.slice(0,3).map(([u,n])=>`<a class="tag" href="${U("usecases","u="+encodeURIComponent(u))}">${esc(u)} <span class="muted">${n}</span></a>`).join("")}</div></div>
    <div class="acts"><a class="btn ghost sm" href="${U("pitch")}">Build a pitch</a><a class="btn ghost sm" href="${U("projects","s="+slug)}">Open in All projects</a></div></div>
  <div class="kpis"><div class="kpi primary"><span class="v">${all.length}</span><span class="l">Projects</span><span class="s">${all.length-ext} by CodingCops${ext?` · ${ext} external`:""}</span></div><div class="kpi"><span class="v">${cnt(all,"status","Live / Production")}</span><span class="l">Live in production</span></div><div class="kpi"><span class="v">${cnt(all,"ai","GenAI / LLM")}</span><span class="l">GenAI / LLM</span></div><div class="kpi"><span class="v">${all.filter(p=>p.roi).length}</span><span class="l">Measured ROI</span></div><div class="kpi"><span class="v">${subs}</span><span class="l">Sub-industries</span></div></div>
  <div class="callout"><div><span class="k">Strongest evidence</span><b>${esc(ptitle(b))}</b><span class="t">${hid(b)?"Result hidden in client-safe mode":T(b,b.top)}</span></div><a class="btn sm" href="${U("project-"+b.id)}">Open project</a></div>
  <div class="tabs" role="tablist"><button class="tab" role="tab" type="button" data-act="tab" data-k="projects" aria-selected="${tab==="projects"}">Projects<span class="tn">${all.length}</span></button><button class="tab" role="tab" type="button" data-act="tab" data-k="insights" aria-selected="${tab==="insights"}">Industry intelligence</button></div>`;
  const bar=fbar(SDIMS,all,{core:SCORE,toggles:["roi","vis","proto"],list:tab==="projects",ph:`Search ${s.name} projects`});
  if(tab==="projects")return head+bar+resBlock(()=>{const L=sortList(applyF(all,SDIMS));return fhead(L.length,SDIMS)+listView(L,{noSector:true});});
  return head+bar+resBlock(()=>{const L=applyF(all,SDIMS);return fhead(L.length,SDIMS)+sectorIntel(all,L);});
}
function sectorIntel(all,L){
  if(!L.length)return `<div class="empty"><b>No projects match these filters.</b><br>Remove a filter to see the sector intelligence again.</div>`;
  const ucRows=Object.entries(L.reduce((m,p)=>(m[p.useCase]=(m[p.useCase]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k,v}));
  const stRows=ST_ORDER.map(k=>({k,v:cnt(L,"status",k),dot:ST_VAR[k],color:ST_VAR[k]})).filter(r=>r.v);
  const tc=techCounts(L).slice(0,14),personas=[...new Set(L.flatMap(p=>p.persona))];
  const proofs=[...L].sort((a,b)=>(b.cc-a.cc)||(b.roi-a.roi)||(stRank(a)-stRank(b))).slice(0,3);
  const live=L.filter(p=>p.status==="Live / Production"),ext=L.filter(p=>!p.cc),roi=L.filter(p=>p.roi);
  const have=new Set(all.map(p=>p.useCase)),white=UC_ORDER.filter(u=>!have.has(u)&&cnt(P,"useCase",u)>=2).slice(0,5),noGen=!all.some(p=>p.ai==="GenAI / LLM");
  const inds=[...new Set(L.map(p=>p.ind7||NOT7))];
  const li=p=>`<li><a href="${U("project-"+p.id)}">${esc(pshort(p))}</a><span class="m">${esc(p.useCase)} · ${esc(p.status)}${p.cc?"":" · External"}</span></li>`;
  return `<div class="isec"><h3>Capabilities</h3><p>What has been built in this sector, and with what.</p><div class="grid g3"><div class="card pad"><div class="label" style="margin-bottom:10px">Use-case mix</div>${barList(ucRows)}</div>
    <div class="card pad"><div class="label" style="margin-bottom:12px">AI mix</div>${stackBar(L,{h:10})}</div>
    <div class="card pad"><div class="label" style="margin-bottom:12px">Most-used technologies</div><div class="tags">${tc.map(([n,v])=>`<a class="tag" href="${U("tech","t="+encodeURIComponent(n))}">${esc(n)} <span class="muted">${v}</span></a>`).join("")||'<span class="muted">No stack recorded.</span>'}</div></div></div></div>
  <div class="isec"><h3>Delivery experience</h3><p>Where the work stands today.</p><div class="grid g3"><div class="card pad"><div class="label" style="margin-bottom:10px">Delivery status</div>${barList(stRows)}</div>
    <div class="card pad"><div class="label" style="margin-bottom:12px">Live implementations (${live.length})</div><ul class="side-list">${live.map(li).join("")||'<li class="muted">None live in this view.</li>'}</ul></div>
    <div class="card pad"><div class="label" style="margin-bottom:12px">External references (${ext.length})</div><ul class="side-list">${ext.map(li).join("")||'<li class="muted">All projects in this view were delivered by CodingCops.</li>'}</ul><p class="sup" style="margin-top:10px">External builds are reference points for domain depth, not CodingCops delivery.</p></div></div></div>
  <div class="isec"><h3>Sales intelligence</h3><p>What to quote and who to sell to.</p><div class="grid g3"><div class="card pad"><div class="label" style="margin-bottom:12px">Proof points to quote</div><ul class="side-list">${proofs.map(p=>`<li><a href="${U("project-"+p.id)}">${esc(pshort(p))}</a><span class="m">${hid(p)?"Hidden in client-safe mode":T(p,p.top)}</span></li>`).join("")}</ul></div>
    <div class="card pad"><div class="label" style="margin-bottom:12px">Measured outcomes (${roi.length})</div><ul class="side-list">${roi.map(p=>`<li><a href="${U("project-"+p.id)}">${esc(pshort(p))}</a><span class="m">${hid(p)?"Hidden in client-safe mode":T(p,p.kpi||p.top)}</span></li>`).join("")||'<li class="muted">No measured ROI recorded in this view yet.</li>'}</ul></div>
    <div class="card pad"><div class="label" style="margin-bottom:12px">Buyer personas (${personas.length})</div><ul class="side-list">${personas.map(x=>`<li style="color:var(--ink-2)">${esc(x)}</li>`).join("")}</ul></div></div></div>
  <div class="isec"><h3>Coverage opportunities</h3><p>Whitespace and gaps to close with the next case study.</p><div class="grid g2"><div class="card pad"><div class="label" style="margin-bottom:12px">Whitespace</div><ul class="side-list">${noGen?`<li><span class="gapchip">No GenAI project yet</span></li>`:""}${white.map(u=>`<li><b>${esc(u)}</b><span class="m">Delivered ${cnt(P,"useCase",u)} times in other sectors, not here yet.</span></li>`).join("")||'<li class="muted">No obvious gaps.</li>'}</ul></div>
    <div class="card pad"><div class="label" style="margin-bottom:12px">Target-industry mapping</div><ul class="side-list">${inds.map(n=>`<li><b>${esc(n)}</b><span class="m">${plural(L.filter(p=>(p.ind7||NOT7)===n).length,"project")} in this view</span></li>`).join("")}</ul><p class="sup" style="margin-top:10px">See the full 7-industry coverage on the <a href="${U("industries")}">Industries overview</a>.</p></div></div></div>`;
}

/* ---------- project page ---------- */
const PTABS=[["overview","Overview"],["story","Challenge & Solution"],["tech","Technology"],["campaign","Marketing"],["data","Evidence"]];
function factV(p,v){if(!v)return `<span class="gap">Not disclosed</span>`;if(/^not (publicly )?disclosed\.?$/i.test(v))return `<span class="gap">${esc(v)}</span>`;if(/^tbd$/i.test(v))return `<span class="gap">Not disclosed <span class="muted">(recorded as “${esc(v)}”)</span></span>`;return T(p,v);}
function vProject(id){
  const p=byId[id];if(!p)return vMissing();
  const s=secBy[p.sector],sib=P.filter(x=>x.sector===p.sector),i=sib.indexOf(p),prev=sib[(i-1+sib.length)%sib.length],next=sib[(i+1)%sib.length];
  const H=hid(p),sub=psub(p),G=imgs(p);
  const head=crumbs([["Overview",U("home")],[s.name,U("sector-"+s.slug)],[pshort(p)]])+`
  <section class="phead"><div><div class="kicker">${esc(s.name)} · ${esc(p.sub)}</div><h1>${esc(ptitle(p))}</h1>${sub?`<p class="desc">${esc(sub)}</p>`:""}
    <p class="client">${esc(pclient(p))} · ${provLine(p)}</p>
    <div class="tags"><span class="tag">${esc(p.useCase)}</span>${aiTag(p)}${stTag(p)}${confTag(p)}${roiTag(p)}${ccPill(p)}</div>${p.proto?`<div style="margin-top:16px">${protoBtn(p,"lg")}</div>`:""}</div>
    <div class="oneliner"><p>${T(p,p.oneLiner)}</p>${cpb(mk(p,p.oneLiner))}</div></section>
  <nav class="secnav" aria-label="Sections of this project">${PTABS.map(([k,l])=>`<button type="button" data-act="jump" data-k="${k}" aria-current="${k==="overview"}">${l}</button>`).join("")}</nav>`;
  return head+pOverview(p,H,G)+pStory(p)+pTech(p)+pCampaign(p,H)+pData(p,H)+`
  <section class="section"><div class="sh"><div><h2>Related projects</h2><p>Matched on use case, sector, AI type and shared stack.</p></div></div><div class="pgrid">${p.similar.map(i=>pcard(byId[i])).join("")}</div></section>
  <nav class="prevnext" aria-label="More in this sector"><a href="${U("project-"+prev.id)}"><span>← Previous in ${esc(s.name)}</span>${esc(ptitle(prev))}</a><a class="next" href="${U("project-"+next.id)}"><span>Next in ${esc(s.name)} →</span>${esc(ptitle(next))}</a></nav>`;
}
function aiBlock(p){const x=p.aiExt;if(!x)return "";
  return `<div class="aib${x.delivered?"":" plan"}"><div class="aih"><span class="aik">${x.delivered?"AI capabilities":"AI layer · planned with the build"}</span>${cpb(mk(p,[x.useCase,...x.caps.map(c=>"• "+c)].join("\n")),"Copy")}</div>
  <h3>${T(p,x.useCase)}</h3><ul>${x.caps.map(c=>`<li>${T(p,c)}</li>`).join("")}</ul>
  <div class="aif"><span><b>Impact</b> ${x.delivered?"Not yet measured":"Not built yet"}</span><a href="#sec-data" data-act="jump" data-k="data">AI record in Evidence</a></div></div>`;}
function pOverview(p,H,G){
  return `<section class="psec" id="sec-overview"><div class="sh"><div><h2>Project at a glance</h2><p>${p.roi?"Measured client outcomes and key facts from the master sheet.":"Delivery results and key facts from the master sheet."}</p></div></div>
  <div class="ov"><div>${H?`<div class="hiddenbox">Results for this confidential project are hidden in client-safe mode.</div>`:`<div class="metrics">${p.metrics.map((m,k)=>`<div class="metric${k===0?" lead":""}"><span class="k">Result ${k+1}${k===0?" · top result":""}</span>${T(p,m)||'<span class="muted">Not recorded</span>'}</div>`).join("")}</div>`}
    <div class="card pad" style="margin-top:14px"><span class="label">Campaign theme</span><p style="margin-top:6px;font-weight:600;font-size:16.5px">${T(p,p.brief.theme)}</p></div>${aiBlock(p)}</div>
    <div class="card pad"><div class="label">Key facts</div><dl class="facts">
      <div><dt>Client</dt><dd>${esc(pclient(p))}</dd></div><div><dt>Client size</dt><dd>${factV(p,p.size)}</dd></div><div><dt>Duration</dt><dd>${factV(p,p.duration)}</dd></div>
      <div><dt>Time to value</dt><dd>${factV(p,p.ttv)}</dd></div><div><dt>Improvement</dt><dd>${H?'<span class="gap">Hidden in client-safe mode</span>':factV(p,p.kpi)}</dd></div>
      <div><dt>Industry</dt><dd>${esc(p.industry)}</dd></div><div><dt>Summary sheet</dt><dd>${esc(p.summ.industry)}</dd></div>
      <div><dt>Target industry</dt><dd>${esc(p.ind7||NOT7)}</dd></div><div><dt>Delivered by</dt><dd>${esc(p.provider)}</dd></div>${p.proto?`<div><dt>Prototype</dt><dd>${hideName(p)?'<span class="gap">Link hidden in client-safe mode</span>':`<a href="${esc(p.proto)}" target="_blank" rel="noopener noreferrer" style="word-break:break-all">${esc(p.proto.replace(/^https:\/\//,"").replace(/\/$/,""))}</a>`}</dd></div>`:""}</dl></div></div>
  ${G.length?`<div class="sh" style="margin-top:28px"><div><h3>Screenshots</h3><p>${plural(G.length,"image")} from the case study files. Click to enlarge; use the arrow keys in the viewer.</p></div></div>
    <div class="gallery"><button class="gmain" type="button" data-act="lbopen" data-pid="${p.id}" data-i="0" id="gmain" aria-label="Open screenshot viewer"><img id="gmainimg" src="${G[0].src}" alt="${esc(G[0].cap)}"><span class="cap" id="gmaincap">${esc(G[0].cap)}</span></button>
    <div class="gthumbs">${G.map((g,k)=>`<button type="button" data-act="gthumb" data-pid="${p.id}" data-i="${k}" aria-pressed="${k===0}" aria-label="${esc(g.cap)}"><img src="${g.src}" alt="" loading="lazy"></button>`).join("")}</div></div>`:(hideName(p)&&p.images.length?`<div class="hiddenbox" style="margin-top:20px">${plural(p.images.length,"screenshot")} hidden in client-safe mode.</div>`:"")}</section>`;
}
function pStory(p){
  return `<section class="psec" id="sec-story"><div class="sh"><div><h2>Challenge &amp; solution</h2><p>The full project story as recorded: challenge, root cause, business impact, what was built and every feature.</p></div></div>
  <div class="story"><div class="card"><h3><i>1</i>Challenge</h3><p>${T(p,p.problem)}</p></div><div class="card"><h3><i>2</i>Root cause</h3><p>${T(p,p.cause)}</p></div><div class="card"><h3><i>3</i>Business impact before ${p.cc?"CodingCops":"the build"}</h3><p>${T(p,p.impact)}</p></div></div>
  <div class="sh" style="margin-top:28px"><div><h3>${p.cc?"What CodingCops built":"What was built"}</h3></div></div><p class="prose">${T(p,p.solution)}</p>
  <div class="sh" style="margin-top:28px"><div><h3>Features &amp; capabilities <span class="muted" style="font-weight:500">(${p.features.length})</span></h3></div></div><ul class="feat">${p.features.map(f=>`<li>${T(p,f)}</li>`).join("")}</ul></section>`;
}
function pTech(p){
  const cats=CAT_ORDER.map(c=>[c,p.techs.filter(t=>t.c===c)]).filter(x=>x[1].length);
  return `<section class="psec" id="sec-tech"><div class="sh"><div><h2>Technology architecture</h2><p>${plural(p.techs.length,"technology")} detected and grouped by layer. Click one to see every project that uses it.</p></div></div>
  ${cats.length?`<div class="techg">${cats.map(([c,ts])=>`<div class="grp"><div class="label">${esc(c)} · ${ts.length}</div><div class="tags">${ts.map(t=>`<a class="tag" href="${U("tech","t="+encodeURIComponent(t.n))}">${esc(t.n)}</a>`).join("")}</div></div>`).join("")}</div>`:`<p class="sup">No stack details recorded for this project.</p>`}
  <details class="raw"><summary>Full stack as recorded in the master sheet</summary><p>${T(p,p.techRaw)}</p></details></section>`;
}
function pCampaign(p,H){
  const fullBrief=[`${pname(p)}`,`Theme: ${mk(p,p.brief.theme)}`,`Hook: ${mk(p,p.brief.hook)}`,`Proof point: ${mk(p,p.brief.proof)}`,`Key results:\n${p.brief.card.map(x=>"• "+mk(p,x)).join("\n")}`,`Before: ${mk(p,p.brief.before)}`,`After: ${mk(p,p.brief.after)}`,`CTA: ${mk(p,p.brief.cta)}`].join("\n\n");
  return `<section class="psec" id="sec-campaign"><div class="sh"><div><h2>Sales &amp; marketing intelligence</h2><p>Campaign brief, personas and tags from the Campaign Brief and Summary sheets. Copy a field or the full brief.</p></div>${cpb(fullBrief,"Copy full brief")}</div><div class="brief">
    <div class="bitem big"><div class="bh"><span class="label">Hook</span>${cpb(mk(p,p.brief.hook))}</div><p>${T(p,p.brief.hook)}</p></div>
    <div class="bitem"><div class="bh"><span class="label">Campaign theme</span>${cpb(mk(p,p.brief.theme))}</div><p>${T(p,p.brief.theme)}</p></div>
    <div class="bitem"><div class="bh"><span class="label">30-word proof point</span>${cpb(mk(p,p.brief.proof))}</div><p>${T(p,p.brief.proof)}</p></div>
    ${p.aiExt&&p.aiExt.angle?`<div class="bitem"><div class="bh"><span class="label">AI campaign angle</span>${cpb(mk(p,p.aiExt.angle))}</div><p>${T(p,p.aiExt.angle)}</p></div>`:""}
    ${H?`<div class="hiddenbox" style="grid-column:1/-1">Metrics card and before / after are hidden in client-safe mode.</div>`:`
    <div class="bitem"><div class="bh"><span class="label">Metrics card</span>${cpb(p.brief.card.map(x=>"• "+mk(p,x)).join("\n"))}</div><ul>${p.brief.card.map(x=>`<li>${T(p,x)}</li>`).join("")}</ul></div>
    <div class="bitem"><div class="bh"><span class="label">CTA angle</span>${cpb(mk(p,p.brief.cta))}</div><p>${T(p,p.brief.cta)}</p></div>
    <div class="ba"><div class="b"><div class="label">${dot("--st-dev")}Before</div><p>${T(p,p.brief.before)}</p></div><div class="a"><div class="label">${dot("--st-live")}After</div><p>${T(p,p.brief.after)}</p></div></div>`}
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card pad"><div class="label">Top metric (summary sheet)</div><p style="margin-top:6px;font-weight:500">${H?'<span class="muted">Hidden in client-safe mode</span>':T(p,p.summ.top)}</p>
      <div class="label" style="margin-top:20px">Target buyer persona</div><ul class="side-list" style="margin-top:8px">${p.persona.map(x=>`<li style="color:var(--ink-2)">${esc(x)}</li>`).join("")}</ul></div>
    <div class="card pad"><div class="label">Campaign tags</div><div class="tags" style="margin-top:8px">${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
      <div class="label" style="margin-top:20px">Visual assets</div><p style="margin-top:6px;color:var(--ink-2)">${T(p,p.visualText)}</p>
      <div class="label" style="margin-top:20px">Confidentiality note</div><p style="margin-top:6px;color:var(--ink-2)">${T(p,p.confText)}</p></div></div></section>`;
}
function pData(p,H){
  const gaps=p.gaps,filled=22-gaps.length;
  const row=(k,v)=>`<div><dt>${k}</dt><dd>${v}</dd></div>`;
  return `<section class="psec" id="sec-data"><div class="sh"><div><h2>Data &amp; evidence</h2><p>How complete the record is, where it came from, and the classification values exactly as recorded.</p></div></div>
  <div class="grid g3"><div class="card pad"><div class="label">Data completeness</div><div class="meter"><i style="width:${filled/22*100}%"></i></div><p style="font-size:14.5px"><b class="num">${filled}/22</b> fields filled.${gaps.length?" Still to chase:":" Nothing missing."}</p><div style="margin-top:10px">${gaps.map(g=>`<span class="gapchip">${esc(g)}</span>`).join("")}</div></div>
  <div class="card pad"><div class="label">Source files</div>${hideName(p)?`<p class="sup" style="margin-top:10px">File names hidden in client-safe mode.</p>`:`<ul class="side-list" style="margin-top:12px">${(p.sources.length?p.sources:["CC-Projects Impact Data.xlsx (master sheet only)"]).map(f=>`<li class="mono">${esc(f)}</li>`).join("")}</ul>`}</div>
  <div class="card pad"><div class="label">Classification as recorded</div><dl class="facts">${row("Project ID",`<span class="mono">#${p.id}</span>`)}${row("Sector",esc(p.sectorName))}${row("Sub-industry",esc(p.sub))}${row("Actual industry",esc(cap(p.actualIndustry)))}${row("Use case",esc(p.useCase))}${row("AI type",esc(p.ai))}${row("Status",esc(p.status))}${row("Visibility",esc(p.conf))}${row("Delivered by",esc(p.provider))}${row("Visuals",p.visuals?"Yes":"No")}${row("Measured ROI",p.roi?"Yes":"No")}${row("Prototype",p.proto?(hideName(p)?"Yes (link hidden)":"Yes"):"No")}</dl></div></div>
  ${p.aiExt?`<div class="card pad" style="margin-top:14px"><div class="label">AI record (master sheet rows 29 to 35)</div><dl class="facts">${row("AI status",T(p,p.aiExt.status))}${row("AI use case",T(p,p.aiExt.useCase))}${row("AI stack as scoped",T(p,p.aiExt.stack)||'<span class="gap">Not recorded</span>')}${row("AI impact",T(p,p.aiExt.impact))}</dl></div>`:""}</section>`;
}
/* ---------- use cases ---------- */
function vUseCases(){
  const selU=S.Q.u||"",hv=S.Q.hv==="list"?"list":"grid";
  const rows=UC_ORDER.map(u=>{const L=P.filter(p=>p.useCase===u);const secs=new Set(L.map(p=>p.sector)).size;
    return `<button type="button" class="ucrow" data-act="uc" data-k="${esc(u)}" aria-pressed="${selU===u}"><b>${esc(u)}</b><span class="c">${L.length}<small>${L.length===1?"project":"projects"}</small></span><span class="c">${secs}<small>${secs===1?"sector":"sectors"}</small></span>${stackBar(L,{legend:false,h:8})}</button>`;}).join("");
  const sel=selU?P.filter(p=>p.useCase===selU):[];
  let mx=0;const M={};SECTORS.forEach(s=>{M[s.slug]={};UC_ORDER.forEach(u=>{const v=P.filter(p=>p.sector===s.slug&&p.useCase===u).length;M[s.slug][u]=v;mx=Math.max(mx,v);});});
  const cell=(s,u)=>{const v=M[s.slug][u];if(!v)return `<td><button type="button" class="z" tabindex="-1" aria-hidden="true">0</button></td>`;
    const pct=Math.round(20+80*(v/mx));const on=S.heat&&S.heat[0]===s.slug&&S.heat[1]===u;
    return `<td><button type="button" class="${on?"sel":""}" data-act="heat" data-s="${s.slug}" data-k="${esc(u)}" aria-pressed="${!!on}" aria-label="${esc(s.name)}, ${esc(u)}: ${plural(v,"project")}" data-tip="${esc(s.name)} × ${esc(u)}: ${plural(v,"project")}" style="background:color-mix(in srgb,var(--accent) ${pct}%,var(--surface));color:${pct>55?"#fff":"var(--ink)"}">${v}</button></td>`;};
  const hsel=S.heat?P.filter(p=>p.sector===S.heat[0]&&p.useCase===S.heat[1]):[];
  const heat=`<div class="card hmwrap"><table class="hm"><caption class="sr">Projects by sector and use case</caption><thead><tr><th scope="col">Sector</th>${UC_ORDER.map(u=>`<th scope="col">${esc(u)}</th>`).join("")}<th scope="col">Total</th></tr></thead><tbody>
    ${SECTORS.map(s=>`<tr><th scope="row">${esc(s.name)}</th>${UC_ORDER.map(u=>cell(s,u)).join("")}<td class="tot">${P.filter(p=>p.sector===s.slug).length}</td></tr>`).join("")}
    <tr><th scope="row" class="muted">Total</th>${UC_ORDER.map(u=>`<td class="tot">${cnt(P,"useCase",u)}</td>`).join("")}<td class="tot">${P.length}</td></tr></tbody></table></div>`;
  const list=`<div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Sector</th><th scope="col">Projects</th><th scope="col">Use cases delivered (click to list projects)</th></tr></thead><tbody>${SECTORS.map(s=>{const e=UC_ORDER.filter(u=>M[s.slug][u]);return `<tr><th scope="row" style="font-weight:600;text-align:left">${esc(s.name)}</th><td class="num">${P.filter(p=>p.sector===s.slug).length}</td><td><div class="tags">${e.map(u=>{const on=S.heat&&S.heat[0]===s.slug&&S.heat[1]===u;return `<button type="button" class="tchip" data-act="heat" data-s="${s.slug}" data-k="${esc(u)}" aria-pressed="${!!on}">${esc(u)} <span class="n">${M[s.slug][u]}</span></button>`;}).join("")}</div><div class="sm">Whitespace: ${UC_ORDER.length-e.length} of ${UC_ORDER.length} use cases not delivered here.</div></td></tr>`;}).join("")}</tbody></table></div>`;
  return crumbs([["Overview",U("home")],["Use cases"]])+`<div class="ph"><div><h1>Use cases</h1><p class="lede">Which types of solutions have we delivered, and in which industries? ${UC_ORDER.length} use cases across ${SECTORS.length} sectors. Pick one to list its projects, or use the coverage map to spot whitespace.</p></div><div class="legend" style="margin:0">${aiKey()}</div></div>
  <div class="uchead"><span>Use case</span><span>Projects</span><span>Sectors</span><span>AI mix</span></div><div class="ucl">${rows}</div>
  ${selU?`<section class="section" id="ucsel"><div class="sh"><div><h2>${esc(selU)}</h2><p>${plural(sel.length,"project")} across ${plural(new Set(sel.map(p=>p.sector)).size,"sector")}.</p></div><span style="display:flex;gap:16px;align-items:center"><a class="linkbtn" href="${U("projects","uc="+encodeURIComponent(selU))}">Open in All projects with filters</a><button class="linkbtn" type="button" data-act="uc" data-k="">Clear</button></span></div><div class="pgrid">${sortList(sel,"status").map(pcard).join("")}</div></section>`:""}
  <section class="section"><div class="sh"><div><h2>Coverage map: sector by use case</h2><p>Darker cells mean deeper coverage; empty cells are whitespace. Select a cell to list its projects.</p></div><div class="seg" role="group" aria-label="Coverage view"><button type="button" data-act="hv" data-k="grid" aria-pressed="${hv==="grid"}">Heatmap</button><button type="button" data-act="hv" data-k="list" aria-pressed="${hv==="list"}">Table</button></div></div>
    ${hv==="grid"?heat:list}
    ${S.heat?`<div class="section" id="heatsel" style="margin-top:22px"><div class="sh"><div><h3>${esc(secBy[S.heat[0]].name)} × ${esc(S.heat[1])}</h3><p>${plural(hsel.length,"project")}</p></div><button class="linkbtn" type="button" data-act="heatclear">Clear selection</button></div><div class="pgrid">${hsel.map(pcard).join("")}</div></div>`:""}
  </section>`;
}
/* ---------- AI & technologies ---------- */
const TDIMS=["s","src","ai","st"];
function vTech(){
  const nt=techCounts(P).length,cats=new Set(P.flatMap(p=>p.techs.map(t=>t.c))).size;
  const kpi=(v,l,href)=>href?`<a class="kpi" href="${href}"><span class="v">${v}</span><span class="l">${l}</span></a>`:`<div class="kpi"><span class="v">${v}</span><span class="l">${l}</span></div>`;
  return crumbs([["Overview",U("home")],["AI & Technologies"]])+`<div class="ph"><div><h1>AI &amp; Technologies</h1><p class="lede">Have we built with it? ${nt} technologies across ${cats} layers, detected from every project's recorded stack. Find a technology to see the projects and industries behind it, or narrow the portfolio first.</p></div></div>
  <div class="kpis k5">${kpi(nt,"Technologies")}${kpi(cats,"Technology layers")}${kpi(cnt(P,"ai","GenAI / LLM"),"GenAI / LLM projects",U("projects","ai=GenAI+/+LLM"))}${kpi(cnt(P,"ai","Other AI / ML"),"Other AI / ML projects",U("projects","ai=Other+AI+/+ML"))}${kpi(cnt(P,"ai","Traditional"),"Traditional builds",U("projects","ai=Traditional"))}</div>
  <div class="fbar" style="margin-top:24px"><div class="frow"><div class="fs">${ICO_S}<input id="techq" class="inp" type="search" placeholder="Find a technology or capability (React, Kafka, RAG, HIPAA)" value="${esc(S.techq)}" aria-label="Find a technology"></div></div></div>
  <div class="label" style="margin:4px 0 8px">Narrow the projects counted</div>${fbar(TDIMS,P,{ph:"Search projects"})}${resBlock(techBody)}`;
}
function techBody(){
  const L=applyF(P,TDIMS),tc=techCounts(L),genai=L.filter(p=>p.ai==="GenAI / LLM"),t=S.Q.t||"";
  const top=tc.slice(0,12).map(([k,v])=>({k,v,sel:t===k}));
  const sel=t?L.filter(p=>p.techs.some(x=>x.n===t)):[];
  const selInd=[...new Set(sel.map(p=>p.sectorName))];
  const cat=t?(P.flatMap(p=>p.techs).find(x=>x.n===t)||{}).c:"";
  return fhead(L.length,TDIMS)+(L.length?`${t?`<section class="techsel" id="techsel"><div class="sh" style="margin-bottom:6px"><div><div class="kicker">${esc(cat||"Technology")}</div><h2>${esc(t)}</h2></div><button class="linkbtn" type="button" data-act="tsel" data-k="">Clear selection</button></div>
    <div class="row"><span><b>${plural(sel.length,"project")}</b> in this view</span><span><b>${plural(selInd.length,"industry")}</b>: ${esc(selInd.join(", "))||"none"}</span></div>
    <div class="pgrid" style="margin-top:18px">${sortList(sel,"status").map(pcard).join("")||'<div class="empty">No project in this view uses it. Clear a filter above.</div>'}</div></section>`:""}
  <div class="grid g2" style="margin-top:18px">
    <div class="card pad"><div class="label" style="margin-bottom:12px">AI classification</div>${stackBar(L,{h:10})}
      <div class="label" style="margin:22px 0 10px">GenAI / LLM projects (${genai.length})</div><ul class="side-list">${genai.map(p=>`<li><a href="${U("project-"+p.id)}">${esc(pshort(p))}</a><span class="m">${esc(p.useCase)} · ${esc(p.sub)}</span></li>`).join("")||'<li class="muted">None in this view.</li>'}</ul></div>
    <div class="card pad"><div class="label" style="margin-bottom:10px">Most-used technologies</div>${barList(top,{act:"tsel"})}</div></div>
  <section class="section"><div class="sh"><div><h2>Technology index</h2><p>Grouped by layer. Select a technology to list the projects that use it.</p></div></div><div id="techidx">${techIndex(L)}</div></section>`:`<div class="empty"><b>No projects match these filters.</b><br>Remove a filter to see the technology index.</div>`);
}
function techIndex(L){
  const m={};(L||applyF(P,TDIMS)).forEach(p=>p.techs.forEach(t=>{(m[t.c]=m[t.c]||{})[t.n]=(m[t.c][t.n]||0)+1;}));
  const q=S.techq.toLowerCase(),t=S.Q.t||"";
  const html=CAT_ORDER.map(c=>{const e=Object.entries(m[c]||{}).filter(([n])=>!q||n.toLowerCase().includes(q)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));if(!e.length)return "";
    return `<div class="card pad" style="margin-bottom:12px"><div class="label" style="margin-bottom:12px">${esc(c)} · ${e.length}</div><div class="tags">${e.map(([n,v])=>`<button class="tchip" type="button" data-act="tsel" data-k="${esc(n)}" aria-pressed="${t===n}">${esc(n)} <span class="n">${v}</span></button>`).join("")}</div></div>`;}).join("");
  return html||`<div class="empty"><b>No technology matches “${esc(S.techq)}”.</b><br>Try a shorter term, for example “SQL” or “AWS”.</div>`;
}

/* ---------- pitch builder ---------- */
function vPitch(){
  const ps=S.pitch;const opt=(arr,v)=>arr.map(x=>`<option value="${esc(x[0])}"${v===x[0]?" selected":""}>${esc(x[1])}</option>`).join("");
  return crumbs([["Overview",U("home")],["Pitch Builder"]])+`<div class="ph"><div><h1>Pitch Builder</h1><p class="lede">Describe the prospect, review the ranked proof, build a pack you can paste into a proposal, and check the target-industry fit. Projects are ranked by fit, then by strength of proof, with CodingCops work ahead of external references.</p></div></div>
  <ol class="steps"><li class="step"><div class="sn">1</div><div><h2>Describe the prospect</h2><p class="sup">Every field is optional. Leave one blank to ignore it; add keywords to match personas, technologies or features.</p>
  <div class="card pad"><div class="pctrl">
    <div class="field"><label for="p-sector">Sector</label><select id="p-sector" data-act="pitchf" data-k="sector"><option value="">Any sector</option>${opt(SECTORS.map(s=>[s.slug,s.name]),ps.sector)}</select></div>
    <div class="field"><label for="p-uc">Use case</label><select id="p-uc" data-act="pitchf" data-k="uc"><option value="">Any use case</option>${opt(UC_ORDER.map(u=>[u,u]),ps.uc)}</select></div>
    <div class="field"><label for="p-ai">AI type</label><select id="p-ai" data-act="pitchf" data-k="ai"><option value="">Any AI type</option>${opt(AI_ORDER.map(a=>[a,a]),ps.ai)}</select></div>
    <div class="field"><label for="p-q">Keywords (persona, tech, feature)</label><input id="p-q" type="search" placeholder="CFO, Stripe, claims, HIPAA" value="${esc(ps.q)}"></div></div>
    <label class="chk"><input id="p-roi" type="checkbox"${ps.roi?" checked":""}> Measured ROI only (projects with client-measured before and after numbers)</label></div></div></li>
  <li class="step" id="pres-wrap"><div class="sn">2</div><div id="pres">${pitchResults()}</div></li></ol>`;
}
function pitchScore(p){
  const ps=S.pitch;let s=0;const why=[];
  if(ps.sector){if(p.sector===ps.sector){s+=3;why.push("Same sector");}else return null;}
  if(ps.uc){if(p.useCase===ps.uc){s+=3;why.push("Same use case");}else return null;}
  if(ps.ai){if(p.ai===ps.ai){s+=2;why.push(p.ai);}else return null;}
  if(ps.roi&&!p.roi)return null;
  const words=ps.q.toLowerCase().split(/[\s,]+/).filter(w=>w.length>1);
  if(words.length){const hy=[pname(p),p.sub,p.industry,p.useCase,p.tags.join(" "),p.persona.join(" "),p.techs.map(t=>t.n).join(" "),mk(p,p.oneLiner),mk(p,p.solution),p.features.join(" "),aiTxt(p)].join(" ").toLowerCase();
    let hits=0;words.forEach(w=>{if(hy.includes(w)){hits++;why.push(`“${w}”`);}});if(!hits)return null;s+=hits*2;}
  if(p.roi){s+=2;why.push("Measured ROI");}
  if(p.status==="Live / Production"){s+=1;why.push("Live");}
  if(p.conf==="Public")s+=0.5;
  if(p.cc)s+=1;
  return {p,s,why};
}
function pitchResults(){
  const R=P.map(pitchScore).filter(Boolean).sort((a,b)=>b.s-a.s||stRank(a.p)-stRank(b.p));
  const picked=S.picked.filter(id=>byId[id]);
  const packTxt=picked.map(id=>{const p=byId[id];return [`${pname(p)} (${p.sectorName})`,mk(p,p.oneLiner),`Proof: ${mk(p,p.brief.proof)}`,hid(p)?"Key results: available on request":`Key results: ${p.brief.card.map(x=>mk(p,x)).join("; ")}`].join("\n");}).join("\n\n");
  const packI=COPY.push(packTxt)-1;
  const align=picked.length?picked.map(id=>byId[id]):R.slice(0,5).map(r=>r.p);
  const ps=S.pitch,secInd=ps.sector?[...new Set(P.filter(p=>p.sector===ps.sector).map(p=>p.ind7||NOT7))]:[];
  return `<h2>Review recommended projects</h2><p class="sup">${R.length} ${R.length===1?"match":"matches"}, ranked by fit then proof strength. Tick the ones to include in the pack.</p>
  ${R.length?`<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="linkbtn" type="button" data-act="picktop" data-k="${R.slice(0,3).map(r=>r.p.id).join(",")}">Add top 3 to the pack</button></div>
  <div class="pres">${(S.pitchAll||R.length<=10?R:R.slice(0,10)).map((r,k)=>{const p=r.p,on=picked.includes(p.id);return `<article class="pr${on?" on":""}"><span class="rank" aria-label="Rank ${k+1}">${k+1}</span>
    <div><h3><a href="${U("project-"+p.id)}" style="color:inherit;text-decoration:none">${esc(ptitle(p))}</a></h3><div class="meta" style="margin-top:2px">${esc(pclient(p))} · ${esc(p.sectorName)} · ${esc(p.sub)}</div>
    <div class="why">${r.why.map(w=>`<span class="tag t-accent">${esc(w)}</span>`).join("")}${stTag(p)}${p.conf==="Confidential"?'<span class="tag t-red">Confidential</span>':""}${ccPill(p)}</div>
    <div class="body"><div class="blk"><div class="bh"><span class="label">Hook</span>${cpb(mk(p,p.brief.hook))}</div>${T(p,p.brief.hook)}</div>
    <div class="blk"><div class="bh"><span class="label">Proof point</span>${cpb(mk(p,p.brief.proof))}</div>${T(p,p.brief.proof)}</div></div>
    <div class="acts"><label class="chk" style="padding:0"><input type="checkbox" data-act="pick" data-k="${p.id}"${on?" checked":""}> Include in pitch pack</label><a href="${U("project-"+p.id)}" style="font-weight:500;font-size:14.5px">Open project</a></div></div></article>`;}).join("")}</div>${!S.pitchAll&&R.length>10?`<div style="display:flex;justify-content:center;margin-top:14px"><button class="btn ghost" type="button" data-act="pitchall">Show all ${R.length} matches</button></div>`:""}`
  :`<div class="empty"><b>No project fits every criterion.</b><br>Loosen one filter: try “Any use case” or remove a keyword.</div>`}
  <div class="step" style="margin-top:28px"><div class="sn${picked.length?"":" off"}">3</div><div><h2>Build the proof pack</h2><p class="sup">${picked.length?`${plural(picked.length,"project")} selected. Review the generated text, remove any you don't need, then copy the whole pack.`:"Nothing selected yet. Tick projects above or add the top 3."}</p>
    <div class="pack">${picked.map(id=>{const p=byId[id];return `<div class="pk"><span><b style="font-weight:600">${esc(pshort(p))}</b> <span class="muted">· ${esc(p.sectorName)}${p.cc?"":" · External"}${p.conf==="Confidential"?" · Confidential":""}</span></span><button class="linkbtn" type="button" data-act="unpick" data-k="${p.id}">Remove</button></div>`;}).join("")||'<p class="sup">The pack is empty.</p>'}
    ${picked.length?`<pre aria-label="Generated pitch pack">${esc(packTxt)}</pre>`:""}
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn" type="button" data-act="copy" data-i="${packI}"${picked.length?"":" disabled"}>Copy pack</button>${picked.length?`<button class="btn ghost" type="button" data-act="packclear">Clear pack</button>`:""}</div></div></div></div>
  <div class="step" style="margin-top:28px"><div class="sn${align.length?"":" off"}">4</div><div><h2>Review target-industry alignment</h2><p class="sup">Each project maps to one of CodingCops' 7 target industries by the client's actual business. External builds do not count as coverage. ${picked.length?"Showing the pack.":"Showing the top matches until you select a pack."}</p>
    ${ps.sector?`<p class="sup" style="margin-top:-6px">Prospect sector <b>${esc(secBy[ps.sector].name)}</b> maps to: ${secInd.map(esc).join(", ")}.</p>`:""}
    ${align.length?`<div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">Project</th><th scope="col">Actual industry</th><th scope="col">Maps to (the 7)</th><th scope="col">Counts as coverage</th></tr></thead><tbody>${align.map(p=>`<tr><td><a href="${U("project-"+p.id)}" style="font-weight:600;text-decoration:none">${esc(pshort(p))}</a></td><td>${esc(cap(p.actualIndustry))}</td><td>${p.ind7?esc(p.ind7):'<span class="maps none">Not in the 7</span>'}</td><td>${p.ind7&&p.cc?'<span class="cov ok">Yes</span>':p.ind7?'<span class="cov ext">External only</span>':'<span class="cov gap">No</span>'}</td></tr>`).join("")}</tbody></table></div>`:""}</div></div>
  ${picked.length?`<div class="packbar"><span><b>${plural(picked.length,"project")}</b> in the pack: ${picked.map(id=>esc(pshort(byId[id]))).join(", ")}</span><span style="display:flex;gap:8px"><button class="btn ghost sm" type="button" data-act="packclear">Clear</button><button class="btn sm" type="button" data-act="copy" data-i="${packI}">Copy pack</button></span></div>`:""}`;
}
/* ---------- marketing readiness ---------- */
const RB=[["Publish-ready","Public and visuals available.","Produce and publish the case study.",p=>p.conf==="Public"&&p.visuals,"--st-live"],
  ["Needs visuals","Public, no visuals yet.","Get screenshots or a short deck, then publish.",p=>p.conf==="Public"&&!p.visuals,"--st-dev"],
  ["Internal only","Confidential, visuals available.","Use in sales decks; get client sign-off to publish.",p=>p.conf==="Confidential"&&p.visuals,"--accent"],
  ["Not ready","Confidential, no visuals.","Get client sign-off and visuals first.",p=>p.conf==="Confidential"&&!p.visuals,"--red"]];
function vMarketing(){
  const gm={};P.forEach(p=>p.gaps.forEach(g=>{(gm[g]=gm[g]||[]).push(p);}));
  const gaps=Object.entries(gm).sort((a,b)=>b[1].length-a[1].length);
  const groups=RB.map(([h,why,next,f,c],i)=>({h,why,next,c,i,L:P.filter(f).sort((a,b)=>(b.roi-a.roi)||(b.cc-a.cc)||ptitle(a).localeCompare(ptitle(b)))}));
  return crumbs([["Overview",U("home")],["Case study readiness"]])+`<div class="ph"><div><h1>Case study readiness</h1><p class="lede">Which case studies can go out, grouped by confidentiality and visual assets. Readiness reflects the recorded data; it does not imply client approval. Projects with measured ROI are listed first in each group.</p></div></div>
  <div class="rsum">${groups.map(g=>`<button type="button" class="rs" style="--c:var(${g.c})" data-act="jumpid" data-k="rg-${g.i}"><span class="v">${g.L.length}</span><span class="h">${g.h}</span><span class="w">${g.why}</span></button>`).join("")}</div>
  ${groups.map(g=>`<section class="section" id="rg-${g.i}" style="scroll-margin-top:calc(var(--topb) + 16px)"><div class="sh"><div><h2 style="display:flex;align-items:center;gap:10px">${dot(g.c)}${g.h} <span class="muted" style="font-weight:500">· ${g.L.length}</span></h2><p>${g.why} Next action: ${g.next}</p></div></div>
    <div class="rlist">${g.L.map(p=>`<article class="rc"><h4><a href="${U("project-"+p.id)}">${esc(pshort(p))}</a></h4><div class="meta">${esc(p.sectorName)}${p.cc?"":" · External"}</div><div class="tags">${confTag(p)}<span class="tag">${p.visuals?"Visuals: yes":"Visuals: no"}</span>${roiTag(p)}</div><div class="na"><b>Next action</b>${g.next}${p.roi?" Lead with the measured result.":""}</div></article>`).join("")||'<div class="empty">None in this group.</div>'}</div></section>`).join("")}
  <section class="section"><details class="more" open><summary>Data gaps to chase: ${gaps.length} fields, prioritised by how many projects are affected</summary><div><div class="tablewrap"><table class="tbl"><thead><tr><th scope="col" style="width:240px">Field</th><th scope="col" style="width:110px">Projects</th><th scope="col">Which projects</th></tr></thead><tbody>
    ${gaps.map(([g,L])=>`<tr><td><b style="font-weight:600">${esc(g)}</b></td><td class="num">${L.length}</td><td class="plinks">${L.map(p=>`<a href="${U("project-"+p.id)}">${esc(pshort(p))}</a>`).join(", ")}</td></tr>`).join("")}</tbody></table></div></div></details></section>`;
}
/* ---------- compare ---------- */
function vCompare(){
  if(S.Q.c){const ids=S.Q.c.split("|").map(Number);S.cmp=[0,1,2].map(k=>byId[ids[k]]?ids[k]:null);}
  const sel=[0,1,2].map(k=>S.cmp[k]?byId[S.cmp[k]]:null),n=sel.filter(Boolean).length;
  const opts=v=>`<option value="">Choose a project</option>`+SECTORS.map(s=>`<optgroup label="${esc(s.name)}">${P.filter(p=>p.sector===s.slug).map(p=>`<option value="${p.id}"${v===p.id?" selected":""}>${esc(pshort(p))}</option>`).join("")}</optgroup>`).join("");
  const hidden='<span class="muted">Hidden in client-safe mode</span>';
  const G=[["Business context",[["Sector",p=>esc(p.sectorName)],["Sub-industry",p=>esc(p.sub)],["Use case",p=>esc(p.useCase)],["Target industry",p=>esc(p.ind7||NOT7)],["Client",p=>esc(pclient(p))],["Client size",p=>T(p,p.size||"Not disclosed")],["Duration",p=>T(p,p.duration||"Not disclosed")],["Delivered by",p=>esc(p.provider)]]],
    ["Solution & capabilities",[["One-line summary",p=>T(p,p.oneLiner)],["AI type",p=>aiTag(p)],["AI capabilities",p=>p.aiExt?`<b>${T(p,p.aiExt.useCase)}</b><ul style="padding-left:16px;list-style:disc;margin-top:6px;display:flex;flex-direction:column;gap:4px">${p.aiExt.caps.map(c=>`<li>${T(p,c)}</li>`).join("")}</ul>${p.aiExt.delivered?"":'<span class="meta">Planned with the build</span>'}`:'<span class="muted">None recorded</span>'],["Key features",p=>`<b class="num">${p.features.length}</b> features<ul style="padding-left:16px;list-style:disc;margin-top:6px;display:flex;flex-direction:column;gap:4px">${p.features.slice(0,4).map(f=>`<li>${T(p,f)}</li>`).join("")}</ul>${p.features.length>4?`<details><summary>Show all ${p.features.length}</summary><ul>${p.features.slice(4).map(f=>`<li>${T(p,f)}</li>`).join("")}</ul></details>`:""}`]]],
    ["Technology",[["Tech stack",p=>`<div class="tags">${p.techs.map(t=>`<a class="tag" href="${U("tech","t="+encodeURIComponent(t.n))}">${esc(t.n)}</a>`).join("")||'<span class="muted">Not recorded</span>'}</div>`],["Stack as recorded",p=>`<details><summary>Show raw stack</summary><p style="margin-top:6px">${T(p,p.techRaw)}</p></details>`]]],
    ["Results & evidence",[["Status",p=>stTag(p)],["Visibility",p=>confTag(p)+" "+roiTag(p)],["Time to value",p=>T(p,p.ttv||"Not disclosed")],["Improvement",p=>hid(p)?hidden:T(p,p.kpi)],...[0,1,2,3].map(k=>[`Result ${k+1}`,p=>hid(p)?hidden:(T(p,p.metrics[k])||'<span class="gap">Not recorded</span>')]),["Visual assets",p=>T(p,p.visualText)],["Prototype",p=>p.proto?protoBtn(p,"sm"):'<span class="muted">None recorded</span>']]],
    ["Sales relevance",[["Buyer persona",p=>p.persona.map(esc).join("<br>")],["Hook",p=>T(p,p.brief.hook)],["Proof point",p=>T(p,p.brief.proof)],["Campaign tags",p=>`<div class="tags">${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>`]]]];
  const cells=f=>sel.map(p=>`<td>${p?f(p):''}</td>`).join("");
  return crumbs([["Overview",U("home")],["Compare projects"]])+`<div class="ph"><div><h1>Compare projects</h1><p class="lede">Put up to three projects side by side to choose which reference to lead with. The selection is saved in the page link.</p></div>${n?`<div class="acts"><button class="btn ghost sm" type="button" data-act="share">Copy link to this comparison</button></div>`:""}</div>
  <div class="csel">${[0,1,2].map(k=>`<div class="card"><label class="label" for="cmp-${k}">Project ${k+1}</label><select id="cmp-${k}" class="inp" data-act="cmp" data-k="${k}" style="margin-top:6px">${opts(S.cmp[k])}</select>${sel[k]?`<a class="nm" href="${U("project-"+sel[k].id)}">${esc(ptitle(sel[k]))}</a><div class="tags" style="margin-top:8px">${stTag(sel[k])}${flags(sel[k])}</div>`:""}</div>`).join("")}</div>
  ${n?`<div class="tablewrap" style="margin-top:18px"><table class="cmp"><thead><tr><th class="rl" scope="col">Field</th>${sel.map((p,k)=>`<th scope="col" style="text-align:left;padding:12px 14px;font-size:14px;color:var(--muted)">${p?esc(ptitle(p)):"Project "+(k+1)}</th>`).join("")}</tr></thead>
  <tbody>${G.map(([g,rows])=>`<tr class="gh"><th scope="rowgroup" colspan="4">${g}</th></tr>`+rows.map(([l,f])=>`<tr><th class="rl" scope="row">${l}</th>${cells(f)}</tr>`).join("")).join("")}</tbody></table></div>`:`<div class="empty" style="margin-top:18px"><b>Choose at least one project to start the comparison.</b><br>Pick from the dropdowns above; projects are grouped by sector.</div>`}`;
}
function vMissing(){return `<div class="empty" style="margin-top:30px"><b>That page doesn't exist.</b><br><a href="${U("home")}">Back to the overview</a>.</div>`;}

/* ---------- router ---------- */
const app=document.getElementById("app");
let secObs=null,secLock=0;
function render(){
  const h=S.route;COPY=[];RES=null;if(secObs){secObs.disconnect();secObs=null;}
  let html,nav="home";
  if(h==="home")html=vHome();
  else if(h==="industries"){html=vHome();nav="industries";}
  else if(h.startsWith("sector-")){html=vSector(h.slice(7));nav="industries";}
  else if(h.startsWith("project-")){html=vProject(+h.slice(8));nav="projects";}
  else if(h==="projects"){html=vProjects();nav="projects";}
  else if(h==="usecases"){html=vUseCases();nav="usecases";}
  else if(h==="tech"){html=vTech();nav="tech";}
  else if(h==="pitch"){html=vPitch();nav="pitch";}
  else if(h==="marketing"){html=vMarketing();nav="marketing";}
  else if(h==="compare"){html=vCompare();nav="compare";}
  else html=vMissing();
  app.innerHTML=html;
  document.querySelectorAll(".nav a").forEach(a=>{if(a.dataset.nav===nav)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  const t={industries:"Industries",projects:"All projects",usecases:"Use cases",tech:"AI & Technologies",pitch:"Pitch Builder",marketing:"Case study readiness",compare:"Compare projects"};
  let title="CodingCops Portfolio Hub";
  if(h.startsWith("project-")&&byId[+h.slice(8)])title=pshort(byId[+h.slice(8)])+" · "+title;
  else if(h.startsWith("sector-")&&secBy[h.slice(7)])title=secBy[h.slice(7)].name+" · "+title;
  else if(t[nav])title=t[nav]+" · "+title;
  document.title=title;
  hideTip();
  if(h.startsWith("project-"))watchSections();
}
function watchSections(){
  const secs=[...document.querySelectorAll(".psec")],btns=[...document.querySelectorAll(".secnav button")];if(!secs.length||!("IntersectionObserver" in window))return;
  const vis=new Map();
  secObs=new IntersectionObserver(es=>{if(Date.now()<secLock)return;es.forEach(e=>vis.set(e.target.id,e.isIntersecting?e.intersectionRatio:0));
    let best=null,bv=-1;secs.forEach(s=>{const v=vis.get(s.id)||0;if(v>bv){bv=v;best=s.id;}});
    if(best&&bv>0)btns.forEach(b=>b.setAttribute("aria-current",("sec-"+keyOf(b.dataset.k))===best));},{rootMargin:"-30% 0px -55% 0px",threshold:[0,.1,.25,.5,.75,1]});
  secs.forEach(s=>secObs.observe(s));
}
const keyOf=k=>k;
function jumpTo(k,smooth=true){const el=document.getElementById("sec-"+k);if(!el)return;secLock=Date.now()+(smooth?1200:800);el.scrollIntoView({behavior:smooth?"smooth":"auto",block:"start"});document.querySelectorAll(".secnav button").forEach(b=>b.setAttribute("aria-current",b.dataset.k===k));}
function route(scrollTop=true){
  const c=cur();S.route=c.r;S.Q=parseQ(c.q);S.dd=null;S.more=false;
  render();
  if(S.route==="industries"){requestAnimationFrame(()=>{const s=document.getElementById("sectors");if(s)s.scrollIntoView({block:"start"});});}
  else if(S.route.startsWith("project-")&&S.Q.tab&&S.Q.tab!=="overview"){requestAnimationFrame(()=>{jumpTo(S.Q.tab,false);setTimeout(()=>jumpTo(S.Q.tab,false),350);});}
  else if(scrollTop)window.scrollTo({top:0,behavior:"auto"});
  closeSb();
}
const rerender=()=>{const y=window.scrollY;render();window.scrollTo({top:y,behavior:"auto"});};
function refreshRes(){const r=document.getElementById("fres");if(r&&RES){COPY=[];r.innerHTML=RES();}}
if(HUB_MODE!=="site")window.addEventListener("hashchange",()=>route(true));

/* ---------- events ---------- */
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,1800);}
function copyText(txt,msg){
  const done=()=>toast(msg||"Copied to clipboard");
  const fallback=()=>{const ta=document.createElement("textarea");ta.value=txt;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand("copy");}catch(e){}ta.remove();ok?done():toast("Select the text and copy it manually");};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,fallback);}else fallback();
}
let LB={pid:null,i:0,ret:null};
function lbShow(){const G=imgs(byId[LB.pid]);if(!G.length)return;LB.i=(LB.i+G.length)%G.length;const g=G[LB.i];const im=document.getElementById("lbimg");im.src=g.src;im.alt=g.cap;document.getElementById("lbcap").textContent=`${g.cap} · ${LB.i+1} of ${G.length}`;const lb=document.getElementById("lb");lb.hidden=false;lb.querySelector("[data-act=lbclose]").focus();}
function lbClose(){document.getElementById("lb").hidden=true;if(LB.ret&&LB.ret.isConnected)LB.ret.focus();}
const FKEYS=[...Object.keys(DIMS),...Object.keys(TOGS),"q"];
document.addEventListener("click",e=>{
  const el=e.target.closest("[data-act]");
  if(S.dd&&!e.target.closest(".dd")){S.dd=null;if(!el){rerender();return;}}
  if(!el)return;const a=el.dataset.act,k=el.dataset.k;
  if(a==="copy"){e.preventDefault();copyText(COPY[+el.dataset.i]||"");}
  else if(a==="dd"){S.dd=S.dd===k?null:k;rerender();}
  else if(a==="fopt"){const v=el.dataset.v,arr=getArr(k);setArr(k,arr.includes(v)?arr.filter(x=>x!==v):[...arr,v]);syncURL();rerender();}
  else if(a==="fclr"){setArr(k,[]);S.dd=null;syncURL();rerender();}
  else if(a==="ftog"){S.Q[k]=S.Q[k]==="1"?"":"1";syncURL();rerender();}
  else if(a==="more"){S.more=!(el.getAttribute("aria-expanded")==="true");if(!S.more){/* keep open if filters active */}rerender();}
  else if(a==="fx"){if(DIMS[k])setArr(k,getArr(k).filter(x=>x!==el.dataset.v));else S.Q[k]="";syncURL();rerender();toast("Filter removed");}
  else if(a==="fall"){FKEYS.forEach(x=>{S.Q[x]="";});syncURL();rerender();toast("Filters cleared");}
  else if(a==="share"){syncURL();copyText(location.href,"Link copied");}
  else if(a==="fview"){S.Q.view=k==="cards"?"":k;syncURL();rerender();}
  else if(a==="tab"){S.Q.tab=(k==="overview"||k==="projects")?"":k;syncURL();rerender();}
  else if(a==="jump"){e.preventDefault();S.Q.tab=k==="overview"?"":k;syncURL();jumpTo(k);}
  else if(a==="jumpid"){const t=document.getElementById(k);if(t)t.scrollIntoView({behavior:"smooth",block:"start"});}
  else if(a==="indf"){S.Q.indf=k==="all"?"":k;syncURL();rerender();}
  else if(a==="uc"){S.Q.u=(S.Q.u===k?"":k);syncURL();rerender();if(S.Q.u){const t=document.getElementById("ucsel");if(t)t.scrollIntoView({behavior:"smooth",block:"start"});}}
  else if(a==="hv"){S.Q.hv=k==="grid"?"":k;syncURL();rerender();}
  else if(a==="heat"){const v=[el.dataset.s,k];S.heat=(S.heat&&S.heat[0]===v[0]&&S.heat[1]===v[1])?null:v;rerender();if(S.heat){const t=document.getElementById("heatsel");if(t)t.scrollIntoView({behavior:"smooth",block:"start"});}}
  else if(a==="heatclear"){S.heat=null;rerender();}
  else if(a==="tsel"){S.Q.t=(S.Q.t===k?"":k);syncURL();rerender();if(S.Q.t){const t=document.getElementById("techsel");if(t)t.scrollIntoView({behavior:"smooth",block:"start"});}}
  else if(a==="pick"){return;}
  else if(a==="picktop"){(k||"").split(",").filter(Boolean).map(Number).forEach(id=>{if(!S.picked.includes(id))S.picked.push(id);});refreshPitch();toast("Top 3 added to the pack");}
  else if(a==="help"){S.help=!S.help;const h=document.getElementById("hx-helpbox");if(h){h.hidden=!S.help;el.setAttribute("aria-expanded",S.help);}}
  else if(a==="pitchall"){S.pitchAll=true;refreshPitch();}
  else if(a==="unpick"){S.picked=S.picked.filter(x=>x!==+k);refreshPitch();}
  else if(a==="packclear"){S.picked=[];refreshPitch();toast("Pack cleared");}
  else if(a==="gthumb"){const G=imgs(byId[+el.dataset.pid]),i=+el.dataset.i,g=G[i];document.getElementById("gmainimg").src=g.src;document.getElementById("gmainimg").alt=g.cap;document.getElementById("gmaincap").textContent=g.cap;document.getElementById("gmain").dataset.i=i;document.querySelectorAll(".gthumbs button").forEach((b,j)=>b.setAttribute("aria-pressed",j===i));}
  else if(a==="lbopen"){LB={pid:+el.dataset.pid,i:+el.dataset.i,ret:el};lbShow();}
  else if(a==="lbclose"){lbClose();}
  else if(a==="lbprev"){LB.i--;lbShow();}
  else if(a==="lbnext"){LB.i++;lbShow();}
});
document.getElementById("lb").addEventListener("click",e=>{if(e.target.id==="lb")lbClose();});
document.addEventListener("keydown",e=>{const lb=document.getElementById("lb");if(!lb.hidden){if(e.key==="Escape")lbClose();if(e.key==="ArrowRight"){LB.i++;lbShow();}if(e.key==="ArrowLeft"){LB.i--;lbShow();}return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openCmd();return;}
  if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();openCmd();return;}
  if(e.key==="Escape"){if(!document.getElementById("cmd").hidden){closeCmd();return;}if(S.dd){S.dd=null;rerender();}closeSb();}});
function refreshPitch(){const y=window.scrollY;const r=document.getElementById("pres");if(r){COPY=[];r.innerHTML=pitchResults();window.scrollTo({top:y});}}
document.addEventListener("change",e=>{
  const el=e.target;const a=el.dataset&&el.dataset.act;
  if(el.id==="fsort"){S.Q.sort=el.value==="status"?"":el.value;syncURL();refreshRes();}
  else if(a==="pitchf"){S.pitch[el.dataset.k]=el.value;refreshPitch();}
  else if(el.id==="p-roi"){S.pitch.roi=el.checked;refreshPitch();}
  else if(a==="pick"){const id=+el.dataset.k;S.picked=el.checked?[...new Set([...S.picked,id])]:S.picked.filter(x=>x!==id);refreshPitch();}
  else if(a==="cmp"){S.cmp[+el.dataset.k]=el.value?+el.value:null;S.Q.c=S.cmp.map(x=>x||"").join("|");syncURL();rerender();}
});
let fqT=null;
document.addEventListener("input",e=>{
  const el=e.target;
  if(el.id==="fq"){S.Q.q=el.value;clearTimeout(fqT);fqT=setTimeout(syncURL,250);refreshRes();}
  else if(el.id==="p-q"){S.pitch.q=el.value;refreshPitch();}
  else if(el.id==="techq"){S.techq=el.value;const t=document.getElementById("techidx");if(t)t.innerHTML=techIndex();}
});
/* tooltip */
const tip=document.getElementById("tip");
function hideTip(){tip.hidden=true;}
function placeTip(x,y){tip.style.left=Math.max(8,Math.min(x+14,innerWidth-tip.offsetWidth-8))+"px";tip.style.top=Math.min(y+18,innerHeight-tip.offsetHeight-8)+"px";}
document.addEventListener("mouseover",e=>{const t=e.target.closest("[data-tip]");if(!t){hideTip();return;}tip.textContent=t.dataset.tip;tip.hidden=false;placeTip(e.clientX,e.clientY);});
document.addEventListener("mousemove",e=>{if(!tip.hidden)placeTip(e.clientX,e.clientY);});
window.addEventListener("scroll",hideTip,{passive:true});
/* ---------- command search ---------- */
const cmd=document.getElementById("cmd"),gs=document.getElementById("gsearch"),gr=document.getElementById("gresults");let gsel=0,gitems=[],cmdRet=null;
function openCmd(){cmdRet=document.activeElement;cmd.hidden=false;gs.value="";gsearch("");gs.focus();}
function closeCmd(){cmd.hidden=true;if(cmdRet&&cmdRet.focus)cmdRet.focus();}
function gsearch(q){q=q.trim().toLowerCase();
  if(q.length<2){gr.innerHTML=`<div class="gnone">Type at least two characters. Results cover project names, clients, sectors, technologies, tags and project stories.</div>`;gitems=[];return;}
  gitems=P.map(p=>{let s=0,why="";const nm=pname(p).toLowerCase(),cl=pclient(p).toLowerCase();
    if(nm.includes(q)){s+=5;why="Project name";}if(cl.includes(q)){s+=4;why=why||"Client";}
    if(p.sub.toLowerCase().includes(q)||p.sectorName.toLowerCase().includes(q)){s+=3;why=why||"Sector";}
    const t=p.techs.find(t=>t.n.toLowerCase().includes(q));if(t){s+=3;why=why||`Tech: ${t.n}`;}
    const tg=p.tags.find(t=>t.toLowerCase().includes(q));if(tg){s+=2;why=why||`Tag: ${tg}`;}
    if(!s&&mk(p,p.oneLiner+" "+p.solution).toLowerCase().includes(q)){s+=1;why="Mentioned in story";}
    return {p,s,why};}).filter(r=>r.s).sort((a,b)=>b.s-a.s).slice(0,8);
  const secs=SECTORS.filter(s=>s.name.toLowerCase().includes(q)||s.desc.toLowerCase().includes(q)).slice(0,3);
  gsel=0;
  gr.innerHTML=(secs.length?`<div class="gh">Industries</div>${secs.map(s=>`<a href="${U("sector-"+s.slug)}"><b style="font-weight:600">${esc(s.name)}</b><div class="gm">${plural(P.filter(p=>p.sector===s.slug).length,"project")} · ${esc(s.desc)}</div></a>`).join("")}`:"")
    +(gitems.length?`<div class="gh">Projects</div>${gitems.map(r=>`<a href="${U("project-"+r.p.id)}"><b style="font-weight:600">${esc(ptitle(r.p))}</b><div class="gm">${esc(r.p.sectorName)} · ${esc(r.p.useCase)} · matched on ${esc(r.why)}</div></a>`).join("")}`:(secs.length?"":`<div class="gnone">No matches for “${esc(q)}”. Try a client name, a technology (for example “Kafka”) or a sector.</div>`))
    +`<a href="${U("projects","q="+encodeURIComponent(q))}" class="gfoot">Show all results in All projects →</a>`;
  const links=[...gr.querySelectorAll("a")];links.forEach((l,i)=>l.classList.toggle("on",i===0));
}
gs.addEventListener("input",()=>gsearch(gs.value));
gs.addEventListener("keydown",e=>{const links=[...gr.querySelectorAll("a")];if(!links.length)return;
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();gsel=(gsel+(e.key==="ArrowDown"?1:-1)+links.length)%links.length;links.forEach((l,i)=>l.classList.toggle("on",i===gsel));links[gsel].scrollIntoView({block:"nearest"});}
  else if(e.key==="Enter"&&links[gsel]){e.preventDefault();closeCmd();location.href=links[gsel].href;}});
gr.addEventListener("click",e=>{if(e.target.closest("a"))closeCmd();});
cmd.addEventListener("click",e=>{if(e.target===cmd)closeCmd();});
document.getElementById("cmdopen").addEventListener("click",openCmd);
document.getElementById("cmdopen2").addEventListener("click",openCmd);
/* ---------- sidebar ---------- */
const sbEl=document.getElementById("sb"),sbOv=document.getElementById("sbov");
function openSb(){sbEl.classList.add("open");sbOv.hidden=false;document.getElementById("sbclose").hidden=false;}
function closeSb(){sbEl.classList.remove("open");sbOv.hidden=true;document.getElementById("sbclose").hidden=true;}
document.getElementById("sbopen").addEventListener("click",openSb);
document.getElementById("sbclose").addEventListener("click",closeSb);
sbOv.addEventListener("click",closeSb);
(function(){const r=document.documentElement;let v=null;try{v=localStorage.getItem("cc-hub-sb");}catch(e){}if(v==="min")r.setAttribute("data-sb","min");
  document.getElementById("sbmin").addEventListener("click",()=>{const min=r.getAttribute("data-sb")==="min";if(min)r.removeAttribute("data-sb");else r.setAttribute("data-sb","min");try{localStorage.setItem("cc-hub-sb",min?"full":"min");}catch(e){}});})();
/* safe mode + theme */
const safeBtn=document.getElementById("safe"),safeBar=document.getElementById("safebar");
function applySafe(){safeBtn.setAttribute("aria-pressed",S.safe);safeBar.hidden=!S.safe;}
safeBtn.addEventListener("click",()=>{S.safe=!S.safe;try{localStorage.setItem("cc-hub-safe",S.safe?"1":"0");}catch(e){}applySafe();rerender();toast(S.safe?"Client-safe mode on":"Client-safe mode off");});
(function(){const r=document.documentElement;let t=null;try{t=localStorage.getItem("cc-hub-theme");}catch(e){}if(t)r.setAttribute("data-theme",t);
  document.getElementById("theme").addEventListener("click",()=>{const c=r.getAttribute("data-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");const nx=c==="dark"?"light":"dark";r.setAttribute("data-theme",nx);try{localStorage.setItem("cc-hub-theme",nx);}catch(e){}toast(nx==="dark"?"Dark theme":"Light theme");});})();
if(HUB_MODE==="site"){document.querySelectorAll(".nav a").forEach(a=>a.href=U(a.dataset.nav));document.querySelectorAll(".logo").forEach(lg=>lg.href=U("home"));
  window.addEventListener("hashchange",()=>route(false));}
applySafe();route(false);
