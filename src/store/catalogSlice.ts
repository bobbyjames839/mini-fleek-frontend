import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { listCategories, type Category } from '../lib/api/categories'
import { listVendors, type Vendor } from '../lib/api/vendors'
import { listProducts, type ProductSummary } from '../lib/api/products'

const FETCH_LIMIT = 60

export interface CatalogState {
  products: ProductSummary[]
  categories: Category[]
  vendors: Vendor[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
}

const initialState: CatalogState = {
  products: [],
  categories: [],
  vendors: [],
  status: 'idle',
  error: null,
}

export const loadCatalog = createAsyncThunk<
  { products: ProductSummary[]; categories: Category[]; vendors: Vendor[] },
  void,
  { state: { catalog: CatalogState } }
>(
  'catalog/load',
  async () => {
    const [productsRes, categoriesRes, vendorsRes] = await Promise.all([
      listProducts({ limit: FETCH_LIMIT }),
      listCategories(),
      listVendors(),
    ])
    return {
      products: productsRes.products,
      categories: categoriesRes.categories,
      vendors: vendorsRes.vendors,
    }
  },
  {
    condition: (_arg, { getState }) => {
      const status = getState().catalog.status
      return status === 'idle' || status === 'error'
    },
  },
)

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCatalog.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(loadCatalog.fulfilled, (state, action) => {
        state.status = 'ready'
        state.products = action.payload.products
        state.categories = action.payload.categories
        state.vendors = action.payload.vendors
      })
      .addCase(loadCatalog.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.error.message ?? 'Could not load catalogue.'
      })
  },
})

export default catalogSlice.reducer
