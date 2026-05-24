// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarFeedRotationControl } from "@/components/dashboard/calendar-feed-rotation-control";

describe("calendar feed rotation control", () => {
  it("opens confirmation first, then rotates after confirm", async () => {
    const user = userEvent.setup();
    const onPrepareRotate = vi.fn();
    const onRotate = vi.fn(async () => true);

    render(
      <CalendarFeedRotationControl
        isLoading={false}
        onPrepareRotate={onPrepareRotate}
        onRotate={onRotate}
      />,
    );

    expect(screen.queryByText("Confirm revoke")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Revoke & Rotate URL" }));

    expect(onPrepareRotate).toHaveBeenCalledTimes(1);
    expect(onRotate).not.toHaveBeenCalled();
    expect(screen.queryByText("Confirm revoke")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Confirm revoke & rotate" }));

    expect(onRotate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Confirm revoke")).toBeNull();
  });

  it("keeps confirmation open when rotate fails", async () => {
    const user = userEvent.setup();
    const onRotate = vi.fn(async () => false);

    render(<CalendarFeedRotationControl isLoading={false} onRotate={onRotate} />);

    await user.click(screen.getByRole("button", { name: "Revoke & Rotate URL" }));
    await user.click(screen.getByRole("button", { name: "Confirm revoke & rotate" }));

    expect(onRotate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Confirm revoke")).not.toBeNull();
  });

  it("closes confirmation when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onRotate = vi.fn(async () => true);

    render(<CalendarFeedRotationControl isLoading={false} onRotate={onRotate} />);

    await user.click(screen.getByRole("button", { name: "Revoke & Rotate URL" }));
    expect(screen.queryByText("Confirm revoke")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRotate).not.toHaveBeenCalled();
    expect(screen.queryByText("Confirm revoke")).toBeNull();
  });
});