import { BrowserProvider, JsonRpcProvider, Contract } from '/ethers.js';
const $ = id => document.getElementById(id);
let provider, signer, election, config, account, busy = false, session = 0;
function status(message, error = false) { $('status').textContent = message; $('status').dataset.error = String(error); }
function explain(error) { return error.reason || error.shortMessage || error.message || String(error); }
function invalidate() {
  session++; election = undefined; account = undefined;
  if (provider instanceof JsonRpcProvider) provider.destroy();
  provider = undefined; $('account').textContent = 'Reconnect your selected account.';
  $('candidates').replaceChildren(); $('events').replaceChildren(); $('phase').textContent = 'NOT CONNECTED';
  $('total').textContent = '—'; $('eligibility').textContent = 'Test Ether only · No real funds';
  for (const id of ['add','open','close','refresh']) $(id).disabled = true;
}
async function loadConfig() {
  const response = await fetch('/deployment.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Deployment missing. Run npm run deploy, then reconnect.');
  return response.json();
}
$('mode').onchange = async () => {
  invalidate(); const local = $('mode').value === 'local'; $('localAccounts').hidden = !local;
  if (local) {
    const rpc = new JsonRpcProvider('http://127.0.0.1:7545');
    try {
      const accounts = await rpc.send('eth_accounts', []);
      $('localAccounts').replaceChildren(...accounts.map((address, i) => new Option(`Test account ${i} · ${address}`, address)));
      status('Local test mode uses unlocked Ganache accounts. Select one and connect.');
    } catch (error) { status(explain(error), true); } finally { rpc.destroy(); }
  }
};
$('localAccounts').onchange = invalidate;
$('connect').onclick = async () => {
  if (busy) return;
  invalidate(); const token = session;
  try {
    config = await loadConfig();
    if ($('mode').value === 'wallet') {
      if (!window.ethereum) throw new Error('Install a browser wallet or choose Local Ganache test accounts.');
      provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      if (Number((await provider.getNetwork()).chainId) !== config.chainId) throw new Error('Switch your wallet to Ganache: RPC http://127.0.0.1:7545, chain ID 1337.');
      signer = await provider.getSigner();
    } else {
      provider = new JsonRpcProvider('http://127.0.0.1:7545');
      if (Number((await provider.getNetwork()).chainId) !== config.chainId) throw new Error('Expected Ganache chain 1337.');
      signer = await provider.getSigner($('localAccounts').value || 0);
    }
    if (await provider.getCode(config.address) === '0x') throw new Error('Contract missing on this chain. Deploy again and reconnect.');
    if (token !== session) return;
    account = await signer.getAddress(); election = new Contract(config.address, config.abi, signer);
    $('account').textContent = account;
    $('contract').textContent = `Contract: ${config.address} | Administrator: ${config.administrator}`;
    await refresh(); status('Connected. Election state loaded from Ganache.');
  } catch (error) { invalidate(); status(explain(error), true); }
};
async function refresh() {
  if (!election) return;
  const token = session, current = election;
  const [list, open, locked, total, voted, administrator] = await Promise.all([
    current.getCandidates(), current.votingOpen(), current.registrationClosed(), current.totalVotes(), current.hasVoted(account), current.administrator()
  ]);
  if (token !== session) return;
  const admin = account.toLowerCase() === administrator.toLowerCase();
  $('phase').textContent = open ? 'VOTING OPEN' : locked ? 'VOTING CLOSED' : 'REGISTRATION';
  $('total').textContent = total.toString();
  $('eligibility').textContent = voted ? 'Your vote is recorded. This address cannot vote again.' : 'This address has not voted.';
  $('adminNote').textContent = admin ? 'You are the administrator of this election.' : 'Only the deployer can register candidates and control voting.';
  $('add').disabled = busy || !admin || locked;
  $('open').disabled = busy || !admin || open || list.length < 2;
  $('close').disabled = busy || !admin || !open;
  $('refresh').disabled = busy;
  $('candidates').replaceChildren();
  if (!list.length) { const p = document.createElement('p'); p.textContent = 'No candidates yet. The administrator must register at least two.'; $('candidates').append(p); }
  list.forEach((candidate, id) => {
    const card = document.createElement('article'); card.className = 'candidate';
    const number = document.createElement('span'); number.className = 'number'; number.textContent = String(id + 1).padStart(2, '0');
    const name = document.createElement('h3'); name.textContent = candidate.name;
    const votes = document.createElement('p'); votes.className = 'votes'; votes.textContent = `${candidate.voteCount} `;
    const caption = document.createElement('small'); caption.textContent = 'VOTES'; votes.append(caption);
    const button = document.createElement('button'); button.textContent = voted ? 'Vote recorded ✓' : 'Cast your vote ↗';
    button.disabled = busy || !open || voted; button.onclick = () => transact(`Vote for ${candidate.name}`, () => current.vote(id));
    card.append(number, name, votes, button); $('candidates').append(card);
  });
  // Read the RPC head directly so ethers' short block-number cache cannot hide
  // the event from a transaction that has just been confirmed.
  const head = Number(await provider.send('eth_blockNumber', []));
  const logs = await current.queryFilter('*', config.deploymentBlock, head);
  if (token !== session) return;
  $('events').replaceChildren(...logs.slice(-20).reverse().map(log => {
    const item = document.createElement('li');
    const parsed = current.interface.parseLog(log);
    item.textContent = `Block ${log.blockNumber} · ${parsed.name} (${parsed.args.map(String).join(', ')}) · ${log.transactionHash}`;
    return item;
  }));
}
async function transact(label, send) {
  if (busy || !election) return;
  busy = true; $('connect').disabled = true; $('mode').disabled = true; $('localAccounts').disabled = true;
  try {
    await refresh(); status(`${label}: awaiting wallet approval…`);
    const tx = await send(); status(`${label}: pending · ${tx.hash}`);
    const receipt = await tx.wait(); status(`${label}: confirmed in block ${receipt.blockNumber} · ${receipt.hash}`);
  } catch (error) { status(`${label}: rejected · ${explain(error)}`, true); }
  finally {
    busy = false; $('connect').disabled = false; $('mode').disabled = false; $('localAccounts').disabled = false;
    try { await refresh(); } catch (error) { status(explain(error), true); }
  }
}
$('register').onsubmit = event => { event.preventDefault(); const name = $('name').value.trim(); if (name) transact('Register candidate', () => election.registerCandidate(name)); };
$('open').onclick = () => transact('Open voting', () => election.openVoting());
$('close').onclick = () => transact('Close voting', () => election.closeVoting());
$('refresh').onclick = () => refresh().catch(error => status(explain(error), true));
if (window.ethereum?.on) {
  for (const event of ['accountsChanged','chainChanged','disconnect']) window.ethereum.on(event, () => {
    if ($('mode').value === 'wallet') { invalidate(); status('Wallet changed. Reconnect to reload the correct chain and account.'); }
  });
}
