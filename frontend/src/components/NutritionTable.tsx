import type { ProductDataDoc, NutritionRow } from '../types'

// Extract a table of {nutrient, per_serving, per_100g, unit} rows from the
// nutrition_information block. The structure from the model can vary, so we
// handle a few common shapes defensively:

//   nutrition_information.approx_values_per_serve = {
//     "Energy": { "per_serving": "200", "per_100g": "400", "unit": "kcal" },
//     ...
//   }
// or a flat list of dicts, or a "per 100g" table etc.
function extractRows(nutrition: Record<string, unknown>): NutritionRow[] {
  const src = nutrition?.approx_values_per_serve as
    | Record<string, unknown>
    | undefined
  if (!src) return []

  const rows: NutritionRow[] = []
  for (const [nutrient, value] of Object.entries(src)) {
    if (typeof value !== 'object' || value === null) continue
    const v = value as Record<string, unknown>
    rows.push({
      nutrient,
      per_serving:
        typeof v.per_serving === 'string' ? v.per_serving : String(v.per_serving ?? ''),
      per_100g:
        typeof v.per_100g === 'string' ? v.per_100g : String(v.per_100g ?? ''),
      unit: typeof v.unit === 'string' ? v.unit : '',
    })
  }
  return rows
}

export default function NutritionTable({
  productData,
}: {
  productData: ProductDataDoc
}) {
  const nutrition = productData.nutrition_information ?? {}
  const rows = extractRows(nutrition)

  if (rows.length === 0) {
    return (
      <p className="text-sm italic text-slate-400">Not Available</p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left">
            <th className="px-3 py-2 font-medium text-slate-600">Nutrient</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">
              Per serving
            </th>
            <th className="px-3 py-2 text-right font-medium text-slate-600">
              Per 100g
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-1.5 font-medium text-slate-800">
                {row.nutrient}
                {row.unit ? (
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({row.unit})
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                {row.per_serving || '—'}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                {row.per_100g || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
