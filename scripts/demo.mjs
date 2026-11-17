import fs from 'node:fs/promises';
import { Contract, JsonRpcProvider } from 'ethers';
const config = JSON.parse(await fs.readFile('web/deployment.json', 'utf8'));
const provider = new JsonRpcProvider('http://127.0.0.1:7545'); provider.pollingInterval = 50;
const evidence = [];
try {
  if ((await provider.getNetwork()).chainId !== 1337n) throw new Error('Expected Ganache 1337');
  const admin = await provider.getSigner(0), voter = await provider.getSigner(1);
  const c = new Contract(config.address, config.abi, admin);
  if ((await c.getCandidates()).length) throw new Error('Demo requires a fresh deployment. Run npm run deploy.');
  async function send(label, promise) {
    const tx = await promise; const receipt = await tx.wait();
    evidence.push({ label, account: tx.from, transaction: receipt.hash, block: receipt.blockNumber, status: receipt.status });
    console.log(`PASS: ${label} · ${receipt.hash}`);
  }
  async function rejected(label, method, args, reason) {
    try { await method.staticCall(...args); throw new Error('Unexpected success'); }
    catch (error) { if (!(error.reason || error.message).includes(reason)) throw error; }
    const tx = await method(...args, { gasLimit: 200000 });
    try { await tx.wait(); throw new Error('Unexpected mined success'); }
    catch (error) {
      if (error.receipt?.status !== 0) throw error;
      evidence.push({ label, account: tx.from, transaction: tx.hash, block: error.receipt.blockNumber, status: 0, reason });
      console.log(`EXPECTED REJECTION: ${label} · ${reason} · ${tx.hash}`);
    }
  }
  await send('Administrator registers Nguyen Minh Anh', c.registerCandidate('Nguyen Minh Anh'));
  await send('Administrator registers Tran Bao Linh', c.registerCandidate('Tran Bao Linh'));
  await rejected('Account 1 cannot open voting', c.connect(voter).openVoting, [], 'Administrator only');
  await send('Administrator opens voting', c.openVoting());
  await send('Account 1 votes for candidate 0', c.connect(voter).vote(0));
  await rejected('Account 1 cannot vote twice', c.connect(voter).vote, [1], 'Address already voted');
  await send('Account 0 votes independently for candidate 1', c.vote(1));
  await send('Administrator closes voting', c.closeVoting());
  await rejected('Candidate registration remains fixed', c.registerCandidate, ['Late candidate'], 'Registration closed');
  const results = (await c.getCandidates()).map(x => ({ name: x.name, votes: Number(x.voteCount) }));
  await fs.mkdir('evidence', { recursive: true });
  await fs.writeFile('evidence/demo-results.json', JSON.stringify({ contract: config.address, chainId: 1337, results, evidence }, null, 2));
  console.log(JSON.stringify(results));
} finally { provider.destroy(); }
