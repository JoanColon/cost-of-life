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
- calcular y guardar hitos de seguridad, patrimonio, deuda y libertad financiera.
- simular recortes de gasto discrecional y comparar su uso en efectivo, inversión o deuda.

La implementación actual es una SPA en JavaScript. Aunque la visión de producto menciona TypeScript, Capacitor y funcionalidades futuras, no se debe asumir que estén implementados.

## Modelo mental del producto

Un usuario puede pertenecer a uno o más **workspaces**. Cada workspace representa una economía personal o compartida y contiene dos capas de información:

1. **Modelo financiero editable**: configuración de categorías e ítems de activos, pasivos, ingresos y gastos.
2. **Proyección anual derivada**: documento materializado por año con valores anuales, mensuales, por categoría y por miembro.

El dashboard y los hitos leen principalmente la proyección anual, no recalculan todo desde los documentos editables en el navegador.

Las magnitudes principales son:

```text
patrimonio neto = activos - pasivos
capacidad de ahorro anual = ingresos anuales disponibles - coste de vida anual
meses de seguridad = efectivo / (coste de vida anual / 12)
años financiados = activos invertibles / coste de vida anual
```

Los activos y pasivos representan una posición observada en un mes. Los ingresos y gastos son flujos distribuidos por los doce meses. El huso horario financiero es `Europe/Madrid` y la interfaz formatea importes en EUR con locale `en-IE`.

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
- npm.
- Google Chrome para el flujo local de Google Auth; `npm run dev` intenta abrirlo automáticamente.
- Firebase CLI solo para emuladores o despliegue.

Instala por separado las dependencias del frontend y de Functions:

```bash
npm ci
npm --prefix functions ci
npm run dev
```

La aplicación se sirve en el host local que muestre Quasar. Firebase Auth debe tener ese origen autorizado. El proyecto no conecta actualmente el SDK cliente a los emuladores, por lo que iniciar el emulador de Functions no redirige por sí solo las llamadas de la SPA: añade explícitamente la conexión a emuladores antes de basar un flujo local en ella.

### Comandos

| Comando                             | Efecto                                                          |
| ----------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                       | Arranca Quasar/Vite en desarrollo.                              |
| `npm test`                          | Ejecuta toda la suite Vitest una vez.                           |
| `npm run lint:check`                | Comprueba formato y lint del frontend y Functions sin corregir. |
| `npm run lint`                      | Reescribe formato y aplica autofix; es un comando mutante.      |
| `npm run build`                     | Genera la SPA de producción en `dist/spa`.                      |
| `npm --prefix functions run serve`  | Arranca únicamente el emulador de Functions.                    |
| `npm --prefix functions run shell`  | Abre Firebase Functions Shell.                                  |
| `npm --prefix functions run deploy` | Despliega todas las Functions.                                  |
| `npm --prefix functions run logs`   | Consulta logs de Functions.                                     |

Comandos habituales de despliegue que requieren Firebase CLI:

```bash
npm run build
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
│   ├── services/                Transacciones y lógica de aplicación
│   ├── financial-model.js       Callable de mutación del modelo
│   ├── financial-years.js       Callable y triggers de proyección anual
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
- **Functions** concentra las operaciones que requieren privilegios, borrado recursivo o atomicidad entre el modelo y su proyección.

Se usa el alias `@` para `src`. Mantén la dirección de dependencias `page/component → store → service → Firebase` y extrae la lógica pura a `domain`.

## Navegación

Las rutas se declaran manualmente en [`src/router/routes.js`](src/router/routes.js); los nombres de archivo no generan rutas. Usa siempre rutas con nombre:

```js
router.push({ name: 'assets', params: { workspaceId } })
```

No construyas URLs de workspace a mano. El mapa funcional es:

| Ruta con nombre                                                               | URL                             | Pantalla                                               |
| ----------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| `login`                                                                       | `/`                             | Acceso y registro. Redirige a `home` si ya hay sesión. |
| `workspace-invite`                                                            | `/invite/:token`                | Consulta y aceptación de invitación.                   |
| `home`                                                                        | `/home`                         | Lista y creación inicial de workspaces.                |
| `create-workspace`                                                            | `/home/workspaces/new`          | Creación de workspace.                                 |
| `workspace-dashboard`                                                         | `/home/workspaces/:workspaceId` | Resumen financiero e hitos.                            |
| `assets`, `liabilities`, `income`, `expenses`                                 | `.../:section`                  | Configuración y resumen por categorías.                |
| `asset-category`, `liability-category`, `income-category`, `expense-category` | `.../:section/:category`        | Edición detallada de una categoría.                    |
| `expense-tracker`                                                             | `.../expenses/tracker`          | Registro y reconciliación mensual.                     |
| `historic`                                                                    | `.../historic`                  | Totales de snapshots anuales.                          |
| `achievements`                                                                | `.../achievements`              | Progreso e hitos alcanzados.                           |
| `what-if`                                                                     | `.../what-if`                   | Simulación de capacidad de ahorro y estrategia.        |

`progress` es un alias antiguo que redirige a `achievements`. Todo `/home` exige autenticación. El guard espera a que Firebase resuelva el estado de sesión antes de decidir la navegación.

[`src/layouts/AppLayout.vue`](src/layouts/AppLayout.vue) carga los workspaces, sincroniza el año financiero del workspace activo, reinicia stores al cerrar sesión y contiene la navegación responsive. En móvil, [`src/components/dashboard/MobileBottomNav.vue`](src/components/dashboard/MobileBottomNav.vue) actúa como navegación principal del workspace.

## Modelo de datos de Firestore

```text
workspaces/{workspaceId}
├── modelConfig/{assets|liabilities|income|expenses|expenseTracking|whatIf}
├── modelAssets/{itemId}
├── modelLiabilities/{itemId}
├── modelIncome/{itemId}
├── modelExpenses/{itemId}
├── expenseTracking/{YYYY-MM}
├── financialYears/{YYYY}
└── achievements/{milestoneId}

workspaceInvites/{sha256(token)}
```

### `workspaces/{workspaceId}`

Documento raíz con `name`, `type`, `createdBy`, timestamps, `memberIds` y un mapa `members`. Cada miembro tiene rol `owner` o `member`; solo el owner puede borrar el workspace. `memberIds` existe además del mapa para consultas `array-contains` y comprobaciones de reglas.

Una invitación dura siete días, tiene rol `member`, es de un solo uso y guarda únicamente el hash SHA-256 del token como ID. `workspaceInvites` solo es accesible desde Functions.

### `modelConfig/{section}`

Guarda `setupCompleted` y el mapa de categorías activas. En Expenses e Income, las subcategorías se derivan de los items guardados en `modelExpenses` y `modelIncome`; los catálogos de sugerencias no se persisten ni crean filas automáticamente. Cada item usa `categoryId` y `subcategoryId`, mientras que su `itemId` estable es el ID del documento. `expenseTracking` guarda las subcategorías habilitadas para seguimiento y `whatIf` conserva únicamente las preferencias de simulación, nunca sus resultados derivados.

Cambiar un documento de configuración de `assets`, `liabilities`, `income` o `expenses` dispara `onModelConfigWritten`, que reconstruye esa sección del año actual.

### Colecciones `model*`

Son la fuente editable de ítems detallados. Todos los ítems contienen categoría, ownership y campos de auditoría. Sus valores canónicos dependen de la sección:

- activos: `currentValue`, `valueSource: 'manual'` y detalle;
- pasivos: `balance`;
- ingresos: subtipo, porcentaje disponible y cálculo (`annual_salary`, `monthly_schedule`, `recurring` o `one_time`);
- gastos: `categoryId`, `subcategoryId`, nombre del ítem, notas, estimación/frecuencia, importes mensuales, variabilidad, recurrencia y necesidad.

Cada gasto detallado tiene un ID estable generado por Firestore. Varias entradas pueden compartir `subcategoryId`, como Netflix, Spotify y ChatGPT dentro de Subscriptions.

No escribas directamente en estas colecciones desde el cliente. Las reglas permiten leerlas, pero las mutaciones pasan por `mutateFinancialModel` para que el ítem y `financialYears/{añoActual}` cambien en la misma transacción.

### Ownership

[`src/domain/financial/ownership.js`](src/domain/financial/ownership.js) define el contrato. Una asignación referencia exclusivamente miembros del workspace y sus porcentajes deben sumar 100. Los cálculos pueden pedir el valor agregado (`all`) o aplicar las participaciones de un miembro concreto.

### `expenseTracking/{YYYY-MM}`

Contiene gastos reales agrupados por `subcategoryId` y decisiones de reconciliación. Cada movimiento conserva su propio ID y referencia mediante `itemId` uno de los items de Expenses pertenecientes a esa misma subcategoría. Cada decisión resuelve si la proyección mensual utiliza el valor del modelo o el valor registrado. Al escribir un mes, `onExpenseTrackingWritten` actualiza ese mes dentro del snapshot anual correspondiente.

### `financialYears/{YYYY}`

Es una vista materializada de solo lectura para clientes. Contiene `months`, `totals`, estado y metadatos de generación. El año actual se crea bajo demanda con `ensureFinancialYear`; ese callable solo acepta el año actual. Las escrituras de configuración, modelo o tracking mantienen la proyección al día.

Los años anteriores se leen como historial y no se regeneran automáticamente desde la interfaz. Activos y pasivos conservan su último valor observado hacia los meses siguientes; ingresos y gastos se proyectan como flujos mensuales.

### `achievements/{milestoneId}`

Registro inmutable de un hito alcanzado. El progreso se deriva del año financiero y del historial. El cliente puede crear únicamente hitos definidos en el código, con campos y timestamp restringidos por reglas; no puede modificarlos ni borrarlos.

## Flujo de datos y escrituras

```text
Vista → Store → Service
                  ├─ lectura Firestore → estado Pinia → Vista
                  ├─ config/tracking Firestore → trigger → financialYears
                  └─ callable mutateFinancialModel
                         └─ transacción: model* + financialYears
```

Hay tres caminos de escritura y no son intercambiables:

1. **Configuración simple**: el cliente escribe `modelConfig`; un trigger reconstruye la sección afectada.
2. **Ítems detallados**: el cliente llama `mutateFinancialModel`; la Function valida membresía y actualiza fuente y proyección atómicamente.
3. **Tracking mensual**: el cliente actualiza `expenseTracking/{period}`; un trigger integra el mes en `financialYears/{year}`.

Antes de mutar ítems detallados debe existir el documento del año actual. [`src/stores/financial-years-store.js`](src/stores/financial-years-store.js) se encarga de solicitarlo y mantener una suscripción en tiempo real para el workspace activo.

## Cloud Functions

| Export                     | Tipo              | Responsabilidad                                                                      |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| `ensureFinancialYear`      | Callable          | Crea, si falta, la proyección del año actual para un miembro.                        |
| `mutateFinancialModel`     | Callable          | Crea, edita o borra ítems/categorías y sincroniza tracking con atomicidad.           |
| `onModelConfigWritten`     | Firestore trigger | Reproyecta la sección de configuración modificada.                                   |
| `onExpenseTrackingWritten` | Firestore trigger | Inserta el mes registrado en la proyección anual.                                    |
| `createWorkspaceInvite`    | Callable          | Crea una invitación de siete días para un miembro del workspace.                     |
| `getWorkspaceInvite`       | Callable          | Valida token/estado y devuelve metadatos seguros.                                    |
| `acceptWorkspaceInvite`    | Callable          | Añade al usuario autenticado y consume la invitación.                                |
| `deleteWorkspace`          | Callable          | Verifica ownership, marca borrado y elimina workspace e invitaciones recursivamente. |

Todas se despliegan en `europe-west1`. `functions/index.js` inicializa Admin SDK una vez y agrega los exports de cada módulo. La lógica transaccional testeable vive en `functions/services`; los wrappers HTTP/evento deben permanecer pequeños.

## Seguridad

[`firestore.rules`](firestore.rules) aplica denegación por defecto:

- solo miembros autenticados leen un workspace y sus subcolecciones permitidas;
- el cliente no puede cambiar `memberIds` ni `members`;
- los ítems `model*` y los años financieros no admiten escritura cliente;
- configuración y tracking sí permiten escritura a miembros de un workspace activo;
- logros solo se crean con el esquema permitido y son inmutables;
- invitaciones no tienen acceso directo desde el cliente;
- el borrado de workspaces solo ocurre mediante Admin SDK.

Las reglas son parte del contrato, pero la validación de dominio también debe existir en servicios/Functions. No conviertas una restricción crítica en una responsabilidad exclusiva de la UI.

## Dónde implementar cada cambio

| Si necesitas cambiar…             | Empieza por…                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Rutas o acceso autenticado        | `src/router/routes.js`, `src/router/index.js`                                 |
| Navegación y ciclo del workspace  | `src/layouts/AppLayout.vue`                                                   |
| Catálogos o IDs financieros       | `src/config/*-categories.js`                                                  |
| Fórmulas financieras              | `src/domain/financial/` y sus tests                                           |
| Definición/cálculo de hitos       | `src/domain/milestones/`, `src/config/milestone-families.js`                  |
| Estado y caché de una sección     | `src/stores/<sección>-store.js`                                               |
| Acceso cliente a Firebase         | `src/services/firebase/`                                                      |
| Mutaciones atómicas del modelo    | `functions/services/financial-model.js`                                       |
| Construcción del snapshot anual   | `functions/domain/financial-year.js`, `functions/services/financial-years.js` |
| Membresía, invitaciones o borrado | `functions/services/workspaces.js`                                            |
| Permisos                          | `firestore.rules` y tests de la operación afectada                            |
| Texto visible                     | `src/i18n/en-US/index.js`                                                     |
| Diseño global                     | `src/css/_tokens.scss`, `src/css/_mixins.scss`, `src/css/app.scss`            |

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
- Si una mutación afecta métricas del dashboard, comprueba también la proyección anual y los hitos.
- Añade tests junto a la capa modificada. La suite usa archivos `test/**/*.test.js`.
- Ejecuta `npm run lint:check`, no `npm run lint`, cuando solo quieras verificar sin reescribir archivos.

## Referencias: solo lectura

Todo lo que haya bajo `references/` pertenece a otros proyectos copiados para consultar patrones. Se puede leer para entender arquitectura, Firebase, UI o cálculos, pero nunca se debe:

- editar, borrar, renombrar, mover o formatear contenido de `references/`;
- ejecutar migraciones o actualizaciones de dependencias dentro de esos proyectos;
- importar código de `references/` desde la aplicación activa;
- incluir cambios destinados a esos proyectos en un commit de Cost of Life.

Si una idea resulta útil, reimplémentala dentro de `src/` o `functions/` con los contratos de este proyecto.

## Checklist antes de entregar un cambio

```bash
npm test
npm run lint:check
npm run build
```

Además:

- prueba el flujo afectado con un workspace personal y, si interviene ownership, con uno compartido;
- comprueba permisos y reglas si cambia una ruta de escritura;
- verifica que el año financiero derivado se actualiza, no solo el documento fuente;
- revisa responsive móvil si se modifica una página o navegación;
- actualiza este README en el mismo cambio si varían arquitectura, comandos, esquema, rutas o invariantes.

## Límites y asuntos pendientes conocidos

- La interfaz está únicamente en inglés y la moneda está fijada a EUR.
- No hay conexión cliente configurada a Auth/Firestore/Functions Emulator.
- No hay una estrategia offline implementada; Firestore usa su comportamiento web por defecto.
- La app se construye como SPA web en modo hash. La configuración Quasar conserva secciones de otros targets, pero no demuestra que Electron, PWA, Cordova o Capacitor estén operativos.
- `docs/PRODUCT_VISION.md` contiene fases y decisiones abiertas; no debe usarse como prueba de que una feature existe.
- El historial depende de snapshots `financialYears`; no se reconstruyen años cerrados desde la UI.

Cuando el código y este documento diverjan, corrige ambos en el mismo trabajo: el objetivo es que este README siga siendo el mapa fiable desde el que una persona o un agente pueda continuar el desarrollo.
