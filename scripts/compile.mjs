import fs from 'node:fs/promises';
import solc from 'solc';
import { pathToFileURL } from 'node:url';

export async function compile() {
  const source = await fs.readFile(new URL('../contracts/CampusElection.sol', import.meta.url), 'utf8');
  const output = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity', sources: { 'CampusElection.sol': { content: source } },
    settings: { evmVersion: 'shanghai', optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
  })));
  const errors = output.errors?.filter(e => e.severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  const contract = output.contracts['CampusElection.sol'].CampusElection;
  return { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}`, compiler: solc.version() };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile('artifacts/CampusElection.json', JSON.stringify(await compile(), null, 2));
  console.log('Compiled CampusElection for Shanghai EVM.');
}
