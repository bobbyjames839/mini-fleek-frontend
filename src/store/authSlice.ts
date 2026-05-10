import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthState {
  accessToken: string | null
  email: string | null
  // Epoch seconds. The Supabase access token typically lives ~1 hour; once
  // we're past this, the token is dead and we should treat the user as logged
  // out instead of letting an authed request 401 mid-flow.
  expiresAt: number | null
}

const initialState: AuthState = {
  accessToken: null,
  email: null,
  expiresAt: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        accessToken: string
        email: string | null
        expiresAt?: number | null
      }>,
    ) {
      state.accessToken = action.payload.accessToken
      state.email = action.payload.email
      state.expiresAt = action.payload.expiresAt ?? null
    },
    clearCredentials(state) {
      state.accessToken = null
      state.email = null
      state.expiresAt = null
    },
  },
})

export const { setCredentials, clearCredentials } = authSlice.actions
export default authSlice.reducer
