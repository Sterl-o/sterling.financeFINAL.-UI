import { useMemo } from 'react'
import useDebounce from 'hooks/useDebounce'
import { FirebirdAggregator } from 'utils/firebird'

import { HopItem, PathPercent, RouteInput } from './swapRoutingItems'
import classes from './swapRouting.module.css'

function DrawRouting({ data }) {
  return (
    <div className={classes.routeBody}>
      {data.routes.map(({ path, subRoutes, swapPercent }, index) => {
        const key = path.map((p) => p.symbol).join('-')
        return (
          <div
            key={key}
            className={`${classes.routePath} ${index < data.routes.length - 1 ? classes.routePathMore : ''}`}
          >
            <div className={classes.routeHopsWrapper}>
              <div className={`${classes.routeHops} ${path.length <= 2 ? classes.routeHopsSpace : ''}`}>
                <PathPercent value={swapPercent} totalPath={data.routes.length} />

                {path.map((asset, j) => {
                  if (j === 0) return null
                  const pools = Array.isArray(subRoutes[j - 1]) ? subRoutes[j - 1] : null
                  const poolIds = pools
                    ? pools.map(r => `${r.dex}-${r.pool}`).join('_')
                    : `${key}_${asset.symbol}`

                  return (
                    <HopItem
                      key={poolIds}
                      data-pools={poolIds}
                      token={asset}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function SwapRouting({ quote, fromAsset, toAsset }) {
  const debouncedFromAsset = useDebounce(fromAsset, 300)
  const debouncedToAsset = useDebounce(toAsset, 300)

  const data = useMemo(
    () => FirebirdAggregator.getTradeComposition(quote, debouncedFromAsset, debouncedToAsset) || {},
    [quote, debouncedFromAsset, debouncedToAsset]
  )

  return (
    <div className={classes.routeRoot}>
      <div className={classes.rootCorner}>
        <span />
        <span />
      </div>

      <div className={classes.routeContainer}>
        <div className={classes.bgRouteContainer} />
        <h2>Routing</h2>

        <div className={!!quote?.inputs?.wrapType ? classes.routeFormWrap : ''}>
          <div className={classes.routeHeader}>
            <RouteInput token={data.fromAsset} amount={data.fromAmount} />
            <RouteInput token={data.toAsset} amount={data.toAmount} right />
          </div>

          {data.routes?.length ? <DrawRouting data={data} /> : null}
        </div>
      </div>

      <div className={classes.rootCornerInverted}>
        <span />
        <span />
      </div>
    </div>
  )
}
