import ganache from 'ganache';
const server = ganache.server({
  chain: { chainId: 1337, networkId: 1337, hardfork: 'shanghai' },
  wallet: { deterministic: true, totalAccounts: 10, defaultBalance: 1000 },
  logging: { quiet: true }
});
try { await server.listen(7545, '127.0.0.1'); }
catch (error) { console.error(`Cannot start Ganache: ${error.message}`); process.exit(1); }
console.log('Ganache test chain: http://127.0.0.1:7545 | chain ID 1337');
console.log('10 unlocked test accounts. No private keys are needed by the scripts.');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
