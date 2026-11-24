// BODYBOX Music song stats: likes, dislikes, full plays and skips per song and per person.
// Shared by the music page (coach tab) and the admin page. Reads data/users/{uid}/music for every member.
import { doc, getDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct = (a,b) => b ? Math.round(a*100/b)+'%' : '–';
const mins = s => s ? (s>=3600 ? (s/3600).toFixed(1)+' h' : Math.round(s/60)+' min') : '0 min';
export async function renderStats(fs, el, songs){
  el.innerHTML = '<p style="color:var(--sub,#8F8B84)">Loading song stats…</p>';
  const title = Object.fromEntries((songs||[]).map(x => [x.k, x.title]));
  let mem; try{ mem = await getDocs(collection(fs,'members')); }catch(e){ el.textContent = "Couldn't load members."; return; }
  const people = mem.docs.map(d => ({ uid:d.id, ...d.data() }));
  const rows = await Promise.all(people.map(p => getDoc(doc(fs,'data','users',p.uid,'music')).then(d => d.exists() ? { p, m:d.data() } : null).catch(() => null)));
  const users = rows.filter(Boolean);
  const per = {}; const S = k => per[k] || (per[k] = { k, likes:0, dislikes:0, starts:0, completes:0, skips:0, secs:0, liked:[], disliked:[], skippers:[] });
  let tStarts=0,tDone=0,tSkips=0,tSecs=0,tLikes=0;
  const ppl = users.map(({p,m}) => {
    const nm = p.name || p.email || 'Someone'; let st=0,dn=0,sk=0,sc=0;
    Object.entries(m.plays||{}).forEach(([k,v]) => { const r=S(k); r.starts+=v.starts||0; r.completes+=v.completes||0; r.skips+=v.skips||0; r.secs+=v.secs||0;
      st+=v.starts||0; dn+=v.completes||0; sk+=v.skips||0; sc+=v.secs||0; if(v.skips) r.skippers.push(nm+(v.skips>1?' ×'+v.skips:'')); });
    const likes = Object.entries(m.likes||{});
    likes.forEach(([k,v]) => { const r=S(k); if(v===1){ r.likes++; r.liked.push(nm); } else if(v===-1){ r.dislikes++; r.disliked.push(nm); } });
    tStarts+=st; tDone+=dn; tSkips+=sk; tSecs+=sc; tLikes+=likes.filter(x=>x[1]===1).length;
    return { nm, st, dn, sk, sc, likes: likes.filter(x=>x[1]===1).map(x=>title[x[0]]||x[0]), dislikes: likes.filter(x=>x[1]===-1).map(x=>title[x[0]]||x[0]), at: m.at && m.at.toDate ? m.at.toDate() : null };
  });
  let sortKey='starts', dir=-1;
  const cols = [['title','Song'],['starts','Plays'],['completes','Full'],['skips','Skipped'],['rate','Full %'],['likes','👍'],['dislikes','👎'],['secs','Listened']];
  const list = () => Object.values(per).map(r => ({ ...r, title: title[r.k]||r.k, rate: r.starts ? r.completes/r.starts : -1 }));
  function draw(){
    const L = list().sort((a,b) => { const x=a[sortKey], y=b[sortKey]; return (typeof x==='string' ? x.localeCompare(y) : (x-y)) * dir; });
    el.innerHTML =
      '<div class="cards"><div class="card"><b>'+users.length+'</b><small>listeners</small></div><div class="card"><b>'+tStarts+'</b><small>plays</small></div><div class="card"><b>'+pct(tDone,tStarts)+'</b><small>played all the way</small></div><div class="card"><b>'+tSkips+'</b><small>skips</small></div><div class="card"><b>'+tLikes+'</b><small>likes</small></div><div class="card"><b>'+mins(tSecs)+'</b><small>listened</small></div></div>'+
      (L.length ? '<h3>By song</h3><p style="color:var(--sub,#8F8B84);margin:0 0 8px">Tap a column to sort. Tap a song to see who liked, disliked or skipped it. "Full" = played to the end (90%+); "Skipped" = moved on before that.</p><div class="sx"><table class="stat"><thead><tr>'+cols.map(c=>'<th data-k="'+c[0]+'">'+c[1]+(sortKey===c[0]?(dir<0?' ▾':' ▴'):'')+'</th>').join('')+'</tr></thead><tbody>'+
        L.map((r,i) => '<tr data-i="'+i+'" style="cursor:pointer"><td>'+esc(r.title)+'</td><td>'+r.starts+'</td><td>'+r.completes+'</td><td>'+r.skips+'</td><td>'+(r.rate<0?'–':Math.round(r.rate*100)+'%')+'</td><td class="up">'+r.likes+'</td><td class="dn">'+r.dislikes+'</td><td>'+mins(r.secs)+'</td></tr>'+
          '<tr class="who" data-w="'+i+'" hidden><td colspan="8">'+(r.liked.length?'👍 '+esc(r.liked.join(', '))+'<br>':'')+(r.disliked.length?'👎 '+esc(r.disliked.join(', '))+'<br>':'')+(r.skippers.length?'⏭ Skipped by '+esc(r.skippers.join(', ')):'')+(!r.liked.length&&!r.disliked.length&&!r.skippers.length?'No likes or skips yet.':'')+'</td></tr>').join('')+
        '</tbody></table></div>' : '<p>No plays yet. Stats show up here once people start listening.</p>')+
      (ppl.length ? '<h3>By person</h3><div class="sx"><table class="stat"><thead><tr><th>Person</th><th>Plays</th><th>Full</th><th>Skipped</th><th>Listened</th><th>Last</th></tr></thead><tbody>'+
        ppl.sort((a,b)=>b.st-a.st).map(u => '<tr><td>'+esc(u.nm)+'</td><td>'+u.st+'</td><td>'+u.dn+'</td><td>'+u.sk+'</td><td>'+mins(u.sc)+'</td><td>'+(u.at?u.at.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'–')+'</td></tr>'+
          ((u.likes.length||u.dislikes.length)?'<tr class="who"><td colspan="6">'+(u.likes.length?'👍 '+esc(u.likes.join(', '))+'<br>':'')+(u.dislikes.length?'👎 '+esc(u.dislikes.join(', ')):'')+'</td></tr>':'')).join('')+'</tbody></table></div>' : '');
    el.querySelectorAll('th[data-k]').forEach(th => th.onclick = () => { const k=th.dataset.k; if(sortKey===k) dir=-dir; else { sortKey=k; dir = k==='title'?1:-1; } draw(); });
    el.querySelectorAll('tr[data-i]').forEach(tr => tr.onclick = () => { const w=el.querySelector('tr[data-w="'+tr.dataset.i+'"]'); w.hidden=!w.hidden; });
  }
  draw();
}
