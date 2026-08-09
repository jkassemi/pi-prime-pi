import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Loader, type TUI } from "../src/index.ts";

function createLoader(message: ConstructorParameters<typeof Loader>[3] = "Loading..."): Loader {
	return new Loader(
		{ requestRender: () => {} } as unknown as TUI,
		(value) => value,
		(value) => value,
		message,
	);
}

describe("Loader", () => {
	it("refreshes animated, static, and hidden dynamic messages", (context) => {
		context.mock.timers.enable({ apis: ["setInterval"] });
		let now = 0;
		context.mock.method(performance, "now", () => now);
		const animated = createLoader((elapsedMs) => `${Math.floor(elapsedMs / 1000)}s`);
		const staticLoader = createLoader("Ready");
		const hidden = createLoader((elapsedMs) => `${Math.floor(elapsedMs / 1000)}s`);
		const renderedMessage = (loader: Loader) => loader.render(80)[1] ?? "";

		staticLoader.setIndicator({ frames: ["●"] });
		hidden.setIndicator({ frames: [], intervalMs: 100 });
		now = 1100;
		context.mock.timers.tick(1100);

		assert.match(renderedMessage(animated), /1s/);
		assert.match(renderedMessage(staticLoader), /Ready/);
		assert.match(renderedMessage(hidden), /1s/);
		animated.stop();
		staticLoader.stop();
		hidden.stop();
	});

	it("preserves elapsed lifetime when the indicator changes", (context) => {
		context.mock.timers.enable({ apis: ["setInterval"] });
		const elapsed: number[] = [];
		let now = 1000;
		context.mock.method(performance, "now", () => now);
		const loader = createLoader((elapsedMs) => {
			elapsed.push(elapsedMs);
			return "working";
		});

		now = 2200;
		loader.setIndicator({ frames: ["●"], intervalMs: 25 });
		now = 2300;
		context.mock.timers.tick(100);

		assert.ok((elapsed.at(-1) ?? 0) >= 1200);
		loader.stop();
	});

	it("does not restart after changing a stopped loader message", (context) => {
		context.mock.timers.enable({ apis: ["setInterval"] });
		let renders = 0;
		const loader = new Loader(
			{ requestRender: () => renders++ } as unknown as TUI,
			(value) => value,
			(value) => value,
			(elapsedMs) => `${Math.floor(elapsedMs / 1000)}s`,
			{ frames: [] },
		);
		loader.stop();
		const rendersAfterStop = renders;
		loader.setMessage((elapsedMs) => `${Math.floor(elapsedMs / 1000)}s`, 10);
		context.mock.timers.tick(100);

		assert.equal(renders, rendersAfterStop + 1);
	});
});
