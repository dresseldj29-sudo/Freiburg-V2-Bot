const $=s=>document.querySelector(s);let data=null;
async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});if(r.status===401){showLogin();throw Error('Nicht angemeldet')}const j=await r.json();if(!r.ok)throw Error(j.error||'Fehler');return j}
function showLogin(){$('#login').classList.remove('hidden');$('#app').classList.add('hidden')}
function showApp(){$('#login').classList.add('hidden');$('#app').classList.remove('hidden')}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('/api/login',{method:'POST',body:JSON.stringify({username:f.get('username'),password:f.get('password')})});$('#loginError').textContent='';showApp();await load()}catch(err){$('#loginError').textContent=err.message}});
$('#logout').onclick=async()=>{await api('/api/logout',{method:'POST'});showLogin()};
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>navigate(b.dataset.goto));
function navigate(page){document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));$('#'+page).classList.remove('hidden');document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('#pageTitle').textContent=({overview:'Übersicht',tickets:'Tickets',whitelist:'Whitelist',reports:'Meldungen',suggestions:'Vorschläge',logs:'Aktivitäten'})[page]||'Übersicht'}
const date=s=>new Date(s).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'});
const empty='<div class="empty">Noch keine Einträge vorhanden.</div>';
function rows(items,render){return items.length?items.map(render).join(''):empty}
async function load(){try{data=await api('/api/data');$('#openTickets').textContent=data.counts.openTickets;$('#pendingWhitelist').textContent=data.counts.pendingWhitelist;$('#reportsCount').textContent=data.counts.reports;$('#suggestionsCount').textContent=data.counts.suggestions;$('#botStatus').textContent=data.bot?'🟢 Online':'🔴 Offline';$('#guildName').textContent=data.guild||'Nicht verbunden';$('#uptime').textContent=Math.floor(data.uptime/3600)+' Std. '+Math.floor(data.uptime%3600/60)+' Min.';$('#recentLogs').innerHTML=rows(data.logs.slice(0,5),logHtml);$('#logList').innerHTML=rows(data.logs,logHtml);
$('#ticketList').innerHTML=rows(data.tickets,t=>`<div class="data-row"><div><b>#${t.id} · ${esc(t.username)}</b><p>${esc(t.topic)} · ${date(t.createdAt)}</p></div><div class="actions"><span class="tag ${t.status==='open'?'green':''}">${esc(t.status)}</span>${t.status==='open'?`<button class="mini bad" onclick="ticketStatus('${t.id}','closed')">Schließen</button>`:''}${t.channelId?`<button class="mini" onclick="copyText('${t.channelId}')">Kanal-ID kopieren</button>`:''}</div></div>`);
$('#whitelistList').innerHTML=rows(data.whitelist,w=>`<div class="data-row"><div><b>${esc(w.character)} · ${esc(w.username)}</b><p>ID ${w.id} · ${date(w.createdAt)} ${w.age?'· Alter: '+esc(w.age):''}</p></div><div class="actions"><span class="tag ${w.status==='approved'?'green':''}">${esc(w.status)}</span><button class="mini good" onclick="whitelistStatus('${w.id}','approved')">Annehmen</button><button class="mini bad" onclick="whitelistStatus('${w.id}','rejected')">Ablehnen</button></div></div>`);
$('#reportList').innerHTML=rows(data.reports,r=>`<div class="data-row"><div><b>${esc(r.target)} · gemeldet von ${esc(r.username)}</b><p>${esc(r.reason)} · ${date(r.createdAt)}</p></div><span class="tag">${esc(r.status)}</span></div>`);
$('#suggestionList').innerHTML=rows(data.suggestions,s=>`<div class="data-row"><div><b>${esc(s.username)} · ${date(s.createdAt)}</b><p>${esc(s.text)}</p></div></div>`);
}catch(e){console.error(e)}}
function logHtml(l){return `<div class="activity"><b>${esc(l.type)}</b> · ${esc(l.description)}<small>${esc(l.user)} · ${date(l.createdAt)}</small></div>`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function whitelistStatus(id,status){await api('/api/whitelist/'+id,{method:'PATCH',body:JSON.stringify({status})});await load()}
async function ticketStatus(id,status){await api('/api/tickets/'+id,{method:'PATCH',body:JSON.stringify({status})});await load()}
async function copyText(t){await navigator.clipboard.writeText(t)}
$('#year').textContent=new Date().getFullYear();
(async()=>{try{await api('/api/me');showApp();await load()}catch(e){showLogin()}})();
