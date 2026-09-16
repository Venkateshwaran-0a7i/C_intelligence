# SYSTEM OBJECTIVE
Fix `frontend/src/components/LimsPanel.tsx` so it correctly reads the
real field names present in `lims_pa` documents, instead of looking for
field names that don't exist in this data -- which currently causes
every test to render as "Untitled test" with no value, followed by a
noisy dump of internal fields including a broken "[object Object]" line.

# TECHNICAL ENVIRONMENT
- Frontend: React + TypeScript, `frontend/src/components/LimsPanel.tsx`
- Data source: MongoDB `lims_pa` collection, populated from `lims_pa.csv`

# CONFIRMED ROOT CAUSE
Actual shape of a `lims_pa` document, confirmed directly against the
source CSV (example: sc=44026, pa=382):

    {
      "id": 115347,
      "sc": 44026.0,
      "pg": 49.0,
      "pa": 382.0,
      "description": "GC profile for Flavours & Seasonings",
      "pa_name": null,
      "pa_desc": null,
      "value_f": 100.0,
      "value_s": "100.00",
      "created_at": "2026-08-19 21:07:56.210560",
      "updated_at": "2026-08-19 21:07:56.210561",
      "assign_date": null,
      "additional_data": {
        "SC": 44026, "PA": 382, "VALUE_F": 100.0, "UNIT": null,
        "DESCRIPTION": "GC profile for Flavours & Seasonings",
        "PA_SHORT_DESC": "GC profile FnS", "PA_NAME": null,
        "PG": 49, "PA_DESC": null, "ASSIGN_DATE": null,
        "VALUE_S": "100.00"
      }
    }

Current code in LimsPanel.tsx looks for the WRONG key names:

    const VALUE_KEYS = ['result', 'result_value', 'value', 'RESULT']
    const UNIT_KEYS  = ['unit', 'UNIT']
    const NAME_KEYS  = ['parameter_name', 'test_name', 'param_name', 'analysis_name', 'PA_NAME']

None of these match the real top-level fields (`description`, `value_f`,
`value_s`), so:
- `displayName()` finds nothing -> renders "Untitled test"
- `findValue()` finds nothing -> renders blank value
- `extraFields()` doesn't exclude `id`, `pa`, `created_at`, `updated_at`,
  `assign_date`, `additional_data` -> all of them get dumped as raw
  "extra fields", including `String(additional_data)` which produces
  the literal text "[object Object]" since `additional_data` is a
  nested object, not a string.

# REQUIRED FIX
Replace the key-list constants and `extraFields()` exclusion set in
LimsPanel.tsx exactly as follows:

    const VALUE_KEYS = ['value_f', 'value_s', 'result', 'result_value', 'value', 'RESULT']
    const UNIT_KEYS  = ['unit', 'UNIT']
    const NAME_KEYS  = ['description', 'pa_desc', 'pa_name', 'parameter_name', 'test_name', 'param_name', 'analysis_name', 'PA_NAME']

Update `findUnit()` to also check inside `additional_data` when no
top-level unit field is present, since `UNIT` sometimes only exists
there:

    function findUnit(a: Record<string, unknown>): string {
      for (const k of UNIT_KEYS) {
        if (a[k]) return String(a[k])
      }
      const ad = a['additional_data']
      if (ad && typeof ad === 'object' && (ad as Record<string, unknown>)['UNIT']) {
        return String((ad as Record<string, unknown>)['UNIT'])
      }
      return ''
    }

Update `findValue()` so a numeric `value_f` is preferred and formatted
without a trailing `.0` for whole numbers, falling back to `value_s`:

    function findValue(a: Record<string, unknown>): string {
      const vf = a['value_f']
      if (typeof vf === 'number' && !Number.isNaN(vf)) {
        return Number.isInteger(vf) ? String(vf) : String(vf)
      }
      for (const k of VALUE_KEYS) {
        if (a[k] !== undefined && a[k] !== null && String(a[k]) !== '') return String(a[k])
      }
      return ''
    }

Update `extraFields()`'s exclusion set to hide all internal/bookkeeping
fields that should never be shown as a raw "extra field" row -- this is
the fix for the "[object Object]" line and the id/created_at/updated_at
clutter:

    function extraFields(a: Record<string, unknown>): [string, string][] {
      const used = new Set([
        ...NAME_KEYS, ...VALUE_KEYS, ...UNIT_KEYS,
        'pg', 'sc', 'pa', 'id', '_id',
        'created_at', 'updated_at', 'assign_date',
        'additional_data',
      ])
      const extra: [string, string][] = []
      for (const [k, v] of Object.entries(a)) {
        if (used.has(k)) continue
        if (v === undefined || v === null) continue
        const s = typeof v === 'object' ? '' : String(v)
        if (s === '' || s === 'Not Available') continue
        extra.push([k, s])
      }
      return extra
    }

The `typeof v === 'object' ? '' : String(v)` guard is a defensive
backstop: even if a future field turns out to be an object, it will be
silently skipped rather than rendering "[object Object]" again.

# DATA MODELS & SCHEMAS -- no backend or type changes required
`LimsResults` / analysis types in frontend/src/types do not need
changes -- these are all runtime key lookups against
`Record<string, unknown>`, matching the existing pattern in the file.

# EDGE CASES & FAILURE MITIGATIONS
- **`value_f` is 0** (a real, meaningful zero result): the `typeof vf
  === 'number'` check correctly still returns `"0"`, since it does not
  treat falsy-but-valid numbers as missing.
- **Both `value_f` and `value_s` are null** (test not yet resulted):
  `findValue()` falls through to `''`, and the existing JSX already
  handles an empty value by rendering nothing extra next to the name --
  confirm this still reads cleanly rather than showing a dangling unit.
- **`additional_data` is missing entirely** on some documents:
  `findUnit()`'s optional chaining-style check (`ad && typeof ad ===
  'object'`) safely returns `''` rather than throwing.
- **A genuinely new/unexpected object-typed field appears later**: the
  `extraFields()` guard skips it instead of stringifying it into
  "[object Object]" again.

# VERIFICATION
1. Reload the Cavin's Vanilla Milkshake "Lab results (LIMS)" tab.
   Confirm the test now shows the name "GC profile for Flavours &
   Seasonings" and the value "100" (not "Untitled test" / blank).
2. Confirm the extra-fields area no longer shows `Id`, `Additional
   Data: [object Object]`, `Created At`, `Pa`, or `Updated At`.
3. Find or create a lims_pa row that has a real `UNIT` value nested in
   `additional_data` (not null) and confirm it now renders next to the
   value, e.g. "6.4 pH" or similar.