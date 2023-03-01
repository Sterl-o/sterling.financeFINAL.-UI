import React, { useMemo } from 'react'
import BigNumber from 'bignumber.js'
import { formatCurrency } from 'utils'
import Hint from 'components/hint'
import { SwapHorizontalIcon } from 'components/svg'
import classes from './swapDetails.module.css'

export default function SwapDetails({ quote, fromAssetValue, toAssetValue, showInverted, setShowInverted, slippage }) {
  const [hintAnchor, setHintAnchor] = React.useState(null)

  const handleClickPopover = (event) => {
    setHintAnchor(event.currentTarget)
  }

  const handleClosePopover = () => {
    setHintAnchor(null)
  }

  const openHint = Boolean(hintAnchor)

  const rate = useMemo(() => {
    if (showInverted) {
      const value = new BigNumber(quote.output.finalValue)
        .div(quote.inputs.fromAmount)
        .toFixed(18)
      return `1 ${fromAssetValue.symbol} = ${formatCurrency(value)} ${toAssetValue.symbol}`
    }

    const value = new BigNumber(quote.inputs.fromAmount)
      .div(quote.output.finalValue)
      .toFixed(18)
    return `1 ${toAssetValue.symbol} = ${formatCurrency(value)} ${fromAssetValue.symbol}`
  }, [quote, showInverted, fromAssetValue, toAssetValue])

  const minReceived = useMemo(() => {
    return new BigNumber(quote.output.finalValue)
      .times(100 - parseFloat(slippage))
      .div(100)
      .toFixed(toAssetValue.decimals, BigNumber.ROUND_DOWN)
  }, [quote, toAssetValue, slippage])

  return (
    <div className={classes.wrapper}>
      <div className={classes.container}>
        <div className={classes.item}>
          <div>Rate</div>
          <div>
            <span>{rate}</span>
            <div className={classes.iconButton} onClick={() => setShowInverted(pre => !pre)}>
              <SwapHorizontalIcon fontSize={16} />
            </div>
          </div>
        </div>

        <div className={classes.item}>
          <div>
            <span>Minimum Received</span>
            <Hint
              hintText={"Your transaction will revert if there is a large, unfavorable price movement before it is confirmed."}
              open={openHint}
              anchor={hintAnchor}
              handleClick={handleClickPopover}
              handleClose={handleClosePopover}
              vertical={46}
              fill={'currentColor'}
              size={16}
            />
          </div>
          <div>{`${formatCurrency(minReceived)} ${toAssetValue.symbol}`}</div>
        </div>
      </div>
    </div>
  )
}
