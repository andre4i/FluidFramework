/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from 'assert';
import {
	BaseFuzzTestState,
	Generator,
	IRandom,
	chain,
	createWeightedGenerator,
	generatorFromArray,
	makeRandom,
	performFuzzActions,
	take,
} from '@fluid-private/stochastic-test-utils';
import { BenchmarkType, benchmark } from '@fluid-tools/benchmark';
import { validateAssertionError } from '@fluidframework/test-runtime-utils';
import { expect } from 'chai';
import { fail } from '../Common.js';
import { FinalCompressedId, LocalCompressedId, SessionSpaceCompressedId } from '../Identifiers.js';
import { SessionIdNormalizer } from '../id-compressor/SessionIdNormalizer.js';
import { isFinalId, isLocalId } from '../id-compressor/index.js';

describe('SessionIdNormalizer', () => {
	it('fails when adding finals with no corresponding locals', () => {
		const normalizer = makeTestNormalizer();
		assert.throws(
			() => normalizer.addFinalIds(final(0), final(1), dummy),
			(e: Error) => validateAssertionError(e, 'Final IDs must be added to an existing local range.')
		);
	});

	it('fails when adding finals out of order', () => {
		const normalizer = makeTestNormalizer();
		normalizer.addLocalId();
		assert.throws(
			() => normalizer.addFinalIds(final(1), final(0), dummy),
			(e: Error) => validateAssertionError(e, 'Malformed normalization range.')
		);
	});

	it('fails when registering final blocks with no corresponding locals', () => {
		const normalizer = makeTestNormalizer();
		assert.throws(
			() => normalizer.registerFinalIdBlock(final(0), 5, dummy),
			(e: Error) => validateAssertionError(e, 'Final ID block should not be registered before any locals.')
		);
		normalizer.addLocalId();
		addFinalIds(normalizer, final(0), final(0));
		assert.throws(
			() => normalizer.registerFinalIdBlock(final(1), 5, dummy),
			(e: Error) =>
				validateAssertionError(e, 'Final ID block should not be registered without an existing local range.')
		);
	});

	it('fails when registering final blocks with an invalid count', () => {
		const normalizer = makeTestNormalizer();
		normalizer.addLocalId();
		assert.throws(
			() => normalizer.registerFinalIdBlock(final(1), 0, dummy),
			(e: Error) => validateAssertionError(e, 'Malformed normalization block.')
		);
		assert.throws(
			() => normalizer.registerFinalIdBlock(final(1), -1, dummy),
			(e: Error) => validateAssertionError(e, 'Malformed normalization block.')
		);
	});

	it('fails when gaps in finals do not align with a local', () => {
		/**
		 * Locals: [-1, -2,  X,  -4]
		 * Finals: [ 0,  1,  2,   5]
		 * Calling `addFinalIds` with first === last === 9 results in the following:
		 * Locals: [-1, -2,  X,  -4,  X]
		 * Finals: [ 0,  1,  2,   5,  9]
		 *
		 * ^should fail
		 */
		const normalizer = makeTestNormalizer();
		normalizer.addLocalId(); // -1
		normalizer.addLocalId(); // -2
		addFinalIds(normalizer, final(0), final(2));
		normalizer.addLocalId(); // -4
		addFinalIds(normalizer, final(5), final(5));
		assert.throws(
			() => addFinalIds(normalizer, final(9), final(9)),
			(e: Error) => validateAssertionError(e, 'Gaps in final space must align to a local.')
		);
	});

	it('aligns outstanding locals when a block of finals is registered', () => {
		/**
		 * Locals: [-1, -2,  -3,  -4]
		 * Finals: [ 0,  X,   X,   X]
		 * Calling `registerFinalIdBlock` with first === 3, count === 10 results in the following:
		 * Locals: [-1, -2,  -3,  -4]
		 * Finals: [ 0,  3,   4,   5]
		 *
		 */
		const normalizer = makeTestNormalizer();
		const local1 = normalizer.addLocalId(); // -1
		const local2 = normalizer.addLocalId(); // -2
		const local3 = normalizer.addLocalId(); // -3
		const local4 = normalizer.addLocalId(); // -4
		normalizer.addFinalIds(final(0), final(0), dummy);

		normalizer.registerFinalIdBlock(final(3), 10, dummy);
		const locals = [local1, local2, local3, local4];
		for (let i = 1; i < locals.length; i++) {
			const expectedFinal = final(i + 2);
			const finalObj = normalizer.getFinalId(locals[i]);
			if (finalObj === undefined) {
				expect.fail();
			} else {
				expect(finalObj[0]).to.equal(expectedFinal);
			}
		}

		const local5 = normalizer.addLocalId();
		expect(local5).to.equal(-5);
		expect(normalizer.getFinalId(local5)).to.be.undefined;
	});

	it('fails to align a block of finals when there are no outstanding local IDs', () => {
		/**
		 * Locals: [-1,  X]
		 * Finals: [ 0,  1]
		 * Calling `registerFinalIdBlock` with first === 5, count === 10 should fail.
		 */
		const normalizer = makeTestNormalizer();
		normalizer.addLocalId(); // -1
		normalizer.addFinalIds(final(0), final(1), dummy);

		assert.throws(
			() => normalizer.registerFinalIdBlock(final(5), 10, dummy),
			(e: Error) =>
				validateAssertionError(e, 'Final ID block should not be registered without an existing local range.')
		);
	});

	it('fails when attempting to normalize a local ID that was never registered', () => {
		const normalizer = makeTestNormalizer();
		assert.throws(
			() => normalizer.getFinalId(-1 as LocalCompressedId),
			(e: Error) => validateAssertionError(e, 'Local ID was never recorded with this normalizer.')
		);
		const local = normalizer.addLocalId();
		const secondLocal = (local - 1) as LocalCompressedId;
		assert.throws(
			() => normalizer.getFinalId(secondLocal),
			(e: Error) => validateAssertionError(e, 'Local ID was never recorded with this normalizer.')
		);
		addFinalIds(normalizer, final(0), final(5));
		assert.throws(
			() => normalizer.getFinalId(secondLocal),
			(e: Error) => validateAssertionError(e, 'Local ID was never recorded with this normalizer.')
		);
	});

	itWithNormalizer('can normalize IDs with only local forms', (normalizer) => {
		const local1 = normalizer.addLocalId();
		const local2 = normalizer.addLocalId();
		const local3 = normalizer.addLocalId();
		const local4 = normalizer.addLocalId();
		expect(local1).to.equal(-1);
		expect(local2).to.equal(-2);
		expect(local3).to.equal(-3);
		expect(local4).to.equal(-4);
	});

	itWithNormalizer('can normalize IDs with trailing finals', (normalizer) => {
		normalizer.addLocalId();
		addFinalIds(normalizer, final(0), final(1));
		addFinalIds(normalizer, final(2), final(3));
		addFinalIds(normalizer, final(4), final(10));
	});

	itWithNormalizer('can normalize IDs with trailing locals', (normalizer) => {
		normalizer.addLocalId();
		addFinalIds(normalizer, final(0), final(1));
		normalizer.addLocalId();
		normalizer.addLocalId();
	});

	itWithNormalizer('can normalize IDs with a gap in final space', (normalizer) => {
		normalizer.addLocalId();
		normalizer.addLocalId();
		normalizer.addLocalId();
		addFinalIds(normalizer, final(0), final(1));
		addFinalIds(normalizer, final(10), final(11));
	});

	itWithNormalizer('can normalize IDs with and without corresponding local forms', (normalizer) => {
		normalizer.addLocalId(); // -1
		normalizer.addLocalId(); // -2
		normalizer.addLocalId(); // -3
		addFinalIds(normalizer, final(0), final(3));
		normalizer.addLocalId(); // -5
		normalizer.addLocalId(); // -6
		addFinalIds(normalizer, final(4), final(5));
		normalizer.addLocalId(); // -7
		addFinalIds(normalizer, final(8), final(9));
		normalizer.addLocalId(); // -9
		addFinalIds(normalizer, final(14), final(15));
		normalizer.addLocalId(); // -11
		normalizer.addLocalId(); // -12
	});

	itWithNormalizer('can get the last final ID', (normalizer) => {
		normalizer.addLocalId(); // -1
		normalizer.addLocalId(); // -2
		normalizer.addLocalId(); // -3
		normalizer.addLocalId(); // -4
		expect(normalizer.getLastFinalId()).to.be.undefined;
		addFinalIds(normalizer, final(0), final(1));
		expect(normalizer.getLastFinalId()).to.equal(1);
		addFinalIds(normalizer, final(2), final(2));
		expect(normalizer.getLastFinalId()).to.equal(2);
		addFinalIds(normalizer, final(10), final(15));
		expect(normalizer.getLastFinalId()).to.equal(15);
	});

	itWithNormalizer('can normalize IDs after fuzzed inputs', (normalizer) => {
		fuzzNormalizer(normalizer, 1000, 42);
	});
});

describe('SessionIdNormalizer Perf', () => {
	const choiceCount = 1000;
	const type = BenchmarkType.Measurement;
	let normalizer: SessionIdNormalizer<DummyRange>;
	let rand: IRandom;
	let ids: SessionSpaceCompressedId[];
	let finals: FinalCompressedId[];
	let locals: LocalCompressedId[];
	let localChoices: LocalCompressedId[];
	let finalChoices: FinalCompressedId[];
	const before = () => {
		normalizer = new SessionIdNormalizer();
		rand = fuzzNormalizer(normalizer, 10000, 3.14);
		ids = [...normalizer];
		locals = ids.filter<LocalCompressedId>((id): id is LocalCompressedId => isLocalId(id));
		finals = ids.filter((id) => isFinalId(id)) as FinalCompressedId[];
		localChoices = [];
		finalChoices = [];
		for (let i = 0; i < choiceCount; i++) {
			localChoices.push(rand.pick(locals));
			finalChoices.push(rand.pick(finals));
		}
	};

	let localChoice = 0;
	benchmark({
		type,
		title: `normalize a local ID to a final ID`,
		before,
		benchmarkFn: () => {
			normalizer.getFinalId(localChoices[localChoice++ % localChoices.length]);
		},
	});

	let finalChoice = 0;
	benchmark({
		type,
		title: `normalize a final ID to session space`,
		before,
		benchmarkFn: () => {
			normalizer.getSessionSpaceId(finalChoices[finalChoice++ % finalChoices.length]);
		},
	});
});

function itWithNormalizer(title: string, itFn: (normalizer: SessionIdNormalizer<DummyRange>) => void): void {
	it(title, () => {
		const locals: (LocalCompressedId | undefined)[] = [];
		const finals: (FinalCompressedId | undefined)[] = [];
		const normalizer: SessionIdNormalizer<DummyRange> = makeNormalizerProxy(makeTestNormalizer(), locals, finals);

		itFn(normalizer);
		const allIds = [...normalizer];
		let prevLocal: LocalCompressedId | undefined;
		let prevFinal: FinalCompressedId | undefined;
		for (let i = 0; i < locals.length && i < finals.length; i++) {
			const localExpected = locals[i];
			const finalExpected = finals[i];
			// local can be undefined in the case of eager final
			// final can be undefined in the case of trailing locals with no cluster
			// both should never occur
			assert(
				(localExpected !== undefined && isLocalId(localExpected)) ||
					(finalExpected !== undefined && isFinalId(finalExpected))
			);
			if (prevFinal !== undefined && finalExpected !== undefined) {
				assert(finalExpected > prevFinal);
			}
			if (prevLocal !== undefined && localExpected !== undefined) {
				assert(localExpected < prevLocal);
			}
			prevLocal = localExpected;
			prevFinal = finalExpected;

			const sessionIdExpected = localExpected ?? finalExpected;
			const sessionIdActualAll = allIds[i];
			const sessionIdActualNormalized =
				finalExpected === undefined ? localExpected : normalizer.getSessionSpaceId(finalExpected);

			if (finalExpected !== undefined) {
				const creationIndex = normalizer.getCreationIndex(finalExpected);
				expect(creationIndex).to.equal(i);
			}

			const idByIndex = normalizer.getIdByCreationIndex(i);
			expect(idByIndex).to.equal(localExpected ?? finalExpected);

			if (localExpected !== undefined) {
				const normalized = normalizer.getFinalId(localExpected);
				if (normalized === undefined) {
					expect(finalExpected).to.be.undefined;
				} else {
					const [opIdActualNormalized] = normalized;
					expect(opIdActualNormalized).to.equal(finalExpected);
				}
			}
			expect(sessionIdExpected).to.equal(sessionIdActualAll);
			expect(sessionIdActualAll).to.equal(sessionIdActualNormalized);
		}
		expect(normalizer.getLastFinalId()).to.equal(finals[finals.length - 1]);
		const roundtripped = SessionIdNormalizer.deserialize(normalizer.serialize(), () => undefined);
		expect(roundtripped.equals(normalizer)).to.be.true;
	});
}

function addFinalIds(
	normalizer: SessionIdNormalizer<DummyRange>,
	firstFinal: FinalCompressedId,
	lastFinal: FinalCompressedId
): void {
	normalizer.addFinalIds(firstFinal, lastFinal, dummy);
}

function makeNormalizerProxy(
	normalizer: SessionIdNormalizer<DummyRange>,
	locals: (LocalCompressedId | undefined)[],
	finals: (FinalCompressedId | undefined)[]
): SessionIdNormalizer<DummyRange> {
	return new Proxy<SessionIdNormalizer<DummyRange>>(normalizer, {
		get(target, property: keyof SessionIdNormalizer<DummyRange>) {
			if (typeof target[property] === 'function') {
				switch (property) {
					case 'addLocalId': {
						return new Proxy(target[property], {
							apply: (func, thisArg, argumentsList) => {
								const local = Reflect.apply(func, thisArg, argumentsList);
								if (locals.length > 0) {
									for (let i = (locals[locals.length - 1] ?? fail()) - 1; i > local; i--) {
										locals.push(undefined);
									}
								}
								locals.push(local);
								return local;
							},
						});
					}
					case 'addFinalIds': {
						return new Proxy(target[property], {
							apply: (func, thisArg, argumentsList) => {
								const firstFinal: FinalCompressedId = argumentsList[0];
								const lastFinal: FinalCompressedId = argumentsList[1];
								for (let i = firstFinal; i <= lastFinal; i++) {
									finals.push(i);
								}
								return Reflect.apply(func, thisArg, argumentsList);
							},
						});
					}
					case 'registerFinalIdBlock': {
						return new Proxy(target[property], {
							apply: (func, thisArg, argumentsList) => {
								const firstFinal: FinalCompressedId = argumentsList[0];
								const count: FinalCompressedId = argumentsList[1];
								const usedFinals = Math.max(0, Math.min(locals.length - finals.length, count));
								for (let i = firstFinal; i < usedFinals; i++) {
									finals.push(i);
								}
								return Reflect.apply(func, thisArg, argumentsList);
							},
						});
					}
					// No default
				}
			}
			return Reflect.get(target, property);
		},
	});
}

type DummyRange = undefined;
const dummy: DummyRange = undefined;

function final(num: number): FinalCompressedId {
	assert(num >= 0);
	return num as FinalCompressedId;
}

function makeTestNormalizer(): SessionIdNormalizer<DummyRange> {
	return new SessionIdNormalizer<DummyRange>(true);
}

interface AddLocalId {
	type: 'addLocalId';
}

interface AddFinalIds {
	type: 'addFinalIds';
	first: FinalCompressedId;
	last: FinalCompressedId;
}

type Operation = AddLocalId | AddFinalIds;

interface FuzzTestState extends BaseFuzzTestState {
	normalizer: SessionIdNormalizer<DummyRange>;
	prevWasLocal: boolean;
	currentLocal: number;
	currentFinal: number;
	locals: (LocalCompressedId | undefined)[];
	finals: (FinalCompressedId | undefined)[];
}

function makeOpGenerator(numOperations: number): Generator<Operation, FuzzTestState> {
	function addLocalIdGenerator(state: FuzzTestState): AddLocalId {
		const { locals, finals, random } = state;
		state.currentLocal =
			locals.length < finals.length && random.bool()
				? -locals.length - (finals.length - locals.length) - 1
				: -locals.length - 1;
		state.prevWasLocal = true;
		return { type: 'addLocalId' };
	}

	function addFinalIdsGenerator(state: FuzzTestState): AddFinalIds {
		const { locals, finals, random } = state;
		if (state.prevWasLocal && locals.length > finals.length && random.integer(1, 3) === 3) {
			state.currentFinal += random.integer(1, 4);
		}
		const lastFinal = state.currentFinal + random.integer(0, 10);
		const addFinal: AddFinalIds = {
			type: 'addFinalIds',
			first: final(state.currentFinal),
			last: final(lastFinal),
		};
		state.currentFinal = lastFinal + 1;
		state.prevWasLocal = false;
		return addFinal;
	}

	return chain(
		generatorFromArray([{ type: 'addLocalId' }]),
		take(
			numOperations - 1,
			createWeightedGenerator<Operation, FuzzTestState>([
				[addLocalIdGenerator, 8],
				[addFinalIdsGenerator, 2],
			])
		)
	);
}

function fuzzNormalizer(
	normalizerToFuzz: SessionIdNormalizer<DummyRange>,
	numOperations: number,
	seed: number
): IRandom {
	const locals: (LocalCompressedId | undefined)[] = [];
	const finals: (FinalCompressedId | undefined)[] = [];
	const normalizer: SessionIdNormalizer<DummyRange> = makeNormalizerProxy(normalizerToFuzz, locals, finals);

	const initialState: FuzzTestState = {
		random: makeRandom(seed),
		currentLocal: -1,
		currentFinal: 0,
		prevWasLocal: false,
		normalizer,
		locals,
		finals,
	};

	performFuzzActions(
		makeOpGenerator(numOperations),
		{
			addLocalId: (state) => {
				state.normalizer.addLocalId();
				return state;
			},
			addFinalIds: (state, { first, last }) => {
				state.normalizer.addFinalIds(first, last, dummy);
				return state;
			},
		},
		initialState
	);
	return initialState.random;
}
