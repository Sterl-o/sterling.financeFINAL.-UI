import { useMemo } from 'react'
import stores from '../stores'

/**
 * @returns {string | undefined} an address
 * */
export default function useAccount() {
  const account = stores.accountStore.getStore('account')

  return useMemo(() => account?.address, [account])
}
