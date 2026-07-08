/**
 * NutriGenie — Frontend Application Logic
 * IBM Watsonx.ai Nutrition Agent
 */

// ── State ──────────────────────────────────────────────────────
const state = {
  conversationHistory: [],
  userProfile: null,
  familyMembers: [],
  activeTab: 'chat',
};

// ── DOM References ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Initialise ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPersistedState();
  initTabs();
  initTheme();
  initChat();
  initMealPlanner();
  initCalorieAnalyser();
  initBMICalculator();
  initFamilyProfiles();
  initDashboard();
  loadQuickSuggestions();
  updateSidebarProfile();
});

// ──────────────────────────────────────────────────────────────
// PERSISTENCE
// ──────────────────────────────────────────────────────────────
function loadPersistedState() {
  try {
    const profile = localStorage.getItem('nutrigenie_profile');
    if (profile) state.userProfile = JSON.parse(profile);
    const family = localStorage.getItem('nutrigenie_family');
    if (family) state.familyMembers = JSON.parse(family);
    const history = localStorage.getItem('nutrigenie_history');
    if (history) state.conversationHistory = JSON.parse(history);
  } catch (e) { /* ignore */ }
}

function persistProfile()    { localStorage.setItem('nutrigenie_profile', JSON.stringify(state.userProfile)); }
function persistFamily()     { localStorage.setItem('nutrigenie_family',  JSON.stringify(state.familyMembers)); }
function persistHistory()    { localStorage.setItem('nutrigenie_history', JSON.stringify(state.conversationHistory.slice(-20))); }

// ──────────────────────────────────────────────────────────────
// TABS
// ──────────────────────────────────────────────────────────────
function initTabs() {
  $$('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const tab = link.dataset.tab;
      switchTab(tab);
      // Close mobile offcanvas
      const oc = document.getElementById('mobileNav');
      if (oc) bootstrap.Offcanvas.getInstance(oc)?.hide();
    });
  });
}

function switchTab(tabId) {
  $$('.tab-panel').forEach(p => p.classList.remove('active'));
  $$('.sidebar-link').forEach(l => l.classList.remove('active'));
  const panel = $(`tab-${tabId}`);
  if (panel) panel.classList.add('active');
  $$(`[data-tab="${tabId}"]`).forEach(l => l.classList.add('active'));
  state.activeTab = tabId;
}

// ──────────────────────────────────────────────────────────────
// THEME
// ──────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('nutrigenie_theme') || 'light';
  applyTheme(saved);
  $('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('nutrigenie_theme', theme);
  const icon = $('themeIcon');
  if (icon) icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
}

// ──────────────────────────────────────────────────────────────
// CHAT
// ──────────────────────────────────────────────────────────────
function initChat() {
  const input = $('chatInput');
  const sendBtn = $('sendBtn');

  sendBtn.addEventListener('click', sendChatMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  $('clearChatBtn').addEventListener('click', clearChat);

  // Restore chat history to UI
  if (state.conversationHistory.length > 0) {
    state.conversationHistory.forEach(turn => {
      if (turn.role === 'user') appendUserMessage(turn.content, false);
      else appendBotMessage(turn.content, false);
    });
  }
}

async function sendChatMessage() {
  const input = $('chatInput');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  input.style.height = 'auto';

  appendUserMessage(message);
  showTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: state.conversationHistory.slice(-6),
        profile: state.userProfile,
      }),
    });

    const data = await res.json();
    removeTypingIndicator();

    if (data.error) {
      appendBotMessage(`⚠️ Error: ${data.error}`);
    } else {
      appendBotMessage(data.reply);
      state.conversationHistory.push({ role: 'user', content: message });
      state.conversationHistory.push({ role: 'assistant', content: data.reply });
      persistHistory();
    }
  } catch (err) {
    removeTypingIndicator();
    appendBotMessage('⚠️ Network error. Please check your connection.');
  }
}

function appendUserMessage(text, scroll = true) {
  const msgs = $('chatMessages');
  const div = document.createElement('div');
  div.className = 'message user-message';
  div.innerHTML = `
    <div class="message-avatar">👤</div>
    <div>
      <div class="message-bubble">${escHtml(text)}</div>
      <div class="message-time text-end">${timeNow()}</div>
    </div>`;
  msgs.appendChild(div);
  if (scroll) scrollChatToBottom();
}

function appendBotMessage(text, scroll = true) {
  const msgs = $('chatMessages');
  const div = document.createElement('div');
  div.className = 'message bot-message';
  div.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div>
      <div class="message-bubble">${formatBotText(text)}</div>
      <div class="message-time">${timeNow()}</div>
    </div>`;
  msgs.appendChild(div);
  if (scroll) scrollChatToBottom();
}

function showTypingIndicator() {
  const msgs = $('chatMessages');
  const div = document.createElement('div');
  div.className = 'message bot-message';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="typing-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  msgs.appendChild(div);
  scrollChatToBottom();
}

function removeTypingIndicator() {
  const ti = $('typingIndicator');
  if (ti) ti.remove();
}

function clearChat() {
  const msgs = $('chatMessages');
  // Keep only the first welcome message
  while (msgs.children.length > 1) msgs.removeChild(msgs.lastChild);
  state.conversationHistory = [];
  persistHistory();
}

function scrollChatToBottom() {
  const msgs = $('chatMessages');
  msgs.scrollTop = msgs.scrollHeight;
}

// ── Quick Suggestions ─────────────────────────────────────────
async function loadQuickSuggestions() {
  try {
    const res = await fetch('/api/quick-suggestions');
    const data = await res.json();
    const container = $('suggestionChips');
    container.innerHTML = '';
    data.suggestions.forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'suggestion-chip';
      chip.textContent = s;
      chip.addEventListener('click', () => {
        $('chatInput').value = s.replace(/^[^\s]+\s/, ''); // strip emoji
        sendChatMessage();
        $('quickSuggestions').style.display = 'none';
      });
      container.appendChild(chip);
    });
  } catch (e) { /* silent */ }
}

// ──────────────────────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────────────────────
function initDashboard() {
  // Pre-fill profile form if saved
  if (state.userProfile) {
    const p = state.userProfile;
    if ($('profName'))  $('profName').value  = p.name  || '';
    if ($('profAge'))   $('profAge').value   = p.age   || '';
    if ($('profWeight'))$('profWeight').value = p.weight || '';
    if ($('profHeight'))$('profHeight').value = p.height || '';
    if ($('profGender'))$('profGender').value = p.gender || 'female';
    if ($('profActivity'))$('profActivity').value = p.activity || 'moderate';
    if ($('profGoal'))  $('profGoal').value  = p.goal  || 'maintenance';
    if ($('profRestrictions'))$('profRestrictions').value = p.restrictions || '';
    if ($('profConditions'))$('profConditions').value = p.conditions || '';
    updateDashboardStats();
  }

  $('saveProfileBtn').addEventListener('click', saveProfile);

  $('dashQuickAskBtn').addEventListener('click', async () => {
    const q = $('dashQuickAsk').value.trim();
    if (!q) return;
    const box = $('dashQuickResponse');
    box.classList.remove('d-none');
    box.textContent = '⏳ Thinking…';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history: [], profile: state.userProfile }),
      });
      const data = await res.json();
      box.innerHTML = data.error ? `⚠️ ${data.error}` : formatBotText(data.reply);
    } catch (e) {
      box.textContent = '⚠️ Network error.';
    }
  });
}

function saveProfile() {
  state.userProfile = {
    name:         $('profName').value.trim()        || 'User',
    age:          parseInt($('profAge').value)       || 25,
    gender:       $('profGender').value,
    weight:       parseFloat($('profWeight').value)  || null,
    height:       parseFloat($('profHeight').value)  || null,
    activity:     $('profActivity').value,
    goal:         $('profGoal').value,
    restrictions: $('profRestrictions').value.trim() || 'None',
    conditions:   $('profConditions').value.trim()   || 'None',
  };
  persistProfile();
  updateDashboardStats();
  updateSidebarProfile();
  showToast('✅ Profile saved!');
}

function updateDashboardStats() {
  const p = state.userProfile;
  if (!p || !p.weight || !p.height) return;

  // BMI
  const h = p.height / 100;
  const bmi = (p.weight / (h * h)).toFixed(1);
  $('dashBMI').textContent = bmi;
  const cat = bmiCategory(parseFloat(bmi));
  $('dashBMIcat').textContent = cat.name;
  $('dashBMIcat').style.color = cat.color;

  // TDEE (Mifflin-St Jeor)
  const bmr = p.gender === 'male'
    ? 10 * p.weight + 6.25 * p.height - 5 * p.age + 5
    : 10 * p.weight + 6.25 * p.height - 5 * p.age - 161;
  const mults = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 };
  const tdee = Math.round(bmr * (mults[p.activity] || 1.55));
  $('dashTDEE').textContent = tdee;

  // Goal-adjusted sub-label
  const goalLabels = { weight_loss:'−500 kcal deficit', maintenance:'Maintenance', muscle_gain:'+300 kcal surplus', wellness:'Balanced', diabetes_management:'Controlled carbs' };
  $('dashTDEEsub').textContent = goalLabels[p.goal] || 'Daily estimate';

  // Protein target (~0.8-1.6g/kg)
  const proteinFactor = p.goal === 'muscle_gain' ? 1.6 : (p.goal === 'weight_loss' ? 1.2 : 0.9);
  $('dashProtein').textContent = Math.round(p.weight * proteinFactor);

  // Water (35ml/kg)
  $('dashWater').textContent = (p.weight * 0.035).toFixed(1);

  // Adjust macro bars by goal
  const macros = {
    weight_loss:        { p:30, c:40, f:30 },
    maintenance:        { p:25, c:50, f:25 },
    muscle_gain:        { p:35, c:45, f:20 },
    wellness:           { p:20, c:55, f:25 },
    diabetes_management:{ p:25, c:35, f:40 },
  };
  const m = macros[p.goal] || macros.maintenance;
  const proteinBar = document.querySelector('.protein-bar');
  const carbsBar   = document.querySelector('.carbs-bar');
  const fatsBar    = document.querySelector('.fats-bar');
  if (proteinBar) { proteinBar.style.width = m.p + '%'; proteinBar.closest('.macro-bar-row').querySelector('.macro-pct').textContent = m.p + '%'; }
  if (carbsBar)   { carbsBar.style.width   = m.c + '%'; carbsBar.closest('.macro-bar-row').querySelector('.macro-pct').textContent   = m.c + '%'; }
  if (fatsBar)    { fatsBar.style.width    = m.f + '%'; fatsBar.closest('.macro-bar-row').querySelector('.macro-pct').textContent    = m.f + '%'; }
}

function updateSidebarProfile() {
  const p = state.userProfile;
  const nameEl = $('sidebarProfileName');
  const goalEl = $('sidebarProfileGoal');
  if (nameEl) nameEl.textContent = p?.name || 'Set up profile';
  if (goalEl) goalEl.textContent = p?.goal?.replace(/_/g,' ') || 'Click Dashboard →';
}

// ──────────────────────────────────────────────────────────────
// MEAL PLANNER
// ──────────────────────────────────────────────────────────────
function initMealPlanner() {
  $('generateMealPlanBtn').addEventListener('click', generateMealPlan);
}

async function generateMealPlan() {
  const profile = {
    diet_type:    $('mpDietType').value,
    goal:         $('mpGoal').value,
    calories:     $('mpCalories').value || null,
    restrictions: state.userProfile?.restrictions || 'none',
    ...state.userProfile,
  };
  const preferences = $('mpPreferences').value.trim();

  showLoading('Generating your 7-day meal plan…');
  try {
    const res = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, preferences }),
    });
    const data = await res.json();
    const output = $('mealPlanOutput');
    if (data.error) {
      output.innerHTML = `<p class="text-danger">⚠️ ${escHtml(data.error)}</p>`;
    } else {
      output.innerHTML = formatBotText(data.meal_plan);
    }
  } catch (e) {
    $('mealPlanOutput').innerHTML = '<p class="text-danger">⚠️ Network error.</p>';
  } finally {
    hideLoading();
  }
}

// ──────────────────────────────────────────────────────────────
// CALORIE ANALYSER
// ──────────────────────────────────────────────────────────────
function initCalorieAnalyser() {
  $('analyseCaloriesBtn').addEventListener('click', analyseCalories);

  // Food chips
  $$('.food-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $('calorieInput').value = chip.dataset.food;
    });
  });

  $('calorieInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) analyseCalories();
  });
}

async function analyseCalories() {
  const food = $('calorieInput').value.trim();
  if (!food) { showToast('Please describe a food or meal.', 'warning'); return; }

  showLoading('Analysing nutritional content…');
  try {
    const res = await fetch('/api/calorie-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food }),
    });
    const data = await res.json();
    const output = $('calorieOutput');
    if (data.error) {
      output.innerHTML = `<p class="text-danger">⚠️ ${escHtml(data.error)}</p>`;
    } else {
      output.innerHTML = formatBotText(data.analysis);
    }
  } catch (e) {
    $('calorieOutput').innerHTML = '<p class="text-danger">⚠️ Network error.</p>';
  } finally {
    hideLoading();
  }
}

// ──────────────────────────────────────────────────────────────
// BMI CALCULATOR
// ──────────────────────────────────────────────────────────────
function initBMICalculator() {
  $('calcBmiBtn').addEventListener('click', calcBMI);
}

async function calcBMI() {
  const weight   = parseFloat($('bmiWeight').value);
  const height   = parseFloat($('bmiHeight').value);
  const age      = parseInt($('bmiAge').value) || 25;
  const gender   = $('bmiGender').value;
  const activity = $('bmiActivity').value;

  if (!weight || !height) { showToast('Please enter weight and height.', 'warning'); return; }

  showLoading('Calculating…');
  try {
    const res = await fetch('/api/bmi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight, height, age, gender, activity }),
    });
    const data = await res.json();
    hideLoading();

    if (data.error) { showToast(data.error, 'danger'); return; }

    // Show results
    $('bmiResults').classList.remove('d-none');
    $('bmiPlaceholder').classList.add('d-none');

    // Animate BMI number
    animateNumber($('bmiNumber'), data.bmi);
    $('bmiCategory').textContent = data.category;
    $('bmiCategory').style.color = data.color;
    $('bmiAdvice').textContent = data.advice;

    // Position gauge marker (BMI 15–40 range)
    const pct = Math.min(Math.max((data.bmi - 15) / 25, 0), 1) * 94;
    $('bmiGaugeFill').style.left = `calc(${pct}% - 9px)`;

    // Calorie targets
    animateNumber($('calLoss'),  data.weight_loss);
    animateNumber($('calMaint'), data.maintenance);
    animateNumber($('calGain'),  data.weight_gain);
    $('bmrValue').textContent = data.bmr;

  } catch (e) {
    hideLoading();
    showToast('Network error.', 'danger');
  }
}

// ──────────────────────────────────────────────────────────────
// FAMILY PROFILES
// ──────────────────────────────────────────────────────────────
function initFamilyProfiles() {
  $('addFamilyMemberBtn').addEventListener('click', addFamilyMember);
  $('genFamilyPlanBtn').addEventListener('click', generateFamilyPlan);
  renderFamilyList();
}

function addFamilyMember() {
  const name   = $('famName').value.trim();
  const age    = parseInt($('famAge').value);
  const gender = $('famGender').value;
  const weight = $('famWeight').value.trim();
  const goal   = $('famGoal').value;
  const restrictions = $('famRestrictions').value.trim();

  if (!name || !age) { showToast('Name and age are required.', 'warning'); return; }

  state.familyMembers.push({ id: Date.now(), name, age, gender, weight, goal, restrictions: restrictions || 'none' });
  persistFamily();
  renderFamilyList();

  // Clear fields
  ['famName','famAge','famWeight','famRestrictions'].forEach(id => { $(id).value = ''; });
  showToast(`✅ ${name} added!`);
}

function removeFamilyMember(id) {
  state.familyMembers = state.familyMembers.filter(m => m.id !== id);
  persistFamily();
  renderFamilyList();
}

function renderFamilyList() {
  const list = $('familyList');
  const count = $('memberCount');
  const genBtn = $('genFamilyPlanBtn');

  count.textContent = state.familyMembers.length;

  if (state.familyMembers.length === 0) {
    list.innerHTML = `<div class="empty-state py-3"><div class="empty-icon">👨‍👩‍👧</div><p>No members added yet.</p></div>`;
    genBtn.classList.add('d-none');
    return;
  }

  genBtn.classList.remove('d-none');
  const avatars = { male:'👨', female:'👩' };
  list.innerHTML = state.familyMembers.map(m => `
    <div class="family-member-card">
      <div class="family-member-info">
        <div class="family-avatar">${m.age < 12 ? '🧒' : (m.age > 60 ? '🧓' : avatars[m.gender] || '👤')}</div>
        <div>
          <div class="family-name">${escHtml(m.name)}, ${m.age} yrs</div>
          <div class="family-details">${m.gender} · ${escHtml(m.goal)}${m.weight ? ` · ${m.weight}kg` : ''}</div>
          ${m.restrictions !== 'none' ? `<div class="family-details" style="color:var(--warning)">⚠️ ${escHtml(m.restrictions)}</div>` : ''}
        </div>
      </div>
      <button class="btn-remove-member" onclick="removeFamilyMember(${m.id})" title="Remove">
        <i class="bi bi-x-circle"></i>
      </button>
    </div>`
  ).join('');
}

async function generateFamilyPlan() {
  if (state.familyMembers.length === 0) { showToast('Add at least one family member.', 'warning'); return; }

  showLoading('Creating family nutrition plan…');
  try {
    const res = await fetch('/api/family-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: state.familyMembers }),
    });
    const data = await res.json();
    const output = $('familyPlanOutput');
    if (data.error) {
      output.innerHTML = `<p class="text-danger">⚠️ ${escHtml(data.error)}</p>`;
    } else {
      output.innerHTML = formatBotText(data.family_plan);
    }
  } catch (e) {
    $('familyPlanOutput').innerHTML = '<p class="text-danger">⚠️ Network error.</p>';
  } finally {
    hideLoading();
  }
}

// ──────────────────────────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────────────────────────

/** Convert plain text with markdown-like formatting to HTML */
function formatBotText(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Headers
    .replace(/^###\s+(.+)$/gm, '<h6 class="mt-2 mb-1" style="color:var(--accent)">$1</h6>')
    .replace(/^##\s+(.+)$/gm,  '<h5 class="mt-3 mb-1" style="color:var(--accent)">$1</h5>')
    .replace(/^#\s+(.+)$/gm,   '<h4 class="mt-3 mb-1" style="color:var(--accent)">$1</h4>')
    // Bullet points
    .replace(/^\s*[\-\*•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>(\n)?)+/gs, match => `<ul>${match}</ul>`)
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

/** Escape HTML for user-provided content */
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/** Current time as HH:MM */
function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Animate a number counting up */
function animateNumber(el, target, duration = 600) {
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    el.textContent = Math.round(start + diff * easeOut(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/** BMI category helper */
function bmiCategory(bmi) {
  if (bmi < 18.5) return { name: 'Underweight', color: '#3b82f6' };
  if (bmi < 25)   return { name: 'Normal',      color: '#22c55e' };
  if (bmi < 30)   return { name: 'Overweight',  color: '#f59e0b' };
  return                 { name: 'Obese',        color: '#ef4444' };
}

/** Loading overlay */
function showLoading(msg = 'Processing…') {
  const overlay = $('loadingOverlay');
  const text    = $('loadingText');
  if (overlay) { overlay.classList.remove('d-none'); text.textContent = msg; }
}
function hideLoading() {
  const overlay = $('loadingOverlay');
  if (overlay) overlay.classList.add('d-none');
}

/** Bootstrap toast */
function showToast(msg, type = 'success') {
  const el = $('appToast');
  const body = $('toastMsg');
  if (!el) return;
  body.textContent = msg;
  el.className = `toast align-items-center border-0 text-bg-${type === 'warning' ? 'warning' : type === 'danger' ? 'danger' : 'success'}`;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 2500 }).show();
}
