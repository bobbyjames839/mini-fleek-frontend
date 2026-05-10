import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppDispatch } from '../store/hooks'
import { setCredentials } from '../store/authSlice'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:4000'

interface AuthResponse {
  user: {
    email?: string
  } | null
  session: {
    access_token: string
  } | null
  error?: string
}

class AuthRequestError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function authRequest(path: '/auth/login' | '/auth/signup', email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const body = (await response.json().catch(() => ({}))) as AuthResponse

  if (!response.ok) {
    throw new AuthRequestError(response.status, body.error || 'Authentication failed')
  }

  return body
}

// Supabase's "email already registered" error comes back as a 400 with a few
// different phrasings depending on project settings, so we sniff for keywords.
function isEmailTakenMessage(message: string) {
  const m = message.toLowerCase()
  return (
    m.includes('already registered') ||
    m.includes('already exists') ||
    m.includes('already in use') ||
    m.includes('already taken') ||
    m.includes('user already') ||
    (m.includes('email') && (m.includes('exists') || m.includes('registered') || m.includes('taken')))
  )
}

type AuthMode = 'login' | 'signup'

const heroPanel = {
  eyebrow: 'Buyer access',
  heading: 'Source verified vintage inventory in bulk.',
  body: 'Sign in to browse graded bundles, save vendors, and check out with buyer protection — all in one place.',
  highlights: [
    'Per-piece pricing on every bundle',
    'Vetted wholesalers in the UK, EU, US, and beyond',
    'Cart and orders that follow your account',
  ],
  image:
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80',
}

function getPasswordStrength(password: string) {
  if (!password) return 0
  let score = 0
  if (password.length >= 6) score += 1
  if (password.length >= 10) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1
  return Math.min(score, 4)
}

const STRENGTH_LABELS = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'] as const

export function AuthPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const defaultMode: AuthMode = location.pathname === '/signup' ? 'signup' : 'login'

  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [emailTaken, setEmailTaken] = useState(false)

  // Keep mode in sync with the URL when the user navigates between /login and /signup.
  useEffect(() => {
    setMode(location.pathname === '/signup' ? 'signup' : 'login')
    setError('')
    setInfo('')
    setEmailTaken(false)
  }, [location.pathname])

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])
  const emailValid = /\S+@\S+\.\S+/.test(email.trim())
  const passwordOkForMode = mode === 'signup' ? password.trim().length >= 6 : password.trim().length > 0
  const canSubmit = emailValid && passwordOkForMode && !loading

  function switchMode(next: AuthMode) {
    if (next === mode) return
    setMode(next)
    setError('')
    setInfo('')
    setEmailTaken(false)
    navigate(next === 'signup' ? '/signup' : '/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setInfo('')
    setEmailTaken(false)
    setLoading(true)

    try {
      const trimmedEmail = email.trim()
      const trimmedPassword = password.trim()

      if (!trimmedEmail) throw new Error('Email is required.')
      if (!trimmedPassword) throw new Error('Password is required.')
      if (mode === 'signup' && trimmedPassword.length < 6) {
        throw new Error('Password must be at least 6 characters.')
      }

      let session: AuthResponse['session'] = null
      let user: AuthResponse['user'] = null

      if (mode === 'signup') {
        let signupResponse: AuthResponse
        try {
          signupResponse = await authRequest('/auth/signup', trimmedEmail, trimmedPassword)
        } catch (signupErr) {
          if (
            signupErr instanceof AuthRequestError &&
            (signupErr.status === 409 ||
              (signupErr.status === 400 && isEmailTakenMessage(signupErr.message)))
          ) {
            setEmailTaken(true)
            throw new Error(
              'An account with this email already exists. Try logging in instead.',
            )
          }
          throw signupErr
        }
        session = signupResponse.session
        user = signupResponse.user

        // If Supabase didn't return a session (e.g. email confirmation enabled),
        // try signing in — that covers projects with auto-confirm on.
        if (!session?.access_token) {
          try {
            const loginResponse = await authRequest('/auth/login', trimmedEmail, trimmedPassword)
            session = loginResponse.session
            user = loginResponse.user
          } catch {
            setInfo('Account created. Check your inbox to confirm your email, then log in.')
            return
          }
        }
      } else {
        const loginResponse = await authRequest('/auth/login', trimmedEmail, trimmedPassword)
        session = loginResponse.session
        user = loginResponse.user
      }

      const accessToken = session?.access_token
      if (!accessToken) {
        throw new Error('No access token returned. Please try again.')
      }

      dispatch(
        setCredentials({
          accessToken,
          email: user?.email || trimmedEmail,
        }),
      )

      navigate('/')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden">
      {/* Decorative background blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-amber-300/30 blur-3xl"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-0 px-4 py-8 lg:grid-cols-2 lg:gap-10 lg:px-8 lg:py-12">
        {/* Left: marketing panel */}
        <aside className="relative hidden overflow-hidden rounded-3xl lg:block">
          <img
            src={heroPanel.image}
            alt="Vintage clothing rails in a wholesale showroom"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-900/65 to-amber-900/55" />

          <div className="relative flex h-full flex-col justify-between p-9 text-white">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.18em] text-white/90 transition hover:text-white"
            >
              <span aria-hidden="true">←</span>
              MINI//FLEEK
            </Link>

            <div className="space-y-5">
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                {heroPanel.eyebrow}
              </p>
              <h2 className="text-3xl font-semibold leading-tight md:text-4xl">{heroPanel.heading}</h2>
              <p className="max-w-md text-base text-slate-100/90">{heroPanel.body}</p>

              <ul className="space-y-2 pt-2">
                {heroPanel.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-amber-50">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-fleek-primary/90 text-[11px] font-bold text-white">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-amber-100/70">
              By continuing you agree to MiniFleek&apos;s buyer terms and privacy notice.
            </p>
          </div>
        </aside>

        {/* Right: form panel */}
        <section className="flex h-full flex-col">
          {/* Mobile-only top bar with logo */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link to="/" className="text-base font-semibold tracking-[0.18em] text-fleek-text">
              MINI//FLEEK
            </Link>
            <Link to="/" className="text-sm text-fleek-muted hover:text-fleek-text">
              ← Home
            </Link>
          </div>

          <div className="flex flex-1 flex-col rounded-3xl border border-fleek-border bg-white/90 p-6 shadow-xl shadow-amber-900/5 backdrop-blur md:p-8">
            <header className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                {mode === 'signup' ? 'Create your buyer account' : 'Welcome back'}
              </p>
              <h1 className="text-3xl font-semibold text-fleek-text md:text-4xl">
                {mode === 'signup' ? 'Sign up to start sourcing' : 'Log in to MiniFleek'}
              </h1>
              <p className="text-sm text-fleek-muted">
                {mode === 'signup'
                  ? 'It only takes a minute — no card required.'
                  : 'Pick up where you left off with your saved cart.'}
              </p>
            </header>

            {/* Animated segmented tab switcher */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="relative mt-6 grid grid-cols-2 rounded-2xl bg-amber-50/70 p-1 text-sm font-semibold"
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-xl bg-white shadow-sm ring-1 ring-fleek-border transition-all duration-300 ease-out ${
                  mode === 'login' ? 'left-1' : 'left-[calc(50%+0.0rem)]'
                }`}
              />
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => switchMode('login')}
                className={`relative z-10 rounded-xl px-3 py-2 transition-colors duration-200 ${
                  mode === 'login' ? 'text-fleek-primary' : 'text-fleek-muted hover:text-fleek-text'
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                onClick={() => switchMode('signup')}
                className={`relative z-10 rounded-xl px-3 py-2 transition-colors duration-200 ${
                  mode === 'signup' ? 'text-fleek-primary' : 'text-fleek-muted hover:text-fleek-text'
                }`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="auth-email" className="text-sm font-medium text-fleek-text">
                  Email
                </label>
                <div className="group relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fleek-muted"
                  >
                    @
                  </span>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (emailTaken) setEmailTaken(false)
                    }}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-fleek-border bg-white px-9 py-2.5 text-sm text-fleek-text placeholder:text-slate-400 transition focus:border-fleek-primary focus:outline-none focus:ring-2 focus:ring-fleek-primary/30"
                  />
                  {email && (
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 right-3 flex items-center text-xs font-semibold ${
                        emailValid ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {emailValid ? '✓' : '…'}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="auth-password" className="text-sm font-medium text-fleek-text">
                    Password
                  </label>
                  {mode === 'login' ? (
                    <button
                      type="button"
                      onClick={() => setInfo('Password reset is coming soon. Try signing up with a new email for now.')}
                      className="text-xs font-medium text-fleek-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={mode === 'signup' ? 6 : undefined}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                    className="w-full rounded-xl border border-fleek-border bg-white px-3 py-2.5 pr-20 text-sm text-fleek-text placeholder:text-slate-400 transition focus:border-fleek-primary focus:outline-none focus:ring-2 focus:ring-fleek-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-2 my-1 inline-flex items-center rounded-lg px-2 text-xs font-semibold text-fleek-muted transition hover:bg-amber-50 hover:text-fleek-primary"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                {/* Strength meter slot — always rendered in signup mode so the
                    card height doesn't jump when the user starts typing. */}
                {mode === 'signup' ? (
                  <div className={`space-y-1 pt-1 ${password ? '' : 'invisible'}`} aria-hidden={!password}>
                    <div className="flex h-1.5 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`flex-1 rounded-full transition-colors duration-300 ${
                            i < passwordStrength
                              ? passwordStrength <= 1
                                ? 'bg-red-400'
                                : passwordStrength === 2
                                  ? 'bg-amber-400'
                                  : passwordStrength === 3
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-500'
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-fleek-muted">
                      {password ? STRENGTH_LABELS[passwordStrength] : 'Strength'}
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Reserved slot — keeps the card height stable whether or not an
                  alert is showing. */}
              <div className="min-h-[3.25rem]">
                {error ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    <span aria-hidden="true" className="mt-0.5">⚠</span>
                    <span className="flex-1">
                      {error}
                      {emailTaken ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            onClick={() => switchMode('login')}
                            className="font-semibold text-red-700 underline underline-offset-2 transition hover:text-red-800"
                          >
                            Log in instead
                          </button>
                        </>
                      ) : null}
                    </span>
                  </div>
                ) : info ? (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  >
                    <span aria-hidden="true" className="mt-0.5">ℹ</span>
                    <span>{info}</span>
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-fleek-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-900/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-fleek-primary-dark hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {mode === 'signup' ? 'Creating account…' : 'Signing in…'}
                  </>
                ) : (
                  <>
                    {mode === 'signup' ? 'Create account' : 'Sign in'}
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-fleek-muted">
              {mode === 'signup' ? 'Already have an account? ' : 'New to MiniFleek? '}
              <button
                type="button"
                onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
                className="font-semibold text-fleek-primary transition hover:underline"
              >
                {mode === 'signup' ? 'Log in' : 'Create one'}
              </button>
            </p>
          </div>

        </section>
      </div>
    </main>
  )
}
