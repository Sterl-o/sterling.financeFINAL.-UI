import React, { useMemo } from 'react'
import BigNumber from 'bignumber.js'
import { formatCurrency } from 'utils'
import Hint from 'components/hint'
import classes from './swapDetails.module.css'

export default function SwapDetails({ quote, toAssetValue, slippage }) {
  const [hintAnchor, setHintAnchor] = React.useState(null)

  const handleClickPopover = (event) => {
    setHintAnchor(event.currentTarget)
  }

  const handleClosePopover = () => {
    setHintAnchor(null)
  }

  const openHint = Boolean(hintAnchor)

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
