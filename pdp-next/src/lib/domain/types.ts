export type GoalType = "professional" | "personal";
export type ItemStatus = "not_started" | "in_progress" | "done";

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

export type Subgoal = SoftDeleteFields & {
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
  subgoalId: string;
  title: string;
  notes: string;
  dueDate: string | null;
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

export type UserProfile = {
  uid: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  theme: "light" | "dark" | "cwm";
  palette: "ocean" | "sunset" | "forest" | "royal" | "candy" | "dusk" | "lava" | "mint";
  timezone: string;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
};

export type GoalAggregate = {
  goal: Goal;
  subgoals: Subgoal[];
  tasksBySubgoalId: Record<string, Task[]>;
};
