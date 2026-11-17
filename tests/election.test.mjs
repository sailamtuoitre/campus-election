import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';
import { compile } from '../scripts/compile.mjs';
let rpc, provider, admin, voter, other, artifact;
before(async () => {
  rpc = ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337, hardfork: 'shanghai' }, wallet: { deterministic: true } });
  provider = new BrowserProvider(rpc); provider.pollingInterval = 10;
  [admin, voter, other] = await Promise.all([0,1,2].map(i => provider.getSigner(i)));
  artifact = await compile();
});
after(async () => { provider?.destroy(); await rpc?.disconnect(); });
async function fresh() {
  const c = await new ContractFactory(artifact.abi, artifact.bytecode, admin).deploy();
  await c.waitForDeployment(); return c;
}
async function ready() {
  const c = await fresh();
  await (await c.registerCandidate('Nguyen Minh Anh')).wait();
  await (await c.registerCandidate('Tran Bao Linh')).wait(); return c;
}
async function reject(action, reason) { await assert.rejects(action, error => String(error.reason || error.message).includes(reason)); }
test('deployer is administrator; election starts closed with no candidates', async () => {
  const c = await fresh(); assert.equal(await c.administrator(), await admin.getAddress());
  assert.equal(await c.votingOpen(), false); assert.equal((await c.getCandidates()).length, 0);
});
test('only administrator can register, open, and close voting', async () => {
  const c = await ready(), outsider = c.connect(voter);
  await reject(() => outsider.registerCandidate.staticCall('Intruder'), 'Administrator only');
  await reject(() => outsider.openVoting.staticCall(), 'Administrator only');
  await (await c.openVoting()).wait();
  await reject(() => outsider.closeVoting.staticCall(), 'Administrator only');
});
test('candidate validation rejects empty, blank, oversized, and duplicate names', async () => {
  const c = await fresh();
  for (const name of ['', 'x'.repeat(81)]) await reject(() => c.registerCandidate.staticCall(name), 'Name must be 1-80 bytes');
  await reject(() => c.registerCandidate.staticCall('   '), 'Name cannot be blank');
  await (await c.registerCandidate('Alice')).wait();
  await reject(() => c.registerCandidate.staticCall('Alice'), 'Candidate already registered');
});
test('opening requires two candidates; redundant state changes are rejected', async () => {
  const c = await fresh();
  await reject(() => c.openVoting.staticCall(), 'Register at least two candidates');
  await reject(() => c.closeVoting.staticCall(), 'Voting already closed');
  await (await c.registerCandidate('Alice')).wait();
  await reject(() => c.openVoting.staticCall(), 'Register at least two candidates');
  await (await c.registerCandidate('Bob')).wait(); await (await c.openVoting()).wait();
  await reject(() => c.openVoting.staticCall(), 'Voting already open');
});
test('votes require open voting and valid candidate IDs', async () => {
  const c = await ready();
  await reject(() => c.connect(voter).vote.staticCall(0), 'Voting is closed');
  await (await c.openVoting()).wait();
  await reject(() => c.connect(voter).vote.staticCall(2), 'Invalid candidate');
  assert.equal(await c.hasVoted(await voter.getAddress()), false);
});
test('two accounts vote independently; repeat vote is mined as reverted without changing totals', async () => {
  const c = await ready(); await (await c.openVoting()).wait();
  const receipt = await (await c.connect(voter).vote(0)).wait();
  assert.equal(c.interface.parseLog(receipt.logs[0]).name, 'VoteCast');
  await reject(() => c.connect(voter).vote.staticCall(1), 'Address already voted');
  const invalid = await c.connect(voter).vote(1, { gasLimit: 150000 });
  await assert.rejects(() => invalid.wait(), e => e.receipt?.status === 0);
  await (await c.connect(other).vote(1)).wait();
  assert.deepEqual((await c.getCandidates()).map(x => x.voteCount), [1n, 1n]);
  assert.equal(await c.totalVotes(), 2n);
});
test('registration stays locked and votes persist after close and reopen', async () => {
  const c = await ready(); await (await c.openVoting()).wait(); await (await c.connect(voter).vote(0)).wait();
  await (await c.closeVoting()).wait();
  await reject(() => c.connect(other).vote.staticCall(0), 'Voting is closed');
  await reject(() => c.registerCandidate.staticCall('Late'), 'Registration closed');
  await (await c.openVoting()).wait();
  await reject(() => c.connect(voter).vote.staticCall(0), 'Address already voted');
  assert.equal(await c.totalVotes(), 1n);
});
test('important changes emit their resulting state', async () => {
  const c = await fresh(); const r = await (await c.registerCandidate('Alice')).wait();
  const event = c.interface.parseLog(r.logs[0]); assert.equal(event.name, 'CandidateRegistered');
  assert.equal(event.args.candidateId, 0n); assert.equal(event.args.name, 'Alice');
  await (await c.registerCandidate('Bob')).wait();
  const opened = await (await c.openVoting()).wait();
  assert.equal(c.interface.parseLog(opened.logs[0]).args.isOpen, true);
  const closed = await (await c.closeVoting()).wait();
  assert.equal(c.interface.parseLog(closed.logs[0]).args.isOpen, false);
});
