import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthState {
  accessToken: string | null
  email: string | null
}

const initialState: AuthState = {
  accessToken: null,
  email: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ accessToken: string; email: string | null }>,
    ) {
      state.accessToken = action.payload.accessToken
      state.email = action.payload.email
    },
    clearCredentials(state) {
      state.accessToken = null
      state.email = null
    },
  },
})

export const { setCredentials, clearCredentials } = authSlice.actions
export default authSlice.reducer
