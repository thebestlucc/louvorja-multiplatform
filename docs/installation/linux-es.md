# Instalacion de LouvorJA en Linux

## Opcion A: AppImage (recomendado — funciona en cualquier distribucion)

### Descarga

1. Ve a la [pagina de releases](https://github.com/nickksoares/louvorja-multiplataform/releases) y descarga el archivo `.AppImage`.

### Instalar

2. Haz el archivo ejecutable:
   - **Administrador de archivos:** Clic derecho → Propiedades → Permisos → marca "Permitir ejecutar como programa"
   - **Terminal:** `chmod +x LouvorJA_0.1.0_amd64.AppImage`

3. Haz doble clic en el AppImage para ejecutarlo.

4. **Si no pasa nada**, instala las librerias necesarias:
   ```bash
   sudo apt install libwebkit2gtk-4.1-0 libappindicator3-1
   ```

### Primer uso

5. Selecciona tu idioma preferido (Portugues, Ingles o Espanol).

6. Elige **"Comenzar de cero"** o **"Importar de la version Delphi"** si tienes una base de datos existente.

---

## Opcion B: Debian/Ubuntu (paquete .deb)

### Descarga

1. Ve a la [pagina de releases](https://github.com/nickksoares/louvorja-multiplataform/releases) y descarga el archivo `.deb`.

### Instalar

2. Instala con uno de estos metodos:
   - **Doble clic** en el archivo `.deb` para abrirlo en el Centro de Software, luego haz clic en "Instalar"
   - **Terminal:** `sudo dpkg -i LouvorJA_0.1.0_amd64.deb`

3. Si aparecen errores de dependencias en la terminal:
   ```bash
   sudo apt-get install -f
   ```

4. Abre **LouvorJA** desde el menu de aplicaciones.

---

## Verifica tu instalacion

7. Abre la aplicacion y verifica el numero de version en la barra de estado inferior (ej: `v0.1.0`).

## Actualizaciones automaticas

LouvorJA busca actualizaciones automaticamente. Cuando una nueva version este disponible, aparecera una notificacion en la esquina inferior derecha. Durante un servicio, la notificacion se pospone hasta que termine — tu proyeccion nunca sera interrumpida.

## Solucion de problemas

- **AppImage no se ejecuta:** Verifica que es ejecutable (`chmod +x`) y que FUSE esta instalado: `sudo apt install libfuse2`.
- **Librerias faltantes:** Ejecuta `sudo apt install libwebkit2gtk-4.1-0 libappindicator3-1 librsvg2-2`.
- **Necesitas ayuda?** Abre un issue en [github.com/nickksoares/louvorja-multiplataform/issues](https://github.com/nickksoares/louvorja-multiplataform/issues).
