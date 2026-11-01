/**
 * Indian employment states recognised by the payroll statutory engine
 * (Professional Tax slabs + Labour Welfare Fund tables). Mirrors
 * STATE_PT_CONFIG / LWF_STATE_CONFIG on the server — the SPA keeps its own
 * copy because it cannot import Payload-side modules; keep in sync.
 */
export const INDIAN_STATES: string[] = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Meghalaya',
  'Odisha',
  'Punjab',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'West Bengal',
]
