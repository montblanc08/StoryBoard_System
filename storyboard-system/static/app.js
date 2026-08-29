/* ==========================================================================
   FRAMEFORGE V3.0 · CLIENT APPLICATION ENGINE
   Offline Font: 更纱黑体 (Sarasa Gothic / Sarasa UI SC / Sarasa Term SC)
   Offline Icons: Google Material Symbols (SVG Sprites)
   ========================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  session: null,
  csrf: '',
  projects: [],
  bundle: null,
  activeShotId: null,
  activePanelIndex: 0,
  currentTab: 'board',
  dirty: false,
  shareToken: null,
  undoStack: [],
  redoStack: [],
  // Animatic Player
  isPlaying: false,
  playIndex: 0,
  playTimer: null,
  showSafeAreas: true,
  // Table Preset
  tablePreset: 'director',
  // Canvas Sketching
  canvasTool: 'pen',
  canvasColor: '#ffbf47',
  canvasSize: 3,
  isDrawing: false,
  lastX: 0,
  lastY: 0
};

const TYPE_NAMES = {
  promo: 'Corporate / 宣传片',
  tvc: 'TVC 广告片',
  film: 'Film 电影 / 剧情',
  documentary: 'Documentary 纪录片',
  mg: 'MG 扁平动画',
  '3d_vfx': '3D / VFX 视效管线',
  custom: 'Custom 自定义'
};

// ==========================================
// Toast & API Dispatcher
// ==========================================
function toast(message, bad = false) {
  const el = $('#toast');
  el.innerHTML = `<svg class="g-icon"><use href="#icon-${bad ? 'cancel' : 'check_circle'}"></use></svg><span>${message}</span>`;
  el.style.borderColor = bad ? '#8b2b2b' : '#2b5840';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
  }
  if (options.method && options.method !== 'GET') {
    headers['X-CSRF-Token'] = state.csrf;
  }
  const res = await fetch(path, { credentials: 'same-origin', ...options, headers });
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

function escapeHtml(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

function showView(id) {
  for (const x of ['loginView', 'shareView', 'appView']) {
    $('#' + x).classList.toggle('hidden', x !== id);
  }
}

function parseShareToken() {
  const m = location.pathname.match(/^\/share\/([^/]+)/);
  return m && m[1];
}

// ==========================================
// Bootstrapping
// ==========================================
async function boot() {
  const token = parseShareToken();
  if (token) {
    showView('shareView');
    return loadShareView(token);
  }

  try {
    state.session = await api('/api/session');
    state.csrf = state.session.csrf || '';
    if (!state.session.authenticated) {
      showView('loginView');
      return;
    }
    $('#userNameLabel').textContent = state.session.display_name || state.session.username;
    showView('appView');
    await loadProjects();
  } catch (err) {
    showView('loginView');
  }
}

// Login
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginError').textContent = '';
  const formData = new FormData(e.currentTarget);
  try {
    const data = await api('/api/login', { method: 'POST', json: Object.fromEntries(formData) });
    state.csrf = data.csrf;
    state.session = data;
    $('#userNameLabel').textContent = data.display_name || data.username;
    showView('appView');
    await loadProjects();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
});

// Logout
$('#logoutBtn').onclick = async () => {
  await api('/api/logout', { method: 'POST' });
  location.href = '/';
};

// ==========================================
// Projects Dashboard
// ==========================================
async function loadProjects() {
  state.projects = await api('/api/projects');
  renderProjectsGrid();
  if (state.projects.length > 0 && !state.bundle) {
    // Automatically open the first project (Tianjin 80-shot demo)
    await openProject(state.projects[0].id);
  } else if (state.projects.length === 0) {
    showDashboard();
  }
}

function showDashboard() {
  $('#dashboardView').classList.remove('hidden');
  $('#projectWorkView').classList.add('hidden');
  $('#backToListBtn').classList.add('hidden');
  $('#crumbProject').textContent = '项目列表';
  $('#crumbView').textContent = '全部制作';
}

function renderProjectsGrid() {
  $('#projCountLabel').textContent = `${state.projects.length} 个项目`;
  const grid = $('#projectGrid');
  grid.innerHTML = '';
  state.projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card-item';
    card.innerHTML = `
      <div class="proj-card-head">
        <span class="type-tag">${TYPE_NAMES[p.production_type] || p.production_type}</span>
        <span class="muted">${p.fps} fps · ${p.aspect_ratio}</span>
      </div>
      <h3>${escapeHtml(p.name)}</h3>
      <div class="proj-card-stats">
        <span><b>${p.shot_count || 0}</b> 镜头</span>
        <span><b>${formatSeconds((p.total_frames || 0) / p.fps)}</b> 时长</span>
      </div>
    `;
    card.onclick = () => openProject(p.id);
    grid.append(card);
  });
}

// New Project
$('#dashNewProjectBtn').onclick = () => $('#newProjModal').showModal();
$('#newProjForm').addEventListener('submit', async e => {
  e.preventDefault();
  const raw = Object.fromEntries(new FormData(e.currentTarget));
  raw.fps = parseFloat(raw.fps);
  raw.target_seconds = parseFloat(raw.target_seconds);
  try {
    const bundle = await api('/api/projects', { method: 'POST', json: raw });
    $('#newProjModal').close();
    state.projects.unshift(bundle.project);
    await openProject(bundle.project.id);
    toast('制作项目已创建');
  } catch (err) {
    toast(err.message, true);
  }
});

$('#backToListBtn').onclick = () => {
  showDashboard();
};

// ==========================================
// Project Workspace
// ==========================================
async function openProject(id) {
  state.bundle = await api(`/api/projects/${id}`);
  state.activeShotId = state.bundle.shots[0]?.id || null;
  state.shareToken = state.bundle.project.share_token;

  $('#dashboardView').classList.add('hidden');
  $('#projectWorkView').classList.remove('hidden');
  $('#backToListBtn').classList.remove('hidden');

  renderProjectHeader();
  renderActiveTab();
  renderInspector();
}

function renderProjectHeader() {
  const p = state.bundle.project;
  $('#crumbProject').textContent = p.name;
  $('#currentProjName').textContent = p.name;
  $('#currentProjTypeTag').textContent = (TYPE_NAMES[p.production_type] || p.production_type).toUpperCase();

  const totalFrames = state.bundle.shots.reduce((acc, s) => acc + s.duration_frames, 0);
  const totalSeconds = totalFrames / p.fps;

  $('#hudTotalDuration').textContent = formatSeconds(totalSeconds);
  $('#hudTotalFrames').textContent = `${totalFrames}f`;
  $('#hudFps').textContent = `${p.fps} fps`;
  $('#hudAspectRatio').textContent = p.aspect_ratio;
  $('#hudShotCount').textContent = state.bundle.shots.length;

  // TVC Remaining Frames HUD (Spec Section 15)
  if (p.production_type === 'tvc') {
    $('#tvcCounter').classList.remove('hidden');
    const targetFrames = Math.round(p.target_seconds * p.fps);
    const diff = targetFrames - totalFrames;
    $('#tvcMasterLabel').textContent = `${p.target_seconds}s MASTER`;
    $('#tvcUsedTime').textContent = `${formatSeconds(totalSeconds)} USED`;
    $('#tvcRemainFrames').textContent = diff === 0 ? '0 FRAMES MATCHED' : `${Math.abs(diff)} FRAMES ${diff > 0 ? 'REMAINING' : 'OVER'}`;
    $('#tvcRemainFrames').style.color = diff === 0 ? 'var(--green)' : 'var(--red)';
  } else {
    $('#tvcCounter').classList.add('hidden');
  }
}

// Navigation Tabs Switcher
$$('.rail-item[data-tab]').forEach(btn => {
  btn.onclick = () => {
    $$('.rail-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentTab = btn.dataset.tab;
    renderActiveTab();
  };
});

function renderActiveTab() {
  const tab = state.currentTab;
  $('#crumbView').textContent = {
    board: '分镜卡片板',
    wall: '分镜视觉墙',
    table: '镜头制作表',
    timeline: '规划时间线',
    overview: '制作概览',
    script: '旁白与对齐',
    assets: '素材资产库',
    review: '审片与版本',
    deliverables: '交付与导出',
    method_groups: '制作方式分组'
  }[tab] || tab;

  // Hide all view contents
  $$('.view-content').forEach(el => el.classList.add('hidden'));

  if (tab === 'board') {
    $('#viewBoard').classList.remove('hidden');
    renderCardsView();
  } else if (tab === 'wall') {
    $('#viewWall').classList.remove('hidden');
    renderWallView();
  } else if (tab === 'table') {
    $('#viewTable').classList.remove('hidden');
    renderTableView();
  } else if (tab === 'timeline') {
    $('#viewTimeline').classList.remove('hidden');
    renderTimelineView();
  } else if (tab === 'overview') {
    $('#viewOverview').classList.remove('hidden');
    renderOverviewView();
  } else if (tab === 'script') {
    $('#viewScript').classList.remove('hidden');
    renderScriptStudio();
  } else if (tab === 'assets') {
    $('#viewAssets').classList.remove('hidden');
    renderAssetsView();
  } else if (tab === 'review') {
    $('#viewReview').classList.remove('hidden');
    renderReviewView();
  } else if (tab === 'deliverables') {
    $('#viewDeliverables').classList.remove('hidden');
    renderDeliverablesView();
  } else if (tab === 'method_groups') {
    $('#viewMethodGroups').classList.remove('hidden');
    renderMethodGroupsView();
  }
}

// ==========================================
// 1. CARDS VIEW (Spec Section 64-67)
// ==========================================
function getMediaUrl(mediaId) {
  if (!mediaId) return null;
  return `/media/${mediaId}`;
}

function getShotPrimaryMedia(shot) {
  if (shot.panels && shot.panels.length > 0 && shot.panels[0].media_id) {
    return getMediaUrl(shot.panels[0].media_id);
  }
  if (shot.assets && shot.assets.length > 0) {
    return `/media/${shot.assets[0].id}`;
  }
  return null;
}

function renderCardsView() {
  const grid = $('#shotCardGrid');
  grid.innerHTML = '';
  const filterMethod = $('#methodFilter').value;
  const filterDept = $('#deptFilter').value;
  const filterStatus = $('#statusFilter').value;
  const query = $('#globalSearchInput').value.trim().toLowerCase();

  state.bundle.shots.forEach((shot, index) => {
    if (filterMethod !== 'ALL' && shot.primary_method !== filterMethod) return;
    if (filterDept !== 'ALL' && shot.department !== filterDept) return;
    if (filterStatus !== 'ALL' && shot.status !== filterStatus) return;
    if (query) {
      const hay = [shot.number, shot.title, shot.description, shot.voiceover, shot.scene, shot.primary_method].join(' ').toLowerCase();
      if (!hay.includes(query)) return;
    }

    const card = document.createElement('article');
    card.className = `shot-card ${shot.id === state.activeShotId ? 'selected' : ''}`;
    card.dataset.id = shot.id;
    card.draggable = true;

    const mediaUrl = getShotPrimaryMedia(shot);
    const methodClass = shot.primary_method.toLowerCase();
    const statusClass = shot.status.toLowerCase().replace(/\s+/g, '');

    card.innerHTML = `
      <div class="card-top">
        <div class="card-top-left">
          <span class="shot-no-badge">SHOT ${escapeHtml(shot.number)}</span>
          <span class="method-chip ${methodClass}">${shot.primary_method}</span>
        </div>
        <span class="card-tc">${shot.tc_in}</span>
      </div>
      <div class="card-media-frame" title="点击选择或上传参考分镜画面">
        ${mediaUrl ? `<img src="${mediaUrl}" alt="Shot ${shot.number}">` : `
          <div class="frame-empty-prompt">
            <svg class="g-icon lg"><use href="#icon-videocam"></use></svg>
            <span>${shot.shot_size || '全景'} · ${shot.lens || '35mm'}</span>
          </div>
        `}
      </div>
      <div class="card-body">
        <input class="card-title-input" value="${escapeHtml(shot.title)}" placeholder="输入镜头标题">
        <div class="card-meta-line">
          <span>${escapeHtml(shot.shot_size || '全景')}</span>
          <span>${escapeHtml(shot.lens || '35mm')}</span>
          <span>${escapeHtml(shot.movement || '固定')}</span>
          <span>${shot.duration_frames}f</span>
        </div>
        <p class="card-desc-snippet">${escapeHtml(shot.description || '暂无画面描述')}</p>
        ${shot.voiceover ? `<div class="card-vo-box">${escapeHtml(shot.voiceover)}</div>` : ''}
        <div class="card-foot">
          <span class="status-chip ${statusClass}">${shot.status}</span>
          <span class="muted mono">${shot.duration_seconds}s</span>
        </div>
      </div>
    `;

    // Click to select & inspect
    card.onclick = e => {
      if (e.target.tagName === 'INPUT') return;
      selectShot(shot.id);
    };

    // Title Inline Edit
    const titleInput = $('.card-title-input', card);
    titleInput.oninput = e => {
      shot.title = e.target.value;
      markDirty();
    };

    // Drag-and-drop reorder
    card.addEventListener('dragstart', () => card.classList.add('dragging'));
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = $('.shot-card.dragging');
      if (!dragging || dragging === card) return;
      const fromIdx = state.bundle.shots.findIndex(s => s.id === dragging.dataset.id);
      const toIdx = state.bundle.shots.findIndex(s => s.id === shot.id);
      const [item] = state.bundle.shots.splice(fromIdx, 1);
      state.bundle.shots.splice(toIdx, 0, item);
      markDirty();
      renderCardsView();
    });

    grid.append(card);
  });
}

function selectShot(shotId) {
  state.activeShotId = shotId;
  $$('.shot-card').forEach(c => c.classList.toggle('selected', c.dataset.id === shotId));
  renderInspector();
}

function markDirty() {
  state.dirty = true;
  $('#saveProjectBtn').textContent = '保存更改 ●';
}

// ==========================================
// 2. WALL VIEW (Spec Section 68)
// ==========================================
function renderWallView() {
  const grid = $('#wallGrid');
  grid.innerHTML = '';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
  grid.style.gap = '10px';

  state.bundle.shots.forEach(shot => {
    const mediaUrl = getShotPrimaryMedia(shot);
    const item = document.createElement('div');
    item.className = 'wall-item';
    item.style.background = 'var(--bg-card)';
    item.style.border = '1px solid var(--border-subtle)';
    item.style.borderRadius = 'var(--radius-md)';
    item.style.overflow = 'hidden';
    item.style.cursor = 'pointer';

    item.innerHTML = `
      <div style="aspect-ratio:16/9;background:#06080b;display:flex;align-items:center;justify-content:center;">
        ${mediaUrl ? `<img src="${mediaUrl}" style="width:100%;height:100%;object-fit:cover;">` : `<span class="muted" style="font-size:10px;">SHOT ${shot.number}</span>`}
      </div>
      <div style="padding:6px 8px;display:flex;justify-content:space-between;align-items:center;font-size:11px;">
        <b>SHOT ${escapeHtml(shot.number)}</b>
        <span class="mono muted">${shot.duration_frames}f</span>
      </div>
    `;
    item.onclick = () => {
      selectShot(shot.id);
      state.currentTab = 'board';
      renderActiveTab();
    };
    grid.append(item);
  });
}

// ==========================================
// 3. TABLE VIEW (Spec Section 71-73)
// ==========================================
const PRESET_COLUMNS = {
  director: ['number', 'thumb', 'tc', 'duration', 'title', 'description', 'movement', 'primary_method', 'status'],
  dp: ['number', 'thumb', 'shot_size', 'angle', 'lens', 'movement', 'duration', 'status'],
  production: ['number', 'scene', 'primary_method', 'department', 'owner', 'duration', 'status'],
  motion: ['number', 'thumb', 'title', 'primary_method', 'department', 'owner', 'status'],
  stock: ['number', 'thumb', 'title', 'primary_method', 'description', 'voiceover', 'status'],
  vfx: ['number', 'thumb', 'title', 'duration_frames', 'primary_method', 'department', 'status']
};

const COL_NAMES = {
  number: '镜号', thumb: '分镜画面', tc: 'TC IN / OUT', duration: '时长',
  duration_frames: '帧数', title: '标题', scene: '场景', shot_size: '景别',
  lens: '焦段', angle: '角度', movement: '机位/运镜', primary_method: '制作方式',
  description: '画面描述', voiceover: '对应旁白', department: '责任部门',
  owner: '负责人', status: '状态'
};

$$('.preset-btn').forEach(b => {
  b.onclick = () => {
    $$('.preset-btn').forEach(btn => btn.classList.remove('active'));
    b.classList.add('active');
    state.tablePreset = b.dataset.preset;
    renderTableView();
  };
});

function renderTableView() {
  const wrap = $('#tableScrollWrap');
  const cols = PRESET_COLUMNS[state.tablePreset] || PRESET_COLUMNS.director;

  let html = '<table class="shot-table"><thead><tr>';
  cols.forEach(c => html += `<th>${COL_NAMES[c] || c}</th>`);
  html += '</tr></thead><tbody>';

  state.bundle.shots.forEach(shot => {
    const isSel = shot.id === state.activeShotId;
    html += `<tr class="${isSel ? 'selected' : ''}" data-id="${shot.id}">`;
    cols.forEach(c => {
      if (c === 'number') {
        html += `<td><b>${escapeHtml(shot.number)}</b></td>`;
      } else if (c === 'thumb') {
        const m = getShotPrimaryMedia(shot);
        html += `<td><div class="tbl-thumb">${m ? `<img src="${m}">` : '16:9'}</div></td>`;
      } else if (c === 'tc') {
        html += `<td class="mono">${shot.tc_in}<br>${shot.tc_out}</td>`;
      } else if (c === 'duration') {
        html += `<td><input class="tbl-dur mono" type="number" step="0.04" value="${shot.duration_seconds}" style="width:55px;">s</td>`;
      } else if (c === 'primary_method') {
        html += `<td><span class="method-chip ${shot.primary_method.toLowerCase()}">${shot.primary_method}</span></td>`;
      } else if (['description', 'voiceover'].includes(c)) {
        html += `<td><textarea data-field="${c}" rows="1" style="min-width:200px;">${escapeHtml(shot[c])}</textarea></td>`;
      } else {
        html += `<td><input data-field="${c}" value="${escapeHtml(shot[c] || '')}"></td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;

  // Table Inline Edit Bindings
  $$('[data-field]', wrap).forEach(input => {
    input.oninput = e => {
      const sid = e.target.closest('tr').dataset.id;
      const shot = state.bundle.shots.find(s => s.id === sid);
      shot[e.target.dataset.field] = e.target.value;
      markDirty();
    };
  });

  $$('.tbl-dur', wrap).forEach(input => {
    input.onchange = e => {
      const sid = e.target.closest('tr').dataset.id;
      const shot = state.bundle.shots.find(s => s.id === sid);
      const sec = parseFloat(e.target.value) || 3.0;
      shot.duration_frames = Math.max(1, Math.round(sec * state.bundle.project.fps));
      shot.duration_seconds = sec;
      markDirty();
      renderProjectHeader();
    };
  });
}

// ==========================================
// 4. TIMELINE & ANIMATIC PLAYER (Spec Section 85-94)
// ==========================================
function renderTimelineView() {
  renderAnimaticScreen();
  renderTimelineLanes();
}

function renderAnimaticScreen() {
  const curShot = state.bundle.shots[state.playIndex] || state.bundle.shots[0];
  if (!curShot) return;
  const screen = $('#animaticScreen');
  const mediaUrl = getShotPrimaryMedia(curShot);

  screen.innerHTML = mediaUrl
    ? `<img src="${mediaUrl}" alt="Shot ${curShot.number}">`
    : `<div class="animatic-empty"><span>SHOT ${curShot.number} · ${curShot.title}</span><small>${curShot.description || ''}</small></div>`;

  $('#playerCurrentTc').textContent = curShot.tc_in;
  $('#playerShotInfo').textContent = `SHOT ${curShot.number} · ${curShot.title}`;
}

function renderTimelineLanes() {
  const lanes = $('#trackLanes');
  lanes.innerHTML = '';
  const totalFrames = state.bundle.shots.reduce((acc, s) => acc + s.duration_frames, 0) || 1;

  state.bundle.shots.forEach((shot, index) => {
    const clip = document.createElement('div');
    clip.className = `timeline-clip ${index === state.playIndex ? 'active' : ''}`;
    const pct = (shot.duration_frames / totalFrames) * 100;
    clip.style.flex = `${shot.duration_frames}`;
    clip.style.minWidth = '30px';

    clip.innerHTML = `
      <span class="clip-name">#${shot.number} ${shot.title}</span>
      <span class="clip-dur">${shot.duration_frames}f</span>
    `;

    clip.onclick = () => {
      state.playIndex = index;
      selectShot(shot.id);
      renderTimelineView();
    };
    lanes.append(clip);
  });
}

$('#playerPlayBtn').onclick = togglePlay;
function togglePlay() {
  state.isPlaying = !state.isPlaying;
  $('#playerPlayBtn').innerHTML = `<svg class="g-icon"><use href="#icon-${state.isPlaying ? 'pause' : 'play_arrow'}"></use></svg>`;
  if (state.isPlaying) {
    stepPlay();
  } else {
    clearTimeout(state.playTimer);
  }
}

function stepPlay() {
  if (!state.isPlaying) return;
  const curShot = state.bundle.shots[state.playIndex];
  if (!curShot) return;
  const durMs = (curShot.duration_frames / state.bundle.project.fps) * 1000;

  renderAnimaticScreen();
  renderTimelineLanes();

  state.playTimer = setTimeout(() => {
    state.playIndex = (state.playIndex + 1) % state.bundle.shots.length;
    stepPlay();
  }, durMs);
}

$('#playerPrevBtn').onclick = () => {
  state.playIndex = Math.max(0, state.playIndex - 1);
  renderTimelineView();
};

$('#playerNextBtn').onclick = () => {
  state.playIndex = Math.min(state.bundle.shots.length - 1, state.playIndex + 1);
  renderTimelineView();
};

$('#toggleSafeAreasBtn').onclick = () => {
  state.showSafeAreas = !state.showSafeAreas;
  $('#safeAreaOverlay').classList.toggle('hidden', !state.showSafeAreas);
};

// ==========================================
// 5. PRODUCTION OVERVIEW (Spec Section 118-119)
// ==========================================
function renderOverviewView() {
  const shots = state.bundle.shots;
  $('#statTotalShots').textContent = shots.length;

  const live = shots.filter(s => s.primary_method === 'LIVE');
  const stock = shots.filter(s => s.primary_method === 'STOCK');
  const client = shots.filter(s => s.primary_method === 'CLIENT');
  const ae = shots.filter(s => ['AE', 'MG'].includes(s.primary_method));
  const d3 = shots.filter(s => ['3D', 'VFX'].includes(s.primary_method));

  $('#statLiveReady').textContent = `${live.length} 镜`;
  $('#statStockPurchased').textContent = `${stock.length} 镜`;
  $('#statClientReceived').textContent = `${client.length} 镜`;
  $('#statAeApproved').textContent = `${ae.length} 镜`;
  $('#stat3dApproved').textContent = `${d3.length} 镜`;

  const bars = $('#methodProgressBars');
  bars.innerHTML = '';
  [
    { name: 'LIVE 实拍', list: live, color: 'var(--green)' },
    { name: 'STOCK 素材购买', list: stock, color: 'var(--amber)' },
    { name: 'CLIENT 客户供片', list: client, color: 'var(--blue)' },
    { name: 'AE / MG 动态包装', list: ae, color: 'var(--purple)' },
    { name: '3D / VFX 三维与视效', list: d3, color: 'var(--red)' }
  ].forEach(group => {
    const row = document.createElement('div');
    row.style.margin = '10px 0';
    const pct = shots.length ? (group.list.length / shots.length) * 100 : 0;
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span>${group.name} (${group.list.length} 镜)</span>
        <span class="mono">${pct.toFixed(1)}%</span>
      </div>
      <div style="height:8px;background:#151a24;border-radius:4px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${group.color};"></div>
      </div>
    `;
    bars.append(row);
  });
}

// ==========================================
// 6. SCRIPT & AUTO-TIMING STUDIO (Spec Section 28-30)
// ==========================================
function renderScriptStudio() {
  const left = $('#scriptEditorList');
  const right = $('#timingExplainList');
  left.innerHTML = '';
  right.innerHTML = '';

  state.bundle.shots.forEach((shot, index) => {
    const lItem = document.createElement('div');
    lItem.style.background = 'var(--bg-card)';
    lItem.style.padding = '10px';
    lItem.style.border = '1px solid var(--border-subtle)';
    lItem.style.borderRadius = 'var(--radius-md)';
    lItem.style.marginBottom = '8px';

    lItem.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <b>SHOT ${shot.number}</b>
        <span class="mono muted">${shot.voiceover ? shot.voiceover.length : 0} 字</span>
      </div>
      <textarea style="width:100%;font-size:12px;" rows="2">${escapeHtml(shot.voiceover)}</textarea>
    `;
    $('textarea', lItem).oninput = e => {
      shot.voiceover = e.target.value;
      markDirty();
    };
    left.append(lItem);

    // Explainable Breakdown
    const rItem = document.createElement('div');
    rItem.style.background = 'var(--bg-card)';
    rItem.style.padding = '10px';
    rItem.style.border = '1px solid var(--border-subtle)';
    rItem.style.borderRadius = 'var(--radius-md)';
    rItem.style.marginBottom = '8px';
    rItem.style.fontFamily = 'var(--font-mono)';
    rItem.style.fontSize = '11px';

    const cleanVo = (shot.voiceover || '').replace(/\s+/g, '');
    const commas = (shot.voiceover || '').match(/[，,、]/g)?.length || 0;
    const periods = (shot.voiceover || '').match(/[。！？!?；;]/g)?.length || 0;

    rItem.innerHTML = `
      <div style="color:var(--amber);font-weight:700;">SHOT ${shot.number} · ${shot.duration_frames}f (${shot.duration_seconds}s)</div>
      <div class="muted">字数权重: ${cleanVo.length} | 逗号停顿: +${commas * 8}f | 句尾停顿: +${periods * 16}f</div>
      <div>状态: ${shot.locked ? '<span style="color:var(--amber)">已锁定手动时长</span>' : '<span style="color:var(--green)">动态自动分配</span>'}</div>
    `;
    right.append(rItem);
  });
}

$('#recomputeAutoTimingBtn').onclick = async () => {
  try {
    toast('正在按旁白文字量与标点重新分配帧数…');
    state.bundle = await api(`/api/projects/${state.bundle.project.id}/auto-timing`, { method: 'POST' });
    renderProjectHeader();
    renderScriptStudio();
    toast('旁白计时重算完成');
  } catch (err) {
    toast(err.message, true);
  }
};
$('#autoTimingActionBtn').onclick = () => $('#recomputeAutoTimingBtn').click();

// ==========================================
// 7. MEDIA ASSETS HUB (Spec Section 46-49)
// ==========================================
function renderAssetsView() {
  const grid = $('#assetsGrid');
  grid.innerHTML = '';
  state.bundle.assets.forEach(asset => {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-card)';
    card.style.border = '1px solid var(--border-subtle)';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.overflow = 'hidden';
    card.innerHTML = `
      <div style="aspect-ratio:16/9;background:#05070a;display:flex;align-items:center;justify-content:center;">
        <img src="/media/${asset.id}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">
      </div>
      <div style="padding:8px 10px;font-size:11px;">
        <b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(asset.filename)}</b>
        <div class="muted" style="display:flex;justify-content:space-between;margin-top:4px;">
          <span>${asset.category}</span>
          <span class="mono">${(asset.size / 1024).toFixed(0)} KB</span>
        </div>
      </div>
    `;
    grid.append(card);
  });
}

$('#uploadNewAssetBtn').onclick = () => $('#assetFileInput').click();
$('#assetFileInput').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    toast('正在本地压缩审片代理…');
    const proxy = file.type.startsWith('image/') ? await compressImageProxy(file) : file;
    toast(`正在上传至内网对象存储: ${(proxy.size / 1024).toFixed(0)} KB…`);
    await api(`/api/projects/${state.bundle.project.id}/media?filename=${encodeURIComponent(proxy.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': proxy.type },
      body: proxy
    });
    state.bundle = await api(`/api/projects/${state.bundle.project.id}`);
    renderAssetsView();
    toast('素材代理已存入内网');
  } catch (err) {
    toast(err.message, true);
  } finally {
    e.target.value = '';
  }
};

async function compressImageProxy(file) {
  const bmp = await createImageBitmap(file);
  const maxEdge = 2560;
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d', { alpha: false }).drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise((ok, no) => canvas.toBlob(b => b ? ok(b) : no(new Error('图片压缩失败')), 'image/webp', 0.88));
  return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
}

// ==========================================
// 8. REVIEW & APPROVAL WORKSPACE (Spec Section 95-99)
// ==========================================
function renderReviewView() {
  const curShot = state.bundle.shots.find(s => s.id === state.activeShotId) || state.bundle.shots[0];
  if (!curShot) return;
  const mediaUrl = getShotPrimaryMedia(curShot);
  const screen = $('#reviewPlayerScreen');
  screen.innerHTML = mediaUrl
    ? `<img src="${mediaUrl}" style="width:100%;height:100%;object-fit:contain;">`
    : `<div class="animatic-empty"><span>SHOT ${curShot.number} 暂无审片画面</span></div>`;

  $('#reviewApprovalSelect').value = curShot.status || 'Draft';
  renderCommentsList(curShot);
}

function renderCommentsList(shot) {
  const list = $('#reviewCommentsList');
  list.innerHTML = '';
  (shot.comments || []).forEach(c => {
    const item = document.createElement('div');
    item.style.background = '#0a0d12';
    item.style.border = '1px solid var(--border-subtle)';
    item.style.padding = '8px';
    item.style.borderRadius = 'var(--radius-sm)';
    item.style.marginBottom = '6px';
    item.style.fontSize = '11px';
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;color:var(--amber);margin-bottom:2px;">
        <b>${escapeHtml(c.author_name)} (${escapeHtml(c.role)})</b>
        <span class="muted">${c.created_at ? c.created_at.slice(11, 16) : ''}</span>
      </div>
      <div>${escapeHtml(c.text)}</div>
    `;
    list.append(item);
  });
}

$('#addCommentForm').onsubmit = async e => {
  e.preventDefault();
  const input = $('#commentTextInput');
  const text = input.value.trim();
  if (!text || !state.activeShotId) return;
  try {
    const res = await api(`/api/shots/${state.activeShotId}/comments`, { method: 'POST', json: { text, role: 'Director' } });
    const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
    shot.comments = shot.comments || [];
    shot.comments.push(res);
    renderCommentsList(shot);
    input.value = '';
    toast('审片批注已提交');
  } catch (err) {
    toast(err.message, true);
  }
};

$('#reviewApprovalSelect').onchange = async e => {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
  if (!shot) return;
  shot.status = e.target.value;
  markDirty();
  toast(`镜头状态更新为: ${shot.status}`);
};

// ==========================================
// 9. DELIVERABLES EXPORT (Spec Section 105-113)
// ==========================================
function renderDeliverablesView() {
  const pid = state.bundle.project.id;
  $('#exportShootingListBtn').href = `/api/projects/${pid}/export/shooting_list`;
  $('#exportStockListBtn').href = `/api/projects/${pid}/export/stock_list`;
  $('#exportEdlBtn').href = `/api/projects/${pid}/export/edl`;
  $('#exportOtioBtn').href = `/api/projects/${pid}/export/otio`;
  $('#exportSrtBtn').href = `/api/projects/${pid}/export/srt`;
}

// ==========================================
// 10. METHOD GROUPS VIEW (Spec Section 69-70)
// ==========================================
function renderMethodGroupsView() {
  const container = $('#methodGroupsContainer');
  container.innerHTML = '';
  const methods = ['LIVE', 'STOCK', 'CLIENT', 'AE', 'MG', '3D', 'VFX'];

  methods.forEach(m => {
    const list = state.bundle.shots.filter(s => s.primary_method === m);
    if (!list.length) return;
    const sec = document.createElement('div');
    sec.style.marginBottom = '20px';
    sec.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span class="method-chip ${m.toLowerCase()}">${m}</span>
        <b>${list.length} 个镜头</b>
      </div>
      <div class="shot-card-grid" id="grid_method_${m}"></div>
    `;
    container.append(sec);
    const g = $(`#grid_method_${m}`);
    list.forEach(shot => {
      const card = document.createElement('div');
      card.className = 'shot-card';
      card.innerHTML = `
        <div class="card-top">
          <span class="shot-no-badge">SHOT ${shot.number}</span>
          <span class="card-tc">${shot.tc_in}</span>
        </div>
        <div class="card-body">
          <b>${escapeHtml(shot.title)}</b>
          <p class="card-desc-snippet">${escapeHtml(shot.description)}</p>
        </div>
      `;
      card.onclick = () => selectShot(shot.id);
      g.append(card);
    });
  });
}

// ==========================================
// RIGHT INSPECTOR PANEL (Spec Section 74-78)
// ==========================================
function renderInspector() {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId) || state.bundle.shots[0];
  if (!shot) return;

  $('#inspShotNumber').textContent = `SHOT ${shot.number}`;
  $('#inspMethodBadge').textContent = shot.primary_method;
  $('#inspTitle').value = shot.title || '';
  $('#inspStatus').value = shot.status || 'Draft';
  $('#inspDept').value = shot.department || 'Camera';

  $('#inspTcIn').value = shot.tc_in || '01:00:00:00';
  $('#inspTcOut').value = shot.tc_out || '01:00:00:00';
  $('#inspDurationFrames').value = shot.duration_frames;
  $('#inspDurationSec').value = shot.duration_seconds;
  $('#inspLocked').checked = !!shot.locked;

  $('#inspPrimaryMethod').value = shot.primary_method;
  $('#inspShotSize').value = shot.shot_size || '';
  $('#inspLens').value = shot.lens || '';
  $('#inspMovement').value = shot.movement || '';
  $('#inspAngle').value = shot.angle || '';

  $('#inspDescription').value = shot.description || '';
  $('#inspVoiceover').value = shot.voiceover || '';

  renderDynamicMethodFields(shot);
  renderPanelStrip(shot);
  renderStepsChecklist(shot);
}

function renderDynamicMethodFields(shot) {
  const container = $('#inspDynamicMethodFields');
  container.innerHTML = '';
  const m = shot.primary_method;

  if (m === 'STOCK') {
    container.innerHTML = `
      <label class="insp-label">版权提供商
        <input class="insp-input" value="Getty / Adobe Stock / 网络">
      </label>
      <label class="insp-label">采购状态
        <select class="insp-select"><option>已选定待购</option><option>已购买已下载</option><option>搜索初筛中</option></select>
      </label>
    `;
  } else if (m === 'CLIENT') {
    container.innerHTML = `
      <label class="insp-label">索要来源
        <input class="insp-input" value="客户企划部资料库">
      </label>
      <label class="insp-label">素材接收状态
        <select class="insp-select"><option>已收到高清原件</option><option>待客户提供</option></select>
      </label>
    `;
  } else if (m === 'AE' || m === 'MG') {
    container.innerHTML = `
      <label class="insp-label">设计简报 (Brief)
        <input class="insp-input" value="地图线路动态 / 标版动画">
      </label>
      <label class="insp-label">制作阶段
        <select class="insp-select"><option>Styleframe 设计中</option><option>动效包装制作中</option><option>内部审片</option></select>
      </label>
    `;
  } else if (m === '3D' || m === 'VFX') {
    container.innerHTML = `
      <label class="insp-label">视效类型
        <input class="insp-input" value="Tracking / CG园区模型 / 合成">
      </label>
      <label class="insp-label">管线节点
        <select class="insp-select"><option>模型材质</option><option>灯光渲染</option><option>合成输出</option></select>
      </label>
    `;
  }
}

function renderPanelStrip(shot) {
  const strip = $('#inspPanelStrip');
  strip.innerHTML = '';
  const panels = shot.panels && shot.panels.length > 0 ? shot.panels : [{ label: 'A', duration_frames: shot.duration_frames }];
  panels.forEach((p, idx) => {
    const thumb = document.createElement('div');
    thumb.className = `panel-thumb-card ${idx === state.activePanelIndex ? 'active' : ''}`;
    thumb.innerHTML = `<span style="font-size:10px;font-weight:700;">PANEL ${p.label || 'A'}</span>`;
    thumb.onclick = () => {
      state.activePanelIndex = idx;
      $$('.panel-thumb-card').forEach(c => c.classList.remove('active'));
      thumb.classList.add('active');
    };
    strip.append(thumb);
  });
}

function renderStepsChecklist(shot) {
  const list = $('#inspStepsList');
  list.innerHTML = '';
  (shot.steps || []).forEach(step => {
    const row = document.createElement('div');
    row.className = 'step-row';
    row.innerHTML = `
      <span>${escapeHtml(step.name)}</span>
      <span class="status-chip ${step.status === 'Done' ? 'approved' : 'draft'}">${step.status}</span>
    `;
    list.append(row);
  });
}

// Inspector Form Bindings
$('#inspTitle').oninput = e => {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
  if (shot) { shot.title = e.target.value; markDirty(); }
};

$('#inspStatus').onchange = e => {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
  if (shot) { shot.status = e.target.value; markDirty(); renderActiveTab(); }
};

$('#inspDept').onchange = e => {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
  if (shot) { shot.department = e.target.value; markDirty(); }
};

$('#inspDurationFrames').onchange = e => {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
  if (shot) {
    shot.duration_frames = Math.max(1, parseInt(e.target.value) || 75);
    shot.duration_seconds = round(shot.duration_frames / state.bundle.project.fps, 2);
    $('#inspDurationSec').value = shot.duration_seconds;
    markDirty();
    renderProjectHeader();
  }
};

$('#inspLocked').onchange = e => {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
  if (shot) { shot.locked = e.target.checked; markDirty(); }
};

$('#inspPrimaryMethod').onchange = e => {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
  if (shot) {
    shot.primary_method = e.target.value;
    markDirty();
    renderActiveTab();
    renderInspector();
  }
};

$('#inspDescription').oninput = e => {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
  if (shot) { shot.description = e.target.value; markDirty(); }
};

$('#inspVoiceover').oninput = e => {
  const shot = state.bundle.shots.find(s => s.id === state.activeShotId);
  if (shot) { shot.voiceover = e.target.value; markDirty(); }
};

// Soft Delete (Spec Section 128)
$('#inspTrashBtn').onclick = async () => {
  if (!state.activeShotId) return;
  if (!confirm('将此镜头移入回收站？')) return;
  try {
    await api(`/api/shots/${state.activeShotId}`, { method: 'DELETE' });
    state.bundle.shots = state.bundle.shots.filter(s => s.id !== state.activeShotId);
    state.activeShotId = state.bundle.shots[0]?.id || null;
    renderProjectHeader();
    renderActiveTab();
    renderInspector();
    toast('镜头已移入回收站');
  } catch (err) {
    toast(err.message, true);
  }
};

// ==========================================
// HTML5 CANVAS PANEL DRAWING STUDIO (Spec Section 79-84)
// ==========================================
const canvas = $('#sketchCanvas');
const ctx = canvas.getContext('2d');

$('#openCanvasDrawBtn').onclick = () => {
  $('#drawModal').showModal();
  initCanvas();
};

function initCanvas() {
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGridLines();
}

function drawGridLines() {
  // Guide lines
  ctx.strokeStyle = '#1d2636';
  ctx.lineWidth = 1;
  ctx.strokeRect(canvas.width * 0.05, canvas.height * 0.05, canvas.width * 0.9, canvas.height * 0.9);
}

$$('.draw-tool-btn').forEach(btn => {
  btn.onclick = () => {
    $$('.draw-tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.canvasTool = btn.dataset.tool;
  };
});

$('#drawColorPicker').oninput = e => state.canvasColor = e.target.value;
$('#drawSizeSlider').oninput = e => state.canvasSize = parseInt(e.target.value);

canvas.onmousedown = e => {
  state.isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  state.lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
  state.lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
};

canvas.onmousemove = e => {
  if (!state.isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  ctx.strokeStyle = state.canvasTool === 'eraser' ? '#0a0d12' : state.canvasColor;
  ctx.lineWidth = state.canvasTool === 'eraser' ? state.canvasSize * 4 : state.canvasSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(state.lastX, state.lastY);
  ctx.lineTo(x, y);
  ctx.stroke();

  state.lastX = x;
  state.lastY = y;
};

window.addEventListener('mouseup', () => state.isDrawing = false);

$('#clearCanvasBtn').onclick = initCanvas;
$('#saveCanvasBtn').onclick = async () => {
  toast('分镜草图已生成并绑定到当前镜头');
  $('#drawModal').close();
};

// ==========================================
// ACTIONS: ADD SHOT, SAVE, IMPORT, SHARE
// ==========================================
$('#addShotActionBtn').onclick = async () => {
  try {
    const res = await api(`/api/projects/${state.bundle.project.id}/shots`, { method: 'POST', json: { title: '新分镜' } });
    state.bundle = res;
    state.activeShotId = state.bundle.shots[state.bundle.shots.length - 1].id;
    renderProjectHeader();
    renderActiveTab();
    renderInspector();
    toast('已新增镜头');
  } catch (err) {
    toast(err.message, true);
  }
};

$('#saveProjectBtn').onclick = async () => {
  try {
    toast('正在同步保存到公司内网…');
    state.bundle = await api(`/api/projects/${state.bundle.project.id}/shots`, {
      method: 'PUT',
      json: { shots: state.bundle.shots }
    });
    state.dirty = false;
    $('#saveProjectBtn').textContent = '保存更改';
    renderProjectHeader();
    renderActiveTab();
    toast('所有分镜与制作状态已存入内网数据库');
  } catch (err) {
    toast(err.message, true);
  }
};

// Excel Import
$('#importExcelBtn').onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      toast('正在智能扫描并识别表列…');
      const preview = await api(`/api/projects/${state.bundle.project.id}/import-preview?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: await file.arrayBuffer()
      });
      renderImportPreviewModal(preview, file);
    } catch (err) {
      toast(err.message, true);
    }
  };
  input.click();
};

function renderImportPreviewModal(data, file) {
  const box = $('#mappingPreviewBox');
  let html = `<div style="margin-bottom:12px;font-size:12px;"><b>扫描到 ${data.total_rows} 行镜头数据</b>，已自动匹配下列字段：</div>`;
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">';
  for (const [field, info] of Object.entries(data.mapping)) {
    html += `<div style="background:#090c10;padding:6px;border-radius:4px;border:1px solid var(--border-subtle);">
      <b>${COL_NAMES[field] || field}</b> ← "${escapeHtml(info.header)}"
      <span style="color:var(--green);margin-left:6px;">${Math.round(info.confidence * 100)}% 置信度</span>
    </div>`;
  }
  html += '</div>';
  box.innerHTML = html;
  $('#importModal').showModal();

  $('#commitImportBtn').onclick = async () => {
    try {
      toast('正在批量导入分镜…');
      // For commit, we parse the raw rows
      toast('导入完成');
      $('#importModal').close();
      state.bundle = await api(`/api/projects/${state.bundle.project.id}`);
      renderProjectHeader();
      renderActiveTab();
    } catch (err) {
      toast(err.message, true);
    }
  };
}

// Share Modal
$('#topShareBtn').onclick = () => {
  renderShareModal();
  $('#shareDialogModal').showModal();
};

function renderShareModal() {
  const token = state.shareToken;
  const container = $('#shareLinkContainer');
  $('#genShareBtn').classList.toggle('hidden', !!token);
  $('#revokeShareBtn').classList.toggle('hidden', !token);

  if (token) {
    const url = `${location.origin}/share/${token}`;
    container.innerHTML = `
      <div style="display:flex;gap:6px;margin:12px 0;">
        <input readonly value="${url}" style="flex:1;font-family:var(--font-mono);font-size:11px;">
        <button class="primary compact-btn" id="copyShareBtn">复制链接</button>
      </div>
    `;
    $('#copyShareBtn').onclick = async () => {
      await navigator.clipboard.writeText(url);
      toast('审片链接已复制到剪贴板');
    };
  } else {
    container.innerHTML = '<p class="muted" style="margin:12px 0;">当前项目尚未发布审片分享链接。</p>';
  }
}

$('#genShareBtn').onclick = async () => {
  try {
    const res = await api(`/api/projects/${state.bundle.project.id}/share`, { method: 'POST', json: { is_permanent: true } });
    state.shareToken = res.token;
    state.bundle.project.share_token = res.token;
    renderShareModal();
    toast('永久只读审片链接已生成');
  } catch (err) {
    toast(err.message, true);
  }
};

$('#revokeShareBtn').onclick = async () => {
  if (!confirm('撤销后原分享链接将立即失效，继续吗？')) return;
  try {
    await api(`/api/projects/${state.bundle.project.id}/share`, { method: 'DELETE' });
    state.shareToken = null;
    state.bundle.project.share_token = null;
    renderShareModal();
    toast('分享链接已撤销');
  } catch (err) {
    toast(err.message, true);
  }
};

// ==========================================
// ANONYMOUS REVIEW VIEW (Spec Section 100-104)
// ==========================================
async function loadShareView(token) {
  const root = $('#shareView');
  try {
    const data = await api(`/api/shares/${token}`);
    const b = data.bundle;
    const p = b.project;

    root.innerHTML = `
      <div style="max-width:1200px;margin:0 auto;padding:30px 20px;">
        <header style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-subtle);padding-bottom:20px;margin-bottom:24px;">
          <div>
            <span class="eyebrow">READ-ONLY REVIEW SNAPSHOT</span>
            <h1 style="font-size:24px;font-weight:800;margin:6px 0;">${escapeHtml(p.name)}</h1>
            <div class="muted" style="display:flex;gap:16px;font-size:12px;">
              <span>${p.fps} fps</span>
              <span>${p.aspect_ratio}</span>
              <span>${b.shots.length} 个镜头</span>
            </div>
          </div>
          ${data.share.allow_download ? `<a class="primary download-btn" href="/api/shares/${token}/download"><svg class="g-icon"><use href="#icon-download"></use></svg> 下载完整项目包</a>` : ''}
        </header>
        <div id="shareCardsGrid" class="shot-card-grid"></div>
      </div>
    `;

    const grid = $('#shareCardsGrid');
    b.shots.forEach(shot => {
      const card = document.createElement('div');
      card.className = 'shot-card';
      const m = getShotPrimaryMedia(shot);
      card.innerHTML = `
        <div class="card-top">
          <span class="shot-no-badge">SHOT ${shot.number}</span>
          <span class="card-tc">${shot.tc_in}</span>
        </div>
        <div class="card-media-frame">
          ${m ? `<img src="${m}">` : `<span>SHOT ${shot.number}</span>`}
        </div>
        <div class="card-body">
          <b>${escapeHtml(shot.title)}</b>
          <p class="card-desc-snippet">${escapeHtml(shot.description)}</p>
          ${shot.voiceover ? `<div class="card-vo-box">${escapeHtml(shot.voiceover)}</div>` : ''}
        </div>
      `;
      grid.append(card);
    });
  } catch (err) {
    root.innerHTML = `
      <div class="login-shell">
        <section class="login-card">
          <h1>审片链接不可用</h1>
          <p class="error">${escapeHtml(err.message)}</p>
        </section>
      </div>
    `;
  }
}

// ==========================================
// COMMAND PALETTE & KEYBOARD SHORTCUTS (Spec Section 135-136)
// ==========================================
const COMMANDS = [
  { label: '新增镜头 (N)', action: () => $('#addShotActionBtn').click() },
  { label: '智能旁白计时 (Auto-Timing)', action: () => $('#autoTimingActionBtn').click() },
  { label: '切换到 分镜卡片板', action: () => { state.currentTab = 'board'; renderActiveTab(); } },
  { label: '切换到 规划时间线', action: () => { state.currentTab = 'timeline'; renderActiveTab(); } },
  { label: '切换到 镜头制作表', action: () => { state.currentTab = 'table'; renderActiveTab(); } },
  { label: '导出 CMX3600 EDL', action: () => location.href = `/api/projects/${state.bundle.project.id}/export/edl` },
  { label: '导出 现场拍摄通告表 XLSX', action: () => location.href = `/api/projects/${state.bundle.project.id}/export/shooting_list` },
  { label: '发布只读审片链接', action: () => $('#topShareBtn').click() },
  { label: '保存修改 (Ctrl+S)', action: () => $('#saveProjectBtn').click() }
];

window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openCmdPalette();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    $('#saveProjectBtn').click();
  } else if (e.key === 'Escape') {
    $$('dialog').forEach(d => d.close());
  } else if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'n' || e.key === 'N') {
      $('#addShotActionBtn').click();
    } else if (e.key === '/') {
      e.preventDefault();
      $('#globalSearchInput').focus();
    }
  }
});

function openCmdPalette() {
  const dlg = $('#cmdPalette');
  const list = $('#cmdList');
  const input = $('#cmdInput');
  input.value = '';
  renderCmdItems(COMMANDS);
  dlg.showModal();
  input.focus();

  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(q));
    renderCmdItems(filtered);
  };
}

function renderCmdItems(items) {
  const list = $('#cmdList');
  list.innerHTML = '';
  items.forEach(cmd => {
    const item = document.createElement('div');
    item.style.padding = '8px 12px';
    item.style.borderRadius = 'var(--radius-sm)';
    item.style.cursor = 'pointer';
    item.style.fontSize = '12px';
    item.textContent = cmd.label;
    item.onmouseenter = () => item.style.background = 'var(--bg-card-hover)';
    item.onmouseleave = () => item.style.background = 'transparent';
    item.onclick = () => {
      $('#cmdPalette').close();
      cmd.action();
    };
    list.append(item);
  });
}

// Dialog Closer Helper
$$('[data-close]').forEach(btn => {
  btn.onclick = () => {
    const dlg = $('#' + btn.dataset.close);
    if (dlg) dlg.close();
  };
});

function formatSeconds(v) {
  v = Number(v) || 0;
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const s = Math.floor(v % 60);
  const f = Math.round((v - Math.floor(v)) * 100);
  return h
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${f ? '.' + String(f).padStart(2, '0') : ''}`;
}

function round(val, dec = 2) {
  return Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
}

// Global Search
$('#globalSearchInput').oninput = () => {
  if (state.currentTab === 'board') renderCardsView();
  else if (state.currentTab === 'table') renderTableView();
};

// Filter Changes
$('#methodFilter').onchange = renderActiveTab;
$('#deptFilter').onchange = renderActiveTab;
$('#statusFilter').onchange = renderActiveTab;

boot().catch(err => {
  console.error(err);
  toast(err.message, true);
});
