import { useState } from 'react'
import { useCollection } from '../data/hooks'
import { addItem, updateItem, removeItem } from '../data/store'
import { useAuth } from '../data/auth'
import { PageHead, AddButton, Empty, Segmented, Modal, Field, MemberSelect, Avatar, Loading, ErrorNote, Fab, confirmDelete } from '../components/ui'
import Icon from '../components/Icon'
import { memberName } from '../config'
import { fmtDate, today, daysUntil } from '../lib/dates'

export const TASK_STATUS = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']]
const NEXT = { todo: 'doing', doing: 'done', done: 'todo' }

export function TaskRow({ task, onEdit }) {
  const overdue = task.due && task.status !== 'done' && task.due < today()
  const soon = task.due && task.status !== 'done' && !overdue && daysUntil(task.due) <= 2
  return (
    <li className={`task ${task.status}`}>
      <button className={`task-check ${task.status}`} aria-label={`Status: ${task.status}. Tap to change.`}
        title="Tap to change status" onClick={() => updateItem('tasks', task.id, { status: NEXT[task.status] || 'todo' })}>
        {task.status === 'done' ? <Icon name="check" size={16} /> : task.status === 'doing' ? <span className="half" /> : null}
      </button>
      <div className="grow" role="button" tabIndex={0} onClick={() => onEdit?.(task)} onKeyDown={(e) => e.key === 'Enter' && onEdit?.(task)}>
        <div className="task-title">{task.title}</div>
        <div className="task-meta muted small">
          {task.assignee ? <><Avatar id={task.assignee} size={18} /> {memberName(task.assignee)}</> : 'Unassigned'}
          {task.due && <span className={overdue ? 'overdue' : soon ? 'soon' : ''}> · due {fmtDate(task.due)}</span>}
          {task.status === 'doing' && <span className="tag doing">In progress</span>}
        </div>
      </div>
    </li>
  )
}

export default function Tasks() {
  const { rows: tasks, loading, error } = useCollection('tasks')
  const { memberId } = useAuth()
  const [who, setWho] = useState('mine')
  const [form, setForm] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const list = tasks.filter((t) => who === 'all' || t.assignee === memberId)
  const sortFn = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.createdAt - b.createdAt)
  const groups = TASK_STATUS.map(([k, label]) => [k, label, list.filter((t) => t.status === k).sort(sortFn)])
  const mineOpen = tasks.filter((t) => t.assignee === memberId && t.status !== 'done').length
  return (
    <div className="page">
      <PageHead title="Tasks" sub="Who does what" action={<AddButton label="Task" onClick={() => setForm({})} />} />
      <div className="toolbar">
        <Segmented options={[['mine', `My tasks${mineOpen ? ` (${mineOpen})` : ''}`], ['all', 'Everyone']]} value={who} onChange={setWho} />
      </div>
      <ErrorNote error={error} />
      {loading ? <Loading /> : list.length === 0
        ? <Empty icon="tasks" action={<AddButton label="Task" onClick={() => setForm({})} />}>{who === 'mine' ? 'Nothing assigned to you. Enjoy it!' : 'No tasks yet.'}</Empty>
        : groups.map(([k, label, items]) => (
          k === 'done' ? (
            items.length > 0 && <details key={k} className="past" open={showDone} onToggle={(e) => setShowDone(e.currentTarget.open)}>
              <summary>Done ({items.length})</summary>
              <ul className="task-list">{items.map((t) => <TaskRow key={t.id} task={t} onEdit={setForm} />)}</ul>
            </details>
          ) : (
            <section key={k} className="task-group">
              <h2 className="group-title">{label} <span className="count">{items.length}</span></h2>
              {items.length === 0 ? <p className="muted small">Nothing here.</p>
                : <ul className="task-list">{items.map((t) => <TaskRow key={t.id} task={t} onEdit={setForm} />)}</ul>}
            </section>
          )
        ))}
      <Fab label="Add task" onClick={() => setForm({})} />
      {form && <TaskForm initial={form} onClose={() => setForm(null)} />}
    </div>
  )
}

export function TaskForm({ initial, onClose }) {
  const { memberId } = useAuth()
  const [f, setF] = useState({ title: '', assignee: memberId, due: '', status: 'todo', notes: '', ...initial })
  const set = (k) => (e) => setF({ ...f, [k]: e.target?.value ?? e })
  const save = async (e) => {
    e.preventDefault()
    const data = { title: f.title.trim(), assignee: f.assignee || null, due: f.due || null, status: f.status, notes: f.notes.trim() }
    if (f.id) await updateItem('tasks', f.id, data); else await addItem('tasks', { ...data, createdBy: memberId })
    onClose()
  }
  const del = async () => { if (confirmDelete('this task')) { await removeItem('tasks', f.id); onClose() } }
  return (
    <Modal title={f.id ? 'Edit task' : 'New task'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Task"><input value={f.title} onChange={set('title')} required autoFocus placeholder="e.g. Book the rehearsal room" /></Field>
        <div className="row2">
          <Field label="Assignee"><MemberSelect value={f.assignee} onChange={set('assignee')} /></Field>
          <Field label="Due date"><input type="date" value={f.due || ''} onChange={set('due')} /></Field>
        </div>
        <Field label="Status"><Segmented options={TASK_STATUS} value={f.status} onChange={set('status')} /></Field>
        <Field label="Notes"><textarea rows={3} value={f.notes} onChange={set('notes')} /></Field>
        <button className="btn primary block">{f.id ? 'Save changes' : 'Add task'}</button>
        {f.id && <button type="button" className="btn ghost danger block" onClick={del}><Icon name="trash" size={16} /> Delete task</button>}
      </form>
    </Modal>
  )
}
