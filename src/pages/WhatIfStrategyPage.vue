<template>
  <q-page class="strategy-page">
    <main class="strategy-shell">
      <div v-if="loading" class="page-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('whatIf.strategy.loading') }}</span>
      </div>
      <div v-else-if="error" class="page-state">
        <q-icon name="cloud_off" size="2rem" />
        <strong>{{ t('whatIf.errors.loadTitle') }}</strong>
        <q-btn color="primary" unelevated no-caps label="Retry" @click="prepare(true)" />
      </div>
      <template v-else>
        <header class="strategy-header">
          <div>
            <q-btn
              flat
              dense
              no-caps
              color="grey-7"
              icon="arrow_back"
              :label="t('navigation.plan')"
              :to="{ name: 'plan', params: { workspaceId } }"
              class="back-button"
            />
            <h1>{{ t('whatIf.strategy.title') }}</h1>
            <p>
              {{ t('whatIf.strategy.pageDescription', { amount: formatCurrency(monthlySavings) }) }}
            </p>
          </div>
          <div class="scenario-actions">
            <q-select
              :model-value="activeScenario.id"
              :options="scenarioOptions"
              emit-value
              map-options
              outlined
              dense
              options-dense
              class="scenario-select"
              :label="t('whatIf.strategy.scenario')"
              @update:model-value="selectScenario"
            />
            <q-btn
              outline
              no-caps
              icon="add"
              class="scenario-secondary-action"
              :label="t('whatIf.strategy.newScenario')"
              :disable="config.scenarios.length >= 10"
              @click="addScenario"
            />
            <q-btn
              flat
              round
              icon="more_horiz"
              class="scenario-secondary-action"
              :aria-label="t('whatIf.strategy.scenarioActions')"
            >
              <q-menu auto-close>
                <q-list dense style="min-width: 11rem">
                  <q-item clickable @click="resetScenario">
                    <q-item-section avatar><q-icon name="restart_alt" /></q-item-section>
                    <q-item-section>{{ t('whatIf.strategy.reset') }}</q-item-section>
                  </q-item>
                  <q-item
                    :disable="config.scenarios.length === 1"
                    clickable
                    @click="deleteScenario"
                  >
                    <q-item-section avatar
                      ><q-icon name="delete_outline" color="negative"
                    /></q-item-section>
                    <q-item-section>{{ t('whatIf.strategy.delete') }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </header>

        <div class="strategy-overview">
          <section class="panel overview-available-panel">
            <div>
              <span>{{ t('whatIf.strategy.available') }}</span>
              <strong
                >{{ formatCurrency(monthlySavings)
                }}<small>{{ t('whatIf.perMonth') }}</small></strong
              >
              <small>{{ t('whatIf.strategy.fromWhatIf') }}</small>
            </div>
            <q-icon name="signal_cellular_alt" />
          </section>

          <section class="panel overview-allocation-panel">
            <div class="overview-section-heading">
              <div>
                <h2>{{ t('whatIf.strategy.allocation') }}</h2>
                <p>
                  {{
                    t('whatIf.strategy.allocationDescription', {
                      amount: formatCurrency(monthlySavings),
                    })
                  }}
                </p>
              </div>
              <button
                type="button"
                class="text-link overview-heading-link"
                @click="allocationSheetOpen = true"
              >
                <q-icon name="edit" /> {{ t('whatIf.strategy.editSplit') }}
              </button>
            </div>

            <div class="allocation-bar" aria-hidden="true">
              <i class="cash" :style="{ width: `${allocation.cash}%` }" />
              <i class="invest" :style="{ width: `${allocation.invest}%` }" />
              <i class="debt" :style="{ width: `${allocation.debt}%` }" />
            </div>

            <div class="allocation-overview-metrics">
              <article class="cash">
                <span class="mini-icon cash"><q-icon name="health_and_safety" /></span>
                <small>{{ t('whatIf.cash.title') }}</small>
                <strong>{{ allocation.cash }}%</strong>
                <span>{{ formatCurrency(monthlyFor(allocation.cash)) }} / m</span>
              </article>
              <article class="invest">
                <span class="mini-icon invest"><q-icon name="trending_up" /></span>
                <small>{{ t('whatIf.strategy.investments') }}</small>
                <strong>{{ allocation.invest }}%</strong>
                <span>{{ formatCurrency(monthlyFor(allocation.invest)) }} / m</span>
              </article>
              <article v-if="selectedDebt" class="debt">
                <span class="mini-icon debt"><q-icon name="home" /></span>
                <small>{{ t('whatIf.debt.title') }}</small>
                <strong>{{ allocation.debt }}%</strong>
                <span>{{ formatCurrency(monthlyFor(allocation.debt)) }} / m</span>
              </article>
            </div>
          </section>

          <section class="panel overview-outcomes-panel">
            <div class="overview-section-heading">
              <div>
                <h2>{{ t('whatIf.strategy.projectedOutcomes') }}</h2>
                <p>
                  {{
                    t('whatIf.strategy.projectedOutcomesDescription', {
                      years: activeScenario.horizonYears,
                    })
                  }}
                </p>
              </div>
            </div>

            <div class="overview-outcome-list">
              <button
                v-for="outcome in strategyOutcomes"
                :key="outcome.id"
                type="button"
                class="overview-outcome"
                :aria-pressed="
                  $q.screen.gt.sm ? selectedDesktopOutcomeKind === outcomeKind(outcome) : undefined
                "
                @click="openOutcomeDetail(outcome)"
              >
                <span :class="['mini-icon', outcome.tone]"><q-icon :name="outcome.icon" /></span>
                <span class="outcome-copy">
                  <strong>{{ outcome.title }}</strong>
                  <small>{{ outcome.description }}</small>
                </span>
                <b :class="outcome.status">{{ outcome.result }}</b>
                <q-icon name="chevron_right" class="outcome-arrow" />
              </button>
            </div>
          </section>
        </div>

        <div class="desktop-projections">
          <section class="panel desktop-projection-panel">
            <template v-if="selectedDesktopOutcomeKind === 'cash'">
              <div class="desktop-projection-heading">
                <div>
                  <h2>{{ t('whatIf.strategy.cashDetails') }}</h2>
                  <p>{{ selectedDesktopOutcome?.description }}</p>
                </div>
                <div class="horizon-options">
                  <button
                    v-for="years in [10, 20, 30]"
                    :key="years"
                    type="button"
                    :class="{ selected: activeScenario.horizonYears === years }"
                    @click="updateScenario({ horizonYears: years })"
                  >
                    {{ years }} years
                  </button>
                  <button
                    type="button"
                    :class="{ selected: ![10, 20, 30].includes(activeScenario.horizonYears) }"
                    @click="setCustomHorizon"
                  >
                    {{ t('whatIf.reduction.custom') }}
                  </button>
                </div>
              </div>
              <div class="desktop-projection-value">
                <span>{{ t('whatIf.strategy.projectedCashLabel') }}</span>
                <strong>{{ formatCurrency(projection.strategy.cash) }}</strong>
                <small>{{
                  t('whatIf.strategy.inYears', { years: activeScenario.horizonYears })
                }}</small>
              </div>
              <StrategyProjectionChart
                :strategy-points="cashProjectionPoints"
                :baseline-points="baselineCashProjectionPoints"
                :baseline-label="t('whatIf.strategy.currentPath')"
                :strategy-label="t('whatIf.strategy.strategyPath')"
                :aria-label="t('whatIf.strategy.cashChartAria')"
                class="desktop-strategy-chart"
              />
              <div class="result-breakdown desktop-result-breakdown">
                <span>
                  <small>{{ t('whatIf.strategy.startingValue') }}</small>
                  <strong>{{ formatCurrency(startingPosition.cash) }}</strong>
                </span>
                <span>
                  <small>{{ t('whatIf.strategy.cashContributions') }}</small>
                  <strong>{{ formatCurrency(projection.strategy.cashContributions) }}</strong>
                </span>
                <span>
                  <small>{{ t('whatIf.strategy.cashGrowth') }}</small>
                  <strong>{{ formatCurrency(projection.strategy.cashGrowth) }}</strong>
                </span>
                <span>
                  <small>{{ t('whatIf.strategy.target') }}</small>
                  <strong>{{ formatCurrency(projection.strategy.cashTarget) }}</strong>
                </span>
              </div>
            </template>

            <template v-else-if="selectedDesktopOutcomeKind === 'investment'">
              <div class="desktop-projection-heading">
                <div>
                  <h2>{{ t('whatIf.strategy.projectionPreview') }}</h2>
                  <p>{{ t('whatIf.strategy.projectionPreviewDescription') }}</p>
                </div>
                <div class="desktop-projection-controls">
                  <div class="horizon-options">
                    <button
                      v-for="years in [10, 20, 30]"
                      :key="years"
                      type="button"
                      :class="{ selected: activeScenario.horizonYears === years }"
                      @click="updateScenario({ horizonYears: years })"
                    >
                      {{ years }} years
                    </button>
                    <button
                      type="button"
                      :class="{ selected: ![10, 20, 30].includes(activeScenario.horizonYears) }"
                      @click="setCustomHorizon"
                    >
                      {{ t('whatIf.reduction.custom') }}
                    </button>
                  </div>
                  <div class="projection-view-switch">
                    <button
                      type="button"
                      :class="{ selected: projectionChartMode === 'total' }"
                      @click="projectionChartMode = 'total'"
                    >
                      {{ t('whatIf.strategy.chartView.total') }}
                    </button>
                    <button
                      type="button"
                      :class="{ selected: projectionChartMode === 'breakdown' }"
                      @click="projectionChartMode = 'breakdown'"
                    >
                      {{ t('whatIf.strategy.chartView.breakdown') }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="desktop-projection-value">
                <span>{{ t('whatIf.strategy.projectedInvestmentValue') }}</span>
                <strong>{{ formatCurrency(projection.strategy.investmentValue) }}</strong>
                <small>{{
                  t('whatIf.strategy.inYears', { years: activeScenario.horizonYears })
                }}</small>
              </div>
              <StrategyProjectionChart
                :strategy-points="investmentProjectionPoints"
                :baseline-points="baselineInvestmentProjectionPoints"
                :mode="projectionChartMode"
                class="desktop-strategy-chart"
              />
              <div class="result-breakdown desktop-result-breakdown">
                <span>
                  <small>{{ t('whatIf.strategy.startingValue') }}</small>
                  <strong>{{ formatCurrency(startingPosition.investmentTotal) }}</strong>
                </span>
                <span>
                  <small>{{ t('whatIf.strategy.contributions') }}</small>
                  <strong>{{ formatCurrency(projection.strategy.investmentContributions) }}</strong>
                </span>
                <span>
                  <small>{{ t('whatIf.strategy.growth') }}</small>
                  <strong>{{ formatCurrency(projection.strategy.growth) }}</strong>
                </span>
              </div>
            </template>

            <template v-else-if="selectedDesktopOutcomeKind === 'netWorth'">
              <div class="desktop-projection-heading">
                <div>
                  <h2>{{ t('whatIf.strategy.netWorthDetails') }}</h2>
                  <p>{{ selectedDesktopOutcome?.description }}</p>
                </div>
                <div class="horizon-options">
                  <button
                    v-for="years in [10, 20, 30]"
                    :key="years"
                    type="button"
                    :class="{ selected: activeScenario.horizonYears === years }"
                    @click="updateScenario({ horizonYears: years })"
                  >
                    {{ years }} years
                  </button>
                  <button
                    type="button"
                    :class="{ selected: ![10, 20, 30].includes(activeScenario.horizonYears) }"
                    @click="setCustomHorizon"
                  >
                    {{ t('whatIf.reduction.custom') }}
                  </button>
                </div>
              </div>
              <div class="desktop-projection-value">
                <span>{{ t('whatIf.strategy.projectedNetWorthLabel') }}</span>
                <strong>{{ formatCurrency(projectedNetWorth) }}</strong>
                <small>{{
                  t('whatIf.strategy.inYears', { years: activeScenario.horizonYears })
                }}</small>
              </div>
              <StrategyProjectionChart
                :strategy-points="netWorthPoints"
                :baseline-points="baselineNetWorthPoints"
                :baseline-label="t('whatIf.strategy.currentPath')"
                :strategy-label="t('whatIf.strategy.strategyPath')"
                :aria-label="t('whatIf.strategy.netWorthChartAria')"
                class="desktop-strategy-chart"
              />
              <div class="result-breakdown desktop-result-breakdown">
                <span>
                  <small>{{ t('whatIf.strategy.currentNetWorth') }}</small>
                  <strong>{{ formatCurrency(currentNetWorth) }}</strong>
                </span>
                <span>
                  <small>{{ t('whatIf.strategy.projectedGrowthLabel') }}</small>
                  <strong class="positive">{{
                    formatCurrency(projectedNetWorth - currentNetWorth)
                  }}</strong>
                </span>
              </div>
            </template>

            <template v-else-if="selectedDebt">
              <div class="desktop-projection-heading">
                <div>
                  <h2>{{ t('whatIf.strategy.debtProjection.title') }}</h2>
                  <p>{{ debtInfoText }}</p>
                </div>
                <q-select
                  :model-value="selectedDebt.id"
                  :options="liabilityOptions"
                  emit-value
                  map-options
                  dense
                  outlined
                  options-dense
                  class="desktop-debt-select"
                  @update:model-value="updateScenario({ selectedLiabilityId: $event })"
                />
              </div>

              <template v-if="debtPayoff">
                <MortgageComparisonChart
                  :normal-schedule="debtPayoff.schedule"
                  :accelerated-schedule="debtPayoff.accelerated.schedule"
                  :starting-balance="selectedDebtModel.balance"
                  :start-date="localToday()"
                  :normal-label="t('whatIf.strategy.debtProjection.normalPayment')"
                  :accelerated-label="t('whatIf.strategy.debtProjection.withExtraPayment')"
                  :aria-label="t('whatIf.strategy.debtProjection.chartAria')"
                  class="desktop-mortgage-chart"
                />
                <div class="result-breakdown debt-result-breakdown desktop-result-breakdown">
                  <span>
                    <small>{{ t('whatIf.strategy.debtProjection.normalPayoff') }}</small>
                    <strong>{{ formatMonthYear(debtPayoff.payoffDate) }}</strong>
                  </span>
                  <span>
                    <small>{{ t('whatIf.strategy.debtProjection.strategyPayoff') }}</small>
                    <strong>{{ formatMonthYear(debtPayoff.accelerated.payoffDate) }}</strong>
                  </span>
                  <span>
                    <small>{{ t('whatIf.strategy.finishEarlier') }}</small>
                    <strong>{{ formatDuration(debtPayoff.accelerated.monthsEarlier) }}</strong>
                  </span>
                  <span>
                    <small>{{ t('whatIf.strategy.interestSaved') }}</small>
                    <strong class="positive">{{
                      formatCurrency(debtPayoff.accelerated.interestSaved)
                    }}</strong>
                  </span>
                </div>
              </template>
              <div v-else class="debt-projection-fallback">
                <q-icon name="info_outline" />
                <div>
                  <strong>{{ t('whatIf.strategy.debtProjection.title') }}</strong>
                  <p>{{ t('whatIf.strategy.debtDisclaimer') }}</p>
                </div>
              </div>
            </template>
          </section>
        </div>

        <div class="strategy-layout legacy-strategy-layout">
          <div class="configuration-column">
            <section class="panel available-panel">
              <div>
                <span>{{ t('whatIf.strategy.available') }}</span>
                <strong
                  >{{ formatCurrency(monthlySavings)
                  }}<small>{{ t('whatIf.perMonth') }}</small></strong
                >
                <small>{{ t('whatIf.strategy.fromWhatIf') }}</small>
              </div>
              <q-icon name="signal_cellular_alt" />
            </section>

            <section class="panel allocation-panel">
              <div class="panel-heading">
                <h2>{{ t('whatIf.strategy.allocation') }}</h2>
                <p>
                  {{
                    t('whatIf.strategy.allocationDescription', {
                      amount: formatCurrency(monthlySavings),
                    })
                  }}
                </p>
              </div>
              <div class="allocation-list">
                <StrategyAllocationRow
                  icon="paid"
                  tone="cash"
                  :title="t('whatIf.cash.title')"
                  :description="t('whatIf.strategy.cashDescription')"
                  :percent="allocation.cash"
                  :amount="monthlyFor(allocation.cash)"
                  @change="setAllocation('cash', $event)"
                />
                <StrategyAllocationRow
                  icon="trending_up"
                  tone="invest"
                  :title="t('whatIf.strategy.investments')"
                  :description="t('whatIf.strategy.investDescription')"
                  :percent="allocation.invest"
                  :amount="monthlyFor(allocation.invest)"
                  @change="setAllocation('invest', $event)"
                />
                <StrategyAllocationRow
                  v-if="selectedDebt"
                  icon="home"
                  tone="debt"
                  :title="t('whatIf.debt.title')"
                  :description="t('whatIf.strategy.debtDescription')"
                  :percent="allocation.debt"
                  :amount="monthlyFor(allocation.debt)"
                  @change="setAllocation('debt', $event)"
                />
              </div>
              <div class="allocation-total">
                <span>{{ t('whatIf.strategy.total') }}</span>
                <strong>100%</strong>
                <strong>{{ formatCurrency(monthlySavings) }}{{ t('whatIf.perMonth') }}</strong>
              </div>
            </section>

            <section class="panel mix-panel">
              <div class="panel-heading">
                <h2>{{ t('whatIf.strategy.investmentMix') }}</h2>
                <p>{{ t('whatIf.strategy.investmentMixDescription') }}</p>
              </div>
              <div class="mix-list">
                <article v-for="entry in activeMix" :key="entry.id" class="investment-mix-card">
                  <span :class="['mix-card-icon', entry.tone]">
                    <q-icon :name="entry.icon" />
                  </span>
                  <div class="mix-card-identity">
                    <strong>{{ entry.label }}</strong>
                    <small>{{ entry.description }}</small>
                  </div>
                  <button
                    type="button"
                    class="mix-card-metric editable-metric allocation-metric"
                    :aria-label="`Edit ${entry.label} allocation`"
                  >
                    <strong>{{ entry.allocation }}%</strong>
                    <small>{{ t('whatIf.strategy.ofInvestments') }}</small>
                    <q-popup-edit
                      :model-value="entry.allocation"
                      buttons
                      :title="t('whatIf.strategy.investmentAllocation')"
                      :label-set="t('common.save')"
                      :label-cancel="t('common.cancel')"
                      @save="setMixAllocation(entry.id, $event)"
                    >
                      <template #default="scope">
                        <q-input
                          v-model.number="scope.value"
                          autofocus
                          dense
                          outlined
                          type="number"
                          inputmode="numeric"
                          min="0"
                          max="100"
                          step="5"
                          suffix="%"
                          @keyup.enter="scope.set"
                        />
                      </template>
                    </q-popup-edit>
                  </button>
                  <button
                    type="button"
                    class="mix-card-metric editable-metric return-metric"
                    :aria-label="`Edit ${entry.label} expected return`"
                  >
                    <strong>{{ Number(entry.annualReturnPercent).toFixed(1) }}%</strong>
                    <small>{{ t('whatIf.strategy.expectedReturnShort') }}</small>
                    <q-popup-edit
                      :model-value="entry.annualReturnPercent"
                      buttons
                      :title="t('whatIf.strategy.expectedAnnualReturn')"
                      :label-set="t('common.save')"
                      :label-cancel="t('common.cancel')"
                      @save="setReturn(entry.id, $event)"
                    >
                      <template #default="scope">
                        <q-input
                          v-model.number="scope.value"
                          autofocus
                          dense
                          outlined
                          type="number"
                          inputmode="decimal"
                          min="0"
                          max="100"
                          step="0.1"
                          suffix="%"
                          @keyup.enter="scope.set"
                        />
                      </template>
                    </q-popup-edit>
                  </button>
                  <span class="mix-card-amount">
                    <strong>
                      {{ formatCurrency((monthlyFor(allocation.invest) * entry.allocation) / 100) }}
                    </strong>
                    <small>{{ t('whatIf.perMonth').trim() }}</small>
                  </span>
                  <q-btn
                    v-if="activeMix.length > 1"
                    flat
                    round
                    dense
                    icon="delete_outline"
                    color="negative"
                    size="sm"
                    :aria-label="`${t('whatIf.strategy.removeInvestmentType')}: ${entry.label}`"
                    class="mix-card-remove"
                    @click="removeMix(entry.id)"
                  />
                </article>
              </div>
              <button
                v-if="availableMixOptions.length"
                type="button"
                class="add-investment-card"
                @click="openInvestmentTypeDialog"
              >
                <q-icon name="add" />
                {{ t('whatIf.strategy.addInvestmentType') }}
              </button>
            </section>

            <div v-if="allocation.cash > 0" class="small-panels single-detail">
              <section class="panel strategy-detail">
                <div class="detail-title">
                  <span class="mini-icon cash"><q-icon name="paid" /></span>
                  <div>
                    <h2>{{ t('whatIf.strategy.cashStrategy') }}</h2>
                    <p>{{ t('whatIf.strategy.cashTarget') }}</p>
                  </div>
                </div>
                <div class="detail-values">
                  <span
                    ><small>{{ t('whatIf.strategy.current') }}</small
                    ><strong>{{ formatCurrency(startingPosition.cash) }}</strong></span
                  >
                  <span
                    ><small>{{ t('whatIf.strategy.target') }}</small
                    ><strong>{{ formatCurrency(projection.strategy.cashTarget) }}</strong></span
                  >
                  <span
                    ><small>{{ t('whatIf.strategy.allocatedMonthly') }}</small
                    ><strong>{{ formatCurrency(monthlyFor(allocation.cash)) }}</strong></span
                  >
                </div>
                <q-select
                  :model-value="activeScenario.cashTargetMonths"
                  :options="cashTargetOptions"
                  emit-value
                  map-options
                  dense
                  outlined
                  :label="t('whatIf.strategy.emergencyFundTarget')"
                  @update:model-value="updateScenario({ cashTargetMonths: $event })"
                />
                <small class="redirect-note">{{ t('whatIf.strategy.redirectCash') }}</small>
              </section>
            </div>
          </div>

          <div class="results-column">
            <div class="strategy-section-heading results-heading">
              <h2>{{ t('whatIf.strategy.resultsTitle') }}</h2>
            </div>

            <section v-if="allocation.invest > 0" class="panel projection-panel">
              <div class="projection-heading">
                <div>
                  <h2>{{ t('whatIf.strategy.investmentStrategy') }}</h2>
                </div>
                <div class="projection-controls">
                  <div class="horizon-options desktop-horizon-options">
                    <button
                      v-for="years in [10, 20, 30]"
                      :key="years"
                      type="button"
                      :class="{ selected: activeScenario.horizonYears === years }"
                      :aria-label="`${years} ${t('whatIf.years')}`"
                      @click="updateScenario({ horizonYears: years })"
                    >
                      {{ years }}<span class="horizon-unit"> years</span>
                    </button>
                    <button
                      type="button"
                      :class="{ selected: ![10, 20, 30].includes(activeScenario.horizonYears) }"
                      :aria-label="t('whatIf.reduction.custom')"
                      @click="setCustomHorizon"
                    >
                      {{ t('whatIf.reduction.custom') }}
                    </button>
                  </div>
                  <div
                    class="projection-view-switch desktop-view-switch"
                    role="group"
                    :aria-label="t('whatIf.strategy.chartView.label')"
                  >
                    <button
                      type="button"
                      :class="{ selected: projectionChartMode === 'total' }"
                      :aria-pressed="projectionChartMode === 'total'"
                      @click="projectionChartMode = 'total'"
                    >
                      {{ t('whatIf.strategy.chartView.total') }}
                    </button>
                    <button
                      type="button"
                      :class="{ selected: projectionChartMode === 'breakdown' }"
                      :aria-pressed="projectionChartMode === 'breakdown'"
                      @click="projectionChartMode = 'breakdown'"
                    >
                      {{ t('whatIf.strategy.chartView.breakdown') }}
                    </button>
                  </div>
                </div>
              </div>
              <div class="projection-result-row">
                <div class="projected-total">
                  <strong>{{ formatCurrency(projection.strategy.investmentValue) }}</strong>
                  <span>{{
                    t('whatIf.strategy.inYears', { years: activeScenario.horizonYears })
                  }}</span>
                </div>
                <div
                  class="projection-view-switch mobile-view-switch"
                  role="group"
                  :aria-label="t('whatIf.strategy.chartView.label')"
                >
                  <button
                    type="button"
                    :class="{ selected: projectionChartMode === 'total' }"
                    :aria-pressed="projectionChartMode === 'total'"
                    @click="projectionChartMode = 'total'"
                  >
                    {{ t('whatIf.strategy.chartView.total') }}
                  </button>
                  <button
                    type="button"
                    :class="{ selected: projectionChartMode === 'breakdown' }"
                    :aria-pressed="projectionChartMode === 'breakdown'"
                    @click="projectionChartMode = 'breakdown'"
                  >
                    {{ t('whatIf.strategy.chartView.breakdown') }}
                  </button>
                </div>
              </div>
              <StrategyProjectionChart
                :strategy-points="investmentProjectionPoints"
                :baseline-points="baselineInvestmentProjectionPoints"
                :mode="projectionChartMode"
              />
              <div class="result-breakdown">
                <span
                  ><small>{{ t('whatIf.strategy.startingValue') }}</small
                  ><strong>{{ formatCurrency(startingPosition.investmentTotal) }}</strong></span
                >
                <span
                  ><small>{{ t('whatIf.strategy.contributions') }}</small
                  ><strong>{{
                    formatCurrency(projection.strategy.investmentContributions)
                  }}</strong></span
                >
                <span
                  ><small>{{ t('whatIf.strategy.growth') }}</small
                  ><strong>{{ formatCurrency(projection.strategy.growth) }}</strong></span
                >
              </div>
            </section>

            <section v-if="selectedDebt && allocation.debt > 0" class="panel debt-projection-panel">
              <div class="projection-heading">
                <div>
                  <h2>{{ t('whatIf.strategy.debtProjection.title') }}</h2>
                  <p>{{ debtInfoText }}</p>
                </div>
                <div class="debt-projection-controls">
                  <q-select
                    :model-value="selectedDebt.id"
                    :options="liabilityOptions"
                    emit-value
                    map-options
                    dense
                    outlined
                    options-dense
                    @update:model-value="updateScenario({ selectedLiabilityId: $event })"
                  />
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="info_outline"
                    :aria-label="t('whatIf.strategy.debtInfoAction')"
                    @click="debtInfoDialogOpen = true"
                  />
                </div>
              </div>

              <template v-if="debtPayoff">
                <MortgageComparisonChart
                  :normal-schedule="debtPayoff.schedule"
                  :accelerated-schedule="debtPayoff.accelerated.schedule"
                  :starting-balance="selectedDebtModel.balance"
                  :start-date="localToday()"
                  :normal-label="t('whatIf.strategy.debtProjection.normalPayment')"
                  :accelerated-label="t('whatIf.strategy.debtProjection.withExtraPayment')"
                  :aria-label="t('whatIf.strategy.debtProjection.chartAria')"
                  class="embedded-debt-chart"
                />
                <div class="result-breakdown debt-result-breakdown">
                  <span>
                    <small>{{ t('whatIf.strategy.debtProjection.normalPayoff') }}</small>
                    <strong>{{ formatMonthYear(debtPayoff.payoffDate) }}</strong>
                  </span>
                  <span>
                    <small>{{ t('whatIf.strategy.debtProjection.strategyPayoff') }}</small>
                    <strong>{{ formatMonthYear(debtPayoff.accelerated.payoffDate) }}</strong>
                  </span>
                  <span>
                    <small>{{ t('whatIf.strategy.finishEarlier') }}</small>
                    <strong>{{ formatDuration(debtPayoff.accelerated.monthsEarlier) }}</strong>
                  </span>
                  <span>
                    <small>{{ t('whatIf.strategy.interestSaved') }}</small>
                    <strong class="positive">
                      {{ formatCurrency(debtPayoff.accelerated.interestSaved) }}
                    </strong>
                  </span>
                </div>
              </template>
              <div v-else class="debt-projection-fallback">
                <q-icon name="info_outline" />
                <div>
                  <strong>
                    {{
                      t('whatIf.debt.perYear', {
                        amount: formatCurrency(projection.strategy.annualDebtContribution),
                      })
                    }}
                  </strong>
                  <p>{{ t('whatIf.strategy.debtDisclaimer') }}</p>
                </div>
              </div>
            </section>

            <div class="strategy-section-heading impact-heading">
              <h2>{{ t('whatIf.strategy.impactTitle') }}</h2>
            </div>

            <section class="panel milestones-panel">
              <div class="panel-heading">
                <h2>{{ t('whatIf.strategy.milestonesImpacted') }}</h2>
                <p>{{ t('whatIf.strategy.milestonesDescription') }}</p>
              </div>
              <div v-for="outcome in strategyOutcomes" :key="outcome.id" class="milestone-card">
                <span :class="['mini-icon', outcome.tone]">
                  <q-icon :name="outcome.icon" />
                </span>
                <div class="outcome-copy">
                  <span class="outcome-title">
                    <strong>{{ outcome.title }}</strong>
                    <q-btn
                      v-if="outcome.showInfo"
                      flat
                      round
                      dense
                      size="sm"
                      icon="info_outline"
                      class="outcome-info-button"
                      :aria-label="t('whatIf.strategy.freedomInfoAction')"
                      @click="freedomInfoDialogOpen = true"
                    />
                  </span>
                  <small>{{ outcome.description }}</small>
                </div>
                <b :class="outcome.status">{{ outcome.result }}</b>
              </div>
            </section>
          </div>
        </div>
      </template>
    </main>

    <q-dialog v-model="allocationSheetOpen" :position="$q.screen.lt.md ? 'bottom' : undefined">
      <q-card class="strategy-sheet allocation-sheet">
        <span class="strategy-sheet-handle" aria-hidden="true" />
        <q-card-section class="strategy-sheet-heading">
          <div>
            <h2>{{ t('whatIf.strategy.editAllocation') }}</h2>
            <p>
              {{
                t('whatIf.strategy.editAllocationDescription', {
                  amount: formatCurrency(monthlySavings),
                })
              }}
            </p>
          </div>
          <q-btn flat round dense icon="close" v-close-popup :aria-label="t('common.close')" />
        </q-card-section>

        <q-card-section class="strategy-sheet-scroll">
          <div class="sheet-allocation-list">
            <StrategyAllocationRow
              icon="paid"
              tone="cash"
              :title="t('whatIf.cash.title')"
              :description="t('whatIf.strategy.cashDescription')"
              :percent="allocation.cash"
              :amount="monthlyFor(allocation.cash)"
              @change="setAllocation('cash', $event)"
            />
            <StrategyAllocationRow
              icon="trending_up"
              tone="invest"
              :title="t('whatIf.strategy.investments')"
              :description="t('whatIf.strategy.investDescription')"
              :percent="allocation.invest"
              :amount="monthlyFor(allocation.invest)"
              @change="setAllocation('invest', $event)"
            />
            <StrategyAllocationRow
              v-if="selectedDebt"
              icon="home"
              tone="debt"
              :title="t('whatIf.debt.title')"
              :description="t('whatIf.strategy.debtDescription')"
              :percent="allocation.debt"
              :amount="monthlyFor(allocation.debt)"
              @change="setAllocation('debt', $event)"
            />
          </div>

          <div class="allocation-total sheet-allocation-total">
            <span>{{ t('whatIf.strategy.total') }}</span>
            <strong>100%</strong>
            <strong>{{ formatCurrency(monthlySavings) }}{{ t('whatIf.perMonth') }}</strong>
          </div>

          <div class="sheet-subheading">
            <h3>{{ t('whatIf.strategy.cashReturn') }}</h3>
            <p>{{ t('whatIf.strategy.cashReturnDescription') }}</p>
          </div>
          <article class="investment-mix-card cash-return-card">
            <span class="mix-card-icon cash-return"><q-icon name="savings" /></span>
            <div class="mix-card-identity">
              <strong>{{ t('whatIf.cash.title') }}</strong>
              <small>{{ t('whatIf.strategy.cashDescription') }}</small>
            </div>
            <button type="button" class="mix-card-metric editable-metric return-metric">
              <strong>{{ Number(activeScenario.cashAnnualReturnPercent).toFixed(1) }}%</strong>
              <small>{{ t('whatIf.strategy.expectedReturnShort') }}</small>
              <q-popup-edit
                :model-value="activeScenario.cashAnnualReturnPercent"
                buttons
                :title="t('whatIf.strategy.cashAnnualReturn')"
                :label-set="t('common.save')"
                :label-cancel="t('common.cancel')"
                @save="setCashReturn"
              >
                <template #default="scope">
                  <q-input
                    v-model.number="scope.value"
                    autofocus
                    dense
                    outlined
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    suffix="%"
                    @keyup.enter="scope.set"
                  />
                </template>
              </q-popup-edit>
            </button>
          </article>

          <div class="sheet-subheading">
            <h3>{{ t('whatIf.strategy.investmentMix') }}</h3>
            <p>{{ t('whatIf.strategy.investmentMixDescription') }}</p>
          </div>
          <div class="mix-list sheet-mix-list">
            <article v-for="entry in activeMix" :key="entry.id" class="investment-mix-card">
              <span :class="['mix-card-icon', entry.tone]">
                <q-icon :name="entry.icon" />
              </span>
              <div class="mix-card-identity">
                <strong>{{ entry.label }}</strong>
                <small>{{ entry.description }}</small>
              </div>
              <button type="button" class="mix-card-metric editable-metric allocation-metric">
                <strong>{{ entry.allocation }}%</strong>
                <small>{{ t('whatIf.strategy.ofInvestments') }}</small>
                <q-popup-edit
                  :model-value="entry.allocation"
                  buttons
                  :title="t('whatIf.strategy.investmentAllocation')"
                  :label-set="t('common.save')"
                  :label-cancel="t('common.cancel')"
                  @save="setMixAllocation(entry.id, $event)"
                >
                  <template #default="scope">
                    <q-input
                      v-model.number="scope.value"
                      autofocus
                      dense
                      outlined
                      type="number"
                      min="0"
                      max="100"
                      suffix="%"
                      @keyup.enter="scope.set"
                    />
                  </template>
                </q-popup-edit>
              </button>
              <button type="button" class="mix-card-metric editable-metric return-metric">
                <strong>{{ Number(entry.annualReturnPercent).toFixed(1) }}%</strong>
                <small>{{ t('whatIf.strategy.expectedReturnShort') }}</small>
                <q-popup-edit
                  :model-value="entry.annualReturnPercent"
                  buttons
                  :title="t('whatIf.strategy.expectedAnnualReturn')"
                  :label-set="t('common.save')"
                  :label-cancel="t('common.cancel')"
                  @save="setReturn(entry.id, $event)"
                >
                  <template #default="scope">
                    <q-input
                      v-model.number="scope.value"
                      autofocus
                      dense
                      outlined
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      suffix="%"
                      @keyup.enter="scope.set"
                    />
                  </template>
                </q-popup-edit>
              </button>
              <span class="mix-card-amount">
                <strong>
                  {{ formatCurrency((monthlyFor(allocation.invest) * entry.allocation) / 100) }}
                </strong>
                <small>{{ t('whatIf.perMonth').trim() }}</small>
              </span>
              <q-btn
                v-if="activeMix.length > 1"
                flat
                round
                dense
                icon="delete_outline"
                color="negative"
                size="sm"
                class="mix-card-remove"
                @click="removeMix(entry.id)"
              />
            </article>
          </div>
          <button
            v-if="availableMixOptions.length"
            type="button"
            class="add-investment-card"
            @click="openInvestmentTypeDialog"
          >
            <q-icon name="add" />
            {{ t('whatIf.strategy.addInvestmentType') }}
          </button>
        </q-card-section>

        <q-card-actions class="strategy-sheet-actions">
          <q-btn outline no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.save')"
            @click="allocationSheetOpen = false"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="detailSheetOpen" :position="$q.screen.lt.md ? 'bottom' : undefined">
      <q-card class="strategy-sheet projection-detail-sheet">
        <span class="strategy-sheet-handle" aria-hidden="true" />
        <q-card-section class="strategy-sheet-heading">
          <div>
            <h2>{{ detailSheetTitle }}</h2>
            <p>{{ t('whatIf.strategy.strategyVsCurrent') }}</p>
          </div>
          <q-btn flat round dense icon="close" v-close-popup :aria-label="t('common.close')" />
        </q-card-section>
        <q-card-section class="strategy-sheet-scroll detail-sheet-content">
          <section v-if="detailSheetKind === 'cash'" class="detail-sheet-section">
            <div class="detail-values large-detail-values">
              <span
                ><small>{{ t('whatIf.strategy.current') }}</small
                ><strong>{{ formatCurrency(startingPosition.cash) }}</strong></span
              >
              <span
                ><small>{{ t('whatIf.strategy.target') }}</small
                ><strong>{{ formatCurrency(projection.strategy.cashTarget) }}</strong></span
              >
              <span
                ><small>{{ t('whatIf.strategy.allocatedMonthly') }}</small
                ><strong>{{ formatCurrency(monthlyFor(allocation.cash)) }}</strong></span
              >
            </div>
            <q-select
              :model-value="activeScenario.cashTargetMonths"
              :options="cashTargetOptions"
              emit-value
              map-options
              outlined
              :label="t('whatIf.strategy.emergencyFundTarget')"
              @update:model-value="updateScenario({ cashTargetMonths: $event })"
            />
          </section>

          <section
            v-if="['investment', 'projection'].includes(detailSheetKind)"
            class="detail-sheet-section"
          >
            <div class="detail-section-heading investment-detail-heading">
              <h3>{{ t('whatIf.strategy.investmentStrategy') }}</h3>
              <div class="projection-view-switch detail-view-switch">
                <button
                  type="button"
                  :class="{ selected: projectionChartMode === 'total' }"
                  @click="projectionChartMode = 'total'"
                >
                  {{ t('whatIf.strategy.chartView.total') }}
                </button>
                <button
                  type="button"
                  :class="{ selected: projectionChartMode === 'breakdown' }"
                  @click="projectionChartMode = 'breakdown'"
                >
                  {{ t('whatIf.strategy.chartView.breakdown') }}
                </button>
              </div>
            </div>
            <div class="horizon-options detail-horizon-options">
              <button
                v-for="years in [10, 20, 30]"
                :key="years"
                type="button"
                :class="{ selected: activeScenario.horizonYears === years }"
                @click="updateScenario({ horizonYears: years })"
              >
                {{ years }}y
              </button>
            </div>
            <div class="projected-total detail-projected-total">
              <strong>{{ formatCurrency(projection.strategy.investmentValue) }}</strong>
              <span>{{
                t('whatIf.strategy.inYears', { years: activeScenario.horizonYears })
              }}</span>
            </div>
            <StrategyProjectionChart
              :strategy-points="investmentProjectionPoints"
              :baseline-points="baselineInvestmentProjectionPoints"
              :mode="projectionChartMode"
            />
            <div class="result-breakdown">
              <span
                ><small>{{ t('whatIf.strategy.startingValue') }}</small
                ><strong>{{ formatCurrency(startingPosition.investmentTotal) }}</strong></span
              >
              <span
                ><small>{{ t('whatIf.strategy.contributions') }}</small
                ><strong>{{
                  formatCurrency(projection.strategy.investmentContributions)
                }}</strong></span
              >
              <span
                ><small>{{ t('whatIf.strategy.growth') }}</small
                ><strong>{{ formatCurrency(projection.strategy.growth) }}</strong></span
              >
            </div>
          </section>

          <section v-if="detailSheetKind === 'netWorth'" class="detail-sheet-section">
            <div class="net-worth-detail-hero">
              <span>{{ t('whatIf.strategy.projectedNetWorthLabel') }}</span>
              <strong>{{ formatCurrency(projectedNetWorth) }}</strong>
              <small>{{
                t('whatIf.strategy.inYears', { years: activeScenario.horizonYears })
              }}</small>
            </div>
            <div class="detail-values large-detail-values two-values">
              <span
                ><small>{{ t('whatIf.strategy.currentNetWorth') }}</small
                ><strong>{{ formatCurrency(currentNetWorth) }}</strong></span
              >
              <span
                ><small>{{ t('whatIf.strategy.projectedGrowthLabel') }}</small
                ><strong class="positive">{{
                  formatCurrency(projectedNetWorth - currentNetWorth)
                }}</strong></span
              >
            </div>
          </section>

          <section
            v-if="selectedDebt && ['debt', 'projection'].includes(detailSheetKind)"
            class="detail-sheet-section"
          >
            <div class="detail-section-heading">
              <h3>{{ t('whatIf.strategy.debtProjection.title') }}</h3>
              <q-select
                :model-value="selectedDebt.id"
                :options="liabilityOptions"
                emit-value
                map-options
                dense
                outlined
                @update:model-value="updateScenario({ selectedLiabilityId: $event })"
              />
            </div>
            <template v-if="debtPayoff">
              <MortgageComparisonChart
                :normal-schedule="debtPayoff.schedule"
                :accelerated-schedule="debtPayoff.accelerated.schedule"
                :starting-balance="selectedDebtModel.balance"
                :start-date="localToday()"
                :normal-label="t('whatIf.strategy.debtProjection.normalPayment')"
                :accelerated-label="t('whatIf.strategy.debtProjection.withExtraPayment')"
                :aria-label="t('whatIf.strategy.debtProjection.chartAria')"
              />
              <div class="result-breakdown debt-result-breakdown">
                <span
                  ><small>{{ t('whatIf.strategy.debtProjection.normalPayoff') }}</small
                  ><strong>{{ formatMonthYear(debtPayoff.payoffDate) }}</strong></span
                >
                <span
                  ><small>{{ t('whatIf.strategy.debtProjection.strategyPayoff') }}</small
                  ><strong>{{ formatMonthYear(debtPayoff.accelerated.payoffDate) }}</strong></span
                >
                <span
                  ><small>{{ t('whatIf.strategy.finishEarlier') }}</small
                  ><strong>{{ formatDuration(debtPayoff.accelerated.monthsEarlier) }}</strong></span
                >
                <span
                  ><small>{{ t('whatIf.strategy.interestSaved') }}</small
                  ><strong class="positive">{{
                    formatCurrency(debtPayoff.accelerated.interestSaved)
                  }}</strong></span
                >
              </div>
            </template>
          </section>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="debtInfoDialogOpen" :position="$q.screen.lt.sm ? 'bottom' : undefined">
      <q-card class="app-info-dialog responsive-info-card">
        <span class="info-sheet-handle" aria-hidden="true" />
        <q-card-section class="app-info-heading">
          <h2>{{ t('whatIf.strategy.debtInfoTitle') }}</h2>
          <q-btn v-close-popup flat round dense icon="close" :aria-label="t('common.close')" />
        </q-card-section>
        <q-card-section class="app-info-copy">
          <p>{{ debtInfoText }}</p>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="freedomInfoDialogOpen" :position="$q.screen.lt.sm ? 'bottom' : undefined">
      <q-card class="freedom-info-dialog responsive-info-card">
        <span class="info-sheet-handle" aria-hidden="true" />
        <q-card-section class="freedom-info-heading">
          <span class="mini-icon freedom"><q-icon name="flight_takeoff" /></span>
          <h2>{{ t('whatIf.strategy.freedomInfoTitle') }}</h2>
          <q-btn v-close-popup flat round dense icon="close" :aria-label="t('common.close')" />
        </q-card-section>
        <q-card-section class="freedom-info-copy">
          <p>{{ t('whatIf.strategy.freedomInfoDescription') }}</p>
          <div>
            <strong>{{ t('whatIf.strategy.freedomInfoIncludedTitle') }}</strong>
            <p>{{ t('whatIf.strategy.freedomInfoIncluded') }}</p>
          </div>
          <div>
            <strong>{{ t('whatIf.strategy.freedomInfoExcludedTitle') }}</strong>
            <p>{{ t('whatIf.strategy.freedomInfoExcluded') }}</p>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="investmentTypeDialogOpen">
      <q-card class="investment-type-dialog">
        <q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          v-close-popup
        />
        <q-card-section class="investment-dialog-heading">
          <h2>{{ t('whatIf.strategy.addInvestmentTypeTitle') }}</h2>
          <p>{{ t('whatIf.strategy.addInvestmentTypeDescription') }}</p>
        </q-card-section>
        <q-card-section class="investment-dialog-options">
          <button
            v-for="option in availableMixOptions"
            :key="option.value"
            type="button"
            :class="{ selected: pendingInvestmentType === option.value }"
            @click="pendingInvestmentType = option.value"
          >
            <span class="mini-icon invest"><q-icon :name="option.icon" /></span>
            <span>
              <strong>{{ option.label }}</strong>
              <small>{{
                t('whatIf.strategy.expectedReturn', { return: option.returnPercent })
              }}</small>
            </span>
            <q-icon
              :name="
                pendingInvestmentType === option.value ? 'check_circle' : 'radio_button_unchecked'
              "
            />
          </button>
        </q-card-section>
        <q-card-actions class="investment-dialog-actions">
          <q-btn outline no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.add')"
            :disable="!pendingInvestmentType"
            @click="confirmInvestmentType"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="initialScenarioDialogOpen" persistent>
      <q-card class="scenario-name-dialog">
        <q-card-section>
          <h2>{{ t('whatIf.strategy.nameFirstScenario') }}</h2>
          <p>{{ t('whatIf.strategy.nameFirstScenarioDescription') }}</p>
          <q-input
            v-model="initialScenarioName"
            outlined
            autofocus
            maxlength="80"
            :label="t('whatIf.strategy.scenarioName')"
            @keyup.enter="confirmInitialScenario"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.continue')"
            :disable="!initialScenarioName.trim() || whatIfStore.saving"
            :loading="whatIfStore.saving"
            @click="confirmInitialScenario"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import MortgageComparisonChart from '@/components/liabilities/MortgageComparisonChart.vue'
import StrategyAllocationRow from '@/components/what-if/StrategyAllocationRow.vue'
import StrategyProjectionChart from '@/components/what-if/StrategyProjectionChart.vue'
import { getLiabilityCategory } from '@/config/liability-categories'
import { calculateDebtPayoffImpact } from '@/domain/financial/debt-payoff'
import {
  currentFinancialYear,
  financialYearAvailableIncomeValue,
  financialYearExpenseNecessityValue,
  financialYearMonthValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import {
  latestPositionMonth,
  simulateStrategy,
  strategyNetWorthPoints,
  strategyStartingPosition,
} from '@/domain/financial/strategy-simulation'
import {
  calculateWhatIf,
  defaultStrategyScenario,
  investmentTypeDefinitions,
  normalizeStrategyForOptions,
  normalizeStrategyScenario,
} from '@/domain/financial/what-if'
import { calculateMilestoneProgress } from '@/domain/milestones/calculations'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useWhatIfStore } from '@/stores/what-if-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const financialYearsStore = useFinancialYearsStore()
const liabilitiesStore = useLiabilitiesStore()
const scopeStore = useFinancialScopeStore()
const whatIfStore = useWhatIfStore()
const workspaceStore = useWorkspaceStore()
const pageError = ref(null)
const freedomInfoDialogOpen = ref(false)
const debtInfoDialogOpen = ref(false)
const investmentTypeDialogOpen = ref(false)
const pendingInvestmentType = ref(null)
const initialScenarioDialogOpen = ref(false)
const initialScenarioName = ref('')
const projectionChartMode = ref('total')
const allocationSheetOpen = ref(false)
const detailSheetOpen = ref(false)
const detailSheetKind = ref('projection')
const selectedDesktopOutcomeKind = ref('investment')
const year = currentFinancialYear()
const workspaceId = computed(() => String(route.params.workspaceId))
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map(({ id }) => id))
const selectedMemberId = computed(() =>
  scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
)
const config = computed(() => whatIfStore.config)
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, year))
const loading = computed(
  () =>
    financialYearsStore.loading ||
    whatIfStore.loading ||
    liabilitiesStore.loading ||
    liabilitiesStore.categoryLoading,
)
const error = computed(
  () =>
    pageError.value || whatIfStore.error || financialYearsStore.errorFor(workspaceId.value, year),
)
const activeScenario = computed(
  () =>
    config.value.scenarios.find(({ id }) => id === config.value.activeScenarioId) ||
    config.value.scenarios[0],
)
const positionMonth = computed(() => latestPositionMonth(financialYear.value))
const startingPosition = computed(() =>
  strategyStartingPosition(financialYear.value, positionMonth.value, selectedMemberId.value),
)
const simulation = computed(() =>
  calculateWhatIf({
    availableIncome: financialYearAvailableIncomeValue(financialYear.value, selectedMemberId.value),
    costOfLife: financialYearValue(financialYear.value, 'expenses', selectedMemberId.value),
    discretionary: financialYearExpenseNecessityValue(
      financialYear.value,
      'lifestyle',
      selectedMemberId.value,
    ),
    reductionPercent: config.value.discretionaryReductionPercent,
  }),
)
const monthlySavings = computed(() => Math.max(0, simulation.value.currentSavingsCapacity))
const liabilities = computed(() =>
  extractLiabilities(financialYear.value, positionMonth.value, selectedMemberId.value),
)
const selectedDebt = computed(
  () =>
    liabilities.value.find(({ id }) => id === activeScenario.value.selectedLiabilityId) ||
    liabilities.value.find(({ categoryId }) => categoryId === 'mortgage') ||
    liabilities.value[0] ||
    null,
)
const selectedDebtModel = computed(() => {
  if (!selectedDebt.value) return null
  const model = liabilitiesStore
    .itemsForCategory('mortgage')
    .find(({ id }) => id === selectedDebt.value.id)
  return model ? { ...model, name: selectedDebt.value.name } : selectedDebt.value
})
const allocation = computed(() =>
  normalizeStrategyForOptions(activeScenario.value.allocation, {
    cash: true,
    debt: Boolean(selectedDebt.value),
  }),
)
const projection = computed(() =>
  simulateStrategy({
    startingPosition: startingPosition.value,
    scenario: { ...activeScenario.value, allocation: allocation.value },
    simulatedMonthlySavings: monthlySavings.value,
    simulatedMonthlyCost: simulation.value.monthlyCostOfLife,
    debtAvailable: Boolean(selectedDebt.value),
  }),
)
const baselineProjection = computed(() =>
  simulateStrategy({
    startingPosition: startingPosition.value,
    scenario: { ...activeScenario.value, allocation: allocation.value },
    simulatedMonthlySavings: 0,
    simulatedMonthlyCost: simulation.value.monthlyCostOfLife,
    debtAvailable: Boolean(selectedDebt.value),
  }),
)
const debtPayoff = computed(() =>
  calculateDebtPayoffImpact({
    liability: selectedDebtModel.value,
    extraMonthlyPayment: monthlyFor(allocation.value.debt),
    asOfDate: localToday(),
  }),
)
const debtInfoText = computed(() =>
  debtPayoff.value
    ? t('whatIf.strategy.modeledDebtDisclaimer')
    : t('whatIf.strategy.debtDisclaimer'),
)
const investmentProjectionPoints = computed(() =>
  projection.value.strategy.points.map(({ month, investmentBalances, investmentValue }) => ({
    month,
    value: investmentValue,
    breakdown: investmentBalances,
  })),
)
const baselineInvestmentProjectionPoints = computed(() =>
  baselineProjection.value.strategy.points.map(({ month, investmentValue }) => ({
    month,
    value: investmentValue,
  })),
)
const cashProjectionPoints = computed(() =>
  projection.value.strategy.points.map(({ month, cash }) => ({ month, value: cash })),
)
const baselineCashProjectionPoints = computed(() =>
  baselineProjection.value.strategy.points.map(({ month, cash }) => ({ month, value: cash })),
)

const scenarioOptions = computed(() =>
  config.value.scenarios.map(({ id, name }) => ({ value: id, label: name })),
)
const liabilityOptions = computed(() =>
  liabilities.value.map(({ id, name }) => ({ value: id, label: name })),
)
const cashTargetOptions = computed(() =>
  [3, 6, 12].map((months) => ({ value: months, label: `${months} months` })),
)
const mixMeta = {
  stockMarket: { label: 'Stock market', icon: 'trending_up', tone: 'stock-market' },
  realEstate: { label: 'Real estate', icon: 'apartment', tone: 'real-estate' },
  fixedIncome: { label: 'Fixed income', icon: 'account_balance', tone: 'fixed-income' },
  crypto: { label: 'Crypto', icon: 'currency_bitcoin', tone: 'crypto' },
  businessEquity: { label: 'Business equity', icon: 'business_center', tone: 'business' },
  other: { label: 'Other', icon: 'category', tone: 'other' },
}
const activeMix = computed(() =>
  Object.entries(activeScenario.value.investmentMix).map(([id, value]) => ({
    id,
    ...mixMeta[id],
    description: t(`whatIf.strategy.investmentTypes.${id}`),
    ...value,
  })),
)
const availableMixOptions = computed(() =>
  investmentTypeDefinitions
    .filter(({ id }) => !activeScenario.value.investmentMix[id])
    .map(({ id, returnPercent }) => ({
      value: id,
      label: mixMeta[id].label,
      icon: mixMeta[id].icon,
      returnPercent,
    })),
)
const currentMilestones = computed(() =>
  calculateMilestoneProgress({
    financialYear: financialYear.value,
    month: positionMonth.value,
    memberId: selectedMemberId.value,
  }),
)
const netWorthPoints = computed(() =>
  strategyNetWorthPoints({
    currentNetWorth: financialYearMonthValue(
      financialYear.value,
      positionMonth.value,
      'netWorth',
      selectedMemberId.value,
    ),
    strategy: projection.value.strategy,
    monthlyDebtContribution: monthlyFor(allocation.value.debt),
    debtBalance: selectedDebt.value?.balance || 0,
  }),
)
const currentNetWorth = computed(() =>
  financialYearMonthValue(
    financialYear.value,
    positionMonth.value,
    'netWorth',
    selectedMemberId.value,
  ),
)
const baselineNetWorthPoints = computed(() =>
  strategyNetWorthPoints({
    currentNetWorth: currentNetWorth.value,
    strategy: baselineProjection.value.strategy,
    monthlyDebtContribution: 0,
    debtBalance: selectedDebt.value?.balance || 0,
  }),
)
const projectedNetWorth = computed(() => netWorthPoints.value.at(-1)?.value || 0)
const detailSheetTitle = computed(() => {
  const titleKeys = {
    cash: 'cashDetails',
    investment: 'investmentDetails',
    debt: 'debtDetails',
    netWorth: 'netWorthDetails',
    projection: 'projectionDetails',
  }
  return t(`whatIf.strategy.${titleKeys[detailSheetKind.value] || 'projectionDetails'}`)
})
const strategyOutcomes = computed(() => {
  const outcomes = []
  const horizonMonths = activeScenario.value.horizonYears * 12

  const safetyId = `safety_${activeScenario.value.cashTargetMonths}_months`
  const cashTargetMonth = projection.value.strategy.cashTargetMonth
  outcomes.push({
    id: safetyId,
    icon: 'health_and_safety',
    tone: 'cash',
    title: t('milestones.families.safety.title'),
    description: t('whatIf.strategy.projectedCashAgainstTarget', {
      value: formatCurrency(projection.value.strategy.cash),
      target: formatCurrency(projection.value.strategy.cashTarget),
    }),
    result:
      cashTargetMonth === 0
        ? t('whatIf.cash.milestoneAchieved')
        : cashTargetMonth != null
          ? reachEstimate(cashTargetMonth)
          : allocation.value.cash <= 0
            ? t('whatIf.strategy.noExtraSavingsAllocated')
            : t('whatIf.strategy.notReachedInHorizon', {
                years: activeScenario.value.horizonYears,
              }),
    status:
      cashTargetMonth != null ? 'positive' : allocation.value.cash > 0 ? 'progress' : 'negative',
  })

  const freedom =
    currentMilestones.value.find(({ family, reached }) => family === 'freedom' && !reached) ||
    currentMilestones.value.findLast(({ family }) => family === 'freedom')
  if (freedom) {
    const annualCost = simulation.value.monthlyCostOfLife * 12
    const targetValue = freedom.target * annualCost
    const reachedAt = projection.value.strategy.points.find(
      ({ investableValue }) => investableValue >= targetValue,
    )
    const finalPoint = projection.value.strategy.points.at(-1)
    const fundedYears = annualCost > 0 ? finalPoint.investableValue / annualCost : 0
    outcomes.push({
      id: freedom.id,
      icon: 'flight_takeoff',
      tone: 'freedom',
      showInfo: true,
      title: t('milestones.families.freedom.title'),
      description: t('whatIf.strategy.freedomProjected', { years: formatNumber(fundedYears) }),
      result: reachedAt
        ? reachedAt.month === 0
          ? t('whatIf.cash.milestoneAchieved')
          : reachEstimate(reachedAt.month)
        : t('whatIf.strategy.notReachedInHorizon', {
            years: activeScenario.value.horizonYears,
          }),
      status: reachedAt ? 'positive' : allocation.value.invest > 0 ? 'progress' : 'negative',
    })
  }

  const netWorth =
    currentMilestones.value.find(({ family, reached }) => family === 'netWorth' && !reached) ||
    currentMilestones.value.findLast(({ family }) => family === 'netWorth')
  if (netWorth) {
    const reachedAt = netWorthPoints.value.find(({ value }) =>
      netWorth.id === 'net_worth_positive' ? value > 0 : value >= netWorth.target,
    )
    const finalNetWorth = netWorthPoints.value.at(-1)?.value || 0
    outcomes.push({
      id: netWorth.id,
      icon: 'trending_up',
      tone: 'net-worth',
      title: t('milestones.families.netWorth.title'),
      description: t('whatIf.strategy.projectedNetWorth', {
        value: formatCurrency(finalNetWorth),
      }),
      result: reachedAt
        ? reachedAt.month === 0
          ? t('whatIf.cash.milestoneAchieved')
          : reachEstimate(reachedAt.month)
        : t('whatIf.strategy.notReachedInHorizon', {
            years: activeScenario.value.horizonYears,
          }),
      status:
        reachedAt || finalNetWorth > netWorth.currentValue
          ? reachedAt
            ? 'positive'
            : 'progress'
          : 'negative',
    })
  }

  if (selectedDebt.value && allocation.value.debt > 0) {
    const id = debtMilestoneId(selectedDebt.value.categoryId)
    const monthlyDebtContribution = monthlyFor(allocation.value.debt)
    const payoffMonth = debtPayoff.value
      ? debtPayoff.value.accelerated.remainingPayments
      : monthlyDebtContribution > 0
        ? Math.ceil(selectedDebt.value.balance / monthlyDebtContribution)
        : null
    const modeledHorizonPayment = debtPayoff.value?.accelerated.schedule[horizonMonths - 1]
    const projectedReduction = debtPayoff.value
      ? Math.max(
          0,
          selectedDebtModel.value.balance -
            (modeledHorizonPayment?.remainingBalance ??
              (payoffMonth <= horizonMonths ? 0 : selectedDebtModel.value.balance)),
        )
      : Math.min(selectedDebt.value.balance, monthlyDebtContribution * horizonMonths)
    const projectedBalance = debtPayoff.value
      ? (modeledHorizonPayment?.remainingBalance ??
        (payoffMonth <= horizonMonths ? 0 : selectedDebtModel.value.balance))
      : Math.max(0, selectedDebt.value.balance - projectedReduction)
    outcomes.push({
      id,
      icon: 'credit_score',
      tone: 'debt',
      title: t('milestones.families.debt.title'),
      description: t('whatIf.strategy.projectedDebtBalance', {
        name: selectedDebt.value.name,
        value: formatCurrency(projectedBalance),
      }),
      result:
        monthlyDebtContribution <= 0
          ? t('whatIf.strategy.noExtraDebtReduction')
          : debtPayoff.value
            ? t('whatIf.strategy.modeledDebtResult', {
                date: formatMonthYear(debtPayoff.value.accelerated.payoffDate),
                amount: formatCurrency(debtPayoff.value.accelerated.interestSaved),
              })
            : payoffMonth <= horizonMonths
              ? reachEstimate(payoffMonth)
              : t('whatIf.strategy.extraDebtReduction', {
                  value: formatCurrency(projectedReduction),
                  years: activeScenario.value.horizonYears,
                }),
      status:
        monthlyDebtContribution <= 0
          ? 'negative'
          : payoffMonth <= horizonMonths
            ? 'positive'
            : 'progress',
    })
  }

  return outcomes
})

const selectedDesktopOutcome = computed(() =>
  strategyOutcomes.value.find(
    (outcome) => outcomeKind(outcome) === selectedDesktopOutcomeKind.value,
  ),
)

watch(
  strategyOutcomes,
  (outcomes) => {
    if (outcomes.some((outcome) => outcomeKind(outcome) === selectedDesktopOutcomeKind.value))
      return
    const fallback =
      outcomes.find((outcome) => outcomeKind(outcome) === 'investment') || outcomes[0]
    if (fallback) selectedDesktopOutcomeKind.value = outcomeKind(fallback)
  },
  { immediate: true },
)

function openOutcomeDetail(outcome) {
  const kind = outcomeKind(outcome)
  if ($q.screen.gt.sm) {
    selectedDesktopOutcomeKind.value = kind
    return
  }

  detailSheetKind.value = kind
  detailSheetOpen.value = true
}

function outcomeKind(outcome) {
  const detailByTone = {
    cash: 'cash',
    debt: 'debt',
    freedom: 'investment',
    'net-worth': 'netWorth',
  }
  return detailByTone[outcome?.tone] || 'investment'
}

watch(workspaceId, () => prepare(), { immediate: true })

async function prepare(force = false) {
  pageError.value = null
  try {
    await Promise.all([
      financialYearsStore.load(workspaceId.value, year, force),
      whatIfStore.load(workspaceId.value, force),
      liabilitiesStore.loadCategory(workspaceId.value, 'mortgage', force),
    ])
    if (activeScenario.value.id === defaultStrategyScenario.id) {
      initialScenarioName.value = ''
      initialScenarioDialogOpen.value = true
    }
  } catch (loadError) {
    pageError.value = loadError
  }
}

async function persist(nextConfig) {
  try {
    await whatIfStore.save(workspaceId.value, nextConfig)
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('whatIf.errors.save'), position: 'top' })
    return false
  }
}

async function confirmInitialScenario() {
  const name = initialScenarioName.value.trim()
  if (!name || whatIfStore.saving) return
  const id = `scenario-${Date.now()}`
  const scenario = normalizeStrategyScenario({ ...activeScenario.value, id, name })
  const saved = await persist({ scenarios: [scenario], activeScenarioId: id })
  if (saved) initialScenarioDialogOpen.value = false
}

function updateScenario(changes) {
  const next = normalizeStrategyScenario({ ...activeScenario.value, ...changes })
  return persist({
    scenarios: config.value.scenarios.map((scenario) =>
      scenario.id === next.id ? next : scenario,
    ),
  })
}

function selectScenario(id) {
  persist({ activeScenarioId: id })
}

function addScenario() {
  if (config.value.scenarios.length >= 10) return
  $q.dialog({
    title: t('whatIf.strategy.newScenario'),
    prompt: { model: '', type: 'text', label: t('whatIf.strategy.scenarioName'), outlined: true },
    cancel: true,
  }).onOk((name) => {
    const id = `scenario-${Date.now()}`
    const scenario = normalizeStrategyScenario({ ...activeScenario.value, id, name })
    persist({ scenarios: [...config.value.scenarios, scenario], activeScenarioId: id })
  })
}

function setCustomHorizon() {
  $q.dialog({
    title: t('whatIf.strategy.customHorizon'),
    prompt: {
      model: activeScenario.value.horizonYears,
      type: 'number',
      min: 1,
      max: 50,
      suffix: t('whatIf.years'),
      outlined: true,
    },
    cancel: true,
  }).onOk((value) => updateScenario({ horizonYears: Number(value) }))
}

function deleteScenario() {
  if (config.value.scenarios.length === 1) return
  const scenarios = config.value.scenarios.filter(({ id }) => id !== activeScenario.value.id)
  persist({ scenarios, activeScenarioId: scenarios[0].id })
}

function resetScenario() {
  updateScenario({
    ...defaultStrategyScenario,
    id: activeScenario.value.id,
    name: activeScenario.value.name,
    selectedLiabilityId: selectedDebt.value?.id || null,
  })
}

function setAllocation(key, value) {
  const target = Math.min(100, Math.max(0, Number(value) || 0))
  adjustAllocation(key, target - allocation.value[key])
}

function adjustAllocation(key, delta) {
  const next = { ...allocation.value }
  if (key === 'invest') {
    if (delta > 0) {
      let remaining = Math.min(delta, next.cash + next.debt)
      const cashChange = Math.min(next.cash, remaining)
      next.cash -= cashChange
      remaining -= cashChange
      next.debt -= Math.min(next.debt, remaining)
      next.invest = 100 - next.cash - next.debt
    } else {
      const change = Math.min(-delta, next.invest)
      next.invest -= change
      next.cash += change
    }
  } else {
    const change = delta > 0 ? Math.min(delta, next.invest) : -Math.min(-delta, next[key])
    next[key] += change
    next.invest -= change
  }
  updateScenario({ allocation: next })
}

function setMixAllocation(id, value) {
  const current = activeScenario.value.investmentMix[id]?.allocation
  if (current == null) return
  const target = Math.min(100, Math.max(0, Number(value) || 0))
  adjustMix(id, target - current)
}

function adjustMix(id, delta) {
  const mix = cloneMix()
  if (!mix[id]) return
  const otherIds = Object.keys(mix).filter((key) => key !== id)
  if (!otherIds.length) return

  if (delta > 0) {
    const donor = otherIds.sort((left, right) => mix[right].allocation - mix[left].allocation)[0]
    const change = Math.min(delta, mix[donor].allocation)
    mix[donor].allocation -= change
    mix[id].allocation += change
  } else {
    const receiver =
      id !== 'stockMarket' && mix.stockMarket
        ? 'stockMarket'
        : otherIds.sort((left, right) => mix[right].allocation - mix[left].allocation)[0]
    const change = Math.min(-delta, mix[id].allocation)
    mix[id].allocation -= change
    mix[receiver].allocation += change
  }
  updateScenario({ investmentMix: mix })
}

function openInvestmentTypeDialog() {
  pendingInvestmentType.value = availableMixOptions.value[0]?.value || null
  investmentTypeDialogOpen.value = true
}

function confirmInvestmentType() {
  const type = pendingInvestmentType.value
  if (!type) return
  const definition = investmentTypeDefinitions.find(({ id }) => id === type)
  const mix = cloneMix()
  const donor = Object.keys(mix).sort(
    (left, right) => mix[right].allocation - mix[left].allocation,
  )[0]
  const allocationToAdd = Math.min(10, mix[donor]?.allocation || 0)
  if (!allocationToAdd) return
  mix[donor].allocation -= allocationToAdd
  mix[type] = { allocation: allocationToAdd, annualReturnPercent: definition.returnPercent }
  updateScenario({ investmentMix: mix })
  investmentTypeDialogOpen.value = false
}

function removeMix(id) {
  const mix = cloneMix()
  const recipient = Object.keys(mix)
    .filter((key) => key !== id)
    .sort((left, right) => mix[right].allocation - mix[left].allocation)[0]
  if (!mix[id] || !recipient) return
  mix[recipient].allocation += mix[id].allocation || 0
  delete mix[id]
  updateScenario({ investmentMix: mix })
}

function setReturn(id, value) {
  const numeric = Math.min(100, Math.max(0, Number(value) || 0))
  const mix = cloneMix()
  mix[id] = { ...mix[id], annualReturnPercent: numeric }
  updateScenario({ investmentMix: mix })
}

function setCashReturn(value) {
  const numeric = Math.min(100, Math.max(0, Number(value) || 0))
  updateScenario({ cashAnnualReturnPercent: numeric })
}

function cloneMix() {
  return Object.fromEntries(
    Object.entries(activeScenario.value.investmentMix).map(([id, value]) => [id, { ...value }]),
  )
}

function monthlyFor(percent) {
  return (monthlySavings.value * percent) / 100
}

function reachEstimate(months) {
  if (months < 12)
    return t('whatIf.strategy.estimatedReachMonths', { months: Math.max(1, Math.ceil(months)) })
  return t('whatIf.strategy.estimatedReachYears', {
    years: Math.max(1, Math.ceil(months / 12)),
  })
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

function formatDuration(months) {
  const total = Math.max(0, Number(months) || 0)
  const years = Math.floor(total / 12)
  const remainingMonths = total % 12
  if (!years) return t('liabilities.mortgage.durationMonths', { months: remainingMonths })
  if (!remainingMonths) return t('liabilities.mortgage.durationYears', { years })
  return t('liabilities.mortgage.duration', { years, months: remainingMonths })
}

function formatMonthYear(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function debtMilestoneId(categoryId) {
  if (categoryId === 'mortgage') return 'debt_mortgage_free'
  if (categoryId === 'car_loan') return 'debt_car_free'
  if (categoryId === 'student_loan') return 'debt_student_free'
  if (['personal_loan', 'credit_card_debt', 'other_debt'].includes(categoryId))
    return 'debt_consumer_free'
  return 'debt_free'
}

function formatNumber(value) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)
}

function extractLiabilities(document, month, memberId) {
  const categories = document?.months?.[month]?.liabilities?.categories || {}
  return Object.entries(categories)
    .flatMap(([categoryId, category]) =>
      Object.entries(category.subcategories || {}).flatMap(([subcategoryId, subcategory]) => {
        const items = Object.entries(subcategory.items || {})
        if (!items.length)
          return [
            {
              id: subcategoryId,
              categoryId,
              name: t(getLiabilityCategory(categoryId)?.nameKey || 'whatIf.debt.title'),
              balance: scopedValue(subcategory, memberId),
            },
          ]
        return items.map(([id, item]) => ({
          id,
          categoryId,
          name:
            item.itemName || t(getLiabilityCategory(categoryId)?.nameKey || 'whatIf.debt.title'),
          balance: scopedValue(item, memberId),
        }))
      }),
    )
    .filter(({ balance }) => balance > 0)
    .sort((left, right) => right.balance - left.balance)
}

function scopedValue(item, memberId) {
  if (memberId !== 'all') return Number(item?.memberValues?.[memberId] || 0)
  return Number(item?.total || 0)
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.strategy-page {
  @include financial-page;
}
.strategy-shell {
  @include financial-shell;
  max-width: 80rem;
}
.page-state {
  display: grid;
  place-items: center;
  gap: 0.75rem;
  min-height: 28rem;
  color: var(--color-copy);
}
.strategy-header {
  @include financial-header;
}
.back-button {
  @include financial-back-button;
}
h1 {
  @include financial-title;
}
.strategy-header p,
.panel-heading p,
.projection-heading p,
.detail-title p {
  margin: 0.35rem 0 0;
  color: var(--color-copy);
}
.scenario-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.scenario-select {
  width: 13rem;
}
.strategy-overview {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  grid-template-areas:
    'available available'
    'allocation outcomes';
  gap: 1rem;
  margin-top: 0.75rem;
}
.overview-available-panel {
  grid-area: available;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 6rem;
  background: linear-gradient(110deg, #fff, #edfbf6);
}
.overview-available-panel > div {
  display: grid;
  gap: 0.15rem;
}
.overview-available-panel span,
.overview-available-panel > div > small {
  color: var(--color-copy);
  font-size: 0.78rem;
}
.overview-available-panel strong {
  color: var(--color-success-dark);
  font-size: 1.9rem;
  line-height: 1.05;
}
.overview-available-panel strong small {
  margin-left: 0.25rem;
  color: inherit;
  font-size: 0.52em;
}
.overview-available-panel > .q-icon {
  color: var(--color-success-dark);
  font-size: 2.25rem;
}
.overview-allocation-panel {
  grid-area: allocation;
}
.overview-outcomes-panel {
  grid-area: outcomes;
}
.overview-allocation-panel,
.overview-outcomes-panel {
  min-width: 0;
  padding: 1rem;
  border-radius: var(--radius-lg);
}
.overview-section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}
.overview-section-heading h2,
.overview-section-heading p {
  margin: 0;
}
.overview-section-heading h2 {
  font-size: 1.1rem;
}
.overview-section-heading p {
  margin-top: 0.25rem;
  color: var(--color-copy);
  font-size: 0.74rem;
}
.text-link {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 0.3rem;
  padding: 0.25rem 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
.overview-heading-link {
  min-height: 1.4rem;
  padding: 0;
  line-height: 1.3;
}
.allocation-bar {
  display: flex;
  height: 1.25rem;
  margin: 1rem 0 0.9rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-soft);
}
.allocation-bar i {
  display: block;
  min-width: 0;
}
.allocation-bar .cash {
  background: #15a875;
}
.allocation-bar .invest {
  background: var(--color-primary);
}
.allocation-bar .debt {
  background: var(--color-warning);
}
.allocation-overview-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.allocation-overview-metrics article {
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  padding: 0 0.75rem;
  border-right: 1px solid var(--color-line);
  text-align: center;
}
.allocation-overview-metrics article:last-child {
  border: 0;
}
.allocation-overview-metrics small,
.allocation-overview-metrics span:last-child {
  color: var(--color-copy);
  font-size: 0.69rem;
}
.allocation-overview-metrics strong {
  font-size: 1.12rem;
}
.overview-outcome-list {
  display: grid;
  margin-top: 0.6rem;
}
.overview-outcome {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(7rem, auto) auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0;
  border: 0;
  border-bottom: 1px solid var(--color-line);
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.overview-outcome:last-child {
  border-bottom: 0;
}
.overview-outcome .outcome-copy,
.sheet-outcome-card .outcome-copy {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}
.overview-outcome .outcome-copy strong,
.sheet-outcome-card .outcome-copy strong {
  font-size: 0.83rem;
}
.overview-outcome .outcome-copy small,
.sheet-outcome-card .outcome-copy small {
  color: var(--color-copy);
  font-size: 0.68rem;
  line-height: 1.35;
}
.overview-outcome b {
  max-width: 13rem;
  text-align: right;
  font-size: 0.72rem;
}
.outcome-arrow {
  color: var(--color-copy);
}
.legacy-strategy-layout {
  display: none !important;
}
.desktop-projections {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}
.desktop-projection-panel {
  min-width: 0;
  padding: 1.15rem 1.25rem;
  border-radius: var(--radius-lg);
}
.desktop-projection-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
}
.desktop-projection-heading h2,
.desktop-projection-heading p {
  margin: 0;
}
.desktop-projection-heading h2 {
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}
.desktop-projection-heading p {
  margin-top: 0.2rem;
  color: var(--color-copy);
  font-size: 0.76rem;
}
.desktop-projection-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.desktop-projection-controls .horizon-options button {
  min-width: 4.5rem;
}
.desktop-projection-value {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin-top: 0.85rem;
}
.desktop-projection-value span,
.desktop-projection-value small {
  color: var(--color-copy);
  font-size: 0.72rem;
}
.desktop-projection-value strong {
  color: var(--color-primary);
  font-size: 1.35rem;
}
.desktop-strategy-chart,
.desktop-mortgage-chart {
  margin-top: 0.25rem;
}
.desktop-result-breakdown {
  margin-top: 0.35rem;
}
.desktop-debt-select {
  width: min(17rem, 32vw);
}
.desktop-mortgage-panel {
  margin-bottom: 1rem;
}
.strategy-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-areas:
    'available available'
    'allocation mix'
    'results-title results-title'
    'projection projection'
    'debt-projection debt-projection'
    'details details'
    'impact-title impact-title'
    'milestones milestones';
  column-gap: 1rem;
  row-gap: 0.85rem;
  margin-top: 0.75rem;
}
.strategy-sheet {
  display: flex;
  flex-direction: column;
  width: min(48rem, calc(100vw - 2rem));
  max-width: none;
  max-height: min(88dvh, 54rem);
  overflow: hidden;
  border-radius: 1.25rem;
  color: var(--color-ink);
}
.projection-detail-sheet {
  width: min(56rem, calc(100vw - 2rem));
}
.strategy-sheet-handle {
  display: none;
  align-self: center;
  width: 2.8rem;
  height: 0.28rem;
  margin-top: 0.55rem;
  border-radius: 999px;
  background: #aab8ca;
}
.strategy-sheet-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.35rem 0.85rem;
}
.strategy-sheet-heading h2,
.strategy-sheet-heading p,
.sheet-subheading h3,
.sheet-subheading p,
.detail-section-heading h3 {
  margin: 0;
}
.strategy-sheet-heading h2 {
  font-size: 1.35rem;
}
.strategy-sheet-heading p,
.sheet-subheading p {
  margin-top: 0.3rem;
  color: var(--color-copy);
  font-size: 0.82rem;
}
.strategy-sheet-scroll {
  min-height: 0;
  padding: 0.6rem 1.35rem 1.25rem;
  overflow-y: auto;
}
.sheet-allocation-list {
  display: grid;
  gap: 0.7rem;
}
.sheet-allocation-total {
  margin-top: 0.8rem;
}
.sheet-subheading {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-line);
}
.sheet-subheading h3 {
  font-size: 1rem;
}
.strategy-sheet-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  padding: 0.9rem 1.35rem 1.25rem;
  border-top: 1px solid var(--color-line);
}
.strategy-sheet-actions.single-action {
  grid-template-columns: 1fr;
}
.outcome-sheet-list {
  display: grid;
  gap: 0.7rem;
}
.sheet-outcome-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(8rem, auto) auto;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 0.85rem;
  border: 1px solid var(--color-line);
  border-radius: 0.85rem;
  background: white;
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.sheet-outcome-card b {
  max-width: 15rem;
  text-align: right;
  font-size: 0.76rem;
}
.detail-sheet-content {
  display: grid;
  gap: 1rem;
}
.detail-sheet-section {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
}
.detail-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.detail-section-heading h3 {
  font-size: 1rem;
}
.detail-view-switch {
  align-self: start;
  justify-self: start;
}
.detail-view-switch button {
  min-width: 4.6rem;
  padding: 0.4rem 0.6rem;
  font-size: 0.7rem;
}
.detail-horizon-options {
  width: 100%;
}
.detail-horizon-options button {
  flex: 1;
}
.detail-projected-total {
  margin-top: 0;
}
.large-detail-values strong {
  font-size: 1.05rem;
}
.large-detail-values.two-values {
  grid-template-columns: repeat(2, 1fr);
}
.net-worth-detail-hero {
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  padding: 1.5rem;
  border-radius: 0.85rem;
  background: var(--color-blue-soft);
  text-align: center;
}
.net-worth-detail-hero span,
.net-worth-detail-hero small {
  color: var(--color-copy);
}
.net-worth-detail-hero strong {
  color: var(--color-primary);
  font-size: 2rem;
}
.configuration-column,
.results-column {
  display: contents;
}
.strategy-section-heading {
  margin: 0.25rem 0 -0.55rem;
}
.strategy-section-heading h2 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.35rem;
  letter-spacing: -0.025em;
}
.results-heading {
  grid-area: results-title;
}
.impact-heading {
  grid-area: impact-title;
}
.panel {
  @include dashboard-card;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-md);
}
.available-panel {
  grid-area: available;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 6rem;
  background: linear-gradient(110deg, #fff, #f0fbf7);
}
.allocation-panel {
  grid-area: allocation;
}
.mix-panel {
  grid-area: mix;
}
.allocation-panel,
.mix-panel {
  min-width: 0;
  padding: 1rem;
  border-radius: var(--radius-lg);
}
.available-panel > div {
  display: grid;
}
.available-panel span,
.available-panel small {
  color: var(--color-copy);
  font-size: 0.78rem;
}
.available-panel strong {
  color: var(--color-success-dark);
  font-size: 1.75rem;
  line-height: 1.1;
}
.available-panel strong small {
  margin-left: 0.2rem;
  color: inherit;
  font-size: 0.55em;
}
.available-panel > .q-icon {
  color: var(--color-success-dark);
  font-size: 2rem;
}
.panel-heading h2,
.projection-heading h2,
.detail-title h2 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.25;
}
.panel-heading p,
.projection-heading p,
.detail-title p {
  margin-top: 0.25rem;
  font-size: 0.72rem;
  line-height: 1.35;
}
.allocation-list,
.mix-list {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
  margin-top: 0.75rem;
}
:deep(.mini-icon) {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  flex: 0 0 2.1rem;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  overflow: hidden;
}
:deep(.mini-icon > .q-icon) {
  position: static !important;
  margin: 0 !important;
  transform: none !important;
  line-height: 1;
}
:deep(.mini-icon.cash) {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
:deep(.mini-icon.invest) {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}
:deep(.mini-icon.debt) {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
:deep(.mini-icon.freedom) {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
:deep(.mini-icon.net-worth) {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}
.allocation-total {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 1rem;
  margin-top: 0.55rem;
  padding: 0.7rem 0.85rem;
  border-radius: 0.75rem;
  background: var(--color-surface-soft);
  font-size: 0.86rem;
}
.allocation-total strong:last-child {
  text-align: right;
}
.investment-mix-card {
  display: grid;
  grid-template-columns: 2.5rem minmax(5.5rem, 1fr) 4.4rem 5.1rem minmax(3.75rem, auto) auto;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  padding: 0.65rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 0.8rem;
  background: white;
}
.cash-return-card {
  grid-template-columns: 2.5rem minmax(5.5rem, 1fr) 5.1rem;
  margin-top: 0.7rem;
}
.mix-card-icon {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  font-size: 1.3rem;
}
.mix-card-icon.cash-return {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.mix-card-icon.stock-market {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}
.mix-card-icon.real-estate {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
.mix-card-icon.fixed-income {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.mix-card-icon.crypto {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
.mix-card-icon.business {
  background: #e6f7f6;
  color: #087f7a;
}
.mix-card-icon.other {
  background: var(--color-surface-soft);
  color: var(--color-copy);
}
.mix-card-identity,
.mix-card-metric {
  display: grid;
  min-width: 0;
}
.mix-card-identity strong {
  font-size: 0.88rem;
}
.mix-card-identity small,
.mix-card-metric small {
  overflow: hidden;
  color: var(--color-copy);
  font-size: 0.68rem;
  text-overflow: ellipsis;
}
.mix-card-metric {
  min-height: 2.4rem;
  align-content: center;
  padding: 0 0 0 0.55rem;
  border-left: 1px solid var(--color-line);
  border-top: 0;
  border-right: 0;
  border-bottom: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}
.mix-card-metric strong {
  font-size: 1rem;
}
.editable-metric {
  cursor: pointer;
}
.editable-metric:hover strong,
.editable-metric:focus-visible strong {
  color: var(--color-primary);
}
.editable-metric:focus-visible {
  outline: 0;
}
.mix-card-amount {
  display: grid;
  justify-items: end;
  min-width: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mix-card-amount strong {
  font-size: 0.75rem;
}
.mix-card-amount small {
  color: var(--color-copy);
  font-size: 0.65rem;
}
.mix-card-remove {
  width: 1.8rem;
  height: 1.8rem;
}
.add-investment-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: 100%;
  margin-top: 0.7rem;
  padding: 0.8rem;
  border: 1px dashed #9ac5ff;
  border-radius: 0.75rem;
  background: #f8fbff;
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.add-investment-card:focus-visible {
  @include focus-ring;
}
.investment-type-dialog {
  width: min(30rem, calc(100vw - 2rem));
  overflow: hidden;
  border-radius: var(--radius-md);
}
.investment-dialog-heading {
  padding: 1.35rem 1.35rem 0.7rem;
}
.investment-dialog-heading h2,
.investment-dialog-heading p {
  margin: 0;
}
.investment-dialog-heading p {
  margin-top: 0.35rem;
  color: var(--color-copy);
  font-size: 0.82rem;
}
.investment-dialog-options {
  display: grid;
  gap: 0.55rem;
  padding: 0.7rem 1.35rem 1.1rem;
}
.investment-dialog-options > button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem;
  border: 1px solid var(--color-line);
  background: white;
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}
.investment-dialog-options > button.selected {
  border-color: var(--color-primary);
  background: var(--color-blue-soft);
}
.investment-dialog-options > button > span:nth-child(2) {
  display: grid;
}
.investment-dialog-options small {
  color: var(--color-copy);
  font-size: 0.7rem;
}
.investment-dialog-options > button > .q-icon:last-child {
  color: var(--color-primary);
}
.investment-dialog-actions {
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.35rem 1.2rem;
  border-top: 1px solid var(--color-line);
}
.small-panels {
  grid-area: details;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.small-panels.single-detail {
  grid-template-columns: 1fr;
}
.strategy-detail {
  display: grid;
  align-content: start;
  gap: 0.75rem;
}
.detail-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.detail-values {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}
.detail-values span {
  display: grid;
}
.detail-values small,
.strategy-detail > small {
  color: var(--color-copy);
  font-size: 0.65rem;
}
.detail-values strong {
  font-size: 0.78rem;
}
.positive {
  color: var(--color-success-dark);
}
.negative {
  color: var(--color-danger);
}
.progress {
  color: var(--color-primary);
}
.redirect-note {
  padding-top: 0.6rem;
  border-top: 1px solid var(--color-line);
}
.projection-panel {
  grid-area: projection;
  position: relative;
}
.debt-projection-panel {
  grid-area: debt-projection;
}
.debt-projection-controls {
  display: grid;
  grid-template-columns: minmax(10rem, 15rem) auto;
  align-items: center;
  gap: 0.5rem;
}
.debt-projection-controls .q-btn {
  color: var(--color-copy);
}
.embedded-debt-chart {
  margin-top: 1rem;
}
.debt-projection-fallback {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--color-surface-soft);
}
.debt-projection-fallback > .q-icon {
  color: var(--color-primary);
  font-size: 1.4rem;
}
.debt-projection-fallback div {
  display: grid;
  gap: 0.2rem;
}
.debt-projection-fallback p {
  margin: 0;
  color: var(--color-copy);
  font-size: 0.72rem;
}
.projection-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.projection-controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.horizon-options,
.projection-view-switch {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid var(--color-line);
  background: var(--color-surface-soft);
}
.horizon-options {
  border-radius: 0.55rem;
}
.projection-view-switch {
  border-radius: 999px;
}
.horizon-options button,
.projection-view-switch button {
  border: 0;
  background: transparent;
  color: var(--color-copy);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.horizon-options button {
  min-width: 3rem;
  height: 1.75rem;
  padding: 0.2rem 0.45rem;
  font-size: 0.61rem;
}
.horizon-options button.selected {
  background: white;
  color: var(--color-primary);
  box-shadow: 0 1px 4px rgb(15 23 42 / 10%);
}
.projection-view-switch button {
  min-width: 5.5rem;
  padding: 0.42rem 0.72rem;
  border-radius: 999px !important;
  font-size: 0.76rem;
  font-weight: 700;
}
.projection-view-switch button.selected {
  background: var(--color-ink);
  color: white;
  box-shadow: 0 2px 8px rgb(24 43 68 / 12%);
}
.mobile-view-switch {
  display: none;
}
.projection-result-row {
  display: contents;
}
.horizon-options button:focus-visible,
.projection-view-switch button:focus-visible {
  @include focus-ring;
}
.projected-total {
  display: grid;
  grid-template-rows: auto auto;
  justify-content: start;
  gap: 0 1.25rem;
  margin: 0.65rem 0 0.1rem;
  text-align: left;
}
.projected-total strong {
  grid-column: 1;
  grid-row: 1;
  color: var(--color-primary);
  font-size: 1.15rem;
}
.projected-total span {
  grid-column: 1;
  grid-row: 2;
  color: var(--color-copy);
  font-size: 0.64rem;
}
.result-breakdown {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin-top: 0.75rem;
  padding: 1rem 1.1rem;
  border-radius: 0.75rem;
  background: var(--color-surface-soft);
}
.result-breakdown span {
  display: grid;
  align-content: center;
  gap: 0.2rem;
  min-height: 3rem;
  padding: 0.3rem 0.85rem;
  border-right: 1px solid var(--color-line);
}
.result-breakdown span:last-child {
  border: 0;
}
.result-breakdown small {
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 550;
  line-height: 1.25;
}
.result-breakdown strong {
  font-size: clamp(0.95rem, 1.6vw, 1.1rem);
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.result-breakdown.debt-result-breakdown {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.scenario-name-dialog {
  width: min(28rem, calc(100vw - 2rem));
  padding: 0.5rem;
  border-radius: 1rem;
}
.scenario-name-dialog h2 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.2rem;
}
.scenario-name-dialog p {
  margin: 0.4rem 0 1.25rem;
  color: var(--color-copy);
}
.milestones-panel {
  grid-area: milestones;
  display: grid;
}
.milestone-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--color-line);
}
.milestone-card div {
  display: grid;
}
.outcome-title {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}
.outcome-info-button {
  min-width: 1.5rem;
  min-height: 1.5rem;
  color: var(--color-copy);
}
.milestone-card small {
  color: var(--color-copy);
  font-size: 0.68rem;
}
.milestone-card b {
  text-align: right;
  font-size: 0.78rem;
  max-width: 15rem;
}
.milestone-card {
  margin-top: 0.7rem;
  padding: 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 0.75rem;
}
.freedom-info-dialog {
  width: min(31rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
  color: var(--color-ink);
}
.freedom-info-heading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
}
.freedom-info-heading h2 {
  flex: 1;
  margin: 0;
  font-size: 1.15rem;
}
.freedom-info-copy {
  display: grid;
  gap: 1rem;
  padding-top: 0;
}
.freedom-info-copy div {
  display: grid;
  gap: 0.2rem;
}
.freedom-info-copy p {
  margin: 0;
  color: var(--color-copy);
  font-size: 0.9rem;
  line-height: 1.55;
}

@media (max-width: 1180px) {
  .strategy-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      'available'
      'allocation'
      'mix'
      'results-title'
      'projection'
      'debt-projection'
      'details'
      'impact-title'
      'milestones';
  }
}

@media (max-width: 1023px) {
  .desktop-projections {
    display: none;
  }
  .strategy-sheet {
    width: 100vw;
    max-height: 90dvh;
    border-radius: 1.35rem 1.35rem 0 0;
  }
  .strategy-sheet-handle {
    display: block;
  }
  .projection-detail-sheet .result-breakdown,
  .projection-detail-sheet .detail-values,
  .projection-detail-sheet .large-detail-values.two-values {
    grid-template-columns: 1fr;
  }
  .projection-detail-sheet .result-breakdown {
    gap: 0;
    padding: 0.35rem 0.85rem;
  }
  .projection-detail-sheet .result-breakdown span,
  .projection-detail-sheet .detail-values span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 0;
    padding: 0.75rem 0;
    border-right: 0;
    border-bottom: 1px solid var(--color-line);
  }
  .projection-detail-sheet .result-breakdown span:last-child,
  .projection-detail-sheet .detail-values span:last-child {
    border-bottom: 0;
  }
  .projection-detail-sheet .result-breakdown small,
  .projection-detail-sheet .detail-values small {
    font-size: 0.72rem;
    line-height: 1.25;
  }
  .projection-detail-sheet .result-breakdown strong,
  .projection-detail-sheet .detail-values strong {
    max-width: 60%;
    font-size: 0.95rem;
    text-align: right;
  }
}

@media (max-width: 760px) {
  .strategy-header {
    align-items: stretch;
    flex-direction: column;
  }
  .scenario-actions {
    display: block;
  }
  .scenario-select {
    width: auto;
  }
  .scenario-secondary-action {
    display: none;
  }
  .strategy-overview {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'available'
      'allocation'
      'outcomes';
    gap: 0.8rem;
  }
  .overview-available-panel {
    min-height: 5.5rem;
  }
  .overview-available-panel strong {
    font-size: 1.75rem;
  }
  .overview-section-heading {
    align-items: baseline;
  }
  .overview-section-heading p {
    max-width: 15rem;
  }
  .allocation-overview-metrics article {
    padding: 0 0.35rem;
  }
  .allocation-overview-metrics small {
    font-size: 0.63rem;
  }
  .allocation-overview-metrics strong {
    font-size: 1rem;
  }
  .overview-outcome {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'icon copy arrow'
      'icon status arrow';
    gap: 0.2rem 0.65rem;
  }
  .overview-outcome > .mini-icon {
    grid-area: icon;
  }
  .overview-outcome .outcome-copy {
    grid-area: copy;
  }
  .overview-outcome b {
    grid-area: status;
    max-width: none;
    text-align: left;
  }
  .overview-outcome .outcome-arrow {
    grid-area: arrow;
  }
  .strategy-sheet-heading {
    padding: 0.8rem 1rem 0.7rem;
  }
  .strategy-sheet-scroll {
    padding: 0.5rem 1rem 1rem;
  }
  .strategy-sheet-actions {
    padding: 0.8rem 1rem max(1rem, env(safe-area-inset-bottom));
  }
  .sheet-outcome-card {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'icon copy arrow'
      'icon status arrow';
    gap: 0.25rem 0.65rem;
  }
  .sheet-outcome-card > .mini-icon {
    grid-area: icon;
  }
  .sheet-outcome-card .outcome-copy {
    grid-area: copy;
  }
  .sheet-outcome-card b {
    grid-area: status;
    max-width: none;
    text-align: left;
  }
  .sheet-outcome-card > .q-icon:last-child {
    grid-area: arrow;
  }
  .detail-sheet-section {
    padding: 0.75rem;
  }
  .detail-section-heading {
    align-items: stretch;
    flex-direction: column;
  }
  .investment-detail-heading {
    align-items: center;
    flex-direction: row;
  }
  .investment-detail-heading .detail-view-switch {
    align-self: center;
    margin-left: auto;
  }
  .large-detail-values {
    grid-template-columns: 1fr;
  }
  .strategy-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .small-panels {
    grid-template-columns: 1fr;
  }
  .investment-mix-card {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'icon identity action'
      'icon allocation return'
      'icon amount amount';
    gap: 0.45rem 0.7rem;
  }
  .cash-return-card {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'icon identity return';
  }
  .mix-card-icon {
    grid-area: icon;
    align-self: start;
    width: 2.6rem;
    height: 2.6rem;
  }
  .mix-card-identity {
    grid-area: identity;
  }
  .allocation-metric {
    grid-area: allocation;
  }
  .return-metric {
    grid-area: return;
  }
  .mix-card-metric {
    min-height: auto;
    padding-left: 0;
    border-left: 0;
  }
  .mix-card-amount {
    grid-area: amount;
    justify-items: start;
    text-align: left;
  }
  .mix-card-remove {
    grid-area: action;
  }
  .allocation-total {
    grid-template-columns: 1fr auto;
  }
  .allocation-total strong:last-child {
    grid-column: 1 / -1;
    text-align: left;
  }
  .projection-heading {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'copy horizon';
    align-items: center;
    gap: 0.75rem;
  }
  .projection-heading > div:first-child {
    grid-area: copy;
  }
  .debt-projection-panel .projection-heading {
    grid-template-columns: 1fr;
    grid-template-areas:
      'copy'
      'debt-controls';
    align-items: stretch;
  }
  .debt-projection-controls {
    grid-area: debt-controls;
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .projection-controls {
    display: contents;
  }
  .desktop-view-switch {
    display: none;
  }
  .desktop-horizon-options {
    display: flex;
    grid-area: horizon;
    justify-self: end;
    padding: 0.15rem;
  }
  .desktop-horizon-options button {
    min-width: 0;
    height: 1.6rem;
    padding: 0.15rem 0.3rem;
  }
  .horizon-unit {
    display: none;
  }
  .projection-result-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }
  .mobile-view-switch {
    display: flex;
    flex-shrink: 0;
  }
  .mobile-view-switch button {
    min-width: 0;
    padding: 0.38rem 0.45rem;
  }
  .projected-total {
    justify-content: start;
    margin: 0;
    text-align: left;
  }
  .result-breakdown {
    gap: 0;
    padding: 0.7rem;
  }
  .result-breakdown span {
    min-width: 0;
    min-height: 3.25rem;
    padding: 0.4rem 0.55rem;
  }
  .result-breakdown small {
    font-size: 0.68rem;
    line-height: 1.2;
  }
  .result-breakdown strong {
    font-size: clamp(0.88rem, 3.5vw, 1rem);
  }
  .milestones-panel {
    gap: 0.6rem;
  }
  .milestone-card {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'icon copy'
      'status status';
    align-items: start;
    gap: 0.55rem 0.7rem;
    margin-top: 0;
    padding: 0.8rem;
    border: 0;
    background: var(--color-surface-soft);
  }
  .milestone-card > .mini-icon {
    grid-area: icon;
  }
  .milestone-card > .outcome-copy {
    grid-area: copy;
    gap: 0.15rem;
    min-width: 0;
  }
  .milestone-card small {
    font-size: 0.67rem;
    line-height: 1.4;
  }
  .milestone-card > b {
    grid-area: status;
    max-width: none;
    padding: 0.5rem 0.6rem;
    border-radius: 0.55rem;
    text-align: left;
    font-size: 0.7rem;
    line-height: 1.35;
  }
  .milestone-card > b.positive {
    background: var(--color-green-soft);
  }
  .milestone-card > b.progress {
    background: var(--color-blue-soft);
  }
  .milestone-card > b.negative {
    background: var(--color-red-soft);
  }
}
</style>
