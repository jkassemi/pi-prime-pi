import type { TUI } from "../tui.ts";
import { Text } from "./text.ts";

export interface LoaderIndicatorOptions {
	/** Animation frames. Use an empty array to hide the indicator. */
	frames?: string[];
	/** Frame interval in milliseconds for animated indicators. */
	intervalMs?: number;
}

/** A static message or a message generated from the monotonic elapsed time. */
export type LoaderMessage = string | ((elapsedMs: number) => string);

const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const DEFAULT_INTERVAL_MS = 80;
const DEFAULT_MESSAGE_INTERVAL_MS = 1000;

/**
 * Loader component that updates with an optional spinning animation.
 */
export class Loader extends Text {
	private frames = [...DEFAULT_FRAMES];
	private intervalMs = DEFAULT_INTERVAL_MS;
	private currentFrame = 0;
	private intervalId: NodeJS.Timeout | null = null;
	private ui: TUI | null = null;
	private renderIndicatorVerbatim = false;
	private spinnerColorFn: (str: string) => string;
	private messageColorFn: (str: string) => string;
	private message: LoaderMessage = "Loading...";
	private messageIntervalMs = DEFAULT_MESSAGE_INTERVAL_MS;
	private startedAt = 0;
	private running = false;

	constructor(
		ui: TUI,
		spinnerColorFn: (str: string) => string,
		messageColorFn: (str: string) => string,
		message: LoaderMessage = "Loading...",
		indicator?: LoaderIndicatorOptions,
	) {
		super("", 1, 0);
		this.ui = ui;
		this.spinnerColorFn = spinnerColorFn;
		this.messageColorFn = messageColorFn;
		this.message = message;
		this.setIndicator(indicator);
	}

	render(width: number): string[] {
		return ["", ...super.render(width)];
	}

	start(): void {
		if (!this.running) {
			this.startedAt = performance.now();
			this.running = true;
		}
		this.updateDisplay();
		this.restartAnimation();
	}

	stop(): void {
		this.clearAnimation();
		this.running = false;
	}

	setMessage(message: LoaderMessage, refreshIntervalMs = DEFAULT_MESSAGE_INTERVAL_MS): void {
		this.message = message;
		this.messageIntervalMs = refreshIntervalMs > 0 ? refreshIntervalMs : DEFAULT_MESSAGE_INTERVAL_MS;
		this.updateDisplay();
		if (this.running) {
			this.restartAnimation();
		}
	}

	setIndicator(indicator?: LoaderIndicatorOptions): void {
		this.renderIndicatorVerbatim = indicator !== undefined;
		this.frames = indicator?.frames !== undefined ? [...indicator.frames] : [...DEFAULT_FRAMES];
		this.intervalMs = indicator?.intervalMs && indicator.intervalMs > 0 ? indicator.intervalMs : DEFAULT_INTERVAL_MS;
		this.currentFrame = 0;
		this.start();
	}

	private restartAnimation(): void {
		this.clearAnimation();
		const isDynamic = typeof this.message === "function";
		if (this.frames.length <= 1 && !isDynamic) {
			return;
		}
		const intervalMs =
			this.frames.length > 1 ? Math.min(this.intervalMs, this.messageIntervalMs) : this.messageIntervalMs;
		this.intervalId = setInterval(() => {
			if (this.frames.length > 1) {
				this.currentFrame = (this.currentFrame + 1) % this.frames.length;
			}
			this.updateDisplay();
		}, intervalMs);
	}

	private clearAnimation(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	private updateDisplay(): void {
		const frame = this.frames[this.currentFrame] ?? "";
		const renderedFrame = this.renderIndicatorVerbatim ? frame : this.spinnerColorFn(frame);
		const indicator = frame.length > 0 ? `${renderedFrame} ` : "";
		const message =
			typeof this.message === "function"
				? this.message(Math.max(0, performance.now() - this.startedAt))
				: this.message;
		this.setText(`${indicator}${this.messageColorFn(message)}`);
		if (this.ui) {
			this.ui.requestRender();
		}
	}
}
