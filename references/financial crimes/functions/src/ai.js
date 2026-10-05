const { GoogleGenAI } = require('@google/genai')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const logger = require('firebase-functions/logger')
const { consumeAiCredit, refundAiCredit } = require('./credits')
const { requireAuth } = require('./auth')
const { ROAST_SYSTEM_PROMPT, getVerdictSystemPrompt } = require('./prompts')

const ALLOWED_VERDICTS = ['GUILTY', 'ON PROBATION', 'NOT GUILTY']
// Roast and verdict share the same ordered model chain. A request only reaches the client-side
// local fallback after every model in this list has failed.
const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
const isFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true'
// A module instance is reused between warm Cloud Function invocations. This flag lets telemetry
// distinguish the first invocation handled by a fresh instance from subsequent warm invocations.
let isColdStart = true

// --- Callable Cloud Functions ---------------------------------------------------------------

// Authenticates the user, reserves one AI credit, asks Gemini for a roast and returns the cleaned
// text together with credit, timing and token-usage metadata.
const callRoast = onCall(
  {
    secrets: ['GEMINI_API_KEY'],
    enforceAppCheck: true,
  },
  async (request) => {
    const auth = requireAuth(request)
    const startedAt = Date.now()
    const coldStart = takeColdStart()
    const event = request.data?.event || {}
    const record = request.data?.record || {}
    const context = request.data?.context || {}

    if (!event || Object.keys(event).length === 0) {
      throw new HttpsError('invalid-argument', 'A spending event is required.')
    }

    logRoastDevelopment('=== ROAST REQUEST FUNCTION ===', {
      category: event.category,
      amount: event.amount,
      event,
      record,
      context,
    })

    const reservation = await consumeAiCredit(auth.uid, 'roast')

    try {
      const preGeminiStartedAt = Date.now()
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      })
      const prompt = buildRoastPrompt(event, record, context)
      logRoastDevelopment('=== GEMINI INPUT ===', {
        systemPrompt: ROAST_SYSTEM_PROMPT,
        currentUserPayload: prompt,
        history: [],
        chatSessionReused: false,
        cachedContent: null,
      })
      const geminiStartedAt = Date.now()
      const generation = await generateWithModelFallback({
        ai,
        generationType: 'roast',
        contents: prompt,
        config: {
          systemInstruction: ROAST_SYSTEM_PROMPT,
          temperature: 0.65,
          maxOutputTokens: 750,
        },
      })

      logRoastDevelopment('=== GEMINI OUTPUT ===', {
        categoryExpected: event.category,
        generatedRoast: generation.quote,
        model: generation.model,
      })

      const postGeminiStartedAt = Date.now()

      return buildGenerationResult({
        coldStart,
        geminiStartedAt,
        model: generation.model,
        postGeminiStartedAt,
        preGeminiStartedAt,
        quote: generation.quote,
        reservation,
        response: generation.response,
        startedAt,
      })
    } catch (error) {
      await handleGenerationError(error, auth.uid, 'roast')
    }
  },
)

function logRoastDevelopment(label, details) {
  if (!isFunctionsEmulator) return

  logger.info(label, details)
}

// Runs the equivalent generation flow for a monthly or yearly verdict. Unlike a roast, its status is
// calculated by the client and validated here before Gemini writes the punchline.
const callVerdict = onCall(
  {
    secrets: ['GEMINI_API_KEY'],
    enforceAppCheck: true,
  },
  async (request) => {
    const auth = requireAuth(request)
    const startedAt = Date.now()
    const coldStart = takeColdStart()
    const verdict = request.data?.verdict || {}
    const period = request.data?.period || {}
    const stats = request.data?.stats || {}
    const context = request.data?.context || {}

    if (!verdict.status) {
      throw new HttpsError('invalid-argument', 'A verdict status is required.')
    }

    const verdictStatus = normalizeVerdictStatus(verdict.status)
    const periodMode = normalizePeriodMode(period.mode)
    if (!ALLOWED_VERDICTS.includes(verdictStatus)) {
      throw new HttpsError('invalid-argument', 'Invalid verdict status.')
    }

    const reservation = await consumeAiCredit(auth.uid, 'verdict')

    try {
      const preGeminiStartedAt = Date.now()
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      })
      const prompt = buildVerdictPrompt(verdictStatus, stats, context, periodMode)
      const geminiStartedAt = Date.now()
      const generation = await generateWithModelFallback({
        ai,
        generationType: 'verdict',
        contents: prompt,
        config: {
          systemInstruction: getVerdictSystemPrompt(periodMode),
          temperature: 0.7,
          maxOutputTokens: 750,
        },
      })

      const postGeminiStartedAt = Date.now()

      return buildGenerationResult({
        coldStart,
        geminiStartedAt,
        model: generation.model,
        postGeminiStartedAt,
        preGeminiStartedAt,
        quote: generation.quote,
        reservation,
        response: generation.response,
        startedAt,
      })
    } catch (error) {
      await handleGenerationError(error, auth.uid, 'verdict')
    }
  },
)

// --- Shared generation lifecycle ------------------------------------------------------------

// Tries the shared model chain in order. Empty or rejected output counts as a failed attempt, so
// the second model can still produce the response before control returns to the local fallback.
async function generateWithModelFallback({ ai, generationType, contents, config }) {
  const failures = []

  for (const [index, model] of GEMINI_MODELS.entries()) {
    try {
      const response = await ai.models.generateContent({ model, contents, config })
      const quote = cleanGeneratedText(response.text)

      if (!quote) {
        throw new Error(`Gemini returned an empty ${generationType}.`)
      }

      return { model, quote, response }
    } catch (error) {
      failures.push(error)
      const nextModel = GEMINI_MODELS[index + 1]

      if (nextModel) {
        logger.warn('AI_MODEL_FALLBACK', {
          generationType,
          failedModel: model,
          nextModel,
          error: getErrorMessage(error),
        })
      }
    }
  }

  throw new AggregateError(failures, `All Gemini models failed for ${generationType}.`)
}

// Produces the stable response contract shared by roast and verdict generation.
function buildGenerationResult({
  coldStart,
  geminiStartedAt,
  model,
  postGeminiStartedAt,
  preGeminiStartedAt,
  quote,
  reservation,
  response,
  startedAt,
}) {
  return {
    quote,
    source: model,
    creditsRemaining: reservation.creditsRemaining,
    monthlyCreditsGranted: reservation.monthlyCreditsGranted,
    unlimited: reservation.unlimited,
    timings: {
      coldStart,
      preGeminiMs: geminiStartedAt - preGeminiStartedAt,
      geminiMs: postGeminiStartedAt - geminiStartedAt,
      postGeminiMs: Date.now() - postGeminiStartedAt,
      totalMs: Date.now() - startedAt,
    },
    tokenUsage: getTokenUsage(response),
  }
}

// A failed generation must not cost the user a credit. Log only the error message, refund the
// reservation and expose a generic Firebase error rather than leaking provider details.
async function handleGenerationError(error, uid, generationType) {
  await refundAiCredit(uid, generationType)
  logger.error('AI_GENERATION_FAILED', {
    generationType,
    error: getErrorMessage(error),
  })
  throw new HttpsError('internal', `An error occurred while generating the ${generationType}.`)
}

// Keeps provider errors out of callable responses while retaining a useful message in server logs.
function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Unknown generation error'
}

// --- Roast prompt ---------------------------------------------------------------------------

// Converts the individual event and its aggregate record into the user-prompt portion sent
// alongside ROAST_SYSTEM_PROMPT. Legacy camelCase fallbacks keep older app versions compatible.
function buildRoastPrompt(event, record, context) {
  const juryMode = normalizeCourtStrictness(context.courtStrictness)
  const amount = formatAmount(event.amount, event.currency || context.currency)
  const notes = truncateText(event.user_notes ?? event.notes, 120) || 'none'
  const title = truncateText(event.title || event.crimeName, 80)
  const category = event.category || event.categoryLabel || event.categoryId || 'Unknown'
  const dayOfWeek = truncateText(event.day_of_week, 20) || 'unknown'
  const timeOfDay = truncateText(event.time_of_day, 20) || 'unknown'
  const recurrence = truncateText(event.recurrence, 20)
  const recordLines = buildRoastRecordLines(record, event.currency || context.currency)

  return `
JURY MODE: ${juryMode.toUpperCase()}

EVENT:
Category: ${category}
Amount: ${amount}
${title ? `Description: ${title}\n` : ''}Notes: ${notes}
Event type: ${event.event_type || event.eventType || 'crime'}
Day: ${dayOfWeek}
Time: ${timeOfDay}
${recurrence ? `Recurrence: ${recurrence}\n` : ''}
RELATED RECORD:
${recordLines.length ? recordLines.join('\n') : 'No related record available.'}

Write the roast.
`
}

// Formats only available aggregate values. The wording preserves their time semantics so Gemini
// does not mistake a period total for a value that existed before the selected event.
function buildRoastRecordLines(record, currency) {
  const lines = []

  if (isFiniteNumber(record.category_week_count)) {
    lines.push(
      `Same-category events this calendar week through this event: ${formatNumber(record.category_week_count)}`,
    )
  }

  if (isFiniteNumber(record.category_month_count)) {
    lines.push(
      `Same-category events this month through this event: ${formatNumber(record.category_month_count)}`,
    )
  }

  if (isFiniteNumber(record.category_month_total)) {
    lines.push(
      `Same-category spending this month through this event: ${formatAmount(record.category_month_total, currency)}`,
    )
  }

  if (isFiniteNumber(record.allowance_spent)) {
    lines.push(
      `Total monthly spending through this event: ${formatAmount(record.allowance_spent, currency)}`,
    )
  }

  if (isFiniteNumber(record.allowance_limit)) {
    lines.push(`Monthly allowance: ${formatAmount(record.allowance_limit, currency)}`)
  }

  if (isFiniteNumber(record.allowance_consumed_pct)) {
    lines.push(
      `Allowance consumed through this event: ${formatNumber(record.allowance_consumed_pct)}%`,
    )
  }

  if (isFiniteNumber(record.clean_streak_before_event_days)) {
    lines.push(
      `Clean streak immediately before this event: ${formatNumber(record.clean_streak_before_event_days)} days`,
    )
  }

  if (isFiniteNumber(record.days_since_previous_category_event)) {
    lines.push(
      `Days since the previous same-category event: ${formatNumber(record.days_since_previous_category_event)}`,
    )
  }

  return lines
}

// --- Verdict prompt -------------------------------------------------------------------------

// Maps the client-facing verdict variants to the three canonical values accepted by the prompt.
function normalizeVerdictStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()

  if (normalized === 'guilty') return 'GUILTY'
  if (normalized === 'probation' || normalized === 'on probation') return 'ON PROBATION'
  if (normalized === 'not-guilty' || normalized === 'not guilty') return 'NOT GUILTY'

  return normalized.toUpperCase()
}

// Turns aggregate period statistics into a compact, readable case summary for Gemini. Derived
// labels and comedy hooks reduce the amount of arithmetic and pattern detection left to the model.
function buildVerdictPrompt(verdictStatus, stats, context, periodMode = 'month') {
  const isYear = periodMode === 'year'
  const periodLabel = isYear ? 'YEAR' : 'MONTH'
  const previousPeriodLabel = isYear ? 'Previous year' : 'Previous month'
  const verdictLabel = isYear ? 'Yearly Verdict' : 'Monthly Verdict'
  const juryMode = normalizeCourtStrictness(context.courtStrictness)
  const mostWanted = stats.mostWantedCategory
    ? `${stats.mostWantedCategory.label || stats.mostWantedCategory.id}: ${formatAmount(stats.mostWantedCategory.amount, context.currency)}`
    : 'none'
  const allowanceDifference =
    Number(stats.allowanceExceededBy) > 0
      ? `${formatAmount(stats.allowanceExceededBy, context.currency)} over budget`
      : getAllowanceUnderBudgetLabel(stats, context.currency)
  const budgetUsage = getBudgetUsageLabel(stats)
  const biggestCrime = formatAmount(stats.biggestCrime, context.currency)
  const biggestCrimeShare = getBiggestCrimeShareLabel(stats)
  const topCategories = getTopCategoriesLabel(stats, context.currency)
  const previousPeriod = getPreviousPeriodLabel(stats, context.currency, periodMode)
  const comedyHooks = getVerdictComedyHooks(stats, context, periodMode)

  return `
JURY MODE: ${juryMode.toUpperCase()}
VERDICT: ${verdictStatus}

${periodLabel}:
Total damages: ${formatAmount(stats.totalDamages, context.currency)}
Crimes: ${formatNumber(stats.crimesCommitted)}
Allowance: ${formatAmount(stats.allowance, context.currency)}
Budget difference: ${allowanceDifference}
Budget usage: ${budgetUsage}
Average crime: ${formatAmount(stats.averageCrime, context.currency)}
Largest crime: ${biggestCrime}
Largest crime share: ${biggestCrimeShare}
Prevented damages: ${formatAmount(stats.damagesPrevented, context.currency)}
Clean streak: ${formatNumber(stats.cleanStreak)} days
Most wanted category: ${mostWanted}
Top categories: ${topCategories}
${previousPeriodLabel}: ${previousPeriod}

COMEDY HOOKS:
${comedyHooks}

Write the final ${verdictLabel} sentence now.
Pick one comedy hook. Do not summarize the data. Turn one number or pattern into a joke with a punchline.
Return only the sentence the user should see.
`
}

// --- Prompt formatting helpers ---------------------------------------------------------------

// Restricts arbitrary client input to the supported tone modes and supplies a safe default.
function normalizeCourtStrictness(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (['chill', 'reasonable', 'ruthless'].includes(normalized)) return normalized
  return 'reasonable'
}

function normalizePeriodMode(value) {
  return String(value || '').toLowerCase() === 'year' ? 'year' : 'month'
}

// Formats raw numeric amounts consistently for natural-language prompts.
function formatAmount(amount, currency = 'EUR') {
  if (amount == null || Number.isNaN(Number(amount))) return 'unknown'

  const value = Number(amount)
  const rounded = Math.round(value * 100) / 100
  return `${rounded} ${currency || 'EUR'}`
}

// Normalizes numeric counters while preventing missing or invalid values from reaching the prompt.
function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return '0'
  return String(Number(value))
}

// Distinguishes a real zero from null, missing values and numeric-looking junk.
function isFiniteNumber(value) {
  return value !== null && value !== '' && Number.isFinite(Number(value))
}

// Caps free-form descriptions and notes so a single field cannot dominate the prompt.
function truncateText(value, maxLength) {
  const text = String(value || '').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3).trim()}...`
}

// Describes how far the month is below its allowance. Over-budget values are handled defensively
// too, even though buildVerdictPrompt normally selects that wording before calling this helper.
function getAllowanceUnderBudgetLabel(stats, currency) {
  if (stats.allowance == null || Number.isNaN(Number(stats.allowance))) return 'unknown'

  const totalDamages = Number(stats.totalDamages) || 0
  const allowance = Number(stats.allowance)
  const remaining = allowance - totalDamages

  if (remaining < 0) return `${formatAmount(Math.abs(remaining), currency)} over budget`
  return `${formatAmount(remaining, currency)} under budget`
}

// Converts the allowance ratio into the percentage label shown to Gemini.
function getBudgetUsageLabel(stats) {
  const allowance = Number(stats.allowance)
  if (!allowance) return 'unknown'

  const totalDamages = Number(stats.totalDamages) || 0
  return `${Math.round((totalDamages / allowance) * 100)}%`
}

// Expresses how much of the month's damage came from its single largest purchase.
function getBiggestCrimeShareLabel(stats) {
  const biggestAmount = Number(stats.biggestCrime)
  const totalDamages = Number(stats.totalDamages)

  if (!biggestAmount || !totalDamages) return 'unknown'
  return `${Math.round((biggestAmount / totalDamages) * 100)}% of total damage`
}

// Flattens the leading category aggregates into one concise prompt line.
function getTopCategoriesLabel(stats, currency) {
  if (!Array.isArray(stats.topCategories) || !stats.topCategories.length) return 'none'

  return stats.topCategories
    .map(
      (category) =>
        `${category.label || category.id}: ${formatAmount(category.amount, currency)} across ${formatNumber(category.count)} cases`,
    )
    .join('; ')
}

// Summarizes the direction and size of the change from the previous matching period.
function getPreviousPeriodLabel(stats, currency, periodMode) {
  const previous = stats.previousMonth
  if (!previous || previous.totalDamages == null) return 'unknown'

  const change = Number(previous.damageChange) || 0
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged'
  const percent =
    previous.damageChangePercent == null ? '' : ` (${Math.abs(previous.damageChangePercent)}%)`

  const previousPeriod = periodMode === 'year' ? 'year' : 'month'
  return `${formatAmount(previous.totalDamages, currency)} last ${previousPeriod}, ${direction} ${formatAmount(Math.abs(change), currency)}${percent}`
}

// Selects noteworthy statistical patterns that Gemini can turn into a verdict punchline. These are
// suggestions rather than final copy; the system prompt still controls tone and output format.
function getVerdictComedyHooks(stats, context, periodMode) {
  const currency = context.currency
  const periodNoun = periodMode === 'year' ? 'year' : 'month'
  const hooks = []
  const crimesCommitted = Number(stats.crimesCommitted) || 0
  const totalDamages = Number(stats.totalDamages) || 0
  const averageCrime = Number(stats.averageCrime) || 0
  const biggestCrime = Number(stats.biggestCrime) || 0
  const allowanceConsumed = Number(stats.allowanceConsumed) || 0
  const allowanceRemaining = Number(stats.allowanceRemaining)
  const mostWanted = stats.mostWantedCategory
  const previousChangePercent = stats.previousMonth?.damageChangePercent

  if (crimesCommitted >= 5 && totalDamages <= 75) {
    hooks.push(
      `${crimesCommitted} cases caused only ${formatAmount(totalDamages, currency)}: dramatic frequency, tiny damage.`,
    )
  }

  if (biggestCrime && totalDamages && biggestCrime / totalDamages >= 0.6) {
    hooks.push(
      `One purchase did ${Math.round((biggestCrime / totalDamages) * 100)}% of the damage: concentrated chaos.`,
    )
  }

  if (allowanceConsumed >= 0.9 && allowanceConsumed <= 1 && allowanceRemaining >= 0) {
    hooks.push(
      `The ${periodNoun} stayed under budget by ${formatAmount(allowanceRemaining, currency)}: a suspiciously narrow escape.`,
    )
  }

  if (allowanceConsumed > 1) {
    hooks.push(
      `The budget was exceeded by ${formatAmount(stats.allowanceExceededBy, currency)}: the limit became a suggestion.`,
    )
  }

  if (mostWanted?.count >= 3) {
    hooks.push(
      `${mostWanted.label || mostWanted.id} appeared ${formatNumber(mostWanted.count)} times: repetition is the evidence.`,
    )
  }

  if (averageCrime && averageCrime <= 15 && crimesCommitted >= 4) {
    hooks.push(
      `Average damage was ${formatAmount(averageCrime, currency)}: small purchases organized into a little parade.`,
    )
  }

  if (previousChangePercent != null && Math.abs(previousChangePercent) >= 10) {
    const direction = previousChangePercent > 0 ? 'worse' : 'better'
    hooks.push(
      `Spending got ${direction} by ${Math.abs(previousChangePercent)}% versus last ${periodNoun}.`,
    )
  }

  if (!hooks.length) {
    hooks.push(
      `${crimesCommitted} cases totaling ${formatAmount(totalDamages, currency)}: find the strangest interpretation, not a summary.`,
    )
  }

  return hooks.map((hook) => `- ${hook}`).join('\n')
}

// --- Telemetry and output cleanup ------------------------------------------------------------

// Reports whether this request was the first one served by the current function instance.
function takeColdStart() {
  const coldStart = isColdStart
  isColdStart = false
  return coldStart
}

// Normalizes Gemini SDK usage metadata because some model responses omit individual counters.
function getTokenUsage(response) {
  const usage = response?.usageMetadata || {}

  return {
    promptTokenCount: usage.promptTokenCount ?? null,
    candidatesTokenCount: usage.candidatesTokenCount ?? null,
    thoughtsTokenCount: usage.thoughtsTokenCount ?? null,
    totalTokenCount: usage.totalTokenCount ?? null,
  }
}

// Removes common model formatting artifacts and collapses multiline output into the single sentence
// expected by the current roast and verdict cards.
function cleanGeneratedText(value) {
  const fullText = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')

  const cleaned = fullText
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^\*\*(.*)\*\*$/, '$1')
    .replace(/^(roast|verdict|monthly verdict|yearly verdict|answer|output)\s*:\s*/i, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s*\(\s*\d+\s*chars?\s*\)?\s*$/i, '')
    .trim()

  if (isMetaCommentary(cleaned)) return ''

  return cleaned
}

// Rejects model self-critique or formatting instructions accidentally returned instead of user copy.
function isMetaCommentary(value) {
  return /\b(needs?|generic|punchline|output|answer|sentence|too long|too short|should mention)\b/i.test(
    value,
  )
}

module.exports = {
  callRoast,
  callVerdict,
  buildRoastPrompt,
  buildVerdictPrompt,
  cleanGeneratedText,
  generateWithModelFallback,
}
