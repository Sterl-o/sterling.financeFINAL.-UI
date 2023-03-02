import BigNumber from "bignumber.js";
import {ACTIONS, CONTRACTS, DIRECT_SWAP_ROUTES} from "../constants";
import {formatBN, parseBN, buildRoutes, getPrice, getAmountOut, retryForSwapQuote} from '../../utils';
import { FirebirdAggregator } from "utils/firebird";

export const quoteAddLiquidity = async (
  payload,
  web3,
  emitter
) => {
  try {
    const {pair, token0, token1, amount0, amount1} = payload.content;

    if (!pair || !token0 || !token1 || amount0 === "" || amount1 === "") {
      return null;
    }

    const routerContract = new web3.eth.Contract(
      CONTRACTS.ROUTER_ABI,
      CONTRACTS.ROUTER_ADDRESS
    );

    const sendAmount0 = parseBN(amount0, token0.decimals);
    const sendAmount1 = parseBN(amount1, token1.decimals);

    let addy0 = token0.address;
    let addy1 = token1.address;

    if (token0.address === CONTRACTS.FTM_SYMBOL) {
      addy0 = CONTRACTS.WFTM_ADDRESS;
    }
    if (token1.address === CONTRACTS.FTM_SYMBOL) {
      addy1 = CONTRACTS.WFTM_ADDRESS;
    }

    const res = await routerContract.methods
      .quoteAddLiquidity(
        addy0,
        addy1,
        pair.isStable,
        sendAmount0,
        sendAmount1
      )
      .call();

    const returnVal = {
      inputs: {
        token0,
        token1,
        amount0,
        amount1,
      },
      output: formatBN(res.liquidity, pair.decimals),
    };
    emitter.emit(ACTIONS.QUOTE_ADD_LIQUIDITY_RETURNED, returnVal);
  } catch (ex) {
    console.error("Quot add liquidity error", ex);
    emitter.emit(ACTIONS.ERROR, ex);
  }
};

export const quoteRemoveLiquidity = async (
  payload,
  web3,
  emitter
) => {
  try {

    const {pair, token0, token1, withdrawAmount} = payload.content;

    if (!pair || !token0 || !token1 || withdrawAmount === "") {
      return null;
    }

    const routerContract = new web3.eth.Contract(
      CONTRACTS.ROUTER_ABI,
      CONTRACTS.ROUTER_ADDRESS
    );

    const sendWithdrawAmount = parseBN(withdrawAmount, pair.decimals);

    const res = await routerContract.methods
      .quoteRemoveLiquidity(
        token0.address,
        token1.address,
        pair.isStable,
        sendWithdrawAmount
      )
      .call();

    const returnVal = {
      inputs: {
        token0,
        token1,
        withdrawAmount,
      },
      output: {
        amount0: formatBN(res.amountA, token0.decimals),
        amount1: formatBN(res.amountB, token1.decimals),
      },
    };
    emitter.emit(ACTIONS.QUOTE_REMOVE_LIQUIDITY_RETURNED, returnVal);
  } catch (ex) {
    console.error("Quote remove liq error", ex);
    emitter.emit(ACTIONS.ERROR, ex);
  }
};

export const quoteSwap = async (
  payload,
  web3,
  routeAssets,
  emitter,
  baseAssets,
  account
) => {
  try {
    const {fromAsset, toAsset, rawFromAsset, rawToAsset, fromAmount, slippage} = payload.content;
    const amountIn = new BigNumber(fromAmount || 0);
    if (
      !fromAsset ||
      !toAsset ||
      !fromAsset.address ||
      !toAsset.address ||
      amountIn.lte(0)
    ) {
      return null;
    }

    const directSwapRoute =
        (DIRECT_SWAP_ROUTES[fromAsset.address.toLowerCase()] && DIRECT_SWAP_ROUTES[fromAsset.address.toLowerCase()]  === toAsset.address.toLowerCase())
        || (DIRECT_SWAP_ROUTES[toAsset.address.toLowerCase()] && DIRECT_SWAP_ROUTES[toAsset.address.toLowerCase()]  === fromAsset.address.toLowerCase())

    const routerContract = new web3.eth.Contract(
      CONTRACTS.ROUTER_ABI,
      CONTRACTS.ROUTER_ADDRESS
    );

    const sendFromAmount = parseBN(fromAmount, fromAsset.decimals);

    let addy0 = fromAsset.address;
    let addy1 = toAsset.address;

    if (fromAsset.address === CONTRACTS.FTM_SYMBOL) {
      addy0 = CONTRACTS.WFTM_ADDRESS;
    }
    if (toAsset.address === CONTRACTS.FTM_SYMBOL) {
      addy1 = CONTRACTS.WFTM_ADDRESS;
    }

    let amountOuts = buildRoutes(routeAssets, addy0, addy1, directSwapRoute)
    const retryCall = async () => {
      const res = await Promise.allSettled(
        amountOuts.map(async (route) => {
          const fn = retryForSwapQuote({
            fn: routerContract.methods.getAmountsOut(
              sendFromAmount,
              route.routes
            ).call,
          });
          return await fn();
        })
      );

      if (res.filter(el => el.value === undefined).length !== 0) {
        return null;
      }

      return res
        .filter((el, index) => {
          if (
            el.status === "fulfilled" &&
            el.value !== undefined &&
            el.value !== null
          ) {
            return true;
          } else {
            amountOuts[index] = null;
            return false;
          }
        })
        .map((el) => el.value);
    };

    const firebirdCall = FirebirdAggregator.getQuote(
      rawFromAsset?.address || fromAsset.address,
      rawToAsset?.address || toAsset.address,
      sendFromAmount,
      { receiver: account?.address, slippage }
    ).catch(() => null)

    const [receiveAmounts, fbQuote0] = await Promise.all([
      retryCall().catch(() => []),
      firebirdCall,
    ]);

    if (receiveAmounts) {
      amountOuts = amountOuts.filter((el) => el !== null);

      for (let i = 0; i < receiveAmounts.length; i++) {
        amountOuts[i].receiveAmounts = receiveAmounts[i];
        amountOuts[i].finalValue = BigNumber(
          receiveAmounts[i][receiveAmounts[i].length - 1]
        )
          .div(10 ** parseInt(toAsset.decimals))
          .toFixed(parseInt(toAsset.decimals));
      }
    }

    let bestAmountOut = amountOuts
      .filter((ret) => {
        return ret != null;
      })
      .reduce((best, current) => {
        if (!best) {
          return current;
        }
        return BigNumber(best.finalValue).gt(current.finalValue)
          ? best
          : current;
      }, 0);

    // compare price with the Firebird Aggregator
    const toDecimals = parseInt(toAsset.decimals)
    let totalOut = new BigNumber(bestAmountOut?.finalValue || 0).multipliedBy(10 ** toDecimals)
    const totalOut0 = new BigNumber(fbQuote0?.quoteData?.maxReturn?.totalTo || 0)
    const fbPaths = fbQuote0?.quoteData?.maxReturn?.paths
    let totalHop = 0
    if (Array.isArray(fbPaths)) {
      totalHop = fbPaths.reduce((t, v) => t + (Array.isArray(v.swaps) ? v.swaps.length : 0), 0)
    }
    let fbQuote

    if (totalHop > 1 && totalOut0.gt(totalOut)) {
      totalOut = totalOut0
      fbQuote = fbQuote0
    }

    if (fbQuote) {
      if (!bestAmountOut) {
        bestAmountOut = {}
      }
      // update bestAmountOut properties
      bestAmountOut.finalValue = totalOut.div(10 ** toDecimals).toFixed(toDecimals, BigNumber.ROUND_DOWN)
      bestAmountOut.receiveAmounts = [fbQuote.quoteData.maxReturn.totalFrom, fbQuote.quoteData.maxReturn.totalTo]
      bestAmountOut.routeAsset = null
      bestAmountOut.routes = []
      bestAmountOut.firebirdQuote = fbQuote
    }

    const tokens = fbQuote0?.quoteData?.maxReturn?.tokens || {}
    const fromPrice = tokens[addy0.toLowerCase()]?.price
    const toPrice = tokens[addy1.toLowerCase()]?.price

    if (bestAmountOut === 0) {
      emitter.emit(
        ACTIONS.ERROR,
        "No valid route found to complete swap"
      );
      return null;
    }

    let priceImpact = null
    if (!bestAmountOut.firebirdQuote) {
      const libraryContract = new web3.eth.Contract(
        CONTRACTS.LIBRARY_ABI,
        CONTRACTS.LIBRARY_ADDRESS
      );
      let totalRatio = 1;

      for (let i = 0; i < bestAmountOut.routes.length; i++) {
        let amountIn = bestAmountOut.receiveAmounts[i];

        try {
          const tokenInDecimals = baseAssets
            .filter(a => a?.address?.toLowerCase() === bestAmountOut.routes[i].from?.toLowerCase())[0]
            .decimals

          const reserves = await libraryContract.methods
            .getNormalizedReserves(
              bestAmountOut.routes[i].from,
              bestAmountOut.routes[i].to,
              bestAmountOut.routes[i].stable
            ).call();

          const priceWithoutImpact = getPrice(
            BigNumber(reserves[0]).div(1e18),
            BigNumber(reserves[1]).div(1e18),
            bestAmountOut.routes[i].stable
          ).times(BigNumber(amountIn).div(10 ** parseInt(tokenInDecimals)));

          const priceAfterSwap = getAmountOut(
            BigNumber(amountIn).div(10 ** parseInt(tokenInDecimals)),
            BigNumber(reserves[0]).div(1e18),
            BigNumber(reserves[1]).div(1e18),
            bestAmountOut.routes[i].stable
          );

          const ratio = priceAfterSwap.div(priceWithoutImpact);
          totalRatio = BigNumber(totalRatio).times(ratio).toFixed(18);
        } catch (e) {
          console.log('Error define trade difference for',
            amountIn?.toString(),
            bestAmountOut.routes[i].from,
            bestAmountOut.routes[i].to,
            bestAmountOut.routes[i].stable, e)
        }

      }

      priceImpact = BigNumber(1).minus(totalRatio).times(100).toFixed(18);
    }

    const returnValue = {
      inputs: {
        fromAmount: fromAmount,
        fromAsset: fromAsset,
        toAsset: toAsset,
        fromPrice,
        toPrice,
      },
      output: bestAmountOut,
      priceImpact: priceImpact,
    };

    emitter.emit(ACTIONS.QUOTE_SWAP_RETURNED, returnValue);

    return returnValue;
  } catch (ex) {
    console.error("Quote swap error", ex);

    emitter.emit(ACTIONS.QUOTE_SWAP_RETURNED, null);
    emitter.emit(ACTIONS.ERROR, ex);
  }
};

