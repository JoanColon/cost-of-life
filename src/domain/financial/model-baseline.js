export const MODEL_BASELINE_KIND = 'categoryBaseline'

export function modelBaselineId(categoryId) {
  return `baseline--${categoryId}`
}

export function isModelBaseline(item) {
  return item?.kind === MODEL_BASELINE_KIND
}

export function itemizedModelItems(items = []) {
  return items.filter((item) => !isModelBaseline(item))
}
