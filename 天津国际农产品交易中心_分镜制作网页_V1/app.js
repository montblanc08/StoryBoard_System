(() => {
  'use strict';
  const STORAGE_KEY = 'tianjin-storyboard-web-v1';
  const initial = (window.STORYBOARD_SHOTS || []).map(item => ({...item}));
  let shots = loadSaved() || initial;
  let activeImageId = null;
  let toastTimer = null;

  const $ = id => document.getElementById(id);
  const body = $('storyboardBody');
  const chapterFilter = $('chapterFilter');
  const searchInput = $('searchInput');
  const colors = ['#e5bc46','#90ad4f','#5e9ab8','#b47e9f','#df8055'];

  function loadSaved() {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }
  function save(showMessage = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shots));
      $('saveState').textContent = `已保存 · ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`;
      if (showMessage) toast('已保存到当前浏览器');
    } catch {
      $('saveState').textContent = '保存空间不足，请先导出 JSON';
      toast('浏览器保存空间不足，建议导出 JSON 备份');
    }
  }
  function scheduleSave() {
    $('saveState').textContent = '有未保存修改';
    clearTimeout(scheduleSave.timer);
    scheduleSave.timer = setTimeout(() => save(false), 700);
  }
  function escapeHtml(value='') {
    return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }
  function filePath(value='') { return encodeURI(value).replace(/#/g,'%23'); }
  function formatTime(seconds) {
    const value = Math.max(0, Math.round(Number(seconds)||0));
    return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;
  }
  function uniqueChapters() { return [...new Set(shots.map(s => s.chapter).filter(Boolean))]; }
  function populateChapters() {
    const current = chapterFilter.value;
    chapterFilter.innerHTML = '<option value="">全部篇章</option>' + uniqueChapters().map(c => `<option>${escapeHtml(c)}</option>`).join('');
    chapterFilter.value = uniqueChapters().includes(current) ? current : '';
  }
  function updateSummary() {
    const total = shots.reduce((sum,s) => sum + (Number(s.duration)||0),0);
    $('shotCount').textContent = shots.length;
    $('totalSeconds').textContent = total.toFixed(1);
    $('totalMinutes').textContent = formatTime(total);
    const totals = uniqueChapters().map((chapter,index) => ({
      chapter, index, duration: shots.filter(s=>s.chapter===chapter).reduce((sum,s)=>sum+(Number(s.duration)||0),0)
    }));
    $('chapterProgress').innerHTML = `<div class="progress-title"><span>篇章时长分布</span><span>${totals.length} 个篇章</span></div>
      <div class="progress-bar">${totals.map(x=>`<span class="progress-segment" style="width:${total?x.duration/total*100:0}%;background:${colors[x.index%colors.length]}" title="${escapeHtml(x.chapter)} ${x.duration.toFixed(1)}秒"></span>`).join('')}</div>
      <div class="progress-labels">${totals.map(x=>`<span><i style="background:${colors[x.index%colors.length]}"></i>${escapeHtml(x.chapter.replace(/^篇章./,'篇章'))} · ${x.duration.toFixed(0)}s</span>`).join('')}</div>`;
  }
  function filteredShots() {
    const query = searchInput.value.trim().toLowerCase();
    const chapter = chapterFilter.value;
    return shots.filter(s => (!chapter || s.chapter===chapter) && (!query || [s.id,s.location,s.description,s.voiceover,s.chapter,s.method].join(' ').toLowerCase().includes(query)));
  }
  const edit = (field,value) => `<div class="editable" contenteditable="true" spellcheck="false" data-field="${field}">${escapeHtml(value||'')}</div>`;
  function rowTemplate(shot,index) {
    const src = shot.customImage || shot.image;
    const reference = shot.sourcePage ? `<a class="source-link" href="${escapeHtml(shot.sourcePage)}" target="_blank" rel="noopener">查看来源</a>` : '<span class="source-link">参考视频截帧</span>';
    return `<tr data-id="${escapeHtml(shot.uid)}">
      <td class="col-order"><div class="row-order"><button class="mini-button move-up" title="上移" aria-label="上移镜头">↑</button><button class="mini-button move-down" title="下移" aria-label="下移镜头">↓</button></div></td>
      <td class="col-id"><div class="shot-id">${String(index+1).padStart(3,'0')}</div></td>
      <td class="col-image"><div class="frame" data-preview="${escapeHtml(src)}"><img src="${filePath(src)}" alt="镜头${index+1} ${escapeHtml(shot.location)}" loading="lazy"><button class="frame-overlay replace-image" type="button">替换图片</button></div></td>
      <td class="col-reference"><div class="reference-cell"><span class="source-badge">${escapeHtml(shot.sourceType||shot.method||'参考素材')}</span>${reference}</div></td>
      <td class="col-small">${edit('shotSize',shot.shotSize)}</td>
      <td class="col-duration"><input class="duration-input" type="number" min="0" step="0.1" value="${Number(shot.duration)||0}" aria-label="镜头时长"></td>
      <td class="col-content">${edit('description',shot.description)}</td>
      <td class="col-notes">${edit('voiceover',shot.voiceover)}</td>
      <td class="col-location">${edit('location',shot.location)}</td>
      <td class="col-sound">${edit('sound',shot.sound)}</td>
      <td class="col-angle">${edit('angle',shot.angle)}</td>
      <td class="col-movement">${edit('movement',shot.movement)}</td>
      <td class="col-equipment">${edit('equipment',shot.equipment)}</td>
      <td class="col-focal">${edit('focal',shot.focal)}</td>
      <td class="col-scene">${edit('chapter',shot.chapter)}</td>
      <td class="col-actions"><div class="actions"><button class="action-button duplicate" type="button">复制</button><button class="action-button delete" type="button">删除</button></div></td>
    </tr>`;
  }
  function render() {
    const filtered = filteredShots();
    body.innerHTML = filtered.map(shot => rowTemplate(shot, shots.indexOf(shot))).join('');
    $('emptyState').hidden = filtered.length > 0;
    updateSummary();
  }
  function getShot(row) { return shots.find(s => s.uid === row.dataset.id); }
  function addShot(afterUid = null) {
    const uid = `shot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item = {uid,id:shots.length+1,chapter:'未分篇章',image:'',customImage:'',duration:3,location:'新场景',method:'待定',shotSize:'全景',voiceover:'',camera:'',description:'输入画面内容',sound:'',angle:'',movement:'固定',equipment:'待定',focal:'待定',sourceType:'自建镜头',sourcePage:''};
    const index = afterUid ? shots.findIndex(s=>s.uid===afterUid)+1 : shots.length;
    shots.splice(index,0,item); renumber(); populateChapters(); render(); save(false); toast('已新建镜头');
  }
  function renumber() { shots.forEach((s,i)=>s.id=i+1); }
  function move(uid,delta) {
    const index=shots.findIndex(s=>s.uid===uid), target=index+delta;
    if(index<0||target<0||target>=shots.length) return;
    [shots[index],shots[target]]=[shots[target],shots[index]]; renumber(); render(); scheduleSave();
  }
  function toast(message) {
    const node=$('toast'); node.textContent=message; node.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.classList.remove('show'),2200);
  }
  function download(name,content,type) {
    const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  body.addEventListener('input', event => {
    const row=event.target.closest('tr'); if(!row) return; const shot=getShot(row); if(!shot) return;
    if(event.target.matches('.editable')) shot[event.target.dataset.field]=event.target.innerText.trim();
    if(event.target.matches('.duration-input')) shot.duration=Number(event.target.value)||0;
    updateSummary(); scheduleSave();
  });
  body.addEventListener('click', event => {
    const row=event.target.closest('tr'); if(!row) return; const shot=getShot(row); if(!shot) return;
    if(event.target.closest('.move-up')) move(shot.uid,-1);
    else if(event.target.closest('.move-down')) move(shot.uid,1);
    else if(event.target.closest('.duplicate')) { const i=shots.indexOf(shot); shots.splice(i+1,0,{...shot,uid:`shot-${Date.now()}-${Math.random().toString(16).slice(2)}`}); renumber(); render(); scheduleSave(); toast('已复制镜头'); }
    else if(event.target.closest('.delete')) { if(confirm(`确认删除镜头 ${String(shots.indexOf(shot)+1).padStart(3,'0')}？`)){ shots.splice(shots.indexOf(shot),1); renumber(); render(); scheduleSave(); } }
    else if(event.target.closest('.replace-image')) { event.stopPropagation(); activeImageId=shot.uid; $('imageInput').click(); }
    else if(event.target.closest('.frame')) { const frame=event.target.closest('.frame'); $('lightboxImage').src=filePath(frame.dataset.preview); $('lightboxImage').alt=`${shot.location}分镜预览`; $('lightboxCaption').textContent=`镜头 ${String(shots.indexOf(shot)+1).padStart(3,'0')} · ${shot.location}`; $('lightbox').hidden=false; }
  });

  $('imageInput').addEventListener('change', event => {
    const file=event.target.files[0]; const shot=shots.find(s=>s.uid===activeImageId); if(!file||!shot) return;
    const reader=new FileReader(); reader.onload=()=>{ const img=new Image(); img.onload=()=>{ const canvas=document.createElement('canvas'); canvas.width=960; canvas.height=540; const ctx=canvas.getContext('2d'); const scale=Math.max(960/img.width,540/img.height); const w=img.width*scale,h=img.height*scale; ctx.drawImage(img,(960-w)/2,(540-h)/2,w,h); shot.customImage=canvas.toDataURL('image/jpeg',.78); render(); scheduleSave(); toast('图片已替换'); }; img.src=reader.result; }; reader.readAsDataURL(file); event.target.value='';
  });
  $('lightboxClose').addEventListener('click',()=>{$('lightbox').hidden=true;});
  $('lightbox').addEventListener('click',e=>{if(e.target===$('lightbox')) $('lightbox').hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('lightbox').hidden=true;$('moreMenu').hidden=true;}});

  searchInput.addEventListener('input',render); chapterFilter.addEventListener('change',render);
  $('clearFilterButton').addEventListener('click',()=>{searchInput.value='';chapterFilter.value='';render();});
  $('densitySelect').addEventListener('change',e=>document.body.classList.toggle('compact',e.target.value==='compact'));
  $('addShotButton').addEventListener('click',()=>addShot()); $('saveButton').addEventListener('click',()=>save()); $('printButton').addEventListener('click',()=>window.print());
  $('moreButton').addEventListener('click',()=>{const menu=$('moreMenu');menu.hidden=!menu.hidden;$('moreButton').setAttribute('aria-expanded',String(!menu.hidden));});
  $('exportButton').addEventListener('click',()=>download(`天津国际农产品交易中心_分镜_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(shots,null,2),'application/json'));
  $('importInput').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data))throw new Error();shots=data;renumber();populateChapters();render();save(false);toast('JSON已导入');}catch{toast('JSON格式不正确');}};reader.readAsText(file,'utf-8');event.target.value='';});
  $('resetButton').addEventListener('click',()=>{if(confirm('确认恢复到初始80镜？当前浏览器内的修改将被清除。')){shots=initial.map(x=>({...x}));localStorage.removeItem(STORAGE_KEY);populateChapters();render();toast('已恢复初始数据');}});
  document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrap')){$('moreMenu').hidden=true;$('moreButton').setAttribute('aria-expanded','false');}});

  populateChapters(); render();
})();
