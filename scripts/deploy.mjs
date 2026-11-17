import fs from 'node:fs/promises';
import { ContractFactory, JsonRpcProvider } from 'ethers';
import { compile } from './compile.mjs';
const provider = new JsonRpcProvider('http://127.0.0.1:7545');
try {
  if ((await provider.getNetwork()).chainId !== 1337n) throw new Error('Expected local Ganache chain 1337');
  const artifact = await compile();
  const signer = await provider.getSigner(0);
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy();
  const receipt = await contract.deploymentTransaction().wait();
  const config = { address: await contract.getAddress(), administrator: await signer.getAddress(),
    chainId: 1337, deploymentBlock: receipt.blockNumber, abi: artifact.abi };
  await fs.writeFile('web/deployment.json', JSON.stringify(config, null, 2));
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile('artifacts/CampusElection.json', JSON.stringify(artifact, null, 2));
  console.log(`Deployed: ${config.address}\nAdministrator: ${config.administrator}\nTransaction: ${receipt.hash}`);
} finally { provider.destroy(); }
