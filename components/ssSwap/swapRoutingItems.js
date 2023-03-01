import { useMemo } from 'react'
import { ETHERSCAN_URL } from 'stores/constants'
import { FTM_LOGO } from 'stores/constants/contracts'
import { formatCurrency } from 'utils'
import { FirebirdAggregator } from 'utils/firebird'
import CurrencyLogo from 'components/currencyLogo'

import classes from './swapRouting.module.css'

function getLogoURL(address) {
  if (!address) return ''
  if (address.toUpperCase() === 'FTM') return FTM_LOGO
  if (!/^0x/.test(address)) return ''

  return FirebirdAggregator.getTokenLogoURL(address)
}

export function RouteInput({ right = false, token, amount }) {
  return (
    <div className={`${classes.routeInputTokenWrapper} ${right ? classes.flexRowReverse : ''}`}>
      <CurrencyLogo src={token?.logoURI || getLogoURL(token?.address)} width={20} height={20} />

      {token ? <span>{`${formatCurrency(amount)} ${token.symbol}`}</span> : null}
    </div>
  )
}

export function PathPercent({ value, totalPath }) {
  const percent = useMemo(() => {
    if (!value && value !== 0) {
      return null
    }
    const val = totalPath > 1 ? Math.min(99.99, Math.max(0.01, value)) : value
    return parseFloat(val.toFixed(2))
  }, [value, totalPath])

  return (
    <div className={classes.routePathPercent}>
      <span>{totalPath === 1 ? '100%' : `${percent}%`}</span>
    </div>
  )
}

export function HopItem({ token, ...props }) {
  return (
    <div className={classes.routeHop} {...props}>
      <CurrencyLogo src={getLogoURL(token.address)} width={24} height={24} />

      <a
        href={`${ETHERSCAN_URL}token/${token.address}`}
        target="_blank" rel="noreferrer noopener"
      >
        {token.symbol}
      </a>
    </div>
  )
}
