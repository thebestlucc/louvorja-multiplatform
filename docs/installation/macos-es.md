# Instalacion de LouvorJA en macOS

## Descarga

1. Ve a la [pagina de releases](https://github.com/nickksoares/louvorja-multiplataform/releases) y descarga el archivo `.dmg`.
   - Tanto Macs con Apple Silicon (M1/M2/M3/M4) como Intel son compatibles — la version correcta se selecciona automaticamente.

## Instalar

2. Abre el archivo `.dmg` descargado.

3. Arrastra el icono de **LouvorJA** a la carpeta **Aplicaciones**.

4. Abre **LouvorJA** desde la carpeta Aplicaciones (o Launchpad).

5. **Si aparece "LouvorJA no se puede abrir porque es de un desarrollador no identificado":**
   - Esto es normal hasta que se configure la firma digital. La descarga es segura.
   - Abre **Configuracion del Sistema** → **Privacidad y Seguridad**
   - Desplazate hacia abajo y haz clic en **"Abrir de todas formas"** junto al mensaje de LouvorJA
   - Haz clic en **"Abrir"** en el dialogo de confirmacion

## Primer uso

6. Selecciona tu idioma preferido (Portugues, Ingles o Espanol).

7. Elige **"Comenzar de cero"** o **"Importar de la version Delphi"** si tienes una base de datos existente.

## Verifica tu instalacion

8. Verifica el numero de version en la barra de estado inferior (ej: `v0.1.0`).

## Actualizaciones automaticas

LouvorJA busca actualizaciones automaticamente. Cuando una nueva version este disponible, aparecera una notificacion en la esquina inferior derecha. Durante un servicio, la notificacion se pospone hasta que termine — tu proyeccion nunca sera interrumpida.

## Solucion de problemas

- **Error "App esta danada":** Abre Terminal y ejecuta: `xattr -cr /Applications/LouvorJA.app`, luego intenta abrir de nuevo.
- **La app no abre:** Asegurate de tener macOS 11 (Big Sur) o superior.
- **Necesitas ayuda?** Abre un issue en [github.com/nickksoares/louvorja-multiplataform/issues](https://github.com/nickksoares/louvorja-multiplataform/issues).
