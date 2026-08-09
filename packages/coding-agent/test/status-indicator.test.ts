import type { TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	IdleStatus,
	RetryStatusIndicator,
	WorkingStatusIndicator,
} from "../src/modes/interactive/components/status-indicator.ts";
import { formatWorkingMessage } from "../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

describe("status indicators", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps idle status at the same height as status indicators", () => {
		const idleStatus = new IdleStatus();

		const lines = idleStatus.render(20);
		expect(lines).toHaveLength(2);
		expect(lines).toEqual([" ".repeat(20), " ".repeat(20)]);
	});

	it("formats default elapsed time, preserves the interrupt hint, and restores it after custom text", () => {
		initTheme("dark");
		vi.useFakeTimers();
		const indicator = new WorkingStatusIndicator(
			{ requestRender: vi.fn() } as unknown as TUI,
			"Working...",
			{ frames: [] },
			(elapsedMs) => formatWorkingMessage("Working...", elapsedMs),
		);

		vi.advanceTimersByTime(3_661_000);
		const elapsed = indicator.render(120).join("\n");
		expect(elapsed).toContain("Working... (1h 1m)");
		expect(elapsed).not.toContain("to interrupt");
		expect(formatWorkingMessage("Working...", 1_000, "esc")).toContain("(esc to interrupt)");

		indicator.setWorkingMessage("Thinking deeply...");
		expect(indicator.render(120).join("\n")).toContain("Thinking deeply...");
		indicator.setWorkingMessage(undefined);
		expect(indicator.render(120).join("\n")).toContain("Working...");
		indicator.dispose();
	});

	it("disposes retry countdown updates", () => {
		initTheme("dark");
		vi.useFakeTimers();
		const requestRender = vi.fn();
		const tui = { requestRender } as unknown as TUI;
		const indicator = new RetryStatusIndicator(tui, 1, 3, 1000);
		const callsBeforeDispose = requestRender.mock.calls.length;

		indicator.dispose();
		vi.advanceTimersByTime(2000);

		expect(requestRender).toHaveBeenCalledTimes(callsBeforeDispose);
	});
});
