import BigNumber from 'bignumber.js'
import Web3 from 'web3'
import { FTM_ADDRESS, WFTM_ADDRESS, WFTM_DECIMALS, WFTM_NAME, WFTM_SYMBOL } from 'stores/constants/contracts'
import { DEX_ID, NATIVE_ADDRESS } from './constants'

const ZERO = new BigNumber(0)

const WrappedToken = {
  address: WFTM_ADDRESS,
  decimals: WFTM_DECIMALS,
  name: WFTM_NAME,
  symbol: WFTM_SYMBOL
}

class Token {
  constructor(address, decimals, symbol, name = '') {
    this.address = Web3.utils.toChecksumAddress(address)
    this.decimals = decimals
    this.symbol = symbol
    this.name = name
  }
}

function Percent(numerator, denominator) {
  return new BigNumber(numerator).div(denominator).multipliedBy(100)
}

function formatRoutes(routes) {
  if (!routes.length) {
    return []
  }
  try {
    let itemIndex = -1
    const routesGroup = routes.reduce((a, b) => {
      let index
      let subRoutes = []
      let swapPercent = (b.pools && b.pools[0]?.swapPercent) || 0
      if (a[b.slug]) {
        const route = a[b.slug] || {}
        ;({ index } = route)
        const temp = route.subRoutes || []
        swapPercent += route.swapPercent || 0
        temp.forEach((sub, ind) => {
          const swapPool = (b.pools && b.pools[ind]) || ({})
          const totalSwapAmount = sub
            .reduce((sum, x2) => sum.plus(x2.swapAmount || ZERO), ZERO)
            .plus(swapPool.swapAmount || ZERO)
          // merge hops with same dex
          let existed = false
          const newSub = sub.map((pool) => {
            const p2 = { ...pool }
            const same = p2.pool === swapPool.pool
            let swapAmount = p2.swapAmount || ZERO
            if (same) {
              existed = true
              swapAmount = swapAmount.plus(swapPool.swapAmount || ZERO)
            }
            const percent = new Percent(swapAmount, totalSwapAmount).decimalPlaces(0, BigNumber.ROUND_HALF_UP)
            p2.swapPercent = percent.toNumber()
            p2.total = totalSwapAmount.toString()
            return p2
          })
          if (!existed) {
            const percent = new Percent(swapPool.swapAmount || ZERO, totalSwapAmount).decimalPlaces(0, BigNumber.ROUND_HALF_UP)
            newSub.push({ ...swapPool, swapPercent: percent.toNumber() })
          }
          subRoutes[ind] = newSub
        })
      } else {
        itemIndex += 1
        index = itemIndex
        subRoutes = b.pools.map((p) => [{ ...p, swapPercent: 100 }])
      }
      return {
        ...a,
        [b.slug]: {
          index,
          swapPercent: new BigNumber(swapPercent).decimalPlaces(0, BigNumber.ROUND_HALF_EVEN).toNumber(),
          path: b.path,
          subRoutes
        }
      }
    }, {})

    const routesV2Length = Object.keys(routesGroup).length
    const routesV2 = new Array(routesV2Length).map(() => ({}))

    let sum = 0
    Object.values(routesGroup).forEach((route, i) => {
      if (route.index > routesV2Length) return
      routesV2.splice(route.index, 1, {
        swapPercent: i === routesV2Length - 1 ? (100 - sum) : route.swapPercent,
        path: route.path,
        subRoutes: route.subRoutes,
      })
      sum += route.swapPercent
    })
    if (Math.abs(sum - 100) > 1) {
      console.warn('@route percentage is wrong', sum)
    }
    return routesV2
  } catch (e) {
    console.error('formatRoutes:', e)
    return null
  }
}

function wrapCurrency(address) {
  const currencyIsNative = address?.toUpperCase() === FTM_ADDRESS
  const token = currencyIsNative ? NATIVE_ADDRESS : address
  const wrappedToken = currencyIsNative ? WFTM_ADDRESS : address
  return { token, wrappedToken, currencyIsNative }
}

function mockFirebirdReturn(quote) {
  try {
    const { output = {}, inputs = {} } = quote
    const fromAddress = inputs.fromAsset?.address
    const toAddress = inputs.toAsset?.address
    const { token: from, wrappedToken: wrappedFrom, currencyIsNative: currencyAIsNative } = wrapCurrency(fromAddress)
    const { token: to, wrappedToken: wrappedTo, currencyIsNative: currencyBIsNative } = wrapCurrency(toAddress)

    const tokens = {}
    if (wrappedFrom) {
      tokens[wrappedFrom] = currencyAIsNative ? WrappedToken : inputs.fromAsset
      tokens[wrappedTo] = currencyBIsNative ? WrappedToken : inputs.toAsset
    }
    const routeAssetAddress = output?.routeAsset?.address
    const routeAssetAddress2 = output?.routeAsset2?.address
    if (routeAssetAddress) {
      tokens[routeAssetAddress] = output.routeAsset
    }
    if (routeAssetAddress2) {
      tokens[routeAssetAddress2] = output.routeAsset2
    }
    const path = {
      amountFrom: new BigNumber(inputs.fromAmount).multipliedBy(10 ** inputs.fromAsset?.decimals).toFixed(0),
      amountTo: new BigNumber(output.finalValue).multipliedBy(10 ** inputs.toAsset?.decimals).toFixed(0),
      swaps: []
    }
    path.swaps.push({
      amountFrom: path.amountFrom,
      dex: DEX_ID,
      from: wrappedFrom,
      pool: wrappedFrom,
      to: routeAssetAddress || wrappedTo,
    })
    if (routeAssetAddress) {
      path.swaps.push({
        amountFrom: '0',
        dex: DEX_ID,
        from: routeAssetAddress,
        pool: routeAssetAddress,
        to: routeAssetAddress2 || wrappedTo,
      })
    }
    if (routeAssetAddress2) {
      path.swaps.push({
        amountFrom: '0',
        dex: DEX_ID,
        from: routeAssetAddress2,
        pool: routeAssetAddress2,
        to: wrappedTo,
      })
    }

    return {
      from,
      paths: [path],
      to,
      tokens,
      totalFrom: path.amountFrom,
      totalTo: path.amountTo,
    }
  } catch (e) {
    console.error('Can\'t mock quote data:', e)
  }
  return null
}

function formatAsset(_asset) {
  const asset = _asset
  if (asset && typeof asset.decimals === 'string') {
    asset.decimals = parseInt(asset.decimals)
  }
  return asset
}

export function getTradeComposition(quote, _fromAsset, _toAsset) {
  const { output: baseOutput, inputs } = quote || {}

  const fromAsset = formatAsset(_fromAsset)
  const toAsset = formatAsset(_toAsset)

  const result = {
    fromAsset,
    toAsset,
    fromAmount: inputs?.fromAmount,
    toAmount: baseOutput?.finalValue,
  }

  let output = baseOutput ? { ...baseOutput } : {}
  let maxReturn
  if (Array.isArray(output.routes) && output.routes.length) {
    maxReturn = mockFirebirdReturn(quote)
  } else if (output.firebirdQuote) {
    maxReturn = output.firebirdQuote?.quoteData?.maxReturn
  }

  if (!maxReturn?.totalTo || !maxReturn.paths?.length) {
    return result
  }

  try {
    const wrappedTokenIn = maxReturn.from === NATIVE_ADDRESS ? WFTM_ADDRESS : maxReturn.from
    const amountIn = new BigNumber(maxReturn.totalFrom || 0)
    const tokens = maxReturn.tokens || {}

    const calcSwapPercentage = (tokenIn, amount) => {
      if (!amount || !tokenIn || !wrappedTokenIn) {
        return undefined
      }
      const isInputToken = tokenIn?.toLowerCase() === wrappedTokenIn.toLowerCase()
      if (isInputToken && amountIn.gt(ZERO)) {
        return new Percent(amount, amountIn).toNumber()
      }
      return undefined
    }

    const routes = []
    maxReturn.paths.forEach((route) => {
      const sorMultiSwap = route.swaps
      if (sorMultiSwap.length === 1) {
        const hop = sorMultiSwap[0]
        const fromToken = tokens[hop.from]
        const tokenIn = fromToken?.address ? new Token(fromToken.address, fromToken.decimals, fromToken.symbol) : null
        const toToken = tokens[hop.to]
        const tokenOut = toToken?.address ? new Token(toToken.address, toToken.decimals, toToken.symbol) : null
        const path = [tokenIn || ({}), tokenOut || ({})]
        routes.push({
          slug: hop.to?.toString(),
          pools: [
            {
              pool: hop.pool?.toString().toLowerCase(),
              dex: hop.dex,
              swapAmount: new BigNumber(hop.amountFrom),
              swapPercent: calcSwapPercentage(hop.from, hop.amountFrom),
            },
          ],
          path,
        })
      } else if (sorMultiSwap.length > 1) {
        const path = []
        const pools = []
        sorMultiSwap.forEach((hop, index) => {
          pools.push({
            pool: hop.pool,
            dex: hop.dex,
            swapAmount: new BigNumber(hop.amountFrom),
            swapPercent: index === 0 ? calcSwapPercentage(hop.from, hop.amountFrom) : 100,
          })
          if (index === 0) {
            const token = tokens[hop.from]
            if (token?.address) {
              path.push(new Token(token.address, token.decimals, token.symbol, token.name))
            } else {
              path.push({})
            }
          }
          const token = tokens[hop.to]
          if (token?.address) {
            path.push(new Token(token.address, token.decimals, token.symbol, token.name))
          } else {
            path.push({})
          }
        })
        routes.push({
          slug: [...path]
            .slice(1)
            .map((t) => t.address)
            .join('-')
            .toLowerCase(),
          path,
          pools,
        })
      }
    })

    // Convert to ChartSwaps v2
    result.routes = formatRoutes(routes)
    result.fromAmount = new BigNumber(maxReturn.totalFrom)
      .div(10 ** fromAsset.decimals)
      .decimalPlaces(fromAsset.decimals, BigNumber.ROUND_DOWN)
      .toFixed()
    result.toAmount = new BigNumber(maxReturn.totalTo)
      .div(10 ** toAsset.decimals)
      .decimalPlaces(toAsset.decimals, BigNumber.ROUND_DOWN)
      .toFixed()
  } catch (e) {
    console.error('get trade composition:', e)
  }

  return result
}
