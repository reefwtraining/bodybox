// BODYBOX Music song stats: likes, dislikes, full plays and skips per song and per person.
// Shared by the music page (coach tab) and the admin page. Reads data/users/{uid}/music for every member.
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct = (a,b) => b ? Math.round(a*100/b)+'%' : '–';
const mins = s => s ? (s>=3600 ? (s/3600).toFixed(1)+' h' : Math.round(s/60)+' min') : '0 min';
const CSS = `.mcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:6px 0 20px;max-width:900px}
.mcard{background:#1B1B1B;border:1px solid #2A2A2A;border-radius:12px;padding:12px}.mcard b{display:block;font-family:"Anton",Impact,sans-serif;font-weight:400;font-size:28px}.mcard small{color:#8F8B84}
.msx{overflow-x:auto}.mstat{width:100%;border-collapse:collapse;font-size:14px;max-width:900px}
.mstat th{font-family:"Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;font-size:12px;color:#8F8B84;text-align:right;padding:8px 6px;border-bottom:1px solid #2A2A2A;cursor:pointer;white-space:nowrap;background:none}
.mstat th:first-child,.mstat td:first-child{text-align:left}
.mstat td{padding:9px 6px;border-bottom:1px solid #2A2A2A;text-align:right;font-variant-numeric:tabular-nums}
.mstat td:first-child{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mstat tr.mwho td{color:#8F8B84;font-size:13px;text-align:left;white-space:normal;max-width:none}
.mstat .mup{color:#7bd88f}.mstat .mdn{color:#ff8a7a}
.mlst{display:grid;gap:8px;max-width:640px}.mlrow{display:flex;align-items:center;gap:12px;background:#1B1B1B;border:1px solid #2A2A2A;border-radius:12px;padding:12px 14px}.mwho2{flex:1;min-width:0}.mwho2 b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mwho2 small{color:#8F8B84}
.mtg{width:52px;height:30px;border-radius:999px;background:#333;position:relative;flex:none;border:0;cursor:pointer}.mtg::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:left .15s}.mtg[aria-checked=true]{background:#C8102E}.mtg[aria-checked=true]::after{left:25px}
.mstats h3{font-family:"Anton",Impact,sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.02em;font-size:22px;margin:24px 0 8px}`;
function addCss(){ if(document.getElementById('mstatsCss')) return; const st=document.createElement('style'); st.id='mstatsCss'; st.textContent=CSS; document.head.appendChild(st); }
export async function renderStats(fs, el, songs){
  addCss(); el.classList.add('mstats');
  el.innerHTML = '<p style="color:var(--sub,#8F8B84)">Loading song stats…</p>';
  const title = Object.fromEntries((songs||[]).map(x => [x.k, x.title]));
  let mem; try{ mem = await getDocs(collection(fs,'members')); }catch(e){ el.textContent = "Couldn't load members."; return; }
  const people = mem.docs.map(d => ({ uid:d.id, ...d.data() }));
  const rows = await Promise.all(people.map(p => getDoc(doc(fs,'data','users',p.uid,'music')).then(d => d.exists() ? { p, m:d.data() } : null).catch(() => null)));
  const users = rows.filter(Boolean);
  const per = {}; const S = k => per[k] || (per[k] = { k, likes:0, dislikes:0, starts:0, completes:0, skips:0, secs:0, dls:0, liked:[], disliked:[], skippers:[] });
  let tStarts=0,tDone=0,tSkips=0,tSecs=0,tLikes=0,tDl=0;
  const ppl = users.map(({p,m}) => {
    const nm = p.name || p.email || 'Someone'; let st=0,dn=0,sk=0,sc=0;
    Object.entries(m.plays||{}).forEach(([k,v]) => { const r=S(k); r.starts+=v.starts||0; r.completes+=v.completes||0; r.skips+=v.skips||0; r.secs+=v.secs||0; r.dls+=v.downloads||0; tDl+=v.downloads||0;
      st+=v.starts||0; dn+=v.completes||0; sk+=v.skips||0; sc+=v.secs||0; if(v.skips) r.skippers.push(nm+(v.skips>1?' ×'+v.skips:'')); });
    const likes = Object.entries(m.likes||{});
    likes.forEach(([k,v]) => { const r=S(k); if(v===1){ r.likes++; r.liked.push(nm); } else if(v===-1){ r.dislikes++; r.disliked.push(nm); } });
    tStarts+=st; tDone+=dn; tSkips+=sk; tSecs+=sc; tLikes+=likes.filter(x=>x[1]===1).length;
    return { nm, st, dn, sk, sc, likes: likes.filter(x=>x[1]===1).map(x=>title[x[0]]||x[0]), dislikes: likes.filter(x=>x[1]===-1).map(x=>title[x[0]]||x[0]), at: m.at && m.at.toDate ? m.at.toDate() : null };
  });
  let sortKey='starts', dir=-1;
  const cols = [['title','Song'],['starts','Plays'],['completes','Full'],['skips','Skipped'],['rate','Full %'],['likes','👍'],['dislikes','👎'],['dls','Clips'],['secs','Listened']];
  const list = () => Object.values(per).map(r => ({ ...r, title: title[r.k]||r.k, rate: r.starts ? r.completes/r.starts : -1 }));
  function draw(){
    const L = list().sort((a,b) => { const x=a[sortKey], y=b[sortKey]; return (typeof x==='string' ? x.localeCompare(y) : (x-y)) * dir; });
    el.innerHTML =
      '<div class="mcards"><div class="mcard"><b>'+users.length+'</b><small>listeners</small></div><div class="mcard"><b>'+tStarts+'</b><small>plays</small></div><div class="mcard"><b>'+pct(tDone,tStarts)+'</b><small>played all the way</small></div><div class="mcard"><b>'+tSkips+'</b><small>skips</small></div><div class="mcard"><b>'+tLikes+'</b><small>likes</small></div><div class="mcard"><b>'+tDl+'</b><small>clips downloaded</small></div><div class="mcard"><b>'+mins(tSecs)+'</b><small>listened</small></div></div>'+
      (L.length ? '<h3>By song</h3><p style="color:var(--sub,#8F8B84);margin:0 0 8px">Tap a column to sort. Tap a song to see who liked, disliked or skipped it. "Full" = played to the end (90%+); "Skipped" = moved on before that.</p><div class="msx"><table class="mstat"><thead><tr>'+cols.map(c=>'<th data-k="'+c[0]+'">'+c[1]+(sortKey===c[0]?(dir<0?' ▾':' ▴'):'')+'</th>').join('')+'</tr></thead><tbody>'+
        L.map((r,i) => '<tr data-i="'+i+'" style="cursor:pointer"><td>'+esc(r.title)+'</td><td>'+r.starts+'</td><td>'+r.completes+'</td><td>'+r.skips+'</td><td>'+(r.rate<0?'–':Math.round(r.rate*100)+'%')+'</td><td class="mup">'+r.likes+'</td><td class="mdn">'+r.dislikes+'</td><td>'+r.dls+'</td><td>'+mins(r.secs)+'</td></tr>'+
          '<tr class="mwho" data-w="'+i+'" hidden><td colspan="9">'+(r.liked.length?'👍 '+esc(r.liked.join(', '))+'<br>':'')+(r.disliked.length?'👎 '+esc(r.disliked.join(', '))+'<br>':'')+(r.skippers.length?'⏭ Skipped by '+esc(r.skippers.join(', ')):'')+(!r.liked.length&&!r.disliked.length&&!r.skippers.length?'No likes or skips yet.':'')+'</td></tr>').join('')+
        '</tbody></table></div>' : '<p>No plays yet. Stats show up here once people start listening.</p>')+
      (ppl.length ? '<h3>By person</h3><div class="msx"><table class="mstat"><thead><tr><th>Person</th><th>Plays</th><th>Full</th><th>Skipped</th><th>Listened</th><th>Last</th></tr></thead><tbody>'+
        ppl.sort((a,b)=>b.st-a.st).map(u => '<tr><td>'+esc(u.nm)+'</td><td>'+u.st+'</td><td>'+u.dn+'</td><td>'+u.sk+'</td><td>'+mins(u.sc)+'</td><td>'+(u.at?u.at.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'–')+'</td></tr>'+
          ((u.likes.length||u.dislikes.length)?'<tr class="mwho"><td colspan="6">'+(u.likes.length?'👍 '+esc(u.likes.join(', '))+'<br>':'')+(u.dislikes.length?'👎 '+esc(u.dislikes.join(', ')):'')+'</td></tr>':'')).join('')+'</tbody></table></div>' : '');
    el.querySelectorAll('th[data-k]').forEach(th => th.onclick = () => { const k=th.dataset.k; if(sortKey===k) dir=-dir; else { sortKey=k; dir = k==='title'?1:-1; } draw(); });
    el.querySelectorAll('tr[data-i]').forEach(tr => tr.onclick = () => { const w=el.querySelector('tr[data-w="'+tr.dataset.i+'"]'); w.hidden=!w.hidden; });
  }
  draw();
}

// Team top lists for the music Home page: most played and most liked (coach writes content/musicTop).
export async function computeTop(fs){
  const mem = await getDocs(collection(fs,'members'));
  const docs = await Promise.all(mem.docs.map(d => getDoc(doc(fs,'data','users',d.id,'music')).then(x => x.exists() ? x.data() : null).catch(() => null)));
  const c = {};
  docs.filter(Boolean).forEach(m => {
    Object.entries(m.plays||{}).forEach(([k,v]) => { const r = c[k] || (c[k] = { p:0, f:0, l:0, d:0 }); r.p += v.starts||0; r.f += v.completes||0; });
    Object.entries(m.likes||{}).forEach(([k,v]) => { const r = c[k] || (c[k] = { p:0, f:0, l:0, d:0 }); if(v===1) r.l++; else if(v===-1) r.d++; });
  });
  const E = Object.entries(c);
  const played = E.filter(([,r]) => r.p > 0).sort((a,b) => (b[1].p - a[1].p) || (b[1].f - a[1].f)).slice(0,12).map(x => x[0]);
  const liked = E.filter(([,r]) => r.l > 0).sort((a,b) => (b[1].l - b[1].d) - (a[1].l - a[1].d) || (b[1].l - a[1].l)).slice(0,12).map(x => x[0]);
  const counts = {}; [...new Set([...played, ...liked])].forEach(k => counts[k] = { p: c[k].p, l: c[k].l });
  return { played, liked, counts };
}

// Who can listen: the music switch lives on billing/{uid}.music so both the coach and the admin can flip it
// (members/{uid}.music from the first version still counts). Turning music on for someone not yet approved approves them.
const COACH_EMAILS = ['reefwtraining@gmail.com','reefwtraining+bodybox@gmail.com'];
export async function renderAccess(fs, el, coachMode){
  addCss(); el.classList.add('mstats');
  el.innerHTML = '<p style="color:#8F8B84">Loading…</p>';
  let mem, bill;
  try{ [mem, bill] = await Promise.all([getDocs(collection(fs,'members')), getDocs(collection(fs,'billing'))]); }catch(e){ el.textContent = "Couldn't load the member list."; return; }
  const B = Object.fromEntries(bill.docs.map(d => [d.id, d.data()]));
  const rows = mem.docs.map(d => ({ id:d.id, ...d.data() })).filter(m => m.email && !COACH_EMAILS.includes(String(m.email).toLowerCase()))
    .map(m => ({ ...m, on: m.music === true || (B[m.id] && B[m.id].music === true) }))
    .sort((a,b) => (b.on - a.on) || String(a.name||a.email).localeCompare(String(b.name||b.email)));
  el.innerHTML = '<div class="mlst">' + (rows.map(m => '<div class="mlrow"><div class="mwho2"><b>'+esc(m.name||m.email)+'</b><small>'+esc(m.email)+(m.approved && !m.musicOnly ? ' · app member' : ' · music only')+'</small></div><button class="mtg" role="switch" aria-checked="'+m.on+'" aria-label="Music for '+esc(m.name||m.email)+'" data-id="'+m.id+'"></button></div>').join('') || '<p>No accounts yet.</p>') + '</div>';
  el.onclick = async e => { const t = e.target.closest('.mtg'); if(!t) return; const m = rows.find(x => x.id === t.dataset.id); const on = t.getAttribute('aria-checked') !== 'true'; t.disabled = true;
    try{
      await setDoc(doc(fs,'billing',m.id), { music: on }, { merge:true });
      if(on && m.approved !== true){ const upd = { approved:true, approvedAt: serverTimestamp() }; if(coachMode) upd.musicOnly = true; await updateDoc(doc(fs,'members',m.id), upd); m.approved = true; }
      if(!on && m.music === true && coachMode){ await updateDoc(doc(fs,'members',m.id), { music:false }); m.music = false; }
      m.on = on; t.setAttribute('aria-checked', String(on));
    }catch(err){ alert("Couldn't change that. Try again."); }
    t.disabled = false; };
}
