[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Ombray88/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Ombray88/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

# DipBounce-50 Trading Bot

DipBounce-50 is a mean-reversion strategy for CBBTC. It enters a position when the price has dipped at least 40 bps from its 30-bar high and shows a bounce of at least 5 bps from its 10-bar low. The bot allocates 50% of available cash to each trade, subject to weight limits and minimum notional requirements. It exits positions when reaching a +100 bps gain, a -30 bps loss, or after a maximum holding period of 600 bars. A 30-bar cooldown is applied after each sell to prevent over-trading in volatile conditions. Entries are skipped in a freefall (60-bar return at or below -200 bps).

## How to Run

```bash
node main.ts
```
