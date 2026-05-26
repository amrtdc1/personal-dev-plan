import { getInstantAdmin } from "@/lib/instantdb/admin";

type QueryItem = { id: string };
type QueryCollection = {
  where: (field: string, op: "==", value: string) => {
    orderBy: (sortField: string) => { toArray: () => Promise<QueryItem[]> };
    toArray: () => Promise<QueryItem[]>;
  };
};
type QueryDb = {
  goals: QueryCollection;
  tasks: QueryCollection;
  habits: QueryCollection;
  habitCheckins: QueryCollection;
  journalEntries: QueryCollection;
};
type TxCollection = { delete: (id: string) => void };
type Tx = {
  goals: TxCollection;
  tasks: TxCollection;
  habits: TxCollection;
  habitCheckins: TxCollection;
  journalEntries: TxCollection;
};
type AdminCompat = {
  queryOnce: (queryFn: (db: QueryDb) => Promise<QueryItem[]>) => Promise<QueryItem[]>;
  transaction: (callback: (tx: Tx) => void | Promise<void>) => Promise<void>;
};

export interface ClearUserDataOptions {
  userId: string;
  verbose?: boolean;
}

export interface ClearUserDataResult {
  goalsDeleted: number;
  tasksDeleted: number;
  habitsDeleted: number;
  habitCheckinsDeleted: number;
  journalEntriesDeleted: number;
  totalDeleted: number;
}

/**
 * Clear all data for a specific user (goals, tasks, habits, checkins, journal entries).
 * Preserves the UserProfile so the user can still log in.
 */
export async function clearUserData(
  options: ClearUserDataOptions
): Promise<ClearUserDataResult> {
  const { userId, verbose = false } = options;

  if (!userId) {
    throw new Error("userId is required");
  }

  const admin = getInstantAdmin() as unknown as AdminCompat;
  const result: ClearUserDataResult = {
    goalsDeleted: 0,
    tasksDeleted: 0,
    habitsDeleted: 0,
    habitCheckinsDeleted: 0,
    journalEntriesDeleted: 0,
    totalDeleted: 0,
  };

  try {
    // Delete goals (this is the primary entity)
    if (verbose) console.log(`[${userId}] Querying goals...`);
    const goalsResult = await admin.queryOnce(
      (db) =>
        db.goals
          .where("ownerUid", "==", userId)
          .orderBy("createdAt")
          .toArray()
    );

    if (goalsResult.length > 0) {
      if (verbose)
        console.log(`[${userId}] Deleting ${goalsResult.length} goals...`);
      for (const goal of goalsResult) {
        await admin.transaction(async (tx) => {
          tx.goals.delete(goal.id);
        });
      }
      result.goalsDeleted = goalsResult.length;
    }

    // Delete tasks
    if (verbose) console.log(`[${userId}] Querying tasks...`);
    const tasksResult = await admin.queryOnce(
      (db) =>
        db.tasks
          .where("ownerUid", "==", userId)
          .orderBy("createdAt")
          .toArray()
    );

    if (tasksResult.length > 0) {
      if (verbose)
        console.log(`[${userId}] Deleting ${tasksResult.length} tasks...`);
      for (const task of tasksResult) {
        await admin.transaction(async (tx) => {
          tx.tasks.delete(task.id);
        });
      }
      result.tasksDeleted = tasksResult.length;
    }

    // Delete habits (must delete checkins first due to FK constraint)
    if (verbose) console.log(`[${userId}] Querying habits...`);
    const habitsResult = await admin.queryOnce(
      (db) =>
        db.habits
          .where("ownerUid", "==", userId)
          .orderBy("createdAt")
          .toArray()
    );

    if (habitsResult.length > 0) {
      // Delete all checkins for these habits first
      if (verbose)
        console.log(`[${userId}] Querying habit checkins for ${habitsResult.length} habits...`);
      const habitIds = habitsResult.map((habit) => habit.id);

      for (const habitId of habitIds) {
        const checkinsResult = await admin.queryOnce(
          (db) =>
            db.habitCheckins
              .where("habitId", "==", habitId)
              .toArray()
        );

        if (checkinsResult.length > 0) {
          if (verbose)
            console.log(
              `[${userId}] Deleting ${checkinsResult.length} checkins for habit ${habitId}...`
            );
          for (const checkin of checkinsResult) {
            await admin.transaction(async (tx) => {
              tx.habitCheckins.delete(checkin.id);
            });
          }
          result.habitCheckinsDeleted += checkinsResult.length;
        }
      }

      // Now delete the habits
      if (verbose)
        console.log(`[${userId}] Deleting ${habitsResult.length} habits...`);
      for (const habit of habitsResult) {
        await admin.transaction(async (tx) => {
          tx.habits.delete(habit.id);
        });
      }
      result.habitsDeleted = habitsResult.length;
    }

    // Delete journal entries
    if (verbose)
      console.log(`[${userId}] Querying journal entries...`);
    const journalResult = await admin.queryOnce(
      (db) =>
        db.journalEntries
          .where("ownerUid", "==", userId)
          .orderBy("createdAt")
          .toArray()
    );

    if (journalResult.length > 0) {
      if (verbose)
        console.log(`[${userId}] Deleting ${journalResult.length} journal entries...`);
      for (const entry of journalResult) {
        await admin.transaction(async (tx) => {
          tx.journalEntries.delete(entry.id);
        });
      }
      result.journalEntriesDeleted = journalResult.length;
    }

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
