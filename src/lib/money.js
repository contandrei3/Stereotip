import { MEMBERS, CURRENCY } from '../config'

export const fmtMoney = (n) =>
  `${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${CURRENCY}`

/**
 * Every expense is split equally among all members.
 * Transfers ("A paid B back") move balance from the receiver to the payer.
 * balance > 0 → the band owes this person money; < 0 → they owe.
 */
export function computeBalances(expenses, transfers) {
  const bal = Object.fromEntries(MEMBERS.map((m) => [m.id, 0]))
  const n = MEMBERS.length
  for (const e of expenses) {
    const amt = Number(e.amount) || 0
    if (bal[e.paidBy] !== undefined) bal[e.paidBy] += amt
    for (const m of MEMBERS) bal[m.id] -= amt / n
  }
  for (const t of transfers) {
    const amt = Number(t.amount) || 0
    if (bal[t.from] !== undefined) bal[t.from] += amt
    if (bal[t.to] !== undefined) bal[t.to] -= amt
  }
  for (const k in bal) bal[k] = Math.round(bal[k] * 100) / 100
  return bal
}

/** Greedy minimal list of payments that settles everyone. */
export function settle(balances) {
  const debtors = [], creditors = []
  for (const [id, b] of Object.entries(balances)) {
    if (b < -0.009) debtors.push({ id, amt: -b })
    else if (b > 0.009) creditors.push({ id, amt: b })
  }
  debtors.sort((a, b) => b.amt - a.amt)
  creditors.sort((a, b) => b.amt - a.amt)
  const out = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt)
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay * 100) / 100 })
    debtors[i].amt -= pay; creditors[j].amt -= pay
    if (debtors[i].amt < 0.01) i++
    if (creditors[j].amt < 0.01) j++
  }
  return out
}
