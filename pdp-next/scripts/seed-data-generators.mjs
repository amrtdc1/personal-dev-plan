import { randomUUID } from "crypto";

// Utility: Generate UUID
export function generateId() {
  return randomUUID();
}

// Utility: Get random item from array
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Utility: Get random items from array
function pickRandomItems(arr, min, max) {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Utility: Date utilities
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatISODate(date) {
  return date.toISOString().split("T")[0];
}

// ============================================================================
// GOAL GENERATOR
// ============================================================================

const GOAL_TITLES = {
  professional: [
    "Learn TypeScript Generics",
    "Complete System Design Course",
    "Lead quarterly planning session",
    "Refactor authentication module",
    "Document API endpoints",
    "Improve test coverage to 85%",
    "Mentor junior developer",
    "Implement caching strategy",
  ],
  personal: [
    "Exercise 4x per week",
    "Read 12 books this year",
    "Learn guitar basics",
    "Build personal website",
    "Travel to 3 new countries",
    "Improve sleep schedule",
    "Cook new recipes weekly",
    "Save for vacation fund",
  ],
};

const GOAL_DESCRIPTIONS = {
  professional: [
    "Deep dive into advanced TS patterns and their real-world applications",
    "Complete online course on system design and architecture",
    "Facilitate team alignment and goal-setting for next quarter",
    "Refactor legacy auth code to improve maintainability",
    "Write comprehensive API documentation for team reference",
    "Increase test coverage across all modules",
    "Support growth and learning for new team members",
    "Implement Redis caching for database queries",
  ],
  personal: [
    "Build consistent fitness routine for health",
    "Expand knowledge across diverse genres",
    "Pick up new musical skill",
    "Create online portfolio to showcase skills",
    "Experience new cultures and perspectives",
    "Establish better sleep hygiene",
    "Explore different cuisines and cooking techniques",
    "Build emergency fund and vacation savings",
  ],
};

export function generateGoals(options) {
  const { ownerUid, count = 28, withParents = true } = options;
  const goals = [];
  const parentIdsByTimeframe = new Map();
  const goalIdsByTimeframe = new Map();

  const timeframes = ["vision_5y", "annual", "quarterly", "monthly", "weekly"];
  const timeframeDistribution = {
    vision_5y: Math.ceil(count * 0.25),
    annual: Math.ceil(count * 0.28),
    quarterly: Math.ceil(count * 0.21),
    monthly: Math.ceil(count * 0.14),
    weekly: Math.ceil(count * 0.12),
  };

  // Initialize maps
  timeframes.forEach((tf) => {
    goalIdsByTimeframe.set(tf, []);
    parentIdsByTimeframe.set(tf, []);
  });

  // Generate goals by timeframe
  timeframes.forEach((timeframe) => {
    const countForTimeframe = timeframeDistribution[timeframe];

    for (let i = 0; i < countForTimeframe; i++) {
      const type = pickRandom(["professional", "personal"]);
      const status = pickRandom([
        "not_started",
        "not_started",
        "in_progress",
        "in_progress",
        "in_progress",
        "done",
      ]);

      const availableParents = parentIdsByTimeframe.get(timeframe) || [];
      const parentGoalId =
        withParents && availableParents.length > 0 && Math.random() > 0.7
          ? pickRandom(availableParents)
          : null;

      // Calculate dates based on timeframe
      let projectedStartDate = null;
      let projectedEndDate = null;

      switch (timeframe) {
        case "vision_5y":
          projectedStartDate = formatISODate(new Date());
          projectedEndDate = formatISODate(addDays(new Date(), 365 * 5));
          break;
        case "annual":
          projectedStartDate = formatISODate(addDays(new Date(), -90));
          projectedEndDate = formatISODate(addDays(new Date(), 275));
          break;
        case "quarterly":
          projectedStartDate = formatISODate(addDays(new Date(), -45));
          projectedEndDate = formatISODate(addDays(new Date(), 85));
          break;
        case "monthly":
          projectedStartDate = formatISODate(addDays(new Date(), -15));
          projectedEndDate = formatISODate(addDays(new Date(), 15));
          break;
        case "weekly":
          projectedStartDate = formatISODate(addDays(new Date(), -3));
          projectedEndDate = formatISODate(addDays(new Date(), 4));
          break;
      }

      const goal = {
        id: generateId(),
        ownerUid,
        type,
        parentGoalId: parentGoalId || undefined,
        timeframeLevel: timeframe,
        title: pickRandom(GOAL_TITLES[type]),
        description: pickRandom(GOAL_DESCRIPTIONS[type]),
        timeframe: timeframe.replace("_", " "),
        projectedStartDate,
        projectedEndDate,
        actualStartDate:
          status !== "not_started"
            ? formatISODate(addDays(new Date(), -30))
            : null,
        actualEndDate: status === "done" ? formatISODate(new Date()) : null,
        status,
        percentComplete:
          status === "done" ? 100 : status === "in_progress" ? 45 : 0,
        isFocus: Math.random() > 0.7,
        themeColor: pickRandom([
          "#ec4899",
          "#3b82f6",
          "#10b981",
          "#f59e0b",
          "#ef4444",
        ]),
        orderIndex: i,
        createdAt: formatISODate(addDays(new Date(), -60)),
        updatedAt: formatISODate(addDays(new Date(), -5)),
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      };

      goals.push(goal);
      goalIdsByTimeframe.get(timeframe)?.push(goal.id);

      // Add to parent pool for potential child relationships
      if (!parentGoalId && timeframe !== "weekly") {
        parentIdsByTimeframe.get(timeframe)?.push(goal.id);
      }
    }
  });

  // Build parent ID map for task linking
  const parentIdMap = new Map();
  goalIdsByTimeframe.forEach((ids, timeframe) => {
    ids.forEach((id) => {
      parentIdMap.set(id, timeframe);
    });
  });

  return [goals, parentIdMap];
}

// ============================================================================
// TASK GENERATOR
// ============================================================================

const TASK_TITLES = [
  "Review pull request",
  "Write unit tests",
  "Update documentation",
  "Fix bug in checkout flow",
  "Prepare presentation",
  "Schedule team meeting",
  "Deploy to staging",
  "Code review session",
  "Workout session",
  "Grocery shopping",
  "Prepare breakfast",
  "Weekly planning",
  "Respond to emails",
  "Update project status",
];

export function generateTasks(options) {
  const { ownerUid, goalIds, count = 55, unplannedRatio = 0.15 } = options;
  const tasks = [];

  const unplannedCount = Math.ceil(count * unplannedRatio);
  const plannedCount = count - unplannedCount;

  // Generate planned tasks (linked to goals)
  for (let i = 0; i < plannedCount; i++) {
    const status = pickRandom(["not_started", "not_started", "in_progress", "done"]);
    const dueDate = formatISODate(
      addDays(new Date(), Math.floor(Math.random() * 30) - 5)
    );
    const goalId = pickRandom(goalIds);

    const task = {
      id: generateId(),
      ownerUid,
      parentGoalId: goalId,
      title: pickRandom(TASK_TITLES),
      notes: Math.random() > 0.6 ? "Additional notes for this task" : "",
      dueDate,
      unplanned: false,
      status,
      percentComplete:
        status === "done" ? 100 : status === "in_progress" ? 60 : 0,
      orderIndex: i,
      createdAt: formatISODate(addDays(new Date(), -45)),
      updatedAt: formatISODate(addDays(new Date(), -2)),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    };
    tasks.push(task);
  }

  // Generate unplanned tasks (not linked to goals)
  for (let i = 0; i < unplannedCount; i++) {
    const status = pickRandom(["not_started", "in_progress", "done"]);
    const dueDate = formatISODate(
      addDays(new Date(), Math.floor(Math.random() * 21) - 3)
    );
    const task = {
      id: generateId(),
      ownerUid,
      parentGoalId: null,
      title: `Unplanned: ${pickRandom(TASK_TITLES)}`,
      notes: "This is an unplanned task",
      dueDate,
      unplanned: true,
      status,
      percentComplete:
        status === "done" ? 100 : status === "in_progress" ? 40 : 0,
      orderIndex: plannedCount + i,
      createdAt: formatISODate(addDays(new Date(), -30)),
      updatedAt: formatISODate(addDays(new Date(), -1)),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    };
    tasks.push(task);
  }

  return tasks;
}

// ============================================================================
// HABIT GENERATOR
// ============================================================================

const HABIT_TITLES = [
  "Morning meditation",
  "Exercise",
  "Read",
  "Code review",
  "Journaling",
  "Drink water",
  "Stretch",
  "Review goals",
  "Learn something new",
  "Network",
];

export function generateHabits(options) {
  const { ownerUid, count = 9 } = options;
  const habits = [];

  for (let i = 0; i < count; i++) {
    const cadence = pickRandom(["daily", "weekly"]);
    const status = pickRandom(["active", "active", "paused"]);

    const habit = {
      id: generateId(),
      ownerUid,
      title: pickRandom(HABIT_TITLES),
      cadence,
      targetCount: cadence === "daily" ? 1 : Math.floor(Math.random() * 3) + 3,
      status,
      createdAt: formatISODate(addDays(new Date(), -90)),
      updatedAt: formatISODate(addDays(new Date(), -1)),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    };

    habits.push(habit);
  }

  return habits;
}

// ============================================================================
// HABIT CHECKIN GENERATOR
// ============================================================================

export function generateHabitCheckins(options) {
  const { ownerUid, habits, checkinsPerHabitMin = 15, checkinsPerHabitMax = 45 } = options;
  const checkins = [];

  habits.forEach((habit) => {
    // Only create checkins for ~70% of habits for variety
    if (Math.random() > 0.3) {
      const count = Math.floor(
        Math.random() * (checkinsPerHabitMax - checkinsPerHabitMin + 1) +
          checkinsPerHabitMin
      );

      for (let i = 0; i < count; i++) {
        const daysAgo = Math.floor(Math.random() * 90);
        const checkin = {
          id: generateId(),
          ownerUid,
          habitId: habit.id,
          checkInDate: formatISODate(addDays(new Date(), -daysAgo)),
          notes: Math.random() > 0.7 ? "Great session!" : null,
          createdAt: formatISODate(addDays(new Date(), -daysAgo)),
          updatedAt: formatISODate(addDays(new Date(), -daysAgo)),
        };
        checkins.push(checkin);
      }
    }
  });

  return checkins;
}

// ============================================================================
// JOURNAL ENTRY GENERATOR
// ============================================================================

const JOURNAL_TITLES = {
  "daily-closeout": [
    "Daily Closeout - Day well spent",
    "End of day reflection",
    "Today's summary",
    "Daily check-in",
  ],
  "ad-hoc": [
    "Breakthrough moment",
    "Lessons learned",
    "Ideas for next quarter",
    "Team dynamics reflection",
    "Personal growth notes",
    "Victory log",
    "Challenge overview",
  ],
};

const JOURNAL_CONTENT = {
  "daily-closeout": [
    "Completed several key tasks today. Made progress on the main objective. Looking forward to continuing tomorrow.",
    "Good day overall. Accomplished what I set out to do. Some challenges but overall positive.",
    "Productive day. Team collaboration was strong. Ready for tomorrow.",
    "Solid day of progress. Handled some unexpected issues well.",
  ],
  "ad-hoc": [
    "Had an interesting conversation that sparked new ideas for our approach.",
    "Realized an important lesson about how to better structure my work.",
    "Excited about the progress we're making on the new initiative.",
    "Reflecting on how this quarter has shaped my thinking.",
    "Documented some key insights from today's discussions.",
    "Feeling energized after the team sync. Great energy in the room.",
    "Navigated a complex situation and found a good resolution.",
  ],
};

const MOODS = ["happy", "neutral", "anxious", "reflective", "energized"];

const JOURNAL_TAGS = [
  "#growth",
  "#reflection",
  "#planning",
  "#wins",
  "#learning",
  "#challenge",
  "#team",
  "#breakthrough",
];

export function generateJournalEntries(options) {
  const {
    ownerUid,
    goalIds,
    count = 58,
    dailyCloseoutRatio = 0.4,
  } = options;
  const entries = [];

  const dailyCount = Math.ceil(count * dailyCloseoutRatio);
  const adHocCount = count - dailyCount;

  // Generate daily closeout entries
  for (let i = 0; i < dailyCount; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const entry = {
      id: generateId(),
      ownerUid,
      title: pickRandom(JOURNAL_TITLES["daily-closeout"]),
      content: pickRandom(JOURNAL_CONTENT["daily-closeout"]),
      mood: pickRandom(MOODS),
      tags: pickRandomItems(JOURNAL_TAGS, 1, 3),
      relatedGoalId: Math.random() > 0.7 ? pickRandom(goalIds) : null,
      createdAt: formatISODate(addDays(new Date(), -daysAgo)),
      updatedAt: formatISODate(addDays(new Date(), -daysAgo)),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    };
    entries.push(entry);
  }

  // Generate ad-hoc entries
  for (let i = 0; i < adHocCount; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const entry = {
      id: generateId(),
      ownerUid,
      title: pickRandom(JOURNAL_TITLES["ad-hoc"]),
      content: pickRandom(JOURNAL_CONTENT["ad-hoc"]),
      mood: pickRandom(MOODS),
      tags: pickRandomItems(JOURNAL_TAGS, 2, 4),
      relatedGoalId: Math.random() > 0.75 ? pickRandom(goalIds) : null,
      createdAt: formatISODate(addDays(new Date(), -daysAgo)),
      updatedAt: formatISODate(addDays(new Date(), -daysAgo)),
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      purgeAt: null,
    };
    entries.push(entry);
  }

  return entries;
}

// ============================================================================
// USER PROFILE GENERATOR
// ============================================================================

const PALETTES = ["ocean", "sunset", "forest", "royal", "candy", "dusk"];

export function generateUserProfile(options) {
  const {
    uid,
    email = `user-${uid.slice(0, 8)}@example.com`,
    displayName = "Test User",
  } = options;

  return {
    uid,
    email,
    firstName: "Test",
    lastName: "User",
    displayName,
    themeMode: "palette",
    theme: pickRandom(["light", "dark"]),
    palette: pickRandom(PALETTES),
    collegeTeamId: undefined,
    collegeTeamName: undefined,
    collegeLogoUrl: undefined,
    timezone: "America/Chicago",
    retentionDays: 60,
    createdAt: formatISODate(addDays(new Date(), -120)),
    updatedAt: formatISODate(addDays(new Date(), -1)),
  };
}

// ============================================================================
// BULK DATA STRUCTURE
// ============================================================================

export function generateDataset(options) {
  const {
    userId,
    displayName,
    goalCount = 28,
    taskCount = 55,
    habitCount = 9,
    journalCount = 58,
  } = options;

  // Generate user profile
  const userProfile = generateUserProfile({
    uid: userId,
    displayName,
  });

  // Generate goals
  const [goals] = generateGoals({
    ownerUid: userId,
    count: goalCount,
    withParents: true,
  });

  const goalIds = goals.map((g) => g.id);

  // Generate tasks
  const tasks = generateTasks({
    ownerUid: userId,
    goalIds,
    count: taskCount,
  });

  // Generate habits
  const habits = generateHabits({
    ownerUid: userId,
    count: habitCount,
  });

  // Generate habit checkins
  const habitCheckins = generateHabitCheckins({
    ownerUid: userId,
    habits,
  });

  // Generate journal entries
  const journalEntries = generateJournalEntries({
    ownerUid: userId,
    goalIds,
    count: journalCount,
  });

  return {
    userId,
    userProfile,
    goals,
    tasks,
    habits,
    habitCheckins,
    journalEntries,
  };
}

// ============================================================================
// CLEAR USER DATA
// ============================================================================

export async function clearUserData(options) {
  const { userId, admin, verbose = false } = options;
  const CLEAR_BATCH_SIZE = 50;
  const CLEAR_BATCH_MAX_RETRIES = 2;
  const QUERY_PAGE_SIZE = 500;
  const MAX_QUERY_DELETE_PASSES = 200;

  if (!userId) {
    throw new Error("userId is required");
  }

  async function runDeleteBatches(entityLabel, operations) {
    if (!operations.length) {
      return 0;
    }

    const totalBatches = Math.ceil(operations.length / CLEAR_BATCH_SIZE);
    let deletedCount = 0;

    for (let i = 0; i < operations.length; i += CLEAR_BATCH_SIZE) {
      const batch = operations.slice(i, i + CLEAR_BATCH_SIZE);
      const batchNumber = Math.floor(i / CLEAR_BATCH_SIZE) + 1;
      let attempt = 0;
      let success = false;
      let lastError = null;

      while (!success && attempt <= CLEAR_BATCH_MAX_RETRIES) {
        attempt += 1;
        try {
          if (verbose) {
            console.log(
              `[${userId}] Deleting ${entityLabel} batch ${batchNumber}/${totalBatches} (${batch.length}) attempt ${attempt}...`
            );
          }
          await admin.transact(batch);
          deletedCount += batch.length;
          success = true;
        } catch (error) {
          lastError = error;
          if (attempt <= CLEAR_BATCH_MAX_RETRIES) {
            console.warn(
              `[${userId}] Retry ${attempt}/${CLEAR_BATCH_MAX_RETRIES} for ${entityLabel} batch ${batchNumber}/${totalBatches}: ${error.message}`
            );
          }
        }
      }

      if (!success) {
        throw new Error(
          `[${userId}] Failed deleting ${entityLabel} batch ${batchNumber}/${totalBatches} after ${CLEAR_BATCH_MAX_RETRIES + 1} attempts: ${lastError?.message || "Unknown error"}`
        );
      }
    }

    return deletedCount;
  }

  async function deleteOwnedEntity(entityName, entityLabel, buildDeleteOp) {
    let deleted = 0;

    for (let pass = 1; pass <= MAX_QUERY_DELETE_PASSES; pass += 1) {
      const pageResult = await admin.query({
        [entityName]: {
          $: {
            where: {
              ownerUid: userId,
            },
            limit: QUERY_PAGE_SIZE,
          },
        },
      });

      const pageRows = pageResult[entityName] || [];

      if (verbose) {
        console.log(
          `[${userId}] Queried ${entityLabel} pass ${pass} (${pageRows.length} rows)`
        );
      }

      if (!pageRows.length) {
        return deleted;
      }

      const deleteOps = pageRows.map((row) => buildDeleteOp(row));
      deleted += await runDeleteBatches(entityLabel, deleteOps);
    }

    throw new Error(
      `[${userId}] Reached max delete passes (${MAX_QUERY_DELETE_PASSES}) for ${entityLabel}; aborting to avoid infinite loop.`
    );
  }

  const result = {
    goalsDeleted: 0,
    tasksDeleted: 0,
    habitsDeleted: 0,
    habitCheckinsDeleted: 0,
    journalEntriesDeleted: 0,
    totalDeleted: 0,
  };

  try {
    // Delete all checkins first so habit deletes are never blocked by child records.
    if (verbose)
      console.log(`[${userId}] Querying all habit checkins for user...`);
    result.habitCheckinsDeleted = await deleteOwnedEntity(
      "habitCheckins",
      "habit checkins",
      (checkin) => admin.tx.habitCheckins[checkin.id].delete()
    );

    // Delete habits after checkins.
    if (verbose) console.log(`[${userId}] Querying habits...`);
    result.habitsDeleted = await deleteOwnedEntity(
      "habits",
      "habits",
      (habit) => admin.tx.habits[habit.id].delete()
    );

    // Delete tasks before goals to reduce dependency/order risk.
    if (verbose) console.log(`[${userId}] Querying tasks...`);
    result.tasksDeleted = await deleteOwnedEntity(
      "tasks",
      "tasks",
      (task) => admin.tx.tasks[task.id].delete()
    );

    // Delete goals last in the goals/tasks hierarchy.
    if (verbose) console.log(`[${userId}] Querying goals...`);
    result.goalsDeleted = await deleteOwnedEntity(
      "goals",
      "goals",
      (goal) => admin.tx.goals[goal.id].delete()
    );

    // Delete journal entries
    if (verbose)
      console.log(`[${userId}] Querying journal entries...`);
    result.journalEntriesDeleted = await deleteOwnedEntity(
      "journalEntries",
      "journal entries",
      (entry) => admin.tx.journalEntries[entry.id].delete()
    );

    result.totalDeleted =
      result.goalsDeleted +
      result.tasksDeleted +
      result.habitsDeleted +
      result.habitCheckinsDeleted +
      result.journalEntriesDeleted;

    return result;
  } catch (error) {
    console.error(`Error clearing data for user ${userId}:`, error);
    throw error;
  }
}
