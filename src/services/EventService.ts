import { ethers } from 'ethers';
import { DarkSwap } from '../darkSwap';

export async function getOutEvent(tx: string, abi: any, eventTopic: string, darkSwap: DarkSwap) {
  const iface = new ethers.Interface(abi);
  const receipt = await darkSwap.provider.getTransactionReceipt(tx);
  if (receipt && receipt.logs.length > 0) {
    for (let i = 0; i < receipt.logs.length; i++) {
      const parsedLog = iface.parseLog(receipt.logs[i]);
      if (parsedLog && parsedLog.name == eventTopic) {
        return parsedLog;
      }
    }
  }

  return null;
}
