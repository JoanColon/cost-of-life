# Cost of Life

Aplicación web _mobile-first_ para entender la posición financiera de una persona o un hogar: patrimonio neto, coste real de vida, capacidad de ahorro y progreso hacia hitos financieros.

Este README es la puerta de entrada técnica al proyecto y debe mantenerse como fuente primaria para desarrolladores y agentes de código. Describe lo que existe hoy. La visión de producto más amplia, incluidas ideas todavía no implementadas, vive en [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md).

## Estado actual

La aplicación permite:

- autenticarse con email/contraseña o Google;
- crear espacios financieros personales y compartirlos mediante invitaciones de un solo uso;
- modelar activos, pasivos, ingresos y gastos por categorías;
- repartir cada importe entre miembros del espacio mediante porcentajes de propiedad;
- consultar patrimonio neto, coste de vida y capacidad de ahorro para todo el hogar o un miembro;
- registrar gastos reales por mes y reconciliarlos con el modelo estimado;
- conservar snapshots financieros anuales e historial de patrimonio;
- activar seguimiento y confirmar hitos de seguridad, patrimonio, deuda y libertad financiera;
- modelar hipotecas de amortización francesa y vincularlas con un inmueble y un gasto;
- proyectar el valor y el equity de inmuebles;
- conectar una inversión con Google Sheets para sincronizar posiciones, valoración y dividendos;
- simular recortes de gasto, ahorro adicional y estrategias guardadas de efectivo, inversión y deuda;
- comparar la evolución histórica de patrimonio, activos, deuda, ingresos y coste de vida.

La implementación actual es una SPA en JavaScript y tanto la aplicación como Functions usan ES Modules. Aunque la visión de producto menciona TypeScript, Capacitor y funcionalidades futuras, no se debe asumir que estén implementados.

## Modelo mental del producto

Un usuario puede pertenecer a uno o más **workspaces**. Cada workspace representa una economía personal o compartida y contiene dos capas de información:

1. **Modelo financiero editable**: configuración de categorías e ítems de activos, pasivos, ingresos y gastos.
2. **Proyección anual derivada**: documento materializado por año con doce meses desglosados por categoría, ítem y miembro. Los agregados anuales se calculan al leerlo.

El dashboard, Progress, Plan y los hitos leen principalmente la proyección anual. Las pantallas de edición leen además los documentos fuente. Las simulaciones son cálculos puros en el cliente: persisten supuestos, no resultados.

Las magnitudes principales son:

```text
patrimonio neto = activos - pasivos
capacidad de ahorro anual = ingresos anuales disponibles - coste de vida anual
meses de seguridad = efectivo / (coste de vida anual / 12)
años financiados = activos invertibles / coste de vida anual
```

Los activos y pasivos representan una posición observada en un mes. Los ingresos y gastos son flujos distribuidos por los doce meses. El huso horario financiero es `Europe/Madrid`; el workspace nace en EUR, pero su código de moneda de tres letras se puede cambiar en Setup. La interfaz usa locale `en-IE` y no hace conversión de divisas: cambiar la moneda solo cambia la unidad/formato que se muestra.

## Stack y decisiones activas

| Área           | Implementación                                                 |
| -------------- | -------------------------------------------------------------- |
| UI             | Vue 3 Composition API + Quasar 2                               |
| Estado         | Pinia 4, stores de composición                                 |
| Navegación     | Vue Router 5, rutas explícitas, modo `hash`                    |
| Backend        | Firebase Authentication, Cloud Firestore y Cloud Functions v2  |
| Gráficos       | ECharts 6                                                      |
| Traducciones   | Vue I18n; por ahora solo `en-US`                               |
| Estilos        | SCSS, tokens y mixins propios sobre componentes Quasar         |
| Tests          | Vitest 5 para dominio, stores, servicios y lógica de Functions |
| Calidad        | ESLint + Prettier                                              |
| Hosting        | Firebase Hosting desde `dist/spa`                              |
| Región backend | `europe-west1`                                                 |

El cliente está conectado directamente al proyecto Firebase `cost-of-life-f23b2` desde [`src/firebase/firebase.js`](src/firebase/firebase.js). No hacen falta variables de entorno para arrancar la SPA. `VITE_APP_URL` es opcional y solo se usa como origen de los enlaces de invitación en una build Capacitor; si no existe, se usa la URL pública de Firebase Hosting.

## Puesta en marcha

### Requisitos

- Node.js `^22.12`, `^24` o `>=26`, tal como exige `package.json` (el runtime desplegado de Functions es Node 24).
- Yarn Classic para el frontend. Functions conserva su propio `package-lock.json` y se instala con npm.
- Google Chrome para el flujo local de Google Auth; `yarn dev` intenta abrirlo automáticamente.
- Firebase CLI solo para emuladores o despliegue.

Instala por separado las dependencias del frontend y de Functions:

```bash
yarn install --frozen-lockfile
npm --prefix functions ci
yarn dev
```

La aplicación se sirve en el host local que muestre Quasar. Firebase Auth debe tener ese origen autorizado. El proyecto no conecta actualmente el SDK cliente a los emuladores, por lo que iniciar el emulador de Functions no redirige por sí solo las llamadas de la SPA: añade explícitamente la conexión a emuladores antes de basar un flujo local en ella.

### Comandos

| Comando                             | Efecto                                                          |
| ----------------------------------- | --------------------------------------------------------------- |
| `yarn dev`                          | Arranca Quasar/Vite en desarrollo.                              |
| `yarn test`                         | Ejecuta toda la suite Vitest una vez.                           |
| `yarn lint:check`                   | Comprueba formato y lint del frontend y Functions sin corregir. |
| `yarn lint`                         | Reescribe formato y aplica autofix; es un comando mutante.      |
| `yarn build`                        | Genera la SPA de producción en `dist/spa`.                      |
| `npm --prefix functions run serve`  | Arranca únicamente el emulador de Functions.                    |
| `npm --prefix functions run shell`  | Abre Firebase Functions Shell.                                  |
| `npm --prefix functions run deploy` | Despliega todas las Functions.                                  |
| `npm --prefix functions run logs`   | Consulta logs de Functions.                                     |

Comandos habituales de despliegue que requieren Firebase CLI:

```bash
yarn build
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
npm --prefix functions run deploy
```

El proyecto Firebase por defecto está fijado en [`.firebaserc`](.firebaserc). Revisa siempre el proyecto activo antes de desplegar.

## Organización del repositorio

```text
cost-of-life/
├── src/
│   ├── boot/                    Plugins de arranque de Quasar (i18n)
│   ├── components/              UI reutilizable agrupada por dominio
│   ├── config/                  Catálogos canónicos de categorías e hitos
│   ├── css/                     Estilos globales, tokens y mixins
│   ├── domain/
│   │   ├── financial/           Cálculos puros y normalización financiera
│   │   └── milestones/          Definición y cálculo de hitos
│   ├── firebase/                Inicialización de los SDK de Firebase
│   ├── i18n/                    Diccionario de interfaz
│   ├── layouts/                 Shell autenticado y navegación
│   ├── pages/                   Una vista por ruta visible
│   ├── router/                  Tabla de rutas y guard de autenticación
│   ├── services/
│   │   ├── auth.js              API de Firebase Auth
│   │   └── firebase/            Lecturas y escrituras remotas
│   ├── stores/                  Estado, caché y coordinación con servicios
│   └── utils/                   Formato y utilidades de miembros
├── functions/
│   ├── domain/                  Proyección financiera pura del backend
│   ├── shared/                  Fórmulas puras compartidas con el frontend
│   ├── services/                Transacciones y lógica de aplicación
│   ├── financial-model.js       Callable de mutación del modelo
│   ├── financial-years.js       Callable y triggers de proyección anual
│   ├── investment-portfolios.js Callables para portfolios de Google Sheets
│   ├── workspaces.js            Callables de invitación y borrado
│   └── index.js                 Registro de exports de Functions
├── test/                        Tests Vitest, reflejando las capas del código
├── docs/PRODUCT_VISION.md       Dirección de producto, no inventario de features
├── references/                 Proyectos externos de consulta: solo lectura
├── firestore.rules             Autorización y contratos de escritura cliente
├── firestore.indexes.json      Configuración de índices de Firestore
├── firebase.json               Functions, Firestore, Hosting y emuladores
├── quasar.config.js            Build, plugins y servidor de desarrollo
└── vitest.config.js            Configuración de tests y alias `@`
```

### Responsabilidad de cada capa

- **Pages** ensamblan una pantalla, leen parámetros de ruta y coordinan stores.
- **Components** encapsulan formularios, tarjetas y editores reutilizables; no deberían conocer la estructura completa de navegación o Firestore.
- **Stores** mantienen caché, estados de carga/error y coordinan llamadas a servicios. No son la capa donde deben vivir los cálculos financieros puros.
- **Services** traducen operaciones de aplicación a Auth, Firestore o callables.
- **Domain** contiene cálculos deterministas y validaciones sin Vue ni acceso remoto. Es la primera opción para lógica financiera nueva y debe cubrirse con tests.
- **Config** define IDs estables de categorías, subtipos, valores sugeridos y familias de hitos. Esos IDs forman parte del contrato persistido.
- **Functions** concentra las operaciones que requieren privilegios, acceso externo, borrado recursivo o atomicidad entre el modelo y su proyección.
- **Functions/shared** contiene únicamente fórmulas deterministas que deben producir exactamente el mismo resultado en navegador y servidor. No puede depender de Firebase, Vue ni estado remoto.

Se usa el alias `@` para `src`. Mantén la dirección de dependencias `page/component → store → service → Firebase` y extrae la lógica pura a `domain`.

### Mapa de estado y acceso remoto

| Área              | Store principal                                    | Servicio / fuente                                      |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------ |
| Sesión            | estado reactivo en `services/auth.js`              | Firebase Auth: email/password, Google popup y observer |
| Workspaces        | `workspace-store.js`                               | `workspace.service.js` y `user-preferences.service.js` |
| Año materializado | `financial-years-store.js`                         | callable de ensure + listener Firestore en tiempo real |
| Activos y pasivos | `assets-store.js`, `liabilities-store.js`          | config directo; ítems mediante callable de modelo      |
| Ingresos y gastos | `income-store.js`, `expenses-store.js`             | config directo; ítems mediante callable de modelo      |
| Gasto real        | `expense-tracking-store.js`                        | documentos mensuales Firestore                         |
| Hitos             | `milestones-store.js`                              | año/historial + transacciones de achievements          |
| Plan              | `what-if-store.js`                                 | dos documentos `modelConfig` + dominio puro            |
| Scope y accesos   | `financial-scope-store.js`, `quick-links-store.js` | memoria local + preferencias de usuario                |

Los stores de modelo cachean por workspace/categoría y exponen `reset()`. El año financiero es la excepción importante: mantiene una suscripción viva para el workspace/año activo. Antes de crear otro store, revisa el ciclo de carga y limpieza de `AppLayout.vue`.

## Navegación

Las rutas se declaran manualmente en [`src/router/routes.js`](src/router/routes.js); los nombres de archivo no generan rutas. Usa siempre rutas con nombre:

```js
router.push({ name: 'assets', params: { workspaceId } })
```

No construyas URLs de workspace a mano. El mapa funcional es:

| Ruta con nombre                                                               | URL                                           | Pantalla                                               |
| ----------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `login`                                                                       | `/`                                           | Acceso y registro. Redirige a `home` si ya hay sesión. |
| `workspace-invite`                                                            | `/invite/:token`                              | Consulta y aceptación de invitación.                   |
| `home`                                                                        | `/home`                                       | Lista y creación inicial de workspaces.                |
| `create-workspace`                                                            | `/home/workspaces/new`                        | Creación de workspace.                                 |
| `workspace-dashboard`                                                         | `/home/workspaces/:workspaceId`               | Resumen financiero e hitos.                            |
| `setup`                                                                       | `.../setup`                                   | Moneda y nombres de miembros.                          |
| `assets`, `liabilities`, `income`, `expenses`                                 | `.../:section`                                | Configuración y resumen por categorías.                |
| `asset-category`, `liability-category`, `income-category`, `expense-category` | `.../:section/:category`                      | Edición detallada de una categoría.                    |
| `investment-portfolio`                                                        | `.../assets/investment/:assetId/portfolio`    | Portfolio conectado a Google Sheets.                   |
| `real-estate-model`                                                           | `.../assets/real-estate/:assetId/model`       | Valor, hipoteca y equity del inmueble.                 |
| `mortgage-detail`                                                             | `.../liabilities/mortgage/:liabilityId/model` | Modelo y amortización de hipoteca.                     |
| `expense-tracker`                                                             | `.../expenses/tracker`                        | Registro y reconciliación mensual.                     |
| `progress`                                                                    | `.../progress`                                | Comparación temporal de métricas financieras.          |
| `achievements`                                                                | `.../achievements`                            | Hitos pendientes y alcanzados.                         |
| `plan`                                                                        | `.../plan`                                    | Resumen del plan y acceso a simulaciones.              |
| `what-if`                                                                     | `.../what-if`                                 | Ajuste de gasto y ahorro adicional.                    |
| `what-if-strategy`                                                            | `.../what-if/strategy`                        | Escenarios de efectivo, inversión y deuda.             |

`progress` y `achievements` son pantallas distintas. Todo `/home` exige autenticación. El guard espera a que Firebase resuelva el estado de sesión y conserva un `?redirect=` local seguro al enviar al login.

[`src/layouts/AppLayout.vue`](src/layouts/AppLayout.vue) carga los workspaces y la preferencia de workspace activo, aplica su moneda, asegura/suscribe el año financiero actual, sincroniza portfolios conectados y reinicia stores al cerrar sesión. También revalida hitos al recuperar foco y cambia de periodo financiero sin recargar la app. En móvil, [`src/components/dashboard/MobileBottomNav.vue`](src/components/dashboard/MobileBottomNav.vue) actúa como navegación principal.

## Modelo de datos de Firestore

```text
users/{uid}

workspaces/{workspaceId}
├── modelConfig/{assets|liabilities|income|expenses|expenseTracking|whatIf|whatIfStrategies}
├── modelAssets/{itemId}
├── modelLiabilities/{itemId}
├── modelIncome/{itemId}
├── modelExpenses/{itemId}
├── expenseTracking/{YYYY-MM}
├── financialYears/{YYYY}
└── achievements/{milestoneId}

workspaceInvites/{sha256(token)}
```

### `users/{uid}`

Preferencias privadas del usuario: `activeWorkspaceId` y `quickLinksByWorkspace`. Solo el propio usuario puede leer o escribir el documento; las reglas limitan las claves y exigen `updatedAt == request.time`. Este documento ayuda a restaurar contexto, pero nunca concede acceso a un workspace.

### `workspaces/{workspaceId}`

Documento raíz con `name`, `type`, `currency`, `createdBy`, timestamps, `milestoneTracking`, `memberIds` y un mapa `members`. Cada miembro tiene rol `owner` o `member`; solo el owner puede borrar el workspace. `memberIds` existe además del mapa para consultas `array-contains` y comprobaciones de reglas. La configuración de moneda y nombres pasa por `updateWorkspaceSettings`, que exige un código de tres letras y un nombre no vacío para cada miembro.

Una invitación dura siete días, tiene rol `member`, es de un solo uso y guarda únicamente el hash SHA-256 del token como ID. `workspaceInvites` solo es accesible desde Functions.

### `modelConfig/{section}`

Guarda `setupCompleted` y el mapa de categorías activas. En Expenses e Income, las subcategorías se derivan de los items guardados en `modelExpenses` y `modelIncome`; los catálogos de sugerencias no se persisten ni crean filas automáticamente. Cada item usa `categoryId` y `subcategoryId`, mientras que su `itemId` estable es el ID del documento. `expenseTracking` guarda las subcategorías habilitadas.

La simulación se divide por compatibilidad en dos documentos escritos en un único batch:

- `whatIf`: reducción discrecional, ahorro extra y una representación legacy del escenario activo;
- `whatIfStrategies`: hasta diez escenarios, el activo y todos sus supuestos (asignación cash/invest/debt, mix y rentabilidades, inflación, horizonte, colchón objetivo y deuda elegida).

Solo se guardan supuestos. Las proyecciones se recomputan con `src/domain/financial/what-if.js` y `strategy-simulation.js`.

Cambiar un documento de configuración de `assets`, `liabilities`, `income` o `expenses` dispara `onModelConfigWritten`, que reconstruye esa sección del año actual.

### Colecciones `model*`

Son la fuente editable de ítems detallados. Todos los ítems contienen categoría, ownership y campos de auditoría. Sus valores canónicos dependen de la sección:

- activos: `currentValue`, `valueSource: 'manual'`, detalle y, si aplica, relación con hipoteca;
- pasivos: `balance` y, para hipotecas, el modelo dentro de `detail.mortgage`;
- ingresos: subtipo, porcentaje disponible, cálculo (`annual_salary`, `monthly_schedule`, `recurring` o `one_time`) y vínculo opcional de dividendos con un portfolio;
- gastos: `categoryId`, `subcategoryId`, nombre del ítem, notas, estimación/frecuencia, importes mensuales, variabilidad, recurrencia y necesidad.

Cada gasto detallado tiene un ID estable generado por Firestore. Varias entradas pueden compartir `subcategoryId`, como Netflix, Spotify y ChatGPT dentro de Subscriptions.

No escribas directamente en estas colecciones desde el cliente. Las reglas permiten leerlas, pero las mutaciones pasan por `mutateFinancialModel` para que el ítem y `financialYears/{añoActual}` cambien en la misma transacción.

#### Relaciones y modelos especiales

- Una hipoteca solo soporta tipo francés, interés fijo y cuota capaz de cubrir los intereses. Su esquema actual incluye principal original, saldo/ancla de saldo, tasa, cuota, plazo y fecha inicial.
- La relación hipoteca–inmueble y la relación hipoteca–gasto se gestionan desde la mutación de la hipoteca, no editando los otros documentos. Son uno-a-uno. El gasto enlazado debe ser `housing/mortgage_rent`; su estimación mensual se mantiene alineada con la cuota y deja de proyectarse al terminar la deuda.
- Un modelo inmobiliario vive en `modelAssets/{id}.detail.realEstate`: precio y fecha de compra, apreciación anual y schema version. Su valoración efectiva se actualiza al abrir/asegurar el año y antes del cierre mensual.
- Un portfolio vive embebido en `modelAssets/{id}.detail.portfolio`; no existe una colección de portfolios. Puede enlazarse como máximo a una fuente `investments/dividends`. Al sincronizar, la Function actualiza `currentValue`, el ingreso anual por dividendos y las secciones afectadas del año financiero.

Los borrados limpian relaciones: borrar una inversión desvincula su ingreso; borrar una hipoteca desvincula inmueble y gasto; borrar gastos retira sus IDs de tracking. `deleteCategory` hace todo dentro del límite transaccional de 500 escrituras y falla si lo excede.

### Ownership

[`src/domain/financial/ownership.js`](src/domain/financial/ownership.js) define el contrato. Una asignación referencia exclusivamente miembros del workspace y sus porcentajes deben sumar 100. Los cálculos pueden pedir el valor agregado (`all`) o aplicar las participaciones de un miembro concreto.

### `expenseTracking/{YYYY-MM}`

Contiene gastos reales agrupados por `subcategoryId` y decisiones de reconciliación. Cada movimiento conserva su propio ID, ownership y referencia mediante `itemId` a un ítem de Expenses de la misma subcategoría. La decisión es `model`, `tracked` o `combined`: usa la estimación, la sustituye por lo registrado o suma ambos valores. Al escribir un mes, `onExpenseTrackingWritten` actualiza ese mes dentro del snapshot anual correspondiente.

### `financialYears/{YYYY}`

Es una vista materializada de solo lectura para clientes y la única fuente del histórico financiero mensual. `schemaVersion: 1` contiene `months`, `projectionState`, estado y metadatos. Cada mes descompone las cuatro secciones por categoría, subcategoría, ítem y `memberValues`. El año actual se crea bajo demanda con `ensureFinancialYear`; ese callable solo acepta el año actual. Las escrituras de configuración, modelo o tracking mantienen la proyección al día.

Los años anteriores se leen como historial y no se regeneran automáticamente desde la interfaz. Activos y pasivos conservan su último valor observado hacia los meses siguientes; ingresos y gastos se proyectan como flujos mensuales. Un mes cerrado no se reescribe al reproyectar. Cada posición mensual puede guardar `positionStatus`, `positionAsOf` y `positionCalculatedAt`. La función programada cierra el mes anterior usando la valoración del último día y sincroniza antes los portfolios. Los gráficos ignoran meses anteriores a la primera posición observada y meses futuros proyectados.

### `achievements/{milestoneId}`

El progreso se deriva del año financiero, posiciones actuales e historial. Al activar por primera vez el seguimiento, los hitos ya cumplidos se guardan directamente como `achieved`. Después, una nueva calificación se guarda como `pending` y solo se confirma como `achieved` si continúa cumpliéndose tras 24 horas; si deja de cumplirse, el pending se elimina. Los logrados son permanentes. Las reglas restringen familia, transición, timestamps y batch de activación.

### Portfolio conectado a Google Sheets

La hoja se lee únicamente desde Functions mediante endpoints CSV de Google. Debe ser accesible por enlace y contener pestañas exactas `Portfolio` y `Summary`. El parser y sus columnas/aliases canónicos viven en `functions/services/investment-portfolio-schema.js`; si cambia la plantilla, cambia primero ese contrato y sus tests.

La caché schema v2 dura 15 minutos. Guarda holdings, resumen, warnings, tiempos y estado de sincronización dentro del activo; tiene límites de tamaño y conserva el último error. Se sincroniza al abrir el workspace, manualmente y antes del cierre mensual. No hay OAuth de Google ni conversión entre la `baseCurrency` de la hoja y la moneda del workspace.

La sincronización admite resultados parciales. Los errores de fórmula de Sheets nunca se convierten en cero: los campos válidos se importan, los opcionales inválidos generan warnings y, cuando existe una caché anterior identificable por ticker, se conserva el último valor válido. Un fallo de dividendos no bloquea la valoración ni actualiza el ingreso enlazado; un valor total inválido solo puede reutilizar el anterior y bloquea una conexión nueva si aún no existe una valoración fiable.

## Flujo de datos y escrituras

```text
Vista → Store → Service
                  ├─ lectura Firestore → estado Pinia → Vista
                  ├─ config/tracking Firestore → trigger → financialYears
                  └─ callable mutateFinancialModel
                         └─ transacción: model* + financialYears

Google Sheet → callable de portfolio → modelAssets/modelIncome → financialYears
```

Los caminos de escritura no son intercambiables:

1. **Configuración simple**: el cliente escribe `modelConfig`; un trigger reconstruye la sección afectada.
2. **Ítems detallados**: el cliente llama `mutateFinancialModel`; la Function valida membresía y actualiza fuente y proyección atómicamente.
3. **Tracking mensual**: el cliente actualiza `expenseTracking/{period}`; un trigger integra el mes en `financialYears/{year}`.
4. **Preferencias personales**: el cliente escribe `users/{uid}`.
5. **Workspace, membresía y portfolio**: usan callables por sus permisos, relaciones o acceso a Google Sheets.
6. **Hitos**: el cliente usa transacciones/batches directos estrechamente validados por reglas.

Antes de mutar ítems detallados debe existir el documento del año actual. [`src/stores/financial-years-store.js`](src/stores/financial-years-store.js) se encarga de solicitarlo y mantener una suscripción en tiempo real para el workspace activo.

## Cloud Functions

| Export                              | Tipo              | Responsabilidad                                                                      |
| ----------------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| `ensureFinancialYear`               | Callable          | Crea/refresca el año actual, modelos con valor temporal y posiciones.                |
| `mutateFinancialModel`              | Callable          | Crea, edita o borra ítems/categorías y sus relaciones de forma atómica.              |
| `onModelConfigWritten`              | Firestore trigger | Reproyecta assets, liabilities, income o expenses tras cambiar su configuración.     |
| `onExpenseTrackingWritten`          | Firestore trigger | Inserta el mes registrado en la proyección anual.                                    |
| `closeMonthlyFinancialPositions`    | Scheduler         | A las 00:05 del día 1 (Madrid), sincroniza portfolios y cierra el mes anterior.      |
| `updateInvestmentPortfolio`         | Callable          | Conecta, cambia o desconecta el Google Sheet de una inversión.                       |
| `readInvestmentPortfolioSheet`      | Callable          | Refresca una inversión conectada respetando caché o `force`.                         |
| `syncWorkspaceInvestmentPortfolios` | Callable          | Sincroniza todos los portfolios conectados de un workspace.                          |
| `createWorkspaceInvite`             | Callable          | Crea una invitación de siete días para un miembro del workspace.                     |
| `getWorkspaceInvite`                | Callable          | Valida token/estado y devuelve metadatos seguros; no exige login para consultar.     |
| `acceptWorkspaceInvite`             | Callable          | Añade al usuario autenticado y consume la invitación de forma idempotente para él.   |
| `updateWorkspaceSettings`           | Callable          | Valida moneda y nombres y actualiza el workspace sin abrir cambios de membresía.     |
| `deleteWorkspace`                   | Callable          | Verifica ownership, marca borrado y elimina workspace e invitaciones recursivamente. |

Todas se despliegan en `europe-west1`; las opciones globales limitan cada export a diez instancias salvo override local. `functions/index.js` inicializa Admin SDK una vez y agrega los exports de cada módulo. La lógica transaccional testeable vive en `functions/services`; los wrappers HTTP/evento deben permanecer pequeños.

## Seguridad

[`firestore.rules`](firestore.rules) aplica denegación por defecto:

- solo miembros autenticados leen un workspace y sus subcolecciones permitidas;
- cada usuario solo accede a sus propias preferencias;
- una creación de workspace debe incluir al creador como owner; una actualización cliente no puede cambiar `memberIds` ni `members`;
- los ítems `model*` y los años financieros no admiten escritura cliente;
- configuración y tracking sí permiten escritura a miembros de un workspace activo; `whatIf` y `whatIfStrategies` tienen allowlists adicionales;
- los hitos solo admiten el esquema y las transiciones temporales descritas arriba;
- invitaciones no tienen acceso directo desde el cliente;
- el borrado de workspaces solo ocurre mediante Admin SDK.

Las reglas son parte del contrato, pero la validación de dominio también debe existir en servicios/Functions. No conviertas una restricción crítica en una responsabilidad exclusiva de la UI.

`firestore.indexes.json` no declara índices compuestos. Desactiva índices para los mapas grandes `financialYears.months` y `financialYears.totals`; si una consulta nueva exige índice, añádelo explícitamente y despliega el archivo junto con las reglas.

## Dónde implementar cada cambio

| Si necesitas cambiar…              | Empieza por…                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Rutas o acceso autenticado         | `src/router/routes.js`, `src/router/index.js`                                                                              |
| Navegación y ciclo del workspace   | `src/layouts/AppLayout.vue`                                                                                                |
| Catálogos o IDs financieros        | `src/config/*-categories.js`                                                                                               |
| Fórmulas financieras               | `src/domain/financial/` y sus tests                                                                                        |
| Definición/cálculo de hitos        | `src/domain/milestones/`, `src/config/milestone-families.js`                                                               |
| Estado y caché de una sección      | `src/stores/<sección>-store.js`                                                                                            |
| Acceso cliente a Firebase          | `src/services/firebase/`                                                                                                   |
| Mutaciones atómicas del modelo     | `functions/services/financial-model.js`                                                                                    |
| Construcción del snapshot anual    | `functions/domain/financial-year.js`, `functions/services/financial-years.js`                                              |
| Hipoteca o valoración inmobiliaria | `src/domain/financial/mortgage-amortization.js`, `real-estate-*`; equivalentes de `functions/domain/` para materialización |
| Simulación y escenarios            | `src/domain/financial/what-if.js`, `strategy-simulation.js`, `calculation-context.js`                                      |
| Portfolio de Google Sheets         | `functions/services/investment-portfolios.js`, `investment-portfolio-schema.js`                                            |
| Membresía, settings o borrado      | `functions/services/workspaces.js`                                                                                         |
| Permisos                           | `firestore.rules` y tests de la operación afectada                                                                         |
| Texto visible                      | `src/i18n/en-US/index.js`                                                                                                  |
| Diseño global                      | `src/css/_tokens.scss`, `src/css/_mixins.scss`, `src/css/app.scss`                                                         |

Las categorías e IDs de hitos son persistidos. Renombrarlos no es un cambio cosmético: requiere compatibilidad o migración de datos.

## Convenciones de desarrollo

- Usa Composition API con `<script setup>` y JavaScript, que es el estándar actual del repositorio.
- Mantén cálculos deterministas en `src/domain` o `functions/domain` y sin dependencias de Vue/Firebase.
- Normaliza y valida datos antes de persistir. No confíes en que un formulario sea el único llamador.
- Añade estados explícitos de carga, error y vacío en páginas que lean datos remotos.
- Usa rutas con nombre y el alias `@`; no acoples componentes a URLs literales.
- Todo texto visible debe pasar por Vue I18n, aunque solo exista `en-US` hoy.
- Reutiliza tokens CSS y mixins antes de introducir valores globales nuevos.
- Al cerrar sesión o cambiar de usuario, cualquier store nuevo con estado por workspace debe integrarse en el reseteo de `AppLayout`.
- No escribas `model*`, `financialYears`, relaciones de hipoteca o caché de portfolio desde la UI: usa el servicio/callable propietario.
- Mantén sincronizadas las fórmulas duplicadas entre `src/domain` y `functions/domain`/`functions/shared`; hoy no existe un paquete compartido compilado para ambos runtimes.
- Usa `functions/shared/financial-core.js` para fechas financieras, suma de meses, apreciación inmobiliaria y pasos de amortización compartidos entre navegador y Functions.
- Si una mutación afecta métricas del dashboard, comprueba también la proyección anual y los hitos.
- Añade tests junto a la capa modificada. La suite usa archivos `test/**/*.test.js`.
- Ejecuta `yarn lint:check`, no `yarn lint`, cuando solo quieras verificar sin reescribir archivos.

## Referencias: solo lectura

Todo lo que haya bajo `references/` pertenece a otros proyectos copiados para consultar patrones. Se puede leer para entender arquitectura, Firebase, UI o cálculos, pero nunca se debe:

- editar, borrar, renombrar, mover o formatear contenido de `references/`;
- ejecutar migraciones o actualizaciones de dependencias dentro de esos proyectos;
- importar código de `references/` desde la aplicación activa;
- incluir cambios destinados a esos proyectos en un commit de Cost of Life.

Si una idea resulta útil, reimplémentala dentro de `src/` o `functions/` con los contratos de este proyecto.

## Checklist antes de entregar un cambio

```bash
yarn test
yarn lint:check
yarn build
```

Además:

- prueba el flujo afectado con un workspace personal y, si interviene ownership, con uno compartido;
- comprueba permisos y reglas si cambia una ruta de escritura;
- verifica que el año financiero derivado se actualiza, no solo el documento fuente;
- revisa responsive móvil si se modifica una página o navegación;
- actualiza este README en el mismo cambio si varían arquitectura, comandos, esquema, rutas o invariantes.

## Límites y asuntos pendientes conocidos

- La interfaz está únicamente en inglés. La moneda es configurable, pero no existe conversión de importes ni validación contra una lista ISO cerrada.
- No hay conexión cliente configurada a Auth/Firestore/Functions Emulator.
- No hay una estrategia offline implementada; Firestore usa su comportamiento web por defecto.
- La app se construye como SPA web en modo hash. La configuración Quasar conserva secciones de otros targets, pero no demuestra que Electron, PWA, Cordova o Capacitor estén operativos.
- `docs/PRODUCT_VISION.md` contiene fases y decisiones abiertas; no debe usarse como prueba de que una feature existe.
- El historial depende de snapshots `financialYears`; no se reconstruyen años cerrados desde la UI.
- La integración de portfolios depende de una hoja accesible por enlace, de nombres/columnas concretos y de Google GViz; no usa OAuth ni detecta automáticamente cambios de plantilla.
- No hay tests de Firestore Rules ni de integración contra emuladores en la suite actual; los tests existentes ejercitan dominio y servicios con dobles de Firestore.

Cuando el código y este documento diverjan, corrige ambos en el mismo trabajo: el objetivo es que este README siga siendo el mapa fiable desde el que una persona o un agente pueda continuar el desarrollo.
