/** Plane.so REST client. Not Plannotator. */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type SlimProject = {
	id: string;
	name: string;
	identifier: string;
};

export type SlimState = {
	id: string;
	name: string;
	group: string;
};

export type SlimWorkItem = {
	id: string;
	identifier: string;
	name: string;
	projectId: string;
	priority: string | undefined;
	state: string | SlimState;
	parent: string | undefined;
	descriptionHtml?: string;
};

export type WorkItemPage = {
	items: SlimWorkItem[];
	nextCursor: string | undefined;
	total: number | undefined;
};

const DEFAULT_BASE_URL = "https://api.plane.so";
const DEFAULT_WORKSPACE = "nextnode";
const IDENTIFIER_RE = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function configError(): string | undefined {
	if (!process.env.PLANE_API_KEY) {
		return "PLANE_API_KEY is missing. Export a Plane.so personal access token (Profile → Personal Access Tokens).";
	}
	return undefined;
}

function workspaceSlug(): string {
	return process.env.PLANE_WORKSPACE_SLUG?.trim() || DEFAULT_WORKSPACE;
}

function baseUrl(): string {
	return (process.env.PLANE_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
}

async function planeFetch(
	method: string,
	path: string,
	signal: AbortSignal,
	body?: Record<string, unknown>,
): Promise<Result<unknown>> {
	const missing = configError();
	if (missing) return { ok: false, error: missing };

	const url = `${baseUrl()}/api/v1/workspaces/${workspaceSlug()}${path}`;
	const headers: Record<string, string> = {
		"X-API-Key": process.env.PLANE_API_KEY ?? "",
		Accept: "application/json",
		"User-Agent": "pi-plane-extension/1.0",
	};
	if (body) headers["Content-Type"] = "application/json";

	let response: Response;
	try {
		response = await fetch(url, {
			method,
			headers,
			signal,
			body: body ? JSON.stringify(body) : undefined,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: `Plane.so request failed: ${message}` };
	}

	const text = await response.text();
	let parsed: unknown = undefined;
	if (text.length > 0) {
		try {
			parsed = JSON.parse(text);
		} catch {
			parsed = text;
		}
	}

	if (!response.ok) {
		const detail = isRecord(parsed) ? readString(parsed.error) ?? readString(parsed.detail) : undefined;
		return {
			ok: false,
			error: `Plane.so HTTP ${response.status} on ${method} ${path}${detail ? `: ${detail}` : ""}`,
		};
	}
	return { ok: true, value: parsed };
}

function readState(value: unknown): string | SlimState {
	if (typeof value === "string") return value;
	if (!isRecord(value)) return "unknown";
	const id = readString(value.id) ?? "unknown";
	const name = readString(value.name) ?? id;
	const group = readString(value.group) ?? "";
	return { id, name, group };
}

function slimWorkItem(raw: unknown, fallbackIdentifier?: string): SlimWorkItem | undefined {
	if (!isRecord(raw)) return undefined;
	const id = readString(raw.id);
	const name = readString(raw.name);
	const projectId = readString(raw.project) ?? readString(raw.project_id);
	if (!id || !name || !projectId) return undefined;
	const projectKey = readString(raw.project__identifier);
	const sequence = readNumber(raw.sequence_id);
	const identifier =
		fallbackIdentifier ??
		(projectKey && sequence !== undefined ? `${projectKey}-${sequence}` : id);
	return {
		id,
		identifier,
		name,
		projectId,
		priority: readString(raw.priority),
		state: readState(raw.state),
		parent: readString(raw.parent),
		descriptionHtml: readString(raw.description_html),
	};
}

function slimProject(raw: unknown): SlimProject | undefined {
	if (!isRecord(raw)) return undefined;
	const id = readString(raw.id);
	const name = readString(raw.name);
	const identifier = readString(raw.identifier);
	if (!id || !name || !identifier) return undefined;
	return { id, name, identifier };
}

function slimState(raw: unknown): SlimState | undefined {
	if (!isRecord(raw)) return undefined;
	const id = readString(raw.id);
	const name = readString(raw.name);
	if (!id || !name) return undefined;
	return { id, name, group: readString(raw.group) ?? "" };
}

function readResults(data: unknown): unknown[] {
	if (Array.isArray(data)) return data;
	if (!isRecord(data)) return [];
	if (Array.isArray(data.results)) return data.results;
	if (Array.isArray(data.issues)) return data.issues;
	return [];
}

export async function listProjects(signal: AbortSignal): Promise<Result<SlimProject[]>> {
	const fetched = await planeFetch("GET", "/projects/?per_page=50", signal);
	if (!fetched.ok) return fetched;
	const projects = readResults(fetched.value)
		.map(slimProject)
		.filter((project): project is SlimProject => project !== undefined);
	return { ok: true, value: projects };
}

export async function listStates(projectId: string, signal: AbortSignal): Promise<Result<SlimState[]>> {
	const fetched = await planeFetch("GET", `/projects/${projectId}/states/?per_page=50`, signal);
	if (!fetched.ok) return fetched;
	const states = readResults(fetched.value)
		.map(slimState)
		.filter((state): state is SlimState => state !== undefined);
	return { ok: true, value: states };
}

export async function searchWorkItems(
	query: string,
	projectId: string | undefined,
	limit: number,
	signal: AbortSignal,
): Promise<Result<SlimWorkItem[]>> {
	const params = new URLSearchParams({ search: query, limit: String(limit) });
	if (projectId) params.set("project_id", projectId);
	const fetched = await planeFetch("GET", `/work-items/search/?${params}`, signal);
	if (!fetched.ok) return fetched;
	const items = readResults(fetched.value)
		.map((raw) => slimWorkItem(raw))
		.filter((item): item is SlimWorkItem => item !== undefined);
	return { ok: true, value: items };
}

export async function listWorkItems(
	projectId: string,
	parentId: string | undefined,
	perPage: number,
	cursor: string | undefined,
	signal: AbortSignal,
): Promise<Result<WorkItemPage>> {
	const params = new URLSearchParams({
		per_page: String(perPage),
		expand: "state",
	});
	if (parentId) params.set("parent", parentId);
	if (cursor) params.set("cursor", cursor);
	const fetched = await planeFetch("GET", `/projects/${projectId}/work-items/?${params}`, signal);
	if (!fetched.ok) return fetched;
	if (!isRecord(fetched.value)) return { ok: false, error: "Plane.so list returned a non-object" };
	const project = await projectIdentifier(projectId, signal);
	const items = readResults(fetched.value)
		.map((raw) => {
			if (!isRecord(raw)) return undefined;
			const sequence = readNumber(raw.sequence_id);
			const fallback = project && sequence !== undefined ? `${project}-${sequence}` : undefined;
			return slimWorkItem(raw, fallback);
		})
		.filter((item): item is SlimWorkItem => item !== undefined);
	return {
		ok: true,
		value: {
			items,
			nextCursor: readString(fetched.value.next_cursor),
			total: readNumber(fetched.value.total_results),
		},
	};
}

export async function getWorkItem(
	identifier: string,
	projectId: string | undefined,
	signal: AbortSignal,
): Promise<Result<SlimWorkItem>> {
	const resolved = await resolveWorkItem(identifier, projectId, signal);
	if (!resolved.ok) return resolved;
	const item = slimWorkItem(resolved.value.raw, resolved.value.identifier);
	if (!item) return { ok: false, error: `Plane.so returned an unreadable work item for ${identifier}` };
	return { ok: true, value: item };
}

export async function createWorkItem(
	input: {
		projectId: string;
		name: string;
		parentId?: string;
		descriptionHtml?: string;
		priority?: string;
	},
	signal: AbortSignal,
): Promise<Result<SlimWorkItem>> {
	const body: Record<string, unknown> = { name: input.name };
	if (input.parentId) body.parent = input.parentId;
	if (input.descriptionHtml) body.description_html = input.descriptionHtml;
	if (input.priority) body.priority = input.priority;
	const fetched = await planeFetch("POST", `/projects/${input.projectId}/work-items/`, signal, body);
	if (!fetched.ok) return fetched;
	const project = await projectIdentifier(input.projectId, signal);
	const sequence = isRecord(fetched.value) ? readNumber(fetched.value.sequence_id) : undefined;
	const fallback = project && sequence !== undefined ? `${project}-${sequence}` : undefined;
	const item = slimWorkItem(fetched.value, fallback);
	if (!item) return { ok: false, error: "Plane.so created the work item but the response was unreadable" };
	return { ok: true, value: item };
}

export async function updateWorkItem(
	identifier: string,
	projectId: string | undefined,
	patch: {
		stateId?: string;
		name?: string;
		parentId?: string;
		descriptionHtml?: string;
		priority?: string;
	},
	signal: AbortSignal,
): Promise<Result<SlimWorkItem>> {
	const resolved = await resolveWorkItem(identifier, projectId, signal);
	if (!resolved.ok) return resolved;
	const body: Record<string, unknown> = {};
	if (patch.stateId) body.state = patch.stateId;
	if (patch.name) body.name = patch.name;
	if (patch.parentId) body.parent = patch.parentId;
	if (patch.descriptionHtml) body.description_html = patch.descriptionHtml;
	if (patch.priority) body.priority = patch.priority;
	if (Object.keys(body).length === 0) {
		return { ok: false, error: "plane_update_workitem needs at least one of stateId, name, parentId, description, priority" };
	}
	const fetched = await planeFetch(
		"PATCH",
		`/projects/${resolved.value.projectId}/work-items/${resolved.value.id}/`,
		signal,
		body,
	);
	if (!fetched.ok) return fetched;
	const item = slimWorkItem(fetched.value, resolved.value.identifier);
	if (!item) return { ok: false, error: `Updated ${identifier} but Plane.so returned an unreadable body` };
	return { ok: true, value: item };
}

export async function createComment(
	identifier: string,
	projectId: string | undefined,
	commentHtml: string,
	signal: AbortSignal,
): Promise<Result<{ id: string; identifier: string }>> {
	const resolved = await resolveWorkItem(identifier, projectId, signal);
	if (!resolved.ok) return resolved;
	const fetched = await planeFetch(
		"POST",
		`/projects/${resolved.value.projectId}/work-items/${resolved.value.id}/comments/`,
		signal,
		{ comment_html: commentHtml },
	);
	if (!fetched.ok) return fetched;
	const id = isRecord(fetched.value) ? readString(fetched.value.id) : undefined;
	if (!id) return { ok: false, error: `Commented on ${identifier} but Plane.so returned no comment id` };
	return { ok: true, value: { id, identifier: resolved.value.identifier } };
}

type Resolved = { id: string; projectId: string; identifier: string; raw: unknown };

async function resolveWorkItem(
	identifier: string,
	projectId: string | undefined,
	signal: AbortSignal,
): Promise<Result<Resolved>> {
	const trimmed = identifier.trim();
	if (IDENTIFIER_RE.test(trimmed)) {
		const fetched = await planeFetch("GET", `/work-items/${trimmed}/?expand=state`, signal);
		if (!fetched.ok) return fetched;
		const id = isRecord(fetched.value) ? readString(fetched.value.id) : undefined;
		const project = isRecord(fetched.value) ? readString(fetched.value.project) : undefined;
		if (!id || !project) return { ok: false, error: `Plane.so returned no id/project for ${trimmed}` };
		return { ok: true, value: { id, projectId: project, identifier: trimmed, raw: fetched.value } };
	}
	if (!UUID_RE.test(trimmed)) {
		return {
			ok: false,
			error: `Not a Plane identifier or uuid: "${trimmed}". Use MINA-12 or a work-item uuid.`,
		};
	}
	if (!projectId) {
		return { ok: false, error: `UUID ${trimmed} needs projectId. Prefer the human identifier (MINA-12).` };
	}
	const fetched = await planeFetch(
		"GET",
		`/projects/${projectId}/work-items/${trimmed}/?expand=state`,
		signal,
	);
	if (!fetched.ok) return fetched;
	const projectKey = await projectIdentifier(projectId, signal);
	const sequence = isRecord(fetched.value) ? readNumber(fetched.value.sequence_id) : undefined;
	const human = projectKey && sequence !== undefined ? `${projectKey}-${sequence}` : trimmed;
	return { ok: true, value: { id: trimmed, projectId, identifier: human, raw: fetched.value } };
}

const projectNames = new Map<string, string>();

async function projectIdentifier(projectId: string, signal: AbortSignal): Promise<string | undefined> {
	const cached = projectNames.get(projectId);
	if (cached) return cached;
	const listed = await listProjects(signal);
	if (!listed.ok) return undefined;
	for (const project of listed.value) projectNames.set(project.id, project.identifier);
	return projectNames.get(projectId);
}
