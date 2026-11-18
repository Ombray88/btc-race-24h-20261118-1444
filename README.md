[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Ombray88/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Ombray88/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

# DipBounce-50 BTC Trading Bot

DipBounce-50 is a mean-reversion trading strategy for CBBTC. It enters a position when the price dips at least 40 bps below its 30-bar high and shows a bounce of at least 5 bps from its 10-bar low. To avoid catching a falling knife, it skips entries if the 60-bar return is -200 bps or worse (freefall). The bot trades 50% of available cash per position and exits when gaining 100 bps, losing 30 bps, or after holding for 600 bars. A 30-bar cooldown is applied after each sell fill.

## How to Run

```bash
node main.ts
```
