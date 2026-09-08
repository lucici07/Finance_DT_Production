const object = value => value && typeof value === 'object' && !Array.isArray(value);
export function validState(s) {
  if (!object(s) || !object(s.data) || !Object.keys(s.data).length || !Array.isArray(s.futureSheets) || !object(s.dailyPlans) || !object(s.pageMeta)) return false;
  const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
  const safe = value => !value || typeof value !== 'object' || Object.entries(value).every(([k, v]) => !forbidden.has(k) && safe(v));
  const scalar = value => typeof value === 'string' || typeof value === 'number' || value === null;
  return safe(s) && s.futureSheets.every(v => typeof v === 'string' && Object.hasOwn(s.data, v)) &&
    Object.values(s.data).every(rows => Array.isArray(rows) && rows.every(row => Array.isArray(row) && row.every(scalar))) &&
    Object.values(s.pageMeta).every(meta => object(meta) && typeof meta.id === 'string' && (!meta.headers || (Array.isArray(meta.headers) && meta.headers.length > 0 && meta.headers.every(h => typeof h === 'string')))) &&
    Object.keys(s.data).every(name => Object.hasOwn(s.pageMeta, name)) &&
    Object.values(s.dailyPlans).every(todos => Array.isArray(todos) && todos.every(todo => object(todo) && typeof todo.title === 'string'));
}
