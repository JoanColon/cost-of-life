export function isCurrentVerdictRequest(request, activeRequestId, currentPeriodKey) {
  return request.id === activeRequestId && request.periodKey === currentPeriodKey
}
