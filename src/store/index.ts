import { combineReducers, configureStore } from '@reduxjs/toolkit'
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist'
import authReducer, { clearCredentials, setCredentials } from './authSlice'
import catalogReducer from './catalogSlice'

// Inline localStorage adapter — avoids the CJS/ESM interop bug where Vite
// resolves `redux-persist/lib/storage` to the namespace object instead of the
// default-exported storage, which would crash on module init.
const storage = {
  getItem(key: string) {
    return Promise.resolve(window.localStorage.getItem(key))
  },
  setItem(key: string, value: string) {
    window.localStorage.setItem(key, value)
    return Promise.resolve()
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key)
    return Promise.resolve()
  },
}

const LEGACY_TOKEN_KEY = 'fleek_access_token'
const LEGACY_EMAIL_KEY = 'fleek_auth_email'

// One-shot migration from the old direct-localStorage scheme onto redux-persist.
// We read the legacy keys, drop them, and seed the store after rehydration so
// persist becomes the single owner going forward.
function consumeLegacyAuth(): { accessToken: string; email: string | null } | null {
  if (typeof window === 'undefined') return null

  const accessToken = window.localStorage.getItem(LEGACY_TOKEN_KEY)
  const email = window.localStorage.getItem(LEGACY_EMAIL_KEY)

  if (!accessToken) return null

  window.localStorage.removeItem(LEGACY_TOKEN_KEY)
  window.localStorage.removeItem(LEGACY_EMAIL_KEY)

  return { accessToken, email: email || null }
}

const rootReducer = combineReducers({
  auth: authReducer,
  catalog: catalogReducer,
})

const persistedReducer = persistReducer(
  {
    key: 'fleek-root',
    version: 1,
    storage,
    whitelist: ['auth'],
  },
  rootReducer,
)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
})

export const persistor = persistStore(store, null, () => {
  const current = store.getState().auth

  // Drop a rehydrated token whose TTL has already passed — otherwise every
  // authed page mount kicks off a request that 401s and bounces the user to
  // login despite the store claiming they're signed in.
  if (current.accessToken && current.expiresAt) {
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (nowSeconds >= current.expiresAt - 30) {
      store.dispatch(clearCredentials())
      return
    }
  }

  // After rehydration, only seed from legacy storage if nothing was persisted —
  // i.e. the user upgraded across the localStorage → redux-persist boundary.
  if (current.accessToken) return

  const legacy = consumeLegacyAuth()
  if (legacy) {
    store.dispatch(setCredentials(legacy))
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
