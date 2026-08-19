import assert from "node:assert/strict";
import { parseEvaluatorText, updateProofLedger } from "../extensions/goal.ts";

function testCumulativeProofsAreParsed(): void {
	const result = parseEvaluatorText(
		JSON.stringify({
			verdict: "not_yet",
			reason: "One gate remains.",
			proofs: ["make pi exited 0", "searcher.md is absent"],
			invalidatedProofs: [],
		}),
	);

	assert.deepEqual(result, {
		ok: true,
		verdict: "not_yet",
		reason: "One gate remains.",
		proofs: ["make pi exited 0", "searcher.md is absent"],
		invalidatedProofs: [],
	});
}

function testProofsAreRequired(): void {
	const result = parseEvaluatorText(
		JSON.stringify({ verdict: "met", reason: "Done without a proof ledger." }),
	);
	assert.deepEqual(result, { ok: false, reason: "Evaluator proof updates are missing or invalid." });
}

function testProofLedgerIsBoundedAndDeduplicated(): void {
	const proofs = Array.from({ length: 45 }, (_, index) => `${index}: ${"x".repeat(600)}`);
	proofs.push(proofs[0] ?? "");
	const result = parseEvaluatorText(
		JSON.stringify({ verdict: "not_yet", reason: "More", proofs, invalidatedProofs: [] }),
	);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.proofs.length, 32);
	assert.equal(new Set(result.proofs).size, 32);
	assert.equal(result.proofs.every((proof) => proof.length <= 300), true);
	assert.equal(result.proofs.some((proof) => proof.startsWith("44:")), true);
	assert.equal(result.proofs.some((proof) => proof.startsWith("1:")), false);
}

function testLedgerUpdatesAreCodeEnforced(): void {
	const current = ["old proof", "keep proof"];
	assert.deepEqual(updateProofLedger(current, [], []), current);
	const updated = updateProofLedger(current, ["new\nproof", "keep proof"], ["old proof"]);
	assert.deepEqual(updated, ["new proof", "keep proof"]);
}

const tests: Array<[string, () => void]> = [
	["cumulative proofs are parsed", testCumulativeProofsAreParsed],
	["proofs are required", testProofsAreRequired],
	["proof ledger is bounded and deduplicated", testProofLedgerIsBoundedAndDeduplicated],
	["ledger updates are code-enforced", testLedgerUpdatesAreCodeEnforced],
];

for (const [name, test] of tests) {
	test();
	console.log(`ok  ${name}`);
}
console.log(`${tests.length} passed`);
