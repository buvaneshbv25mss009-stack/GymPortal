import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('gymportal_token') || '')
  const [login, setLogin] = useState({ id: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ name: '', email: '', membershipType: 'Monthly' })
  const [editingId, setEditingId] = useState(null)
  const [status, setStatus] = useState('')

  const api = async (path, options = {}) => {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    if (!response.ok) {
      let message = 'Something went wrong.'
      try {
        const body = await response.json()
        message = body.error || message
      } catch {
        // Keep the fallback message for a non-JSON response.
      }
      throw new Error(message)
    }
    if (response.status === 204) return null
    return response.json()
  }

  const loadMembers = async () => {
    try {
      setMembers(await api('/members'))
    } catch (error) {
      setStatus(error.message)
      if (error.message === 'Admin login required.') {
        setToken('')
        localStorage.removeItem('gymportal_token')
      }
    }
  }

  useEffect(() => {
    if (!token) return

    fetch('/api/members', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Admin login required.')
        setMembers(await response.json())
      })
      .catch((error) => {
        setStatus(error.message)
        setToken('')
        localStorage.removeItem('gymportal_token')
      })
  }, [token])

  const submitLogin = async (event) => {
    event.preventDefault()
    setLoginError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Login failed.')
      localStorage.setItem('gymportal_token', body.token)
      setToken(body.token)
    } catch (error) {
      setLoginError(error.message)
    }
  }

  const submitMember = async (event) => {
    event.preventDefault()
    setStatus('')
    try {
      if (editingId) {
        await api(`/members/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) })
        setEditingId(null)
      } else {
        await api('/members', { method: 'POST', body: JSON.stringify(form) })
      }
      setForm({ name: '', email: '', membershipType: 'Monthly' })
      await loadMembers()
    } catch (error) {
      setStatus(error.message)
    }
  }

  const editMember = (member) => {
    setEditingId(member._id)
    setForm({ name: member.name, email: member.email, membershipType: member.membershipType })
  }

  const deleteMember = async (member) => {
    if (!window.confirm(`Delete ${member.name}?`)) return
    try {
      await api(`/members/${member._id}`, { method: 'DELETE' })
      await loadMembers()
    } catch (error) {
      setStatus(error.message)
    }
  }

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // Local logout is sufficient if the server session is already unavailable.
    }
    localStorage.removeItem('gymportal_token')
    setToken('')
  }

  if (!token) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={submitLogin}>
          <div className="brand-mark">GP</div>
          <p className="eyebrow">GymPortal</p>
          <h1>Admin sign in</h1>
          <label htmlFor="admin-id">Admin ID</label>
          <input id="admin-id" value={login.id} onChange={(event) => setLogin({ ...login, id: event.target.value })} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} required />
          {loginError && <p className="error" role="alert">{loginError}</p>}
          <button type="submit">Sign in</button>
        </form>
      </main>
    )
  }

  return (
    <main className="dashboard">
      <header>
        <div><p className="eyebrow">Admin portal</p><h1>Gym members</h1></div>
        <button className="secondary" type="button" onClick={logout}>Sign out</button>
      </header>
      {status && <p className="error" role="alert">{status}</p>}
      <section className="layout">
        <form className="member-form" onSubmit={submitMember}>
          <h2>{editingId ? 'Edit member' : 'Add member'}</h2>
          <label htmlFor="name">Name</label>
          <input id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <label htmlFor="membership">Membership</label>
          <select id="membership" value={form.membershipType} onChange={(event) => setForm({ ...form, membershipType: event.target.value })}>
            <option>Monthly</option><option>Quarterly</option><option>Annual</option><option>Premium</option>
          </select>
          <button type="submit">{editingId ? 'Save changes' : 'Add member'}</button>
          {editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm({ name: '', email: '', membershipType: 'Monthly' }) }}>Cancel</button>}
        </form>
        <div className="table-card">
          <h2>Members <span>{members.length}</span></h2>
          {members.length === 0 ? <p className="empty">No members yet.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Membership</th><th>Actions</th></tr></thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member._id}>
                      <td>{member.name}</td><td>{member.email}</td><td><span className="badge">{member.membershipType}</span></td>
                      <td><button type="button" className="text-button" onClick={() => editMember(member)}>Edit</button><button type="button" className="text-button danger" onClick={() => deleteMember(member)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
