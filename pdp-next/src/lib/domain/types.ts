export type GoalType = "professional" | "personal";
export type GoalTimeframeLevel = "vision_5y" | "annual" | "quarterly" | "monthly" | "weekly";
export type ItemStatus = "not_started" | "in_progress" | "done";
export type HabitCadence = "daily" | "weekly";
export type HabitState = "active" | "paused" | "archived";

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
  goalId: string;
  title: string;
  notes: string;
  dueDate: string | null;
  unplanned?: boolean;
  status: ItemStatus;
  percentComplete: number;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

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

export type GoalAggregate = {
  goal: Goal;
  tasksByGoalId: Record<string, Task[]>;
};
