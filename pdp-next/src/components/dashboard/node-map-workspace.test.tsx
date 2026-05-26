// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  authState,
  listGoalsMock,
  listTasksMock,
} = vi.hoisted(() => ({
  authState: {
    isLoading: false,
    user: { id: "user-1" },
    error: null,
  },
  listGoalsMock: vi.fn(),
  listTasksMock: vi.fn(),
}));

vi.mock("@/lib/instantdb/client", () => ({
  db: {
    useAuth: () => authState,
  },
}));

vi.mock("@/lib/data/repository", () => ({
  dataRepository: {
    listGoals: listGoalsMock,
    listTasks: listTasksMock,
  },
}));

vi.mock("@/components/dashboard/node-map/node-graph-canvas", () => ({
  NodeGraphCanvas: ({
    nodes,
    edges,
    forceProfile,
    onOpenItem,
  }: {
    nodes: Array<{ id: string; data: { entityId: string; kind: "goal" | "task" } }>;
    edges: Array<{ id: string }>;
    forceProfile?: "compact" | "balanced" | "spacious";
    onOpenItem?: (kind: "goal" | "task", id: string) => void;
  }) => (
    <div>
      <p>Graph nodes: {nodes.length}</p>
      <p>Graph edges: {edges.length}</p>
      <p>Force profile: {forceProfile ?? "balanced"}</p>
      <button type="button" onClick={() => onOpenItem?.("goal", nodes.find((node) => node.data.kind === "goal")?.data.entityId ?? "")}>Open goal</button>
      <button type="button" onClick={() => onOpenItem?.("task", nodes.find((node) => node.data.kind === "task")?.data.entityId ?? "")}>Open task</button>
    </div>
  ),
}));

import { NodeMapWorkspace } from "@/components/dashboard/node-map-workspace";

describe("node map workspace graph integration", () => {
  beforeEach(() => {
    listGoalsMock.mockReset();
    listTasksMock.mockReset();
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    listGoalsMock.mockImplementation(async (_ownerUid: string, type: "professional" | "personal") => {
      if (type === "professional") {
        return [
          {
            id: "goal-1",
            ownerUid: "user-1",
            type: "professional",
            parentGoalId: null,
            timeframeLevel: "weekly",
            title: "Weekly focus",
            description: "Desc",
            timeframe: "This week",
            projectedStartDate: null,
            projectedEndDate: null,
            actualStartDate: null,
            actualEndDate: null,
            status: "in_progress",
            percentComplete: 55,
            isFocus: true,
            themeColor: "#2563eb",
            orderIndex: 0,
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
            deletedAt: null,
            deletedBy: null,
            restoreUntil: null,
            purgeAt: null,
          },
        ];
      }

      return [];
    });

    listTasksMock.mockResolvedValue([
      {
        id: "task-1",
        ownerUid: "user-1",
        goalId: "goal-1",
        title: "Task for goal",
        notes: "",
        dueDate: null,
        unplanned: false,
        status: "not_started",
        percentComplete: 0,
        orderIndex: 0,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        deletedAt: null,
        deletedBy: null,
        restoreUntil: null,
        purgeAt: null,
      },
    ]);
  });

  it("passes graph nodes and edges to the graph canvas", async () => {
    render(<NodeMapWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Graph nodes: 2")).not.toBeNull();
    });

    expect(screen.getByText("Graph edges: 1")).not.toBeNull();
    expect(screen.getByText("Force profile: balanced")).not.toBeNull();
  });

  it("keeps open-item callback wiring for graph interactions", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();

    render(<NodeMapWorkspace onOpenItem={onOpenItem} />);

    await waitFor(() => {
      expect(screen.getByText("Graph nodes: 2")).not.toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Open goal" }));
    await user.click(screen.getByRole("button", { name: "Open task" }));

    expect(onOpenItem).toHaveBeenCalledWith("goal", "goal-1");
    expect(onOpenItem).toHaveBeenCalledWith("task", "task-1");
  });

  it("collapses filters by default on mobile and allows expanding them", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const user = userEvent.setup();
    render(<NodeMapWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Graph nodes: 2")).not.toBeNull();
    });

    expect(screen.getByRole("button", { name: "Show filters" })).not.toBeNull();
    expect(screen.queryByText("All levels")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show filters" }));

    expect(screen.getByText("All levels")).not.toBeNull();
    expect(screen.getByText("Include Freestanding Tasks")).not.toBeNull();
  });

  it("keeps timeframe buckets collapsed by default and allows per-bucket expand/collapse", async () => {
    const user = userEvent.setup();

    render(<NodeMapWorkspace />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Weekly" })).not.toBeNull();
    });

    expect(screen.queryByText("Weekly focus")).toBeNull();

    const weeklyHeading = screen.getAllByText("Weekly").find((element) => element.tagName === "H3");
    expect(weeklyHeading).toBeDefined();
    const weeklyBucket = (weeklyHeading as HTMLElement).closest("div.rounded-2xl");
    expect(weeklyBucket).not.toBeNull();

    const weeklyExpandButton = within(weeklyBucket as HTMLElement).getByRole("button", { name: "Expand" });
    await user.click(weeklyExpandButton);

    expect(screen.getByText("Weekly focus")).not.toBeNull();

    const weeklyCollapseButton = within(weeklyBucket as HTMLElement).getByRole("button", { name: "Collapse" });
    await user.click(weeklyCollapseButton);

    expect(screen.queryByText("Weekly focus")).toBeNull();
    expect(within(weeklyBucket as HTMLElement).getByRole("button", { name: "Expand" })).not.toBeNull();
  });
});
