/**
 * DipBounce-50: CBBTC mean-reversion strategy.
 * Entry: dip -40 bps vs 30-bar high, bounce +5 bps vs 10-bar low, skip if 60-bar freefall <= -200 bps.
 * Size: 50% cash, capped by max weight. Exit: +100/-30 bps or 600 bars. 30-bar cooldown.
 */
import { runBars, type Batch, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

interface BotState {
  closes: bigint[];
  highs: bigint[];
  lows: bigint[];
  entryPrice: bigint | null;
  entrySeq: number | null;
  buyNotional: bigint | null;
  lastSellSeq: number | null;
  realizedPnL: bigint;
  pendingSell: boolean;
}

const botState: BotState = {
  closes: [],
  highs: [],
  lows: [],
  entryPrice: null,
  entrySeq: null,
  buyNotional: null,
  lastSellSeq: null,
  realizedPnL: 0n,
  pendingSell: false,
};

function max(arr: bigint[]): bigint {
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

function min(arr: bigint[]): bigint {
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m;
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    const cbbtcBar = batch.bars.find(b => b.symbol === SYMBOL);
    if (cbbtcBar) {
      botState.closes.push(BigInt(cbbtcBar.c));
      botState.highs.push(BigInt(cbbtcBar.h));
      botState.lows.push(BigInt(cbbtcBar.l));
    } else {
      const lastClose = state.close(SYMBOL);
      if (lastClose !== null) {
        botState.closes.push(lastClose);
        botState.highs.push(lastClose);
        botState.lows.push(lastClose);
      }
    }

    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL) continue;
      if (fill.status === 'filled') {
        if (fill.side === 'buy') {
          botState.entryPrice = BigInt(fill.price);
          botState.entrySeq = fill.decided_bar;
          botState.buyNotional = BigInt(fill.notional_quote_units);
        } else {
          const sellNotional = BigInt(fill.notional_quote_units);
          if (botState.buyNotional !== null) {
            botState.realizedPnL += (sellNotional - botState.buyNotional);
          }
          botState.entryPrice = null;
          botState.entrySeq = null;
          botState.buyNotional = null;
          botState.lastSellSeq = batch.seq;
          botState.pendingSell = false;
        }
      } else if (fill.status === 'rejected') {
        if (fill.side === 'sell') {
          botState.pendingSell = false;
        }
      }
    }

    if (state.warmingUp || botState.closes.length < 120) return [];

    const close = botState.closes[botState.closes.length - 1];
    const orders: OrderInput[] = [];

    if (botState.entryPrice === null) {
      const maxHigh30 = max(botState.highs.slice(-30));
      const minLow10 = min(botState.lows.slice(-10));
      const dipBps = (close * 10000n) / maxHigh30 - 10000n;
      const bounceBps = (close * 10000n) / minLow10 - 10000n;
      
      let freefallBps: bigint | null = null;
      if (botState.closes.length >= 61) {
        const close60 = botState.closes[botState.closes.length - 61];
        freefallBps = (close * 10000n) / close60 - 10000n;
      }

      const cooldownMet = botState.lastSellSeq === null || (batch.seq - botState.lastSellSeq) >= 30;
      const entrySignal = dipBps <= -40n && bounceBps >= 5n && (freefallBps === null || freefallBps > -200n);

      if (entrySignal && cooldownMet) {
        let size = state.cash / 2n;
        const room = state.weightRoom(SYMBOL);
        if (size > room) size = room;
        
        if (size >= BigInt(state.hello.fees.min_notional_quote_units)) {
          orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: size, max_slippage_bps: 100 });
        }
      }
    } else {
      const gainBps = (close * 10000n) / botState.entryPrice - 10000n;
      const barsHeld = batch.seq - botState.entrySeq!;
      const exitReason = gainBps >= 100n || gainBps <= -30n || barsHeld >= 600;

      if (exitReason || botState.pendingSell) {
        const pos = state.positions.get(SYMBOL);
        if (pos && pos.qty > 0n) {
          botState.pendingSell = true;
          orders.push({ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: 100 });
        } else {
          botState.pendingSell = false;
        }
      }
    }

    return orders;
  }
});
