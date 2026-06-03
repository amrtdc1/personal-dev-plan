export type GoalType = "professional" | "personal";
export type GoalTimeframeLevel = "vision_5y" | "annual" | "quarterly" | "monthly" | "weekly";
export type ItemStatus = "not_started" | "in_progress" | "done";
export type HabitCadence = "daily" | "weekly";
export type HabitState = "active" | "paused" | "archived";
export type PlanningCycleType = "weekly" | "quarterly" | "yearly";
export type PlanningCycleStatus = "active" | "completed" | "archived";
export type PlanningCommitmentLevel = "weekly" | "quarterly" | "yearly";
export type PlanningCommitmentDomain = GoalType | "mixed";
export type PlanningCommitmentStatus = "not_started" | "in_progress" | "done" | "dropped";

export type SoftDeleteFields = {
  deletedAt: string | null;
  deletedBy: string | null;
  restoreUntil: string | null;
  purgeAt: string | null;
};

export type Goal = SoftDeleteFields & {
  id: string;
  ownerUid: string;
  type: GoalType;
  parentGoalId?: string | null;
  timeframeLevel: GoalTimeframeLevel;
  title: string;
  description: string;
  timeframe: string;
  projectedStartDate: string | null;
  projectedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  status: ItemStatus;
  percentComplete: number;
  isFocus: boolean;
  themeColor: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type ChildGoal = SoftDeleteFields & {
  id: string;
  ownerUid: string;
  goalId: string;
  title: string;
  description: string;
  timeframe: string;
  projectedStartDate: string | null;
  projectedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  status: ItemStatus;
  percentComplete: number;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type Task = SoftDeleteFields & {
  id: string;
  ownerUid: string;
  goalId?: string | null;
  parentGoalId: string | null;
  commitmentId?: string | null;
  title: string;
  notes: string;
  dueDate: string | null;
  unplanned?: boolean;
  originalDueDate?: string | null;
  snoozedDueDate?: string | null;
  snoozeCount?: number;
  status: ItemStatus;
  percentComplete: number;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export function getTaskParentGoalId(task: Pick<Task, "parentGoalId" | "goalId">) {
  return task.parentGoalId ?? task.goalId ?? null;
}

export type JournalEntry = SoftDeleteFields & {
  id: string;
  ownerUid: string;
  title: string;
  content: string;
  mood: string | null;
  tags: string[];
  relatedGoalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Habit = SoftDeleteFields & {
  id: string;
  ownerUid: string;
  title: string;
  cadence: HabitCadence;
  targetCount: number;
  status: HabitState;
  createdAt: string;
  updatedAt: string;
};

export type HabitCheckin = {
  id: string;
  ownerUid: string;
  habitId: string;
  checkInDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  uid: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  themeMode?: "palette" | "cwm" | "college";
  theme: "light" | "dark" | "cwm";
  palette: "ocean" | "sunset" | "forest" | "royal" | "candy" | "dusk" | "lava" | "mint";
  collegeTeamId?: string | null;
  collegeTeamName?: string | null;
  collegeLogoUrl?: string | null;
  timezone: string;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
};

export type VisionStatement = {
  id: string;
  ownerUid: string;
  statement: string;
  createdAt: string;
  updatedAt: string;
};

export type GoalAggregate = {
  goal: Goal;
  tasksByGoalId: Record<string, Task[]>;
};

export type PlanningCycle = {
  id: string;
  ownerUid: string;
  cycleType: PlanningCycleType;
  startDate: string;
  endDate: string;
  status: PlanningCycleStatus;
  reviewSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlanningCommitment = {
  id: string;
  ownerUid: string;
  cycleId: string;
  level: PlanningCommitmentLevel;
  domain: PlanningCommitmentDomain;
  title: string;
  linkedGoalId: string | null;
  rank: 1 | 2 | 3;
  status: PlanningCommitmentStatus;
  carryoverFromCommitmentId: string | null;
  confidenceScore: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DailyFocusPlan = {
  id: string;
  ownerUid: string;
  planDate: string;
  commitmentIds: string[];
  taskIds: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
