/**
 * Plane.so issue tracker — not Plannotator.
 *
 * Tools the LLM can call to read/write Plane work items. Auth: PLANE_API_KEY.
 * Workspace: PLANE_WORKSPACE_SLUG (default nextnode). Host: PLANE_BASE_URL.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
	createComment,
	createWorkItem,
	getWorkItem,
	isRecord,
	listProjects,
	listStates,
	listWorkItems,
	searchWorkItems,
	updateWorkItem,
	type Result,
} from "./client";
import { toCommentHtml, toDescriptionHtml } from "./html";

const Priority = StringEnum(["urgent", "high", "medium", "low", "none"] as const);

const ALIASES = {
	project_id: "projectId",
	parent_id: "parentId",
	state_id: "stateId",
	per_page: "perPage",
} as const;

function remapArgs(args: unknown): unknown {
	if (!isRecord(args)) return args;
	const next: Record<string, unknown> = { ...args };
	for (const [from, to] of Object.entries(ALIASES)) {
		if (from in next && !(to in next)) {
			next[to] = next[from];
			delete next[from];
		}
	}
	return next;
}

function readArg(args: unknown, key: string): string {
	if (!isRecord(args)) return "";
	const value = args[key];
	return typeof value === "string" ? value : "";
}

function toolResult(result: Result<unknown>): {
	content: { type: "text"; text: string }[];
	details: unknown;
	isError?: boolean;
} {
	if (!result.ok) {
		return {
			content: [{ type: "text", text: result.error }],
			details: { error: result.error },
			isError: true,
		};
	}
	return {
		content: [{ type: "text", text: JSON.stringify(result.value, null, 2) }],
		details: result.value,
	};
}

const PLANE_NOT_PLANNOTATOR =
	"Plane.so issue tracker — not Plannotator (plan-mode UI). Use plane_* for tickets/epics.";

export default function planeExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "plane_list_projects",
		label: "Plane list projects",
		description: `${PLANE_NOT_PLANNOTATOR} List every project in the workspace (id, name, identifier like MINA).`,
		promptSnippet: "List Plane.so projects (not Plannotator)",
		promptGuidelines: [
			"Use plane_list_projects when the user mentions a Plane ticket, epic, or project and the project uuid is unknown.",
		],
		parameters: Type.Object({}),
		prepareArguments: remapArgs,
		async execute(_id, _params, signal) {
			return toolResult(await listProjects(signal));
		},
		renderCall(_args, theme) {
			return new Text(theme.fg("toolTitle", theme.bold("plane_list_projects")), 0, 0);
		},
	});

	pi.registerTool({
		name: "plane_search_workitems",
		label: "Plane search",
		description: `${PLANE_NOT_PLANNOTATOR} Search work items by text, identifier, or project key. Use this for "c'est quoi MINA-12", "trouve le ticket auth", prior-art checks.`,
		promptSnippet: "Search Plane.so work items",
		promptGuidelines: [
			"Use plane_search_workitems or plane_get_workitem when the user asks about a ticket/epic. Do not grep the repo for ticket bodies.",
		],
		parameters: Type.Object({
			search: Type.String({ description: "Query: identifier (MINA-12), title words, or nouns" }),
			projectId: Type.Optional(Type.String({ description: "Restrict to one project uuid" })),
			limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, description: "Max results (default 10)" })),
		}),
		prepareArguments: remapArgs,
		async execute(_id, params, signal) {
			return toolResult(await searchWorkItems(params.search, params.projectId, params.limit ?? 10, signal));
		},
		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("plane_search_workitems ")) + theme.fg("muted", readArg(args, "search")),
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "plane_list_workitems",
		label: "Plane list work items",
		description: `${PLANE_NOT_PLANNOTATOR} List work items in a project. Pass parentId to list children of an epic.`,
		promptSnippet: "List Plane.so work items in a project",
		parameters: Type.Object({
			projectId: Type.String({ description: "Project uuid from plane_list_projects" }),
			parentId: Type.Optional(Type.String({ description: "Epic/parent work-item uuid" })),
			perPage: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, description: "Page size (default 50)" })),
			cursor: Type.Optional(Type.String({ description: "nextCursor from a previous page" })),
		}),
		prepareArguments: remapArgs,
		async execute(_id, params, signal) {
			return toolResult(
				await listWorkItems(params.projectId, params.parentId, params.perPage ?? 50, params.cursor, signal),
			);
		},
		renderCall(args, theme) {
			const parent = readArg(args, "parentId");
			const label = parent ? `${readArg(args, "projectId")} parent=${parent}` : readArg(args, "projectId");
			return new Text(
				theme.fg("toolTitle", theme.bold("plane_list_workitems ")) + theme.fg("muted", label),
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "plane_get_workitem",
		label: "Plane get work item",
		description: `${PLANE_NOT_PLANNOTATOR} Fetch one work item by human identifier (MINA-12) or uuid. Returns description HTML, state, parent, priority.`,
		promptSnippet: "Get one Plane.so work item by MINA-12",
		promptGuidelines: [
			"Use plane_get_workitem for a cited identifier like MINA-12. Never invent ticket content from memory.",
		],
		parameters: Type.Object({
			identifier: Type.String({ description: "MINA-12, INFRA-3, or a work-item uuid" }),
			projectId: Type.Optional(Type.String({ description: "Required only when identifier is a uuid" })),
		}),
		prepareArguments: remapArgs,
		async execute(_id, params, signal) {
			return toolResult(await getWorkItem(params.identifier, params.projectId, signal));
		},
		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("plane_get_workitem ")) + theme.fg("muted", readArg(args, "identifier")),
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "plane_create_workitem",
		label: "Plane create work item",
		description: `${PLANE_NOT_PLANNOTATOR} Create a work item. description is markdown (### / lists / code); converted to HTML. Do not create items before the user approves a breakdown.`,
		promptSnippet: "Create a Plane.so work item",
		parameters: Type.Object({
			projectId: Type.String({ description: "Project uuid" }),
			name: Type.String({ description: "Outcome sentence" }),
			parentId: Type.Optional(Type.String({ description: "Epic uuid for tickets" })),
			description: Type.Optional(Type.String({ description: "Markdown body; converted to HTML" })),
			priority: Type.Optional(Priority),
		}),
		prepareArguments: remapArgs,
		async execute(_id, params, signal) {
			return toolResult(
				await createWorkItem(
					{
						projectId: params.projectId,
						name: params.name,
						parentId: params.parentId,
						descriptionHtml: params.description ? toDescriptionHtml(params.description) : undefined,
						priority: params.priority,
					},
					signal,
				),
			);
		},
		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("plane_create_workitem ")) + theme.fg("muted", readArg(args, "name")),
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "plane_update_workitem",
		label: "Plane update work item",
		description: `${PLANE_NOT_PLANNOTATOR} Patch a work item. identifier is MINA-12. stateId is a uuid from plane_list_states (In Progress, Done, …).`,
		promptSnippet: "Update a Plane.so work item (state, body, priority)",
		parameters: Type.Object({
			identifier: Type.String({ description: "MINA-12 or work-item uuid" }),
			projectId: Type.Optional(Type.String({ description: "Required only when identifier is a uuid" })),
			stateId: Type.Optional(Type.String({ description: "State uuid from plane_list_states" })),
			name: Type.Optional(Type.String({ description: "New title" })),
			parentId: Type.Optional(Type.String({ description: "New parent uuid" })),
			description: Type.Optional(Type.String({ description: "Replacement markdown body" })),
			priority: Type.Optional(Priority),
		}),
		prepareArguments: remapArgs,
		async execute(_id, params, signal) {
			return toolResult(
				await updateWorkItem(
					params.identifier,
					params.projectId,
					{
						stateId: params.stateId,
						name: params.name,
						parentId: params.parentId,
						descriptionHtml: params.description ? toDescriptionHtml(params.description) : undefined,
						priority: params.priority,
					},
					signal,
				),
			);
		},
		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("plane_update_workitem ")) + theme.fg("muted", readArg(args, "identifier")),
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "plane_list_states",
		label: "Plane list states",
		description: `${PLANE_NOT_PLANNOTATOR} List workflow states for a project (Backlog, Todo, In Progress, Done, Cancelled) with uuids for plane_update_workitem.`,
		promptSnippet: "List Plane.so states for a project",
		parameters: Type.Object({
			projectId: Type.String({ description: "Project uuid" }),
		}),
		prepareArguments: remapArgs,
		async execute(_id, params, signal) {
			return toolResult(await listStates(params.projectId, signal));
		},
		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("plane_list_states ")) + theme.fg("muted", readArg(args, "projectId")),
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "plane_create_comment",
		label: "Plane comment",
		description: `${PLANE_NOT_PLANNOTATOR} Add a comment on a work item (identifier MINA-12). Plain text is wrapped as HTML.`,
		promptSnippet: "Comment on a Plane.so work item",
		parameters: Type.Object({
			identifier: Type.String({ description: "MINA-12 or work-item uuid" }),
			comment: Type.String({ description: "Comment body (plain text or HTML)" }),
			projectId: Type.Optional(Type.String({ description: "Required only when identifier is a uuid" })),
		}),
		prepareArguments: remapArgs,
		async execute(_id, params, signal) {
			return toolResult(
				await createComment(params.identifier, params.projectId, toCommentHtml(params.comment), signal),
			);
		},
		renderCall(args, theme) {
			return new Text(
				theme.fg("toolTitle", theme.bold("plane_create_comment ")) + theme.fg("muted", readArg(args, "identifier")),
				0,
				0,
			);
		},
	});
}
