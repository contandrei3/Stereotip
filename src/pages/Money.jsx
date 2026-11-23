import { useMemo, useState } from 'react'
import { useCollection } from '../data/hooks'
import { addItem, updateItem, removeItem } from '../data/store'
import { useAuth } from '../data/auth'
import { PageHead, AddButton, Empty, Segmented, Modal, Field, MemberSelect, Avatar, Loading, ErrorNote, Fab, confirmDelete } from '../components/ui'
import Icon from '../components/Icon'
import { MEMBERS, EXPENSE_CATEGORIES, memberName } from '../config'
import { fmtDate, fmtMonth, today } from '../lib/dates'
import { fmtMoney, computeBalances, settle } from '../lib/money'

export default function Money() {
  const { rows: expenses, loading, error } = useCollection('expenses')
  const { rows: transfers } = useCollection('transfers')
  const [tab, setTab] = useState('balances')
  const [form, setForm] = useState(null)
  const [payForm, setPayForm] = useState(null)
  const balances = useMemo(() => computeBalances(expenses, transfers), [expenses, transfers])
  const total = expenses.reduce((t, e) => t + (Number(e.amount) || 0), 0)

  return (
    <div className="page">
      <PageHead title="Money" sub={`Split equally between ${MEMBERS.length} members`} action={<AddButton label="Expense" onClick={() => setForm({})} />} />
      <div className="toolbar"><Segmented options={[['balances', 'Who owes whom'], ['expenses', 'Expenses'], ['totals', 'Totals']]} value={tab} onChange={setTab} /></div>
      <ErrorNote error={error} />
      {loading ? <Loading /> : tab === 'balances' ? <Balances balances={balances} total={total} transfers={transfers} onPay={setPayForm} />
        : tab === 'expenses' ? <ExpenseList expenses={expenses} transfers={transfers} onEdit={setForm} />
          : <Totals expenses={expenses} />}
      <Fab label="Add expense" onClick={() => setForm({})} />
      {form && <ExpenseForm initial={form} onClose={() => setForm(null)} />}
      {payForm && <PaymentForm initial={payForm} onClose={() => setPayForm(null)} />}
    </div>
  )
}

function Balances({ balances, total, onPay }) {
  const { memberId } = useAuth()
  const plan = settle(balances)
  const max = Math.max(1, ...Object.values(balances).map(Math.abs))
  return (
    <div className="money-grid">
      <section className="card">
        <div className="stat-row">
          <div><span className="muted small">Total spent</span><strong className="big">{fmtMoney(total)}</strong></div>
          <div><span className="muted small">Per member</span><strong className="big">{fmtMoney(total / MEMBERS.length)}</strong></div>
        </div>
        <h3 className="card-title">Balances</h3>
        <ul className="balance-list">
          {MEMBERS.map((m) => {
            const b = balances[m.id]
            return (
              <li key={m.id}>
                <Avatar id={m.id} size={26} />
                <span className="bname">{m.name}{m.id === memberId && <span className="muted small"> (you)</span>}</span>
                <span className="bbar"><i className={b >= 0 ? 'pos' : 'neg'} style={{ width: `${(Math.abs(b) / max) * 50}%` }} /></span>
                <span className={`bamt ${b > 0.009 ? 'pos' : b < -0.009 ? 'neg' : ''}`}>{b > 0 ? '+' : ''}{fmtMoney(b)}</span>
              </li>
            )
          })}
        </ul>
        <p className="muted small">+ means the band owes them, − means they owe the band.</p>
      </section>
      <section className="card">
        <h3 className="card-title">To settle up</h3>
        {plan.length === 0 ? <p className="ok-text">Everyone is even. 🎸</p> : (
          <ul className="settle-list">
            {plan.map((p, i) => (
              <li key={i} className={p.from === memberId || p.to === memberId ? 'mine' : ''}>
                <span className="parties">
                  <Avatar id={p.from} size={26} /> <strong>{memberName(p.from)}</strong>
                  <Icon name="arrowR" size={16} />
                  <Avatar id={p.to} size={26} /> <strong>{memberName(p.to)}</strong>
                </span>
                <span className="settle-right">
                  <strong className="amt">{fmtMoney(p.amount)}</strong>
                  <button className="btn small" onClick={() => onPay(p)}>Mark paid</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <button className="btn ghost small" onClick={() => onPay({ from: memberId, to: '', amount: '' })}>Record another payment</button>
      </section>
    </div>
  )
}

function ExpenseList({ expenses, transfers, onEdit }) {
  const [cat, setCat] = useState('all')
  const items = [
    ...expenses.filter((e) => cat === 'all' || e.category === cat).map((e) => ({ ...e, kind: 'expense' })),
    ...(cat === 'all' ? transfers.map((t) => ({ ...t, kind: 'transfer' })) : []),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt)
  if (!expenses.length && !transfers.length) return <Empty icon="money" action={<AddButton label="Expense" onClick={() => onEdit({})} />}>No expenses yet.</Empty>
  let lastMonth = null
  return (
    <>
      <div className="toolbar">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="inline-select">
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <ul className="expense-list">
        {items.map((x) => {
          const month = x.date?.slice(0, 7)
          const header = month !== lastMonth ? <li key={'h' + month} className="month-sep">{month ? fmtMonth(month) : 'No date'}</li> : null
          lastMonth = month
          return [header, x.kind === 'expense' ? (
            <li key={x.id} className="expense" role="button" tabIndex={0} onClick={() => onEdit(x)}>
              <Avatar id={x.paidBy} size={30} />
              <div className="grow">
                <div className="task-title">{x.what}</div>
                <div className="muted small">{memberName(x.paidBy)} paid · {fmtDate(x.date)} · <span className="tag">{x.category}</span></div>
              </div>
              <strong>{fmtMoney(x.amount)}</strong>
            </li>
          ) : (
            <li key={x.id} className="expense transfer">
              <Icon name="arrowR" size={22} />
              <div className="grow">
                <div className="task-title">{memberName(x.from)} paid {memberName(x.to)} back</div>
                <div className="muted small">{fmtDate(x.date)}{x.note ? ` · ${x.note}` : ''}</div>
              </div>
              <strong className="muted">{fmtMoney(x.amount)}</strong>
              <button className="icon-btn" aria-label="Delete payment" onClick={() => confirmDelete('this payment') && removeItem('transfers', x.id)}><Icon name="trash" size={16} /></button>
            </li>
          )]
        })}
      </ul>
    </>
  )
}

function Totals({ expenses }) {
  const byMonth = {}, byCat = {}
  for (const e of expenses) {
    const a = Number(e.amount) || 0
    const m = e.date?.slice(0, 7) || '—'
    byMonth[m] = (byMonth[m] || 0) + a
    byCat[e.category || 'Other'] = (byCat[e.category || 'Other'] || 0) + a
  }
  const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]))
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const maxM = Math.max(1, ...months.map((x) => x[1]))
  const maxC = Math.max(1, ...cats.map((x) => x[1]))
  const [month, setMonth] = useState('all')
  const catsForMonth = month === 'all' ? cats : Object.entries(expenses.filter((e) => e.date?.startsWith(month))
    .reduce((acc, e) => ({ ...acc, [e.category || 'Other']: (acc[e.category || 'Other'] || 0) + (Number(e.amount) || 0) }), {})).sort((a, b) => b[1] - a[1])
  const maxCM = month === 'all' ? maxC : Math.max(1, ...catsForMonth.map((x) => x[1]))
  if (!expenses.length) return <Empty icon="money">No expenses yet.</Empty>
  return (
    <div className="money-grid">
      <section className="card">
        <h3 className="card-title">Per month</h3>
        <ul className="bars">
          {months.map(([m, v]) => (
            <li key={m} className={month === m ? 'sel' : ''} role="button" tabIndex={0} onClick={() => setMonth(month === m ? 'all' : m)}>
              <span className="blabel">{m === '—' ? 'No date' : fmtMonth(m)}</span>
              <span className="btrack"><i style={{ width: `${(v / maxM) * 100}%` }} /></span>
              <span className="bval">{fmtMoney(v)}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">Tap a month to see its categories.</p>
      </section>
      <section className="card">
        <h3 className="card-title">Per category {month !== 'all' && <span className="muted">· {fmtMonth(month)}</span>}</h3>
        <ul className="bars">
          {catsForMonth.map(([c, v]) => (
            <li key={c}>
              <span className="blabel">{c}</span>
              <span className="btrack"><i className="alt" style={{ width: `${(v / maxCM) * 100}%` }} /></span>
              <span className="bval">{fmtMoney(v)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ExpenseForm({ initial, onClose }) {
  const { memberId } = useAuth()
  const [f, setF] = useState({ what: '', amount: '', paidBy: memberId, date: today(), category: EXPENSE_CATEGORIES[0], ...initial })
  const set = (k) => (e) => setF({ ...f, [k]: e.target?.value ?? e })
  const save = async (e) => {
    e.preventDefault()
    const data = { what: f.what.trim(), amount: Math.round(Number(String(f.amount).replace(',', '.')) * 100) / 100, paidBy: f.paidBy, date: f.date, category: f.category }
    if (!(data.amount > 0)) return alert('Enter an amount greater than 0.')
    if (f.id) await updateItem('expenses', f.id, data); else await addItem('expenses', { ...data, createdBy: memberId })
    onClose()
  }
  const del = async () => { if (confirmDelete('this expense')) { await removeItem('expenses', f.id); onClose() } }
  return (
    <Modal title={f.id ? 'Edit expense' : 'New expense'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="What"><input value={f.what} onChange={set('what')} required autoFocus placeholder="e.g. Rehearsal room – 3 h" /></Field>
        <div className="row2">
          <Field label="Amount (RON)"><input inputMode="decimal" value={f.amount} onChange={set('amount')} required placeholder="0" /></Field>
          <Field label="Date"><input type="date" value={f.date} onChange={set('date')} required /></Field>
        </div>
        <div className="row2">
          <Field label="Paid by"><MemberSelect required value={f.paidBy} onChange={set('paidBy')} /></Field>
          <Field label="Category">
            <select value={f.category} onChange={set('category')}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
        </div>
        {Number(f.amount) > 0 && <p className="muted small">Each member's share: {fmtMoney(Number(String(f.amount).replace(',', '.')) / MEMBERS.length)}</p>}
        <button className="btn primary block">{f.id ? 'Save changes' : 'Add expense'}</button>
        {f.id && <button type="button" className="btn ghost danger block" onClick={del}><Icon name="trash" size={16} /> Delete expense</button>}
      </form>
    </Modal>
  )
}

function PaymentForm({ initial, onClose }) {
  const { memberId } = useAuth()
  const [f, setF] = useState({ date: today(), note: '', ...initial, amount: String(initial.amount ?? '') })
  const set = (k) => (e) => setF({ ...f, [k]: e.target?.value ?? e })
  const save = async (e) => {
    e.preventDefault()
    const amount = Math.round(Number(f.amount.replace(',', '.')) * 100) / 100
    if (!(amount > 0) || !f.from || !f.to || f.from === f.to) return alert('Pick two different members and an amount.')
    await addItem('transfers', { from: f.from, to: f.to, amount, date: f.date, note: f.note.trim(), createdBy: memberId })
    onClose()
  }
  return (
    <Modal title="Record a payment" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="muted small">Use this when one member pays another back.</p>
        <div className="row2">
          <Field label="From"><MemberSelect required value={f.from} onChange={set('from')} /></Field>
          <Field label="To"><MemberSelect value={f.to} onChange={set('to')} /></Field>
        </div>
        <div className="row2">
          <Field label="Amount (RON)"><input inputMode="decimal" value={f.amount} onChange={set('amount')} required /></Field>
          <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        </div>
        <Field label="Note (optional)"><input value={f.note} onChange={set('note')} placeholder="Cash, bank transfer…" /></Field>
        <button className="btn primary block">Save payment</button>
      </form>
    </Modal>
  )
}
