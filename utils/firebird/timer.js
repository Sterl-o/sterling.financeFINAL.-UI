import fetch from 'node-fetch'
import { ROUTER_API } from './constants'

export default class Timer {
  constructor() {
    this._diff = 0
    this.start()
  }

  getLocalTimestamp() {
    return Math.ceil(Date.now() / 1000)
  }

  async start() {
    try {
      const serverTimestamp = await fetch(`${ROUTER_API}/timestamp`, {}).then(r => r.json())
      const now = this.getLocalTimestamp()
      this._diff = serverTimestamp - now
    } catch {
      // do nothing
    }
  }

  /**
   * @return {number} the current timestamp in seconds of the server
   * */
  getCurrentTimestamp() {
    const now = this.getLocalTimestamp()
    return now + this._diff
  }
}
