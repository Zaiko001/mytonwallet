import type { ApiTxIdBySlug, OnApiUpdate } from '../types';
import type { Storage } from '../storages/types';

import blockchains from '../blockchains';
import { whenTxComplete } from '../common/txCallbacks';
import {
  buildLocalTransaction, resolveBlockchainKey,
} from '../common/helpers';

let onUpdate: OnApiUpdate;
let storage: Storage;

export function initTransactions(_onUpdate: OnApiUpdate, _storage: Storage) {
  onUpdate = _onUpdate;
  storage = _storage;
}

export function fetchTransactions(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getAccountTransactionSlice(storage, accountId);
}

export function fetchTokenTransactionSlice(accountId: string, slug: string, beforeTxId?: string, limit?: number) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getTokenTransactionSlice(storage, accountId, slug, beforeTxId, undefined, limit);
}

export function fetchAllTransactionSlice(accountId: string, lastTxIds: ApiTxIdBySlug, limit: number) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getMergedTransactionSlice(storage, accountId, lastTxIds, limit);
}

export function checkTransactionDraft(
  accountId: string, slug: string, toAddress: string, amount: string, comment?: string,
) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.checkTransactionDraft(storage, accountId, slug, toAddress, amount, comment);
}

export async function submitTransfer(
  accountId: string,
  password: string,
  slug: string,
  toAddress: string,
  amount: string,
  comment?: string,
  fee?: string,
) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const fromAddress = await blockchain.fetchAddress(storage, accountId);
  const result = await blockchain.submitTransfer(
    storage, accountId, password, slug, toAddress, amount, comment,
  );

  if (result) {
    const localTransaction = buildLocalTransaction({
      amount,
      fromAddress,
      toAddress,
      comment,
      fee: fee || '0',
      slug,
    });

    onUpdate({
      type: 'newLocalTransaction',
      transaction: localTransaction,
      accountId,
    });

    whenTxComplete(result.resolvedAddress, result.amount)
      .then(({ txId }) => {
        onUpdate({
          type: 'updateTxComplete',
          accountId,
          toAddress,
          amount,
          txId,
          localTxId: localTransaction.txId,
        });
      });

    return localTransaction.txId;
  }

  return false;
}
