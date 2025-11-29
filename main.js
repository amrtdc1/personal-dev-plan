// main.js (module)

// --- 1. Firebase imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  deleteDoc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- 2. Firebase config ---
// 🔴 IMPORTANT: replace with your actual config
const firebaseConfig = {
  apiKey: "AIzaSyAVOhe1Do31skPNXiiWNhuezfabdhOtEfM",
  authDomain: "personal-dev-plan.firebaseapp.com",
  projectId: "personal-dev-plan",
  storageBucket: "personal-dev-plan.firebasestorage.app",
  messagingSenderId: "521939462158",
  appId: "1:521939462158:web:838eaac76c64623d3cb45f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- In-memory data ---

const goals = {
  professional: [],
  personal: []
};

let subgoalsByGoal = {};
let tasksBySubgoal = {};

let currentUserUid = null;

// Goal modal state
let goalModalMode = "add";
let goalBeingEdited = null;

// Sub-goal modal state
let subgoalModalMode = "add";
let subgoalBeingEdited = null;
let subgoalParentGoalId = null;
let subgoalParentGoalTitle = "";

// Task modal state
let taskModalMode = "add";
let taskBeingEdited = null;
let taskParentSubgoalId = null;
let taskParentSubgoalTitle = "";
let taskParentGoalTitle = "";

// Calendar state
let calendarCursor = new Date();

// --- Default goals (seed) ---

const defaultGoalsSeed = {
  professional: [
    {
      title: "Mentorship with Current IT VP",
      description:
        "Schedule regular 1:1 sessions and shadow key projects to learn the role and decision-making approach.",
      timeframe: "Weekly / Monthly check-ins",
      status: "not_started"
    },
    {
      title: "Align IT Strategy with Company Goals",
      description:
        "Develop and communicate IT strategies that support company growth, efficiency, and operational improvement.",
      timeframe: "Next 6–12 months",
      status: "not_started"
    },
    {
      title: "Develop IT Team Relationships & Growth Plans",
      description:
        "Build stronger relationships with IT staff and help them define growth paths that align with company objectives.",
      timeframe: "Ongoing",
      status: "not_started"
    }
  ],
  personal: [
    {
      title: "Increase Quality Time with Family",
      description:
        "Protect evenings and weekends for time with my wife and kids, focusing on presence over work.",
      timeframe: "Weekly rhythm",
      status: "not_started"
    },
    {
      title: "Support Kids' Educational & Spiritual Growth",
      description:
        "Be an active steward of their schooling and spiritual life through conversations, support, and example.",
      timeframe: "Ongoing",
      status: "not_started"
    },
    {
      title: "Complete NMC University Course",
      description:
        "Enroll in and work through the NMC University Bible course to deepen my own spiritual foundation.",
      timeframe: "This year",
      status: "not_started"
    },
    {
      title: "Maintain Weekly Exercise Routine",
      description:
        "Carve out consistent time each week for physical activity to support long-term health and energy.",
      timeframe: "3–4x per week",
      status: "not_started"
    },
    {
      title: "Coach Kids' Sports",
      description:
        "Dedicate time to coaching my kids’ sports teams as a way to invest in their growth and our relationship.",
      timeframe: "Seasonal",
      status: "not_started"
    }
  ]
};

// --- Theme helpers ---

function setTheme(theme) {
  const body = document.body;
  if (!body) return;

  body.dataset.theme = theme;
  localStorage.setItem("pdp-theme", theme);

  const iconContainer = document.getElementById("themeIconContainer");

  if (theme === "light") {
    // Emoji fallback: 🌞
    iconContainer.innerHTML = `
      <svg id="themeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>`;
  }
  else if (theme === "dark") {
    // Emoji fallback: 🌙
    iconContainer.innerHTML = `
      <svg id="themeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>`;
  }
  else if (theme === "cwm") {
    iconContainer.innerHTML = `
      <img src="assets/cwm-logo-icon.ico" 
           alt="CWM Theme"
           id="themeIcon"
           class="cwm-theme-icon">
    `;
  }

}

function initTheme() {
  const saved = localStorage.getItem("pdp-theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  let initial = prefersDark ? "dark" : "light";

  if (saved === "light" || saved === "dark" || saved === "cwm") {
    initial = saved;
  }

  setTheme(initial);
}

function setupThemeToggle() {
  const btn = document.getElementById("btnThemeToggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const current = document.body.dataset.theme || "light";

    let next;
    if (current === "light") {
      next = "dark";
    } else if (current === "dark") {
      next = "cwm";
    } else {
      // current === "cwm" or anything else
      next = "light";
    }

    setTheme(next);
    
    // Re-render calendar with new theme colors
    if (currentUserUid) {
      renderCalendar();
    }
  });
}

// --- Palette system ---

const palettes = {
  ocean: {
    accent: "#2563eb",
    accentAlt: "#22c55e",
    accentSoft: "rgba(37, 99, 235, 0.12)",
    accentStrong: "rgba(37, 99, 235, 0.3)",
    accentAltSoft: "rgba(34, 197, 94, 0.12)",
    accentAltStrong: "rgba(34, 197, 94, 0.3)"
  },
  sunset: {
    accent: "#f97316",
    accentAlt: "#ec4899",
    accentSoft: "rgba(249, 115, 22, 0.12)",
    accentStrong: "rgba(249, 115, 22, 0.3)",
    accentAltSoft: "rgba(236, 72, 153, 0.12)",
    accentAltStrong: "rgba(236, 72, 153, 0.3)"
  },
  forest: {
    accent: "#16a34a",
    accentAlt: "#facc15",
    accentSoft: "rgba(22, 163, 74, 0.12)",
    accentStrong: "rgba(22, 163, 74, 0.3)",
    accentAltSoft: "rgba(250, 204, 21, 0.16)",
    accentAltStrong: "rgba(250, 204, 21, 0.32)"
  },
  royal: {
    accent: "#4f46e5",
    accentAlt: "#a855f7",
    accentSoft: "rgba(79, 70, 229, 0.12)",
    accentStrong: "rgba(79, 70, 229, 0.3)",
    accentAltSoft: "rgba(168, 85, 247, 0.12)",
    accentAltStrong: "rgba(168, 85, 247, 0.3)"
  },
  candy: {
    accent: "#ec4899",
    accentAlt: "#22d3ee",
    accentSoft: "rgba(236, 72, 153, 0.12)",
    accentStrong: "rgba(236, 72, 153, 0.3)",
    accentAltSoft: "rgba(34, 211, 238, 0.16)",
    accentAltStrong: "rgba(34, 211, 238, 0.32)"
  },
  dusk: {
    accent: "#6366f1",
    accentAlt: "#f97316",
    accentSoft: "rgba(99, 102, 241, 0.12)",
    accentStrong: "rgba(99, 102, 241, 0.3)",
    accentAltSoft: "rgba(249, 115, 22, 0.12)",
    accentAltStrong: "rgba(249, 115, 22, 0.3)"
  },
  lava: {
    accent: "#ef4444",
    accentAlt: "#f97316",
    accentSoft: "rgba(239, 68, 68, 0.12)",
    accentStrong: "rgba(239, 68, 68, 0.3)",
    accentAltSoft: "rgba(249, 115, 22, 0.12)",
    accentAltStrong: "rgba(249, 115, 22, 0.3)"
  },
  mint: {
    accent: "#22c55e",
    accentAlt: "#22d3ee",
    accentSoft: "rgba(34, 197, 94, 0.12)",
    accentStrong: "rgba(34, 197, 94, 0.3)",
    accentAltSoft: "rgba(34, 211, 238, 0.16)",
    accentAltStrong: "rgba(34, 211, 238, 0.32)"
  }
};

function applyPalette(name) {
  const palette = palettes[name];
  if (!palette) return;

  const root = document.documentElement;

  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--accent-alt", palette.accentAlt);
  root.style.setProperty("--accent-soft", palette.accentSoft);
  root.style.setProperty("--accent-strong", palette.accentStrong);
  root.style.setProperty("--accent-alt-soft", palette.accentAltSoft);
  root.style.setProperty("--accent-alt-strong", palette.accentAltStrong);

  localStorage.setItem("pdp-palette", name);
}

function initPalette() {
  const saved = localStorage.getItem("pdp-palette");
  const defaultName = saved && palettes[saved] ? saved : "ocean";
  applyPalette(defaultName);
}

function setupPaletteUI() {
  const btnToggle = document.getElementById("btnPaletteToggle");
  const popover = document.getElementById("palettePopover");
  const swatches = document.querySelectorAll(".palette-swatch");

  if (!btnToggle || !popover) return;

  const saved = localStorage.getItem("pdp-palette");
  const currentPaletteName = saved && palettes[saved] ? saved : "ocean";

  swatches.forEach(swatch => {
    const name = swatch.dataset.palette;
    const p = palettes[name];
    if (p) {
      swatch.style.background = `linear-gradient(135deg, ${p.accent}, ${p.accentAlt})`;
    }
    if (name === currentPaletteName) {
      swatch.classList.add("active");
    } else {
      swatch.classList.remove("active");
    }
  });

  btnToggle.addEventListener("click", e => {
    e.stopPropagation();
    popover.classList.toggle("hidden");
  });

  swatches.forEach(swatch => {
    swatch.addEventListener("click", e => {
      e.stopPropagation();
      const name = swatch.dataset.palette;

      swatches.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");

      applyPalette(name);
      popover.classList.add("hidden");
      
      // Re-render calendar with new palette colors
      if (currentUserUid) {
        renderCalendar();
      }
    });
  });

  document.addEventListener("click", () => {
    popover.classList.add("hidden");
  });

  popover.addEventListener("click", e => {
    e.stopPropagation();
  });
}

// --- Status helpers ---

function statusToPercent(status) {
  switch (status) {
    case "done":
      return 100;
    case "in_progress":
      return 50;
    case "not_started":
    default:
      return 0;
  }
}

function statusClassForCard(status) {
  if (status === "in_progress") return "status-in_progress";
  if (status === "done") return "status-done";
  return "status-not_started";
}

// --- Date utility functions ---

function ymd(str) {
  if (!str) return null;
  const d = new Date(str + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfCalendarGrid(date) {
  const start = startOfMonth(date);
  const day = start.getDay();
  const result = new Date(start);
  result.setDate(result.getDate() - day);
  return result;
}

function endOfCalendarGrid(date) {
  const end = endOfMonth(date);
  const day = end.getDay();
  const result = new Date(end);
  result.setDate(result.getDate() + (6 - day));
  return result;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function clampRangeToMonth(rangeStart, rangeEnd, monthStart, monthEnd) {
  const start = rangeStart < monthStart ? monthStart : rangeStart;
  const end = rangeEnd > monthEnd ? monthEnd : rangeEnd;
  return { start, end };
}

function rangeOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && aEnd >= bStart;
}

function formatMonthYear(date) {
  const months = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function daysUntil(targetDate) {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function formatDate(dateStr) {
  if (!dateStr) return "Not set";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Progress roll-up helpers (UI-only, not persisted) ---

function getTaskPercent(task) {
  return statusToPercent(task.status || "not_started");
}

function computeSubgoalPercent(subgoal) {
  const tasksAll = tasksBySubgoal[subgoal.id] || [];
  const tasks = tasksAll.filter(t => !t.archived);
  if (!tasks.length) {
    // No tasks -> sub-goal progress is based on its own status
    return statusToPercent(subgoal.status || "not_started");
  }

  let total = 0;
  tasks.forEach(t => {
    total += getTaskPercent(t);
  });
  return Math.round(total / tasks.length);
}

function computeGoalPercent(goal) {
  const subsAll = subgoalsByGoal[goal.id] || [];
  const subs = subsAll.filter(sg => !sg.archived);
  if (!subs.length) {
    // No sub-goals -> goal progress based on its own status
    return statusToPercent(goal.status || "not_started");
  }

  let total = 0;
  subs.forEach(sg => {
    total += computeSubgoalPercent(sg);
  });
  return Math.round(total / subs.length);
}

function buildCalendarEvents() {
  const events = [];
  
  // Get current theme from body
  const currentTheme = document.body.dataset.theme || 'light';
  
  // Define theme-specific colors
  let accentColor, accentAltColor;
  if (currentTheme === 'cwm') {
    // CWM theme uses fixed brand colors
    accentColor = '#ffd400';  // CWM yellow
    accentAltColor = '#1e4741'; // CWM green
  } else {
    // Light and Dark themes use palette colors from CSS variables
    const root = document.documentElement;
    accentColor = getComputedStyle(root).getPropertyValue('--accent').trim();
    accentAltColor = getComputedStyle(root).getPropertyValue('--accent-alt').trim();
    
    // Fallback if CSS variables aren't loaded
    if (!accentColor) accentColor = '#2563eb';
    if (!accentAltColor) accentAltColor = '#22c55e';
  }
  
  // Goals as timeline bars
  const allGoals = [...goals.professional, ...goals.personal];
  allGoals.forEach(goal => {
    const startDate = ymd(goal.projectedStartDate);
    const endDate = ymd(goal.projectedEndDate);
    if (startDate && endDate) {
      console.log(`Goal "${goal.title}" using theme color:`, accentColor, `(theme: ${currentTheme})`);
      events.push({
        type: "goal",
        id: goal.id,
        title: goal.title,
        startDate,
        endDate,
        color: accentColor,
        data: goal
      });
    }
  });
  
  // Sub-goals as bars
  Object.values(subgoalsByGoal).forEach(subgoals => {
    subgoals.forEach(sg => {
      const startDate = ymd(sg.projectedStartDate);
      const endDate = ymd(sg.projectedEndDate);
      if (startDate && endDate) {
        console.log(`Sub-goal "${sg.title}" using theme color:`, accentAltColor, `(theme: ${currentTheme})`);
        events.push({
          type: "subgoal",
          id: sg.id,
          title: sg.title,
          startDate,
          endDate,
          color: accentAltColor,
          goalId: sg.goalId,
          data: sg
        });
      }
    });
  });
  
  // Tasks as points
  Object.values(tasksBySubgoal).forEach(tasks => {
    tasks.forEach(task => {
      const dueDate = ymd(task.dueDate);
      if (dueDate) {
        events.push({
          type: "task",
          id: task.id,
          title: task.title,
          dueDate,
          color: accentColor,
          subgoalId: task.subgoalId,
          goalId: Object.values(subgoalsByGoal).flat().find(sg => sg.id === task.subgoalId)?.goalId,
          data: task
        });
      }
    });
  });
  
  return events;
}

//Drag-and-drop helpers

function getDragAfterElement(container, y, itemSelector) {
  const draggableElements = [
    ...container.querySelectorAll(`${itemSelector}:not(.dragging)`)
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

// --- Firestore helpers ---

async function seedDefaultGoalsForUser(uid) {
  const goalsCol = collection(db, "goals");
  const now = serverTimestamp();

  const writes = [];

  defaultGoalsSeed.professional.forEach((g, index) => {
    writes.push(
      addDoc(goalsCol, {
        ownerUid: uid,
        type: "professional",
        title: g.title,
        description: g.description,
        timeframe: g.timeframe,
        createdAt: now,
        archived: false,
        projectedStartDate: null,
        projectedEndDate: null,
        actualStartDate: null,
        actualEndDate: null,
        status: g.status,
        percentComplete: statusToPercent(g.status),
        isFocus: false,
        themeColor: "#2563eb",
        orderIndex: index
      })
    );
  });

  defaultGoalsSeed.personal.forEach((g, index) => {
    writes.push(
      addDoc(goalsCol, {
        ownerUid: uid,
        type: "personal",
        title: g.title,
        description: g.description,
        timeframe: g.timeframe,
        createdAt: now,
        archived: false,
        projectedStartDate: null,
        projectedEndDate: null,
        actualStartDate: null,
        actualEndDate: null,
        status: g.status,
        percentComplete: statusToPercent(g.status),
        isFocus: false,
        themeColor: "#ec4899",
        orderIndex: index
      })
    );
  });

  await Promise.all(writes);
}

async function loadSubgoalsForUser(uid) {
  const subCol = collection(db, "subgoals");
  const qSub = query(
    subCol,
    where("ownerUid", "==", uid)
  );

  const snap = await getDocs(qSub);
  const map = {};

  snap.forEach(d => {
    const data = d.data();
    const id = d.id;
    const goalId = data.goalId;
    if (!goalId) return;

    const sub = { id, ...data };
    if (!map[goalId]) {
      map[goalId] = [];
    }
    map[goalId].push(sub);
  });

  Object.keys(map).forEach(goalId => {
    const arr = map[goalId];
    arr.forEach((sg, index) => {
      if (sg.orderIndex == null) sg.orderIndex = index;
    });
    arr.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  });

  subgoalsByGoal = map;
}

async function loadTasksForUser(uid) {
  const tasksCol = collection(db, "tasks");
  const qTasks = query(
    tasksCol,
    where("ownerUid", "==", uid)
  );

  const snap = await getDocs(qTasks);
  const map = {};

  snap.forEach(d => {
    const data = d.data();
    const id = d.id;
    const subgoalId = data.subgoalId;
    if (!subgoalId) return;

    const task = { id, ...data };
    if (!map[subgoalId]) {
      map[subgoalId] = [];
    }
    map[subgoalId].push(task);
  });

  Object.keys(map).forEach(subgoalId => {
    const arr = map[subgoalId];
    arr.forEach((t, index) => {
      if (t.orderIndex == null) t.orderIndex = index;
    });
    arr.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  });

  tasksBySubgoal = map;
}

async function loadGoalsForUser(uid) {
  const goalsCol = collection(db, "goals");

  const profQuery = query(
    goalsCol,
    where("ownerUid", "==", uid),
    where("type", "==", "professional")
  );

  const persQuery = query(
    goalsCol,
    where("ownerUid", "==", uid),
    where("type", "==", "personal")
  );

  const [profSnap, persSnap] = await Promise.all([
    getDocs(profQuery),
    getDocs(persQuery)
  ]);

  let professionalGoals = profSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  let personalGoals = persSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  professionalGoals.forEach((g, index) => {
    if (g.orderIndex == null) g.orderIndex = index;
  });
  professionalGoals.sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  );

  personalGoals.forEach((g, index) => {
    if (g.orderIndex == null) g.orderIndex = index;
  });
  personalGoals.sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  );

  if (professionalGoals.length === 0 && personalGoals.length === 0) {
    await seedDefaultGoalsForUser(uid);

    const [profSnap2, persSnap2] = await Promise.all([
      getDocs(profQuery),
      getDocs(persQuery)
    ]);

    professionalGoals = profSnap2.docs.map(d => ({ id: d.id, ...d.data() }));
    personalGoals = persSnap2.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  goals.professional = professionalGoals;
  goals.personal = personalGoals;

  await loadSubgoalsForUser(uid);
  await loadTasksForUser(uid);

  renderGoals();
  updateStats();
  renderCalendar();
}

async function saveGoalStatus(uid, section, goalId, newStatus) {
  const list = goals[section];
  const idx = list.findIndex(g => g.id === goalId);
  if (idx === -1) return;

  const newPercent = statusToPercent(newStatus);
  list[idx].status = newStatus;
  list[idx].percentComplete = newPercent;

  const ref = doc(db, "goals", goalId);

  await updateDoc(ref, {
    status: newStatus,
    percentComplete: newPercent,
    updatedAt: serverTimestamp()
  });

  updateStats();
}

async function saveSubgoalStatus(subgoalId, newStatus) {
  // Update local cache
  const parentGoalEntry = Object.entries(subgoalsByGoal).find(([, list]) => list.some(s => s.id === subgoalId));
  if (parentGoalEntry) {
    const list = parentGoalEntry[1];
    const idx = list.findIndex(s => s.id === subgoalId);
    if (idx !== -1) list[idx].status = newStatus;
  }
  // Persist to Firestore (flat collection model)
  const ref = doc(db, "subgoals", subgoalId);
  await updateDoc(ref, { status: newStatus, updatedAt: serverTimestamp() });
}

async function saveTaskStatus(taskId, newStatus, subgoalId) {
  // Update local cache
  const list = tasksBySubgoal[subgoalId] || [];
  const idx = list.findIndex(t => t.id === taskId);
  if (idx !== -1) list[idx].status = newStatus;
  // Persist to Firestore (flat collection model)
  const ref = doc(db, "tasks", taskId);
  await updateDoc(ref, { status: newStatus, updatedAt: serverTimestamp() });
}

async function saveSubgoalDoc(mode, payload) {
  const subCol = collection(db, "subgoals");

  if (mode === "edit" && payload.id) {
    const { id, ...rest } = payload;
    const ref = doc(db, "subgoals", id);
    await updateDoc(ref, { ...rest, updatedAt: serverTimestamp() });
    return id;
  } else {
    const { id, ...rest } = payload;
    const ref = await addDoc(subCol, rest);
    return ref.id;
  }
}

async function saveTaskDoc(mode, payload) {
  const tasksCol = collection(db, "tasks");

  if (mode === "edit" && payload.id) {
    const { id, ...rest } = payload;
    const ref = doc(db, "tasks", id);
    await updateDoc(ref, { ...rest, updatedAt: serverTimestamp() });
    return id;
  } else {
    const { id, ...rest } = payload;
    const ref = await addDoc(tasksCol, rest);
    return ref.id;
  }
}

// --- Goal modal ---

function openGoalModal(mode = "add", goal = null) {
  const backdrop = document.getElementById("goalModalBackdrop");
  const titleEl = document.getElementById("goalModalTitle");
  const form = document.getElementById("goalForm");
  const submitBtn = form?.querySelector(".primary-btn");

  if (!backdrop || !form || !titleEl || !submitBtn) return;

  goalModalMode = mode;
  goalBeingEdited = goal;

  backdrop.classList.remove("hidden");

  form.reset();

  const typeInputs = form.querySelectorAll('input[name="goalType"]');
  const titleInput = document.getElementById("goalTitle");
  const descInput = document.getElementById("goalDescription");
  const startInput = document.getElementById("goalStartDate");
  const endInput = document.getElementById("goalEndDate");
  const timeframeInput = document.getElementById("goalTimeframeLabel");
  const focusCheckbox = document.getElementById("goalIsFocus");

  if (mode === "add" || !goal) {
    titleEl.textContent = "Add new goal";
    submitBtn.textContent = "Save goal";

    typeInputs.forEach(input => {
      input.checked = input.value === "professional";
    });

    if (titleInput) titleInput.value = "";
    if (descInput) descInput.value = "";
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    if (timeframeInput) timeframeInput.value = "";
    if (focusCheckbox) focusCheckbox.checked = false;
  } else {
    titleEl.textContent = "Edit goal";
    submitBtn.textContent = "Save changes";

    typeInputs.forEach(input => {
      input.checked = input.value === (goal.type || "professional");
    });

    if (titleInput) titleInput.value = goal.title || "";
    if (descInput) descInput.value = goal.description || "";
    if (startInput) startInput.value = goal.projectedStartDate || "";
    if (endInput) endInput.value = goal.projectedEndDate || "";
    if (timeframeInput) timeframeInput.value = goal.timeframe || "";
    if (focusCheckbox) focusCheckbox.checked = !!goal.isFocus;
  }
}

function closeGoalModal() {
  const backdrop = document.getElementById("goalModalBackdrop");
  const form = document.getElementById("goalForm");
  const titleEl = document.getElementById("goalModalTitle");
  const submitBtn = form?.querySelector(".primary-btn");

  if (!backdrop || !form || !titleEl || !submitBtn) return;

  backdrop.classList.add("hidden");
  form.reset();

  goalModalMode = "add";
  goalBeingEdited = null;
  titleEl.textContent = "Add new goal";
  submitBtn.textContent = "Save goal";
}

function setupGoalModalUI() {
  const btnAddGoal = document.getElementById("btnAddGoal");
  const btnClose = document.getElementById("btnCloseGoalModal");
  const btnCancel = document.getElementById("btnCancelGoal");
  const backdrop = document.getElementById("goalModalBackdrop");
  const form = document.getElementById("goalForm");

  if (btnAddGoal) {
    btnAddGoal.addEventListener("click", () => {
      if (!auth.currentUser) {
        alert("Please sign in to add a goal.");
        return;
      }
      openGoalModal("add", null);
    });
  }

  if (btnClose) btnClose.addEventListener("click", closeGoalModal);
  if (btnCancel) btnCancel.addEventListener("click", closeGoalModal);

  if (backdrop) {
    backdrop.addEventListener("click", e => {
      if (e.target === backdrop) {
        closeGoalModal();
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (!auth.currentUser) {
        alert("Please sign in to save a goal.");
        return;
      }

      const formData = new FormData(form);
      const type = formData.get("goalType") || "professional";
      const title = (formData.get("goalTitle") || "").toString().trim();
      const description = (formData.get("goalDescription") || "").toString().trim();
      const projectedStartDate = formData.get("goalStartDate") || null;
      const projectedEndDate = formData.get("goalEndDate") || null;
      const timeframeLabelRaw =
        (formData.get("goalTimeframeLabel") || "").toString().trim();
      const isFocus = formData.get("goalIsFocus") === "on";

      if (!title) {
        alert("Please enter a goal title.");
        return;
      }

      if (projectedStartDate && projectedEndDate) {
        if (projectedStartDate > projectedEndDate) {
          alert("Projected end date must be on or after the start date.");
          return;
        }
      }

      let timeframe;
      if (timeframeLabelRaw) {
        timeframe = timeframeLabelRaw;
      } else if (projectedStartDate && projectedEndDate) {
        timeframe = `${projectedStartDate} → ${projectedEndDate}`;
      } else {
        timeframe = "Ongoing";
      }

      const themeColor = type === "professional" ? "#2563eb" : "#ec4899";

      try {
        if (goalModalMode === "edit" && goalBeingEdited) {
          const ref = doc(db, "goals", goalBeingEdited.id);

          await updateDoc(ref, {
            type,
            title,
            description,
            timeframe,
            projectedStartDate: projectedStartDate || null,
            projectedEndDate: projectedEndDate || null,
            isFocus,
            themeColor,
            updatedAt: serverTimestamp()
          });

          closeGoalModal();
          await loadGoalsForUser(auth.currentUser.uid);
        } else {
          const goalsCol = collection(db, "goals");
          const now = serverTimestamp();

          const currentList = goals[type] || [];
          const nextOrderIndex = currentList.length;

          await addDoc(goalsCol, {
            ownerUid: auth.currentUser.uid,
            type,
            title,
            description,
            timeframe,
            createdAt: now,
            archived: false,
            projectedStartDate: projectedStartDate || null,
            projectedEndDate: projectedEndDate || null,
            actualStartDate: null,
            actualEndDate: null,
            status: "not_started",
            percentComplete: 0,
            isFocus,
            themeColor,
            orderIndex: nextOrderIndex,
            updatedAt: now
          });


          closeGoalModal();
          await loadGoalsForUser(auth.currentUser.uid);
        }
      } catch (err) {
        console.error("Error saving goal:", err);
        alert("Unable to save the goal. Check console for details.");
      }
    });
  }
}

// --- Sub-goal modal ---

function openSubgoalModal(mode = "add", options = {}) {
  const backdrop = document.getElementById("subgoalModalBackdrop");
  const titleEl = document.getElementById("subgoalModalTitle");
  const parentLabel = document.getElementById("subgoalParentLabel");
  const form = document.getElementById("subgoalForm");
  const submitBtn = form?.querySelector(".primary-btn");

  if (!backdrop || !form || !titleEl || !submitBtn) return;

  subgoalModalMode = mode;
  subgoalBeingEdited = null;
  subgoalParentGoalId = null;
  subgoalParentGoalTitle = "";

  form.reset();

  if (mode === "add") {
    const { goalId, goalTitle } = options;
    subgoalParentGoalId = goalId;
    subgoalParentGoalTitle = goalTitle || "";

    titleEl.textContent = "Add sub-goal";
    submitBtn.textContent = "Save sub-goal";

    if (parentLabel) {
      parentLabel.innerHTML = `Parent goal: <strong>${goalTitle || ""}</strong>`;
    }
  } else if (mode === "edit" && options.subgoal) {
    const sg = options.subgoal;
    subgoalBeingEdited = sg;
    subgoalParentGoalId = sg.goalId;
    subgoalParentGoalTitle = options.parentGoalTitle || "";

    titleEl.textContent = "Edit sub-goal";
    submitBtn.textContent = "Save changes";

    if (parentLabel) {
      parentLabel.innerHTML = `Parent goal: <strong>${
        options.parentGoalTitle || ""
      }</strong>`;
    }

    const titleInput = document.getElementById("subgoalTitle");
    const descInput = document.getElementById("subgoalDescription");
    const startInput = document.getElementById("subgoalStartDate");
    const endInput = document.getElementById("subgoalEndDate");
    const timeframeInput = document.getElementById("subgoalTimeframeLabel");
    const statusSelect = document.getElementById("subgoalStatus");

    if (titleInput) titleInput.value = sg.title || "";
    if (descInput) descInput.value = sg.description || "";
    if (startInput) startInput.value = sg.projectedStartDate || "";
    if (endInput) endInput.value = sg.projectedEndDate || "";
    if (timeframeInput) timeframeInput.value = sg.timeframe || "";
    if (statusSelect) statusSelect.value = sg.status || "not_started";
  }

  backdrop.classList.remove("hidden");
}

function closeSubgoalModal() {
  const backdrop = document.getElementById("subgoalModalBackdrop");
  const form = document.getElementById("subgoalForm");
  const titleEl = document.getElementById("subgoalModalTitle");
  const submitBtn = form?.querySelector(".primary-btn");
  const parentLabel = document.getElementById("subgoalParentLabel");

  if (!backdrop || !form || !titleEl || !submitBtn || !parentLabel) return;

  backdrop.classList.add("hidden");
  form.reset();

  subgoalModalMode = "add";
  subgoalBeingEdited = null;
  subgoalParentGoalId = null;
  subgoalParentGoalTitle = "";
  titleEl.textContent = "Add sub-goal";
  submitBtn.textContent = "Save sub-goal";
  parentLabel.innerHTML =
    'Parent goal: <strong>(will be set when opened)</strong>';
}

function setupSubgoalModalUI() {
  const btnClose = document.getElementById("btnCloseSubgoalModal");
  const btnCancel = document.getElementById("btnCancelSubgoal");
  const backdrop = document.getElementById("subgoalModalBackdrop");
  const form = document.getElementById("subgoalForm");

  if (btnClose) btnClose.addEventListener("click", closeSubgoalModal);
  if (btnCancel) btnCancel.addEventListener("click", closeSubgoalModal);

  if (backdrop) {
    backdrop.addEventListener("click", e => {
      if (e.target === backdrop) {
        closeSubgoalModal();
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) {
        alert("Please sign in to save a sub-goal.");
        return;
      }

      if (!subgoalParentGoalId) {
        alert("Missing parent goal. Please reopen the sub-goal form.");
        return;
      }

      const formData = new FormData(form);
      const title = (formData.get("subgoalTitle") || "").toString().trim();
      const description = (formData.get("subgoalDescription") || "")
        .toString()
        .trim();
      const projectedStartDate = formData.get("subgoalStartDate") || null;
      const projectedEndDate = formData.get("subgoalEndDate") || null;
      const timeframeLabelRaw =
        (formData.get("subgoalTimeframeLabel") || "").toString().trim();
      const status = (formData.get("subgoalStatus") || "not_started").toString();

      if (!title) {
        alert("Please enter a sub-goal title.");
        return;
      }

      if (projectedStartDate && projectedEndDate) {
        if (projectedStartDate > projectedEndDate) {
          alert("Projected end date must be on or after the start date.");
          return;
        }
      }

      let timeframe;
      if (timeframeLabelRaw) {
        timeframe = timeframeLabelRaw;
      } else if (projectedStartDate && projectedEndDate) {
        timeframe = `${projectedStartDate} → ${projectedEndDate}`;
      } else {
        timeframe = "";
      }

      const siblings = subgoalsByGoal[subgoalParentGoalId] || [];
      const defaultOrderIndex = siblings.length;

      const basePayload = {
        ownerUid: user.uid,
        goalId: subgoalParentGoalId,
        title,
        description,
        timeframe,
        projectedStartDate: projectedStartDate || null,
        projectedEndDate: projectedEndDate || null,
        actualStartDate: null,
        actualEndDate: null,
        status,
        percentComplete: statusToPercent(status),
        archived: false,
        orderIndex:
          subgoalModalMode === "edit" && subgoalBeingEdited?.orderIndex != null
            ? subgoalBeingEdited.orderIndex
            : defaultOrderIndex
      };

      try {
        if (subgoalModalMode === "edit" && subgoalBeingEdited) {
          await saveSubgoalDoc("edit", {
            id: subgoalBeingEdited.id,
            ...basePayload
          });
        } else {
          await saveSubgoalDoc("add", {
            ...basePayload,
            createdAt: serverTimestamp()
          });
        }

        closeSubgoalModal();
        await loadSubgoalsForUser(user.uid);
        await loadTasksForUser(user.uid);
        renderGoals();
        updateStats();
      } catch (err) {
        console.error("Error saving sub-goal:", err);
        alert("Unable to save the sub-goal. Check console for details.");
      }
    });
  }
}

// --- Task modal ---

function openTaskModal(mode = "add", options = {}) {
  const backdrop = document.getElementById("taskModalBackdrop");
  const titleEl = document.getElementById("taskModalTitle");
  const parentLabel = document.getElementById("taskParentLabel");
  const form = document.getElementById("taskForm");
  const submitBtn = form?.querySelector(".primary-btn");

  if (!backdrop || !form || !titleEl || !submitBtn) return;

  taskModalMode = mode;
  taskBeingEdited = null;
  taskParentSubgoalId = null;
  taskParentSubgoalTitle = "";
  taskParentGoalTitle = "";

  form.reset();

  if (mode === "add") {
    const { subgoalId, subgoalTitle, parentGoalTitle } = options;
    taskParentSubgoalId = subgoalId;
    taskParentSubgoalTitle = subgoalTitle || "";
    taskParentGoalTitle = parentGoalTitle || "";

    titleEl.textContent = "Add task";
    submitBtn.textContent = "Save task";

    if (parentLabel) {
      parentLabel.innerHTML = `Parent sub-goal: <strong>${subgoalTitle || ""}</strong>${
        parentGoalTitle ? ` • Goal: <strong>${parentGoalTitle}</strong>` : ""
      }`;
    }
  } else if (mode === "edit" && options.task) {
    const t = options.task;
    taskBeingEdited = t;
    taskParentSubgoalId = t.subgoalId;
    taskParentSubgoalTitle = options.subgoalTitle || "";
    taskParentGoalTitle = options.parentGoalTitle || "";

    titleEl.textContent = "Edit task";
    submitBtn.textContent = "Save changes";

    if (parentLabel) {
      parentLabel.innerHTML = `Parent sub-goal: <strong>${
        options.subgoalTitle || ""
      }</strong>${
        taskParentGoalTitle ? ` • Goal: <strong>${taskParentGoalTitle}</strong>` : ""
      }`;
    }

    const titleInput = document.getElementById("taskTitle");
    const notesInput = document.getElementById("taskNotes");
    const dueInput = document.getElementById("taskDueDate");
    const statusSelect = document.getElementById("taskStatus");

    if (titleInput) titleInput.value = t.title || "";
    if (notesInput) notesInput.value = t.notes || "";
    if (dueInput) dueInput.value = t.dueDate || "";
    if (statusSelect) statusSelect.value = t.status || "not_started";
  }

  backdrop.classList.remove("hidden");
}

function closeTaskModal() {
  const backdrop = document.getElementById("taskModalBackdrop");
  const form = document.getElementById("taskForm");
  const titleEl = document.getElementById("taskModalTitle");
  const submitBtn = form?.querySelector(".primary-btn");
  const parentLabel = document.getElementById("taskParentLabel");

  if (!backdrop || !form || !titleEl || !submitBtn || !parentLabel) return;

  backdrop.classList.add("hidden");
  form.reset();

  taskModalMode = "add";
  taskBeingEdited = null;
  taskParentSubgoalId = null;
  taskParentSubgoalTitle = "";
  taskParentGoalTitle = "";
  titleEl.textContent = "Add task";
  submitBtn.textContent = "Save task";
  parentLabel.innerHTML =
    'Parent sub-goal: <strong>(will be set when opened)</strong>';
}

function setupTaskModalUI() {
  const btnClose = document.getElementById("btnCloseTaskModal");
  const btnCancel = document.getElementById("btnCancelTask");
  const backdrop = document.getElementById("taskModalBackdrop");
  const form = document.getElementById("taskForm");

  if (btnClose) btnClose.addEventListener("click", closeTaskModal);
  if (btnCancel) btnCancel.addEventListener("click", closeTaskModal);

  if (backdrop) {
    backdrop.addEventListener("click", e => {
      if (e.target === backdrop) {
        closeTaskModal();
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) {
        alert("Please sign in to save a task.");
        return;
      }

      if (!taskParentSubgoalId) {
        alert("Missing parent sub-goal. Please reopen the task form.");
        return;
      }

      const formData = new FormData(form);
      const title = (formData.get("taskTitle") || "").toString().trim();
      const notes = (formData.get("taskNotes") || "").toString().trim();
      const dueDate = formData.get("taskDueDate") || null;
      const status = (formData.get("taskStatus") || "not_started").toString();

      if (!title) {
        alert("Please enter a task title.");
        return;
      }

      const siblings = tasksBySubgoal[taskParentSubgoalId] || [];
      const defaultOrderIndex = siblings.length;

      const basePayload = {
        ownerUid: user.uid,
        subgoalId: taskParentSubgoalId,
        title,
        notes,
        dueDate: dueDate || null,
        status,
        percentComplete: statusToPercent(status),
        archived: false,
        orderIndex:
          taskModalMode === "edit" && taskBeingEdited?.orderIndex != null
            ? taskBeingEdited.orderIndex
            : defaultOrderIndex
      };

      try {
        if (taskModalMode === "edit" && taskBeingEdited) {
          await saveTaskDoc("edit", {
            id: taskBeingEdited.id,
            ...basePayload
          });
        } else {
          await saveTaskDoc("add", {
            ...basePayload,
            createdAt: serverTimestamp()
          });
        }

        closeTaskModal();
        await loadTasksForUser(user.uid);
        renderGoals();
        updateStats();
      } catch (err) {
        console.error("Error saving task:", err);
        alert("Unable to save the task. Check console for details.");
      }
    });
  }
}

// --- Rendering ---

// Global toggle state
let showArchived = false;

function renderGoals() {
  const profContainer = document.getElementById("professional-goals");
  const persContainer = document.getElementById("personal-goals");

  if (!profContainer || !persContainer) return;

  profContainer.innerHTML = "";
  persContainer.innerHTML = "";

  const profGoals = showArchived ? goals.professional : goals.professional.filter(g => !g.archived);
  const persGoals = showArchived ? goals.personal : goals.personal.filter(g => !g.archived);

  profGoals.forEach(goal => {
    profContainer.appendChild(createGoalCard(goal, "professional", "Professional"));
  });

  persGoals.forEach(goal => {
    persContainer.appendChild(createGoalCard(goal, "personal", "Personal"));
  });

  attachGoalDragHandlers(profContainer, "professional");
  attachGoalDragHandlers(persContainer, "personal");
}

function createGoalCard(goal, sectionKey, tagLabel) {
  const card = document.createElement("article");
  card.className = `goal-card ${statusClassForCard(goal.status || "not_started")}`;
  card.dataset.goalId = goal.id;
  card.dataset.section = sectionKey;
  if (goal.archived) card.classList.add("archived");
  if (goal.isFocus) card.classList.add("is-focus");

  const goalPercent = computeGoalPercent(goal);

  const header = document.createElement("div");
  header.className = "goal-header";

  const title = document.createElement("h3");
  title.className = "goal-title heading-lg";
  title.textContent = goal.title;

  const tagRow = document.createElement("div");
  tagRow.style.display = "flex";
  tagRow.style.gap = "0.35rem";
  tagRow.style.alignItems = "center";

  const typeTag = document.createElement("span");
  typeTag.className = `goal-type ${sectionKey}`;
  typeTag.textContent = tagLabel;

  tagRow.appendChild(typeTag);

  if (goal.isFocus) {
    const focusPill = document.createElement("span");
    focusPill.className = "focus-tag";
    focusPill.textContent = "Focus";
    tagRow.appendChild(focusPill);
  }

  header.appendChild(title);
  header.appendChild(tagRow);

  const body = document.createElement("p");
  body.className = "goal-body body-text";
  body.textContent = goal.description || "";

  const meta = document.createElement("div");
  meta.className = "goal-meta";

  const timeframe = document.createElement("span");
  timeframe.className = "goal-timeframe meta-text";
  timeframe.textContent = goal.timeframe || "Timeline: flexible";

  const right = document.createElement("div");
  right.className = "goal-meta-right";

  const select = document.createElement("select");
  select.className = "goal-status-select";
  select.innerHTML = `
    <option value="not_started">Not started</option>
    <option value="in_progress">In progress</option>
    <option value="done">Done</option>
  `;
  select.value = goal.status || "not_started";

  select.addEventListener("change", async e => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please sign in to save changes.");
      e.target.value = goal.status || "not_started";
      return;
    }
    const newStatus = e.target.value;
    try {
      await saveGoalStatus(user.uid, sectionKey, goal.id, newStatus);
      card.className = `goal-card ${statusClassForCard(newStatus)}`;
    } catch (err) {
      console.error("Error saving status:", err);
      alert("Could not save status. Check console for details.");
      e.target.value = goal.status || "not_started";
      card.className = `goal-card ${statusClassForCard(goal.status || "not_started")}`;
    }
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn goal-edit-btn";
  editBtn.setAttribute("aria-label", "Edit goal");
  editBtn.dataset.tooltip = "Edit";
  editBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
    <span class="visually-hidden">Edit</span>
  `;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "icon-btn goal-delete-btn";
  deleteBtn.setAttribute("aria-label", goal.archived ? "Unarchive goal" : "Archive goal");
  deleteBtn.dataset.tooltip = goal.archived ? "Unarchive" : "Archive";
  deleteBtn.innerHTML = goal.archived ? `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3h18v4H3Z" />
      <path d="M5 7h14v14H5Z" />
      <path d="M12 12v6" />
      <path d="m9 15 3-3 3 3" />
    </svg>
    <span class="visually-hidden">Unarchive</span>
  ` : `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3h18v4H3Z" />
      <path d="M5 7h14v14H5Z" />
      <path d="M10 12h4" />
    </svg>
    <span class="visually-hidden">Archive</span>
  `;

  deleteBtn.addEventListener("click", async () => {
    if (!auth.currentUser) {
      alert("Please sign in to manage goals.");
      return;
    }
    try {
      if (goal.archived) {
        await unarchiveGoal(auth.currentUser.uid, sectionKey, goal.id);
      } else {
        await archiveGoal(auth.currentUser.uid, sectionKey, goal.id);
      }
      renderGoals();
      updateStats();
    } catch (err) {
      console.error("Archive/unarchive goal error", err);
      alert("Could not update goal archive state.");
    }
  });

  editBtn.addEventListener("click", () => {
    if (!auth.currentUser) {
      alert("Please sign in to edit goals.");
      return;
    }
    openGoalModal("edit", goal);
  });

  const actionGroup = document.createElement("span");
  actionGroup.className = "action-group";
  actionGroup.appendChild(editBtn);
  actionGroup.appendChild(deleteBtn);
  
  // Permanent delete button (only for archived goals)
  if (goal.archived) {
    const permanentDeleteBtn = document.createElement("button");
    permanentDeleteBtn.type = "button";
    permanentDeleteBtn.className = "icon-btn goal-delete-btn";
    permanentDeleteBtn.setAttribute("aria-label", "Delete goal permanently");
    permanentDeleteBtn.dataset.tooltip = "Delete";
    permanentDeleteBtn.style.cssText = "color: var(--accent-alt); opacity: 1;"; // Red color, ensure visible
    permanentDeleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
      <span class="visually-hidden">Delete</span>
    `;
    
    permanentDeleteBtn.addEventListener("click", async () => {
      if (!auth.currentUser) {
        alert("Please sign in to delete goals.");
        return;
      }
      
      const subgoalsForThis = subgoalsByGoal[goal.id] || [];
      let totalTasks = 0;
      subgoalsForThis.forEach(sg => {
        const tasks = tasksBySubgoal[sg.id] || [];
        totalTasks += tasks.length;
      });
      
      let warning = `Permanently delete goal "${goal.title}"?`;
      if (subgoalsForThis.length > 0) {
        warning += `\n\nThis will also delete ${subgoalsForThis.length} sub-goal${subgoalsForThis.length !== 1 ? 's' : ''}`;
        if (totalTasks > 0) {
          warning += ` and ${totalTasks} task${totalTasks !== 1 ? 's' : ''}`;
        }
        warning += '.';
      }
      warning += '\n\nThis cannot be undone.';
      
      const confirmDelete = confirm(warning);
      
      if (!confirmDelete) return;
      
      try {
        await deleteGoalWithChildren(auth.currentUser.uid, sectionKey, goal.id);
        renderGoals();
        updateStats();
      } catch (err) {
        console.error("Delete goal error", err);
        alert("Could not delete goal. Please try again.");
      }
    });
    
    actionGroup.appendChild(permanentDeleteBtn);
  }

  const addSubIconBtn = document.createElement("button");
  addSubIconBtn.type = "button";
  addSubIconBtn.className = "icon-btn";
  addSubIconBtn.setAttribute("aria-label", "Add sub-goal");
  addSubIconBtn.dataset.tooltip = "Add sub-goal";
  addSubIconBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
    <span class="visually-hidden">Add sub-goal</span>
  `;
  addSubIconBtn.addEventListener("click", () => {
    if (!auth.currentUser) {
      alert("Please sign in to add a sub-goal.");
      return;
    }
    openSubgoalModal("add", { goalId: goal.id, goalTitle: goal.title });
  });

  right.appendChild(select);
  right.appendChild(actionGroup);
  right.appendChild(addSubIconBtn);

  meta.appendChild(timeframe);
  meta.appendChild(right);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(meta);

  // Goal progress bar
  const progressRow = document.createElement("div");
  progressRow.className = "goal-progress-row";

  const progressLabel = document.createElement("span");
  progressLabel.className = "goal-progress-label";
  progressLabel.textContent = "Goal progress";

  const progressTrack = document.createElement("div");
  progressTrack.className = "goal-progress-track";

  const progressBar = document.createElement("div");
  progressBar.className = "goal-progress-bar";
  progressBar.style.width = `${goalPercent}%`;

  progressTrack.appendChild(progressBar);

  const progressPct = document.createElement("span");
  progressPct.className = "goal-progress-percent";
  progressPct.textContent = `${goalPercent}%`;

  progressRow.appendChild(progressLabel);
  progressRow.appendChild(progressTrack);
  progressRow.appendChild(progressPct);

  card.appendChild(progressRow);

  // --- Sub-goals section ---
  const subSection = document.createElement("div");
  subSection.className = "subgoal-section";

  const subHeader = document.createElement("div");
  subHeader.className = "subgoal-header";

  const subHeaderLeft = document.createElement("div");
  subHeaderLeft.className = "subgoal-header-left";

  const subToggleBtn = document.createElement("button");
  subToggleBtn.type = "button";
  subToggleBtn.className = "section-toggle-btn";
  subToggleBtn.innerHTML = `<span class="chevron">▾</span>`;

  const subHeaderTitle = document.createElement("span");
  subHeaderTitle.className = "subgoal-header-title meta-text";
  subHeaderTitle.textContent = "Sub-goals";

  const subList = document.createElement("div");
  subList.className = "subgoal-list";

  const subgoalsForThis = subgoalsByGoal[goal.id] || [];
  const activeSubgoalsCount = subgoalsForThis.filter(sg => !sg.archived).length;
  const subCount = document.createElement("span");
  subCount.className = "subgoal-count meta-text";
  subCount.textContent = `(${activeSubgoalsCount})`;

  subHeaderLeft.appendChild(subToggleBtn);
  subHeaderLeft.appendChild(subHeaderTitle);
  subHeaderLeft.appendChild(subCount);

  const addSubBtn = addSubIconBtn; // reuse icon button in header

  subHeader.appendChild(subHeaderLeft);
  subHeader.appendChild(addSubBtn);

  // Toggle sub-goal list collapse
  let subCollapsed = false;
  subToggleBtn.addEventListener("click", () => {
    subCollapsed = !subCollapsed;
    subList.classList.toggle("collapsed", subCollapsed);
    subToggleBtn.classList.toggle("collapsed", subCollapsed);
  });

  if (subgoalsForThis.length === 0) {
    const empty = document.createElement("div");
    empty.className = "subgoal-empty meta-text";
    empty.textContent = "No sub-goals yet. Add one to break this goal into smaller wins.";
    subList.appendChild(empty);
  } else {
    const subListFiltered = showArchived ? subgoalsForThis : subgoalsForThis.filter(sg => !sg.archived);
    subListFiltered.forEach(sg => {
        subList.appendChild(createSubgoalItem(sg, goal));
      });
  }

  subSection.appendChild(subHeader);
  subSection.appendChild(subList);

  card.appendChild(subSection);

  attachSubgoalDragHandlers(subList, goal.id);

  return card;
}

function attachGoalDragHandlers(container, sectionKey) {
  const cards = container.querySelectorAll(".goal-card");

  cards.forEach(card => {
    card.draggable = true;

    card.addEventListener("dragstart", e => {
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      persistGoalOrder(container, sectionKey);
    });
  });

  container.addEventListener("dragover", e => {
    e.preventDefault();
    const afterElement = getDragAfterElement(
      container,
      e.clientY,
      ".goal-card"
    );
    const dragging = container.querySelector(".goal-card.dragging");
    if (!dragging) return;

    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
  });
}

async function persistGoalOrder(container, sectionKey) {
  const orderedIds = Array.from(
    container.querySelectorAll(".goal-card")
  ).map(el => el.dataset.goalId);

  const list = goals[sectionKey];
  if (!list) return;

  const updates = [];

  orderedIds.forEach((id, index) => {
    const goal = list.find(g => g.id === id);
    if (!goal) return;

    goal.orderIndex = index;
    const ref = doc(db, "goals", goal.id);
    updates.push(updateDoc(ref, { orderIndex: index }));
  });

  await Promise.all(updates);

  goals[sectionKey] = orderedIds
    .map(id => list.find(g => g.id === id))
    .filter(Boolean);

  updateStats();
}

function attachSubgoalDragHandlers(listElement, parentGoalId) {
  const rows = listElement.querySelectorAll(".subgoal-item");

  rows.forEach(row => {
    row.draggable = true;

    row.addEventListener("dragstart", e => {
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      persistSubgoalOrder(listElement, parentGoalId);
    });
  });

  listElement.addEventListener("dragover", e => {
    e.preventDefault();
    const afterElement = getDragAfterElement(
      listElement,
      e.clientY,
      ".subgoal-item"
    );
    const dragging = listElement.querySelector(".subgoal-item.dragging");
    if (!dragging) return;

    if (afterElement == null) {
      listElement.appendChild(dragging);
    } else {
      listElement.insertBefore(dragging, afterElement);
    }
  });
}

async function persistSubgoalOrder(listElement, parentGoalId) {
  const orderedIds = Array.from(
    listElement.querySelectorAll(".subgoal-item")
  ).map(el => el.dataset.subgoalId);

  const list = subgoalsByGoal[parentGoalId];
  if (!list) return;

  const updates = [];

  orderedIds.forEach((id, index) => {
    const sg = list.find(s => s.id === id);
    if (!sg) return;

    sg.orderIndex = index;
    const ref = doc(db, "subgoals", sg.id);
    updates.push(updateDoc(ref, { orderIndex: index }));
  });

  await Promise.all(updates);

  subgoalsByGoal[parentGoalId] = orderedIds
    .map(id => list.find(s => s.id === id))
    .filter(Boolean);

  renderGoals();
  updateStats();
}

function attachTaskDragHandlers(listElement, subgoalId, parentGoal) {
  const rows = listElement.querySelectorAll(".task-item");

  rows.forEach(row => {
    row.draggable = true;

    row.addEventListener("dragstart", e => {
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      persistTaskOrder(listElement, subgoalId, parentGoal);
    });
  });

  listElement.addEventListener("dragover", e => {
    e.preventDefault();
    const afterElement = getDragAfterElement(
      listElement,
      e.clientY,
      ".task-item"
    );
    const dragging = listElement.querySelector(".task-item.dragging");
    if (!dragging) return;

    if (afterElement == null) {
      listElement.appendChild(dragging);
    } else {
      listElement.insertBefore(dragging, afterElement);
    }
  });
}

async function persistTaskOrder(listElement, subgoalId, parentGoal) {
  const orderedIds = Array.from(
    listElement.querySelectorAll(".task-item")
  ).map(el => el.dataset.taskId);

  const list = tasksBySubgoal[subgoalId];
  if (!list) return;

  const updates = [];

  orderedIds.forEach((id, index) => {
    const task = list.find(t => t.id === id);
    if (!task) return;

    task.orderIndex = index;
    const ref = doc(db, "tasks", task.id);
    updates.push(updateDoc(ref, { orderIndex: index }));
  });

  await Promise.all(updates);

  tasksBySubgoal[subgoalId] = orderedIds
    .map(id => list.find(t => t.id === id))
    .filter(Boolean);

  // Re-render goals so sub-goal progress bars & counts reflect the new structure
  renderGoals();
  updateStats();
}

function createSubgoalItem(subgoal, parentGoal) {
  const row = document.createElement("div");
  row.className = "subgoal-item";
  row.dataset.subgoalId = subgoal.id;
  row.dataset.parentGoalId = parentGoal.id;
  if (subgoal.archived) row.classList.add("archived");

  const main = document.createElement("div");
  main.className = "subgoal-main";

  const title = document.createElement("p");
  title.className = "subgoal-title subheading";
  title.textContent = subgoal.title;

  const meta = document.createElement("p");
  meta.className = "subgoal-meta meta-text";

  const parts = [];
  if (subgoal.timeframe) {
    parts.push(subgoal.timeframe);
  } else if (subgoal.projectedStartDate && subgoal.projectedEndDate) {
    parts.push(`${subgoal.projectedStartDate} → ${subgoal.projectedEndDate}`);
  }

  if (parts.length === 0) {
    parts.push("Timeline: flexible");
  }

  meta.textContent = parts.join(" • ");

  main.appendChild(title);
  main.appendChild(meta);

  const subPercent = computeSubgoalPercent(subgoal);

  const subProgressRow = document.createElement("div");
  subProgressRow.className = "subgoal-progress-row";

  const subProgressLabel = document.createElement("span");
  subProgressLabel.className = "subgoal-progress-label";
  subProgressLabel.textContent = "Sub-goal progress";

  const subProgressTrack = document.createElement("div");
  subProgressTrack.className = "subgoal-progress-track";

  const subProgressBar = document.createElement("div");
  subProgressBar.className = "subgoal-progress-bar";
  subProgressBar.style.width = `${subPercent}%`;

  subProgressTrack.appendChild(subProgressBar);

  const subProgressPct = document.createElement("span");
  subProgressPct.className = "subgoal-progress-percent";
  subProgressPct.textContent = `${subPercent}%`;

  subProgressRow.appendChild(subProgressLabel);
  subProgressRow.appendChild(subProgressTrack);
  subProgressRow.appendChild(subProgressPct);


  // --- Tasks section under this sub-goal ---
  const tasksSection = document.createElement("div");
  tasksSection.className = "task-section";

  const tasksHeader = document.createElement("div");
  tasksHeader.className = "task-header";

  const tasksHeaderLeft = document.createElement("div");
  tasksHeaderLeft.className = "task-header-left";

  const tasksToggleBtn = document.createElement("button");
  tasksToggleBtn.type = "button";
  tasksToggleBtn.className = "section-toggle-btn";
  tasksToggleBtn.innerHTML = `<span class="chevron">▾</span>`;

  const tasksHeaderTitle = document.createElement("span");
  tasksHeaderTitle.className = "task-header-title meta-text";
  tasksHeaderTitle.textContent = "Tasks";

  const tasksList = document.createElement("div");
  tasksList.className = "task-list";

  const tasksForThis = tasksBySubgoal[subgoal.id] || [];
  const activeTasksCount = tasksForThis.filter(t => !t.archived).length;

  const taskCount = document.createElement("span");
  taskCount.className = "task-count meta-text";
  taskCount.textContent = `(${activeTasksCount})`;

  tasksHeaderLeft.appendChild(tasksToggleBtn);
  tasksHeaderLeft.appendChild(tasksHeaderTitle);
  tasksHeaderLeft.appendChild(taskCount);

  const addTaskBtn = document.createElement("button");
  addTaskBtn.type = "button";
  addTaskBtn.className = "icon-btn";
  addTaskBtn.setAttribute("aria-label", "Add task");
  addTaskBtn.dataset.tooltip = "Add task";
  addTaskBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
    <span class="visually-hidden">Add task</span>
  `;
  addTaskBtn.addEventListener("click", () => {
    if (!auth.currentUser) {
      alert("Please sign in to add a task.");
      return;
    }
    openTaskModal("add", {
      subgoalId: subgoal.id,
      subgoalTitle: subgoal.title,
      parentGoalTitle: parentGoal.title
    });
  });

  tasksHeader.appendChild(tasksHeaderLeft);
  tasksHeader.appendChild(addTaskBtn);

  // Toggle tasks collapse
  let tasksCollapsed = false;
  tasksToggleBtn.addEventListener("click", () => {
    tasksCollapsed = !tasksCollapsed;
    tasksList.classList.toggle("collapsed", tasksCollapsed);
    tasksToggleBtn.classList.toggle("collapsed", tasksCollapsed);
  });

  if (tasksForThis.length === 0) {
    const emptyTask = document.createElement("div");
    emptyTask.className = "task-empty meta-text";
    emptyTask.textContent =
      "No tasks yet. Add actions to move this sub-goal forward.";
    tasksList.appendChild(emptyTask);
  } else {
    const tasksFiltered = showArchived ? tasksForThis : tasksForThis.filter(t => !t.archived);
    tasksFiltered.forEach(task => {
        tasksList.appendChild(createTaskItem(task, subgoal, parentGoal));
      });
  }

  tasksSection.appendChild(tasksHeader);
  tasksSection.appendChild(tasksList);

  // --- Footer: Sub-goal status bar at the bottom ---
  const actions = document.createElement("div");
  actions.className = "subgoal-actions";

  const footerLabel = document.createElement("span");
  footerLabel.className = "subgoal-footer-label meta-text";
  footerLabel.textContent = "Sub-goal status";

  const statusSelect = document.createElement("select");
  statusSelect.className = "goal-status-select";
  statusSelect.innerHTML = `
    <option value="not_started">Not started</option>
    <option value="in_progress">In progress</option>
    <option value="done">Done</option>
  `;
  statusSelect.value = subgoal.status || "not_started";
  statusSelect.addEventListener("change", async (e) => {
    if (!auth.currentUser) {
      alert("Please sign in to save changes.");
      e.target.value = subgoal.status || "not_started";
      return;
    }
    try {
      await saveSubgoalStatus(subgoal.id, e.target.value);
      renderGoals();
      updateStats();
    } catch (err) {
      console.error("Error saving sub-goal status:", err);
      alert("Could not save sub-goal status.");
      e.target.value = subgoal.status || "not_started";
    }
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn subgoal-edit-btn";
  editBtn.setAttribute("aria-label", "Edit sub-goal");
  editBtn.dataset.tooltip = "Edit";
  editBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
    <span class="visually-hidden">Edit</span>
  `;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "icon-btn subgoal-delete-btn";
  deleteBtn.setAttribute("aria-label", subgoal.archived ? "Unarchive sub-goal" : "Archive sub-goal");
  deleteBtn.dataset.tooltip = subgoal.archived ? "Unarchive" : "Archive";
  deleteBtn.innerHTML = subgoal.archived ? `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3h18v4H3Z" />
      <path d="M5 7h14v14H5Z" />
      <path d="M12 12v6" />
      <path d="m9 15 3-3 3 3" />
    </svg>
    <span class="visually-hidden">Unarchive</span>
  ` : `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3h18v4H3Z" />
      <path d="M5 7h14v14H5Z" />
      <path d="M10 12h4" />
    </svg>
    <span class="visually-hidden">Archive</span>
  `;

  deleteBtn.addEventListener("click", async () => {
    if (!auth.currentUser) {
      alert("Please sign in to manage sub-goals.");
      return;
    }
    try {
      if (subgoal.archived) {
        await unarchiveSubgoal(auth.currentUser.uid, parentGoal.id, subgoal.id);
      } else {
        await archiveSubgoal(auth.currentUser.uid, parentGoal.id, subgoal.id);
      }
      renderGoals();
      updateStats();
    } catch (err) {
      console.error("Archive/unarchive sub-goal error", err);
      alert("Could not update sub-goal archive state.");
    }
  });

  editBtn.addEventListener("click", () => {
    if (!auth.currentUser) {
      alert("Please sign in to edit sub-goals.");
      return;
    }
    openSubgoalModal("edit", {
      subgoal,
      parentGoalTitle: parentGoal.title
    });
  });

  const actionsLeft = document.createElement("span");
  actionsLeft.className = "left action-group";
  actionsLeft.appendChild(footerLabel);
  actionsLeft.appendChild(statusSelect);

  const actionsRight = document.createElement("span");
  actionsRight.className = "right action-group";
  actionsRight.appendChild(editBtn);
  actionsRight.appendChild(deleteBtn);
  
  // Permanent delete button (only for archived subgoals)
  if (subgoal.archived) {
    const permanentDeleteBtn = document.createElement("button");
    permanentDeleteBtn.type = "button";
    permanentDeleteBtn.className = "icon-btn subgoal-delete-btn";
    permanentDeleteBtn.setAttribute("aria-label", "Delete sub-goal permanently");
    permanentDeleteBtn.dataset.tooltip = "Delete";
    permanentDeleteBtn.style.color = "var(--accent-alt)"; // Red color
    permanentDeleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
      <span class="visually-hidden">Delete</span>
    `;
    
    permanentDeleteBtn.addEventListener("click", async () => {
      if (!auth.currentUser) {
        alert("Please sign in to delete sub-goals.");
        return;
      }
      
      const tasksForThis = tasksBySubgoal[subgoal.id] || [];
      const taskCount = tasksForThis.length;
      const taskWarning = taskCount > 0 
        ? `\n\nThis will also delete ${taskCount} task${taskCount !== 1 ? 's' : ''}.` 
        : '';
      
      const confirmDelete = confirm(
        `Permanently delete sub-goal "${subgoal.title}"?${taskWarning}\n\nThis cannot be undone.`
      );
      
      if (!confirmDelete) return;
      
      try {
        await deleteSubgoalWithTasks(auth.currentUser.uid, parentGoal.id, subgoal.id);
        renderGoals();
        updateStats();
      } catch (err) {
        console.error("Delete sub-goal error", err);
        alert("Could not delete sub-goal. Please try again.");
      }
    });
    
    actionsRight.appendChild(permanentDeleteBtn);
  }
  
  actionsRight.appendChild(addTaskBtn);

  actions.appendChild(actionsLeft);
  actions.appendChild(actionsRight);

  // Final structure: main → tasks → footer
  row.appendChild(main);
  row.appendChild(subProgressRow);
  row.appendChild(tasksSection);
  row.appendChild(actions);

  attachTaskDragHandlers(tasksList, subgoal.id, parentGoal);

  return row;
}

function createTaskItem(task, parentSubgoal, parentGoal) {
  const row = document.createElement("div");
  row.className = "task-item";
  row.dataset.taskId = task.id;
  row.dataset.subgoalId = parentSubgoal.id;
  if (task.archived) row.classList.add("archived");

  const main = document.createElement("div");
  main.className = "task-main";

  const title = document.createElement("p");
  title.className = "task-title body-text";
  title.textContent = task.title;

  const meta = document.createElement("p");
  meta.className = "task-meta meta-text";

  const parts = [];
  if (task.dueDate) {
    parts.push(`Due ${task.dueDate}`);
  }
  if (task.notes) {
    parts.push("Has notes");
  }
  if (parts.length === 0) {
    parts.push("No specific due date");
  }

  meta.textContent = parts.join(" • ");

  main.appendChild(title);
  main.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions goal-actions-bar";

  const statusSelect = document.createElement("select");
  statusSelect.className = "goal-status-select";
  statusSelect.innerHTML = `
    <option value="not_started">Not started</option>
    <option value="in_progress">In progress</option>
    <option value="done">Done</option>
  `;
  statusSelect.value = task.status || "not_started";
  statusSelect.addEventListener("change", async (e) => {
    if (!auth.currentUser) {
      alert("Please sign in to save changes.");
      e.target.value = task.status || "not_started";
      return;
    }
    try {
      await saveTaskStatus(task.id, e.target.value, parentSubgoal.id);
      renderGoals();
      updateStats();
    } catch (err) {
      console.error("Error saving task status:", err);
      alert("Could not save task status.");
      e.target.value = task.status || "not_started";
    }
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn task-edit-btn";
  editBtn.setAttribute("aria-label", "Edit task");
  editBtn.dataset.tooltip = "Edit";
  editBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
    <span class="visually-hidden">Edit</span>
  `;

  const archiveBtn = document.createElement("button");
  archiveBtn.type = "button";
  archiveBtn.className = "icon-btn task-delete-btn";
  archiveBtn.setAttribute("aria-label", task.archived ? "Unarchive task" : "Archive task");
  archiveBtn.dataset.tooltip = task.archived ? "Unarchive" : "Archive";
  archiveBtn.innerHTML = task.archived ? `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3h18v4H3Z" />
      <path d="M5 7h14v14H5Z" />
      <path d="M12 12v6" />
      <path d="m9 15 3-3 3 3" />
    </svg>
    <span class="visually-hidden">Unarchive</span>
  ` : `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3h18v4H3Z" />
      <path d="M5 7h14v14H5Z" />
      <path d="M10 12h4" />
    </svg>
    <span class="visually-hidden">Archive</span>
  `;

  archiveBtn.addEventListener("click", async () => {
    if (!auth.currentUser) {
      alert("Please sign in to manage tasks.");
      return;
    }
    try {
      if (task.archived) {
        await unarchiveTask(auth.currentUser.uid, parentGoal.id, parentSubgoal.id, task.id);
      } else {
        await archiveTask(auth.currentUser.uid, parentGoal.id, parentSubgoal.id, task.id);
      }
      renderGoals();
      updateStats();
    } catch (err) {
      console.error("Archive/unarchive task error", err);
      alert("Could not update task archive state.");
    }
  });


  editBtn.addEventListener("click", () => {
    if (!auth.currentUser) {
      alert("Please sign in to edit tasks.");
      return;
    }
    openTaskModal("edit", {
      task,
      subgoalTitle: parentSubgoal.title,
      parentGoalTitle: parentGoal.title
    });
  });

  const actionsLeft = document.createElement("span");
  actionsLeft.className = "left action-group";
  actionsLeft.appendChild(statusSelect);

  const actionsRight = document.createElement("span");
  actionsRight.className = "right action-group";
  actionsRight.appendChild(editBtn);
  actionsRight.appendChild(archiveBtn);
  
  // Delete button (only for archived tasks)
  if (task.archived) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-btn task-delete-btn";
    deleteBtn.setAttribute("aria-label", "Delete task permanently");
    deleteBtn.dataset.tooltip = "Delete";
    deleteBtn.style.color = "var(--accent-alt)"; // Red color
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
      <span class="visually-hidden">Delete</span>
    `;
    
    deleteBtn.addEventListener("click", async () => {
      if (!auth.currentUser) {
        alert("Please sign in to delete tasks.");
        return;
      }
      
      const confirmDelete = confirm(
        `Permanently delete task "${task.title}"?\n\nThis cannot be undone.`
      );
      
      if (!confirmDelete) return;
      
      try {
        await deleteTask(auth.currentUser.uid, parentGoal.id, parentSubgoal.id, task.id);
        renderGoals();
        updateStats();
      } catch (err) {
        console.error("Delete task error", err);
        alert("Could not delete task. Please try again.");
      }
    });
    
    actionsRight.appendChild(deleteBtn);
  }

  actions.appendChild(actionsLeft);
  actions.appendChild(actionsRight);

  row.appendChild(main);
  row.appendChild(actions);

  return row;
}

// --- Calendar rendering ---

function renderCalendar() {
  const container = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("calMonthLabel");
  
  if (!container) return;
  
  container.innerHTML = "";
  if (monthLabel) {
    monthLabel.textContent = formatMonthYear(calendarCursor);
  }
  
  const gridStart = startOfCalendarGrid(calendarCursor);
  const gridEnd = endOfCalendarGrid(calendarCursor);
  const monthStart = startOfMonth(calendarCursor);
  const monthEnd = endOfMonth(calendarCursor);
  const today = new Date();
  
  // Build day cells
  const cells = [];
  const current = new Date(gridStart);
  while (current <= gridEnd) {
    cells.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  // Day headers
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(name => {
    const header = document.createElement("div");
    header.className = "calendar-day-header meta-text";
    header.textContent = name;
    container.appendChild(header);
  });
  
  // Day cells
  cells.forEach(date => {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    
    const isOutOfMonth = date < monthStart || date > monthEnd;
    const isToday = isSameDay(date, today);
    
    if (isOutOfMonth) cell.classList.add("out-of-month");
    if (isToday) cell.classList.add("today");
    
    const dateLabel = document.createElement("div");
    dateLabel.className = "calendar-date";
    dateLabel.textContent = date.getDate();
    cell.appendChild(dateLabel);
    
    const eventsLayer = document.createElement("div");
    eventsLayer.className = "calendar-events";
    cell.appendChild(eventsLayer);
    
    container.appendChild(cell);
  });
  
  // Render events
  const events = buildCalendarEvents();
  const allGoals = [...goals.professional, ...goals.personal];
  
  console.log("Calendar events:", events);
  console.log("Grid has", cells.length, "cells");
  
  // Goals and sub-goals as bars - render inside cells as per-day fragments
  events.filter(e => e.type === "goal" || e.type === "subgoal").forEach(event => {
    if (!rangeOverlaps(event.startDate, event.endDate, gridStart, gridEnd)) {
      console.log(`Event "${event.title}" doesn't overlap visible range`);
      return;
    }
    
    const clampedStart = event.startDate < gridStart ? gridStart : event.startDate;
    const clampedEnd = event.endDate > gridEnd ? gridEnd : event.endDate;
    
    // Find start and end cell indices
    const startCell = cells.findIndex(d => isSameDay(d, clampedStart));
    if (startCell === -1) {
      console.log(`Start cell not found for "${event.title}"`);
      return;
    }
    
    let endCell = cells.findIndex(d => isSameDay(d, clampedEnd));
    if (endCell === -1) endCell = cells.length - 1;
    
    console.log(`Event "${event.title}" spans cells ${startCell} to ${endCell}`);
    
    // Calculate week rows (each week is 7 cells)
    const startRow = Math.floor(startCell / 7);
    const endRow = Math.floor(endCell / 7);
    
    // Render per-day fragments for each covered cell to avoid overflow/stacking issues
    for (let row = startRow; row <= endRow; row++) {
      const rowStartCell = row * 7;
      const rowEndCell = Math.min(rowStartCell + 6, cells.length - 1);
      const segmentStart = Math.max(startCell, rowStartCell);
      const segmentEnd = Math.min(endCell, rowEndCell);
      for (let idx = segmentStart; idx <= segmentEnd; idx++) {
        const cellElement = container.children[7 + idx];
        if (!cellElement) continue;
        const eventsLayer = cellElement.querySelector(".calendar-events");
        if (!eventsLayer) continue;
        const isStart = idx === startCell;
        const isEnd = idx === endCell;
        const frag = document.createElement("div");
        frag.className = `calendar-bar-fragment ${event.type} ${isStart ? 'start' : (isEnd ? 'end' : 'middle')}`;
        frag.style.backgroundColor = event.color;
        frag.title = event.title;
        frag.style.zIndex = "11";
        frag.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!auth.currentUser) {
            alert("Please sign in to edit.");
            return;
          }
          if (event.type === "goal") {
            openGoalModal("edit", event.data);
          } else if (event.type === "subgoal") {
            const parentGoal = allGoals.find(g => g.id === event.goalId);
            openSubgoalModal("edit", {
              subgoal: event.data,
              parentGoalTitle: parentGoal?.title || ""
            });
          }
        });
        eventsLayer.appendChild(frag);
      }
    }
  });
  
  // Tasks as dots
  events.filter(e => e.type === "task").forEach(event => {
    const cellIndex = cells.findIndex(d => isSameDay(d, event.dueDate));
    if (cellIndex === -1) return;
    
    const cellElement = container.children[7 + cellIndex]; // +7 for headers
    if (!cellElement) return;
    
    const eventsLayer = cellElement.querySelector(".calendar-events");
    if (!eventsLayer) return;
    
    const dot = document.createElement("div");
    dot.className = "calendar-dot task";
    dot.style.setProperty("--dot-color", event.color);
    dot.title = event.title;
    
    dot.addEventListener("click", () => {
      if (!auth.currentUser) {
        alert("Please sign in to edit.");
        return;
      }
      
      const parentSubgoal = Object.values(subgoalsByGoal)
        .flat()
        .find(sg => sg.id === event.subgoalId);
      const parentGoal = allGoals.find(g => g.id === event.goalId);
      
      openTaskModal("edit", {
        task: event.data,
        subgoalTitle: parentSubgoal?.title || "",
        parentGoalTitle: parentGoal?.title || ""
      });
    });
    
    eventsLayer.appendChild(dot);
  });
}

function setupCalendarUI() {
  const btnPrev = document.getElementById("calPrev");
  const btnToday = document.getElementById("calToday");
  const btnNext = document.getElementById("calNext");
  
  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      calendarCursor.setMonth(calendarCursor.getMonth() - 1);
      renderCalendar();
    });
  }
  
  if (btnToday) {
    btnToday.addEventListener("click", () => {
      calendarCursor = new Date();
      renderCalendar();
    });
  }
  
  if (btnNext) {
    btnNext.addEventListener("click", () => {
      calendarCursor.setMonth(calendarCursor.getMonth() + 1);
      renderCalendar();
    });
  }
}

// --- Stats & dashboard ---

function renderCurrentFocus() {
  const container = document.getElementById("currentFocusContent");
  if (!container) return;
  
  container.innerHTML = "";
  
  // Find all focus goals
  const allGoals = [...goals.professional, ...goals.personal];
  const focusGoals = allGoals.filter(g => g.isFocus);
  
  if (focusGoals.length === 0) {
    // No focus goal selected
    const placeholder = document.createElement("div");
    placeholder.className = "focus-placeholder body-text";
    placeholder.innerHTML = `
      <p>No focus goal selected.</p>
      <p class="meta-text">Edit a goal and toggle "Mark as current focus" to highlight it here.</p>
    `;
    container.appendChild(placeholder);
    return;
  }
  
  // Render each focus goal
  focusGoals.forEach(goal => {
    const focusCard = document.createElement("div");
    focusCard.className = "focus-goal-card";
    
    // Goal title and type
    const header = document.createElement("div");
    header.className = "focus-goal-header";
    
    const titleRow = document.createElement("div");
    titleRow.className = "focus-goal-title-row";
    
    const title = document.createElement("h3");
    title.className = "focus-goal-title heading-lg";
    title.textContent = goal.title;
    
    const typeTag = document.createElement("span");
    typeTag.className = `focus-goal-type ${goal.type} meta-text`;
    typeTag.textContent = goal.type === "professional" ? "Professional" : "Personal";
    
    titleRow.appendChild(title);
    titleRow.appendChild(typeTag);
    header.appendChild(titleRow);
    
    // Progress
    const progressPercent = computeGoalPercent(goal);
    const progressRow = document.createElement("div");
    progressRow.className = "focus-progress-row";
    
    const progressLabel = document.createElement("span");
    progressLabel.className = "focus-progress-label meta-text";
    progressLabel.textContent = "Progress";
    
    const progressTrack = document.createElement("div");
    progressTrack.className = "focus-progress-track";
    
    const progressBar = document.createElement("div");
    progressBar.className = "focus-progress-bar";
    progressBar.style.width = `${progressPercent}%`;
    
    progressTrack.appendChild(progressBar);
    
    const progressPct = document.createElement("span");
    progressPct.className = "focus-progress-percent meta-text";
    progressPct.textContent = `${progressPercent}%`;
    
    progressRow.appendChild(progressLabel);
    progressRow.appendChild(progressTrack);
    progressRow.appendChild(progressPct);
    
    // Timeframe and days remaining
    const timeframeRow = document.createElement("div");
    timeframeRow.className = "focus-timeframe-row meta-text";
    
    let timeframeText = "";
    if (goal.projectedStartDate && goal.projectedEndDate) {
      timeframeText = `${formatDate(goal.projectedStartDate)} → ${formatDate(goal.projectedEndDate)}`;
      const daysLeft = daysUntil(goal.projectedEndDate);
      if (daysLeft !== null) {
        if (daysLeft < 0) {
          timeframeText += ` • <span class="focus-overdue">${Math.abs(daysLeft)} days overdue</span>`;
        } else if (daysLeft === 0) {
          timeframeText += ` • <span class="focus-due-today">Due today</span>`;
        } else {
          timeframeText += ` • ${daysLeft} days remaining`;
        }
      }
    } else if (goal.timeframe) {
      timeframeText = goal.timeframe;
    } else {
      timeframeText = "Timeframe: flexible";
    }
    
    timeframeRow.innerHTML = timeframeText;
    
    // Summary counts (exclude archived sub-goals and tasks)
    const subsAll = subgoalsByGoal[goal.id] || [];
    const subs = subsAll.filter(sg => !sg.archived);
    const subsComplete = subs.filter(sg => sg.status === "done").length;
    
    let totalTasks = 0;
    let tasksComplete = 0;
    subs.forEach(sg => {
      const tasksAll = tasksBySubgoal[sg.id] || [];
      const tasks = tasksAll.filter(t => !t.archived);
      totalTasks += tasks.length;
      tasksComplete += tasks.filter(t => t.status === "done").length;
    });
    
    const countsRow = document.createElement("div");
    countsRow.className = "focus-counts-row meta-text";
    countsRow.innerHTML = `
      <span>${subsComplete} / ${subs.length} sub-goals complete</span>
      <span>•</span>
      <span>${tasksComplete} / ${totalTasks} tasks complete</span>
    `;
    
    // Quick actions
    const actionsRow = document.createElement("div");
    actionsRow.className = "focus-actions-row";
    
    const addSubgoalBtn = document.createElement("button");
    addSubgoalBtn.className = "focus-action-btn";
    addSubgoalBtn.innerHTML = `<span>＋</span><span>Sub-goal</span>`;
    addSubgoalBtn.addEventListener("click", () => {
      if (!auth.currentUser) {
        alert("Please sign in to add a sub-goal.");
        return;
      }
      openSubgoalModal("add", {
        goalId: goal.id,
        goalTitle: goal.title
      });
    });
    
    const editGoalBtn = document.createElement("button");
    editGoalBtn.className = "focus-action-btn";
    editGoalBtn.textContent = "Edit Goal";
    editGoalBtn.addEventListener("click", () => {
      if (!auth.currentUser) {
        alert("Please sign in to edit goals.");
        return;
      }
      openGoalModal("edit", goal);
    });
    
    actionsRow.appendChild(addSubgoalBtn);
    actionsRow.appendChild(editGoalBtn);
    
    // Assemble card
    focusCard.appendChild(header);
    focusCard.appendChild(progressRow);
    focusCard.appendChild(timeframeRow);
    focusCard.appendChild(countsRow);
    focusCard.appendChild(actionsRow);
    
    container.appendChild(focusCard);
  });
}

function updateStats() {
  const profActive = goals.professional.filter(g => !g.archived);
  const persActive = goals.personal.filter(g => !g.archived);

  const totalProf = profActive.length;
  const totalPers = persActive.length;

  const completedProf = profActive.filter(g => g.status === "done").length;
  const completedPers = persActive.filter(g => g.status === "done").length;

  const elProfCount = document.getElementById("stat-prof-count");
  const elProfComplete = document.getElementById("stat-prof-complete");
  const elPersCount = document.getElementById("stat-pers-count");
  const elPersComplete = document.getElementById("stat-pers-complete");
  const bar = document.getElementById("overall-progress");
  const label = document.getElementById("overall-progress-label");

  if (!elProfCount) return;

  elProfCount.textContent = totalProf;
  elProfComplete.textContent = completedProf;
  elPersCount.textContent = totalPers;
  elPersComplete.textContent = completedPers;

  //Old:
  // const totalGoals = totalProf + totalPers;
  // const totalCompleted = completedProf + completedPers;
  // const percent =
  //   totalGoals === 0 ? 0 : Math.round((totalCompleted / totalGoals) * 100);

  // New: roll-up based on computed goal percents
  const allGoals = [...profActive, ...persActive];
  let overallPercent = 0;

  if (allGoals.length > 0) {
    let sum = 0;
    allGoals.forEach(g => {
      sum += computeGoalPercent(g);
    });
    overallPercent = Math.round(sum / allGoals.length);
  }

  if (bar) bar.style.width = `${overallPercent}%`;
  if (label) label.textContent = `${overallPercent}% complete`;
  
  renderCurrentFocus();
  renderTasksDueSoon();
  renderAtRiskItems();
  renderRecentlyUpdated();
}

function getTasksDueSoon() {
  // Safety check: return empty if data not loaded yet
  if (!goals || !goals.professional || !goals.personal) {
    return [];
  }
  if (typeof tasksBySubgoal === 'undefined') {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const allTasks = [];
  const allGoals = [...goals.professional, ...goals.personal];
  
  // Collect all tasks with metadata
  Object.entries(tasksBySubgoal).forEach(([subgoalId, tasks]) => {
    tasks.forEach(task => {
      const status = (task.status || "").toLowerCase();
      if (status === "done" || !task.dueDate) return;
      
      const dueDate = ymd(task.dueDate);
      if (!dueDate) return;
      
      // Find parent subgoal and goal
      const parentSubgoal = Object.values(subgoalsByGoal)
        .flat()
        .find(sg => sg.id === subgoalId);
      
      const parentGoal = allGoals.find(g => g.id === parentSubgoal?.goalId);
      
      // Determine urgency
      let urgency = "future";
      if (dueDate < today) {
        urgency = "overdue";
      } else if (isSameDay(dueDate, today)) {
        urgency = "today";
      } else if (dueDate <= sevenDaysFromNow) {
        urgency = "week";
      }
      
      if (urgency !== "future") {
        allTasks.push({
          task,
          subgoal: parentSubgoal,
          goal: parentGoal,
          dueDate,
          urgency
        });
      }
    });
  });
  
  // Sort by urgency then date
  const urgencyOrder = { overdue: 0, today: 1, week: 2 };
  allTasks.sort((a, b) => {
    if (a.urgency !== b.urgency) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return a.dueDate - b.dueDate;
  });
  
  return allTasks;
}

function renderTasksDueSoon() {
  const container = document.getElementById("tasksDueSoonContent");
  if (!container) return;
  
  container.innerHTML = "";
  
  const dueTasks = getTasksDueSoon();
  
  if (dueTasks.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "tasks-soon-empty meta-text";
    placeholder.textContent = "No tasks due in the next 7 days. You're all caught up!";
    container.appendChild(placeholder);
    return;
  }
  
  const list = document.createElement("div");
  list.className = "tasks-soon-list";
  
  dueTasks.forEach(({ task, subgoal, goal, dueDate, urgency }) => {
    const item = document.createElement("div");
    item.className = `tasks-soon-item urgency-${urgency}`;
    
    // Urgency indicator
    const indicator = document.createElement("div");
    indicator.className = `tasks-soon-indicator urgency-${urgency}`;
    
    // Content
    const content = document.createElement("div");
    content.className = "tasks-soon-content";
    
    const title = document.createElement("div");
    title.className = "tasks-soon-title body-text";
    title.textContent = task.title;
    
    const meta = document.createElement("div");
    meta.className = "tasks-soon-meta meta-text";
    
    const parts = [];
    if (subgoal) parts.push(subgoal.title);
    if (goal) parts.push(goal.title);
    meta.textContent = parts.join(" • ");
    
    content.appendChild(title);
    content.appendChild(meta);
    
    // Due date
    const dueDateDiv = document.createElement("div");
    dueDateDiv.className = "tasks-soon-date";
    
    const dateLabel = document.createElement("div");
    dateLabel.className = `tasks-soon-date-label urgency-${urgency} meta-text`;
    
    if (urgency === "overdue") {
      const daysOverdue = Math.abs(daysUntil(task.dueDate));
      dateLabel.textContent = `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`;
    } else if (urgency === "today") {
      dateLabel.textContent = "Due today";
    } else {
      const daysLeft = daysUntil(task.dueDate);
      dateLabel.textContent = `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
    }
    
    const dateValue = document.createElement("div");
    dateValue.className = "tasks-soon-date-value meta-text";
    dateValue.textContent = formatDate(task.dueDate);
    
    dueDateDiv.appendChild(dateLabel);
    dueDateDiv.appendChild(dateValue);
    
    // Assemble
    item.appendChild(indicator);
    item.appendChild(content);
    item.appendChild(dueDateDiv);
    
    // Click to edit
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      if (!auth.currentUser) {
        alert("Please sign in to edit tasks.");
        return;
      }
      openTaskModal("edit", {
        task,
        subgoalTitle: subgoal?.title || "",
        parentGoalTitle: goal?.title || ""
      });
    });
    
    list.appendChild(item);
  });
  
  container.appendChild(list);
}

// --- Nav ---

// At-Risk Items

function getAtRiskItems() {
  // Safety check: return empty if data not loaded yet
  if (!goals || !goals.professional || !goals.personal) {
    return [];
  }
  if (typeof subgoalsByGoal === 'undefined' || typeof tasksBySubgoal === 'undefined') {
    return [];
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const atRiskItems = [];

  const allGoals = [ ...goals.professional, ...goals.personal ];
  const allSubgoals = Object.values(subgoalsByGoal).flat();
  const allTasks = Object.values(tasksBySubgoal).flat();

  console.log('[At-Risk] Checking items...');
  console.log('[At-Risk] Today:', today);
  console.log('[At-Risk] Total goals:', allGoals.length);
  console.log('[At-Risk] Total subgoals:', allSubgoals.length);
  console.log('[At-Risk] Total tasks:', allTasks.length);

  // A. At-risk goals
  allGoals.forEach(goal => {
    if (!goal || goal.archived) return;

    const projectedStart = goal.projectedStartDate ? ymd(goal.projectedStartDate) : null;
    const projectedEnd = goal.projectedEndDate ? ymd(goal.projectedEndDate) : null;
    const status = (goal.status || "").toLowerCase();
    
    // Rule 1: projectedStartDate < today AND status = "not_started"
    const notStartedButShould = projectedStart && projectedStart < today && status === "not_started";
    
    // Rule 2: past projectedEndDate AND not done
    const pastEndDate = projectedEnd && projectedEnd < today && status !== "done";

    if (notStartedButShould) {
      console.log('[At-Risk] Goal not started:', goal.title, '- projected start:', goal.projectedStartDate);
      atRiskItems.push({
        type: "goal",
        item: goal,
        reason: "Not started",
        daysOverdue: 0
      });
    } else if (pastEndDate) {
      const daysOver = Math.abs(daysUntil(goal.projectedEndDate));
      console.log('[At-Risk] Goal overdue:', goal.title, '- days overdue:', daysOver);
      atRiskItems.push({
        type: "goal",
        item: goal,
        reason: "Overdue",
        daysOverdue: daysOver
      });
    }
  });

  // B. At-risk sub-goals (same logic as goals)
  allSubgoals.forEach(subgoal => {
    if (!subgoal || subgoal.archived) return;

    const projectedStart = subgoal.projectedStartDate ? ymd(subgoal.projectedStartDate) : null;
    const projectedEnd = subgoal.projectedEndDate ? ymd(subgoal.projectedEndDate) : null;
    const status = (subgoal.status || "").toLowerCase();
    
    const notStartedButShould = projectedStart && projectedStart < today && status === "not_started";
    const pastEndDate = projectedEnd && projectedEnd < today && status !== "done";

    const parentGoal = allGoals.find(g => g.id === subgoal.goalId);

    if (notStartedButShould) {
      console.log('[At-Risk] Subgoal not started:', subgoal.title);
      atRiskItems.push({
        type: "subgoal",
        item: subgoal,
        parentGoal,
        reason: "Not started",
        daysOverdue: 0
      });
    } else if (pastEndDate) {
      const daysOver = Math.abs(daysUntil(subgoal.projectedEndDate));
      console.log('[At-Risk] Subgoal overdue:', subgoal.title, '- days overdue:', daysOver);
      atRiskItems.push({
        type: "subgoal",
        item: subgoal,
        parentGoal,
        reason: "Overdue",
        daysOverdue: daysOver
      });
    }
  });

  // C. At-risk tasks (overdue)
  allTasks.forEach(task => {
    if (!task || task.archived) return;
    const status = (task.status || "").toLowerCase();
    if (status === "done") return;

    const dueDate = task.dueDate ? ymd(task.dueDate) : null;
    
    if (dueDate && dueDate < today) {
      const subgoal = allSubgoals.find(sg => sg.id === task.subgoalId);
      const goal = subgoal ? allGoals.find(g => g.id === subgoal.goalId) : null;
      const daysOver = Math.abs(daysUntil(task.dueDate));
      
      console.log('[At-Risk] Task overdue:', task.title, '- days overdue:', daysOver);

      atRiskItems.push({
        type: "task",
        item: task,
        subgoal,
        goal,
        reason: "Overdue",
        daysOverdue: daysOver
      });
    }
  });
  
  console.log('[At-Risk] Total at-risk items found:', atRiskItems.length);
  
  // Sort by severity: overdue items first, then by days overdue/behind
  atRiskItems.sort((a, b) => {
    const severityOrder = { "Overdue": 0, "Behind schedule": 1, "Not started": 2 };
    if (a.reason !== b.reason) {
      return severityOrder[a.reason] - severityOrder[b.reason];
    }
    return b.daysOverdue - a.daysOverdue;
  });
  
  return atRiskItems;
}

function renderAtRiskItems() {
  const container = document.getElementById("atRiskContent");
  if (!container) return;
  
  container.innerHTML = "";
  
  const atRiskItems = getAtRiskItems();
  
  if (atRiskItems.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "at-risk-empty meta-text";
    placeholder.textContent = "All items are on track. Great work!";
    container.appendChild(placeholder);
    return;
  }
  
  const list = document.createElement("div");
  list.className = "at-risk-list";
  
  atRiskItems.forEach(({ type, item, parentGoal, subgoal, goal, reason, daysOverdue }) => {
    const card = document.createElement("div");
    card.className = `at-risk-card at-risk-${type}`;
    
    // Header with type badge and reason
    const header = document.createElement("div");
    header.className = "at-risk-header";
    
    const typeBadge = document.createElement("span");
    typeBadge.className = `at-risk-badge at-risk-badge-${type}`;
    typeBadge.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    
    const reasonBadge = document.createElement("span");
    reasonBadge.className = `at-risk-reason at-risk-reason-${reason.toLowerCase().replace(' ', '-')}`;
    if (reason === "Overdue" && daysOverdue > 0) {
      reasonBadge.textContent = `${reason} (${daysOverdue} day${daysOverdue !== 1 ? 's' : ''})`;
    } else {
      reasonBadge.textContent = reason;
    }
    
    header.appendChild(typeBadge);
    header.appendChild(reasonBadge);
    
    // Title
    const title = document.createElement("div");
    title.className = "at-risk-title body-text";
    title.textContent = item.title;
    
    // Meta (parent context)
    const meta = document.createElement("div");
    meta.className = "at-risk-meta meta-text";
    
    if (type === "subgoal" && parentGoal) {
      meta.textContent = `In: ${parentGoal.title}`;
    } else if (type === "task") {
      const parts = [];
      if (subgoal) parts.push(subgoal.title);
      if (goal) parts.push(goal.title);
      meta.textContent = parts.length > 0 ? parts.join(" • ") : "";
    }
    
    // Progress (for goals and subgoals)
    if (type !== "task" && item.percentComplete !== undefined) {
      const progressContainer = document.createElement("div");
      progressContainer.className = "at-risk-progress";
      
      const progressBar = document.createElement("div");
      progressBar.className = "at-risk-progress-track";
      
      const progressFill = document.createElement("div");
      progressFill.className = "at-risk-progress-fill";
      progressFill.style.width = `${item.percentComplete}%`;
      
      const progressLabel = document.createElement("span");
      progressLabel.className = "at-risk-progress-label meta-text";
      progressLabel.textContent = `${Math.round(item.percentComplete)}%`;
      
      progressBar.appendChild(progressFill);
      progressContainer.appendChild(progressBar);
      progressContainer.appendChild(progressLabel);
      
      card.appendChild(header);
      card.appendChild(title);
      if (meta.textContent) card.appendChild(meta);
      card.appendChild(progressContainer);
    } else {
      card.appendChild(header);
      card.appendChild(title);
      if (meta.textContent) card.appendChild(meta);
    }
    
    // Click to edit
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      if (!auth.currentUser) {
        alert("Please sign in to edit items.");
        return;
      }
      
      if (type === "goal") {
        openGoalModal("edit", item);
      } else if (type === "subgoal") {
        openSubgoalModal("edit", {
          subgoal: item,
          parentGoalTitle: parentGoal?.title || ""
        });
      } else if (type === "task") {
        openTaskModal("edit", {
          task: item,
          subgoalTitle: subgoal?.title || "",
          parentGoalTitle: goal?.title || ""
        });
      }
    });
    
    list.appendChild(card);
  });
  
  container.appendChild(list);
}

// --- Recently Updated ---

function getRecentlyUpdatedItems() {
  const updates = [];
  
  // Collect all items with their update timestamps
  const allGoals = [...goals.professional, ...goals.personal];
  
  allGoals.forEach(goal => {
    const timestamp = goal.updatedAt || goal.createdAt;
    if (timestamp) {
      updates.push({
        type: "goal",
        item: goal,
        timestamp: timestamp,
        action: goal.updatedAt ? "updated" : "created"
      });
    }
    
    // Get subgoals for this goal
    const subgoals = subgoalsByGoal[goal.id] || [];
    subgoals.forEach(subgoal => {
      const sgTimestamp = subgoal.updatedAt || subgoal.createdAt;
      if (sgTimestamp) {
        updates.push({
          type: "subgoal",
          item: subgoal,
          parentGoal: goal,
          timestamp: sgTimestamp,
          action: subgoal.updatedAt ? "updated" : "created"
        });
      }
      
      // Get tasks for this subgoal
      const tasks = tasksBySubgoal[subgoal.id] || [];
      tasks.forEach(task => {
        const taskTimestamp = task.updatedAt || task.createdAt;
        if (taskTimestamp) {
          updates.push({
            type: "task",
            item: task,
            parentSubgoal: subgoal,
            parentGoal: goal,
            timestamp: taskTimestamp,
            action: task.updatedAt ? "updated" : "created"
          });
        }
      });
    });
  });
  
  // Sort by timestamp descending (most recent first)
  updates.sort((a, b) => {
    const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : a.timestamp;
    const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : b.timestamp;
    return bTime - aTime;
  });
  
  // Return top 5
  return updates.slice(0, 5);
}

function getTimeAgo(timestamp) {
  if (!timestamp) return "recently";
  
  const now = new Date();
  const then = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  const months = Math.floor(diffDays / 30);
  return `${months} month${months !== 1 ? 's' : ''} ago`;
}

function getUpdateDescription(update) {
  const { type, item, action } = update;
  
  // Check if item was marked done
  if (type === "task" && item.status === "done" && action === "updated") {
    return `Task "<strong>${item.title}</strong>" marked done`;
  }
  
  if (type === "subgoal" && item.status === "done" && action === "updated") {
    return `Sub-goal "<strong>${item.title}</strong>" completed`;
  }
  
  if (type === "goal" && item.status === "done" && action === "updated") {
    return `Goal "<strong>${item.title}</strong>" completed`;
  }
  
  // Default descriptions
  if (action === "created") {
    if (type === "task") return `Added task "<strong>${item.title}</strong>"`;
    if (type === "subgoal") return `Added sub-goal "<strong>${item.title}</strong>"`;
    if (type === "goal") return `Created goal "<strong>${item.title}</strong>"`;
  }
  
  if (action === "updated") {
    if (type === "task") return `Task "<strong>${item.title}</strong>" updated`;
    if (type === "subgoal") return `Sub-goal "<strong>${item.title}</strong>" updated`;
    if (type === "goal") return `Goal "<strong>${item.title}</strong>" updated`;
  }
  
  return `${type.charAt(0).toUpperCase() + type.slice(1)} updated`;
}

function getUpdateIcon(update) {
  const { type, item, action } = update;
  
  // Status-based icons
  if (item.status === "done") return "✓";
  if (action === "created") return "➕";
  
  // Type-based icons
  if (type === "goal") return "🎯";
  if (type === "subgoal") return "📋";
  if (type === "task") return "✏️";
  
  return "🔧";
}

function renderRecentlyUpdated() {
  const container = document.getElementById("recentlyUpdatedContent");
  if (!container) return;
  
  container.innerHTML = "";
  
  const updates = getRecentlyUpdatedItems();
  
  if (updates.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "recently-updated-empty";
    placeholder.textContent = "No recent activity yet.";
    container.appendChild(placeholder);
    return;
  }
  
  const list = document.createElement("div");
  list.className = "recently-updated-list";
  
  updates.forEach(update => {
    const item = document.createElement("div");
    item.className = "recently-updated-item";
    
    // Icon
    const icon = document.createElement("div");
    icon.className = "recently-updated-icon";
    icon.textContent = getUpdateIcon(update);
    
    // Content
    const content = document.createElement("div");
    content.className = "recently-updated-content";
    
    const text = document.createElement("div");
    text.className = "recently-updated-text";
    text.innerHTML = getUpdateDescription(update);
    
    const meta = document.createElement("div");
    meta.className = "recently-updated-meta";
    
    const typeBadge = document.createElement("span");
    typeBadge.className = `recently-updated-type type-${update.type}`;
    typeBadge.textContent = update.type.charAt(0).toUpperCase() + update.type.slice(1);
    
    const timestamp = document.createElement("span");
    timestamp.className = "recently-updated-timestamp";
    timestamp.textContent = getTimeAgo(update.timestamp);
    
    meta.appendChild(typeBadge);
    meta.appendChild(timestamp);
    
    content.appendChild(text);
    content.appendChild(meta);
    
    item.appendChild(icon);
    item.appendChild(content);
    
    // Click handler
    item.addEventListener("click", () => {
      if (!auth.currentUser) {
        alert("Please sign in to view items.");
        return;
      }
      
      if (update.type === "goal") {
        openGoalModal("edit", update.item);
      } else if (update.type === "subgoal") {
        openSubgoalModal("edit", {
          subgoal: update.item,
          parentGoalTitle: update.parentGoal?.title || ""
        });
      } else if (update.type === "task") {
        openTaskModal("edit", {
          task: update.item,
          subgoalTitle: update.parentSubgoal?.title || "",
          parentGoalTitle: update.parentGoal?.title || ""
        });
      }
    });
    
    list.appendChild(item);
  });
  
  container.appendChild(list);
}

// --- Nav ---

function setupNav() {
  const buttons = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll(".section");

  // Restore last active section from localStorage (defaults to 'dashboard')
  const savedSection = localStorage.getItem("pdp-active-section") || "dashboard";
  const initialBtn = Array.from(buttons).find(b => b.dataset.section === savedSection);
  const initialSection = Array.from(sections).find(sec => sec.id === savedSection);

  if (initialBtn && initialSection) {
    buttons.forEach(b => b.classList.toggle("active", b === initialBtn));
    sections.forEach(sec => sec.classList.toggle("visible", sec === initialSection));
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.section;

      buttons.forEach(b => b.classList.toggle("active", b === btn));
      sections.forEach(sec => {
        sec.classList.toggle("visible", sec.id === target);
      });

      // Persist active section for next visit
      if (target) {
        localStorage.setItem("pdp-active-section", target);
      }
    });
  });
}

// --- Auth UI ---

function setupAuthUI() {
  // New auth elements
  const btnSignIn = document.getElementById("btnSignIn");
  const signInBackdrop = document.getElementById("signInModalBackdrop");
  const btnGoogleSignIn = document.getElementById("btnGoogleSignIn");
  const btnEmailSignIn = document.getElementById("btnEmailSignIn");
  const btnCancelSignIn = document.getElementById("btnCancelSignIn");
  
  const userAvatarWrapper = document.getElementById("userAvatarWrapper");
  const btnUserAvatar = document.getElementById("btnUserAvatar");
  const userDropdown = document.getElementById("userDropdown");
  const userInitial = document.getElementById("userInitial");
  const userDropdownEmail = document.getElementById("userDropdownEmail");
  const btnManageAccountDropdown = document.getElementById("btnManageAccountDropdown");
  const btnSignOutDropdown = document.getElementById("btnSignOutDropdown");
  const headerRight = document.querySelector(".header-right");
  const mobileControlsToggle = document.getElementById("btnMobileControls");

  // Email auth modal
  const emailBackdrop = document.getElementById("emailAuthBackdrop");
  const emailForm = document.getElementById("emailAuthForm");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const confirmPasswordGroup = document.getElementById("passwordConfirmGroup");
  const confirmPasswordInput = document.getElementById("authPasswordConfirm");
  const nameFieldsGroup = document.getElementById("nameFieldsGroup");
  const lastNameFieldGroup = document.getElementById("lastNameFieldGroup");
  const firstNameInput = document.getElementById("authFirstName");
  const lastNameInput = document.getElementById("authLastName");
  const forgotPasswordBtn = document.getElementById("btnForgotPassword");
  const forgotPasswordGroup = document.getElementById("forgotPasswordGroup");
  const emailAuthTitle = document.getElementById("emailAuthTitle");
  const emailAuthModeLabel = document.getElementById("emailAuthModeLabel");
  const btnSubmitEmail = document.getElementById("btnSubmitEmailAuth");
  const btnCloseEmailAuth = document.getElementById("btnCloseEmailAuth");
  const btnToggleAuthMode = document.getElementById("btnToggleAuthMode");

  // Account management modal
  const accountBackdrop = document.getElementById("accountManageBackdrop");
  const btnCloseAccount = document.getElementById("btnCloseAccountManage");
  const btnCloseAccountFooter = document.getElementById("btnCloseAccountManageFooter");
  const btnDeleteAccount = document.getElementById("btnDeleteAccount");
  const accountManageError = document.getElementById("accountManageError");
  const accountFirstNameInput = document.getElementById("accountFirstName");
  const accountLastNameInput = document.getElementById("accountLastName");
  const btnUpdateProfile = document.getElementById("btnUpdateProfile");

  // Password change fields
  const btnChangePassword = document.getElementById("btnChangePassword");
  const currentPasswordInput = document.getElementById("currentPassword");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmNewPasswordInput = document.getElementById("confirmNewPassword");

  let emailAuthMode = "signin"; // "signin" or "signup"
  const mobileBreakpoint = window.matchMedia("(max-width: 768px)");

  function setUserDropdownVisibility(shouldShow) {
    if (!userDropdown) return;
    userDropdown.classList.toggle("open", shouldShow);
    userDropdown.classList.toggle("hidden", !shouldShow);
    if (btnUserAvatar) {
      btnUserAvatar.setAttribute("aria-expanded", shouldShow.toString());
    }
  }

  function setMobileControlsVisibility(shouldShow) {
    if (!headerRight || !mobileControlsToggle) return;
    headerRight.classList.toggle("mobile-controls-open", shouldShow);
    mobileControlsToggle.setAttribute("aria-expanded", shouldShow.toString());
  }

  mobileBreakpoint?.addEventListener("change", (e) => {
    if (!e.matches) {
      setMobileControlsVisibility(false);
    }
  });

  // --- Sign In Modal ---
  
  // Open sign-in modal
  if (btnSignIn) {
    btnSignIn.addEventListener("click", () => {
      signInBackdrop.classList.remove("hidden");
    });
  }

  // Close sign-in modal
  if (btnCancelSignIn) {
    btnCancelSignIn.addEventListener("click", () => {
      signInBackdrop.classList.add("hidden");
    });
  }
  signInBackdrop?.addEventListener("click", (e) => {
    if (e.target === signInBackdrop) signInBackdrop.classList.add("hidden");
  });

  // Google Sign In from modal
  if (btnGoogleSignIn) {
    btnGoogleSignIn.addEventListener("click", async () => {
      const provider = new GoogleAuthProvider();
      try {
        const result = await signInWithPopup(auth, provider);
        signInBackdrop.classList.add("hidden");
        // getUserDoc will create user doc if it doesn't exist
        await getUserDoc(result.user.uid);
      } catch (err) {
        alert(humanizeFirebaseAuthError(err));
      }
    });
  }

  // Email Sign In button (opens email auth modal)
  if (btnEmailSignIn) {
    btnEmailSignIn.addEventListener("click", () => {
      signInBackdrop.classList.add("hidden");
      emailBackdrop.classList.remove("hidden");
      emailInput.value = "";
      passwordInput.value = "";
      confirmPasswordInput.value = "";
      firstNameInput.value = "";
      lastNameInput.value = "";
      emailAuthMode = "signin";
      updateEmailAuthUI();
      emailInput.focus();
    });
  }

  // --- Email Auth Modal ---

  // Close email modal
  if (btnCloseEmailAuth) {
    btnCloseEmailAuth.addEventListener("click", () => {
      emailBackdrop.classList.add("hidden");
    });
  }
  emailBackdrop?.addEventListener("click", (e) => {
    if (e.target === emailBackdrop) emailBackdrop.classList.add("hidden");
  });

  // Mode toggle
  if (btnToggleAuthMode) {
    btnToggleAuthMode.addEventListener("click", () => {
      emailAuthMode = emailAuthMode === "signin" ? "signup" : "signin";
      updateEmailAuthUI();
    });
  }

  function updateEmailAuthUI() {
    if (emailAuthMode === "signup") {
      emailAuthTitle.textContent = "Sign Up";
      emailAuthModeLabel.textContent = "Create an account";
      btnSubmitEmail.textContent = "Sign Up";
      confirmPasswordGroup.classList.remove("hidden");
      nameFieldsGroup.classList.remove("hidden");
      lastNameFieldGroup.classList.remove("hidden");
      if (forgotPasswordGroup) forgotPasswordGroup.classList.add("hidden");
      btnToggleAuthMode.textContent = "Have an account?";
      btnToggleAuthMode.dataset.mode = "signup";
    } else {
      emailAuthTitle.textContent = "Sign In";
      emailAuthModeLabel.textContent = "Sign in with email & password";
      btnSubmitEmail.textContent = "Continue";
      confirmPasswordGroup.classList.add("hidden");
      nameFieldsGroup.classList.add("hidden");
      lastNameFieldGroup.classList.add("hidden");
      if (forgotPasswordGroup) forgotPasswordGroup.classList.remove("hidden");
      btnToggleAuthMode.textContent = "Need an account?";
      btnToggleAuthMode.dataset.mode = "signin";
    }
  }

  // Forgot password
  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) {
        alert("Please enter your email address first.");
        return;
      }
      sendPasswordResetEmail(auth, email)
        .then(() => {
          alert("Password reset email sent. Check your inbox.");
          emailBackdrop.classList.add("hidden");
        })
        .catch((err) => {
          alert(humanizeFirebaseAuthError(err));
        });
    });
  }

  // Ensure initial state is Sign In when page loads
  emailAuthMode = "signin";
  updateEmailAuthUI();

  // Email form submit
  if (emailForm) {
    emailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) return;

      if (emailAuthMode === "signup") {
        const confirmPassword = confirmPasswordInput.value;
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        
        if (password !== confirmPassword) {
          alert("Passwords do not match.");
          return;
        }
        if (!firstName || !lastName) {
          alert("Please enter your first and last name.");
          return;
        }
        
        // Sign up
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, password);
          
          // Update displayName
          await updateProfile(credential.user, { 
            displayName: `${firstName} ${lastName}` 
          });
          
          // Create user document in Firestore
          await setDoc(doc(db, "users", credential.user.uid), {
            firstName,
            lastName,
            email,
            displayName: `${firstName} ${lastName}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          alert("Account created successfully!");
          emailBackdrop.classList.add("hidden");
        } catch (err) {
          alert(humanizeFirebaseAuthError(err));
        }
      } else {
        // Sign in
        try {
          await signInWithEmailAndPassword(auth, email, password);
          emailBackdrop.classList.add("hidden");
        } catch (err) {
          alert(humanizeFirebaseAuthError(err));
        }
      }
    });
  }

  // --- Mobile Controls Toggle ---
  if (mobileControlsToggle && headerRight) {
    mobileControlsToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = headerRight.classList.contains("mobile-controls-open");
      setMobileControlsVisibility(!isOpen);
    });
  }

  // --- Avatar Dropdown ---

  // Toggle dropdown
  if (btnUserAvatar) {
    btnUserAvatar.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = userDropdown.classList.contains("open");
      setUserDropdownVisibility(!isOpen);
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const clickedInsideAvatar = userAvatarWrapper?.contains(e.target);
    if (userDropdown && !clickedInsideAvatar) {
      setUserDropdownVisibility(false);
    }
    if (headerRight && !headerRight.contains(e.target)) {
      setMobileControlsVisibility(false);
    }
  });

  // Manage Account from dropdown
  if (btnManageAccountDropdown) {
    btnManageAccountDropdown.addEventListener("click", async () => {
      setUserDropdownVisibility(false);
      setMobileControlsVisibility(false);
      accountBackdrop.classList.remove("hidden");
      accountManageError.textContent = "";
      currentPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmNewPasswordInput.value = "";
      
      // Load current profile data
      if (currentUserUid) {
        const userDoc = await getUserDoc(currentUserUid);
        if (userDoc) {
          accountFirstNameInput.value = userDoc.firstName || "";
          accountLastNameInput.value = userDoc.lastName || "";
        }
      }
    });
  }

  // Sign Out from dropdown
  if (btnSignOutDropdown) {
    btnSignOutDropdown.addEventListener("click", async () => {
      setUserDropdownVisibility(false);
      setMobileControlsVisibility(false);
      try {
        await signOut(auth);
      } catch (err) {
        alert("Error signing out: " + err.message);
      }
    });
  }

  // --- Account Management Modal ---

  // Close account modal
  if (btnCloseAccount) {
    btnCloseAccount.addEventListener("click", () => {
      accountBackdrop.classList.add("hidden");
      accountManageError.textContent = "";
    });
  }
  if (btnCloseAccountFooter) {
    btnCloseAccountFooter.addEventListener("click", () => {
      accountBackdrop.classList.add("hidden");
      accountManageError.textContent = "";
    });
  }
  accountBackdrop?.addEventListener("click", (e) => {
    if (e.target === accountBackdrop) {
      accountBackdrop.classList.add("hidden");
      accountManageError.textContent = "";
    }
  });

  // Update profile (firstName, lastName)
  if (btnUpdateProfile) {
    btnUpdateProfile.addEventListener("click", async () => {
      accountManageError.textContent = "";
      const user = auth.currentUser;
      if (!user) {
        accountManageError.textContent = "No user signed in.";
        return;
      }
      
      const firstName = accountFirstNameInput.value.trim();
      const lastName = accountLastNameInput.value.trim();
      
      if (!firstName || !lastName) {
        accountManageError.textContent = "First and last name are required.";
        return;
      }
      
      try {
        // Update Firestore user document
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`,
          updatedAt: serverTimestamp()
        });
        
        // Update Firebase Auth displayName
        await updateProfile(user, {
          displayName: `${firstName} ${lastName}`
        });
        
        // Update avatar initial
        if (userInitial) {
          userInitial.textContent = firstName[0].toUpperCase();
        }
        
        accountManageError.style.color = "var(--accent)";
        accountManageError.textContent = "Profile updated successfully.";
        setTimeout(() => {
          accountManageError.style.color = "var(--accent-alt)";
          accountManageError.textContent = "";
        }, 3000);
      } catch (err) {
        console.error("Error updating profile:", err);
        accountManageError.textContent = "Failed to update profile: " + err.message;
      }
    });
  }

  // Change password
  if (btnChangePassword) {
    btnChangePassword.addEventListener("click", async () => {
      accountManageError.textContent = "";
      const user = auth.currentUser;
      if (!user || !user.email) {
        accountManageError.textContent = "No user signed in.";
        return;
      }
      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmNewPassword = confirmNewPasswordInput.value;
      
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        accountManageError.textContent = "All password fields required.";
        return;
      }
      if (newPassword !== confirmNewPassword) {
        accountManageError.textContent = "New passwords do not match.";
        return;
      }
      if (newPassword.length < 6) {
        accountManageError.textContent = "Password must be at least 6 characters.";
        return;
      }

      try {
        // Reauthenticate
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        // Update password
        await updatePassword(user, newPassword);
        accountManageError.style.color = "var(--accent)";
        accountManageError.textContent = "Password updated.";
        setTimeout(() => { 
          accountManageError.style.color = "var(--accent-alt)";
          accountManageError.textContent = "";
        }, 3000);
        currentPasswordInput.value = "";
        newPasswordInput.value = "";
        confirmNewPasswordInput.value = "";
      } catch (err) {
        accountManageError.textContent = humanizeFirebaseAuthError(err);
      }
    });
  }

  // Delete account
  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener("click", async () => {
      accountManageError.textContent = "";
      const user = auth.currentUser;
      if (!user) return;
      const confirmText = prompt(
        'Are you sure you want to delete your account? This cannot be undone. Type "DELETE" to confirm.'
      );
      if (confirmText === "DELETE") {
        try {
          await deleteUser(user);
          alert("Account deleted successfully.");
          accountBackdrop.classList.add("hidden");
        } catch (err) {
          accountManageError.textContent = humanizeFirebaseAuthError(err);
        }
      }
    });
  }

  // --- Auth State Listener ---

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUserUid = user.uid;
      
      // Fetch user doc from Firestore
      const userDoc = await getUserDoc(user.uid);
      let initial = "";
      
      if (userDoc && userDoc.firstName) {
        initial = userDoc.firstName[0].toUpperCase();
      } else {
        // Fallback to email first character
        initial = user.email ? user.email[0].toUpperCase() : "U";
      }
      
      // Update avatar UI
      if (userInitial) userInitial.textContent = initial;
      if (userDropdownEmail) userDropdownEmail.textContent = user.email || "";
      
      // Toggle visibility
      if (btnSignIn) btnSignIn.classList.add("hidden");
      if (userAvatarWrapper) userAvatarWrapper.classList.remove("hidden");
      setMobileControlsVisibility(false);

      await loadGoalsForUser(user.uid);
      updateStats();
    } else {
      currentUserUid = null;
      
      // Toggle visibility
      if (btnSignIn) btnSignIn.classList.remove("hidden");
      if (userAvatarWrapper) userAvatarWrapper.classList.add("hidden");
      setUserDropdownVisibility(false);
      setMobileControlsVisibility(false);

      goals.professional = [];
      goals.personal = [];
      subgoalsByGoal = {};
      tasksBySubgoal = {};
      renderGoals();
      updateStats();
    }
  });

  // Escape key handlers for modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!signInBackdrop.classList.contains("hidden")) {
        signInBackdrop.classList.add("hidden");
      }
      if (!emailBackdrop.classList.contains("hidden")) {
        emailBackdrop.classList.add("hidden");
      }
      if (!accountBackdrop.classList.contains("hidden")) {
        accountBackdrop.classList.add("hidden");
      }
      if (userDropdown && userDropdown.classList.contains("open")) {
        setUserDropdownVisibility(false);
      }
      setMobileControlsVisibility(false);
    }
  });
}

// Helper to get user doc from Firestore
async function getUserDoc(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const currentUser = auth.currentUser;
      const email = currentUser?.email || null;
      const displayName = currentUser?.displayName || null;

      await setDoc(userRef, {
        email,
        displayName,
        firstName: null,
        lastName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const newSnap = await getDoc(userRef);
      return newSnap.data();
    }

    return snap.data();
  } catch (err) {
    console.error("Error fetching user doc:", err);
    return null;
  }
}

function humanizeFirebaseAuthError(err) {
  const code = err?.code || "";
  switch (code) {
    case "auth/email-already-in-use": return "Email already in use.";
    case "auth/invalid-email": return "Invalid email address.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/wrong-password": return "Incorrect password.";
    case "auth/user-not-found": return "No account found for that email.";
    case "auth/too-many-requests": return "Too many attempts. Try again later.";
    default: return err.message || "Authentication error.";
  }
}

// --- Init ---

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initPalette();
  setupThemeToggle();
  setupPaletteUI();
  setupQuoteBanner();
  setupNav();
  setupAuthUI();
  setupGoalModalUI();
  setupSubgoalModalUI();
  setupTaskModalUI();
  setupCalendarUI();
  renderCalendar();
});

// --- Deletion helpers ---

async function deleteGoalWithChildren(uid, sectionKey, goalId) {
  // Remove goal doc, then sub-goals and tasks under it
  try {
    // Find all subgoals belonging to this goal
    const subgoalsCol = collection(db, "subgoals");
    const subgoalsQuery = query(
      subgoalsCol,
      where("goalId", "==", goalId),
      where("ownerUid", "==", uid)
    );
    const subgoalsSnap = await getDocs(subgoalsQuery);
    
    // Delete each subgoal and its tasks
    for (const sgDoc of subgoalsSnap.docs) {
      await deleteSubgoalWithTasks(uid, goalId, sgDoc.id);
    }
    
    // Delete the goal itself
    const goalRef = doc(db, "goals", goalId);
    await deleteDoc(goalRef);
    
    // Update local state
    goals[sectionKey] = goals[sectionKey].filter(g => g.id !== goalId);
    delete subgoalsByGoal[goalId];
  } catch (err) {
    console.error("deleteGoalWithChildren failed", err);
    throw err;
  }
}

// --- Archive helpers ---

async function archiveGoal(uid, sectionKey, goalId) {
  try {
    const ref = doc(db, "goals", goalId);
    await updateDoc(ref, { archived: true, ownerUid: uid });
    const g = goals[sectionKey].find(g => g.id === goalId);
    if (g) g.archived = true;
  } catch (err) { console.error("archiveGoal failed", err); throw err; }
}

async function unarchiveGoal(uid, sectionKey, goalId) {
  try {
    const ref = doc(db, "goals", goalId);
    await updateDoc(ref, { archived: false, ownerUid: uid });
    const g = goals[sectionKey].find(g => g.id === goalId);
    if (g) g.archived = false;
  } catch (err) { console.error("unarchiveGoal failed", err); throw err; }
}

async function archiveSubgoal(uid, goalId, subgoalId) {
  try {
    const ref = doc(db, "subgoals", subgoalId);
    await updateDoc(ref, { archived: true, ownerUid: uid });
    const list = subgoalsByGoal[goalId] || [];
    const sg = list.find(s => s.id === subgoalId);
    if (sg) sg.archived = true;
  } catch (err) { console.error("archiveSubgoal failed", err); throw err; }
}

async function unarchiveSubgoal(uid, goalId, subgoalId) {
  try {
    const ref = doc(db, "subgoals", subgoalId);
    await updateDoc(ref, { archived: false, ownerUid: uid });
    const list = subgoalsByGoal[goalId] || [];
    const sg = list.find(s => s.id === subgoalId);
    if (sg) sg.archived = false;
  } catch (err) { console.error("unarchiveSubgoal failed", err); throw err; }
}

async function archiveTask(uid, goalId, subgoalId, taskId) {
  try {
    const ref = doc(db, "tasks", taskId);
    await updateDoc(ref, { archived: true, ownerUid: uid });
    const list = tasksBySubgoal[subgoalId] || [];
    const t = list.find(t => t.id === taskId);
    if (t) t.archived = true;
  } catch (err) { console.error("archiveTask failed", err); throw err; }
}

async function unarchiveTask(uid, goalId, subgoalId, taskId) {
  try {
    const ref = doc(db, "tasks", taskId);
    await updateDoc(ref, { archived: false, ownerUid: uid });
    const list = tasksBySubgoal[subgoalId] || [];
    const t = list.find(t => t.id === taskId);
    if (t) t.archived = false;
  } catch (err) { console.error("unarchiveTask failed", err); throw err; }
}

// (duplicateTask removed per request)

async function deleteSubgoalWithTasks(uid, goalId, subgoalId, sectionKeyOptional) {
  try {
    // Delete all tasks belonging to this subgoal
    const tasksCol = collection(db, "tasks");
    const tasksQuery = query(
      tasksCol, 
      where("subgoalId", "==", subgoalId),
      where("ownerUid", "==", uid)
    );
    const tasksSnap = await getDocs(tasksQuery);
    
    for (const taskDoc of tasksSnap.docs) {
      await deleteDoc(taskDoc.ref);
    }
    
    // Delete the subgoal itself
    const subRef = doc(db, "subgoals", subgoalId);
    await deleteDoc(subRef);
    
    // Update local state
    const list = subgoalsByGoal[goalId] || [];
    subgoalsByGoal[goalId] = list.filter(sg => sg.id !== subgoalId);
    delete tasksBySubgoal[subgoalId];
  } catch (err) {
    console.error("deleteSubgoalWithTasks failed", err);
    throw err;
  }
}

async function deleteTask(uid, goalId, subgoalId, taskId) {
  try {
    const taskRef = doc(db, "tasks", taskId);
    await deleteDoc(taskRef);
    const list = tasksBySubgoal[subgoalId] || [];
    tasksBySubgoal[subgoalId] = list.filter(t => t.id !== taskId);
  } catch (err) {
    console.error("deleteTask failed", err);
    throw err;
  }
}

function inferSectionKeyForGoal(goalId) {
  if (goals.professional.some(g => g.id === goalId)) return "professional";
  if (goals.personal.some(g => g.id === goalId)) return "personal";
  return "professional"; // fallback
}

// --- Quote Banner ---

function setupQuoteBanner() {
  const container = document.getElementById("quoteBanner");
  if (!container) return;

  // Build structure
  const textEl = document.createElement("span");
  textEl.className = "quote-text";

  const separatorEl = document.createElement("span");
  separatorEl.className = "quote-separator";
  separatorEl.textContent = "\u2022"; // middle dot

  const authorEl = document.createElement("span");
  authorEl.className = "quote-author";

  const actionsEl = document.createElement("div");
  actionsEl.className = "quote-actions";

  const refreshBtn = document.createElement("button");
  refreshBtn.className = "quote-refresh-btn";
  refreshBtn.type = "button";
  refreshBtn.innerHTML = "↻";
  refreshBtn.setAttribute("aria-label", "Get new quote");
  refreshBtn.setAttribute("title", "Get new quote");

  actionsEl.appendChild(refreshBtn);

  container.appendChild(textEl);
  container.appendChild(separatorEl);
  container.appendChild(authorEl);
  container.appendChild(actionsEl);

  const LS_KEY = "pdp-quote-banner";
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  function setQuote(quote, author) {
    textEl.textContent = `“${quote}”`;
    if (author) {
      separatorEl.style.display = "inline";
      authorEl.textContent = author;
    } else {
      separatorEl.style.display = "none";
      authorEl.textContent = "";
    }
  }

  async function fetchRandomQuote() {
    try {
      const resp = await fetch("quotes.json");
      const data = await resp.json();
      const quotes = data.quotes;
      
      if (!quotes || quotes.length === 0) {
        throw new Error("No quotes available");
      }
      
      // Pick a random quote from the array
      const randomIndex = Math.floor(Math.random() * quotes.length);
      const randomQuote = quotes[randomIndex];
      
      const quote = randomQuote.content || "Stay consistent and keep moving forward.";
      const author = randomQuote.author || "Unknown";

      setQuote(quote, author);
      localStorage.setItem(LS_KEY, JSON.stringify({ date: todayKey, quote, author }));
    } catch (e) {
      console.warn("Quote fetch failed, using fallback.", e);
      setQuote("Small steps lead to big change.", "Unknown");
    }
  }

  // Load cached quote if same day
  try {
    const cachedRaw = localStorage.getItem(LS_KEY);
    const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
    if (cached && cached.date === todayKey && cached.quote) {
      setQuote(cached.quote, cached.author);
    } else {
      // Fetch a fresh quote and cache it
      fetchRandomQuote();
    }
  } catch (_) {
    fetchRandomQuote();
  }

  refreshBtn.addEventListener("click", () => {
    // Force a fresh quote (does not change daily cache date)
    fetchRandomQuote();
  });
}

// Archived toggle setup
document.addEventListener("DOMContentLoaded", () => {
  const archivedToggle = document.getElementById("toggleShowArchived");
  if (archivedToggle) {
    archivedToggle.addEventListener("change", () => {
      showArchived = archivedToggle.checked;
      renderGoals();
      // Stats remain excluding archived, so we just re-render goals.
    });
  }
});