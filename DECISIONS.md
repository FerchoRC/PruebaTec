# Decisiones técnicas

## 1. Backend: Node.js + Express

Elegí Node por dos razones:

- Un solo lenguaje en todo el repositorio. Frontend y backend comparten
  JavaScript y las mismas herramientas (ESLint, Vitest), así que hay la mitad de
  configuración.
- La imagen queda pequeña y arranca en poco tiempo, que es importante porque
  el pipeline levanta la aplicación en cada ejecución.

Dentro de Node usé Express es un framework sencillo de configurar y para este proyecto es suficiente.

## 2. Base de datos: PostgreSQL

Los datos son relacionales: una promoción apunta a un producto o a una
categoría, y un producto pertenece a una categoría. Eso son claves foráneas.

Además Postgres me deja llevar las reglas hasta el motor, no hay necesidad de usar un ORM.

Las validaciones están en el dominio, que es donde puedo dar mensajes útiles al
usuario. Las restricciones cubren lo que entre por otra vía: un script, una consulta manual.

Usé tres tablas (`categories`, `products`, `promotions`) en vez del mínimo
de dos, porque el catálogo hace falta para que "producto o categoría asociada"
sea una clave foránea y no un campo de texto libre.

El esquema se aplica con `docker-entrypoint-initdb.d`, que Postgres ejecuta la
primera vez que el volumen está vacío. Para un esquema que todavía no cambia,
una herramienta de migraciones sería una dependencia más sin nada que aportar.

---

## 3. Frontend: React + Vite, sin nada más

React y Vite eran obligatorios. Lo que decidí yo fue no añadir nada encima:

- **Sin router**: es una sola pantalla.
- **Sin librería de estado**: hay un listado, un resumen y un formulario.
  `useState` y una función `refresh()` que recarga listado y resumen a la vez
  bastan, y así los contadores nunca se desincronizan de la tabla.
- **Sin React Query**: con dos peticiones de lectura, el `useEffect` inicial es
  más corto que su configuración.
- **Sin framework de CSS**: unas 300 líneas con variables cubren toda la
  interfaz. Tailwind o MUI harían el bundle mucho más grande para un formulario
  y una tabla.

**Valido en cliente y en servidor a propósito.** El servidor es la autoridad,
porque el navegador no es de fiar. Pero repetir las reglas en el cliente evita
un viaje de red para decir algo que ya sé. El formulario también pinta los
errores por campo que devuelve la API, así el mensaje es el mismo venga de
donde venga.

---

## 4. Arquitectura del backend

Cuatro capas, cada una con una responsabilidad:

```
routes/        HTTP: lee la petición y arma la respuesta
domain/        Reglas de negocio. Sin Express, sin SQL, sin relojes
repositories/  Lo único que toca SQL
db/ config/    Pool de conexiones y configuración validada
```

Lo importante está en `domain/promotion.js`: las validaciones, la máquina de
estados y el cálculo de vigencia son funciones puras. Por eso puedo probarlas
en milisegundos sin base de datos.

`createApp()` recibe el pool (o los repositorios) por parámetro en vez de
importarlos. Eso me deja montar la aplicación completa en los tests con un
repositorio en memoria y probar rutas, validación y errores **sin levantar
Postgres**, que es la razón de que la etapa `test` del pipeline no necesite
ningún servicio.

Los errores están centralizados: el dominio lanza `ValidationError` con su
código HTTP y el detalle por campo, y un middleware los traduce. Las rutas no
tienen ni un `try/catch`.

**Las fechas son días de calendario, no instantes.** El driver `pg` convierte
las columnas `DATE` a `Date` en la zona local, lo que desplaza el día en
servidores al oeste de UTC. Desactivo ese conversor en `db/pool.js`. En el
cliente hago lo mismo: formateo partiendo la cadena, sin pasar por `Date`.

---

## 5. Docker

- **Multi-etapa en las dos imágenes.** El backend instala con
  `npm ci --omit=dev` y copia solo `node_modules` y `src`, así que no lleva
  ESLint ni Vitest. El frontend compila con Node y sirve desde `nginx:alpine`;
  la imagen final no lleva Node.
- **Nginx hace de proxy a `/api` y `/health`.** El navegador habla con un solo
  origen, así que no hay CORS en producción ni ninguna URL de backend metida en
  el bundle.
- **`depends_on` con `condition: service_healthy`.** Sin esto el backend
  intentaría conectarse a un Postgres que todavía está inicializándose. Los tres
  servicios tienen `healthcheck`, lo que le da al pipeline una señal fiable en
  vez de un `sleep 30`.
- **Nombres de imagen fijos**, sobreescribibles por variable. Así el pipeline
  construye las imágenes en una etapa y el smoke test prueba **esas mismas** en
  la siguiente, en vez de recompilar algo que podría ser distinto.
- El backend corre como el usuario `node`, no como root.

---

## 6. Manejo de secretos

No hay ninguna credencial en el repositorio. Puse tres barreras, porque una sola
es una que alguien se salta:

1. `docker-compose.yml` usa `${POSTGRES_PASSWORD:?mensaje}`. Compose aborta
   antes de crear nada y dice qué falta.
2. `scripts/check-env.sh` verifica las obligatorias y avisa de las que están en
   `.env.example` pero no en tu `.env`, que es la causa típica del "a mí me
   funciona".
3. El backend valida su configuración al arrancar y sale con código 1 nombrando
   la variable, en vez de morir después contra la base de datos.

En el pipeline, `POSTGRES_PASSWORD` viene de GitHub Secrets **sin valor por
defecto**: si falta, el flujo se detiene. `POSTGRES_USER` y `POSTGRES_DB` sí
tienen fallback porque no son secretos, son nombres.

---

## 7. Pipeline

`lint` → `test` → `build` → `smoke-test`, encadenadas con `needs`. El orden va
de menor a mayor coste: ESLint tarda segundos y el smoke test levanta tres
contenedores. Quiero fallar en la etapa más barata posible.

- `lint` y `test` usan una matriz sobre backend y frontend con
  `fail-fast: false`, para ver los dos problemas en la misma ejecución y no de
  uno en uno.
- `build` exporta las imágenes como artefactos y `smoke-test` las carga.
  Reconstruirlas sería más fácil de escribir, pero entonces estaría probando una
  compilación distinta de la que validé.
- El smoke test no se conforma con un `200` en `/health`: comprueba que la
  respuesta diga `"database": "up"`, que el catálogo devuelva datos (prueba de
  que la semilla se aplicó) y que el proxy del frontend responda.
- Si algo falla, un paso vuelca los logs de los contenedores para no tener que
  reproducirlo en local.

---

## 8. Qué haría distinto con más alcance

Cosas que están bien para esta prueba y no lo estarían en un producto real:

- **TypeScript** en los dos paquetes, con tipos compartidos para el contrato de
  la API.
- **Migraciones versionadas** en vez de `init.sql`, en cuanto el esquema tenga
  que cambiar sin borrar el volumen.
- **Autenticación**: hoy cualquiera puede crear promociones.
- **Transición automática de estados** con un job programado, para que una
  promoción pase a `Activa` al llegar su fecha de inicio. El enunciado pedía el
  cambio manual, y `assertStatusTransition()` ya sería el único punto por donde
  tendría que pasar ese job.
- **Paginación y filtros** en el listado. Con cientos de promociones, traerlas
  todas y contar en memoria deja de tener sentido: el resumen pasaría a
  calcularse con un `GROUP BY`.
- **Logs estructurados** con identificador de petición, en vez de `console.log`.
