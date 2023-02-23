import * as ethers from 'ethers'
import { _SLIPPAGE_PRECISION, multiSwapAddress, ERC20_ABI, MULTISWAP_ABI } from '../constants/contracts'
import BigNumber from "bignumber.js";
import { ACTIONS, ZERO_ADDRESS } from "../constants";
import {parseUnits} from "ethers/lib/utils";
require('url')

export function getSwapContract(signer) {
    return new ethers.Contract(
      multiSwapAddress,
      MULTISWAP_ABI,
      signer
    );
}

export async function allowance(tokenAddress, provider, swapAmount, decimals, router = multiSwapAddress) {
    // console.log('swapAmount', swapAmount, decimals)
    const isSwapAmountUndefinedOrNullOrZero = swapAmount === undefined || swapAmount === null || swapAmount === '0'
    let contract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider
    );
    const signer = provider.getSigner()
    const address = await signer.getAddress();
    const res = await contract.callStatic.allowance(address, router);
    return res && BigNumber(res.toString()).gte(parseUnits((swapAmount && isSwapAmountUndefinedOrNullOrZero) ? swapAmount : '0', decimals ?? '0').toString())
}


export async function approve(tokenAddress, provider, router = multiSwapAddress, gasPrice, gasPricePriority) {
    const amount = ethers.constants.MaxUint256;
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider
    );
    const tx = await tokenContract
      .connect(provider.getSigner())
      .approve(router, amount, { gasLimit: 100000,
          maxPriorityFeePerGas: web3.utils.toWei(gasPrice, "gwei"),
          maxFeePerGas: web3.utils.toWei("2", "gwei"),
          // gasPrice,    
      });

    return tx
}

export function getSlippage(value) {
    return (value * _SLIPPAGE_PRECISION) / 100;
}
export function getDeadline() {
    return Math.floor(Date.now() / 1000) + 60 * 30;
}

export async function doSwap(swap, slippage, provider, emitter, gasPrice, gasPricePriority) {
    // console.log('multiswap-helper doSwap ----- swap args:', JSON.parse(JSON.stringify(swap)))
    // console.log('----- ', getSlippage(slippage), getDeadline())
    if (swap && swap.returnAmount) {
        const swapNative = swap.swapData.tokenIn === ZERO_ADDRESS;
        // call static check for swap error catching
        await getSwapContract()
          .connect(provider.getSigner())
          .callStatic
          .multiSwap(
            swap.swapData, // in/out tokens, amounts
            swap.swaps, // array of swaps
            swap.tokenAddresses, // array of inter token addresses
            getSlippage(slippage),
            getDeadline(),
            { gasLimit: 3000000, value: swapNative ? swap.swapData.swapAmount : 0,
                maxPriorityFeePerGas: web3.utils.toWei(gasPrice, "gwei"),
                maxFeePerGas: web3.utils.toWei("2", "gwei"),
                // gasPrice,
            }
          )

        const tx = await getSwapContract()
          .connect(provider.getSigner())
          .multiSwap(
            swap.swapData, // in/out tokens, amounts
            swap.swaps, // array of swaps
            swap.tokenAddresses, // array of inter token addresses
            getSlippage(slippage),
            getDeadline(),
            { gasLimit: 3000000, value: swapNative ? swap.swapData.swapAmount : 0,
                maxPriorityFeePerGas: gasPrice,
                maxFeePerGas: gasPricePriority,
                // gasPrice,
            }
          );

        // console.log('multiswap-helper doSwap done, tx:', tx)

        emitter.emit(ACTIONS.SWAP_RETURNED);

        return tx

        // const tokenIn = tokens[swap.tokenIn].symbol;
        // const tokenOut = tokens[swap.tokenOut].symbol;
        // const amount = $('#swapAmount').val();
        // await notify(
        //     `Swap ${amount} ${tokenIn} 🡆 ${tokenOut}`,
        //     'Click to view transaction',
        //     'https://icon-library.com/images/replace-icon/replace-icon-22.jpg',
        //     txScanUrl(tx)
        // );
    } else console.error('No swap route');
}


export async function api(func = '', query = undefined) {
    const apiUrl = 'https://ms.tetu.io/'
    const url = apiUrl + func + '?' + new globalThis.URLSearchParams(query);
    return await (await fetch(url)).json();
}

export async function swapQuery(tokenIn, tokenOut, swapAmount, excludePlatforms = []) {
    const query = {
        tokenIn,
        tokenOut,
        swapAmount,
        excludePlatforms,
    };

    const swap = await api('swap', {
        swapRequest: JSON.stringify(query),
    });

    return swap
}
