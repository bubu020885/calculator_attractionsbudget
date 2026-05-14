'use strict';

const BUNDESLAENDER = {
  'BW': 'Baden-Württemberg', 'BY': 'Bayern', 'BE': 'Berlin',
  'BB': 'Brandenburg', 'HB': 'Bremen', 'HH': 'Hamburg',
  'HE': 'Hessen', 'MV': 'Mecklenburg-Vorpommern', 'NI': 'Niedersachsen',
  'NW': 'Nordrhein-Westfalen', 'RP': 'Rheinland-Pfalz', 'SL': 'Saarland',
  'SN': 'Sachsen', 'ST': 'Sachsen-Anhalt', 'SH': 'Schleswig-Holstein',
  'TH': 'Thüringen'
};

const OCCUPANCY_OPTIONS = [
  { value: 'Close',  label: 'Close',  percent: 0   },
  { value: 'Off',    label: 'Off',    percent: 0   },
  { value: 'Low',    label: 'Low',    percent: 25  },
  { value: 'Medium', label: 'Medium', percent: 50  },
  { value: 'High',   label: 'High',   percent: 75  },
  { value: 'Peak',   label: 'Peak',   percent: 100 }
];

const UPGRADE_ORDER = ['Off', 'Low', 'Medium', 'High', 'Peak'];
const WEEKDAYS_DE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const TPL_DAYS = [
  { label: 'Mo', dow: 1, def: 'Off',    defF: 'Low' },
  { label: 'Di', dow: 2, def: 'Off',    defF: 'Low' },
  { label: 'Mi', dow: 3, def: 'Off',    defF: 'Low' },
  { label: 'Do', dow: 4, def: 'Off',    defF: 'Low' },
  { label: 'Fr', dow: 5, def: 'Low',    defF: 'Medium' },
  { label: 'Sa', dow: 6, def: 'Medium', defF: 'High' },
  { label: 'So', dow: 0, def: 'Medium', defF: 'High' }
];

/* helpers */
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function fmtISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtDE(d){return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();}
function parseDate(s){if(!s)return null;var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function occPct(v){var o=OCCUPANCY_OPTIONS.find(function(x){return x.value===v;});return o?o.percent:0;}

/* Easter */
function easter(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da);}
function bbt(y){var n=new Date(y,10,23),w=n.getDay();if(w===3)return addDays(n,-7);if(w>3)return addDays(n,-(w-3));return addDays(n,-(w+4));}

function getHolidays(y,st){
  var e=easter(y),gf=addDays(e,-2),em=addDays(e,1),asc=addDays(e,39),pm=addDays(e,50),cc=addDays(e,60);
  var m={},a=function(d,n){var k=fmtISO(d);m[k]=m[k]?m[k]+', '+n:n;};
  a(new Date(y,0,1),'Neujahr');a(gf,'Karfreitag');a(em,'Ostermontag');
  a(new Date(y,4,1),'Tag der Arbeit');a(asc,'Christi Himmelfahrt');
  a(pm,'Pfingstmontag');a(new Date(y,9,3),'Tag der Dt. Einheit');
  a(new Date(y,11,25),'1. Weihnachtstag');a(new Date(y,11,26),'2. Weihnachtstag');
  if(['BW','BY','ST'].indexOf(st)>=0)a(new Date(y,0,6),'Hl. Drei Könige');
  if(st==='BE'&&y>=2019)a(new Date(y,2,8),'Int. Frauentag');
  if(st==='MV'&&y>=2023)a(new Date(y,2,8),'Int. Frauentag');
  if(['BW','BY','HE','NW','RP','SL'].indexOf(st)>=0)a(cc,'Fronleichnam');
  if(st==='SL')a(new Date(y,7,15),'Mariä Himmelfahrt');
  if(st==='TH'&&y>=2019)a(new Date(y,8,20),'Weltkindertag');
  if(['BB','HB','HH','MV','NI','SN','ST','SH','TH'].indexOf(st)>=0)a(new Date(y,9,31),'Reformationstag');
  if(['BW','BY','NW','RP','SL'].indexOf(st)>=0)a(new Date(y,10,1),'Allerheiligen');
  if(st==='SN')a(bbt(y),'Buß- und Bettag');
  return m;
}

/* school holidays */
async function fetchSchool(y,sc){
  var sub='DE-'+sc;
  var u1='https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&languageIsoCode=DE&validFrom='+y+'-01-01&validTo='+y+'-12-31&subdivisionCode='+sub;
  try{var r=await fetch(u1,{headers:{'Accept':'application/json'}});if(r.ok)return{src:'oh',data:await r.json()};}catch(e){}
  var u2='https://ferien-api.de/api/v1/holidays/'+sc+'/'+y;
  try{var r2=await fetch(u2);if(r2.ok)return{src:'fa',data:await r2.json()};}catch(e){}
  return null;
}
function buildSchoolMap(res){
  var map={};if(!res||!Array.isArray(res.data))return map;
  res.data.forEach(function(h){
    var nm='Schulferien',s,e;
    if(res.src==='oh'){
      if(Array.isArray(h.name)){var de=h.name.find(function(n){return n.language==='DE';});if(de&&de.text)nm=de.text;}
      s=parseDate(h.startDate);e=parseDate(h.endDate);if(!s||!e)return;
      for(var d=new Date(s);d<=e;d.setDate(d.getDate()+1)){var k=fmtISO(d);map[k]=map[k]?map[k]+', '+nm:nm;}
    }else{
      nm=(h.name||'').replace(/\d{4}.*$/,'').trim();nm=nm.charAt(0).toUpperCase()+nm.slice(1);
      s=new Date(h.start);e=new Date(h.end);s.setHours(0,0,0,0);e.setHours(0,0,0,0);
      for(var d2=new Date(s);d2<e;d2.setDate(d2.getDate()+1)){var k2=fmtISO(d2);map[k2]=map[k2]?map[k2]+', '+nm:nm;}
    }
  });
  return map;
}

/* upgrade */
function upgrade(cur,steps){
  if(cur==='Close')return'Close';
  var i=UPGRADE_ORDER.indexOf(cur);if(i<0)return cur;
  return UPGRADE_ORDER[Math.min(UPGRADE_ORDER.length-1,i+steps)];
}

/* compute occupancy: uses ferien template if school holiday, else normal template */
function computeOcc(row,tpl,tplF,sS,sE){
  if(sS&&row.date<sS)return'Off';
  if(sE&&row.date>sE)return'Off';
  var dow=row.date.getDay(),ti=dow===0?6:dow-1;
  var isSchool=!!row.schoolHolidayName;
  var level=isSchool?tplF[ti]:tpl[ti];
  if(row.publicHolidayName)level=upgrade(level,2);
  return level;
}

/* state */
var S={year:null,sc:null,maxV:0,tpl:[],tplF:[],sS:null,sE:null,rows:[],
  rev:{adultPrice:0,adultVat:19,childPrice:0,childVat:19,reducedPrice:0,reducedVat:19,retail:0,fb:0,machines:0}};
function calcV(r){return Math.round(S.maxV*occPct(r.occ)/100);}
function fmtEUR(v){return v.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';}
function avgNetTicket(){
  var r=S.rev;
  var nA=r.adultPrice/(1+r.adultVat/100);
  var nK=r.childPrice/(1+r.childVat/100);
  var nE=r.reducedPrice/(1+r.reducedVat/100);
  return(nA+nK+nE)/3;
}
function calcDayRev(vis){
  var a=avgNetTicket();
  var t=vis*a,re=vis*S.rev.retail,fb=vis*S.rev.fb,ma=vis*S.rev.machines;
  return{ticketing:t,retail:re,fb:fb,machines:ma,total:t+re+fb+ma};
}
function readRevForm(){
  S.rev.adultPrice=parseFloat(document.getElementById('ticketAdult').value)||0;
  S.rev.adultVat=parseInt(document.getElementById('vatAdult').value,10)||0;
  S.rev.childPrice=parseFloat(document.getElementById('ticketChild').value)||0;
  S.rev.childVat=parseInt(document.getElementById('vatChild').value,10)||0;
  S.rev.reducedPrice=parseFloat(document.getElementById('ticketReduced').value)||0;
  S.rev.reducedVat=parseInt(document.getElementById('vatReduced').value,10)||0;
  S.rev.retail=parseFloat(document.getElementById('revenueRetail').value)||0;
  S.rev.fb=parseFloat(document.getElementById('revenueFB').value)||0;
  S.rev.machines=parseFloat(document.getElementById('revenueMachines').value)||0;
  var el=document.getElementById('avgNetTicket');if(el)el.textContent=fmtEUR(avgNetTicket());
}

/* info messages */
function setInfo(kind,msg){
  var el=document.getElementById('infoMsg');
  el.className='info-msg';
  if(!msg){el.textContent='';return;}
  if(kind)el.classList.add(kind);
  el.textContent=msg;
  try{el.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){}
}
function clearInfo(){setInfo('','');}

/* show or hide the save-project button depending on whether a table exists */
function updateSaveVisibility(){
  var b=document.getElementById('saveProjectBtn');if(!b)return;
  var has=S.rows&&S.rows.length;
  if(has)b.classList.remove('hidden');else b.classList.add('hidden');
  var ra=document.getElementById('reapplyTemplateBtn');if(ra){if(has)ra.classList.remove('hidden');else ra.classList.add('hidden');}
  var rb=document.getElementById('resetBtn');if(rb){if(has)rb.classList.remove('hidden');else rb.classList.add('hidden');}
}

/* generate */
async function generate(){
  clearInfo();
  var y=parseInt(document.getElementById('year').value,10);
  var sc=document.getElementById('state').value;
  var mv=parseInt(document.getElementById('maxVisitors').value,10)||0;
  var missing=[];
  if(!sc)missing.push('Bundesland');
  if(!mv||mv<=0)missing.push('Max. Besucher pro Tag (> 0)');
  if(!y)missing.push('Kalenderjahr');
  if(missing.length){setInfo('error','Bitte ausfüllen: '+missing.join(', ')+'.');return;}
  var tpl=[],tplF=[];
  for(var i=0;i<7;i++){tpl.push(document.getElementById('tpl-'+i).value);tplF.push(document.getElementById('tplF-'+i).value);}
  var sS=parseDate(document.getElementById('seasonStart').value);
  var sE=parseDate(document.getElementById('seasonEnd').value);
  var btn=document.getElementById('generateBtn');btn.disabled=true;btn.textContent='Lade…';
  try{
    var ph=getHolidays(y,sc);
    var sr=await fetchSchool(y,sc);
    var sm=buildSchoolMap(sr);
    if(!sr)setInfo('warning','Hinweis: Schulferien konnten nicht geladen werden. Die Tabelle funktioniert ohne Ferien-Informationen weiter.');
    var rows=[];
    for(var d=new Date(y,0,1);d<new Date(y+1,0,1);d.setDate(d.getDate()+1)){
      var iso=fmtISO(d),dt=new Date(d);
      var row={date:dt,ph:ph[iso]||'',sh:sm[iso]||'',occ:'Off',notes:''};
      row.occ=computeOcc({date:dt,publicHolidayName:row.ph,schoolHolidayName:row.sh},tpl,tplF,sS,sE);
      rows.push(row);
    }
    S.year=y;S.sc=sc;S.maxV=mv;S.tpl=tpl;S.tplF=tplF;S.sS=sS;S.sE=sE;S.rows=rows;
    readRevForm();loadRows();saveGlobal();renderTable();renderSummary();
    document.getElementById('results').classList.remove('hidden');
    updateSaveVisibility();
    document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){console.error(e);setInfo('error','Fehler: '+e.message);}
  finally{btn.disabled=false;btn.textContent='Berechne Jahresbudget';}
}

/* render table */
function renderTable(){
  var tb=document.querySelector('#dayTable tbody');tb.innerHTML='';
  var ms=Array(12).fill(0),mr=Array(12).fill(0);
  S.rows.forEach(function(r){var v=calcV(r);ms[r.date.getMonth()]+=v;mr[r.date.getMonth()]+=calcDayRev(v).total;});
  var cm=-1;
  S.rows.forEach(function(row,idx){
    if(row.date.getMonth()!==cm){
      cm=row.date.getMonth();
      var mtr=document.createElement('tr');mtr.className='month-header';
      var mtd=document.createElement('td');mtd.colSpan=7;
      mtd.innerHTML=MONTHS_DE[cm]+' '+S.year+'<span class="month-subtotal">Besucher: '+ms[cm].toLocaleString('de-DE')+' &middot; Umsatz: '+fmtEUR(mr[cm])+'</span>';
      mtr.appendChild(mtd);tb.appendChild(mtr);
    }
    var tr=document.createElement('tr');tr.dataset.index=idx;
    var dow=row.date.getDay();
    var offS=(S.sS&&row.date<S.sS)||(S.sE&&row.date>S.sE);
    if(offS)tr.classList.add('off-season');
    else if(row.ph)tr.classList.add('holiday');
    else if(row.sh)tr.classList.add('school-holiday');
    if(dow===0||dow===6)tr.classList.add('weekend');

    var td=document.createElement('td');td.textContent=fmtDE(row.date);tr.appendChild(td);
    td=document.createElement('td');td.textContent=WEEKDAYS_DE[dow];tr.appendChild(td);

    td=document.createElement('td');td.className='holiday-cell';
    var parts=[];
    if(row.ph)parts.push('<span class="ph">'+row.ph+'</span>');
    if(row.sh)parts.push('<span class="sh">Ferien: '+row.sh+'</span>');
    td.innerHTML=parts.join('<br>');tr.appendChild(td);

    var tdO=document.createElement('td');
    var sel=document.createElement('select');sel.className='occupancy-select';sel.dataset.occ=row.occ;
    OCCUPANCY_OPTIONS.forEach(function(o){var op=document.createElement('option');op.value=o.value;op.textContent=o.label+' ('+o.percent+'%)';sel.appendChild(op);});
    sel.value=row.occ;
    var vis=calcV(row);
    var tdV=document.createElement('td');tdV.className='visitors-cell';tdV.textContent=vis.toLocaleString('de-DE');
    var tdR=document.createElement('td');tdR.className='revenue-cell';tdR.textContent=fmtEUR(calcDayRev(vis).total);
    sel.addEventListener('change',function(e){
      row.occ=e.target.value;sel.dataset.occ=row.occ;
      var v2=calcV(row);tdV.textContent=v2.toLocaleString('de-DE');tdR.textContent=fmtEUR(calcDayRev(v2).total);
      saveRows();renderSummary();updMH();
    });
    tdO.appendChild(sel);tr.appendChild(tdO);
    tr.appendChild(tdV);
    tr.appendChild(tdR);

    td=document.createElement('td');
    var ni=document.createElement('input');ni.type='text';ni.className='note-input';ni.value=row.notes;ni.placeholder='z. B. Event…';
    ni.addEventListener('input',function(e){row.notes=e.target.value;saveRows();});
    td.appendChild(ni);tr.appendChild(td);
    tb.appendChild(tr);
  });
}

function updVC(){
  document.querySelectorAll('#dayTable tbody tr[data-index]').forEach(function(tr){
    var i=parseInt(tr.dataset.index,10),v=calcV(S.rows[i]);
    var c=tr.querySelector('.visitors-cell');if(c)c.textContent=v.toLocaleString('de-DE');
    var rc=tr.querySelector('.revenue-cell');if(rc)rc.textContent=fmtEUR(calcDayRev(v).total);
  });
  updMH();
}
function updMH(){
  var ms=Array(12).fill(0),mr=Array(12).fill(0);
  S.rows.forEach(function(r){var v=calcV(r);ms[r.date.getMonth()]+=v;mr[r.date.getMonth()]+=calcDayRev(v).total;});
  document.querySelectorAll('#dayTable tbody tr.month-header td').forEach(function(td,i){
    td.innerHTML=MONTHS_DE[i]+' '+S.year+'<span class="month-subtotal">Besucher: '+ms[i].toLocaleString('de-DE')+' &middot; Umsatz: '+fmtEUR(mr[i])+'</span>';
  });
}

function renderSummary(){
  var yt=0;S.rows.forEach(function(r){yt+=calcV(r);});
  document.getElementById('yearTotal').textContent=yt.toLocaleString('de-DE');
  var open=S.rows.filter(function(r){return occPct(r.occ)>0;}).length;
  document.getElementById('avgPerDay').textContent=(open>0?Math.round(yt/open):0).toLocaleString('de-DE');
  document.getElementById('avgPerMonth').textContent=Math.round(yt/12).toLocaleString('de-DE');

  /* season days */
  var sDays=0;
  if(S.sS||S.sE){
    S.rows.forEach(function(r){
      var after=!S.sS||r.date>=S.sS;
      var before=!S.sE||r.date<=S.sE;
      if(after&&before)sDays++;
    });
  }else{sDays=S.rows.length;}
  document.getElementById('seasonDays').textContent=sDays.toLocaleString('de-DE');

  /* revenue totals */
  var revT={ticketing:0,retail:0,fb:0,machines:0,total:0};
  S.rows.forEach(function(r){var rv=calcDayRev(calcV(r));revT.ticketing+=rv.ticketing;revT.retail+=rv.retail;revT.fb+=rv.fb;revT.machines+=rv.machines;revT.total+=rv.total;});
  var ryt=document.getElementById('revYearTotal');if(ryt)ryt.textContent=fmtEUR(revT.total);
  var rt1=document.getElementById('revTicketing');if(rt1)rt1.textContent=fmtEUR(revT.ticketing);
  var rt2=document.getElementById('revRetail');if(rt2)rt2.textContent=fmtEUR(revT.retail);
  var rt3=document.getElementById('revFB');if(rt3)rt3.textContent=fmtEUR(revT.fb);
  var rt4=document.getElementById('revMachines');if(rt4)rt4.textContent=fmtEUR(revT.machines);

  /* monthly with revenue */
  var monthly=Array(12).fill(0),mRev=[];
  for(var mi=0;mi<12;mi++)mRev.push({ticketing:0,retail:0,fb:0,machines:0,total:0});
  S.rows.forEach(function(r){var v=calcV(r),m=r.date.getMonth();monthly[m]+=v;var rv=calcDayRev(v);mRev[m].ticketing+=rv.ticketing;mRev[m].retail+=rv.retail;mRev[m].fb+=rv.fb;mRev[m].machines+=rv.machines;mRev[m].total+=rv.total;});

  /* open days per month for staff cost allocation */
  var mOpenDays=Array(12).fill(0);
  S.rows.forEach(function(r){if(occPct(r.occ)>0)mOpenDays[r.date.getMonth()]++;});
  var staffDay=staffTotalDaily();

  var mg=document.getElementById('monthlyGrid');mg.innerHTML='';
  for(var i=0;i<12;i++){
    var staffMonth=staffDay*mOpenDays[i];
    var ergebnis=mRev[i].total-staffMonth;
    var hasStaff=staffDay>0;
    var isClosed=(monthly[i]===0);
    var d=document.createElement('div');d.className='monthly-item'+(isClosed?' monthly-item-closed':'');
    d.innerHTML='<div class="month-header"><span class="month-name">'+MONTHS_DE[i]+'</span></div>'
      +'<div class="month-line"><span class="ml-label">Besucher</span><span class="ml-val">'+monthly[i].toLocaleString('de-DE')+'</span></div>'
      +'<div class="month-line"><span class="ml-label">Ticketing</span><span class="ml-val">'+fmtEUR(mRev[i].ticketing)+'</span></div>'
      +'<div class="month-line"><span class="ml-label">Retail</span><span class="ml-val">'+fmtEUR(mRev[i].retail)+'</span></div>'
      +'<div class="month-line"><span class="ml-label">F&amp;B</span><span class="ml-val">'+fmtEUR(mRev[i].fb)+'</span></div>'
      +'<div class="month-line"><span class="ml-label">Machines</span><span class="ml-val">'+fmtEUR(mRev[i].machines)+'</span></div>'
      +'<div class="month-line month-line-umsatz"><span class="ml-label">Umsatz</span><span class="ml-val">'+fmtEUR(mRev[i].total)+'</span></div>'
      +(hasStaff
        ?'<div class="month-line month-line-personal"><span class="ml-label">Personalkosten</span><span class="ml-val">−'+fmtEUR(staffMonth)+'</span></div>'
         +'<div class="month-line month-line-ergebnis"><span class="ml-label">Ergebnis</span><span class="ml-val '+(ergebnis<0?'ml-val-neg':'')+'">'+(ergebnis<0?'−':'')+fmtEUR(Math.abs(ergebnis))+'</span></div>'
        :'');
    mg.appendChild(d);
  }


  /* Tage nach Auslastung – coloured chips above summary */
  var counts={};OCCUPANCY_OPTIONS.forEach(function(o){counts[o.value]=0;});
  S.rows.forEach(function(r){counts[r.occ]=(counts[r.occ]||0)+1;});
  var ob=document.getElementById('occBar');
  if(ob){
    var occDef=[
      {val:'Close',label:'Geschlossen',pct:0,  color:'var(--close)'},
      {val:'Off',  label:'Off',        pct:0,  color:'var(--off)'},
      {val:'Low',  label:'Low',        pct:25, color:'var(--low)'},
      {val:'Medium',label:'Medium',    pct:50, color:'var(--medium)'},
      {val:'High', label:'High',       pct:75, color:'var(--high)'},
      {val:'Peak', label:'Peak',       pct:100,color:'var(--peak)'}
    ];
    ob.innerHTML='<span class="occ-bar-title">Tage nach Auslastung</span>'
      +occDef.map(function(o){
        return '<div class="occ-chip">'
          +'<span class="occ-dot" style="background:'+o.color+'"></span>'
          +'<span class="occ-chip-label">'+o.label
          +(o.pct>0?' · '+o.pct+'%':'')+' </span>'
          +'<span class="occ-chip-count">'+counts[o.val]+'</span>'
          +'</div>';
      }).join('')
      +'<div class="occ-chip occ-chip-season">'
      +'<span class="occ-chip-label">Saisontage</span>'
      +'<span class="occ-chip-count">'+sDays+'</span>'
      +'</div>';
  }

  /* Personalkosten + Jahresergebnis bar */
  var staffDay=staffTotalDaily();
  var syb=document.getElementById('staffYearBar');
  if(syb){
    if(staffDay>0){
      var totalOpenDays=S.rows.filter(function(r){return occPct(r.occ)>0;}).length;
      var staffYear=staffDay*totalOpenDays;
      var ergebnisYear=revT.total-staffYear;
      syb.style.display='';
      syb.innerHTML=''
        +'<div class="summary-card staff-year-card">'
          +'<div class="label">Jahrespersonalkosten</div>'
          +'<div class="value">'+fmtEUR(staffYear)+'</div>'
        +'</div>'
        +'<div class="summary-card staff-year-result '+(ergebnisYear<0?'staff-year-neg':'staff-year-pos')+'">'
          +'<div class="label">Jahresergebnis</div>'
          +'<div class="value">'+(ergebnisYear<0?'−':'')+fmtEUR(Math.abs(ergebnisYear))+'</div>'
        +'</div>';
    }else{
      syb.style.display='none';
    }
  }

  /* Chart */
  var mStaff=mOpenDays.map(function(d){return staffDay*d;});
  renderMonthChart(monthly,mRev,mStaff);
}


/* ---- Monthly chart ---- */
function renderMonthChart(monthly, mRev, mStaff) {
  var canvas = document.getElementById('monthChart');
  var wrap   = document.getElementById('chartWrap');
  if (!canvas || !wrap) return;

  var visible = document.getElementById('chartVisible');
  if (visible && !visible.checked) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';

  var dpr = window.devicePixelRatio || 1;
  var W   = canvas.parentElement.clientWidth || 800;
  var H   = 300;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var padL = 68, padR = 80, padT = 22, padB = 48;
  var cW = W - padL - padR, cH = H - padT - padB;

  var maxV = Math.max.apply(null, monthly.concat([1]));
  var revData  = mRev.map(function(r){return r.total;});
  var hasStaff = mStaff && mStaff.some(function(v){return v>0;});
  var ergData  = hasStaff ? mRev.map(function(r,i){return r.total-mStaff[i];}) : [];
  var maxR = Math.max.apply(null, revData.concat(ergData).concat([1]));

  var C = { bar:'#6b8cff', line:'#0e7490', erg:'#10b981', ergNeg:'#ef4444',
            grid:'#e5e7eb', text:'#6b7280', axis:'#374151' };

  /* background */
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H);

  /* grid lines + left y-labels (visitors) */
  ctx.font = '11px -apple-system,BlinkMacSystemFont,sans-serif';
  var gridN = 5;
  for (var g = 0; g <= gridN; g++) {
    var gy = padT + (g / gridN) * cH;
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + cW, gy); ctx.stroke();
    var vLabel = Math.round(maxV * (1 - g / gridN));
    ctx.fillStyle = C.axis; ctx.textAlign = 'right';
    ctx.fillText(vLabel.toLocaleString('de-DE'), padL - 6, gy + 4);
  }

  /* bars – visitors */
  var step = cW / 12;
  var bW   = step * 0.52;
  monthly.forEach(function(v, i) {
    var x = padL + i * step + (step - bW) / 2;
    var h = cH * (v / maxV);
    ctx.fillStyle = C.bar; ctx.globalAlpha = 0.72;
    ctx.fillRect(x, padT + cH - h, bW, h);
    ctx.globalAlpha = 1;
  });

  /* line helper */
  function drawLine(data, maxVal, strokeCol) {
    ctx.strokeStyle = strokeCol; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach(function(v, i) {
      var x = padL + i * step + step / 2;
      var y = padT + cH * (1 - Math.max(0, v) / maxVal);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    /* dots */
    data.forEach(function(v, i) {
      var col = (strokeCol === C.erg && v < 0) ? C.ergNeg : strokeCol;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(padL + i * step + step / 2, padT + cH * (1 - Math.max(0, v) / maxVal), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawLine(revData, maxR, C.line);
  if (hasStaff) drawLine(ergData, maxR, C.erg);

  /* right y-axis labels (revenue) */
  for (var g2 = 0; g2 <= gridN; g2++) {
    var gy2 = padT + (g2 / gridN) * cH;
    var rVal = maxR * (1 - g2 / gridN);
    var rStr = rVal >= 1e6 ? (rVal/1e6).toFixed(1).replace('.',',')+' Mio €'
             : rVal >= 1e3 ? (rVal/1e3).toFixed(0).replace('.',',')+' T€'
             : fmtEUR(rVal);
    ctx.fillStyle = C.axis; ctx.textAlign = 'left';
    ctx.fillText(rStr, padL + cW + 6, gy2 + 4);
  }

  /* x-axis month labels */
  var mShort = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  ctx.fillStyle = C.text; ctx.textAlign = 'center';
  mShort.forEach(function(m, i) {
    ctx.fillText(m, padL + i * step + step / 2, H - padB + 16);
  });

  /* axis lines */
  ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + cH); ctx.lineTo(padL + cW, padT + cH); ctx.stroke();

  /* legend */
  var legY = H - 10;
  ctx.font = '11px -apple-system,BlinkMacSystemFont,sans-serif';
  function legItem(x, fillCol, alpha, label, isLine) {
    if (isLine) {
      ctx.strokeStyle = fillCol; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x, legY - 5); ctx.lineTo(x + 18, legY - 5); ctx.stroke();
      ctx.fillStyle = fillCol; ctx.beginPath(); ctx.arc(x + 9, legY - 5, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.globalAlpha = alpha; ctx.fillStyle = fillCol;
      ctx.fillRect(x, legY - 10, 18, 10); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = C.axis; ctx.textAlign = 'left';
    ctx.fillText(label, x + 22, legY);
    return x + 22 + ctx.measureText(label).width + 18;
  }
  var lx = padL;
  lx = legItem(lx, C.bar, 0.72, 'Besucher', false);
  lx = legItem(lx, C.line, 1, 'Umsatz', true);
  if (hasStaff) legItem(lx, C.erg, 1, 'Ergebnis', true);
}

/* reapply / reset */
function reapply(){
  if(!S.rows.length)return;
  if(!confirm('Musterwoche neu anwenden? Manuelle Änderungen gehen verloren (Notizen bleiben).'))return;
  var tpl=[],tplF=[];
  for(var i=0;i<7;i++){tpl.push(document.getElementById('tpl-'+i).value);tplF.push(document.getElementById('tplF-'+i).value);}
  var sS=parseDate(document.getElementById('seasonStart').value);
  var sE=parseDate(document.getElementById('seasonEnd').value);
  S.tpl=tpl;S.tplF=tplF;S.sS=sS;S.sE=sE;
  S.rows.forEach(function(r){r.occ=computeOcc({date:r.date,publicHolidayName:r.ph,schoolHolidayName:r.sh},tpl,tplF,sS,sE);});
  saveRows();saveGlobal();renderTable();renderSummary();
}
function resetAll(){
  if(!S.year)return;
  if(!confirm('Wirklich alles zurücksetzen?'))return;
  localStorage.removeItem(rKey());
  S.rows.forEach(function(r){r.occ=computeOcc({date:r.date,publicHolidayName:r.ph,schoolHolidayName:r.sh},S.tpl,S.tplF,S.sS,S.sE);r.notes='';});
  renderTable();renderSummary();
}

/* storage */
function rKey(){return'vb:r:'+S.year+':'+S.sc;}
function saveRows(){if(!S.year)return;try{localStorage.setItem(rKey(),JSON.stringify(S.rows.map(function(r){return{o:r.occ,n:r.notes};})));}catch(e){}}
function loadRows(){try{var raw=localStorage.getItem(rKey());if(!raw)return;var sv=JSON.parse(raw);if(Array.isArray(sv)&&sv.length===S.rows.length)sv.forEach(function(s,i){if(s.o)S.rows[i].occ=s.o;if(s.n)S.rows[i].notes=s.n;});}catch(e){}}
function saveGlobal(){try{localStorage.setItem('vb:cfg',JSON.stringify({mv:S.maxV,tpl:S.tpl,tplF:S.tplF,rev:S.rev}));}catch(e){}}
function loadGlobal(){
  try{var raw=localStorage.getItem('vb:cfg');if(!raw)return;var c=JSON.parse(raw);
  if(c.mv)document.getElementById('maxVisitors').value=c.mv;
  if(Array.isArray(c.tpl)&&c.tpl.length===7)c.tpl.forEach(function(v,i){var el=document.getElementById('tpl-'+i);if(el){el.value=v;el.dataset.occ=v;}});
  if(Array.isArray(c.tplF)&&c.tplF.length===7)c.tplF.forEach(function(v,i){var el=document.getElementById('tplF-'+i);if(el){el.value=v;el.dataset.occ=v;}});
  if(c.rev){
    S.rev=c.rev;
    var m={ticketAdult:'adultPrice',vatAdult:'adultVat',ticketChild:'childPrice',vatChild:'childVat',ticketReduced:'reducedPrice',vatReduced:'reducedVat',revenueRetail:'retail',revenueFB:'fb',revenueMachines:'machines'};
    Object.keys(m).forEach(function(id){var el=document.getElementById(id);if(el)el.value=c.rev[m[id]]!=null?c.rev[m[id]]:'';});
    var avg=document.getElementById('avgNetTicket');if(avg)avg.textContent=fmtEUR(avgNetTicket());
  }}catch(e){}
}

/* export helpers */
function loadScript(url){
  return new Promise(function(res,rej){
    var s=document.createElement('script');s.src=url;s.async=true;
    s.onload=function(){res();};
    s.onerror=function(){rej(new Error('Script konnte nicht geladen werden: '+url));};
    document.head.appendChild(s);
  });
}
async function loadFirstAvailable(urls){
  var last=null;
  for(var i=0;i<urls.length;i++){
    try{await loadScript(urls[i]);return;}catch(e){last=e;}
  }
  throw last||new Error('Keine Quelle erreichbar');
}
async function ensureXLSX(){
  if(window.XLSX)return;
  await loadFirstAvailable([
    'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
  ]);
  if(!window.XLSX)throw new Error('XLSX-Bibliothek nicht verfügbar. Bitte Internetverbindung prüfen.');
}
async function ensurePDF(){
  if(!window.jspdf||!window.jspdf.jsPDF){
    await loadFirstAvailable([
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js'
    ]);
  }
  if(!window.jspdf||!window.jspdf.jsPDF)throw new Error('jsPDF-Bibliothek nicht verfügbar. Bitte Internetverbindung prüfen.');
  /* autotable attaches to jsPDF prototype; detect by probing prototype */
  var proto=window.jspdf.jsPDF.API||window.jspdf.jsPDF.prototype;
  if(!proto||typeof proto.autoTable!=='function'){
    await loadFirstAvailable([
      'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.js',
      'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
    ]);
    proto=window.jspdf.jsPDF.API||window.jspdf.jsPDF.prototype;
    if(!proto||typeof proto.autoTable!=='function')throw new Error('jsPDF-AutoTable nicht verfügbar.');
  }
}

/* project save / open */
async function saveProject(){
  if(!S.rows||!S.rows.length){setInfo('error','Es gibt noch keine Tabelle zum Speichern. Bitte erst "Berechne Jahresbudget" klicken.');return;}
  var data={
    app:'besucher-budget-rechner',v:2,
    savedAt:new Date().toISOString(),
    year:S.year,state:S.sc,maxV:S.maxV,
    seasonStart:S.sS?fmtISO(S.sS):'',
    seasonEnd:S.sE?fmtISO(S.sE):'',
    tpl:S.tpl.slice(),tplF:S.tplF.slice(),
    rev:JSON.parse(JSON.stringify(S.rev)),
    rows:S.rows.map(function(r){return{d:fmtISO(r.date),ph:r.ph||'',sh:r.sh||'',occ:r.occ,notes:r.notes||''};})
  };
  var json=JSON.stringify(data,null,2);
  var blob=new Blob([json],{type:'application/json'});
  var fn='Besucher-Budget_'+S.year+'_'+S.sc+'.bbr.json';
  var ok=await saveBlob(blob,fn,'Besucher-Budget-Projekt','application/json',['.json','.bbr']);
  if(ok)setInfo('success','Projekt gespeichert als „'+fn+'".');
}

function applyProject(data){
  if(!data||data.app!=='besucher-budget-rechner')throw new Error('Unbekanntes Dateiformat.');
  if(!Array.isArray(data.rows)||!data.rows.length)throw new Error('Datei enthält keine Tages-Daten.');
  if(!data.state||!BUNDESLAENDER[data.state])throw new Error('Unbekanntes Bundesland: '+data.state);
  var ySel=document.getElementById('year');
  var has=false;for(var i=0;i<ySel.options.length;i++)if(parseInt(ySel.options[i].value,10)===data.year){has=true;break;}
  if(!has){var o=document.createElement('option');o.value=data.year;o.textContent=data.year;ySel.appendChild(o);}
  ySel.value=String(data.year);
  document.getElementById('state').value=data.state;
  document.getElementById('maxVisitors').value=data.maxV||0;
  document.getElementById('seasonStart').value=data.seasonStart||'';
  document.getElementById('seasonEnd').value=data.seasonEnd||'';
  if(Array.isArray(data.tpl)&&data.tpl.length===7)data.tpl.forEach(function(v,i){var el=document.getElementById('tpl-'+i);if(el){el.value=v;el.dataset.occ=v;}});
  if(Array.isArray(data.tplF)&&data.tplF.length===7)data.tplF.forEach(function(v,i){var el=document.getElementById('tplF-'+i);if(el){el.value=v;el.dataset.occ=v;}});
  S.year=data.year;S.sc=data.state;S.maxV=parseInt(data.maxV,10)||0;
  S.tpl=Array.isArray(data.tpl)?data.tpl.slice():[];
  S.tplF=Array.isArray(data.tplF)?data.tplF.slice():[];
  S.sS=data.seasonStart?parseDate(data.seasonStart):null;
  S.sE=data.seasonEnd?parseDate(data.seasonEnd):null;
  if(data.rev){
    S.rev=data.rev;
    var m={ticketAdult:'adultPrice',vatAdult:'adultVat',ticketChild:'childPrice',vatChild:'childVat',ticketReduced:'reducedPrice',vatReduced:'reducedVat',revenueRetail:'retail',revenueFB:'fb',revenueMachines:'machines'};
    Object.keys(m).forEach(function(id){var el=document.getElementById(id);if(el)el.value=data.rev[m[id]]!=null?data.rev[m[id]]:'';});
    var avg=document.getElementById('avgNetTicket');if(avg)avg.textContent=fmtEUR(avgNetTicket());
  }
  S.rows=data.rows.map(function(r){return{date:parseDate(r.d),ph:r.ph||'',sh:r.sh||'',occ:r.occ||'Off',notes:r.notes||''};});
  saveRows();saveGlobal();renderTable();renderSummary();
  document.getElementById('results').classList.remove('hidden');
  updateSaveVisibility();
  document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
}

function openProject(){
  var input=document.getElementById('openProjectFile');
  input.value='';
  input.onchange=function(){
    var f=input.files&&input.files[0];if(!f)return;
    var rd=new FileReader();
    rd.onload=function(){
      try{
        var data=JSON.parse(rd.result);
        applyProject(data);
        setInfo('success','Projekt geladen: „'+f.name+'" ('+S.rows.length+' Tage).');
      }catch(e){
        console.error(e);
        setInfo('error','Projekt konnte nicht geladen werden: '+e.message);
      }
    };
    rd.onerror=function(){setInfo('error','Datei konnte nicht gelesen werden.');};
    rd.readAsText(f);
  };
  input.click();
}

async function withLoading(btn,label,fn){
  var orig=btn.innerHTML;btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span>'+label;
  try{await fn();}
  catch(e){console.error(e);alert('Export fehlgeschlagen: '+(e&&e.message?e.message:e));}
  finally{btn.disabled=false;btn.innerHTML=orig;}
}

async function saveBlob(blob,filename,desc,mime,ext){
  if(window.showSaveFilePicker){
    try{
      var accept={};accept[mime]=ext;
      var opts={suggestedName:filename,types:[{description:desc,accept:accept}]};
      var handle=await window.showSaveFilePicker(opts);
      var w=await handle.createWritable();await w.write(blob);await w.close();return true;
    }catch(e){if(e&&e.name==='AbortError')return false;}
  }
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
  return true;
}

/* excel: single sheet with full day table */
async function toExcel(){
  if(!S.rows.length)return;
  await ensureXLSX();
  var wb=XLSX.utils.book_new();
  var hdr=['Datum','Wochentag','Feiertag','Schulferien','Auslastung','Auslastung %','Besucher','Umsatz','Notizen'];
  var data=S.rows.map(function(r){var v=calcV(r);return[fmtDE(r.date),WEEKDAYS_DE[r.date.getDay()],r.ph,r.sh,r.occ,occPct(r.occ),v,Math.round(calcDayRev(v).total*100)/100,r.notes];});
  var ws=XLSX.utils.aoa_to_sheet([hdr].concat(data));
  ws['!cols']=[{wch:12},{wch:12},{wch:26},{wch:26},{wch:10},{wch:12},{wch:12},{wch:14},{wch:30}];
  XLSX.utils.book_append_sheet(wb,ws,'Tagesdaten');
  var buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  var blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  await saveBlob(blob,'Besucher-Budget_'+S.year+'_'+S.sc+'.xlsx','Excel-Datei','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',['.xlsx']);
}

/* pdf: summary header on page 1, then day table */
async function toPdf(){
  if(!S.rows.length)return;
  await ensurePDF();
  var jsPDF=window.jspdf.jsPDF;var doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  var yt=0;S.rows.forEach(function(r){yt+=calcV(r);});
  var open=S.rows.filter(function(r){return occPct(r.occ)>0;}).length;
  var avgD=open>0?Math.round(yt/open):0;
  var avgM=Math.round(yt/12);
  var sDays=0;
  if(S.sS||S.sE){S.rows.forEach(function(r){var a=!S.sS||r.date>=S.sS,b=!S.sE||r.date<=S.sE;if(a&&b)sDays++;});}
  else{sDays=S.rows.length;}

  /* header */
  doc.setFontSize(16);doc.setTextColor(63,81,181);
  doc.text('Besucher-Budget '+S.year+' - '+BUNDESLAENDER[S.sc],14,14);
  doc.setFontSize(9);doc.setTextColor(80,80,80);
  doc.text('Max. Besucher/Tag: '+S.maxV.toLocaleString('de-DE')
    +'   |   Saison: '+(S.sS?fmtDE(S.sS):'ganzjährig')+' – '+(S.sE?fmtDE(S.sE):'ganzjährig')
    +'   |   Saisontage: '+sDays.toLocaleString('de-DE'),14,20);

  /* KPI strip */
  var kpis=[
    ['Jahresbudget',yt.toLocaleString('de-DE')],
    ['Ø pro Tag (offen)',avgD.toLocaleString('de-DE')],
    ['Ø pro Monat',avgM.toLocaleString('de-DE')],
    ['Saisontage',sDays.toLocaleString('de-DE')]
  ];
  doc.autoTable({
    body:kpis.map(function(k){return [k[0],k[1]];}),
    startY:24,margin:{left:14,right:14},
    styles:{fontSize:10,cellPadding:2},
    columnStyles:{0:{fontStyle:'bold',fillColor:[232,234,246],textColor:[48,63,159],cellWidth:60},1:{halign:'right',fontStyle:'bold'}},
    theme:'grid'
  });
  var y1=doc.lastAutoTable.finalY+4;

  /* monthly + counts side by side */
  var mr=[];for(var i=0;i<12;i++){var s=0;S.rows.forEach(function(r){if(r.date.getMonth()===i)s+=calcV(r);});mr.push([MONTHS_DE[i],s.toLocaleString('de-DE')]);}
  mr.push([{content:'Gesamt',styles:{fontStyle:'bold',fillColor:[232,234,246]}},{content:yt.toLocaleString('de-DE'),styles:{fontStyle:'bold',halign:'right',fillColor:[232,234,246]}}]);
  doc.autoTable({
    head:[['Monat','Besucher']],body:mr,
    startY:y1,margin:{left:14},tableWidth:82,
    styles:{fontSize:8,cellPadding:1.5},
    headStyles:{fillColor:[63,81,181],textColor:255},
    columnStyles:{1:{halign:'right'}}
  });

  var cr=[];OCCUPANCY_OPTIONS.forEach(function(o){var c=0;S.rows.forEach(function(r){if(r.occ===o.value)c++;});cr.push([o.label,o.percent+'%',c.toLocaleString('de-DE')]);});
  doc.autoTable({
    head:[['Auslastung','%','Tage']],body:cr,
    startY:y1,margin:{left:100},tableWidth:82,
    styles:{fontSize:8,cellPadding:1.5},
    headStyles:{fillColor:[63,81,181],textColor:255},
    columnStyles:{1:{halign:'right'},2:{halign:'right'}}
  });

  var y2=Math.max(doc.lastAutoTable.finalY,y1)+6;

  /* day table: one month per page, starting from page 2 */
  /* precompute monthly totals for month-header rows */
  var monthlyTotals=Array(12).fill(0);
  S.rows.forEach(function(r){monthlyTotals[r.date.getMonth()]+=calcV(r);});

  /* group row indices by month */
  var idxByMonth=[];
  for(var mm=0;mm<12;mm++)idxByMonth.push([]);
  S.rows.forEach(function(r,idx){idxByMonth[r.date.getMonth()].push(idx);});

  var headCols=[['Datum','Wochentag','Feiertag/Ferien','Auslastung','Besucher','Umsatz','Notizen']];
  var colStyles={0:{cellWidth:17},1:{cellWidth:14},2:{cellWidth:46},3:{cellWidth:20},4:{cellWidth:14,halign:'right'},5:{cellWidth:18,halign:'right'},6:{cellWidth:'auto'}};

  function makeParser(meta){
    return function(data){
      if(data.section!=='body')return;
      var m=meta[data.row.index];
      if(m===null||m===undefined)return;
      var r=S.rows[m];if(!r)return;
      if(r.ph)data.cell.styles.fillColor=[254,226,226];
      else if(r.sh)data.cell.styles.fillColor=[254,243,199];
      else if(r.date.getDay()===0||r.date.getDay()===6)data.cell.styles.fillColor=[255,247,237];
    };
  }

  for(var mi=0;mi<12;mi++){
    var idxs=idxByMonth[mi];if(!idxs.length)continue;
    doc.addPage();

    var body=[];var rowMeta=[];
    var mRevT=0;idxs.forEach(function(idx){mRevT+=calcDayRev(calcV(S.rows[idx])).total;});
    body.push([{
      content:MONTHS_DE[mi]+' '+S.year+'  —  Besucher: '+monthlyTotals[mi].toLocaleString('de-DE')+'  |  Umsatz: '+fmtEUR(mRevT),
      colSpan:7,
      styles:{fillColor:[48,63,159],textColor:255,fontStyle:'bold',fontSize:10,halign:'left',cellPadding:{top:3,bottom:3,left:4,right:4}}
    }]);
    rowMeta.push(null);
    idxs.forEach(function(idx){
      var r=S.rows[idx],v=calcV(r);
      var h=[];if(r.ph)h.push(r.ph);if(r.sh)h.push('Ferien: '+r.sh);
      body.push([fmtDE(r.date),WEEKDAYS_DE[r.date.getDay()],h.join('; '),r.occ+' ('+occPct(r.occ)+'%)',v.toLocaleString('de-DE'),fmtEUR(calcDayRev(v).total),r.notes]);
      rowMeta.push(idx);
    });

    doc.autoTable({
      head:headCols,body:body,startY:14,
      styles:{fontSize:8,cellPadding:1.4,overflow:'linebreak'},
      headStyles:{fillColor:[63,81,181],textColor:255,fontStyle:'bold'},
      alternateRowStyles:{fillColor:[244,246,250]},
      columnStyles:colStyles,
      didParseCell:makeParser(rowMeta)
    });
  }

  var blob=doc.output('blob');
  await saveBlob(blob,'Besucher-Budget_'+S.year+'_'+S.sc+'.pdf','PDF-Datei','application/pdf',['.pdf']);
}

/* ============================================================
   PERSONALEINSATZPLANUNG (Staff Scheduling)
   ============================================================ */

var STAFF_CATS = [
  { id: 'ops', label: 'Operations',    color: '#3f51b5', hourlyRate: 15.00, active: true, rows: [] },
  { id: 'fb',  label: 'F&B',           color: '#f59e0b', hourlyRate: 13.00, active: true, rows: [] },
  { id: 'ret', label: 'Retail',        color: '#10b981', hourlyRate: 13.50, active: true, rows: [] },
  { id: 'ent', label: 'Entertainment', color: '#8b5cf6', hourlyRate: 16.00, active: true, rows: [] }
];

var STAFF_PARAMS = { sv: 20, puffer: 10 };
var STAFF_MAX_ROWS = 60;

function staffTimeDiff(open, close) {
  if (!open || !close) return 0;
  var op = open.split(':').map(Number);
  var cl = close.split(':').map(Number);
  var openM = op[0] * 60 + (op[1] || 0);
  var closeM = cl[0] * 60 + (cl[1] || 0);
  if (closeM <= openM) closeM += 1440;
  return (closeM - openM) / 60;
}

function staffRowCalc(row, cat) {
  var dur = staffTimeDiff(row.open, row.close);
  var lohnProMA = dur * cat.hourlyRate;
  var tageskosten = lohnProMA * (row.headcount || 0);
  return { dur: dur, lohnProMA: lohnProMA, tageskosten: tageskosten };
}

function staffDailyBase() {
  var total = 0;
  STAFF_CATS.forEach(function(cat) {
    if (!cat.active) return;
    cat.rows.forEach(function(row) { total += staffRowCalc(row, cat).tageskosten; });
  });
  return total;
}

function staffTotalDaily() {
  var basis = staffDailyBase();
  var withSv = basis * (1 + STAFF_PARAMS.sv / 100);
  return withSv * (1 + STAFF_PARAMS.puffer / 100);
}

function fmtH(h) {
  return h.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function staffNewRow() {
  return { name: '', open: '09:00', close: '17:00', headcount: 1 };
}

function renderStaffSummary() {
  var el = document.getElementById('staffSummarySection');
  if (!el) return;
  var basis = staffDailyBase();
  var sv = basis * STAFF_PARAMS.sv / 100;
  var withSv = basis + sv;
  var puff = withSv * STAFF_PARAMS.puffer / 100;
  var total = withSv + puff;

  function sumRow(label, val, cls) {
    return '<div class="staff-sum-row' + (cls ? ' staff-sum-' + cls : '') + '">'
      + '<span class="staff-sum-label">' + label + '</span>'
      + '<span class="staff-sum-value">' + fmtEUR(val) + '</span></div>';
  }

  /* per-category breakdown with headcount */
  var catRows = '';
  var totalHC = 0;
  STAFF_CATS.forEach(function(cat) {
    if (!cat.active) return;
    var catHC = cat.rows.reduce(function(s,r){return s+(r.headcount||0);},0);
    totalHC += catHC;
    var catBase = cat.rows.reduce(function(s, r) { return s + staffRowCalc(r, cat).tageskosten; }, 0);
    var catTotal = catBase * (1 + STAFF_PARAMS.sv / 100) * (1 + STAFF_PARAMS.puffer / 100);
    catRows += '<div class="staff-sum-row staff-sum-cat">'
      + '<span class="staff-sum-label">' + cat.label
        + ' <span class="staff-hc-badge">' + catHC + ' MA</span></span>'
      + '<span class="staff-sum-value">' + fmtEUR(catTotal) + '</span></div>';
  });

  el.innerHTML = '<div class="staff-summary-grid">'
    + (catRows
        ? '<div class="staff-sum-section-label">Abteilungskosten (Tageskosten gesamt)'
            + ' <span class="staff-hc-total">' + totalHC + ' MA gesamt</span></div>'
          + catRows
          + '<div class="staff-sum-divider"></div>'
        : '')
    + sumRow('Basis Tageskosten (Netto)', basis, '')
    + sumRow('SV-Zuschlag (' + STAFF_PARAMS.sv.toLocaleString('de-DE') + ' %)', sv, 'add')
    + sumRow('Puffer (' + STAFF_PARAMS.puffer.toLocaleString('de-DE') + ' %)', puff, 'add')
    + sumRow('Tageskosten Gesamt', total, 'total')
    + sumRow('Wochenkosten Gesamt (× 7)', total * 7, 'total')
    + sumRow('Monatskosten Gesamt (× 30)', total * 30, 'total')
    + '</div>';
}

function renderStaffCatPanel(cat) {
  var panel = document.getElementById('staff-panel-' + cat.id);
  if (!panel) return;
  var wrap = panel.querySelector('.staff-table-wrap');

  if (!cat.active) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';

  var html = '<table class="staff-table"><thead><tr>'
    + '<th>Ride / Venue / Position</th><th>\xd6ffnung</th><th>Schlie\xdfung</th>'
    + '<th>Dauer</th><th>Headcount</th><th>Stundenlohn (Netto)</th><th>Tageskosten</th><th></th>'
    + '</tr></thead><tbody>';

  cat.rows.forEach(function(row, i) {
    var c = staffRowCalc(row, cat);
    html += '<tr data-cat="' + cat.id + '" data-idx="' + i + '">'
      + '<td><input class="staff-inp staff-name" type="text" value="' + escHtml(row.name) + '" placeholder="z. B. Haupteingang" /></td>'
      + '<td><input class="staff-inp staff-open" type="time" value="' + escHtml(row.open) + '" /></td>'
      + '<td><input class="staff-inp staff-close" type="time" value="' + escHtml(row.close) + '" /></td>'
      + '<td class="staff-calc">' + fmtH(c.dur) + '</td>'
      + '<td><input class="staff-inp staff-hc" type="number" value="' + (row.headcount || 0) + '" min="0" max="999" step="1" /></td>'
      + '<td class="staff-calc">' + fmtEUR(c.lohnProMA) + '</td>'
      + '<td class="staff-calc staff-tageskosten">' + fmtEUR(c.tageskosten) + '</td>'
      + '<td class="staff-actions">'
        + '<button class="staff-btn-dup" title="Duplizieren">⧉</button>'
        + '<button class="staff-btn-del" title="L\xf6schen">✕</button>'
      + '</td></tr>';
  });

  var catTotal = cat.rows.reduce(function(s,r){return s+staffRowCalc(r,cat).tageskosten;},0);
  html += '</tbody><tfoot><tr>'
    + '<td colspan="6" class="staff-foot-label">Kategorie Gesamt:</td>'
    + '<td class="staff-calc staff-foot-total">' + fmtEUR(catTotal) + '</td>'
    + '<td></td></tr></tfoot></table>';

  wrap.innerHTML = html;

  wrap.querySelectorAll('tr[data-idx]').forEach(function(tr) {
    var idx = parseInt(tr.dataset.idx, 10);
    var row = cat.rows[idx];

    tr.querySelector('.staff-name').addEventListener('input', function(e) {
      row.name = e.target.value; saveStaffState();
    });
    tr.querySelector('.staff-open').addEventListener('change', function(e) {
      row.open = e.target.value; staffRefreshRow(tr, cat, idx);
    });
    tr.querySelector('.staff-close').addEventListener('change', function(e) {
      row.close = e.target.value; staffRefreshRow(tr, cat, idx);
    });
    tr.querySelector('.staff-hc').addEventListener('input', function(e) {
      row.headcount = parseInt(e.target.value, 10) || 0; staffRefreshRow(tr, cat, idx);
    });
    tr.querySelector('.staff-btn-dup').addEventListener('click', function() {
      if (cat.rows.length >= STAFF_MAX_ROWS) {
        alert('Maximale Zeilenanzahl (' + STAFF_MAX_ROWS + ') erreicht.');
        return;
      }
      cat.rows.splice(idx + 1, 0, JSON.parse(JSON.stringify(row)));
      renderStaffCatPanel(cat); renderStaffSummary(); saveStaffState();
    });
    tr.querySelector('.staff-btn-del').addEventListener('click', function() {
      cat.rows.splice(idx, 1);
      renderStaffCatPanel(cat); renderStaffSummary(); saveStaffState();
    });
  });
}

function staffRefreshRow(tr, cat, idx) {
  var c = staffRowCalc(cat.rows[idx], cat);
  var calcs = tr.querySelectorAll('.staff-calc');
  calcs[0].textContent = fmtH(c.dur);
  calcs[1].textContent = fmtEUR(c.lohnProMA);
  calcs[2].textContent = fmtEUR(c.tageskosten);
  var wrap = tr.closest('.staff-table-wrap');
  if (wrap) {
    var ft = wrap.querySelector('.staff-foot-total');
    if (ft) ft.textContent = fmtEUR(cat.rows.reduce(function(s,r){return s+staffRowCalc(r,cat).tageskosten;},0));
  }
  renderStaffSummary();
  saveStaffState();
}

/* ---- Excel export ---- */
async function toExcelStaff() {
  await ensureXLSX();
  var wb = XLSX.utils.book_new();
  var now = new Date().toLocaleDateString('de-DE');

  /* Sheet 1: Zusammenfassung */
  var basis = staffDailyBase();
  var sv    = basis * STAFF_PARAMS.sv / 100;
  var withSv = basis + sv;
  var puff  = withSv * STAFF_PARAMS.puffer / 100;
  var total = withSv + puff;

  var sumData = [
    ['Personaleinsatzplanung – Kostenübersicht', '', 'Erstellt:', now],
    [],
    ['Parameter', 'Wert'],
    ['SV-Zuschlag', STAFF_PARAMS.sv + ' %'],
    ['Puffer',      STAFF_PARAMS.puffer + ' %'],
    []
  ];
  STAFF_CATS.forEach(function(cat) {
    sumData.push(['Ø Stundenlohn ' + cat.label, (cat.active ? '' : '[inaktiv]  ') + cat.hourlyRate.toFixed(2) + ' €']);
  });
  sumData.push([], ['Kostenausweis', 'Täglich', 'Wöchentlich (×7)', 'Monatlich (×30)']);
  sumData.push(['Basis Personalkosten (Netto)', Math.round(basis*100)/100, Math.round(basis*7*100)/100, Math.round(basis*30*100)/100]);
  sumData.push(['SV-Zuschlag (' + STAFF_PARAMS.sv + ' %)',  Math.round(sv*100)/100,        Math.round(sv*7*100)/100,        Math.round(sv*30*100)/100]);
  sumData.push(['Puffer ('      + STAFF_PARAMS.puffer + ' %)', Math.round(puff*100)/100,   Math.round(puff*7*100)/100,      Math.round(puff*30*100)/100]);
  sumData.push(['GESAMT',        Math.round(total*100)/100,   Math.round(total*7*100)/100, Math.round(total*30*100)/100]);

  /* Category overview row */
  sumData.push([], ['Kategorie', 'Aktiv', 'Zeilen', 'Tageskosten (Netto)']);
  STAFF_CATS.forEach(function(cat) {
    var catTotal = cat.active ? cat.rows.reduce(function(s,r){return s+staffRowCalc(r,cat).tageskosten;},0) : 0;
    sumData.push([cat.label, cat.active ? 'Ja' : 'Nein', cat.rows.length, Math.round(catTotal*100)/100]);
  });

  var wsSum = XLSX.utils.aoa_to_sheet(sumData);
  wsSum['!cols'] = [{wch:36},{wch:18},{wch:20},{wch:20}];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Zusammenfassung');

  /* One sheet per category */
  var hdr = ['Ride / Venue / Position', 'Öffnung', 'Schließung', 'Dauer (h)', 'Headcount', 'Stundenlohn (€)', 'Tageskosten (€)'];
  STAFF_CATS.forEach(function(cat) {
    var rows = [hdr];
    cat.rows.forEach(function(row) {
      var c = staffRowCalc(row, cat);
      rows.push([row.name, row.open, row.close,
        Math.round(c.dur*100)/100,
        row.headcount,
        Math.round(c.lohnProMA*100)/100,
        Math.round(c.tageskosten*100)/100]);
    });
    /* total row */
    var catTotal = cat.rows.reduce(function(s,r){return s+staffRowCalc(r,cat).tageskosten;},0);
    rows.push(['GESAMT', '', '', '', '', '', Math.round(catTotal*100)/100]);

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:26},{wch:10},{wch:12},{wch:10},{wch:11},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb, ws, cat.label);
  });

  var buf  = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  var blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  await saveBlob(blob, 'Personaleinsatzplanung.xlsx', 'Excel-Datei',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['.xlsx']);
}

/* ---- PDF export ---- */
async function toPdfStaff() {
  await ensurePDF();
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
  var now = new Date().toLocaleDateString('de-DE');

  var basis  = staffDailyBase();
  var sv     = basis * STAFF_PARAMS.sv / 100;
  var withSv = basis + sv;
  var puff   = withSv * STAFF_PARAMS.puffer / 100;
  var total  = withSv + puff;

  /* Page 1 – overview */
  doc.setFontSize(16); doc.setTextColor(63,81,181);
  doc.text('Personaleinsatzplanung', 14, 14);
  doc.setFontSize(9); doc.setTextColor(80,80,80);
  doc.text('SV-Zuschlag: ' + STAFF_PARAMS.sv + ' %   |   Puffer: ' + STAFF_PARAMS.puffer + ' %   |   Erstellt: ' + now, 14, 20);

  /* Cost summary table */
  doc.autoTable({
    head: [['Kostenausweis', 'Täglich', 'Wöchentlich (× 7)', 'Monatlich (× 30)']],
    body: [
      ['Basis Personalkosten (Netto)', fmtEUR(basis),  fmtEUR(basis*7),  fmtEUR(basis*30)],
      ['SV-Zuschlag (' + STAFF_PARAMS.sv + ' %)',      fmtEUR(sv),    fmtEUR(sv*7),    fmtEUR(sv*30)],
      ['Puffer ('      + STAFF_PARAMS.puffer + ' %)',  fmtEUR(puff),  fmtEUR(puff*7),  fmtEUR(puff*30)],
      [{content:'GESAMT', styles:{fontStyle:'bold'}}, {content:fmtEUR(total),styles:{fontStyle:'bold'}},
       {content:fmtEUR(total*7),styles:{fontStyle:'bold'}}, {content:fmtEUR(total*30),styles:{fontStyle:'bold'}}]
    ],
    startY: 24, margin:{left:14, right:14},
    styles:{fontSize:9, cellPadding:2},
    headStyles:{fillColor:[63,81,181], textColor:255},
    columnStyles:{1:{halign:'right'}, 2:{halign:'right'}, 3:{halign:'right'}},
    theme:'grid'
  });

  /* Category summary table */
  var catSumY = doc.lastAutoTable.finalY + 6;
  var catSumBody = STAFF_CATS.map(function(cat) {
    var catTotal = cat.active ? cat.rows.reduce(function(s,r){return s+staffRowCalc(r,cat).tageskosten;},0) : 0;
    return [cat.label, cat.active ? 'Aktiv' : 'Inaktiv', cat.rows.length,
            cat.hourlyRate.toFixed(2) + ' €', fmtEUR(catTotal), fmtEUR(catTotal*7), fmtEUR(catTotal*30)];
  });
  doc.autoTable({
    head: [['Kategorie','Status','Zeilen','Ø Stundenlohn','Tageskosten','Wochenkosten','Monatskosten']],
    body: catSumBody,
    startY: catSumY, margin:{left:14, right:14},
    styles:{fontSize:9, cellPadding:2},
    headStyles:{fillColor:[48,63,159], textColor:255},
    columnStyles:{2:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'}},
    theme:'striped'
  });

  /* One page per active category with rows */
  var catColors = {ops:[63,81,181], fb:[245,158,11], ret:[16,185,129], ent:[139,92,246]};
  STAFF_CATS.forEach(function(cat) {
    if (!cat.active || !cat.rows.length) return;
    doc.addPage();
    var col = catColors[cat.id] || [63,81,181];
    doc.setFontSize(13); doc.setTextColor(col[0], col[1], col[2]);
    doc.text(cat.label, 14, 14);
    doc.setFontSize(9); doc.setTextColor(80,80,80);
    doc.text('Ø Stundenlohn: ' + cat.hourlyRate.toFixed(2) + ' €   |   Zeilen: ' + cat.rows.length, 14, 20);

    var body = cat.rows.map(function(row) {
      var c = staffRowCalc(row, cat);
      return [row.name || '—', row.open, row.close, c.dur.toFixed(2).replace('.', ',') + ' h',
              row.headcount, fmtEUR(c.lohnProMA), fmtEUR(c.tageskosten)];
    });
    var catTotal = cat.rows.reduce(function(s,r){return s+staffRowCalc(r,cat).tageskosten;},0);
    body.push([{content:'GESAMT', colSpan:6, styles:{fontStyle:'bold', halign:'right', fillColor:[232,234,246]}},
               {content:fmtEUR(catTotal), styles:{fontStyle:'bold', halign:'right', fillColor:[232,234,246]}}]);

    doc.autoTable({
      head: [['Ride / Venue / Position','Öffnung','Schließung','Dauer','Headcount','Stundenlohn (Netto)','Tageskosten']],
      body: body,
      startY: 24, margin:{left:14, right:14},
      styles:{fontSize:9, cellPadding:2, overflow:'linebreak'},
      headStyles:{fillColor:col, textColor:255, fontStyle:'bold'},
      alternateRowStyles:{fillColor:[248,250,252]},
      columnStyles:{3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right',fontStyle:'bold'}}
    });
  });

  var blob = doc.output('blob');
  await saveBlob(blob, 'Personaleinsatzplanung.pdf', 'PDF-Datei', 'application/pdf', ['.pdf']);
}

/* Persistence */
var STAFF_LS_KEY = 'vb:staff:v1';
function saveStaffState() {
  try {
    localStorage.setItem(STAFF_LS_KEY, JSON.stringify({
      sv: STAFF_PARAMS.sv, puffer: STAFF_PARAMS.puffer,
      cats: STAFF_CATS.map(function(c){return{id:c.id,active:c.active,hourlyRate:c.hourlyRate,rows:c.rows.slice()};})
    }));
  } catch(e) {}
}
function loadStaffState() {
  try {
    var raw = localStorage.getItem(STAFF_LS_KEY); if (!raw) return;
    var d = JSON.parse(raw);
    if (d.sv !== undefined) STAFF_PARAMS.sv = d.sv;
    if (d.puffer !== undefined) STAFF_PARAMS.puffer = d.puffer;
    if (Array.isArray(d.cats)) d.cats.forEach(function(sc) {
      var cat = STAFF_CATS.find(function(c){return c.id===sc.id;});
      if (!cat) return;
      if (sc.active !== undefined) cat.active = sc.active;
      if (sc.hourlyRate !== undefined) cat.hourlyRate = sc.hourlyRate;
      if (Array.isArray(sc.rows)) cat.rows = sc.rows;
    });
  } catch(e) {}
}

function initStaffSection() {
  loadStaffState();

  /* SV + Puffer */
  var svEl = document.getElementById('staffSV');
  var pufferEl = document.getElementById('staffPuffer');
  if (svEl) { svEl.value = STAFF_PARAMS.sv; svEl.addEventListener('input', function(e){STAFF_PARAMS.sv=parseFloat(e.target.value)||0;renderStaffSummary();saveStaffState();}); }
  if (pufferEl) { pufferEl.value = STAFF_PARAMS.puffer; pufferEl.addEventListener('input', function(e){STAFF_PARAMS.puffer=parseFloat(e.target.value)||0;renderStaffSummary();saveStaffState();}); }

  /* Per-category settings */
  var catSettings = document.getElementById('staffCatSettings');
  STAFF_CATS.forEach(function(cat) {
    var div = document.createElement('div');
    div.className = 'staff-cat-setting';
    div.innerHTML = '<label class="staff-cat-toggle">'
      + '<input type="checkbox" id="staffActive-' + cat.id + '"' + (cat.active ? ' checked' : '') + ' />'
      + '<span style="border-left:3px solid ' + cat.color + ';padding-left:5px">' + cat.label + '</span>'
      + '</label>'
      + '<div class="staff-rate-field">'
      + '<label for="staffRate-' + cat.id + '">\xd8 Stundenlohn</label>'
      + '<div class="staff-rate-wrap"><input type="number" id="staffRate-' + cat.id + '" value="' + cat.hourlyRate.toFixed(2) + '" min="0" step="0.5" /><span>€</span></div>'
      + '</div>';
    catSettings.appendChild(div);

    document.getElementById('staffActive-' + cat.id).addEventListener('change', function(e) {
      cat.active = e.target.checked; renderStaffCatPanel(cat); renderStaffSummary(); saveStaffState();
    });
    document.getElementById('staffRate-' + cat.id).addEventListener('input', function(e) {
      cat.hourlyRate = parseFloat(e.target.value) || 0; renderStaffCatPanel(cat); renderStaffSummary(); saveStaffState();
    });
  });

  /* Category panels */
  var catPanels = document.getElementById('staffCatPanels');
  STAFF_CATS.forEach(function(cat) {
    /* Add one default row if nothing was loaded */
    if (!cat.rows.length) cat.rows.push(staffNewRow());

    var panel = document.createElement('div');
    panel.className = 'staff-panel';
    panel.id = 'staff-panel-' + cat.id;
    panel.style.borderLeftColor = cat.color;
    panel.innerHTML = '<div class="staff-panel-header">'
      + '<div class="staff-panel-title" style="color:' + cat.color + '">' + cat.label + '</div>'
      + '<button type="button" class="staff-btn-add" id="staffAdd-' + cat.id + '">+ Zeile hinzuf\xfcgen</button>'
      + '</div><div class="staff-table-wrap"></div>';
    catPanels.appendChild(panel);

    document.getElementById('staffAdd-' + cat.id).addEventListener('click', function() {
      if (cat.rows.length >= STAFF_MAX_ROWS) { alert('Maximale Zeilenanzahl (' + STAFF_MAX_ROWS + ') erreicht.'); return; }
      cat.rows.push(staffNewRow()); renderStaffCatPanel(cat); renderStaffSummary(); saveStaffState();
    });

    renderStaffCatPanel(cat);
  });

  /* Export buttons */
  var staffExcelBtn = document.getElementById('staffExcelBtn');
  var staffPdfBtn   = document.getElementById('staffPdfBtn');
  if (staffExcelBtn) staffExcelBtn.addEventListener('click', function(e){withLoading(e.currentTarget,'Exportiere…',toExcelStaff);});
  if (staffPdfBtn)   staffPdfBtn.addEventListener('click',   function(e){withLoading(e.currentTarget,'Exportiere…',toPdfStaff);});

  /* Section collapse toggle */
  var toggleBtn = document.getElementById('staffToggleBtn');
  var body = document.getElementById('staffSectionBody');
  if (toggleBtn && body) {
    toggleBtn.addEventListener('click', function() {
      var hidden = body.style.display === 'none';
      body.style.display = hidden ? '' : 'none';
      toggleBtn.textContent = hidden ? 'Ausblenden' : 'Einblenden';
    });
  }

  renderStaffSummary();
}

/* init */
function init(){
  var ySel=document.getElementById('year'),cy=new Date().getFullYear();
  for(var y=cy-2;y<=cy+5;y++){var o=document.createElement('option');o.value=y;o.textContent=y;if(y===cy)o.selected=true;ySel.appendChild(o);}
  var sSel=document.getElementById('state');
  Object.keys(BUNDESLAENDER).forEach(function(code){var o=document.createElement('option');o.value=code;o.textContent=BUNDESLAENDER[code];sSel.appendChild(o);});

  /* normal template */
  var tG=document.getElementById('templateGrid');
  TPL_DAYS.forEach(function(day,i){
    var w=document.createElement('div');w.className='tpl-day';
    var l=document.createElement('label');l.textContent=day.label;l.setAttribute('for','tpl-'+i);
    var s=document.createElement('select');s.id='tpl-'+i;
    OCCUPANCY_OPTIONS.forEach(function(o){var op=document.createElement('option');op.value=o.value;op.textContent=o.label+' ('+o.percent+'%)';s.appendChild(op);});
    s.value=day.def;s.dataset.occ=day.def;
    s.addEventListener('change',function(){this.dataset.occ=this.value;});
    w.appendChild(l);w.appendChild(s);tG.appendChild(w);
  });

  /* ferien template */
  var tGF=document.getElementById('templateGridFerien');
  TPL_DAYS.forEach(function(day,i){
    var w=document.createElement('div');w.className='tpl-day';
    var l=document.createElement('label');l.textContent=day.label;l.setAttribute('for','tplF-'+i);
    var s=document.createElement('select');s.id='tplF-'+i;
    OCCUPANCY_OPTIONS.forEach(function(o){var op=document.createElement('option');op.value=o.value;op.textContent=o.label+' ('+o.percent+'%)';s.appendChild(op);});
    s.value=day.defF;s.dataset.occ=day.defF;
    s.addEventListener('change',function(){this.dataset.occ=this.value;});
    w.appendChild(l);w.appendChild(s);tGF.appendChild(w);
  });

  loadGlobal();
  document.getElementById('generateBtn').addEventListener('click',generate);
  document.getElementById('maxVisitors').addEventListener('input',function(e){
    var v=parseInt(e.target.value,10)||0;
    if(S.rows.length>0&&v>0){S.maxV=v;saveRows();updVC();renderSummary();}
  });
  /* revenue inputs: live update on change */
  var revIds=['ticketAdult','vatAdult','ticketChild','vatChild','ticketReduced','vatReduced','revenueRetail','revenueFB','revenueMachines'];
  revIds.forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    el.addEventListener('input',function(){readRevForm();if(S.rows.length){saveGlobal();renderTable();renderSummary();}});
  });
  document.getElementById('exportExcelBtn').addEventListener('click',function(e){withLoading(e.currentTarget,'Exportiere…',toExcel);});
  document.getElementById('exportPdfBtn').addEventListener('click',function(e){withLoading(e.currentTarget,'Exportiere…',toPdf);});
  document.getElementById('reapplyTemplateBtn').addEventListener('click',reapply);
  document.getElementById('resetBtn').addEventListener('click',resetAll);
  document.getElementById('openProjectBtn').addEventListener('click',openProject);
  document.getElementById('saveProjectBtn').addEventListener('click',function(e){withLoading(e.currentTarget,'Speichere…',saveProject);});
  /* bulk template buttons */
  document.querySelectorAll('.template-bulk').forEach(function(bar){
    var prefix=bar.dataset.target;
    bar.addEventListener('click',function(e){
      var val=e.target.dataset&&e.target.dataset.bulk;if(!val)return;
      for(var i=0;i<7;i++){var el=document.getElementById(prefix+'-'+i);if(el){el.value=val;el.dataset.occ=val;}}
    });
  });
  /* chart visibility toggle */
  document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'chartVisible') {
      if (S.rows.length) renderSummary();
    }
  });

  updateSaveVisibility();
  initStaffSection();
}
document.addEventListener('DOMContentLoaded',init);
