import "../test/setup";
import { render, within, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, mock } from "bun:test";
import { InboxView } from "./index";
import { mockInvoke, mockListen } from "../test/setup";

// Mock TanStack Virtual
mock.module("@tanstack/react-virtual", () => ({
  useVirtualizer: mock(({ count }: { count: number }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () => Array.from({ length: count }, (_, i) => ({
      index: i,
      start: i * 100,
      size: 100,
      key: i,
    })),
    measureElement: mock(() => {}),
  })),
}));

const mockEmails = [
  {
    id: 1,
    account_id: 1,
    folder_id: 1,
    remote_id: "1",
    message_id: "m1",
    subject: "Test Email 1",
    sender_name: "Sender 1",
    sender_address: "sender1@example.com",
    date: new Date().toISOString(),
    flags: "[]",
    snippet: "Snippet 1",
    has_attachments: false,
  },
  {
    id: 2,
    account_id: 1,
    folder_id: 1,
    remote_id: "2",
    message_id: "m2",
    subject: "Test Email 2",
    sender_name: "Sender 2",
    sender_address: "sender2@example.com",
    date: new Date().toISOString(),
    flags: "[]",
    snippet: "Snippet 2",
    has_attachments: true,
  },
];

describe("InboxView", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockListen.mockClear();
    mockInvoke.mockImplementation((command) => {
      if (command === "get_emails") return Promise.resolve(mockEmails);
      if (command === "get_email_content") return Promise.resolve({ body_text: "Body", body_html: null });
      if (command === "get_attachments") return Promise.resolve([]);
      return Promise.resolve();
    });
  });

  it("renders email list", async () => {
    render(<InboxView />);
    const screen = within(document.body);

    await waitFor(() => {
      expect(screen.getByText("Test Email 1")).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText("Test Email 2")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // Badge count
  });

  it("handles multi-select logic", async () => {
    render(<InboxView />);
    const screen = within(document.body);

    await waitFor(() => screen.getByText("Test Email 1"));

    const checkboxes = screen.getAllByRole("checkbox");
    const selectAll = checkboxes[0];
    const email1Checkbox = checkboxes[1];

    fireEvent.click(email1Checkbox);
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    fireEvent.click(selectAll);
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(selectAll);
    expect(screen.queryByText("selected")).toBeNull();
  });

  it("displays email content when selected", async () => {
    render(<InboxView />);
    const screen = within(document.body);

    await waitFor(() => screen.getByText("Test Email 1"));

    fireEvent.click(screen.getByText("Test Email 1"));

    await waitFor(() => {
      expect(screen.getByText("Body")).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_email_content", { emailId: 1 });
  });

  it("refreshes email list on emails-updated event", async () => {
    render(<InboxView />);
    const screen = within(document.body);

    await waitFor(() => screen.getByText("Test Email 1"));

    // Get the callback passed to listen
    const calls = (mockListen.mock as any).calls;
    const listenCall = calls.find((call: any[]) => call[0] === "emails-updated");
    expect(listenCall).toBeDefined();
    const callback = listenCall[1];

    // Trigger the callback
    await act(async () => {
      callback();
    });

    await waitFor(() => {
      // It should have called get_emails again
      expect(mockInvoke).toHaveBeenCalledTimes(2); // Initial + refresh
    });
  });
});