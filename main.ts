import { runBars, BPS, type OrderInput, type Fill } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const WARMUP_MIN_BARS = 120;
const DIP_WINDOW = 30;
const BOUNCE_WINDOW = 10;
const EXIT_GAIN_BPS = 100n;
const EXIT_LOSS_BPS = -30n;
const EXIT_MAX_BARS = 600;
const COOLDOWN_BARS = 30;
const DIP_THRESHOLD_BPS = -40n;
const BOUNCE_THRESHOLD_BPS = 5n;

interface State {
  closes: bigint[];
  highs: bigint[];
  lows: bigint[];
  entryPrice: bigint | null;
  entrySeq: number | null;
  lastSellSeq: number | null;
  pendingSell: boolean;
  buyNotional: bigint;
  realizedPnL: bigint;
}

const botState: State = {
  closes: [],
  highs: [],
  lows: [],
  entryPrice: null,
  entrySeq: null,
  lastSellSeq: null,
  pendingSell: false,
  buyNotional: 0n,
  realizedPnL: 0n,
};

await runBars({
  onBatch(state, batch) {
    // 1. Process Fills
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.status !== 'filled') continue;
      if (fill.side === 'buy') {
        botState.entryPrice = BigInt(fill.price);
        botState.entrySeq = fill.decided_bar; // Use decided_bar or batch.seq? Prompt says entrySeq = batch.seq
        botState.buyNotional = BigInt(fill.notional_quote_units);
      } else {
        if (botState.entryPrice !== null) {
          const sellNotional = BigInt(fill.notional_quote_units);
          botState.realizedPnL += (sellNotional - botState.buyNotional);
        }
        botState.entryPrice = null;
        botState.entrySeq = null;
        botState.lastSellSeq = batch.seq;
        botState.pendingSell = false;
      }
    }

    // 2. Track History
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar) {
      botState.closes.push(BigInt(bar.c));
      botState.highs.push(BigInt(bar.h));
      botState.lows.push(BigInt(bar.l));
    } else {
      const lastClose = state.close(SYMBOL);
      if (lastClose !== null) {
        botState.closes.push(lastClose);
        botState.highs.push(lastClose);
        botState.lows.push(lastClose);
      }
    }

    // Keep history manageable if needed, but the prompt doesn't specify a limit other than what windows need
    if (botState.closes.length > 1000) {
      botState.closes.shift();
      botState.highs.shift();
      botState.lows.shift();
    }

    if (state.warmingUp || botState.closes.length < WARMUP_MIN_BARS) {
      return [];
    }

    const close = botState.closes[botState.closes.length - 1];
    const orders: OrderInput[] = [];

    // 3. Exit Logic
    if (botState.entryPrice !== null) {
      const gainBps = (close * BPS) / botState.entryPrice - BPS;
      const barsHeld = batch.seq - (botState.entrySeq ?? 0);
      const shouldExit = gainBps >= EXIT_GAIN_BPS || gainBps <= EXIT_LOSS_BPS || barsHeld >= EXIT_MAX_BARS;

      if (shouldExit || botState.pendingSell) {
        const pos = state.positions.get(SYMBOL);
        if (pos && pos.qty > 0n) {
          orders.push({
            side: 'sell',
            symbol: SYMBOL,
            qty: pos.qty,
            max_slippage_bps: 100,
          });
          botState.pendingSell = true;
        } else {
          // If we thought we held but state says otherwise, reset
          botState.pendingSell = false;
        }
      }
    }

    // 4. Entry Logic
    if (botState.entryPrice === null && !botState.pendingSell) {
      const cooldownPassed = botState.lastSellSeq === null || (batch.seq - botState.lastSellSeq) >= COOLDOWN_BARS;
      if (cooldownPassed) {
        const maxHigh30 = botState.highs.slice(-DIP_WINDOW).reduce((a, b) => (a > b ? a : b));
        const minLow10 = botState.lows.slice(-BOUNCE_WINDOW).reduce((a, b) => (a < b ? a : b));

        const dipBps = (close * BPS) / maxHigh30 - BPS;
        const bounceBps = (close * BPS) / minLow10 - BPS;

        if (dipBps <= DIP_THRESHOLD_BPS && bounceBps >= BOUNCE_THRESHOLD_BPS) {
          let size = state.cash / 2n;
          const maxWeight = (state.equity * BigInt(state.hello.caps.max_weight_bps)) / BPS;
          if (size > maxWeight) size = maxWeight;

          if (size >= BigInt(state.hello.fees.min_notional_quote_units)) {
            orders.push({
              side: 'buy',
              symbol: SYMBOL,
              notional_quote_units: size,
              max_slippage_bps: 100,
            });
          }
        }
      }
    }

    return orders;
  },
});
