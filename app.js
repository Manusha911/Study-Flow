// ─── STUDYFLOW FRONTEND SPA ENGINE ───

// State Store
let state = {
  token: localStorage.getItem('sf_token') || null,
  user: JSON.parse(localStorage.getItem('sf_user')) || null,
  darkMode: JSON.parse(localStorage.getItem('sf_darkMode')) || false,
  assignments: [],
  timetable: [],
  notes: [],
  studySessions: [],
  pomodoro: {
    minutes: 25,
    seconds: 0,
    isRunning: false,
    mode: 'focus', // 'focus' | 'break'
  },
  currentView: '',
  searchQuery: '',
  assignmentFilter: 'all',
  showAssignmentForm: false,
  showTimetableForm: false,
  showNoteForm: false,
  noteEditId: null,
  noteFormAttachments: [],
  notePreviewAttachment: null,
  showEditProfile: false,
  editProfilePhoto: '',
  editProfilePhotoPreview: '',
  showLogoutConfirm: false,
};

// API Helpers
const API_URL = window.location.origin;

async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${res.status}`);
    }
    return await res.json().catch(() => ({}));
  } catch (error) {
    console.warn(`API call ${method} ${endpoint} failed: ${error.message}. Checking LocalStorage fallback.`);
    // If the server is offline or doesn't support the API, throw error to let client handlers know,
    // but app.js will intercept it to provide dynamic localStorage-only usage if needed.
    throw error;
  }
}

// LocalStorage Database Fallback (for direct-launch and offline usability)
const LS_PREFIX = 'sf_offline_';
const isOfflineMode = () => !state.token; // If no token is loaded, but can also switch dynamically on API fails

function getLocalData(key, fallback) {
  try {
    const d = localStorage.getItem(LS_PREFIX + key);
    return d ? JSON.parse(d) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocalData(key, val) {
  localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
}

// Quotes
const quotes = [
  "The expert in anything was once a beginner. — Helen Hayes",
  "Education is the passport to the future. — Malcolm X",
  "Success is the sum of small efforts repeated. — Robert Collier",
  "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
  "The only way to do great work is to love what you do. — Steve Jobs",
  "Believe you can and you're halfway there. — Theodore Roosevelt",
  "It always seems impossible until it's done. — Nelson Mandela",
  "Study hard, for the well is deep, and our brains are shallow. — Richard Baxter",
  "The more that you read, the more things you will know. — Dr. Seuss",
  "Push yourself, because no one else is going to do it for you.",
];

let cachedQuote = quotes[0];
function updateQuote() {
  cachedQuote = quotes[Math.floor(Math.random() * quotes.length)];
}

// Global Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold shadow-lg transform translate-y-2 opacity-0 transition-all duration-300 `;

  if (type === 'success') {
    toast.className += 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500 dark:text-emerald-400';
    toast.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 shrink-0"></i> <span>${message}</span>`;
  } else if (type === 'error') {
    toast.className += 'bg-rose-500/15 border-rose-500/30 text-rose-500 dark:text-rose-400';
    toast.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 shrink-0"></i> <span>${message}</span>`;
  } else if (type === 'warning') {
    toast.className += 'bg-amber-500/15 border-amber-500/30 text-amber-500 dark:text-amber-400';
    toast.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i> <span>${message}</span>`;
  } else {
    toast.className += 'bg-blue-500/15 border-blue-500/30 text-blue-500 dark:text-blue-400';
    toast.innerHTML = `<i data-lucide="info" class="w-4 h-4 shrink-0"></i> <span>${message}</span>`;
  }

  container.appendChild(toast);
  lucide.createIcons({ attrs: { class: 'shrink-0' } });

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── DATA SYNCHRONIZATION ───

async function fetchAllData() {
  if (isOfflineMode()) {
    // Load from LocalStorage
    state.assignments = getLocalData('assignments', []);
    state.timetable = getLocalData('timetable', []);
    state.notes = getLocalData('notes', []);
    state.studySessions = getLocalData('studySessions', []);
    return;
  }

  try {
    const [a, t, n, s] = await Promise.all([
      apiRequest('/api/assignments'),
      apiRequest('/api/timetable'),
      apiRequest('/api/notes'),
      apiRequest('/api/sessions'),
    ]);
    state.assignments = a;
    state.timetable = t;
    state.notes = n;
    state.studySessions = s;
  } catch (error) {
    showToast('Failed to load data from server. Working offline.', 'warning');
    state.assignments = getLocalData('assignments', []);
    state.timetable = getLocalData('timetable', []);
    state.notes = getLocalData('notes', []);
    state.studySessions = getLocalData('studySessions', []);
  }
}

// Dark Mode Toggle
function initDarkMode() {
  if (state.darkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  localStorage.setItem('sf_darkMode', JSON.stringify(state.darkMode));
  initDarkMode();
  showToast(state.darkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  renderCurrentView();
}

// Image compression
function compressImage(file, maxSize = 200) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = url;
  });
}

// Helper: Formats sizes
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Global Pomodoro Timer Loop
let pomodoroInterval = null;
function startPomodoroTimer() {
  if (pomodoroInterval) clearInterval(pomodoroInterval);

  pomodoroInterval = setInterval(() => {
    if (state.pomodoro.isRunning) {
      let { minutes, seconds, mode } = state.pomodoro;

      if (seconds === 0) {
        if (minutes === 0) {
          // Timer finished!
          if (mode === 'focus') {
            state.pomodoro.mode = 'break';
            state.pomodoro.minutes = 5;
            state.pomodoro.seconds = 0;
            state.pomodoro.isRunning = false;

            // Log study session
            logStudySession(25, 'Pomodoro');
            showToast('Focus session complete! Time for a break.', 'success');
          } else {
            state.pomodoro.mode = 'focus';
            state.pomodoro.minutes = 25;
            state.pomodoro.seconds = 0;
            state.pomodoro.isRunning = false;
            showToast('Break over! Ready to focus?', 'info');
          }
        } else {
          state.pomodoro.minutes = minutes - 1;
          state.pomodoro.seconds = 59;
        }
      } else {
        state.pomodoro.seconds = seconds - 1;
      }

      // Update UI elements in DOM without full re-render for performance
      updateNavbarTimer();
      updateProfileTimer();
    }
  }, 1000);
}

async function logStudySession(duration, subject) {
  const dateStr = new Date().toISOString().split('T')[0];
  const newSession = { date: dateStr, duration, subject };

  if (isOfflineMode()) {
    newSession.id = Math.random().toString(36).substring(2, 9);
    state.studySessions.unshift(newSession);
    saveLocalData('studySessions', state.studySessions);
    renderCurrentView();
    return;
  }

  try {
    const s = await apiRequest('/api/sessions', 'POST', newSession);
    state.studySessions.unshift(s);
    renderCurrentView();
  } catch (err) {
    newSession.id = Math.random().toString(36).substring(2, 9);
    state.studySessions.unshift(newSession);
    saveLocalData('studySessions', state.studySessions);
    renderCurrentView();
  }
}

function updateNavbarTimer() {
  const container = document.getElementById('navbar-pomodoro-indicator');
  if (!container) return;
  if (!state.pomodoro.isRunning) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const minutesStr = String(state.pomodoro.minutes).padStart(2, '0');
  const secondsStr = String(state.pomodoro.seconds).padStart(2, '0');

  container.querySelector('.font-mono').textContent = `${minutesStr}:${secondsStr}`;
  if (state.pomodoro.mode === 'focus') {
    container.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:scale-105 transition-transform';
  } else {
    container.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20 hover:scale-105 transition-transform';
  }
}

function updateProfileTimer() {
  const circle = document.getElementById('pomodoro-circle-indicator');
  const display = document.getElementById('pomodoro-time-display');
  const subText = document.getElementById('pomodoro-sub-display');
  const btn = document.getElementById('pomodoro-toggle-btn');

  if (!circle || !display || !subText || !btn) return;

  const { minutes, seconds, isRunning, mode } = state.pomodoro;
  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');

  display.textContent = `${minutesStr}:${secondsStr}`;
  subText.textContent = mode;

  const total = mode === 'focus' ? 25 * 60 : 5 * 60;
  const remaining = minutes * 60 + seconds;
  const progress = ((total - remaining) / total) * 100;
  const circumference = 2 * Math.PI * 45;

  circle.style.strokeDashoffset = circumference * (1 - progress / 100);

  if (mode === 'focus') {
    circle.setAttribute('class', 'stroke-primary');
    subText.setAttribute('class', 'text-sm capitalize font-medium text-primary');
  } else {
    circle.setAttribute('class', 'stroke-accent');
    subText.setAttribute('class', 'text-sm capitalize font-medium text-accent');
  }

  if (isRunning) {
    btn.className = 'px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium inline-flex items-center gap-2 hover:bg-secondary/80 transition-colors';
    btn.innerHTML = '<i data-lucide="pause" class="w-4 h-4"></i> Pause';
  } else {
    btn.className = 'px-6 py-2.5 rounded-xl gradient-primary text-primary-foreground font-medium inline-flex items-center gap-2 shadow-sm hover:shadow-glow transition-shadow';
    btn.innerHTML = '<i data-lucide="play" class="w-4 h-4"></i> Start';
  }
  lucide.createIcons();
}

// ─── NAV LAYOUT RENDERER ───

function renderLogoutConfirmModal() {
  return `
    <div id="logout-confirm-modal" class="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div class="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-lg space-y-4 text-center animate-scale-in">
        <div class="mx-auto w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <i data-lucide="log-out" class="w-6 h-6"></i>
        </div>
        <div class="space-y-2">
          <h2 class="font-display font-bold text-lg text-foreground">Confirm Logout</h2>
          <p class="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to log out of your session?
          </p>
        </div>
        <div class="flex gap-3 pt-2">
          <button id="logout-confirm-cancel" type="button" class="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-foreground text-sm font-semibold transition-colors">
            Cancel
          </button>
          <button id="logout-confirm-yes" type="button" class="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold shadow-sm transition-colors">
            Log Out
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderNavbar() {
  if (!state.user) return '';

  const navItems = [
    { to: '#/dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
    { to: '#/assignments', label: 'Assignments', icon: 'clipboard-list' },
    { to: '#/timetable', label: 'Timetable', icon: 'calendar' },
    { to: '#/notes', label: 'Notes', icon: 'sticky-note' },
    { to: '#/profile', label: 'Profile', icon: 'user' },
  ];

  const currentPath = window.location.hash || '#/dashboard';

  const desktopLinks = navItems.map(item => {
    const active = currentPath.startsWith(item.to);
    return `
      <a href="${item.to}" class="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active
        ? 'text-primary-foreground font-semibold'
        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }">
        ${active ? '<div class="absolute inset-0 gradient-primary rounded-lg z-0"></div>' : ''}
        <span class="relative z-10 flex items-center gap-2">
          <i data-lucide="${item.icon}" class="w-4 h-4"></i>
          ${item.label}
        </span>
      </a>
    `;
  }).join('');

  const mobileLinks = navItems.map(item => {
    const active = currentPath.startsWith(item.to);
    return `
      <a href="${item.to}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active
        ? 'gradient-primary text-primary-foreground font-semibold'
        : 'text-muted-foreground hover:bg-secondary'
      }">
        <i data-lucide="${item.icon}" class="w-4 h-4"></i>
        ${item.label}
      </a>
    `;
  }).join('');

  const minutesStr = String(state.pomodoro.minutes).padStart(2, '0');
  const secondsStr = String(state.pomodoro.seconds).padStart(2, '0');
  const isTimerRunning = state.pomodoro.isRunning;
  const isFocusMode = state.pomodoro.mode === 'focus';

  const timerClass = isFocusMode
    ? 'bg-primary/10 text-primary border border-primary/20'
    : 'bg-accent/10 text-accent border border-accent/20';

  return `
    <nav class="sticky top-0 z-50 border-b border-border glass">
      <div class="container mx-auto px-4 flex items-center justify-between h-16">
        <a href="#/dashboard" class="flex items-center gap-2 font-display text-xl font-bold text-primary transition-transform active:scale-95">
          <div class="navbar-logo-icon">
            <i data-lucide="book-open" class="w-6 h-6"></i>
          </div>
          StudyFlow
        </a>

        <!-- Desktop Navigation -->
        <div class="hidden md:flex items-center gap-1">
          ${desktopLinks}
        </div>

        <div class="hidden md:flex items-center gap-2">
          <!-- Pomodoro Mini Indicator -->
          <a href="#/profile" id="navbar-pomodoro-indicator" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold hover:scale-105 transition-transform ${isTimerRunning ? '' : 'hidden'} ${timerClass}">
            <i data-lucide="timer" class="w-3.5 h-3.5 animate-pulse"></i>
            <span class="font-mono">${minutesStr}:${secondsStr}</span>
          </a>
          
          <button id="nav-theme-btn" class="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
            <i data-lucide="${state.darkMode ? 'sun' : 'moon'}" class="w-5 h-5"></i>
          </button>
          
          <button id="nav-logout-btn" class="p-2 rounded-lg hover:bg-rose-500/10 transition-colors text-muted-foreground hover:text-rose-500">
            <i data-lucide="log-out" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Mobile Menu Controls -->
        <div class="md:hidden flex items-center gap-2">
          <a href="#/profile" id="navbar-pomodoro-indicator-mobile" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${isTimerRunning ? '' : 'hidden'} ${timerClass}">
            <i data-lucide="timer" class="w-3.5 h-3.5 animate-pulse"></i>
            <span class="font-mono">${minutesStr}:${secondsStr}</span>
          </a>
          
          <button id="mobile-menu-toggle" class="p-2 text-foreground">
            <i data-lucide="menu" class="w-6 h-6"></i>
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <div id="mobile-drawer" class="hidden md:hidden border-t border-border bg-card overflow-hidden">
        <div class="p-4 space-y-1">
          ${mobileLinks}
          <div class="flex items-center gap-2 pt-2 border-t border-border mt-2">
            <button id="mobile-theme-btn" class="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
              <i data-lucide="${state.darkMode ? 'sun' : 'moon'}" class="w-5 h-5"></i>
            </button>
            <button id="mobile-logout-btn" class="p-2 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500">
              <i data-lucide="log-out" class="w-5 h-5"></i>
            </button>
          </div>
        </div>
      </div>
    </nav>
    ${state.showLogoutConfirm ? renderLogoutConfirmModal() : ''}
  `;
}

// Bind navbar elements
// Bind navbar elements
function bindNavbarEvents() {
  if (!state.user) return;

  const themeBtn = document.getElementById('nav-theme-btn');
  if (themeBtn) themeBtn.onclick = toggleDarkMode;

  const mobThemeBtn = document.getElementById('mobile-theme-btn');
  if (mobThemeBtn) mobThemeBtn.onclick = toggleDarkMode;

  const logoutBtn = document.getElementById('nav-logout-btn');
  if (logoutBtn) logoutBtn.onclick = handleLogoutTrigger;

  const mobLogoutBtn = document.getElementById('mobile-logout-btn');
  if (mobLogoutBtn) mobLogoutBtn.onclick = handleLogoutTrigger;

  const menuToggle = document.getElementById('mobile-menu-toggle');
  const drawer = document.getElementById('mobile-drawer');
  if (menuToggle && drawer) {
    menuToggle.onclick = () => {
      drawer.classList.toggle('hidden');
      const icon = menuToggle.querySelector('i');
      if (drawer.classList.contains('hidden')) {
        menuToggle.innerHTML = '<i data-lucide="menu" class="w-6 h-6"></i>';
      } else {
        menuToggle.innerHTML = '<i data-lucide="x" class="w-6 h-6"></i>';
      }
      lucide.createIcons();
    };
  }

  // Logout Confirm Modal Bindings
  if (state.showLogoutConfirm) {
    const confirmYes = document.getElementById('logout-confirm-yes');
    if (confirmYes) {
      confirmYes.onclick = () => {
        state.showLogoutConfirm = false;
        handleLogout();
      };
    }
    const confirmCancel = document.getElementById('logout-confirm-cancel');
    const modalOverlay = document.getElementById('logout-confirm-modal');

    const dismissConfirm = () => {
      state.showLogoutConfirm = false;
      renderCurrentView();
    };

    if (confirmCancel) confirmCancel.onclick = dismissConfirm;
    if (modalOverlay) {
      modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) dismissConfirm();
      };
    }
  }
}

function handleLogoutTrigger() {
  state.showLogoutConfirm = true;
  renderCurrentView();
}

function handleLogout() {
  state.showLogoutConfirm = false;
  state.token = null;
  state.user = null;
  localStorage.removeItem('sf_token');
  localStorage.removeItem('sf_user');
  showToast('Logged out successfully', 'info');
  window.location.hash = '#/';
}

// ─── VIEW 1: HOME (LANDING PAGE) ───

function viewHome() {
  const quote = cachedQuote;

  const actionButton = state.user
    ? `<a href="#/dashboard" class="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-white text-primary font-semibold hover:scale-105 hover:shadow-lg transition-all shadow-md">
         Go to Dashboard <i data-lucide="arrow-right" class="w-5 h-5"></i>
       </a>`
    : `<div class="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
         <a href="#/register" class="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-white text-primary font-semibold shadow-md hover:scale-105 hover:shadow-xl transition-all">
           Get Started Free <i data-lucide="arrow-right" class="w-5 h-5"></i>
         </a>
         <a href="#/login" class="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border-2 border-white/30 text-white font-semibold hover:bg-white/10 hover:border-white transition-colors">
           Login
         </a>
       </div>`;

  return `
    <div class="min-h-screen flex flex-col">
      <!-- Hero Banner -->
      <section class="relative overflow-hidden gradient-hero text-primary-foreground min-h-[85vh] flex items-center">
        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        
        <!-- Animated floating orbs -->
        <div class="absolute top-20 left-10 w-32 h-32 rounded-full bg-white/5 blur-2xl animate-bounce" style="animation-duration: 6s;"></div>
        <div class="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-white/5 blur-3xl animate-pulse" style="animation-duration: 8s;"></div>
        
        <div class="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div class="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div class="text-center md:text-left">
              <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-sm mb-6 border border-white/20">
                <i data-lucide="sparkles" class="w-4 h-4 text-accent animate-pulse"></i>
                Your Academic Companion
              </div>
              <h1 class="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight text-white">
                Study Smarter,<br />
                <span class="relative inline-block mt-1">
                  Not Harder
                  <div class="absolute -bottom-1.5 left-0 right-0 h-1 bg-accent rounded-full"></div>
                </span>
              </h1>
              <p class="text-lg md:text-xl opacity-90 mb-4 max-w-lg mx-auto md:mx-0">
                Organize assignments, plan your study schedule, track progress, and achieve your academic goals — all in one place.
              </p>
              <p class="text-sm italic opacity-75 mb-8 max-w-md mx-auto md:mx-0 font-medium">"${quote}"</p>
              ${actionButton}
            </div>

            <div class="hidden md:flex justify-center">
              <img
                src="assets/hero-student.png"
                alt="Student studying"
                class="w-full max-w-sm drop-shadow-2xl animate-pulse"
                style="animation-duration: 4s;"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Stats Section -->
      <section class="relative -mt-8 z-10">
        <div class="container mx-auto px-4">
          <div class="max-w-3xl mx-auto bg-card border border-border rounded-2xl shadow-card p-6 grid grid-cols-3 gap-6">
            <div class="text-center">
              <i data-lucide="users" class="w-6 h-6 text-primary mx-auto mb-2"></i>
              <p class="text-2xl font-display font-bold text-foreground">10K+</p>
              <p class="text-xs text-muted-foreground">Students</p>
            </div>
            <div class="text-center border-x border-border">
              <i data-lucide="zap" class="w-6 h-6 text-primary mx-auto mb-2"></i>
              <p class="text-2xl font-display font-bold text-foreground">50K+</p>
              <p class="text-xs text-muted-foreground">Tasks Done</p>
            </div>
            <div class="text-center">
              <i data-lucide="star" class="w-6 h-6 text-primary mx-auto mb-2"></i>
              <p class="text-2xl font-display font-bold text-foreground">4.9</p>
              <p class="text-xs text-muted-foreground">Rating</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Features Section -->
      <section class="py-20 bg-background">
        <div class="container mx-auto px-4">
          <div class="text-center mb-16">
            <span class="text-xs font-semibold text-primary uppercase tracking-wider">Features</span>
            <h2 class="text-3xl md:text-4xl font-display font-bold text-foreground mb-4 mt-2">
              Everything You Need to Succeed
            </h2>
            <p class="text-muted-foreground max-w-xl mx-auto text-sm">
              Powerful tools designed specifically for students to stay organized and focused.
            </p>
          </div>
          
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <!-- Feature 1 -->
            <div class="p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all group">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i data-lucide="clipboard-list" class="w-6 h-6 text-white"></i>
              </div>
              <h3 class="font-display font-semibold text-lg text-foreground mb-2">Assignment Manager</h3>
              <p class="text-muted-foreground text-xs leading-relaxed">Track deadlines and manage submissions effortlessly with categorized states.</p>
            </div>
            
            <!-- Feature 2 -->
            <div class="p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all group">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i data-lucide="calendar" class="w-6 h-6 text-white"></i>
              </div>
              <h3 class="font-display font-semibold text-lg text-foreground mb-2">Study Timetable</h3>
              <p class="text-muted-foreground text-xs leading-relaxed">Plan your weekly lecture and study schedules block-by-block for maximum output.</p>
            </div>
            
            <!-- Feature 3 -->
            <div class="p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all group">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-info to-info/70 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i data-lucide="bar-chart-3" class="w-6 h-6 text-white"></i>
              </div>
              <h3 class="font-display font-semibold text-lg text-foreground mb-2">Progress Tracker</h3>
              <p class="text-muted-foreground text-xs leading-relaxed">Visualize your academic productivity metrics over the last 7 days with live stats.</p>
            </div>
            
            <!-- Feature 4 -->
            <div class="p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all group">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-warning to-warning/70 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i data-lucide="sticky-note" class="w-6 h-6 text-white"></i>
              </div>
              <h3 class="font-display font-semibold text-lg text-foreground mb-2">Smart Notes</h3>
              <p class="text-muted-foreground text-xs leading-relaxed">Record lectures and attach diagrams, lecture slides, or images directly to your notes.</p>
            </div>

            <!-- Feature 5 -->
            <div class="p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all group">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-destructive to-destructive/70 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i data-lucide="timer" class="w-6 h-6 text-white"></i>
              </div>
              <h3 class="font-display font-semibold text-lg text-foreground mb-2">Pomodoro Timer</h3>
              <p class="text-muted-foreground text-xs leading-relaxed">Train your focus muscles with customized study-and-break cycles and background tracking.</p>
            </div>

            <!-- Feature 6 -->
            <div class="p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all group">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-success to-success/70 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i data-lucide="sparkles" class="w-6 h-6 text-white"></i>
              </div>
              <h3 class="font-display font-semibold text-lg text-foreground mb-2">Study Streaks</h3>
              <p class="text-muted-foreground text-xs leading-relaxed">Stay motivated by maintaining streaks, building reliable habits, and logging focused hours.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="py-20 relative overflow-hidden text-center text-primary-foreground">
        <div class="absolute inset-0 gradient-hero opacity-95"></div>
        <div class="container mx-auto px-4 relative z-10 max-w-xl">
          <h2 class="text-3xl md:text-4xl font-display font-bold mb-4">Ready to Ace Your Studies?</h2>
          <p class="text-base opacity-90 mb-8">
            Join thousands of students already using StudyFlow to organize their academic life.
          </p>
          <a href="${state.user ? '#/dashboard' : '#/register'}" class="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-primary font-bold text-lg hover:shadow-xl hover:scale-105 transition-all shadow-md">
            ${state.user ? 'Go to Dashboard' : 'Start Free Today'} <i data-lucide="arrow-right" class="w-5 h-5"></i>
          </a>
        </div>
      </section>

      <!-- Footer -->
      <footer class="border-t border-border py-8 bg-card mt-auto">
        <div class="container mx-auto px-4 text-center text-muted-foreground text-xs">
          <p>© 2026 StudyFlow. Built for students, by students.</p>
        </div>
      </footer>
    </div>
  `;
}

// ─── VIEW 2: LOGIN ───

function viewLogin() {
  return `
    <div class="min-h-screen flex bg-background">
      <!-- Left Branding Panel -->
      <div class="hidden lg:flex lg:w-[48%] relative overflow-hidden">
        <div class="absolute inset-0 gradient-hero"></div>
        <div class="absolute top-10 left-10 z-10">
          <a href="#/" class="inline-flex items-center gap-2.5 font-display text-2xl font-bold text-white">
            <div class="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <i data-lucide="book-open" class="w-5 h-5 text-white"></i>
            </div>
            StudyFlow
          </a>
        </div>

        <div class="relative z-10 flex flex-col justify-end p-14 w-full h-full text-white">
          <div class="mb-8 flex justify-center">
            <img src="assets/auth-students.png" alt="Auth illustration" class="w-80 h-auto drop-shadow-2xl animate-pulse" style="animation-duration: 6s;" />
          </div>
          <div>
            <h2 class="text-2xl font-display font-bold mb-4">Your academic life, organized.</h2>
            <div class="space-y-3 text-sm opacity-90">
              <div class="flex items-center gap-2.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Track assignments & deadlines</div>
              <div class="flex items-center gap-2.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Pomodoro focus timer</div>
              <div class="flex items-center gap-2.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Weekly study planner</div>
              <div class="flex items-center gap-2.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Smart note-taking with attachments</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Login Form -->
      <div class="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div class="absolute top-0 right-0 w-72 h-72 rounded-full bg-primary/[0.02] blur-3xl"></div>
        <div class="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-accent/[0.02] blur-3xl"></div>

        <div class="w-full max-w-[390px] relative z-10">
          <div class="lg:hidden text-center mb-8">
            <a href="#/" class="inline-flex items-center gap-2 font-display text-2xl font-bold text-primary">
              <i data-lucide="book-open" class="w-6 h-6"></i> StudyFlow
            </a>
          </div>

          <div class="mb-8">
            <div class="inline-flex items-center gap-1.5 bg-primary/5 text-primary rounded-full px-3 py-1 text-xs font-medium mb-3">
              <i data-lucide="sparkles" class="w-3 h-3 animate-spin" style="animation-duration: 4s;"></i> Welcome back
            </div>
            <h1 class="text-2xl xl:text-3xl font-display font-bold text-foreground mb-1.5">Sign in to your account</h1>
            <p class="text-muted-foreground text-xs">Continue where you left off with your studies.</p>
          </div>

          <form id="login-form" class="space-y-4">
            <div id="login-error" class="hidden text-xs text-rose-500 bg-rose-500/10 rounded-xl p-3 border border-rose-500/20"></div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1.5">Email Address</label>
              <div class="relative rounded-xl border border-border bg-card focus-within:border-primary transition-all">
                <input type="email" id="login-email" required placeholder="you@university.edu" class="w-full px-4 py-3 rounded-xl bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1.5">Password</label>
              <div class="relative rounded-xl border border-border bg-card focus-within:border-primary transition-all flex items-center">
                <input type="password" id="login-password" required placeholder="Enter password" class="w-full px-4 py-3 rounded-xl bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none" />
                <button type="button" id="login-toggle-pass" class="p-3 text-muted-foreground hover:text-foreground">
                  <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <button type="submit" id="login-submit-btn" class="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-sm hover:shadow-glow transition-all flex items-center justify-center gap-2 text-sm">
              Sign In <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
          </form>

          <div class="mt-8 pt-6 border-t border-border text-center">
            <p class="text-xs text-muted-foreground">
              Don't have an account? 
              <a href="#/register" class="text-primary font-bold hover:underline ml-1">Create one for free</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindLoginEvents() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const togglePassBtn = document.getElementById('login-toggle-pass');
  const passInput = document.getElementById('login-password');
  if (togglePassBtn && passInput) {
    togglePassBtn.onclick = () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      togglePassBtn.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
      lucide.createIcons();
    };
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = passInput.value;
    const errBox = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit-btn');

    errBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Signing in...';

    try {
      const data = await apiRequest('/api/auth/login', 'POST', { email, password });

      // Success!
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('sf_token', data.token);
      localStorage.setItem('sf_user', JSON.stringify(data.user));

      showToast(`Welcome back, ${data.user.name.split(' ')[0]}!`, 'success');

      await fetchAllData();
      window.location.hash = '#/dashboard';
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign In <i data-lucide="arrow-right" class="w-4 h-4"></i>';
      lucide.createIcons();
      showToast(err.message, 'error');
    }
  };
}

// ─── VIEW 3: REGISTER ───

function viewRegister() {
  return `
    <div class="min-h-screen flex bg-background">
      <!-- Left Panel -->
      <div class="hidden lg:flex lg:w-[48%] relative overflow-hidden">
        <div class="absolute inset-0 gradient-hero"></div>
        <div class="absolute top-10 left-10 z-10">
          <a href="#/" class="inline-flex items-center gap-2.5 font-display text-2xl font-bold text-white">
            <div class="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <i data-lucide="book-open" class="w-5 h-5 text-white"></i>
            </div>
            StudyFlow
          </a>
        </div>

        <div class="relative z-10 flex flex-col justify-end p-14 w-full h-full text-white">
          <div class="mb-8 flex justify-center">
            <img src="assets/auth-students.png" alt="Auth illustration" class="w-80 h-auto drop-shadow-2xl" />
          </div>
          <div>
            <h2 class="text-2xl font-display font-bold mb-4">Join thousands of productive students.</h2>
            <div class="space-y-3 text-sm opacity-90">
              <div class="flex items-center gap-2.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Track assignments & deadlines</div>
              <div class="flex items-center gap-2.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Pomodoro focus timer</div>
              <div class="flex items-center gap-2.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Weekly study planner</div>
              <div class="flex items-center gap-2.5"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Smart note-taking with attachments</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Form -->
      <div class="flex-1 flex items-center justify-center px-6 py-10 relative">
        <div class="absolute top-0 right-0 w-72 h-72 rounded-full bg-primary/[0.02] blur-3xl"></div>
        <div class="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-accent/[0.02] blur-3xl"></div>

        <div class="w-full max-w-[420px] relative z-10">
          <div class="lg:hidden text-center mb-6">
            <a href="#/" class="inline-flex items-center gap-2 font-display text-2xl font-bold text-primary">
              <i data-lucide="book-open" class="w-7 h-7"></i> StudyFlow
            </a>
          </div>

          <div class="mb-6">
            <div class="inline-flex items-center gap-1.5 bg-accent/10 text-accent rounded-full px-3 py-1 text-xs font-medium mb-3">
              <i data-lucide="graduation-cap" class="w-3 h-3 animate-bounce"></i> Free to get started
            </div>
            <h1 class="text-2xl xl:text-3xl font-display font-bold text-foreground mb-1.5">Create your account</h1>
            <p class="text-muted-foreground text-xs">Start organizing your study life in minutes.</p>
          </div>

          <form id="register-form" class="space-y-4">
            <div id="register-error" class="hidden text-xs text-rose-500 bg-rose-500/10 rounded-xl p-3 border border-rose-500/20"></div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1.5">Full Name *</label>
                <div class="relative rounded-xl border border-border bg-card focus-within:border-primary transition-all">
                  <input type="text" id="register-name" required placeholder="John Doe" class="w-full px-4 py-2.5 rounded-xl bg-transparent text-sm text-foreground focus:outline-none" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1.5">Email *</label>
                <div class="relative rounded-xl border border-border bg-card focus-within:border-primary transition-all">
                  <input type="email" id="register-email" required placeholder="you@uni.edu" class="w-full px-4 py-2.5 rounded-xl bg-transparent text-sm text-foreground focus:outline-none" />
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1.5">University / Course <span class="text-muted-foreground font-normal">(optional)</span></label>
              <div class="relative rounded-xl border border-border bg-card focus-within:border-primary transition-all">
                <input type="text" id="register-university" placeholder="e.g. MIT — Computer Science" class="w-full px-4 py-2.5 rounded-xl bg-transparent text-sm text-foreground focus:outline-none" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1.5">Password *</label>
                <div class="relative rounded-xl border border-border bg-card focus-within:border-primary transition-all flex items-center">
                  <input type="password" id="register-password" required placeholder="Min 6 chars" class="w-full px-4 py-2.5 rounded-xl bg-transparent text-sm text-foreground focus:outline-none" />
                  <button type="button" id="register-toggle-pass" class="p-2.5 text-muted-foreground hover:text-foreground">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1.5">Confirm *</label>
                <div class="relative rounded-xl border border-border bg-card focus-within:border-primary transition-all">
                  <input type="password" id="register-confirm" required placeholder="Re-enter" class="w-full px-4 py-2.5 rounded-xl bg-transparent text-sm text-foreground focus:outline-none" />
                </div>
              </div>
            </div>

            <button type="submit" id="register-submit-btn" class="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-sm hover:shadow-glow transition-all flex items-center justify-center gap-2 text-sm mt-2">
              Create Account <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
          </form>

          <div class="mt-6 pt-5 border-t border-border text-center">
            <p class="text-xs text-muted-foreground">
              Already have an account? 
              <a href="#/login" class="text-primary font-bold hover:underline ml-1">Sign in</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindRegisterEvents() {
  const form = document.getElementById('register-form');
  if (!form) return;

  const togglePassBtn = document.getElementById('register-toggle-pass');
  const passInput = document.getElementById('register-password');
  const confirmInput = document.getElementById('register-confirm');

  if (togglePassBtn && passInput) {
    togglePassBtn.onclick = () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      togglePassBtn.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
      lucide.createIcons();
    };
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const university = document.getElementById('register-university').value;
    const password = passInput.value;
    const confirm = confirmInput.value;
    const errBox = document.getElementById('register-error');
    const submitBtn = document.getElementById('register-submit-btn');

    errBox.classList.add('hidden');

    if (password.length < 6) {
      errBox.textContent = 'Password must be at least 6 characters';
      errBox.classList.remove('hidden');
      return;
    }
    if (password !== confirm) {
      errBox.textContent = 'Passwords do not match';
      errBox.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Creating account...';

    try {
      const data = await apiRequest('/api/auth/register', 'POST', { name, email, password, university });

      // Success!
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('sf_token', data.token);
      localStorage.setItem('sf_user', JSON.stringify(data.user));

      showToast('Account created successfully!', 'success');

      await fetchAllData();
      window.location.hash = '#/dashboard';
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create Account <i data-lucide="arrow-right" class="w-4 h-4"></i>';
      lucide.createIcons();
      showToast(err.message, 'error');
    }
  };
}

// ─── VIEW 4: DASHBOARD ───

function viewDashboard() {
  const quote = cachedQuote;

  const pending = state.assignments.filter(a => a.status === 'pending').length;
  const inProgress = state.assignments.filter(a => a.status === 'in-progress').length;
  const completed = state.assignments.filter(a => a.status === 'completed').length;
  const totalMinutes = state.studySessions.reduce((s, x) => s + x.duration, 0);
  const totalHours = Math.round(totalMinutes / 60);

  const upcoming = state.assignments
    .filter(a => a.status !== 'completed')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todaySchedule = state.timetable.filter(t => t.day === today).sort((a, b) => a.time.localeCompare(b.time));

  const completionRate = state.assignments.length > 0 ? Math.round((completed / state.assignments.length) * 100) : 0;

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekSchedule = DAYS.map(day => ({
    day: day.slice(0, 3),
    full: day,
    count: state.timetable.filter(t => t.day === day).length,
    isToday: day === today,
  }));

  // Recent sessions calculations
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const mins = state.studySessions
      .filter(s => s.date === dateStr)
      .reduce((sum, s) => sum + s.duration, 0);
    return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), mins };
  });
  const maxMins = Math.max(...last7Days.map(d => d.mins), 1);

  // Render Schedule HTML list
  let todayScheduleHTML = `
    <div class="text-center py-5">
      <img src="assets/dashboard-schedule.png" alt="No schedule" class="w-16 h-16 mx-auto mb-2 object-contain" />
      <p class="text-xs text-muted-foreground mb-2">Nothing scheduled today</p>
      <a href="#/timetable" class="inline-flex items-center gap-1 text-primary text-xs hover:underline font-medium">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Plan your week
      </a>
    </div>
  `;

  if (todaySchedule.length > 0) {
    todayScheduleHTML = `
      <div class="space-y-2">
        ${todaySchedule.slice(0, 3).map(t => `
          <div class="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors">
            <div class="w-1 h-8 rounded-full gradient-accent shrink-0"></div>
            <div class="min-w-0">
              <p class="font-medium text-foreground text-sm truncate">${t.subject}</p>
              <p class="text-xs text-muted-foreground">${t.time} — ${t.activity}</p>
            </div>
          </div>
        `).join('')}
        ${todaySchedule.length > 3 ? `
          <a href="#/timetable" class="text-xs text-primary hover:underline font-medium flex items-center gap-1 pl-1 pt-1">
            +${todaySchedule.length - 3} more <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </a>
        ` : ''}
      </div>
    `;
  }

  // Render Tasks HTML list
  let upcomingTasksHTML = `
    <div class="text-center py-8">
      <img src="assets/dashboard-tasks.png" alt="No tasks" class="w-20 h-20 mx-auto mb-3 object-contain" />
      <p class="text-sm text-muted-foreground mb-2">All clear! No tasks yet.</p>
      <a href="#/assignments" class="inline-flex items-center gap-1 text-primary text-xs hover:underline font-medium">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add your first task
      </a>
    </div>
  `;

  if (upcoming.length > 0) {
    upcomingTasksHTML = `
      <div class="space-y-2.5">
        ${upcoming.map(a => {
      const days = Math.ceil((new Date(a.deadline).getTime() - Date.now()) / 86400000);
      const urgency = days <= 1 ? 'rose-500' : days <= 3 ? 'amber-500' : 'emerald-500';
      const badgeClass = a.status === 'in-progress' ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground';

      return `
            <div class="p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-all border border-transparent hover:border-border group">
              <div class="flex items-start gap-2.5">
                <div class="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-${urgency} ${days <= 1 ? 'animate-pulse' : ''}"></div>
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-foreground text-sm truncate">${a.title}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs text-muted-foreground">${a.subject}</span>
                    <span class="text-muted-foreground/40">·</span>
                    <span class="text-xs font-semibold text-${urgency}">
                      ${days <= 0 ? 'Overdue' : `${days}d left`}
                    </span>
                  </div>
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeClass}">
                  ${a.status === 'in-progress' ? 'Active' : 'Todo'}
                </span>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  // Mini Chart Bars HTML
  const chartBarsHTML = last7Days.map(d => {
    const heightPercent = d.mins > 0 ? Math.max(15, (d.mins / maxMins) * 100) : 6;
    const barClass = d.mins > 0 ? 'bg-gradient-to-t from-blue-500 to-blue-500/60' : 'bg-muted/40';
    return `
      <div class="flex-1 flex flex-col items-center justify-end h-full gap-1">
        <div class="w-full rounded-lg ${barClass} transition-all duration-500" style="height: ${heightPercent}%;"></div>
        <span class="text-[9px] text-muted-foreground font-semibold">${d.day}</span>
      </div>
    `;
  }).join('');

  // Weekly Heatmap Bar HTML
  const weeklyBarsHTML = weekSchedule.map(d => {
    const heightPercent = d.count > 0 ? Math.max(16, d.count * 16) : 6;
    const barClass = d.isToday
      ? 'gradient-primary'
      : d.count > 0 ? 'bg-secondary' : 'bg-muted/50';

    return `
      <div class="flex-1 flex flex-col items-center justify-end gap-1">
        <div class="w-full rounded-lg ${barClass} transition-all" style="height: ${heightPercent}px;"></div>
        <span class="text-[9px] font-semibold ${d.isToday ? 'text-primary font-extrabold' : 'text-muted-foreground'}">${d.day}</span>
      </div>
    `;
  }).join('');

  const todayDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return `
    ${renderNavbar()}
    <div class="container mx-auto px-4 py-6 max-w-7xl">
      <div class="space-y-6 animate-fade-in">
        
        <!-- Welcome Banner -->
        <div class="relative overflow-hidden rounded-3xl gradient-hero text-primary-foreground p-6 lg:p-8 shadow-md">
          <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute -top-20 -left-20 w-60 h-60 rounded-full bg-white/5 blur-3xl"></div>
            <div class="absolute bottom-0 right-10 w-40 h-40 rounded-full bg-white/5 blur-2xl"></div>
          </div>

          <div class="relative flex flex-col lg:flex-row items-center gap-6">
            <div class="flex-1 min-w-0 w-full text-center lg:text-left">
              <div class="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-semibold mb-3">
                <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                ${todayDateStr}
              </div>
              <h1 class="text-2xl lg:text-3xl font-display font-bold mb-1.5 text-white">
                Welcome back, ${state.user?.name ? state.user.name.split(' ')[0] : 'Student'}! 👋
              </h1>
              <p class="opacity-80 text-sm max-w-lg mx-auto lg:mx-0 leading-relaxed text-white">
                You have <span class="font-bold">${pending + inProgress}</span> active tasks and
                <span class="font-bold">${totalHours}h</span> of study time logged. Let's keep going!
              </p>

              <!-- Progress bar -->
              <div class="mt-5 flex items-center gap-3 max-w-sm mx-auto lg:mx-0 text-white">
                <i data-lucide="target" class="w-4 h-4 shrink-0"></i>
                <div class="flex-1">
                  <div class="flex justify-between text-xs mb-1 font-semibold">
                    <span>Tasks completed</span>
                    <span>${completionRate}%</span>
                  </div>
                  <div class="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div class="h-full bg-white rounded-full transition-all duration-1000" style="width: ${completionRate}%"></div>
                  </div>
                </div>
              </div>

              <!-- Quick Action Row -->
              <div class="flex flex-wrap justify-center lg:justify-start gap-2 mt-6">
                <a href="#/assignments" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors text-white">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add Task
                </a>
                <a href="#/notes" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors text-white">
                  <i data-lucide="book-open" class="w-3.5 h-3.5"></i> New Note
                </a>
                <a href="#/profile" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors text-white">
                  <i data-lucide="timer" class="w-3.5 h-3.5"></i> Pomodoro
                </a>
              </div>
            </div>

            <div class="hidden lg:block shrink-0">
              <img
                src="assets/dashboard-hero.png"
                alt="Student workspace"
                class="w-56 h-auto drop-shadow-2xl animate-pulse"
                style="animation-duration: 5s;"
              />
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <!-- Pending -->
          <div class="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 lg:p-5 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all relative overflow-hidden group">
            <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-amber-500/30 opacity-5 group-hover:opacity-10 transition-all blur-xl"></div>
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2.5">
              <i data-lucide="clock" class="w-5 h-5 text-amber-500"></i>
            </div>
            <p class="text-2xl lg:text-3xl font-display font-bold text-foreground">${pending}</p>
            <p class="text-xs text-muted-foreground mt-0.5 font-medium">Pending Tasks</p>
          </div>
          
          <!-- In Progress -->
          <div class="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-4 lg:p-5 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all relative overflow-hidden group">
            <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-500/30 opacity-5 group-hover:opacity-10 transition-all blur-xl"></div>
            <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2.5">
              <i data-lucide="trending-up" class="w-5 h-5 text-blue-500"></i>
            </div>
            <p class="text-2xl lg:text-3xl font-display font-bold text-foreground">${inProgress}</p>
            <p class="text-xs text-muted-foreground mt-0.5 font-medium">In Progress</p>
          </div>

          <!-- Completed -->
          <div class="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4 lg:p-5 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all relative overflow-hidden group">
            <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-500/30 opacity-5 group-hover:opacity-10 transition-all blur-xl"></div>
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2.5">
              <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-500"></i>
            </div>
            <p class="text-2xl lg:text-3xl font-display font-bold text-foreground">${completed}</p>
            <p class="text-xs text-muted-foreground mt-0.5 font-medium">Completed</p>
          </div>

          <!-- Study Hours -->
          <div class="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-4 lg:p-5 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all relative overflow-hidden group">
            <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-500/30 opacity-5 group-hover:opacity-10 transition-all blur-xl"></div>
            <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2.5">
              <i data-lucide="zap" class="w-5 h-5 text-blue-500"></i>
            </div>
            <p class="text-2xl lg:text-3xl font-display font-bold text-foreground">${totalHours}h</p>
            <p class="text-xs text-muted-foreground mt-0.5 font-medium">Study Hours</p>
          </div>
        </div>

        <!-- Motivational Quote Banner -->
        <div class="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-r from-primary/[0.04] via-accent/[0.02] to-primary/[0.04] p-5 lg:p-6 shadow-sm">
          <div class="relative flex items-center gap-4">
            <div class="hidden sm:flex w-12 h-12 rounded-xl gradient-primary items-center justify-center shrink-0 shadow-glow">
              <i data-lucide="quote" class="w-5 h-5 text-white"></i>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[9px] uppercase tracking-[0.2em] text-primary font-bold mb-1 flex items-center gap-1.5">
                <i data-lucide="sparkles" class="w-3 h-3 text-primary animate-spin" style="animation-duration: 6s;"></i> Daily Motivation
              </p>
              <p class="text-sm lg:text-base text-foreground font-medium italic leading-relaxed">
                "${quote}"
              </p>
            </div>
          </div>
        </div>

        <!-- 3-Column main content layout -->
        <div class="grid lg:grid-cols-3 gap-5">
          <!-- Column 1: Today's Tasks -->
          <div class="lg:col-span-1 bg-card border border-border rounded-2xl shadow-card p-5 flex flex-col hover:shadow-card-hover transition-shadow">
            <div class="pb-3.5 flex items-center justify-between">
              <h2 class="font-display font-semibold text-base text-foreground flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                  <i data-lucide="clipboard-list" class="w-3.5 h-3.5 text-white"></i>
                </div>
                Today's Tasks
              </h2>
              <a href="#/assignments" class="text-xs text-primary hover:underline flex items-center gap-0.5 font-bold">
                All <i data-lucide="chevron-right" class="w-3 h-3"></i>
              </a>
            </div>
            <div class="flex-1">
              ${upcomingTasksHTML}
            </div>
          </div>

          <!-- Column 2: Today's Schedule -->
          <div class="lg:col-span-1 space-y-4">
            <div class="bg-card border border-border rounded-2xl shadow-card p-5 hover:shadow-card-hover transition-shadow">
              <div class="pb-3.5 flex items-center justify-between">
                <h2 class="font-display font-semibold text-base text-foreground flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg gradient-accent flex items-center justify-center">
                    <i data-lucide="calendar" class="w-3.5 h-3.5 text-white"></i>
                  </div>
                  Today's Schedule
                </h2>
                <a href="#/timetable" class="text-xs text-primary hover:underline flex items-center gap-0.5 font-bold">
                  All <i data-lucide="chevron-right" class="w-3 h-3"></i>
                </a>
              </div>
              <div>
                ${todayScheduleHTML}
              </div>
            </div>

            <!-- Weekly Overview heatmap -->
            <div class="bg-card border border-border rounded-2xl shadow-card p-5">
              <h2 class="font-display font-semibold text-base text-foreground flex items-center gap-2 mb-4">
                <div class="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                  <i data-lucide="bar-chart-3" class="w-3.5 h-3.5 text-accent"></i>
                </div>
                Weekly Plan
              </h2>
              <div class="flex items-end gap-1.5 h-16 mt-2">
                ${weeklyBarsHTML}
              </div>
              <div class="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span class="text-xs text-muted-foreground font-medium">${state.timetable.length} classes/week</span>
                <a href="#/timetable" class="text-xs text-primary hover:underline font-bold flex items-center gap-0.5">
                  Edit <i data-lucide="chevron-right" class="w-3 h-3"></i>
                </a>
              </div>
            </div>
          </div>

          <!-- Column 3: Study Progress -->
          <div class="lg:col-span-1">
            <div class="bg-card border border-border rounded-2xl shadow-card p-5">
              <h2 class="font-display font-semibold text-base text-foreground flex items-center gap-2 mb-4">
                <div class="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <i data-lucide="trending-up" class="w-3.5 h-3.5 text-blue-500"></i>
                </div>
                Study Progress
              </h2>
              <div class="flex items-end gap-1.5 h-20 mt-2">
                ${chartBarsHTML}
              </div>
              <div class="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span class="text-xs text-muted-foreground font-medium">${totalHours}h study total</span>
                <div class="flex items-center gap-1 text-xs text-blue-500 font-bold">
                  <i data-lucide="zap" class="w-3 h-3 shrink-0 animate-bounce"></i> ${totalMinutes}m this week
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pomodoro widget + Week planner banner -->
        <div class="grid md:grid-cols-2 gap-4">
          <!-- Active Pomodoro status card -->
          <div>
            <a href="#/profile" class="block group">
              <div class="bg-card border border-border rounded-2xl shadow-card hover:shadow-card-hover transition-all p-5 flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${state.pomodoro.isRunning ? 'gradient-primary animate-pulse-glow' : 'bg-secondary'}">
                  <i data-lucide="timer" class="w-6 h-6 ${state.pomodoro.isRunning ? 'text-white' : 'text-muted-foreground'}"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-display font-semibold text-foreground text-sm">Pomodoro Timer</p>
                  <p class="text-xs mt-0.5 ${state.pomodoro.isRunning ? 'text-primary font-semibold' : 'text-muted-foreground'}">
                    ${state.pomodoro.isRunning
      ? `${String(state.pomodoro.minutes).padStart(2, '0')}:${String(state.pomodoro.seconds).padStart(2, '0')} remaining · ${state.pomodoro.mode} mode`
      : 'Start a focus session to boost productivity'}
                  </p>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-1 transition-transform"></i>
              </div>
            </a>
          </div>

          <!-- Planner CTA -->
          <div class="relative overflow-hidden bg-gradient-to-r from-accent/5 to-primary/5 border border-accent/15 rounded-2xl shadow-card p-5 flex items-center gap-4 hover:shadow-card-hover transition-all group">
            <img src="assets/dashboard-planner.png" alt="Planner" class="w-12 h-12 object-contain shrink-0 group-hover:scale-105 transition-transform" />
            <div class="min-w-0 flex-1">
              <p class="font-display font-semibold text-foreground text-sm flex items-center gap-1.5">
                <i data-lucide="star" class="w-3.5 h-3.5 text-accent fill-accent"></i> Plan Your Week
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">Organize your classes, deadlines, and study blocks</p>
            </div>
            <a href="#/timetable" class="px-3 py-1.5 rounded-lg gradient-accent text-white text-xs font-semibold hover:shadow-glow transition-shadow shrink-0 select-none">
              Go <i data-lucide="arrow-right" class="w-3 h-3 inline ml-0.5"></i>
            </a>
          </div>
        </div>

      </div>
    </div>
  `;
}

function bindDashboardEvents() {
  bindNavbarEvents();
}

// ─── VIEW 5: ASSIGNMENTS ───

function viewAssignments() {
  const completedCount = state.assignments.filter(a => a.status === 'completed').length;
  const inProgressCount = state.assignments.filter(a => a.status === 'in-progress').length;
  const pendingCount = state.assignments.filter(a => a.status === 'pending').length;
  const completionRate = state.assignments.length > 0 ? Math.round((completedCount / state.assignments.length) * 100) : 0;

  const filter = state.assignmentFilter;
  const filtered = state.assignments
    .filter(a => filter === 'all' || a.status === filter)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  // Render Form HTML Modal
  const formModalHTML = state.showAssignmentForm ? `
    <div id="assignment-modal" class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <form id="assignment-add-form" class="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-lg space-y-4 max-h-[90vh] overflow-y-auto animate-scale-in">
        <div class="flex items-center justify-between">
          <h2 class="font-display font-bold text-lg text-foreground">New Assignment</h2>
          <button type="button" id="assignment-modal-close" class="text-muted-foreground hover:text-foreground transition-colors">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Subject *</label>
          <input type="text" id="assign-subject" required placeholder="e.g. Web Development"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Title *</label>
          <input type="text" id="assign-title" required placeholder="e.g. Final Project Report"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Description</label>
          <textarea id="assign-desc" placeholder="Details..." rows="3"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Deadline *</label>
          <input type="date" id="assign-deadline" required
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        <button type="submit" class="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-sm hover:shadow-glow transition-shadow">
          Add Assignment
        </button>
      </form>
    </div>
  ` : '';

  // Render items list
  let itemsListHTML = `
    <div class="text-center py-16 bg-card border border-border rounded-3xl shadow-card">
      <img src="assets/empty-assignments.png" alt="No assignments" class="w-32 h-32 mx-auto mb-5 opacity-60 object-contain" />
      <p class="text-xl mb-1.5 font-display font-bold text-foreground">No assignments yet</p>
      <p class="text-xs text-muted-foreground mb-6">Click "Add Assignment" to get started</p>
      <button id="assign-empty-btn" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold shadow-sm hover:shadow-glow transition-shadow">
        <i data-lucide="plus" class="w-4 h-4"></i> Create First Assignment
      </button>
    </div>
  `;

  if (filtered.length > 0) {
    itemsListHTML = `
      <div class="space-y-3">
        ${filtered.map((a, i) => {
      const days = Math.ceil((new Date(a.deadline).getTime() - Date.now()) / 86400000);

      let statusBorder = 'border-l-muted-foreground/30';
      let statusIcon = '<i data-lucide="alert-circle" class="w-5 h-5 text-muted-foreground"></i>';
      let statusBg = 'bg-secondary/40';

      if (a.status === 'completed') {
        statusBorder = 'border-l-emerald-500';
        statusIcon = '<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-500"></i>';
        statusBg = 'bg-emerald-500/5';
      } else if (a.status === 'in-progress') {
        statusBorder = 'border-l-amber-500';
        statusIcon = '<i data-lucide="clock" class="w-5 h-5 text-amber-500"></i>';
        statusBg = 'bg-amber-500/5';
      }

      let countdownText = `${days} day${days !== 1 ? 's' : ''} left`;
      let countdownClass = 'bg-secondary text-muted-foreground';
      if (days <= 0) {
        countdownText = 'Overdue!';
        countdownClass = 'bg-rose-500/10 text-rose-500';
      } else if (days <= 3) {
        countdownClass = 'bg-amber-500/10 text-amber-500';
      }

      const formattedDate = new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      return `
            <div class="bg-card border border-border border-l-4 ${statusBorder} rounded-2xl p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 mb-1.5">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${statusBg}">
                      ${statusIcon}
                    </div>
                    <div class="min-w-0">
                      <h3 class="font-semibold text-foreground leading-tight truncate text-sm sm:text-base">${a.title}</h3>
                      <p class="text-xs text-primary font-bold mt-0.5">${a.subject}</p>
                    </div>
                  </div>
                  
                  ${a.description ? `<p class="text-xs text-muted-foreground mt-2 pl-11 leading-relaxed">${a.description}</p>` : ''}
                  
                  <div class="flex items-center gap-3 mt-3.5 pl-11">
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${countdownClass}">
                      ⏰ ${countdownText}
                    </span>
                    <span class="text-[10px] text-muted-foreground font-semibold">
                      Due ${formattedDate}
                    </span>
                  </div>
                </div>

                <div class="flex flex-col gap-2 shrink-0">
                  <select data-id="${a.id}" class="assign-status-select text-xs px-2.5 py-1.5 rounded-xl border border-border bg-background text-foreground cursor-pointer hover:border-primary/50 focus:outline-none font-semibold">
                    <option value="pending" ${a.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="in-progress" ${a.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                    <option value="completed" ${a.status === 'completed' ? 'selected' : ''}>Completed</option>
                  </select>
                  <button data-id="${a.id}" class="assign-delete-btn p-1.5 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors self-end">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  // Filter chips active class styling
  const chipClass = (f) => filter === f
    ? 'gradient-primary text-primary-foreground font-semibold shadow-sm'
    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 shadow-card';

  return `
    ${renderNavbar()}
    <div class="container mx-auto px-4 py-8 max-w-5xl">
      <div class="space-y-6 animate-fade-in">
        
        <!-- Header banner -->
        <div class="relative overflow-hidden rounded-3xl gradient-hero p-8 text-primary-foreground shadow-md">
          <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          <div class="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4"></div>
          <div class="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 class="text-2xl md:text-3xl font-display font-bold mb-2 text-white">📚 My Assignments</h1>
              <p class="text-white/80 text-xs sm:text-sm max-w-md leading-relaxed">
                Stay on top of your coursework. Track deadlines, manage progress, and crush your goals.
              </p>
            </div>
            <button id="assign-add-btn" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all border border-white/20">
              <i data-lucide="plus" class="w-4 h-4"></i> Add Assignment
            </button>
          </div>
        </div>

        <!-- Statistics widgets -->
        ${state.assignments.length > 0 ? `
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-primary/5 border border-primary/10 rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-all">
              <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                <i data-lucide="book-open" class="w-4 h-4 text-primary"></i>
              </div>
              <p class="text-2xl font-display font-bold text-foreground">${state.assignments.length}</p>
              <p class="text-xs text-muted-foreground font-semibold">Total</p>
            </div>
            <div class="bg-secondary/40 border border-border rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-all">
              <div class="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center mb-2">
                <i data-lucide="alert-circle" class="w-4 h-4 text-muted-foreground"></i>
              </div>
              <p class="text-2xl font-display font-bold text-foreground">${pendingCount}</p>
              <p class="text-xs text-muted-foreground font-semibold">Pending</p>
            </div>
            <div class="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-all">
              <div class="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center mb-2">
                <i data-lucide="clock" class="w-4 h-4 text-amber-500"></i>
              </div>
              <p class="text-2xl font-display font-bold text-foreground">${inProgressCount}</p>
              <p class="text-xs text-muted-foreground font-semibold">In Progress</p>
            </div>
            <div class="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-all">
              <div class="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-2">
                <i data-lucide="target" class="w-4 h-4 text-emerald-500"></i>
              </div>
              <p class="text-2xl font-display font-bold text-foreground">${completedCount}</p>
              <p class="text-xs text-muted-foreground font-semibold">Completed</p>
            </div>
          </div>
        ` : ''}

        <!-- Filters section -->
        <div class="flex gap-2 flex-wrap">
          <button data-filter="all" class="assign-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${chipClass('all')}">
            All (${state.assignments.length})
          </button>
          <button data-filter="pending" class="assign-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${chipClass('pending')}">
            Pending (${pendingCount})
          </button>
          <button data-filter="in-progress" class="assign-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${chipClass('in-progress')}">
            In Progress (${inProgressCount})
          </button>
          <button data-filter="completed" class="assign-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${chipClass('completed')}">
            Completed (${completedCount})
          </button>
        </div>

        <!-- Assignments grid -->
        ${itemsListHTML}

        <!-- Progress stats bar -->
        ${state.assignments.length > 0 ? `
          <div class="bg-card border border-border rounded-2xl p-6 shadow-card">
            <h2 class="font-display font-bold text-base text-foreground mb-4 flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <i data-lucide="trending-up" class="w-4 h-4 text-primary"></i>
              </div>
              Overall Progress
            </h2>
            <div class="space-y-2">
              <div class="flex justify-between text-xs sm:text-sm font-semibold">
                <span class="text-muted-foreground">Completion Rate</span>
                <span class="text-foreground">${completionRate}%</span>
              </div>
              <div class="h-3.5 bg-secondary rounded-full overflow-hidden">
                <div class="h-full gradient-accent rounded-full" style="width: ${completionRate}%;"></div>
              </div>
              <p class="text-xs text-muted-foreground font-medium">
                ${completedCount} of ${state.assignments.length} assignments completed
              </p>
            </div>
          </div>
        ` : ''}

        ${formModalHTML}
      </div>
    </div>
  `;
}

function bindAssignmentsEvents() {
  bindNavbarEvents();

  // Add Assignment Modal toggles
  const addBtn = document.getElementById('assign-add-btn');
  if (addBtn) addBtn.onclick = () => { state.showAssignmentForm = true; renderCurrentView(); };

  const emptyBtn = document.getElementById('assign-empty-btn');
  if (emptyBtn) emptyBtn.onclick = () => { state.showAssignmentForm = true; renderCurrentView(); };

  const closeBtn = document.getElementById('assignment-modal-close');
  const modal = document.getElementById('assignment-modal');
  if (closeBtn) {
    closeBtn.onclick = () => { state.showAssignmentForm = false; renderCurrentView(); };
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        state.showAssignmentForm = false;
        renderCurrentView();
      }
    };
  }

  // Filter chips listeners
  document.querySelectorAll('.assign-filter-btn').forEach(btn => {
    btn.onclick = () => {
      state.assignmentFilter = btn.getAttribute('data-filter');
      renderCurrentView();
    };
  });

  // CRUD actions
  // Submit new assignment
  const addForm = document.getElementById('assignment-add-form');
  if (addForm) {
    addForm.onsubmit = async (e) => {
      e.preventDefault();
      const subject = document.getElementById('assign-subject').value.trim();
      const title = document.getElementById('assign-title').value.trim();
      const description = document.getElementById('assign-desc').value.trim();
      const deadline = document.getElementById('assign-deadline').value;

      if (!subject || !title || !deadline) return;

      const payload = { subject, title, description, deadline, status: 'pending' };

      if (isOfflineMode()) {
        payload.id = Math.random().toString(36).substring(2, 9);
        payload.createdAt = new Date().toISOString();
        state.assignments.unshift(payload);
        saveLocalData('assignments', state.assignments);
        state.showAssignmentForm = false;
        showToast('Assignment added (offline)', 'success');
        renderCurrentView();
        return;
      }

      try {
        const a = await apiRequest('/api/assignments', 'POST', payload);
        state.assignments.unshift(a);
        state.showAssignmentForm = false;
        showToast('Assignment added successfully', 'success');
        renderCurrentView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // Dropdown update status
  document.querySelectorAll('.assign-status-select').forEach(select => {
    select.onchange = async () => {
      const id = select.getAttribute('data-id');
      const newStatus = select.value;

      if (isOfflineMode()) {
        state.assignments = state.assignments.map(a => a.id === id ? { ...a, status: newStatus } : a);
        saveLocalData('assignments', state.assignments);
        showToast('Status updated (offline)', 'info');
        renderCurrentView();
        return;
      }

      try {
        const a = await apiRequest(`/api/assignments/${id}`, 'PUT', { status: newStatus });
        state.assignments = state.assignments.map(x => x.id === id ? a : x);
        showToast('Status updated', 'success');
        renderCurrentView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  });

  // Delete assignment
  document.querySelectorAll('.assign-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Are you sure you want to delete this assignment?')) return;

      if (isOfflineMode()) {
        state.assignments = state.assignments.filter(a => a.id !== id);
        saveLocalData('assignments', state.assignments);
        showToast('Assignment deleted (offline)', 'info');
        renderCurrentView();
        return;
      }

      try {
        await apiRequest(`/api/assignments/${id}`, 'DELETE');
        state.assignments = state.assignments.filter(x => x.id !== id);
        showToast('Assignment deleted', 'success');
        renderCurrentView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  });
}

// ─── VIEW 6: TIMETABLE ───

function viewTimetable() {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayEmojis = ['🔵', '🟢', '🟡', '🟠', '🔴', '🟣', '⚪'];
  const dayGradients = [
    'from-blue-500/15 to-blue-500/5',
    'from-teal-500/15 to-teal-500/5',
    'from-amber-500/15 to-amber-500/5',
    'from-sky-500/15 to-sky-500/5',
    'from-emerald-500/15 to-emerald-500/5',
    'from-rose-500/15 to-rose-500/5',
    'from-slate-500/15 to-slate-500/5',
  ];
  const dayAccents = ['text-blue-500', 'text-teal-500', 'text-amber-500', 'text-sky-500', 'text-emerald-500', 'text-rose-500', 'text-slate-500'];
  const dayBorders = ['border-blue-500/20', 'border-teal-500/20', 'border-amber-500/20', 'border-sky-500/20', 'border-emerald-500/20', 'border-rose-500/20', 'border-border'];

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const totalSessions = state.timetable.length;
  const todaySessions = state.timetable.filter(t => t.day === today).length;

  const formModalHTML = state.showTimetableForm ? `
    <div id="timetable-modal" class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <form id="timetable-add-form" class="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-lg space-y-4 max-h-[90vh] overflow-y-auto animate-scale-in">
        <div class="flex items-center justify-between">
          <h2 class="font-display font-bold text-lg text-foreground">New Schedule Entry</h2>
          <button type="button" id="timetable-modal-close" class="text-muted-foreground hover:text-foreground transition-colors">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Day</label>
          <select id="time-day" class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold">
            ${DAYS.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Time</label>
          <input type="time" id="time-clock" required
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Subject</label>
          <input type="text" id="time-subject" required placeholder="e.g. Programming"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Activity</label>
          <input type="text" id="time-activity" required placeholder="e.g. Lecture, Revision, Practice"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        <button type="submit" class="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-sm hover:shadow-glow transition-shadow">
          Add Entry
        </button>
      </form>
    </div>
  ` : '';

  // Render weekly layout cards
  const weeklyHTML = DAYS.map((d, di) => {
    const entries = state.timetable.filter(t => t.day === d).sort((a, b) => a.time.localeCompare(b.time));
    const isToday = d === today;
    const borderAccent = isToday ? 'border-primary border-2 ring-4 ring-primary/10' : 'border-border';

    let entriesHTML = `
      <div class="px-5 py-4 text-xs text-muted-foreground italic flex items-center gap-2 font-medium">
        <i data-lucide="clock" class="w-4 h-4 opacity-40"></i> No sessions planned
      </div>
    `;

    if (entries.length > 0) {
      entriesHTML = `
        <div class="divide-y divide-border">
          ${entries.map(entry => `
            <div class="px-5 py-3.5 flex items-center justify-between hover:bg-secondary/30 transition-colors group">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${dayGradients[di]} border ${dayBorders[di]} flex items-center justify-center shrink-0">
                  <span class="text-xs font-mono ${dayAccents[di]} font-extrabold">${entry.time}</span>
                </div>
                <div>
                  <p class="font-bold text-foreground text-sm leading-tight">${entry.subject}</p>
                  <p class="text-xs text-muted-foreground mt-0.5 font-medium">${entry.activity}</p>
                </div>
              </div>
              <button data-id="${entry.id}" class="timetable-delete-btn p-2 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all ${borderAccent}">
        <div class="px-5 py-3.5 bg-gradient-to-r ${dayGradients[di]} border-b ${dayBorders[di]} flex items-center justify-between">
          <h3 class="font-display font-bold ${dayAccents[di]} flex items-center gap-2 text-sm sm:text-base">
            <span class="text-lg">${dayEmojis[di]}</span>
            ${d}
            ${isToday ? `<span class="text-[9px] ml-1 px-2 py-0.5 rounded-full gradient-primary text-white font-extrabold shadow-sm">Today</span>` : ''}
          </h3>
          <span class="text-[10px] text-muted-foreground bg-card/60 px-2.5 py-1 rounded-full font-bold">
            ${entries.length} session${entries.length !== 1 ? 's' : ''}
          </span>
        </div>
        ${entriesHTML}
      </div>
    `;
  }).join('');

  return `
    ${renderNavbar()}
    <div class="container mx-auto px-4 py-8 max-w-5xl">
      <div class="space-y-6 animate-fade-in">
        
        <!-- Header -->
        <div class="relative overflow-hidden rounded-3xl gradient-hero p-8 text-primary-foreground shadow-md">
          <div class="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
          <div class="absolute bottom-0 left-10 w-32 h-32 bg-white/5 rounded-full translate-y-1/2"></div>
          <div class="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 class="text-2xl md:text-3xl font-display font-bold mb-2 text-white">📅 Study Timetable</h1>
              <p class="text-white/80 text-xs sm:text-sm max-w-md leading-relaxed">
                Organize your week. Plan study sessions and stay consistent with your routine.
              </p>
              <div class="flex gap-4 mt-4">
                <div class="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs text-white">
                  <i data-lucide="calendar" class="w-4 h-4"></i>
                  <span class="font-bold">${totalSessions}</span>
                  <span class="opacity-75">sessions</span>
                </div>
                <div class="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs text-white">
                  <i data-lucide="sparkles" class="w-4 h-4"></i>
                  <span class="font-bold">${todaySessions}</span>
                  <span class="opacity-75">today</span>
                </div>
              </div>
            </div>
            <button id="timetable-add-btn" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all border border-white/20">
              <i data-lucide="plus" class="w-4 h-4"></i> Add Entry
            </button>
          </div>
        </div>

        <!-- Accordions/Week layout -->
        <div class="space-y-4">
          ${totalSessions === 0 ? `
            <div class="text-center py-16 bg-card border border-border rounded-3xl shadow-card">
              <img src="assets/empty-timetable.png" alt="No timetable" class="w-32 h-32 mx-auto mb-5 opacity-60 object-contain" />
              <p class="text-xl mb-1.5 font-display font-bold text-foreground">No study sessions planned</p>
              <p class="text-xs text-muted-foreground mb-6">Add entries to build your weekly schedule</p>
              <button id="time-empty-btn" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold shadow-sm hover:shadow-glow transition-shadow">
                <i data-lucide="plus" class="w-4 h-4"></i> Plan Your Week
              </button>
            </div>
          ` : weeklyHTML}
        </div>

        ${formModalHTML}
      </div>
    </div>
  `;
}

function bindTimetableEvents() {
  bindNavbarEvents();

  const addBtn = document.getElementById('timetable-add-btn');
  if (addBtn) addBtn.onclick = () => { state.showTimetableForm = true; renderCurrentView(); };

  const emptyBtn = document.getElementById('time-empty-btn');
  if (emptyBtn) emptyBtn.onclick = () => { state.showTimetableForm = true; renderCurrentView(); };

  const closeBtn = document.getElementById('timetable-modal-close');
  const modal = document.getElementById('timetable-modal');
  if (closeBtn) {
    closeBtn.onclick = () => { state.showTimetableForm = false; renderCurrentView(); };
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        state.showTimetableForm = false;
        renderCurrentView();
      }
    };
  }

  // Submit entry form
  const addForm = document.getElementById('timetable-add-form');
  if (addForm) {
    addForm.onsubmit = async (e) => {
      e.preventDefault();
      const day = document.getElementById('time-day').value;
      const time = document.getElementById('time-clock').value;
      const subject = document.getElementById('time-subject').value.trim();
      const activity = document.getElementById('time-activity').value.trim();

      if (!time || !subject || !activity) return;

      const payload = { day, time, subject, activity };

      if (isOfflineMode()) {
        payload.id = Math.random().toString(36).substring(2, 9);
        state.timetable.push(payload);
        saveLocalData('timetable', state.timetable);
        state.showTimetableForm = false;
        showToast('Timetable slot added (offline)', 'success');
        renderCurrentView();
        return;
      }

      try {
        const t = await apiRequest('/api/timetable', 'POST', payload);
        state.timetable.push(t);
        state.showTimetableForm = false;
        showToast('Timetable slot added successfully', 'success');
        renderCurrentView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // Delete entry
  document.querySelectorAll('.timetable-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Are you sure you want to delete this schedule entry?')) return;

      if (isOfflineMode()) {
        state.timetable = state.timetable.filter(t => t.id !== id);
        saveLocalData('timetable', state.timetable);
        showToast('Slot deleted (offline)', 'info');
        renderCurrentView();
        return;
      }

      try {
        await apiRequest(`/api/timetable/${id}`, 'DELETE');
        state.timetable = state.timetable.filter(x => x.id !== id);
        showToast('Timetable slot deleted', 'success');
        renderCurrentView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  });
}

// ─── VIEW 7: NOTES ───

function getFileIcon(type) {
  if (type.startsWith('image/')) return 'image';
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) return 'file-text';
  return 'file';
}

function viewNotes() {
  const filteredNotes = state.searchQuery
    ? state.notes.filter(n =>
      n.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(state.searchQuery.toLowerCase())
    )
    : state.notes;

  const noteGradients = [
    'from-blue-500/[0.04] to-transparent',
    'from-teal-500/[0.04] to-transparent',
    'from-amber-500/[0.04] to-transparent',
    'from-sky-500/[0.04] to-transparent',
    'from-emerald-500/[0.04] to-transparent',
    'from-rose-500/[0.04] to-transparent',
  ];
  const noteAccents = [
    'border-l-primary',
    'border-l-accent',
    'border-l-amber-500',
    'border-l-sky-500',
    'border-l-emerald-500',
    'border-l-rose-500',
  ];

  // Forms modals
  const isFormOpen = state.showNoteForm || state.noteEditId;
  const formModalHTML = isFormOpen ? `
    <div id="note-modal" class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <form id="note-submit-form" class="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-lg space-y-4 max-h-[90vh] overflow-y-auto animate-scale-in">
        <div class="flex items-center justify-between">
          <h2 class="font-display font-bold text-lg text-foreground">${state.noteEditId ? 'Edit Note' : 'New Note'}</h2>
          <button type="button" id="note-modal-close" class="text-muted-foreground hover:text-foreground transition-colors">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Title</label>
          <input type="text" id="note-title" required placeholder="Note title" value="${state.noteEditId ? state.notes.find(n => n.id === state.noteEditId)?.title || '' : ''}"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Content</label>
          <textarea id="note-content" required placeholder="Write your notes here..." rows="5"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all">${state.noteEditId ? state.notes.find(n => n.id === state.noteEditId)?.content || '' : ''}</textarea>
        </div>

        <!-- File Attachments Area -->
        <div>
          <label class="block text-xs font-semibold text-foreground mb-2">Attachments</label>
          <input type="file" id="note-file-input" multiple accept="image/*,.pdf,.doc,.docx,.txt,.pptx,.xlsx" class="hidden" />
          <button type="button" id="note-attach-trigger" class="w-full border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 hover:bg-primary/5 transition-all group">
            <i data-lucide="paperclip" class="w-6 h-6 mx-auto mb-1.5 text-muted-foreground group-hover:text-primary transition-colors"></i>
            <p class="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">Click to attach files</p>
            <p class="text-[10px] text-muted-foreground mt-0.5 font-semibold">Images, PDFs, Docs — Max 5MB each</p>
          </button>

          <!-- Selected attachments drawer -->
          <div id="note-form-attachments-list" class="mt-3 space-y-2 max-h-40 overflow-y-auto ${state.noteFormAttachments.length > 0 ? '' : 'hidden'}">
            ${state.noteFormAttachments.map(att => `
              <div class="flex items-center gap-3 p-2 rounded-xl bg-secondary/50 border border-border text-xs">
                ${att.type.startsWith('image/')
      ? `<img src="${att.dataUrl}" alt="" class="w-8 h-8 rounded object-cover border border-border shrink-0" />`
      : `<div class="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                       <i data-lucide="${getFileIcon(att.type)}" class="w-4 h-4 text-primary"></i>
                     </div>`
    }
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-foreground truncate">${att.name}</p>
                  <p class="text-[10px] text-muted-foreground mt-0.5">${formatSize(att.size)}</p>
                </div>
                <button type="button" data-id="${att.id}" class="note-remove-attachment p-1 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 rounded-lg">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>

        <button type="submit" class="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-sm hover:shadow-glow transition-shadow inline-flex items-center justify-center gap-2">
          <i data-lucide="save" class="w-4 h-4"></i> ${state.noteEditId ? 'Save Changes' : 'Add Note'}
        </button>
      </form>
    </div>
  ` : '';

  // Render Attachment Preview Modal
  const previewModalHTML = state.notePreviewAttachment ? `
    <div id="note-preview-modal" class="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div class="bg-card border border-border rounded-2xl p-4 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-xl animate-scale-in">
        <div class="flex items-center justify-between mb-3 border-b border-border pb-2">
          <p class="font-bold text-foreground truncate text-sm flex-1 mr-4">${state.notePreviewAttachment.name}</p>
          <div class="flex gap-2">
            <button id="note-download-att" class="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <i data-lucide="download" class="w-4 h-4"></i>
            </button>
            <button id="note-preview-close" class="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        ${state.notePreviewAttachment.type.startsWith('image/')
      ? `<img src="${state.notePreviewAttachment.dataUrl}" alt="" class="w-full rounded-xl object-contain max-h-[70vh] border border-border" />`
      : `<div class="text-center py-12">
               <i data-lucide="file-text" class="w-14 h-14 mx-auto mb-3 text-muted-foreground"></i>
               <p class="text-muted-foreground text-xs font-semibold">Preview not available for this file type</p>
               <button id="note-download-att-btn" class="mt-3.5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-bold">
                 <i data-lucide="download" class="w-4 h-4"></i> Download File
               </button>
             </div>`
    }
      </div>
    </div>
  ` : '';

  // Render Notes Grid
  let gridHTML = `
    <div class="text-center py-16 bg-card border border-border rounded-3xl shadow-card">
      <img src="assets/empty-notes.png" alt="No notes" class="w-32 h-32 mx-auto mb-5 opacity-60 object-contain" />
      <p class="text-xl mb-1.5 font-display font-bold text-foreground">
        ${state.searchQuery ? 'No matching notes' : 'No notes yet'}
      </p>
      <p class="text-xs text-muted-foreground mb-6">
        ${state.searchQuery ? 'Try a different search query' : 'Start capturing your ideas and lecture notes'}
      </p>
      ${!state.searchQuery ? `
        <button id="note-empty-btn" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold shadow-sm hover:shadow-glow transition-shadow">
          <i data-lucide="plus" class="w-4 h-4"></i> Write First Note
        </button>
      ` : ''}
    </div>
  `;

  if (filteredNotes.length > 0) {
    gridHTML = `
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${filteredNotes.map((n, i) => {
      const noteAttachments = n.attachments || [];
      const imageAttachments = noteAttachments.filter(a => a.type.startsWith('image/'));
      const fileAttachments = noteAttachments.filter(a => !a.type.startsWith('image/'));

      // Preview Strip (up to 3 images)
      let imageStripHTML = '';
      if (imageAttachments.length > 0) {
        imageStripHTML = `
              <div class="flex gap-0.5 h-32 overflow-hidden border-b border-border">
                ${imageAttachments.slice(0, 3).map((att, idx) => `
                  <button data-att-id="${att.id}" data-note-id="${n.id}" class="note-view-attachment flex-1 overflow-hidden relative hover:opacity-90 active:scale-95 transition-all">
                    <img src="${att.dataUrl}" alt="" class="w-full h-full object-cover" />
                    ${idx === 2 && imageAttachments.length > 3 ? `
                      <div class="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white font-bold text-sm">
                        +${imageAttachments.length - 3}
                      </div>
                    ` : ''}
                  </button>
                `).join('')}
              </div>
            `;
      }

      // Doc attachments listed
      let docsHTML = '';
      if (fileAttachments.length > 0) {
        docsHTML = `
              <div class="mt-3.5 space-y-1.5">
                ${fileAttachments.slice(0, 2).map(att => `
                  <button data-att-id="${att.id}" data-note-id="${n.id}" class="note-view-attachment flex items-center gap-2 w-full p-2 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-colors text-left text-xs font-semibold">
                    <i data-lucide="${getFileIcon(att.type)}" class="w-4 h-4 text-primary shrink-0"></i>
                    <span class="text-foreground truncate flex-1">${att.name}</span>
                    <span class="text-[10px] text-muted-foreground ml-auto shrink-0">${formatSize(att.size)}</span>
                  </button>
                `).join('')}
                ${fileAttachments.length > 2 ? `
                  <p class="text-[10px] text-muted-foreground pl-2 font-bold">+${fileAttachments.length - 2} more files</p>
                ` : ''}
              </div>
            `;
      }

      const formattedDate = new Date(n.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      return `
            <div class="bg-card border border-border border-l-4 ${noteAccents[i % noteAccents.length]} rounded-2xl shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all flex flex-col overflow-hidden group bg-gradient-to-br ${noteGradients[i % noteGradients.length]}">
              ${imageStripHTML}
              
              <div class="p-5 flex flex-col flex-1">
                <h3 class="font-display font-bold text-foreground text-sm sm:text-base mb-2 leading-tight truncate">${n.title}</h3>
                <p class="text-xs text-muted-foreground flex-1 line-clamp-4 whitespace-pre-wrap leading-relaxed font-medium">${n.content}</p>
                
                ${docsHTML}

                <!-- Card footer -->
                <div class="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-muted-foreground font-semibold">${formattedDate}</span>
                    ${noteAttachments.length > 0 ? `
                      <span class="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full font-bold">
                        <i data-lucide="paperclip" class="w-2.5 h-2.5"></i> ${noteAttachments.length}
                      </span>
                    ` : ''}
                  </div>
                  
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button data-id="${n.id}" class="note-edit-btn p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                      <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button data-id="${n.id}" class="note-delete-btn p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  return `
    ${renderNavbar()}
    <div class="container mx-auto px-4 py-8 max-w-5xl">
      <div class="space-y-6 animate-fade-in">
        
        <!-- Header -->
        <div class="relative overflow-hidden rounded-3xl gradient-hero p-8 text-primary-foreground shadow-md">
          <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          <div class="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4"></div>
          <div class="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 class="text-2xl md:text-3xl font-display font-bold mb-2 text-white">📝 My Notes</h1>
              <p class="text-white/80 text-xs sm:text-sm max-w-md leading-relaxed">
                Capture ideas, lecture notes, and study materials. Keep everything organized in one place.
              </p>
              <div class="flex gap-3 mt-4">
                <div class="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs text-white">
                  <i data-lucide="sticky-note" class="w-4 h-4"></i>
                  <span class="font-bold">${state.notes.length}</span>
                  <span class="opacity-75">notes</span>
                </div>
              </div>
            </div>
            <button id="note-add-btn" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all border border-white/20">
              <i data-lucide="plus" class="w-4 h-4"></i> New Note
            </button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="flex gap-3">
          <div class="relative flex-1">
            <i data-lucide="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"></i>
            <input type="text" id="note-search-input" placeholder="Search notes..." value="${state.searchQuery}"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-card transition-shadow" />
          </div>
        </div>

        <!-- Grid layout -->
        ${gridHTML}

        ${formModalHTML}
        ${previewModalHTML}
      </div>
    </div>
  `;
}

function bindNotesEvents() {
  bindNavbarEvents();

  // Search input
  const searchInput = document.getElementById('note-search-input');
  if (searchInput) {
    searchInput.oninput = () => {
      state.searchQuery = searchInput.value;
      // Filter list without forcing complete rebuilding on each key stroke if possible,
      // but re-render is fast enough in small scales.
      clearTimeout(window.searchTimeout);
      window.searchTimeout = setTimeout(() => {
        renderCurrentView();
      }, 200);
    };
  }

  // Modals visibility toggles
  const addBtn = document.getElementById('note-add-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      state.noteEditId = null;
      state.noteFormAttachments = [];
      state.showNoteForm = true;
      renderCurrentView();
    };
  }

  const emptyBtn = document.getElementById('note-empty-btn');
  if (emptyBtn) {
    emptyBtn.onclick = () => {
      state.noteEditId = null;
      state.noteFormAttachments = [];
      state.showNoteForm = true;
      renderCurrentView();
    };
  }

  const closeBtn = document.getElementById('note-modal-close');
  const modal = document.getElementById('note-modal');
  if (closeBtn) {
    closeBtn.onclick = () => {
      state.showNoteForm = false;
      state.noteEditId = null;
      renderCurrentView();
    };
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        state.showNoteForm = false;
        state.noteEditId = null;
        renderCurrentView();
      }
    };
  }

  // Selected file triggers
  const fileInput = document.getElementById('note-file-input');
  const attachTrigger = document.getElementById('note-attach-trigger');
  if (fileInput && attachTrigger) {
    attachTrigger.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const files = e.target.files;
      if (!files) return;

      Array.from(files).forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
          showToast(`File "${file.name}" exceeds 5MB size limit`, 'warning');
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          state.noteFormAttachments.push({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: reader.result,
          });
          renderCurrentView();
        };
        reader.readAsDataURL(file);
      });
      fileInput.value = ''; // Reset input element
    };
  }

  // Remove attachment in form
  document.querySelectorAll('.note-remove-attachment').forEach(btn => {
    btn.onclick = () => {
      const attId = btn.getAttribute('data-id');
      state.noteFormAttachments = state.noteFormAttachments.filter(a => a.id !== attId);
      renderCurrentView();
    };
  });

  // Edit note trigger
  document.querySelectorAll('.note-edit-btn').forEach(btn => {
    btn.onclick = () => {
      const noteId = btn.getAttribute('data-id');
      const noteObj = state.notes.find(x => x.id === noteId);
      if (!noteObj) return;

      state.noteEditId = noteId;
      state.noteFormAttachments = [...(noteObj.attachments || [])];
      state.showNoteForm = false;
      renderCurrentView();
    };
  });

  // Submit Note Form (add/update)
  const submitForm = document.getElementById('note-submit-form');
  if (submitForm) {
    submitForm.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('note-title').value.trim();
      const content = document.getElementById('note-content').value.trim();

      if (!title || !content) return;
      const payload = { title, content, attachments: state.noteFormAttachments };

      if (state.noteEditId) {
        // UPDATE
        const noteId = state.noteEditId;
        if (isOfflineMode()) {
          state.notes = state.notes.map(n => n.id === noteId ? { ...n, title, content, attachments: state.noteFormAttachments, updatedAt: new Date().toISOString() } : n);
          saveLocalData('notes', state.notes);
          state.noteEditId = null;
          showToast('Note updated (offline)', 'success');
          renderCurrentView();
          return;
        }

        try {
          const res = await apiRequest(`/api/notes/${noteId}`, 'PUT', payload);
          state.notes = state.notes.map(n => n.id === noteId ? res : n);
          state.noteEditId = null;
          showToast('Note updated successfully', 'success');
          renderCurrentView();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else {
        // CREATE
        if (isOfflineMode()) {
          payload.id = Math.random().toString(36).substring(2, 9);
          payload.createdAt = new Date().toISOString();
          payload.updatedAt = new Date().toISOString();
          state.notes.unshift(payload);
          saveLocalData('notes', state.notes);
          state.showNoteForm = false;
          showToast('Note added (offline)', 'success');
          renderCurrentView();
          return;
        }

        try {
          const res = await apiRequest('/api/notes', 'POST', payload);
          state.notes.unshift(res);
          state.showNoteForm = false;
          showToast('Note created successfully', 'success');
          renderCurrentView();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    };
  }

  // Delete note
  document.querySelectorAll('.note-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Are you sure you want to delete this note?')) return;

      if (isOfflineMode()) {
        state.notes = state.notes.filter(n => n.id !== id);
        saveLocalData('notes', state.notes);
        showToast('Note deleted (offline)', 'info');
        renderCurrentView();
        return;
      }

      try {
        await apiRequest(`/api/notes/${id}`, 'DELETE');
        state.notes = state.notes.filter(n => n.id !== id);
        showToast('Note deleted', 'success');
        renderCurrentView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  });

  // Open attachment preview modal
  document.querySelectorAll('.note-view-attachment').forEach(btn => {
    btn.onclick = () => {
      const noteId = btn.getAttribute('data-note-id');
      const attId = btn.getAttribute('data-att-id');
      const noteObj = state.notes.find(x => x.id === noteId);
      if (!noteObj) return;
      const attObj = noteObj.attachments.find(a => a.id === attId);
      if (!attObj) return;

      state.notePreviewAttachment = attObj;
      renderCurrentView();
    };
  });

  // Close attachment preview
  const previewClose = document.getElementById('note-preview-close');
  const previewModal = document.getElementById('note-preview-modal');
  if (previewClose) {
    previewClose.onclick = () => { state.notePreviewAttachment = null; renderCurrentView(); };
  }
  if (previewModal) {
    previewModal.onclick = (e) => {
      if (e.target === previewModal) {
        state.notePreviewAttachment = null;
        renderCurrentView();
      }
    };
  }

  // Download attachment
  const downloadBtn = document.getElementById('note-download-att');
  const downloadBtnInner = document.getElementById('note-download-att-btn');
  const downloadFunc = () => {
    if (!state.notePreviewAttachment) return;
    const link = document.createElement('a');
    link.href = state.notePreviewAttachment.dataUrl;
    link.download = state.notePreviewAttachment.name;
    link.click();
    showToast('Download started', 'info');
  };
  if (downloadBtn) downloadBtn.onclick = downloadFunc;
  if (downloadBtnInner) downloadBtnInner.onclick = downloadFunc;
}

// ─── VIEW 8: PROFILE & POMODORO ───

function viewProfile() {
  const totalMinutes = state.studySessions.reduce((s, x) => s + x.duration, 0);
  const totalHours = Math.round(totalMinutes / 60);
  const completed = state.assignments.filter(a => a.status === 'completed').length;

  const currentName = state.user?.name || 'Student';
  const currentEmail = state.user?.email || 'email@university.edu';
  const currentUniversity = state.user?.university || '';
  const currentPhoto = state.user?.profilePhoto || '';

  const editProfileModalHTML = state.showEditProfile ? `
    <div id="profile-modal" class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div class="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-xl overflow-hidden animate-scale-in">
        
        <!-- Modal banner -->
        <div class="relative gradient-hero p-6 pb-16 text-primary-foreground">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-display font-bold text-white">Edit Profile</h2>
            <button type="button" id="profile-modal-close" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <i data-lucide="x" class="w-4 h-4 text-white"></i>
            </button>
          </div>
        </div>

        <!-- Overlapping Profile photo edit -->
        <div class="flex justify-center -mt-12 relative z-10">
          <div class="relative group cursor-pointer" id="profile-photo-edit-trigger">
            <div class="w-24 h-24 rounded-full border-4 border-card shadow-lg overflow-hidden bg-secondary flex items-center justify-center">
              ${state.editProfilePhotoPreview
      ? `<img src="${state.editProfilePhotoPreview}" alt="" class="w-full h-full object-cover" />`
      : `<i data-lucide="user" class="w-10 h-10 text-muted-foreground"></i>`
    }
              <div class="absolute inset-0 bg-slate-900/40 group-hover:opacity-100 opacity-0 transition-opacity rounded-full flex items-center justify-center">
                <i data-lucide="camera" class="w-6 h-6 text-white"></i>
              </div>
            </div>
            ${state.editProfilePhotoPreview ? `
              <button type="button" id="profile-photo-remove" class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md active:scale-90 hover:bg-rose-600 transition-all">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
            <input type="file" id="profile-photo-input" accept="image/png,image/jpeg,image/webp" class="hidden" />
          </div>
        </div>
        <p class="text-center text-[10px] text-muted-foreground mt-2 font-bold">Click photo to upload</p>

        <!-- Edit Form -->
        <div class="p-6 pt-4 space-y-4">
          <div>
            <label class="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <i data-lucide="user" class="w-3.5 h-3.5"></i> Full Name
            </label>
            <input type="text" id="profile-edit-name" value="${currentName}" placeholder="Your full name"
              class="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold" />
          </div>
          <div>
            <label class="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <i data-lucide="mail" class="w-3.5 h-3.5"></i> Email Address
            </label>
            <input type="email" id="profile-edit-email" value="${currentEmail}" placeholder="you@university.edu"
              class="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold" />
          </div>
          <div>
            <label class="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i> University
            </label>
            <input type="text" id="profile-edit-uni" value="${currentUniversity}" placeholder="Your university (optional)"
              class="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold" />
          </div>
          
          <div class="flex gap-3 pt-2">
            <button type="button" id="profile-edit-cancel" class="flex-1 px-4 py-2.5 rounded-xl border border-border bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors">
              Cancel
            </button>
            <button type="button" id="profile-edit-save" class="flex-1 px-4 py-2.5 rounded-xl gradient-primary text-white text-xs font-semibold shadow-sm hover:shadow-glow transition-shadow inline-flex items-center justify-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Save
            </button>
          </div>
        </div>

      </div>
    </div>
  ` : '';

  return `
    ${renderNavbar()}
    <div class="container mx-auto px-4 py-8 max-w-4xl animate-fade-in">
      <div class="space-y-6">
        
        <!-- Profile Hero banner card -->
        <div class="relative overflow-hidden rounded-3xl shadow-card bg-card border border-border">
          <div class="gradient-hero h-36 relative">
            <div class="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
            <div class="absolute bottom-0 left-10 w-32 h-32 bg-white/5 rounded-full translate-y-1/2"></div>
            <button id="profile-edit-trigger-btn" class="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center text-white transition-all border border-white/25 active:scale-95 shadow-sm">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="px-8 pb-8 pt-0 text-center relative">
            <!-- Avatar overlapping -->
            <div class="w-28 h-28 rounded-full border-4 border-card shadow-lg overflow-hidden mx-auto -mt-14 relative z-10 cursor-pointer active:scale-95 transition-transform" id="profile-photo-view-btn">
              ${currentPhoto
      ? `<img src="${currentPhoto}" alt="${currentName}" class="w-full h-full object-cover" />`
      : `<div class="w-full h-full gradient-primary flex items-center justify-center">
                     <i data-lucide="user" class="w-12 h-12 text-white"></i>
                   </div>`
    }
            </div>

            <h1 class="text-2xl font-display font-bold text-foreground mt-4">${currentName}</h1>
            
            <div class="flex items-center justify-center gap-2 text-muted-foreground mt-2 font-semibold text-xs sm:text-sm">
              <i data-lucide="mail" class="w-4 h-4"></i> <span>${currentEmail}</span>
            </div>
            
            ${currentUniversity ? `
              <div class="flex items-center justify-center gap-2 text-muted-foreground mt-1 font-semibold text-xs sm:text-sm">
                <i data-lucide="graduation-cap" class="w-4 h-4"></i> <span>${currentUniversity}</span>
              </div>
            ` : ''}

            <button id="profile-edit-btn" class="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-xs font-bold shadow-sm hover:shadow-glow transition-all active:scale-95">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Edit Profile
            </button>
          </div>
        </div>

        <!-- Productivity Summary stats -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-card bg-gradient-to-br from-blue-500/10 to-blue-500/[0.01] border border-border rounded-2xl p-6 text-center shadow-card hover:shadow-card-hover transition-shadow">
            <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
              <i data-lucide="book-open" class="w-6 h-6 text-primary"></i>
            </div>
            <p class="text-3xl font-display font-bold text-foreground">${totalHours}h</p>
            <p class="text-xs text-muted-foreground mt-1 font-bold">Study Time</p>
          </div>

          <div class="bg-card bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.01] border border-border rounded-2xl p-6 text-center shadow-card hover:shadow-card-hover transition-shadow">
            <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <i data-lucide="award" class="w-6 h-6 text-emerald-500"></i>
            </div>
            <p class="text-3xl font-display font-bold text-foreground">${completed}</p>
            <p class="text-xs text-muted-foreground mt-1 font-bold">Completed Tasks</p>
          </div>
        </div>

        <!-- Preferences panel -->
        <div class="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div class="px-5 py-3.5 border-b border-border bg-gradient-to-r from-secondary/50 to-transparent">
            <h2 class="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <i data-lucide="sparkles" class="w-4 h-4 text-primary animate-spin" style="animation-duration: 5s;"></i> Preferences
            </h2>
          </div>
          <div class="p-5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center ${state.darkMode ? 'bg-primary/10' : 'bg-amber-500/10'}">
                  <i data-lucide="${state.darkMode ? 'moon' : 'sun'}" class="w-5 h-5 ${state.darkMode ? 'text-primary' : 'text-amber-500'}"></i>
                </div>
                <div>
                  <span class="font-bold text-sm text-foreground block">Dark Mode</span>
                  <span class="text-[10px] text-muted-foreground font-semibold">${state.darkMode ? 'On' : 'Off'} — Switch appearance</span>
                </div>
              </div>
              <button id="profile-theme-toggle" class="relative w-14 h-7 rounded-full transition-colors shadow-inner ${state.darkMode ? 'bg-primary' : 'bg-secondary border border-border'}">
                <div class="absolute top-0.5 w-6 h-6 rounded-full bg-card shadow-md transition-all duration-300 ${state.darkMode ? 'left-[30px]' : 'left-[2px]'}"></div>
              </button>
            </div>
          </div>
        </div>

        <!-- Pomodoro widget core -->
        <div class="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div class="px-5 py-3.5 border-b border-border bg-gradient-to-r from-secondary/50 to-transparent">
            <h2 class="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <i data-lucide="timer" class="w-4 h-4 text-primary"></i> Focus Timer
            </h2>
          </div>
          <div class="p-5">
            <!-- Embedded Pomodoro component markup -->
            <div class="text-center py-4">
              <div class="relative w-48 h-48 mx-auto mb-6">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke-width="6" class="stroke-secondary" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke-width="6" id="pomodoro-circle-indicator" class="stroke-primary" stroke-linecap="round" stroke-dasharray="282.743" stroke-dashoffset="282.743" />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-4xl font-display font-bold text-foreground" id="pomodoro-time-display">25:00</span>
                  <span class="text-sm capitalize font-medium text-primary" id="pomodoro-sub-display">focus</span>
                </div>
              </div>
              
              <div class="flex items-center justify-center gap-3">
                <button type="button" id="pomodoro-toggle-btn" class="px-6 py-2.5 rounded-xl gradient-primary text-white font-medium inline-flex items-center gap-2 shadow-sm hover:shadow-glow transition-shadow">
                  <i data-lucide="play" class="w-4 h-4"></i> Start
                </button>
                <button type="button" id="pomodoro-reset-btn" class="p-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                  <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        ${editProfileModalHTML}
      </div>
    </div>
  `;
}

function bindProfileEvents() {
  bindNavbarEvents();

  // Dark Mode toggle
  const themeToggle = document.getElementById('profile-theme-toggle');
  if (themeToggle) themeToggle.onclick = toggleDarkMode;

  // Edit Profile popup triggers
  const editBtn = document.getElementById('profile-edit-btn');
  const editBtnHero = document.getElementById('profile-edit-trigger-btn');
  const avatarPhotoBtn = document.getElementById('profile-photo-view-btn');
  const closeBtn = document.getElementById('profile-modal-close');
  const modal = document.getElementById('profile-modal');

  const openEditModal = () => {
    state.editProfilePhoto = state.user?.profilePhoto || '';
    state.editProfilePhotoPreview = state.user?.profilePhoto || '';
    state.showEditProfile = true;
    renderCurrentView();
  };

  if (editBtn) editBtn.onclick = openEditModal;
  if (editBtnHero) editBtnHero.onclick = openEditModal;
  if (avatarPhotoBtn) avatarPhotoBtn.onclick = openEditModal;

  if (closeBtn) closeBtn.onclick = () => { state.showEditProfile = false; renderCurrentView(); };
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        state.showEditProfile = false;
        renderCurrentView();
      }
    };
  }

  // Cancel edit button inside dialog
  const cancelBtn = document.getElementById('profile-edit-cancel');
  if (cancelBtn) cancelBtn.onclick = () => { state.showEditProfile = false; renderCurrentView(); };

  // Trigger file upload in modal photo circle
  const photoTrigger = document.getElementById('profile-photo-edit-trigger');
  const fileInput = document.getElementById('profile-photo-input');
  if (photoTrigger && fileInput) {
    photoTrigger.onclick = (e) => {
      // If click was on the remove photo button, don't trigger upload input
      if (e.target.closest('#profile-photo-remove')) return;
      fileInput.click();
    };

    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be under 5MB', 'warning');
        return;
      }

      try {
        const compressed = await compressImage(file, 200);
        state.editProfilePhoto = compressed;
        state.editProfilePhotoPreview = compressed;
        renderCurrentView();
      } catch (err) {
        showToast('Could not process photo', 'error');
      }
    };
  }

  // Remove photo button inside editor modal
  const removePhotoBtn = document.getElementById('profile-photo-remove');
  if (removePhotoBtn) {
    removePhotoBtn.onclick = () => {
      state.editProfilePhoto = '';
      state.editProfilePhotoPreview = '';
      if (fileInput) fileInput.value = '';
      renderCurrentView();
    };
  }

  // Save profile updates
  const saveBtn = document.getElementById('profile-edit-save');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const name = document.getElementById('profile-edit-name').value.trim();
      const email = document.getElementById('profile-edit-email').value.trim();
      const university = document.getElementById('profile-edit-uni').value.trim();

      if (!name || !email) {
        showToast('Name and Email are required', 'warning');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = 'Saving...';

      const payload = {
        name,
        email,
        university,
        profilePhoto: state.editProfilePhoto,
      };

      if (isOfflineMode()) {
        state.user = { ...state.user, ...payload };
        localStorage.setItem('sf_user', JSON.stringify(state.user));
        state.showEditProfile = false;
        showToast('Profile updated (offline)', 'success');
        renderCurrentView();
        return;
      }

      try {
        const updated = await apiRequest('/api/auth/profile', 'PUT', payload);
        state.user = { ...state.user, ...updated };
        localStorage.setItem('sf_user', JSON.stringify(state.user));
        state.showEditProfile = false;
        showToast('Profile updated successfully', 'success');
        renderCurrentView();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Save';
        showToast(err.message, 'error');
      }
    };
  }

  // Focus Timer actions
  const timerToggle = document.getElementById('pomodoro-toggle-btn');
  const timerReset = document.getElementById('pomodoro-reset-btn');

  if (timerToggle) {
    timerToggle.onclick = () => {
      state.pomodoro.isRunning = !state.pomodoro.isRunning;
      updateProfileTimer();
      updateNavbarTimer();
    };
  }
  if (timerReset) {
    timerReset.onclick = () => {
      state.pomodoro.isRunning = false;
      state.pomodoro.mode = 'focus';
      state.pomodoro.minutes = 25;
      state.pomodoro.seconds = 0;
      updateProfileTimer();
      updateNavbarTimer();
    };
  }

  // Draw initial state of SVGs & button text
  updateProfileTimer();
}

// ─── ROUTER & VIEW CONTROLLER ───

function router() {
  const hash = window.location.hash || '#/';

  // Update state view property
  state.currentView = hash;

  const root = document.getElementById('root');
  if (!root) return;

  // Dynamic route guards
  const isAuthRoute = hash !== '#/' && hash !== '#/login' && hash !== '#/register';

  if (isAuthRoute && !state.token) {
    // If not authenticated, force redirect to Login view
    window.location.hash = '#/login';
    return;
  }

  if (!isAuthRoute && state.token && hash !== '#/') {
    // If authenticated, do not allow returning to login/register routes directly
    window.location.hash = '#/dashboard';
    return;
  }

  // Load view markup templates
  if (hash === '#/' || hash === '') {
    root.innerHTML = viewHome();
    bindNavbarEvents(); // Simple home links/buttons
  } else if (hash === '#/login') {
    root.innerHTML = viewLogin();
    bindLoginEvents();
  } else if (hash === '#/register') {
    root.innerHTML = viewRegister();
    bindRegisterEvents();
  } else if (hash.startsWith('#/dashboard')) {
    root.innerHTML = viewDashboard();
    bindDashboardEvents();
  } else if (hash.startsWith('#/assignments')) {
    root.innerHTML = viewAssignments();
    bindAssignmentsEvents();
  } else if (hash.startsWith('#/timetable')) {
    root.innerHTML = viewTimetable();
    bindTimetableEvents();
  } else if (hash.startsWith('#/notes')) {
    root.innerHTML = viewNotes();
    bindNotesEvents();
  } else if (hash.startsWith('#/profile')) {
    root.innerHTML = viewProfile();
    bindProfileEvents();
  } else {
    // 404 View
    root.innerHTML = `
      ${state.token ? renderNavbar() : ''}
      <div class="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <h1 class="text-6xl font-display font-extrabold text-primary mb-4">404</h1>
        <h2 class="text-xl font-bold text-foreground mb-2">Oops! Page not found</h2>
        <p class="text-sm text-muted-foreground mb-6 max-w-sm">The URL link you requested does not exist or may have been moved.</p>
        <a href="#/dashboard" class="px-6 py-2.5 rounded-xl gradient-primary text-white font-semibold text-xs shadow-sm hover:shadow-glow transition-shadow">
          Back to Home
        </a>
      </div>
    `;
    if (state.token) bindNavbarEvents();
  }

  // Parse new Lucide Icons
  lucide.createIcons();

  // Set window view scrolling to top
  window.scrollTo(0, 0);
}

// Re-render only current view
function renderCurrentView() {
  router();
}

// ─── INITIALIZATION BOOTSTRAP ───

async function init() {
  // Setup theme
  initDarkMode();

  // Retrieve quotes
  updateQuote();

  // Bootstrap global Pomodoro interval
  startPomodoroTimer();

  // Synchronize DB
  if (state.token) {
    await fetchAllData();
  }

  // Initialize routes listener
  window.addEventListener('hashchange', router);

  // Run first routing path
  router();
}

// Run app init
window.addEventListener('DOMContentLoaded', init);
