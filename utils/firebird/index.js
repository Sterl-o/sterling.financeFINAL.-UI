import fetch from 'node-fetch'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { CHAIN_KEY, DEX_ID, NATIVE_ADDRESS, NATIVE_SYMBOL, REFERRAL_ADDRESS, ROUTER_API } from './constants'
import { getTradeComposition } from './route'
import Timer from './timer'

function getClientUID() {
  if (typeof window === 'undefined') {
    return null
  }
  // globally-unique identifiers
  let guid = window.localStorage.getItem('client_uid')
  if (guid) {
    return guid
  }
  guid = uuidv4()
  window.localStorage.setItem('client_uid', guid)
  return guid
}

function sha256(stringToEncode) {
  return createHash('sha256')
    .update(stringToEncode)
    .digest('hex')
}

const timer = new Timer()

function getHeaders() {
  const timestamp = timer.getCurrentTimestamp()
  const uid = getClientUID()
  const hashstring = timestamp + 'satoshi buterin' + uid
  const h = btoa(sha256(hashstring))

  return {
    'content-type': 'application/json',
    'x-request-id': uid,
    'api-h': h,
    'api-key': 'firebird_sterling_prod_1056',
    'api-timestamp': timestamp
  }
}

/**
 * @typedef {object} Quote
 * */

/**
 * @param from {string} from token address
 * @param to {string} to token address
 * @param amount {string} buy amount of ERC20 tokens in wei
 * @param options {object}
 * @param [options.receiver] {string} Destination receiver wallet address
 * @param [options.slippage] {number}
 * @param [options.allDEXs] {boolean}
 *
 * @returns {Promise<Quote>}
 * */
async function getQuote(from, to, amount, options = {}) {
  const tokenFrom = from.toUpperCase() === NATIVE_SYMBOL ? NATIVE_ADDRESS : from
  const tokenTo = to.toUpperCase() === NATIVE_SYMBOL ? NATIVE_ADDRESS : to
  const chainId = process.env.NEXT_PUBLIC_CHAINID

  const params = {
    chainId,
    from: tokenFrom,
    to: tokenTo,
    amount,
    receiver: options.receiver,
    slippage: +options.slippage / 100,
    source: DEX_ID,
    ref: REFERRAL_ADDRESS,
  }
  let queries = []
  Object.entries(params).forEach(([key, value]) => {
    if (value || value === 0) {
      queries.push(`${key}=${value}`)
    }
  })
  const headers = getHeaders()

  const result = await fetch(`${ROUTER_API}/v2/quote?${queries.join('&')}`, { headers })
  return result.json()
}

/**
 * @param quote {Quote} quote data from getQuote return
 *
 * @returns {Promise<{ router: string, data: string }>} object
 * */
async function encodeQuote(quote) {
  const { encodedData } = await fetch(`${ROUTER_API}/v2/encode`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(quote)
  }).then(r => r.json())

  return encodedData
}

function getTokenLogoURL(address) {
  return `https://raw.githubusercontent.com/firebird-finance/firebird-assets/master/blockchains/${CHAIN_KEY}/assets/${address}/logo.png`
}

export const FirebirdAggregator = {
  getQuote,
  encodeQuote,
  getTradeComposition,
  getTokenLogoURL,
}
