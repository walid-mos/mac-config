import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  NotificationPoster,
  createPiNotifyExtension,
  extractFinalSnippet,
  notificationEnabled,
  type ChildProcessLike,
  type NotificationEnvironment,
  type NotificationOperations,
} from "../extensions/pi-notify.ts";

const HELPER = "/Applications/Pi.app/Contents/MacOS/pi-notify";
const NOTIFIER = "/opt/homebrew/bin/terminal-notifier";
const OPEN = "/usr/bin/open";
const PKILL = "/usr/bin/pkill";
const ENVIRONMENT: NotificationEnvironment = {
  HERDR_ENV: "1",
  HERDR_PANE_ID: "pane-1",
  HERDR_SOCKET_PATH: "/tmp/herdr.sock",
};

type SpawnCall = {
  command: string;
  args: readonly string[];
  options: Record<string, unknown>;
  child: FakeChild;
};

class FakeChild extends EventEmitter {
  unrefCalled = false;

  unref(): void {
    this.unrefCalled = true;
  }
}

class FakeOperations implements NotificationOperations {
  readonly calls: SpawnCall[] = [];
  readonly available = new Set<string>();
  throwOnSpawn = false;

  exists(file: string): boolean {
    return this.available.has(file);
  }

  spawn(command: string, args: readonly string[], options: Record<string, unknown>): ChildProcessLike {
    if (this.throwOnSpawn) throw new Error("synchronous spawn failure");
    const child = new FakeChild();
    this.calls.push({ command, args: [...args], options, child });
    return child as unknown as ChildProcessLike;
  }
}

function request(pane = "pane-1", message = "Ready") {
  return { pane, socket: `/tmp/${pane}.sock`, title: `Pi ${pane}`, message };
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function close(call: SpawnCall, code = 0): void {
  call.child.emit("close", code, null);
}

test("activation requires Herdr context and at least one poster", () => {
  const operations = new FakeOperations();
  assert.equal(notificationEnabled(ENVIRONMENT, operations), false);

  operations.available.add(HELPER);
  assert.equal(notificationEnabled(ENVIRONMENT, operations), true);
  assert.equal(notificationEnabled({ ...ENVIRONMENT, HERDR_ENV: "0" }, operations), false);
  assert.equal(notificationEnabled({ ...ENVIRONMENT, HERDR_PANE_ID: "" }, operations), false);
  assert.equal(notificationEnabled({ ...ENVIRONMENT, HERDR_SOCKET_PATH: undefined }, operations), false);

  operations.available.clear();
  operations.available.add(NOTIFIER);
  assert.equal(notificationEnabled(ENVIRONMENT, operations), true);
});

test("native helper kills the pane resident before opening Pi.app", async () => {
  const operations = new FakeOperations();
  operations.available.add(HELPER);
  const poster = new NotificationPoster(operations);
  poster.notify(request("pane-native", "Native body"));
  await flush();

  assert.equal(operations.calls[0]?.command, PKILL);
  assert.match(operations.calls[0]?.args[1] ?? "", /pane-native/);
  close(operations.calls[0]);
  await flush();

  const open = operations.calls[1];
  assert.equal(open?.command, OPEN);
  assert.equal(open?.options.detached, true);
  assert.equal(open?.options.stdio, "ignore");
  assert.equal(open?.child.unrefCalled, true);
  assert.deepEqual(open?.args.slice(0, 4), ["-n", "/Applications/Pi.app", "--args", "-title"]);
  assert.ok(open?.args.includes("Native body"));
  assert.ok(open?.args.includes("/tmp/pane-native.sock"));

  close(open);
  await poster.waitForIdle("pane-native");
});

test("terminal-notifier fallback is grouped by pane and focuses the exact Herdr socket", () => {
  const operations = new FakeOperations();
  operations.available.add(NOTIFIER);
  const poster = new NotificationPoster(operations);
  poster.notify(request("pane-fallback", "Fallback body"));

  const call = operations.calls[0];
  assert.equal(call?.command, NOTIFIER);
  assert.equal(call?.options.detached, true);
  assert.equal(call?.child.unrefCalled, true);
  assert.deepEqual(call?.args.slice(-4, -2), ["-group", "pi-pane-fallback"]);
  assert.match(call?.args.at(-1) ?? "", /HERDR_SOCKET_PATH='\/tmp\/pane-fallback\.sock'/);
  assert.match(call?.args.at(-1) ?? "", /agent focus 'pane-fallback'/);
});

test("asynchronous ChildProcess errors are always observed", () => {
  const operations = new FakeOperations();
  operations.available.add(NOTIFIER);
  const poster = new NotificationPoster(operations);
  poster.notify(request());

  assert.doesNotThrow(() => operations.calls[0]?.child.emit("error", new Error("ENOENT")));
});

test("synchronous spawn errors are absorbed", () => {
  const operations = new FakeOperations();
  operations.available.add(NOTIFIER);
  operations.throwOnSpawn = true;
  const poster = new NotificationPoster(operations);
  assert.doesNotThrow(() => poster.notify(request()));
});

test("simultaneous same-pane calls collapse to the latest replacement", async () => {
  const operations = new FakeOperations();
  operations.available.add(HELPER);
  const poster = new NotificationPoster(operations);

  poster.notify(request("pane-simultaneous", "old"));
  poster.notify(request("pane-simultaneous", "latest"));
  await flush();
  const kills = operations.calls.filter((call) => call.command === PKILL);
  assert.equal(kills.length, 1);
  close(kills[0]);
  await flush();

  const opens = operations.calls.filter((call) => call.command === OPEN);
  assert.equal(opens.length, 1);
  assert.ok(opens[0]?.args.includes("latest"));
  close(opens[0]);
  await poster.waitForIdle("pane-simultaneous");
});

test("a stale same-pane replacement cannot launch its helper", async () => {
  const operations = new FakeOperations();
  operations.available.add(HELPER);
  const poster = new NotificationPoster(operations);

  poster.notify(request("pane-race", "old"));
  await flush();
  const oldKill = operations.calls[0];
  poster.notify(request("pane-race", "new"));
  close(oldKill);
  await flush();

  assert.equal(operations.calls.filter((call) => call.command === OPEN).length, 0);
  const newKill = operations.calls[1];
  assert.equal(newKill?.command, PKILL);
  close(newKill);
  await flush();

  const opens = operations.calls.filter((call) => call.command === OPEN);
  assert.equal(opens.length, 1);
  assert.ok(opens[0]?.args.includes("new"));
  close(opens[0]);
  await poster.waitForIdle("pane-race");
});

test("different panes have independent replacement queues", async () => {
  const operations = new FakeOperations();
  operations.available.add(HELPER);
  const poster = new NotificationPoster(operations);

  poster.notify(request("pane-a"));
  poster.notify(request("pane-b"));
  await flush();
  const kills = operations.calls.filter((call) => call.command === PKILL);
  assert.equal(kills.length, 2);

  close(kills[0]);
  await flush();
  const openA = operations.calls.find((call) => call.command === OPEN);
  assert.ok(openA?.args.includes("pane-a"));
  assert.equal(operations.calls.filter((call) => call.command === OPEN).length, 1);

  close(kills[1]);
  await flush();
  const opens = operations.calls.filter((call) => call.command === OPEN);
  assert.equal(opens.length, 2);
  assert.ok(opens[1]?.args.includes("pane-b"));
  opens.forEach((call) => close(call));
  await Promise.all([poster.waitForIdle("pane-a"), poster.waitForIdle("pane-b")]);
});

test("one pane accepts unlimited successive notifications", async () => {
  const operations = new FakeOperations();
  operations.available.add(HELPER);
  const poster = new NotificationPoster(operations);

  for (const message of ["first", "second", "third"]) {
    poster.notify(request("pane-repeat", message));
    await flush();
    const kill = operations.calls.at(-1)!;
    assert.equal(kill.command, PKILL);
    close(kill);
    await flush();
    const open = operations.calls.at(-1)!;
    assert.equal(open.command, OPEN);
    assert.ok(open.args.includes(message));
    close(open);
    await poster.waitForIdle("pane-repeat");
  }

  assert.equal(operations.calls.filter((call) => call.command === OPEN).length, 3);
});

type Handler = (event: any, ctx: any) => void;

function requiredHandler(handlers: Map<string, Handler>, name: string): Handler {
  const handler = handlers.get(name);
  assert.ok(handler, `missing ${name} handler`);
  return handler;
}

function loadExtension(environment = ENVIRONMENT) {
  const operations = new FakeOperations();
  operations.available.add(HELPER);
  const notifications: Array<{ pane: string; socket: string; title: string; message: string }> = [];
  const handlers = new Map<string, Handler>();
  const poster = { notify: (value: (typeof notifications)[number]) => notifications.push(value) };
  const pi = { on: (event: string, handler: Handler) => handlers.set(event, handler) };

  createPiNotifyExtension({
    environment,
    operations,
    poster: poster as unknown as NotificationPoster,
    processCwd: () => "/fallback/project",
  })(pi);
  return { handlers, notifications, operations };
}

test("disabled extension registers no handlers", () => {
  const { handlers, operations } = loadExtension({ ...ENVIRONMENT, HERDR_ENV: "0" });
  operations.available.clear();
  assert.equal(handlers.size, 0);
});

test("agent completion notifies exactly once with the final snippet", () => {
  const { handlers, notifications } = loadExtension();
  requiredHandler(handlers, "agent_start")({}, { mode: "tui" });
  requiredHandler(handlers, "message_end")({
    message: { role: "assistant", content: [{ type: "text", text: "  Work\n complete  " }] },
  }, {});
  const context = { mode: "tui", cwd: "/work/repository", isIdle: () => true };
  const settled = requiredHandler(handlers, "agent_settled");
  settled({}, context);
  settled({}, context);

  assert.deepEqual(notifications, [{
    pane: "pane-1",
    socket: "/tmp/herdr.sock",
    title: "Pi · repository — terminé",
    message: "Work complete",
  }]);
});

test("ask_user_question emits the decision notification", () => {
  const { handlers, notifications } = loadExtension();
  requiredHandler(handlers, "tool_execution_start")(
    { toolName: "ask_user_question" },
    { mode: "tui", cwd: "/work/repository" },
  );
  assert.equal(notifications.length, 1);
  const notification = notifications[0];
  assert.ok(notification);
  assert.match(notification.title, /décision requise/);
  assert.equal(notification.message, "Une question attend ton choix");
});

test("all notification hooks are guarded by TUI mode", () => {
  const { handlers, notifications } = loadExtension();
  requiredHandler(handlers, "agent_start")({}, { mode: "rpc" });
  requiredHandler(handlers, "agent_settled")({}, { mode: "rpc", isIdle: () => true });
  requiredHandler(handlers, "tool_execution_start")(
    { toolName: "ask_user_question" },
    { mode: "json" },
  );
  assert.deepEqual(notifications, []);
});

test("final snippet keeps text parts, normalizes whitespace, and truncates at 160 characters", () => {
  const text = `  first\npart  ${"x".repeat(200)}`;
  const snippet = extractFinalSnippet({
    role: "assistant",
    content: [
      { type: "thinking", text: "secret" },
      { type: "text", text },
      { type: "text", text: "tail" },
    ],
  });
  assert.equal(snippet.length, 160);
  assert.match(snippet, /^first part x+/);
  assert.equal(snippet.includes("secret"), false);
  assert.equal(extractFinalSnippet({ role: "user", content: [{ type: "text", text: "no" }] }), "");
});
