# Pokédex — Ionic + Angular + TensorFlow.js

Pokédex móvil (Android e iOS) de la primera generación con reconocimiento de imágenes en el dispositivo
y una "realidad aumentada" básica.

- **Lista** de los 151 Pokémon con búsqueda por nombre o número, skeletons y reintento ante errores.
- **Detalle**: imagen, tipos (chips de color), descripción en español, estadísticas base y 15 ataques.
- **Escáner**: video en vivo de la cámara trasera; reconoce **Bulbasaur, Charmander y Squirtle**
  con MobileNet + KNN, todo en el dispositivo y sin backend.
- **AR básica**: al reconocer un Pokémon aparece sobre el video una tarjeta animada con sprite, nombre,
  tipos, la primera frase de su descripción y el botón "Ver en Pokédex".

## Diseño

- Tipografía **Plus Jakarta Sans** (empaquetada con `@fontsource-variable`, funciona sin conexión).
- Tokens de color en `src/theme/variables.scss` (`--app-*`) con **modo oscuro automático** según el sistema.
- **Inicio**: cabecera grande, buscador tipo píldora, filtros por tipo con scroll horizontal y tarjetas
  coloreadas según el tipo principal, con pokébola de marca de agua. Los tipos de los 151 se obtienen con los
  18 endpoints `/type/{nombre}`, no con 151 peticiones a `/pokemon/{id}`.
- **Detalle**: cabecera a todo color con la ilustración flotante sobre una hoja inferior redondeada y
  pestañas *Información / Estadísticas / Ataques*. Las barras de estadísticas se animan y usan el color del tipo.
- **Escáner**: cabecera transparente sobre la cámara, marco con esquinas y línea de escaneo animada,
  avisos con efecto vidrio (*glassmorphism*) y una tarjeta AR con brillo holográfico y barra de coincidencia.

## Stack

| Pieza | Versión |
| --- | --- |
| Angular (standalone + signals, sin zone.js) | 22 |
| Ionic Framework | 9 |
| Capacitor (+ `@capacitor/camera`) | 8 |
| TensorFlow.js (`tfjs-core`, `tfjs-converter`, backends WebGL y CPU) | 4.22 |
| `@tensorflow-models/mobilenet` / `@tensorflow-models/knn-classifier` | 2.1 / 1.2 |
| Datos | [PokeAPI](https://pokeapi.co/api/v2/) |

## Estructura

```
scripts/download-training-images.mjs   Descarga imágenes de entrenamiento + MobileNet
src/app/
  models/        Interfaces de PokeAPI, del dominio y del reconocimiento (sin `any`)
  services/      pokemon.service.ts (PokeAPI + caché), recognition.service.ts (MobileNet + KNN)
  pages/         home, pokemon-detail, scanner
  components/    pokemon-card, type-chip, ar-overlay
  utils/         formato, colores de tipos, data augmentation, caché IndexedDB
src/assets/
  training/      Imágenes por clase + manifest.json (generado por el script)
  models/mobilenet/  MobileNet v2 (generado por el script)
android/  ios/   Proyectos nativos de Capacitor
```

## Instalación

Requisitos: Node 20+ (probado con Node 24) y npm.

```bash
npm install
npm run training      # descarga imágenes de entrenamiento y MobileNet (ya incluidas en el repo)
```

## Ejecutar en el navegador

```bash
npx ionic serve        # http://localhost:8100  (o: npm start → http://localhost:4200)
```

- La cámara en vivo funciona en `localhost` o HTTPS. Si no hay cámara, el botón de captura abre un
  selector de archivos y el botón de galería permite elegir una imagen.
- La primera vez que se abre el escáner el modelo se "entrena" (genera ~2000 vectores de características):
  tarda entre 30 y 60 s en un portátil. Los vectores se guardan en IndexedDB, así que las siguientes veces
  el escáner está listo en unos segundos.

## Android (Android Studio)

Requisitos: Android Studio con Android SDK y JDK 21.

```bash
npx ionic build        # o: npx ng build
npx cap sync android
npx cap open android   # abre Android Studio → Run
```

Permisos declarados en `android/app/src/main/AndroidManifest.xml`: `CAMERA` y lectura/escritura de
almacenamiento solo para Android ≤ 12 (en 13+ la galería usa el selector de fotos del sistema).
El video en vivo funciona dentro del WebView porque el `BridgeWebChromeClient` de Capacitor convierte la
petición de `getUserMedia` en el permiso de ejecución `CAMERA`, y `androidScheme: 'https'` en
`capacitor.config.ts` da un contexto seguro.

## iOS (Xcode, requiere macOS)

```bash
npx ionic build
npx cap sync ios
npx cap open ios       # abre Xcode → elige tu equipo de firma → Run
```

`ios/App/App/Info.plist` incluye `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` y
`NSPhotoLibraryAddUsageDescription` con textos en español. Capacitor configura el `WKWebView` con
`allowsInlineMediaPlayback` y gestiona el permiso de captura de medios, y el `<video>` usa
`playsinline` + `muted`, así que `getUserMedia` funciona en iOS 14.5+.

## Cómo funciona el reconocimiento

1. **Datos** — `scripts/download-training-images.mjs`:
   - Para cada ID de `TARGET_IDS` descarga **todas** las variantes de `sprites` de PokeAPI
     (official-artwork, home, dream_world, front/back de cada versión de juego, shiny). Se omiten los gifs
     animados/showdown y los duplicados `_gray`/`_transparent` → 79 imágenes por starter.
   - **Clases negativas** (`pokemonId: null`, la app responde "No reconocido"):
     - una clase por cada **evolución** de los objetivos (Ivysaur, Venusaur, Charmeleon…), obtenidas de la
       cadena evolutiva; son los falsos positivos más probables;
     - la clase `desconocido` con 15 Pokémon aleatorios de la Gen 1 (semilla fija, reproducible).
   - Escribe `src/assets/training/manifest.json` y descarga MobileNet v2 a `src/assets/models/mobilenet`.
2. **Entrenamiento** (en el dispositivo, `RecognitionService.init()`, una sola vez por sesión):
   - MobileNet v2 se carga desde los assets y se usa como extractor de características (embedding de 1280).
   - Cada imagen se aumenta con canvas: fondos de color, rotaciones de ±12°, escalas/recortes, brillo,
     contraste y ruido (manipulando píxeles, porque `ctx.filter` no existe en todos los WebView de iOS).
   - Cada clase recibe 200 ejemplos; el 60 % se asigna a las ilustraciones grandes, que se parecen más a
     una foto de una pantalla o un papel que los sprites pixel-art.
   - Los vectores se guardan en IndexedDB (se invalidan si cambia el manifest).
3. **Predicción** — `predict(imagen)` devuelve `{ pokemon, pokemonId, confianza, reconocido, scores }`:
   - Recorte cuadrado central y KNN con k = 10 (confianza = votos / k), promediando el recorte completo y
     uno del 80 % (test-time augmentation).
   - Si la clase ganadora es negativa o la confianza es menor que el umbral (**0.7** por defecto), responde
     "No reconocido".
   - En el escáner solo se analiza la zona del recuadro guía.

### Cambiar el umbral

```ts
// main.ts
providers: [{ provide: RECOGNITION_THRESHOLD, useValue: 0.6 }]
// o en tiempo de ejecución
inject(RecognitionService).threshold.set(0.6);
```

## Agregar un Pokémon al reconocimiento

1. Añade su ID a `TARGET_IDS` en `scripts/download-training-images.mjs`, por ejemplo `[1, 4, 7, 25]`.
2. Ejecuta `npm run training`.
3. Vuelve a compilar (`npx ionic build && npx cap sync`).

No hay que tocar código Angular: la app lee las clases del `manifest.json`, y la caché de IndexedDB se
invalida sola porque cambia la fecha del manifest. Sus evoluciones se añaden automáticamente como clases
negativas.

## Pruebas de reconocimiento

Con ilustraciones que no están en el entrenamiento (el arte de las cartas del Base Set):

| Imagen | Resultado |
| --- | --- |
| Bulbasaur | Bulbasaur 80 % |
| Charmander | Charmander 80 % |
| Squirtle | Squirtle 90 % |
| Pikachu, Ivysaur | No reconocido |
| Charmeleon | Charmander 80 % (falso positivo) |
| Carta completa (con marco y texto) | Casi siempre "No reconocido" |

## Decisiones técnicas

- **`tfjs-core` + `tfjs-converter` + backends** en lugar del paquete `@tensorflow/tfjs`: este arrastra
  `tfjs-data`, que importa módulos de Node (`buffer`) y rompe el build de Angular. Además pesa menos.
- **MobileNet empaquetado en `assets`** (14 MB) en lugar de descargarlo de TF Hub en tiempo de ejecución:
  el reconocimiento funciona sin conexión y no depende de las redirecciones de tfhub.dev a Kaggle.
- **Captura = fotograma del video en vivo** (recortado al recuadro guía). `@capacitor/camera` se usa para
  la galería (`chooseFromGallery`) y como alternativa si `getUserMedia` no está disponible (`takePhoto`).
  Se usan estas APIs porque `getPhoto` está obsoleto en la versión 8 del plugin.
- **Ataques**: los 15 primeros aprendidos por nivel (ordenados por nivel), luego el resto; nombre en
  español si existe.
- **Nombres y descripciones**: español si existe y, si no, inglés; se usa la entrada más reciente.
- **Caché de PokeAPI** en memoria (un `Map` de promesas por URL, que deduplica peticiones en vuelo y
  elimina las fallidas para poder reintentar).
- **Tarjeta AR**: capa HTML/CSS con `animate.enter`/`animate.leave` de Angular (fade + scale); sin 3D ni
  anclaje espacial.
- **Imágenes de entrenamiento versionadas** en `src/assets` para que el proyecto compile sin red; el script
  las regenera.

## Limitaciones conocidas

- **Pokémon parecidos**: Charmeleon puede confundirse con Charmander aunque esté como clase negativa.
  KNN sobre MobileNet distingue bien formas generales, pero no detalles finos. Para mejorar habría que
  entrenar un clasificador (por ejemplo, transfer learning con una capa densa) o añadir fotos reales.
- **Encuadre**: funciona mucho mejor si el Pokémon llena el recuadro guía. Una carta completa o una pantalla
  con mucha interfaz alrededor suele dar "No reconocido".
- **Primer arranque del escáner**: 30–60 s para generar los vectores (luego quedan en caché). En móviles
  sin WebGL se usa el backend CPU y es bastante más lento.
- **Tamaño**: los assets suman ~31 MB (14 MB de MobileNet + 17 MB de imágenes de entrenamiento), que se
  incluyen en el APK/IPA.
- **Conexión**: la lista, el detalle y los datos de la tarjeta AR vienen de PokeAPI. Sin red el
  reconocimiento sigue funcionando, pero solo muestra el resultado en texto.
- Los datos de PokeAPI solo se cachean en memoria: se vuelven a pedir al reiniciar la app.
