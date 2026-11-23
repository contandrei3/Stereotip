import { useState } from 'react'
import { useCollection } from '../data/hooks'
import { addItem, updateItem, removeItem } from '../data/store'
import { useAuth } from '../data/auth'
import { PageHead, AddButton, Empty, Modal, Field, Avatar, Loading, ErrorNote, Fab, Segmented, confirmDelete } from '../components/ui'
import Icon from '../components/Icon'
import { memberName } from '../config'
import { fmtDate, timeAgo, byDate, today } from '../lib/dates'
import { compressImage } from '../lib/image'
import { eventTitle, TYPE_LABEL } from '../components/events'

export default function Journal() {
  const { rows: posts, loading, error } = useCollection('posts')
  const { rows: songs } = useCollection('songs')
  const [song, setSong] = useState('all')
  const [order, setOrder] = useState('new')
  const [form, setForm] = useState(null)
  const list = posts.filter((p) => song === 'all' || p.songId === song)
    .sort((a, b) => order === 'new' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)
  const songsWithPosts = songs.filter((s) => posts.some((p) => p.songId === s.id)).sort((a, b) => a.title.localeCompare(b.title))
  return (
    <div className="page narrow">
      <PageHead title="Journal" sub="Notes after rehearsals" action={<AddButton label="Post" onClick={() => setForm({})} />} />
      <div className="toolbar">
        <select className="inline-select" value={song} onChange={(e) => setSong(e.target.value)} aria-label="Filter by song">
          <option value="all">All songs</option>
          {songsWithPosts.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <Segmented small options={[['new', 'Newest first'], ['old', 'Oldest first']]} value={order} onChange={setOrder} />
      </div>
      <ErrorNote error={error} />
      {loading ? <Loading /> : list.length === 0
        ? <Empty icon="journal" action={<AddButton label="Post" onClick={() => setForm({})} />}>{posts.length ? 'No posts about this song yet.' : 'Nothing here yet. How did the last rehearsal go?'}</Empty>
        : <div className="feed">{list.map((p) => <Post key={p.id} post={p} onEdit={setForm} onSong={setSong} />)}</div>}
      <Fab label="New post" onClick={() => setForm({})} />
      {form && <PostForm initial={form} onClose={() => setForm(null)} />}
    </div>
  )
}

export function Post({ post, onEdit, onSong, preview }) {
  const { memberId } = useAuth()
  const { rows: songs } = useCollection('songs')
  const { rows: events } = useCollection('events')
  const { rows: comments } = useCollection('comments')
  const { rows: photos } = useCollection('photos', post.photoCount ? ['postId', post.id] : null)
  const [showComments, setShowComments] = useState(false)
  const [viewer, setViewer] = useState(null)
  const song = songs.find((s) => s.id === post.songId)
  const ev = events.find((e) => e.id === post.eventId)
  const mine = comments.filter((c) => c.postId === post.id).sort((a, b) => a.createdAt - b.createdAt)
  const pics = [...photos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return (
    <article className="card post">
      <header className="post-head">
        <Avatar id={post.author} size={34} />
        <div className="grow">
          <strong>{memberName(post.author)}</strong>
          <div className="muted small">{timeAgo(post.createdAt)}{post.updatedAt && post.updatedAt - post.createdAt > 60000 ? ' · edited' : ''}</div>
        </div>
        {!preview && post.author === memberId && (
          <button className="icon-btn" onClick={() => onEdit(post)} aria-label="Edit post"><Icon name="edit" size={18} /></button>
        )}
      </header>
      {(song || ev) && (
        <div className="post-links">
          {ev && <span className="link-chip"><Icon name="calendar" size={14} /> {TYPE_LABEL[ev.type]} · {fmtDate(ev.date)}</span>}
          {song && <button className="link-chip" onClick={() => onSong?.(song.id)}><Icon name="music" size={14} /> {song.title}</button>}
        </div>
      )}
      <p className={`post-text ${preview ? 'clamp' : ''}`}>{post.text}</p>
      {!preview && pics.length > 0 && (
        <div className={`photos n${Math.min(pics.length, 4)}`}>
          {pics.map((ph, i) => <button key={ph.id} onClick={() => setViewer(i)}><img src={ph.data} alt="" loading="lazy" /></button>)}
        </div>
      )}
      {preview && post.photoCount > 0 && <p className="muted small line"><Icon name="image" size={14} /> {post.photoCount} photo{post.photoCount > 1 ? 's' : ''}</p>}
      {!preview && (
        <footer className="post-foot">
          <button className="btn ghost small" onClick={() => setShowComments(!showComments)}>
            <Icon name="comment" size={16} /> {mine.length ? `${mine.length} comment${mine.length > 1 ? 's' : ''}` : 'Comment'}
          </button>
        </footer>
      )}
      {preview && mine.length > 0 && <p className="muted small line"><Icon name="comment" size={14} /> {mine.length}</p>}
      {showComments && <Comments postId={post.id} comments={mine} />}
      {viewer !== null && (
        <div className="viewer" onClick={() => setViewer(null)}>
          <img src={pics[viewer]?.data} alt="" />
          {pics.length > 1 && <>
            <button className="viewer-nav l" onClick={(e) => { e.stopPropagation(); setViewer((viewer - 1 + pics.length) % pics.length) }} aria-label="Previous"><Icon name="chevL" size={28} /></button>
            <button className="viewer-nav r" onClick={(e) => { e.stopPropagation(); setViewer((viewer + 1) % pics.length) }} aria-label="Next"><Icon name="chevR" size={28} /></button>
          </>}
          <button className="viewer-close" aria-label="Close"><Icon name="x" size={26} /></button>
        </div>
      )}
    </article>
  )
}

function Comments({ postId, comments }) {
  const { memberId } = useAuth()
  const [text, setText] = useState('')
  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    await addItem('comments', { postId, author: memberId, text: text.trim() })
    setText('')
  }
  return (
    <div className="comments">
      {comments.map((c) => (
        <div key={c.id} className="comment">
          <Avatar id={c.author} size={26} />
          <div className="bubble">
            <div className="small"><strong>{memberName(c.author)}</strong> <span className="muted">{timeAgo(c.createdAt)}</span></div>
            <div className="ctext">{c.text}</div>
          </div>
          {c.author === memberId && <button className="icon-btn tiny" aria-label="Delete comment" onClick={() => confirmDelete('this comment') && removeItem('comments', c.id)}><Icon name="x" size={14} /></button>}
        </div>
      ))}
      <form className="comment-form" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" />
        <button className="btn primary small" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  )
}

function PostForm({ initial, onClose }) {
  const { memberId } = useAuth()
  const { rows: songs } = useCollection('songs')
  const { rows: events } = useCollection('events')
  const { rows: existing } = useCollection('photos', initial.id && initial.photoCount ? ['postId', initial.id] : null)
  const [text, setText] = useState(initial.text || '')
  const [songId, setSongId] = useState(initial.songId || '')
  const lastRehearsal = events.filter((e) => e.date <= today()).sort(byDate).reverse()[0]
  const [eventId, setEventId] = useState(initial.id ? initial.eventId || '' : '')
  const [files, setFiles] = useState([]) // {data, width, height}
  const [removed, setRemoved] = useState([])
  const [busy, setBusy] = useState(false)
  const pastEvents = events.filter((e) => e.date <= today() || e.id === eventId).sort(byDate).reverse().slice(0, 30)

  const pick = async (e) => {
    const list = [...e.target.files]
    e.target.value = ''
    setBusy(true)
    try {
      const out = []
      for (const f of list) out.push(await compressImage(f))
      setFiles((x) => [...x, ...out])
    } catch (err) { alert(err.message) } finally { setBusy(false) }
  }
  const keep = existing.filter((p) => !removed.includes(p.id))
  const save = async (e) => {
    e.preventDefault()
    if (!text.trim() && !files.length && !keep.length) return
    setBusy(true)
    try {
      const data = { text: text.trim(), songId: songId || null, eventId: eventId || null, photoCount: keep.length + files.length }
      let id = initial.id
      if (id) await updateItem('posts', id, data)
      else id = await addItem('posts', { ...data, author: memberId })
      for (const r of removed) await removeItem('photos', r)
      let order = keep.length
      for (const f of files) await addItem('photos', { postId: id, data: f.data, order: order++, author: memberId })
      onClose()
    } catch (err) {
      alert('Could not save: ' + err.message)
    } finally { setBusy(false) }
  }
  const del = async () => {
    if (!confirmDelete('this post')) return
    for (const p of existing) await removeItem('photos', p.id)
    await removeItem('posts', initial.id)
    onClose()
  }
  return (
    <Modal title={initial.id ? 'Edit post' : 'New journal post'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="What happened?">
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} autoFocus
            placeholder="Wrote a new ending for… / We need to work on the transition out of the chorus…" />
        </Field>
        <div className="row2">
          <Field label="Rehearsal / event (optional)">
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">— none —</option>
              {lastRehearsal && !initial.id && <option value={lastRehearsal.id}>Latest: {eventTitle(lastRehearsal)} · {fmtDate(lastRehearsal.date)}</option>}
              {pastEvents.filter((e) => initial.id || e.id !== lastRehearsal?.id).map((e) => <option key={e.id} value={e.id}>{TYPE_LABEL[e.type]} · {fmtDate(e.date)}</option>)}
            </select>
          </Field>
          <Field label="Song (optional)">
            <select value={songId} onChange={(e) => setSongId(e.target.value)}>
              <option value="">— none —</option>
              {[...songs].sort((a, b) => a.title.localeCompare(b.title)).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </Field>
        </div>
        <div className="field">
          <span className="field-label">Photos</span>
          <div className="thumbs">
            {keep.map((p) => (
              <div key={p.id} className="thumb"><img src={p.data} alt="" />
                <button type="button" onClick={() => setRemoved([...removed, p.id])} aria-label="Remove photo"><Icon name="x" size={14} /></button></div>
            ))}
            {files.map((f, i) => (
              <div key={i} className="thumb"><img src={f.data} alt="" />
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove photo"><Icon name="x" size={14} /></button></div>
            ))}
            <label className="thumb add">
              <Icon name="image" size={22} /><span className="small">Add</span>
              <input type="file" accept="image/*" multiple onChange={pick} hidden />
            </label>
          </div>
        </div>
        <button className="btn primary block" disabled={busy}>{busy ? 'Saving…' : initial.id ? 'Save changes' : 'Post'}</button>
        {initial.id && <button type="button" className="btn ghost danger block" onClick={del}><Icon name="trash" size={16} /> Delete post</button>}
      </form>
    </Modal>
  )
}
