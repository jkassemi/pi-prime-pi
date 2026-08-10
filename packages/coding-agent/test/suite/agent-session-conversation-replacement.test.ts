import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { SessionManager } from "../../src/core/session-manager.ts";
import { createHarness, getMessageText, type Harness } from "./harness.ts";

describe("AgentSession.replaceConversation", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) harnesses.pop()?.cleanup();
	});

	it("persists a recoverable replacement conversation", async () => {
		const harness = await createHarness({ persistSession: true, models: [{ id: "faux-1", reasoning: false }] });
		harnesses.push(harness);

		harness.setResponses([fauxAssistantMessage("original reply")]);
		await harness.session.prompt("original");
		const oldUserId = harness.sessionManager.getBranch()[0]?.id;
		expect(oldUserId).toBeDefined();

		const ids = await harness.session.replaceConversation([
			{ role: "user", content: "replacement", timestamp: Date.now() },
		]);
		expect(ids).toHaveLength(1);
		expect(harness.sessionManager.getLeafId()).toBe(ids[0]);
		expect(harness.session.messages).toEqual(harness.session.state.messages);
		expect(harness.session.messages.map(getMessageText)).toEqual(["replacement"]);
		expect(harness.sessionManager.getBranch(oldUserId).map((entry) => entry.id)).toContain(oldUserId);

		await expect(harness.session.replaceConversation([{} as never])).rejects.toThrow("invalid message");
		await expect(harness.session.replaceConversation([])).rejects.toThrow("at least one");
		expect(harness.session.messages.map(getMessageText)).toEqual(["replacement"]);

		const sessionFile = harness.sessionManager.getSessionFile();
		if (!sessionFile) throw new Error("persisted harness did not create a session file");
		const reloaded = SessionManager.open(sessionFile);
		expect(
			reloaded.getBranch().map((entry) => getMessageText(entry.type === "message" ? entry.message : {})),
		).toEqual(["replacement"]);
		expect(reloaded.getBranch(oldUserId).map((entry) => entry.id)).toContain(oldUserId);
	});

	it("continues from a replacement user message without appending another input", async () => {
		const harness = await createHarness({ models: [{ id: "faux-1", reasoning: false }] });
		harnesses.push(harness);
		await harness.session.replaceConversation([
			{ role: "user", content: "replacement question", timestamp: Date.now() },
		]);
		harness.setResponses([fauxAssistantMessage("replacement answer")]);

		await harness.session.continueConversation();

		expect(harness.session.messages.map(getMessageText)).toEqual(["replacement question", "replacement answer"]);
	});

	it("rejects replacement and continuation while the agent is active", async () => {
		let release!: () => void;
		let signalStart!: () => void;
		const started = new Promise<void>((resolve) => {
			signalStart = resolve;
		});
		const tool: AgentTool = {
			name: "wait",
			label: "wait",
			description: "wait",
			parameters: Type.Object({}),
			execute: async () => {
				signalStart();
				await new Promise<void>((resolveRelease) => {
					release = resolveRelease;
				});
				return { content: [{ type: "text", text: "done" }], details: {} };
			},
		};
		const harness = await createHarness({ tools: [tool] });
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage(fauxToolCall("wait", {})), fauxAssistantMessage("done")]);
		const prompt = harness.session.prompt("run");
		await started;
		await expect(
			harness.session.replaceConversation([{ role: "user", content: "nope", timestamp: Date.now() }]),
		).rejects.toThrow("Cannot replace the conversation while the agent is active");
		await expect(harness.session.continueConversation()).rejects.toThrow(
			"Cannot continue the conversation while the agent is active",
		);
		release();
		await prompt;
	});
});
