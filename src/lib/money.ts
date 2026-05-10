// All API money values are GBP minor units (pence) per backend/API_CONTRACT.md.
// Never do float math on the client — divide by 100 only at format time.

const formatter2 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatter0 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatGBP(pence: number, opts?: { precision?: 0 | 2 }) {
  const f = opts?.precision === 0 ? formatter0 : formatter2
  return f.format(pence / 100)
}
