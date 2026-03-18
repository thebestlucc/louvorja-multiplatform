================================================
FILE: README.md
================================================
# 🎵 LouvorJA

Sistema web do software LouvorJA. Conheça o projeto em <https://louvorja.com.br>.

---

## 📌 Sobre o Projeto

O **LouvorJA** é uma aplicação SPA desenvolvida com Vue 3 e Vuetify 4, estruturada em módulos independentes, permitindo expansão e personalização de funcionalidades como:

- 📖 Bíblia
- 🎶 Hinários
- 🎼 Músicas
- 🎞 Mídia
- 🕒 Relógio
- 🎬 Animações
- 🎨 Temas
- 📚 Coleções

O sistema foi projetado com uma arquitetura modular escalável.

---

## 🚀 Tecnologias Utilizadas

- Vue 3
- Vite
- Vuetify 4
- Vue Router
- Vuex
- Vue I18n
- Vite PWA Plugin
- SASS

---

## 📦 Instalação e Execução

### Pré-requisitos

- [Node.js 18+](https://nodejs.org/pt-br/download)
- [NPM 9+](https://www.npmjs.com/)

### Instalação

#### Clonar o repositório

```bash
git clone https://github.com/louvorja/app
cd app
```

#### Instalar dependências

```bash
npm install
```

### Execução e Compilação

#### Rodar em modo desenvolvimento

```bash
npm run dev
```

#### Build para produção

```bash
npm run build
```

#### Preview da build

```bash
npm run serve
```

***Obs.:** Para executar este comando, é necessário ter rodado a build primeiro.*

---

## 📂 Estrutura de Pastas

```bash
src/
 ├── assets/          # Fontes, estilos e recursos estáticos
 ├── components/      # Componentes reutilizáveis globais
 ├── helpers/         # Utilitários e classes auxiliares
 ├── helpers/         # Arquivos de tradução global
 ├── layout/          # Componentes estruturais (Header, Menu, Footer, etc.)
 ├── modules/         # Módulos da aplicação (músicas, utilitários, bíblia, ...)
 ├── plugins/         # Plugins da aplicação
 ├── router/          # Configuração de rotas
 ├── store/           # Vuex (state, actions, mutations, getters)
 ├── views/           # Views principais (Main para a aplicação, Popup para janela externa)
 ├── i18n.js          # Configuração de internacionalização
 └── main.js          # Entry point da aplicação
 ```

---

## 🧩 Módulos

### Arquitetura Modular

#### Estrutura de Pastas do Módulo

Cada módulo possui:

```bash
module/
 ├── index.js
 ├── manifest.json
 ├── interface/
 ├── components/
 └── lang/
 ```

#### Estrutura Padrão de Módulo

- index.js → Ponto de entrada do módulo
- manifest.json → Metadados
- interface/ → Interface do módulo
- lang/ → Traduções específicas
- components/ → Componentes internos

Isso permite:

- Extensão fácil
- Separação de responsabilidades
- Manutenção simplificada

#### Internacionalização

Dentro de cada módulo, as traduções devem ser colocadas dentro da pasta *src/modules/\*/lang/*

---

## 🧩 Internacionalização

Idiomas suportados:

- 🇧🇷 Português
- 🇪🇸 Espanhol

Arquivos localizados em:

```bash
src/lang/
src/modules/*/lang/
```

---

## 🎨 UI & Layout

- Baseado em Vuetify 4
- Layout com sistema de janelas



================================================
FILE: babel.config.js
================================================
module.exports = {
  presets: [
    '@vue/cli-plugin-babel/preset'
  ]
}



================================================
FILE: index.html
================================================
<!DOCTYPE html>
<html class="notranslate" translate="no">

<head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/ico/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="google" content="notranslate">
    <title>LouvorJA</title>
</head>

<body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
</body>

</html>


================================================
FILE: jsconfig.json
================================================
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "baseUrl": "./",
    "moduleResolution": "node",
    "paths": {
      "@/*": [
        "src/*"
      ]
    },
    "lib": [
      "esnext",
      "dom",
      "dom.iterable",
      "scripthost"
    ]
  }
}



================================================
FILE: package.json
================================================
{
  "name": "louvorja",
  "version": "1.26.0",
  "private": true,
  "scripts": {
    "version:major": "npm version major",
    "version:minor": "npm version minor",
    "version:patch": "npm version patch",
    "version:max": "npm version major",
    "version:min": "npm version minor",
    "version:bug": "npm version patch",
    "serve": "vite preview",
    "build": "vite build",
    "lint": "eslint .",
    "dev": "vite",
    "host": "vite --host",
    "files": "node node/server.js",
    "git:tag": "git tag -a -f v%npm_package_version% -m \"Versão %npm_package_version%\" && git push origin -f v%npm_package_version% && git push -u origin main"
  },
  "dependencies": {
    "@mdi/font": "^7.4.47",
    "archiver": "^7.0.1",
    "basic-ftp": "^5.0.5",
    "core-js": "^3.40.0",
    "dotenv": "^17.3.1",
    "fs-extra": "^11.2.0",
    "roboto-fontface": "*",
    "vue": "^3.5.29",
    "vue-country-flag-next": "^2.3.2",
    "vue-fullscreen": "^3.1.3",
    "vue-i18n": "^11.2.8",
    "vue-json-pretty": "^2.4.0",
    "vue-router": "^5.0.3",
    "vue3-shortkey": "^4.0.0",
    "vuedraggable": "^4.1.0",
    "vuetify": "^4.0.0",
    "vuex": "^4.0.2",
    "webfontloader": "^1.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.4",
    "eslint": "^9.39.3",
    "eslint-plugin-vue": "^9.33.0",
    "sass": "^1.83.0",
    "vite": "^7.3.1",
    "vite-plugin-pwa": "^1.2.0",
    "vite-plugin-vuetify": "^2.1.3"
  },
  "eslintConfig": {
    "root": true,
    "env": {
      "node": true
    },
    "extends": [
      "plugin:vue/vue3-essential",
      "eslint:recommended"
    ],
    "rules": {}
  },
  "browserslist": [
    "> 1%",
    "last 2 versions",
    "not dead",
    "not ie 11"
  ]
}



================================================
FILE: vite.config.js
================================================
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { VitePWA } from "vite-plugin-pwa";

const path = require("path");

// https://vitejs.dev/config/
export default ({ mode }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  return defineConfig({
    base: process.env.VITE_BASE_URL ?? "/",
    plugins: [
      vue(),
      // https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vite-plugin
      vuetify({
        autoImport: true,
      }),
      VitePWA({
        registerType: "autoUpdate", // Registra o Service Worker para atualizar automaticamente
        devOptions: {
          enabled: true, // Ativa o PWA também durante o desenvolvimento
        },
        workbox: {
          globPatterns: ["**/*.{html,js,css,svg,png}"], // Arquivos que o Service Worker deve cachear
        },
        manifest: {
          name: "LouvorJA",
          short_name: "LouvorJA",
          description: "Software de músicas para Louvor e Adoração",
          start_url: process.env.VITE_BASE_URL ?? "/",
          display: "standalone",
          background_color: "#000000",
          theme_color: "#000000",
          icons: [
            {
              src: (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-16x16.png",
              sizes: "16x16",
              type: "image/png",
            },
            {
              src: (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-32x32.png",
              sizes: "32x32",
              type: "image/png",
            },
            {
              src:
                (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-144x144.png",
              sizes: "144x144",
              type: "image/png",
            },
            {
              src:
                (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-152x152.png",
              sizes: "152x152",
              type: "image/png",
            },
            {
              src:
                (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-180x180.png",
              sizes: "180x180",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    define: {
      "process.env": {},
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "true",
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5002,
    },
    /* remove the need to specify .vue files https://vitejs.dev/config/#resolve-extensions
  resolve: {
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ]
  },
  */
  });
};



================================================
FILE: .env.production
================================================
VITE_APP_MODE=production
VITE_URL_FILES=https://api.louvorja.com.br/file
VITE_URL_DATABASE=https://api.louvorja.com.br/json_db
VITE_API_TOKEN=02@v2nFB2Dc



================================================
FILE: dist-mobile/config.xml
================================================
<?xml version='1.0' encoding='utf-8'?>
<widget id="com.louvorja.app" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>LouvorJA</name>
    <description>Sample Apache Cordova App</description>
    <author email="dev@cordova.apache.org" href="https://cordova.apache.org">
        Apache Cordova Team
    </author>
    <content src="index.html" />
    <allow-intent href="http://*/*" />
    <allow-intent href="https://*/*" />
</widget>



================================================
FILE: dist-mobile/package.json
================================================
{
  "name": "com.louvorja.app",
  "displayName": "LouvorJA",
  "version": "1.0.0",
  "description": "A sample Apache Cordova application that responds to the deviceready event.",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "ecosystem:cordova"
  ],
  "author": "Apache Cordova Team",
  "license": "Apache-2.0",
  "devDependencies": {
    "cordova-android": "^13.0.0",
    "cordova-ios": "^7.1.1"
  },
  "cordova": {
    "platforms": [
      "android",
      "ios"
    ]
  }
}


================================================
FILE: docs/architecture.md
================================================
# 🏗 Arquitetura do Sistema

## 📌 Visão Geral

O LouvorJA é uma SPA baseada em Vue 3 com arquitetura modular dinâmica.

A aplicação é composta por:

- Core (App, Router, Store, Plugins)
- Layout System (Window / Popup)
- Module Loader
- Vuex Global Store
- Sistema de Internacionalização
- Sistema de Plugins

---

## 🧠 Diagrama de Arquitetura

```bash
            ┌─────────────────────┐
            │     main.js         │
            └──────────┬──────────┘
                       │
                  ┌────▼────┐
                  │ App.vue │
                  └────┬────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
      ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
      │ Router  │ │  Store  │ │ Plugins │
      └────┬────┘ └────┬────┘ └────┬────┘
           │           │           │
           └───────────┼───────────┘
                       │
                 ┌─────▼─────┐
                 │  Modules  │
                 └─────┬─────┘
                       │
               ┌───────▼───────┐
               │ UI Components │
               └───────────────┘
```

---

## 🧩 Arquitetura Modular

Cada módulo é isolado e possui:

- Entrada (`index.js`)
- Manifesto (`manifest.json`)
- Interface própria
- Componentes internos
- Traduções independentes

### Fluxo de Carregamento

1. Sistema detecta módulos em `/modules`
2. Lê `manifest.json`
3. Registra módulo
4. Injeta no menu/interface
5. Permite uso via Store e Router

---

## 🔄 Gerenciamento de Estado

Utiliza Vuex para:

- Estado global
- Comunicação entre módulos
- Controle de janelas
- Player e mídia

---

## 🌎 Internacionalização

Sistema baseado em Vue I18n:

- Tradução global em `/src/lang`
- Tradução por módulo em `/src/modules/*/lang`



================================================
FILE: docs/creating-modules.md
================================================
# 🧩 Criando Novos Módulos

## 📁 Estrutura Base

Crie uma pasta dentro de:

```bash
src/modules/NomeDoModulo/
```

Estrutura mínima:

```bash
NomeDoModulo/
├── index.js
├── manifest.json
├── interface/
├── components/
└── lang/
```

---

## 📄 manifest.json

Define metadados do módulo:

```json
{
  "name": "Nome do Módulo",
  "icon": "mdi-star"
}
```

## 📄 index.js

Responsável por registrar o módulo:

```javascript
export default {
  install(app) {
    console.log("Módulo carregado")
  }
}
```

---

## 🖥 Interface

Coloque os componentes principais dentro de:

```bash
interface/
```

Exemplo:

```bash
interface/Main.vue
```

---

🌎 Traduções

Dentro de:

```bash
lang/pt.json
lang/es.json
interface/Main.vue
```



================================================
FILE: node/server.js
================================================
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = 7070;
const DIRECTORY = path.join(__dirname, "..", "files"); // Pasta a ser servida

// Função para adicionar cabeçalhos CORS
const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Permitir todas as origens
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); // Métodos permitidos
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, api-token"); // Cabeçalhos permitidos
  //res.setHeader("Content-Type", "text/html; charset=utf-8");
};

// Função para lidar com as requisições
const requestHandler = (req, res) => {
  // Lidar com requisições OPTIONS (pré-flight CORS)
  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204); // Sem conteúdo
    res.end();
    return;
  }

  // Adicionar cabeçalhos CORS para outras requisições
  setCorsHeaders(res);

  let filePath = path.join(
    DIRECTORY,
    decodeURIComponent(req.url).split("?")[0]
  );
  console.log("Diretório", filePath);

  // Impede acesso a diretórios fora da pasta "files"
  if (!filePath.startsWith(DIRECTORY)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Acesso negado");
    return;
  }

  const parts = filePath.split("\\");
  const dir = parts[parts.length - 2];
  if (dir == "database") {
    if (!filePath.endsWith(".json")) {
      filePath = filePath + ".json";
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Arquivo nao encontrado");
      return;
    }

    if (stats.isDirectory()) {
      fs.readdir(filePath, { encoding: "utf8" }, (err, files) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Erro ao ler diretorio");
          return;
        }

        const list = files
          .map(
            (file) =>
              `<li><a href="${path.join(
                req.url,
                encodeURIComponent(file)
              )}">${file}</a></li>`
          )
          .join("");
        const html = `
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Arquivos em ${req.url}</title>
            </head>
            <body>
              <h1>Arquivos em ${req.url}</h1>
              <ul>${list}</ul>
            </body>
          </html>
        `;
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      });
      return;
    }

    // Serve o arquivo
    const stream = fs.createReadStream(filePath);
    res.writeHead(200);
    stream.pipe(res);
    stream.on("error", () => {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Erro interno no servidor");
    });
  });
};

// Cria o servidor HTTP
const server = http.createServer(requestHandler);

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});



================================================
FILE: public/.htaccess
================================================
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule (.*) https://%{HTTP_HOST}%{REQUEST_URI} [R,L]
    RewriteRule ^\.git - [F,L]

    # Redireciona tudo para o index.html, exceto se for um arquivo ou diretório existente
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [L]
</IfModule>

# Adiciona Cache-Control para melhorar o desempenho
<IfModule mod_headers.c>
    <FilesMatch "\.(ico|jpg|jpeg|png|gif|js|css|woff|woff2|ttf|svg|eot|otf|webp|mp4|avi|mov|mkv|webm)$">
        Header set Cache-Control "max-age=31536000, public"
    </FilesMatch>
</IfModule>

# Adiciona ErrorDocuments
ErrorDocument 403 /403.shtml
ErrorDocument 404 /404.shtml
ErrorDocument 500 /500.shtml



================================================
FILE: src/App.vue
================================================
<template>
  <AppLoading />
  <v-btn
    v-show="false"
    @shortkey="handleKeydown()"
    v-shortkey="['ctrl', 'alt', 'd']"
  />
  <v-app id="app-container">
    <router-view />
  </v-app>
</template>

<script>
import AppLoading from "@/layout/Loading.vue";

export default {
  name: "App",
  components: {
    AppLoading,
  },
  methods: {
    handleKeydown() {
      console.log("click ");
      //if (event.shiftKey && event.key === "A") {
      this.$dev.toogle();
      //}
    },
  },
};
</script>

<style>
#app-container > div {
  height: 100vh;
}
</style>



================================================
FILE: src/i18n.js
================================================
import { createI18n } from "vue-i18n";

const loadLocaleMessages = async () => {
  const locales = ["pt", "es"];
  const messages = {};

  for (const locale of locales) {
    messages[locale] = await import(`./lang/${locale}.json`);
  }

  return messages;
};

export const createI18nInstance = async () => {
  const messages = await loadLocaleMessages();

  return createI18n({
    legacy: false, // Usando a API Composition
    locale: "pt", // Idioma padrão
    fallbackLocale: "pt", // Idioma de fallback
    messages, // Carregar as mensagens
  });
};

// export default i18n;
export default createI18nInstance;



================================================
FILE: src/main.js
================================================
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import vuetify from "./plugins/vuetify";
import store from "./store";
import { loadFonts } from "./plugins/webfontloader";
import { createI18nInstance } from "./i18n";
import shortkey from "vue3-shortkey";
import VueFullscreen from "vue-fullscreen";
import "./assets/styles/main.css";
import "./assets/styles/fonts.css";
import "./assets/styles/layout.scss";

loadFonts();

const app = createApp(App);

//Modules
import ModuleManager from "@/helpers/ModuleManager";

//Helpers
import Modules from "@/helpers/Modules";
import Dev from "@/helpers/Dev";
import String from "@/helpers/String";
import UserData from "@/helpers/UserData";
import AppData from "@/helpers/AppData";
import DateTime from "@/helpers/DateTime";
import Theme from "@/helpers/Theme";
import Path from "@/helpers/Path";
import Media from "@/helpers/Media";
import Alert from "@/helpers/Alert";
import Popup from "@/helpers/Popup";
import Database from "@/helpers/Database";
app.mixin({
  beforeCreate() {
    this.$userdata = UserData;
    this.$appdata = AppData;
    this.$modules = Modules;
    this.$dev = Dev;
    this.$string = String;
    this.$datetime = DateTime;
    this.$theme = Theme;
    this.$path = Path;
    this.$media = Media;
    this.$alert = Alert;
    this.$popup = Popup;
    this.$database = Database;
  },
});

app.use(router);
app.use(vuetify);
app.use(store);
app.use(shortkey, { prevent: ["input", "textarea"] });
app.use(VueFullscreen);

createI18nInstance().then((i18n) => {
  app.use(i18n);
  ModuleManager.init(i18n);
  app.mount("#app");
});



================================================
FILE: src/assets/fonts/din-condensed-bold.ttf
================================================
[Binary file]


================================================
FILE: src/assets/styles/fonts.css
================================================
@font-face {
  font-family: "DINCondensedBold";
  src: url("../fonts/din-condensed-bold.ttf") format("truetype");
  font-weight: bold;
  font-style: normal;
}


================================================
FILE: src/assets/styles/layout.scss
================================================
@for $i from 1 through 10 {
  .w-#{$i * 10} {
    width: $i * 10% !important;
  }
}



================================================
FILE: src/assets/styles/main.css
================================================
@font-face {
    font-family: "DINCondensedBold";
    src: url("@/assets/fonts/din-condensed-bold.ttf") format("truetype");
    font-weight: bold;
    font-style: normal;
}


html,
body {
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* SCROLL */
*::-webkit-scrollbar {
    height: 8px;
    width: 8px;
}

*::-webkit-scrollbar-track {
    border-radius: 8px;
    background-color: #f3f3f3;
}

*::-webkit-scrollbar-track:hover {
    background-color: #efefef;
}

*::-webkit-scrollbar-track:active {
    background-color: #e7e7e7;
}

*::-webkit-scrollbar-thumb {
    border-radius: 5px;
    background-color: #dedede;
}

*::-webkit-scrollbar-thumb:hover {
    background-color: #d2d2d2;
}

*::-webkit-scrollbar-thumb:active {
    background-color: #a6a6a6;
}

/* SCROLL DARK */
.v-theme--dark *::-webkit-scrollbar-track {
    background-color: #1a1919;
}

.v-theme--dark *::-webkit-scrollbar-track:hover {
    background-color: #141414;
}

.v-theme--dark *::-webkit-scrollbar-track:active {
    background-color: #0f0f0f;
}

.v-theme--dark *::-webkit-scrollbar-thumb {
    background-color: #111010;
}

.v-theme--dark *::-webkit-scrollbar-thumb:hover {
    background-color: #0c0b0b;
}

.v-theme--dark *::-webkit-scrollbar-thumb:active {
    background-color: #030303;
}

.no-select {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}


================================================
FILE: src/components/CustomizationBar.vue
================================================
<template>
  <v-bottom-sheet>
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn
        class="ms-2"
        icon="mdi-palette"
        variant="text"
        size="small"
        v-bind="activatorProps"
      />
    </template>

    <v-card>
      <slot />
    </v-card>
  </v-bottom-sheet>
</template>

<script>
export default {
  name: "CustomizationBarComponent",
};
</script>



================================================
FILE: src/components/CustomizationTools.vue
================================================
<template>
  <v-slide-group show-arrows class="__customization_tools px-1">
    <!-- BLOCOS -->
    <v-slide-group-item
      v-for="(block, indx_block) in menu_items"
      :key="indx_block"
    >
      <v-divider v-if="indx_block > 0" vertical class="mx-1" />
      <v-card flat class="d-flex flex-column pt-2">
        <v-card-text style="flex: 1" class="d-flex pa-0 ma-0">
          <!-- GRUPOS -->
          <template
            v-for="(group, indx_group) in block.items"
            :key="indx_group"
          >
            <v-divider v-if="indx_group > 0" vertical class="mx-1" />
            <div class="d-flex flex-column justify-center">
              <!-- ITEMS -->
              <div
                v-for="(item, indx_item) in group"
                :key="indx_item"
                class="my-2"
              >
                <v-text-field
                  v-if="item?.type == 'color'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  :width="100"
                  type="color"
                  prepend-inner-icon="mdi-palette"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
                <v-number-input
                  v-else-if="
                    ['font-size', 'border-spacing'].includes(item?.type)
                  "
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  :width="150"
                  :min="1"
                  :max="90"
                  :prepend-inner-icon="
                    item?.type == 'font-size'
                      ? 'mdi-format-font-size-increase'
                      : 'mdi-border-all-variant'
                  "
                  density="compact"
                  variant="outlined"
                  control-variant="split"
                  hide-details
                />
                <v-select
                  v-else-if="item?.type == 'font'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  :width="200"
                  prepend-inner-icon="mdi-format-font"
                  density="compact"
                  variant="outlined"
                  :items="fonts"
                  item-title="label"
                  item-value="value"
                  hide-details
                />
                <v-btn-toggle
                  v-else-if="item?.type == 'h-align'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  density="compact"
                  variant="outlined"
                >
                  <v-btn value="start">
                    <v-icon>mdi-format-horizontal-align-left</v-icon>
                  </v-btn>
                  <v-btn value="center">
                    <v-icon>mdi-format-horizontal-align-center</v-icon>
                  </v-btn>
                  <v-btn value="end">
                    <v-icon>mdi-format-horizontal-align-right</v-icon>
                  </v-btn>
                </v-btn-toggle>
                <v-btn-toggle
                  v-else-if="item?.type == 'v-align'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  density="compact"
                  variant="outlined"
                >
                  <v-btn value="start">
                    <v-icon>mdi-format-vertical-align-top</v-icon>
                  </v-btn>
                  <v-btn value="center">
                    <v-icon>mdi-format-vertical-align-center</v-icon>
                  </v-btn>
                  <v-btn value="end">
                    <v-icon>mdi-format-vertical-align-bottom</v-icon>
                  </v-btn>
                </v-btn-toggle>
                <v-btn
                  v-else-if="item?.type == 'restore'"
                  icon="mdi-restore"
                  size="x-large"
                  variant="tonal"
                  color="primary"
                  @click="restore"
                />
                <v-text-field
                  v-else-if="item?.type == 'image'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  :width="200"
                  type="text"
                  prepend-inner-icon="mdi-image-area"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
                <v-select
                  v-else-if="item?.type == 'object-fit'"
                  v-model="userdata[item.property]"
                  :label="item?.label"
                  :width="200"
                  prepend-inner-icon="mdi-fit-to-page"
                  density="compact"
                  variant="outlined"
                  :items="fit"
                  item-title="label"
                  item-value="value"
                  hide-details
                />
                <div
                  v-else-if="item?.type == 'opacity'"
                  class="px-1"
                  style="width: 200px"
                >
                  <span
                    class="text-label-small px-2"
                    style="
                      opacity: var(--v-medium-emphasis-opacity);
                      font-size: 12px;
                    "
                  >
                    {{ item?.label }}
                  </span>
                  <v-slider
                    v-model="userdata[item.property]"
                    :min="0"
                    :max="100"
                    hide-details
                    :thumb-size="15"
                    :track-size="1"
                  />
                </div>
                <div v-else class="text-error">
                  Type "{{ item?.type }}" invalid!
                </div>
              </div>
            </div>
          </template>
        </v-card-text>
        <v-card-subtitle class="text-center">
          <small>{{ block.name }}</small>
        </v-card-subtitle>
      </v-card>
    </v-slide-group-item>
  </v-slide-group>
</template>

<script>
export default {
  name: "CustomizationToolsComponent",
  props: {
    module: Object,
    items: Array,
  },
  data: () => ({
    fonts: [
      { label: "Arial", value: "Arial, sans-serif" },
      { label: "Helvetica", value: "Helvetica, sans-serif" },
      { label: "Times New Roman", value: "Times New Roman, serif" },
      { label: "Georgia", value: "Georgia, serif" },
      { label: "Courier New", value: "Courier New, monospace" },
      { label: "Verdana", value: "Verdana, sans-serif" },
      { label: "DIN Condensed", value: "DINCondensedBold, sans-serif" },
      { label: "Roboto", value: "Roboto, sans-serif" },
    ],
  }),
  computed: {
    menu_items() {
      return [
        ...this.items.map((block) => {
          return this.toBlock(block);
        }),
        {
          name: this.$t("components.customization.restore"),
          items: [
            [
              {
                type: "restore",
                label: this.$t("components.customization.restore_configs"),
              },
            ],
          ],
        },
      ];
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    fit() {
      return [
        { label: this.$t("components.customization.fit.none"), value: "none" },
        { label: this.$t("components.customization.fit.fill"), value: "fill" },
        {
          label: this.$t("components.customization.fit.contain"),
          value: "contain",
        },
        {
          label: this.$t("components.customization.fit.cover"),
          value: "cover",
        },
      ];
    },
  },
  methods: {
    t(text) {
      return this.$t(`modules.${this.module.id}.${text}`);
    },
    toBlock(item) {
      /* Blocos */
      if (typeof item == "string") {
        item = { name: this.label(item), items: this.toArray(item) };
      } else if (Array.isArray(item)) {
        item = { name: "", items: item };
      }

      item.items = this.toArray(item?.items).map((group) => {
        /* Grupos */
        return this.toArray(group).map((el) => {
          /* Elementos */
          return {
            ...this.properties(el),
            property: el,
            label: this.label(el),
          };
        });
      });
      return item;
    },
    toArray(item) {
      if (item == null) {
        return [];
      }
      if (typeof item == "string") {
        return [item];
      }
      if (!Array.isArray(item)) {
        return [];
      }
      return item;
    },
    label(item) {
      return this.t(this.module?.manifest?.customization[item]?.label);
    },
    properties(item) {
      return this.module?.manifest?.customization[item];
    },
    restore() {
      let self = this;
      this.$alert.yesno(
        "components.customization.restore_dialog",
        function (btn) {
          if (btn == "yes") {
            self.menu_items?.map((block) => {
              block.items?.map((group) => {
                group.map((item) => {
                  if (item.property) {
                    self.userdata[item.property] = item.default;
                  }
                });
              });
            });
          }
        },
      );
    },
  },
};
</script>

<style lang="scss">
.__customization_tools {
  input {
    &[type="color"] {
      padding: 4px;
    }
  }
}
</style>



================================================
FILE: src/components/DataTable.vue
================================================
<template>
  <v-table fixed-header hover loading density="compact" class="__table-data">
    <template v-slot:bottom>
      <v-progress-linear
        v-if="loading"
        :color="$theme.primary()"
        indeterminate
      />
      <v-alert
        v-if="error"
        type="error"
        :text="error"
        variant="tonal"
        border="start"
        class="ma-2"
      />
    </template>
    <slot />
  </v-table>
</template>

<script>
export default {
  name: "DataTableComponent",
  props: {
    modelValue: Object,
    file: String,
    search: String,
    scroll: { type: Object, default: () => ({}) },
    has_scroll: Boolean,
    searchable_fields: Object,
    filter: Object,
    letter: String,
    sort_by: String,
  },
  data: () => ({
    all_data: [],
    filter_data: [],
    data: [],
    limit: 0,
    error: null,
    last_filter: {},
    loading: true,
  }),
  watch: {
    async file() {
      await this.loadData();
    },
    search() {
      this.filterData();
    },
    searchable_fields() {
      this.compareFilterData();
    },
    filter() {
      this.compareFilterData();
    },
    letter() {
      this.compareFilterData();
    },
    async data() {
      this.$emit("update:modelValue", {
        total_count: this.all_data.length,
        filter_count: this.filter_data.length,
        count: this.data.length,
        data: this.data,
      });
    },
    async scroll() {
      if (
        this.scroll.scroll_bottom <= 50 &&
        this.data.length < this.filter_data.length
      ) {
        this.paginateData();
      }
    },
  },
  methods: {
    async loadData() {
      this.all_data = [];
      this.filter_data = [];
      this.data = [];
      this.loading = true;

      this.all_data = await this.$database.get(this.file);

      if (this.all_data == null) {
        this.error = this.$t("components.datatable.alerts.not_found");
      }

      if (this.sort_by) {
        this.all_data.sort((a, b) =>
          this.$string.sort(a[this.sort_by], b[this.sort_by]),
        );
      }
      this.filterData();
    },
    filterData() {
      this.limit = 0;
      const value = this.$string.clean(this.search);

      let searchable = this.searchable_fields
        ? Object.keys(this.searchable_fields).filter(
            (key) => this.searchable_fields[key] === true,
          )
        : [];
      let filter = this.filter
        ? Object.keys(this.filter).filter((key) => this.filter[key] === true)
        : [];
      this.filter_data = this.all_data
        .filter((item) => {
          const searchableCondition =
            searchable.length === 0 ||
            value == "" ||
            searchable.some((key) => {
              if (key === "track" && item.albums) {
                return item.albums.some((album) => {
                  const isHymnal = album.name && album.type == "hymnal";
                  return (
                    isHymnal &&
                    album.pivot &&
                    Number(album.pivot.track) === Number(value)
                  );
                });
              }

              if (!isNaN(item[key]) && !isNaN(value)) {
                return Number(item[key]) === Number(value);
              } else if (isNaN(item[key])) {
                return this.$string.clean(item[key]).includes(value);
              } else {
                return false;
              }
            });

          const filterCondition =
            filter.length === 0 ||
            filter.some((key) => item[key] === true || item[key] === 1);

          const initialLetter =
            this.letter === "" ||
            (this.letter === "#"
              ? /^[^a-zA-Z]/.test(
                  item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
                )
              : item.name
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .startsWith(this.letter));

          return searchableCondition && filterCondition && initialLetter;
        })
        .slice();

      this.paginateData();
    },
    paginateData() {
      this.limit += 10;
      this.data = this.filter_data.slice(0, this.limit);
      this.loading = false;

      const self = this;
      setTimeout(() => {
        if (!self.has_scroll && self.data.length < self.filter_data.length) {
          self.paginateData();
        }
      }, 100);
    },

    compareFilterData() {
      let filter = {
        searchable_fields: this.searchable_fields,
        filter: this.filter,
        letter: this.letter,
      };

      if (JSON.stringify(filter) === JSON.stringify(this.last_filter)) {
        return;
      }

      this.last_filter = filter;

      this.filterData();
    },
  },
  async mounted() {
    await this.loadData();
  },
};
</script>

<style>
.__table-data .v-table__wrapper {
  overflow: initial !important;
}
</style>



================================================
FILE: src/components/FullscreenPlayer.vue
================================================
<template>
  <div
    class="position-absolute w-100 h-100 top-0 left-0"
    style="z-index: 9999"
    @mousemove="mouseMove"
  >
    <transition name="slide-up">
      <div
        v-if="visible"
        class="position-absolute w-100 bottom-0"
        @mouseenter="mouseEnter"
        @mouseleave="mouseLeave"
      >
        <l-player location="fullscreen" />
      </div>
    </transition>
  </div>
</template>

<script>
import LPlayer from "@/components/Player.vue";

export default {
  name: "FullscreenPlayerComponent",
  components: {
    LPlayer,
  },
  data() {
    return {
      visible: false,
      start_timer: true,
      timeout: null,
    };
  },
  methods: {
    mouseMove() {
      if (!this.start_timer) {
        return;
      }
      this.showChild();
      this.startHideTimer();
    },
    mouseEnter() {
      this.start_timer = false;
      clearTimeout(this.timeout);
    },
    mouseLeave() {
      this.start_timer = true;
      this.startHideTimer();
    },
    showChild() {
      this.visible = true; // Torna a div filho visível
      clearTimeout(this.timeout); // Cancela qualquer temporizador ativo
    },
    startHideTimer() {
      clearTimeout(this.timeout); // Cancela qualquer temporizador anterior
      this.timeout = setTimeout(() => {
        this.visible = false; // Oculta a div filho após um tempo
      }, 1000);
    },
  },
  beforeUnmount() {
    clearTimeout(this.timeout); // Limpa o temporizador ao destruir o componente
  },
};
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>



================================================
FILE: src/components/LanguageSelector.vue
================================================
<template>
  <v-menu>
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" slim>
        <country-flag
          v-if="current_language"
          :country="languages[current_language].flag"
          style="margin: 0; padding: 0"
        />
      </v-btn>
    </template>
    <v-list>
      <v-list-item
        v-for="(language, key) in languages"
        :key="key"
        @click="changeLanguage(key)"
      >
        <template v-slot:prepend>
          <country-flag
            :country="language.flag"
            style="margin: 0; padding: 0"
          />
        </template>
        <v-list-item-title>
          {{ language.name }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
import CountryFlag from "vue-country-flag-next";

export default {
  name: "LanguageSelectorComponent",
  components: {
    CountryFlag,
  },
  computed: {
    languages() {
      return this.$appdata.get("languages");
    },
    current_language() {
      return this.$userdata.get("language");
    },
  },
  methods: {
    changeLanguage(language) {
      this.$i18n.locale = language;
      this.$userdata.set("language", language);
    },
  },
};
</script>



================================================
FILE: src/components/LetterPagination.vue
================================================
<template>
  <div class="w-100 d-flex align-center">
    <v-btn
      color="primary"
      @click="reset()"
      :variant="input < 0 ? 'flat' : 'tonal'"
      density="compact"
      class="me-1"
    >
      {{ $t("components.letterpagination.all") }}
    </v-btn>

    <v-slide-group v-model="input" show-arrows center-active>
      <v-slide-group-item
        v-for="letter in letters"
        :key="letter"
        v-slot="{ isSelected, toggle }"
      >
        <v-btn
          icon
          color="primary"
          @click="toggle"
          :variant="isSelected ? 'flat' : 'tonal'"
          density="compact"
          class="me-1"
        >
          {{ letter }}
        </v-btn>
      </v-slide-group-item>
    </v-slide-group>
  </div>
</template>

<script>
export default {
  name: "LetterPaginationComponent",
  props: {
    modelValue: String,
  },
  computed: {
    input: {
      get() {
        return this.letters.indexOf(this.modelValue);
      },
      set(value) {
        this.$emit("update:modelValue", this.letters[value] ?? "");
      },
    },
    letters() {
      return [
        "#",
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
      ];
    },
  },
  methods: {
    reset() {
      this.input = -1;
    },
  },
};
</script>



================================================
FILE: src/components/ModuleContainer.vue
================================================
<template>
  <Window
    v-if="manifest"
    v-model="module.show"
    :title="title ?? (manifest ? t('title') : '')"
    :icon="module.icon"
    closable
    minimizable
    :compact="compact"
    :index="index"
    :size="manifest?.moduleOptions?.size ?? null"
    @close="close()"
    @minimize="minimize()"
    @scroll="scroll()"
    @hasScroll="hasScroll()"
  >
    <template v-slot:header>
      <slot name="header" />
    </template>
    <template v-slot:left>
      <slot name="left" />
    </template>
    <template v-slot:right>
      <slot name="right" />
    </template>
    <template v-slot:footer>
      <slot name="footer" />
    </template>

    <template v-slot:default>
      <slot />
    </template>
  </Window>
</template>

<script>
import Window from "@/components/Window.vue";

export default {
  name: "ModuleContainer",
  components: {
    Window,
  },
  props: {
    manifest: {
      type: Object,
      required: true,
    },
    title: {
      type: String,
      default: null,
    },
    compact: {
      type: Boolean,
      default: false,
    },
    index: {
      type: [Boolean, Number, String],
      default: null,
    },
  },
  computed: {
    module_id() {
      return this.manifest?.id;
    },
    module() {
      return this.module_id && this.$modules.get(this.module_id);
    },
    show() {
      return this.module_id ? this.module.show : false;
    },

    /* 
       userdata são os dados do usuário, que devem ser salvos na máquina ou session
       (configurações, personalizações, etc...) 
    */
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module_id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module_id}.${key}`, value);
            return true;
          },
        },
      );
    },

    /* 
       appdata são os dados do módulo, que são usados somente enquanto o módulo está ativo
       e que podem ser destruídos depois (não são salvos)
    */
    appdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$appdata.get(`modules.${this.module_id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$appdata.set(`modules.${this.module_id}.${key}`, value);
            return true;
          },
        },
      );
    },
  },
  watch: {
    show(value) {
      this.$emit("show", value);
    },
  },
  methods: {
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    close() {
      this.$modules.close(this.module_id);
      this.$emit("close");
    },
    minimize() {
      this.$modules.minimize(this.module_id);
      this.$emit("minimize");
    },
    scroll() {
      this.$emit("scroll");
    },
    hasScroll() {
      this.$emit("hasScroll");
    },
  },
};
</script>



================================================
FILE: src/components/MusicMenuTable.vue
================================================
<template>
  <div class="d-flex flex-nowrap">
    <template v-if="!compact">
      <v-btn
        v-for="(btn, key) in buttons"
        :key="key"
        :disabled="btn.disabled ? btn.disabled : false"
        variant="text"
        :color="color ? color : $theme.primary()"
        :icon="btn.icon"
        density="compact"
        class="mx-1"
        @click="btn.click"
      />
    </template>

    <v-menu location="start">
      <template v-slot:activator="{ props }">
        <v-btn
          variant="text"
          :color="color ? color : $theme.primary()"
          icon="mdi-menu"
          density="compact"
          class="mx-1"
          v-bind="props"
        />
      </template>

      <v-list>
        <v-list-item v-if="compact" class="d-flex justify-center">
          <v-btn
            v-for="(btn, key) in buttons"
            :key="key"
            :disabled="btn.disabled ? btn.disabled : false"
            variant="text"
            :color="$theme.primary()"
            :icon="btn.icon"
            density="compact"
            class="mx-1"
            @click="btn.click"
          />
        </v-list-item>
        <v-divider v-if="compact" />

        <v-list-item
          v-for="(item, key) in menu"
          :key="key"
          class="cursor-pointer"
        >
          <template v-slot:prepend>
            <v-icon :icon="item.icon"></v-icon>
          </template>
          <template v-slot:append>
            <v-icon icon="mdi-menu-right" size="x-small"></v-icon>
          </template>
          <v-list-item-title>{{ item.title }}</v-list-item-title>

          <v-menu
            :open-on-focus="false"
            activator="parent"
            :open-on-hover="!is_mobile"
            submenu
          >
            <v-list>
              <template v-for="(subitem, subkey) in item.menu" :key="subkey">
                <v-divider v-if="subitem.title == '-'" />
                <v-list-item
                  v-else
                  :prepend-icon="subitem.icon"
                  :title="subitem.title"
                  @click="subitem.click"
                  :disabled="subitem.disabled ? subitem.disabled : false"
                />
              </template>
            </v-list>
          </v-menu>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
export default {
  name: "MusicMenuTableComponent",
  props: {
    id_music: Number,
    has_instrumental_music: [Boolean, Number],
    color: String,
  },
  computed: {
    buttons() {
      return [
        {
          disabled: false,
          icon: "mdi-play-box-multiple",

          click: () =>
            this.$media.open({ id_music: this.id_music, mode: "audio" }),
        },
        {
          disabled: !this.has_instrumental_music,
          icon: "mdi-play-box-multiple-outline",
          click: () =>
            this.$media.open({ id_music: this.id_music, mode: "instrumental" }),
        },
        {
          disabled: false,
          icon: "mdi-checkbox-multiple-blank-outline",
          click: () => this.$media.open(this.id_music),
        },
        {
          disabled: false,
          icon: "mdi-text-box-outline",
          click: () => this.$media.openLyric(this.id_music),
        },
      ];
    },
    menu() {
      return [
        /* {
          title: "Adicionar em",
          icon: "mdi-plus",
          menu: [
            {
              title: "Favritos",
              icon: "mdi-star",
              click: () => null,
            },
            {
              title: "Liturgia",
              icon: "mdi-view-list",
              click: () => null,
            },
            {
              title: "Lista de Reprodução",
              icon: "mdi-playlist-music",
              click: () => null,
            },
          ],
        },*/
        {
          title: "Executar",
          icon: "mdi-play",
          menu: [
            {
              title: "Cantado",
              icon: "mdi-play-box-multiple",
              click: () =>
                this.$media.open({ id_music: this.id_music, mode: "audio" }),
            },
            {
              title: "Playback",
              icon: "mdi-play-box-multiple-outline",
              click: () =>
                this.$media.open({
                  id_music: this.id_music,
                  mode: "instrumental",
                }),
              disabled: !this.has_instrumental_music,
            },
            {
              title: "Sem Áudio",
              icon: "mdi-checkbox-multiple-blank-outline",
              click: () => this.$media.open(this.id_music),
            },
            {
              title: "Letra",
              icon: "mdi-text-box-outline",
              click: () => this.$media.openLyric(this.id_music),
            },
            {
              title: "-",
            },
            {
              title: "Arquivo Cantado",
              icon: "mdi-file-music",
              click: () => this.$media.openAudio(this.id_music),
            },
            {
              title: "Arquivo Playback",
              icon: "mdi-file-music-outline",
              click: () =>
                this.$media.openAudio({
                  id_music: this.id_music,
                  mode: "instrumental",
                }),
              disabled: !this.has_instrumental_music,
            },
          ],
        },
        /*{
          title: "Exportar",
          icon: "mdi-export",
          menu: [
            {
              title: "Cantado",
              icon: "mdi-play-box-multiple",
              click: () => null,
            },
            {
              title: "Playback",
              icon: "mdi-play-box-multiple-outline",
              disabled: !this.has_instrumental_music,
              click: () => null,
            },
            {
              title: "Sem Áudio",
              icon: "mdi-checkbox-multiple-blank-outline",
              click: () => null,
            },
            {
              title: "-",
            },
            {
              title: "Arquivo Cantado",
              icon: "mdi-file-music",
              click: () => null,
            },
            {
              title: "Arquivo Playback",
              icon: "mdi-file-music-outline",
              click: () => null,
              disabled: !this.has_instrumental_music,
            },
          ],
        },*/
      ];
    },
    compact: function () {
      return this.$vuetify.display.width <= 550;
    },
    is_mobile: function () {
      return this.$appdata.get("is_mobile");
    },
  },
};
</script>



================================================
FILE: src/components/Player.vue
================================================
<template>
  <v-card theme="dark" class="w-100 pa-0 ma-0 d-flex align-center" :rounded="0">
    <div
      v-if="location == 'footer' && $vuetify.display.width > 800"
      class="d-flex align-center"
      :style="
        media.config.image && $vuetify.display.width > 900
          ? 'max-width: 350px;padding-right:50px;'
          : 'max-width: 300px'
      "
    >
      <v-avatar
        v-if="media.config.image && $vuetify.display.width > 900"
        class="ma-1"
        size="65"
        rounded="0"
      >
        <v-img :src="$path.file(media.config.image)" />
      </v-avatar>
      <div class="d-flex flex-column flex-grow-1 w-100">
        <v-card-title class="py-0">
          {{ media.config.title }}
        </v-card-title>
        <v-card-subtitle v-if="media.config.subtitle" class="py-0">
          {{ media.config.subtitle }}
          <span v-if="media.config.track > 0">
            | {{ $t("modules.media.general.track") }}
            {{ media.config.track }}</span
          >
        </v-card-subtitle>
      </div>
    </div>

    <div class="d-flex flex-column flex-grow-1">
      <div class="d-flex align-center justify-center py-1 flex-grow-1">
        <v-btn
          v-for="(button, key) in buttons"
          :key="key"
          v-show="
            button.show &&
            (compact === false || (compact === true && !button.compact))
          "
          :disabled="media.loading || button.disabled"
          :icon="button.icon"
          :color="button.highlight ? 'white' : ''"
          @click="button.click"
          @shortkey="button.click"
          v-shortkey="button.shortkey"
          :variant="button.highlight ? 'flat' : 'text'"
          class="ma-1"
          size="small"
        />
      </div>
      <div
        v-if="media.config.audio"
        class="d-flex align-center justify-center py-1 px-3"
      >
        <div class="text-right text-caption">
          {{ $datetime.shortTime(media.config.current_time) }}
        </div>
        <div class="flex-grow-1 px-2">
          <v-progress-linear
            v-model="media.config.progress"
            rounded
            clickable
            :indeterminate="media.loading"
            :height="10"
            :stream="!media.loading"
            :buffer-value="media.config.buffered"
            :color="
              media.config.is_paused
                ? 'warning'
                : media.config.volume <= 0
                ? 'red'
                : 'info'
            "
            @click="changeProgress"
          />
        </div>
        <div class="text-left text-caption">
          {{ $datetime.shortTime(media.config.duration) }}
        </div>
      </div>
      <div
        v-if="!media.config.audio && location == 'footer'"
        class="d-flex align-center justify-center py-1 px-3"
      >
        <small class="text-center">
          {{ slide_text }}
        </small>
      </div>
    </div>
    <div class="d-flex flex-column">
      <div class="d-flex align-center justify-end pa-1 flex-grow-1">
        <v-menu
          v-if="location !== 'fullscreen' && $vuetify.display.width > 350"
        >
          <template v-slot:activator="{ props }">
            <v-btn
              variant="text"
              size="small"
              :color="mode.color"
              v-bind="props"
              :icon="mode.tray_icon"
            />
          </template>

          <v-list>
            <template v-for="(mode, key) in menu_modes" :key="key">
              <v-divider v-if="mode.title == '-'" />
              <v-list-item
                v-else
                :active="mode.active"
                :disabled="mode.disabled"
                @click="mode.click"
              >
                <template v-slot:prepend>
                  <v-icon :icon="mode.icon"></v-icon>
                </template>
                {{ mode.title }}
              </v-list-item>
            </template>
          </v-list>
        </v-menu>

        <v-menu v-if="this.media.minimized && !compact">
          <template v-slot:activator="{ props }">
            <v-btn variant="flat" size="x-small" color="white" v-bind="props">
              {{ this.media.config.slide_index + 1 }}
            </v-btn>
          </template>

          <v-list>
            <v-list-item
              v-for="(item, index) in slides"
              :key="index"
              :active="media.config.slide_index == index"
              @click="$media.goToSlide(index)"
            >
              <template v-slot:prepend>
                <v-chip size="small" class="mr-2">{{ index + 1 }}</v-chip>
              </template>

              <v-list-item-title v-if="item.cover">
                {{ item.lyric }}
              </v-list-item-title>
              <div
                class="text-caption text-truncate"
                v-else
                v-html="item.lyric"
              />
            </v-list-item>
          </v-list>
        </v-menu>

        <v-btn
          v-if="this.media.minimized"
          variant="text"
          size="small"
          icon="mdi-open-in-app"
          @click="maximize()"
        />
        <v-btn
          v-if="location == 'fullscreen'"
          variant="text"
          size="small"
          icon="mdi-fullscreen-exit"
          @click="fullscreen(false)"
        />
        <v-btn
          v-else-if="location == 'window'"
          variant="text"
          size="small"
          icon="mdi-fullscreen"
          @click="fullscreen()"
        />
        <LScreenBtn v-if="location !== 'fullscreen'" module="media" />

        <v-menu v-if="location !== 'fullscreen' && compact">
          <template v-slot:activator="{ props }">
            <v-btn
              icon="mdi-menu"
              variant="text"
              size="small"
              v-bind="props"
            ></v-btn>
          </template>

          <v-list>
            <v-list-item
              v-for="(button, key) in buttons.filter(
                (item) => item.compact == true
              )"
              :key="key"
              :disabled="media.loading || button.disabled"
              @click="button.click"
              @shortkey="button.click"
              v-shortkey="button.shortkey"
            >
              <v-icon :icon="button.icon" />
            </v-list-item>

            <v-divider v-if="$vuetify.display.width <= 350" />
            <template v-for="(mode, key) in menu_modes" :key="key">
              <v-divider
                v-if="mode.title == '-' && $vuetify.display.width <= 350"
              />
              <v-list-item
                v-else-if="$vuetify.display.width <= 350"
                :active="mode.active"
                :disabled="mode.disabled"
                @click="mode.click"
              >
                <v-icon :icon="mode.icon" />
              </v-list-item>
            </template>
          </v-list>
        </v-menu>

        <v-btn
          v-if="this.media.minimized"
          variant="text"
          size="small"
          icon="mdi-close"
          @click="close()"
        />
      </div>
      <div
        v-if="media.config.audio"
        class="d-flex align-center justify-center pa-1"
      >
        <div>
          <v-btn
            :disabled="media.loading"
            :icon="volume_icon"
            size="x-small"
            @click="toogleVolume"
            variant="text"
          />
        </div>
        <div class="flex-grow-1 px-2" style="min-width: 100px">
          <v-progress-linear
            v-model="media.config.volume"
            rounded
            clickable
            :height="10"
            color="white"
            @click="changeVolume"
          />
        </div>
      </div>
    </div>
  </v-card>
</template>

<script>
import LScreenBtn from "@/components/buttons/Screen.vue";

export default {
  name: "PlayerComponent",
  props: {
    location: String,
  },
  components: {
    LScreenBtn,
  },
  computed: {
    media() {
      return this.$modules.get("media");
    },
    slides() {
      return this.$media.slides();
    },
    has_instrumental_music() {
      return this.media.data.url_instrumental_music ? true : false;
    },
    buttons() {
      return [
        {
          show: this.media.config.audio,
          compact: true,
          disabled: false,
          highlight: false,
          icon: "mdi-rewind-10",
          click: () => this.rewind(),
          shortkey: {
            left: ["ctrl", "arrowleft"],
            up: ["ctrl", "arrowup"],
            pgup: ["ctrl", "pageup"],
          },
        },
        {
          show: true,
          compact: true,
          disabled: this.media.config.slide_index <= 0,
          highlight: false,
          icon: "mdi-page-first",
          click: () => this.first(),
          shortkey: ["home"],
        },
        {
          show: true,
          compact: false,
          disabled: this.media.config.slide_index <= 0,
          highlight: false,
          icon: "mdi-chevron-left",
          click: () => this.prev(),
          shortkey: {
            left: ["arrowleft"],
            up: ["arrowup"],
            pgup: ["pageup"],
          },
        },
        {
          show: this.media.config.audio,
          compact: false,
          disabled: this.media.config.is_fading,
          highlight: true,
          icon: this.media.config.is_paused ? "mdi-play" : "mdi-pause",
          click: () => this.play(),
          shortkey: ["space"],
        },
        {
          show: true,
          compact: false,
          disabled:
            this.media.config.slide_index >= this.media.config.last_slide - 1,
          highlight: false,
          icon: "mdi-chevron-right",
          click: () => this.next(),
          shortkey: {
            right: ["arrowright"],
            down: ["arrowdown"],
            pgdn: ["pagedown"],
          },
        },
        {
          show: true,
          compact: true,
          disabled:
            this.media.config.slide_index >= this.media.config.last_slide - 1,
          highlight: false,
          icon: "mdi-page-last",
          click: () => this.last(),
          shortkey: ["end"],
        },
        {
          show: this.media.config.audio,
          compact: true,
          disabled: false,
          highlight: false,
          icon: "mdi-fast-forward-10",
          click: () => this.forward(),
          shortkey: {
            right: ["ctrl", "arrowright"],
            down: ["ctrl", "arrowdown"],
            pgdn: ["ctrl", "pagedown"],
          },
        },
      ];
    },
    menu_modes() {
      return [
        {
          mode: "audio",
          title: this.$t("modules.media.general.sung"),
          color: "info",
          active: this.media.config.mode == "audio",
          icon: "mdi-play-box-multiple",
          tray_icon: "mdi-account-voice",
          click: () =>
            this.open({
              id_music: this.media.id_music,
              mode: "audio",
              minimized: this.media.minimized,
            }),
        },
        {
          mode: "instrumental",
          title: this.$t("modules.media.general.instrumental"),
          color: "success",
          active: this.media.config.mode == "instrumental",
          disabled: !this.has_instrumental_music,
          icon: "mdi-play-box-multiple-outline",
          tray_icon: "mdi-music-note",
          click: () =>
            this.open({
              id_music: this.media.id_music,
              mode: "instrumental",
              minimized: this.media.minimized,
            }),
        },
        {
          mode: "no_audio",
          title: this.$t("modules.media.general.no_audio"),
          color: "error",
          active: this.media.config.mode == "no_audio",
          icon: "mdi-checkbox-multiple-blank-outline",
          tray_icon: "mdi-music-off",
          click: () =>
            this.open({
              id_music: this.media.id_music,
              minimized: this.media.minimized,
            }),
        },
        { title: "-" },
        {
          title: this.$t("modules.media.general.lyric"),
          color: "error",
          icon: "mdi-text-box-outline",
          click: () => this.openLyric(),
        },
      ];
    },
    mode() {
      return this.menu_modes.filter(
        (item) => item.mode == this.media.config.mode
      )[0];
    },
    volume_icon: function () {
      switch (true) {
        case this.media.config.volume <= 0:
          return "mdi-volume-mute";
        case this.media.config.volume <= 20:
          return "mdi-volume-low";
        case this.media.config.volume <= 70:
          return "mdi-volume-medium";
        default:
          return "mdi-volume-high";
      }
    },
    slide_text: function () {
      if (!this.slides[this.media.config.slide_index]) return "";
      if (!this.slides[this.media.config.slide_index].lyric) return "";

      let text = this.slides[this.media.config.slide_index].lyric;
      text = text.replace(/<br>/gi, " / ").toUpperCase();
      return text;
    },
    is_mobile: function () {
      return this.$appdata.get("is_mobile");
    },
    compact: function () {
      return this.$vuetify.display.width <= 500;
    },
  },
  methods: {
    play() {
      if (this.media.config.is_paused) {
        this.$media.play();
      } else {
        this.$media.pause();
      }
    },
    rewind: function () {
      this.$media.advanceTime(-10);
    },
    first() {
      this.$media.firstSlide();
    },
    prev() {
      this.$media.prevSlide();
    },
    next() {
      this.$media.nextSlide();
    },
    last() {
      this.$media.lastSlide();
    },
    forward: function () {
      this.$media.advanceTime(+10);
    },
    open: function (data) {
      this.$media.open(data);
    },
    openLyric: function () {
      this.$media.openLyric();
    },
    maximize: function () {
      this.$media.maximize();
    },
    close: function () {
      this.$media.close();
    },
    changeProgress() {
      const time =
        (this.media.config.duration * this.media.config.progress) / 100;
      this.$media.goToTime(time);
    },
    fullscreen(value = true) {
      this.$media.fullscreen(value);
    },
    toogleVolume() {
      this.$media.toogleVolume();
    },
    changeVolume() {
      this.$media.setVolume(this.media.config.volume);
    },
  },
};
</script>



================================================
FILE: src/components/Slide.vue
================================================
<template>
  <div ref="container" class="w-100 h-100">
    <transition
      name="fade"
      v-for="(slide, index) in slides.slice().reverse()"
      :key="index"
    >
      <div
        v-if="!slide.destroy"
        v-show="slide.active"
        class="position-absolute top-0 left-0 w-100 h-100"
        :style="style_bg(slide)"
      >
        <div
          class="position-absolute top-0 left-0 w-100 h-100 d-flex justify-center align-center"
        >
          <div>
            <div
              v-if="slide.aux_text"
              v-html="slide.aux_text"
              :style="style_aux_text()"
            />
            <div
              v-if="slide.text"
              v-html="slide.text"
              :style="style_text(slide)"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: "SlideComponent",
  props: {
    slide_number: Number,
    cover: Boolean,
    text: String,
    aux_text: String,
    image: String,
    image_position: Number,
  },
  data: () => ({
    slides: [{}, {}],
    repeat: false,
    width: 0,
    height: 0,
  }),
  computed: {
    props_slide() {
      return {
        slide_number: this.slide_number,
        cover: this.cover,
        text: this.text,
        aux_text: this.aux_text,
        image: this.image,
        image_position: this.image_position,
      };
    },
    screenSize() {
      return { width: this.width, height: this.height };
    },
  },
  watch: {
    props_slide() {
      this.setSlide();
    },
    screenSize() {
      const self = this;
      setTimeout(function () {
        self.windowResize();
      }, 100);
    },
  },
  methods: {
    setSlide() {
      if (
        this.$string.clean(this.slides[1].text) ==
          this.$string.clean(this.props_slide.text) &&
        this.$string.clean(this.slides[1].aux_text) ==
          this.$string.clean(this.props_slide.aux_text) &&
        this.slides[1].image == this.props_slide.image &&
        this.slides[1].cover == this.props_slide.cover
      ) {
        this.repeat = !this.repeat;
      } else {
        this.repeat = false;
      }

      this.slides.unshift({});
      this.slides[1] = {
        ...this.props_slide,
        active: true,
      };

      if (this.slides.length > 3) {
        this.slides[3].destroy = true;
      }
    },
    style_bg(slide) {
      return {
        overflow: "hidden",
        backgroundColor: "rgb(0, 0, 0)",
        backgroundImage: `url(${slide.image})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: [
          "top left",
          "top center",
          "top right",
          "center left",
          "center center",
          "center right",
          "bottom left",
          "bottom center",
          "bottom right",
        ][this.image_position || 5],
        backgroundSize: "cover",
      };
    },
    style_aux_text() {
      return {
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        fontSize: `${this.fontSizePc(10)}px`,
        color: "rgb(246, 195, 42)",
        padding: `0px ${this.fontSizePc(5)}px`,
        fontFamily: "DINCondensedBold",
        textTransform: "uppercase",
      };
    },
    style_text(slide) {
      let style = {
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        padding: `0px ${this.fontSizePc(5)}px`,
        textAlign: "center",
        fontFamily: "DINCondensedBold",
        textTransform: "uppercase",
      };

      if (slide.cover) {
        return {
          ...style,
          fontSize: `${this.fontSizePc(25)}px`,
          color: "rgb(246, 195, 42)",
        };
      } else {
        return {
          ...style,
          fontSize: `${this.fontSizePc(20)}px`,
          color: this.repeat ? "rgb(246, 195, 42)" : "rgb(255, 255, 255)",
        };
      }
    },
    fontSizePc(pc) {
      const v = Math.min(this.width, this.height);
      return (pc * v) / 100 / 2;
    },
    windowResize() {
      const container = this.$refs.container;
      if (container) {
        this.width = container.offsetWidth;
        this.height = container.offsetHeight;

        if (this.width <= 0 || this.height <= 0) {
          const self = this;
          setTimeout(function () {
            self.windowResize();
          }, 100);
        }
      }
    },
  },
  mounted() {
    this.setSlide();
    this.windowResize();
    window.addEventListener("resize", this.windowResize);
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
  },
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>



================================================
FILE: src/components/Toolbar.vue
================================================
<template>
  <v-slide-group show-arrows class="px-1">
    <slot />
  </v-slide-group>
</template>

<script>
export default {
  name: "ToolbarComponent",
};
</script>



================================================
FILE: src/components/ToolbarItem.vue
================================================
<template>
  <v-slide-group-item>
    <v-card flat>
      <v-card-text class="pa-2 px-1">
        <slot />
      </v-card-text>
    </v-card>
  </v-slide-group-item>
</template>

<script>
export default {
  name: "ToolbarItemComponent",
};
</script>



================================================
FILE: src/components/Window.vue
================================================
<template>
  <v-dialog
    v-model="visible"
    scrollable
    persistent
    @click:outside="minimize"
    @keydown.esc="minimize"
    :width="w_width"
    :height="w_height"
    :theme="dark ? 'dark' : ''"
  >
    <v-card :color="color ? color : ''">
      <slot name="toolbar">
        <div
          class="d-flex flex-no-wrap align-stretch flex-row justify-space-between"
        >
          <div
            v-if="icon"
            class="d-flex align-center"
            style="margin-left: 20px"
          >
            <v-icon :icon="icon" />
          </div>
          <v-avatar
            v-if="image && $vuetify.display.width > 500"
            class="ma-1"
            :size="imageSize ? imageSize : 65"
            rounded="0"
          >
            <v-img :src="image" />
          </v-avatar>
          <div
            class="flex-grow-1 d-flex flex-column justify-center text-truncate"
          >
            <v-card-title
              v-if="title"
              class="py-0 my-0"
              :class="titleClass ? titleClass : 'text-h5 font-weight-light'"
            >
              {{ title }}
            </v-card-title>
            <v-card-subtitle v-if="subtitle" class="pb-1">
              {{ subtitle }}
            </v-card-subtitle>
          </div>
          <div class="d-flex flex-row flex-nowrap align-start">
            <slot name="system_buttons" />

            <l-customization-bar v-if="$slots.customize">
              <slot name="customize" />
            </l-customization-bar>

            <v-divider
              v-if="$slots.customize || $slots.system_buttons"
              vertical
              class="ms-2"
            />

            <v-btn
              v-if="minimizable"
              class="ms-2"
              icon="mdi-minus"
              variant="text"
              size="small"
              @click="minimize()"
            />
            <v-btn
              v-if="closable"
              class="ms-2"
              icon="mdi-close"
              variant="text"
              size="small"
              @click="close()"
            />
          </div>
        </div>
      </slot>

      <v-card-title v-if="$slots.header">
        <slot name="header" />
      </v-card-title>
      <v-card-text
        ref="container"
        class="d-flex align-stretch overflow-hidden pa-0 ma-0"
      >
        <div
          v-if="$slots.left"
          :style="`height:${container_height}px;${slotLeftStyle};`"
          :class="slotLeftClass"
        >
          <slot name="left" />
        </div>
        <div
          ref="main_container"
          class="flex-grow-1 overflow-auto"
          :class="{ 'pa-5': !compact, 'pa-0': compact, 'ma-0': compact }"
          @scroll="scroll"
        >
          <slot />
        </div>
        <div
          v-if="$slots.right"
          :style="`height:${container_height}px;${slotRightStyle};`"
          :class="slotRightClass"
        >
          <slot name="right" />
        </div>
      </v-card-text>

      <v-card-actions
        v-if="$slots.footer"
        :class="{ 'pa-0': compact_footer, 'ma-0': compact_footer }"
      >
        <slot name="footer" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import LCustomizationBar from "@/components/CustomizationBar.vue";

export default {
  name: "WindowComponent",
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    scrollPos: Number,
    title: String,
    subtitle: String,
    icon: String,
    image: String,
    compact: Boolean,
    compact_footer: Boolean,
    closable: Boolean,
    minimizable: Boolean,
    titleClass: String,
    dark: Boolean,
    index: [Boolean, Number, String],
    size: String,
    imageSize: Number,
    color: String,
    slotLeftClass: String,
    slotRightClass: String,
    slotLeftStyle: [String, Object],
    slotRightStyle: [String, Object],
  },
  components: {
    LCustomizationBar,
  },

  data: () => ({
    container_height: 0,
  }),
  computed: {
    visible: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },
    compact_screen: function () {
      return this.$vuetify.display.width <= 600;
    },
    compact_height: function () {
      return this.$vuetify.display.height <= 600;
    },
    w_width() {
      return this.compact_screen
        ? "100%"
        : this.size == "small"
          ? "500px"
          : this.size == "large"
            ? "95%"
            : "90%";
    },
    w_height() {
      return this.compact_screen || this.compact_height
        ? "100%"
        : this.size == "small"
          ? "550px"
          : "90%";
    },
  },
  watch: {
    visible() {
      this.listenerResize(this.visible);
    },
    index() {
      this.checkScroll();
      this.windowResize();
    },
    scrollPos(value) {
      const container = this.$refs.main_container;
      if (container) {
        container.scrollTo({
          top: value,
          behavior: "smooth",
        });
      }
    },
  },
  methods: {
    close() {
      this.$emit("close");
    },
    minimize() {
      this.$emit("minimize");
    },
    scroll() {
      let data = {};
      data.scroll_top = this.$refs.main_container.scrollTop;
      data.client_height = this.$refs.main_container.clientHeight;
      data.scroll_height = this.$refs.main_container.scrollHeight;
      data.scroll_bottom =
        data.scroll_height - data.scroll_top - data.client_height;
      this.$emit("scroll", data);
    },
    checkScroll() {
      if (this.$refs.main_container) {
        const div = this.$refs.main_container;
        const hasScroll = div.scrollHeight > div.clientHeight;
        this.$emit("hasScroll", hasScroll);
      } else {
        this.$emit("hasScroll", false);
      }
    },
    windowResize() {
      let el = this.$refs?.container?.$el;
      if (!el) {
        return;
      }

      let data = {
        container_width: el.clientWidth,
        container_height: el.clientHeight,
      };
      this.container_height = el.clientHeight;
      this.$emit("resize", data);
    },

    listenerResize(active) {
      if (active && this.visible) {
        if (this.$refs.container) {
          this.resizeObserver.observe(this.$refs.container.$el);
          window.addEventListener("resize", this.windowResize);
          this.windowResize();
        } else {
          const self = this;
          setTimeout(function () {
            self.listenerResize(active);
            self.checkScroll();
          }, 10);
        }
      } else {
        this.resizeObserver.disconnect();
        window.removeEventListener("resize", this.windowResize);
      }
    },
  },
  mounted() {
    this.resizeObserver = new ResizeObserver(() => {
      this.checkScroll();
    });

    if (this.visible) {
      this.listenerResize(this.visible);
    }
  },
};
</script>



================================================
FILE: src/components/buttons/Screen.vue
================================================
<template>
  <v-btn-group
    v-if="!is_mobile"
    :variant="variant"
    style="overflow: clip;"
  >
    <v-btn
      :size="size"
      :active="is_popup_opened"
      icon="mdi-open-in-new"
      :class="{ 'rotate-icon': is_selected }"
      @click="popup()"
    />

    <v-menu v-if="is_popup_opened" location="bottom">
      <template #activator="{ props }">
        <v-btn v-bind="props" :size="size" icon="mdi-chevron-down" density="compact" />
      </template>

      <v-list density="compact">
        <v-list-item @click="close">
          <v-list-item-title>{{ $t("popup.close") }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-btn-group>
</template>

<script>
export default {
  name: "ButtonScreenComponent",
  props: {
    module: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      default: "small",
    },
    variant: {
      type: String,
      default: "text",
    },
  },
  computed: {
    is_mobile: function () {
      return this.$appdata.get("is_mobile");
    },
    is_popup_opened: function () {
      return !!this.$appdata.get("popup");
    },
    popup_module: function () {
      return this.$appdata.get("popup_module");
    },
    is_selected: function () {
      return this.is_popup_opened && this.popup_module == this.module;
    },
  },
  methods: {
    popup: function () {
      if (this.is_selected) {
        this.$popup.exit();
      } else {
        this.$popup.open(this.module);
      }
    },
    close: function () {
      this.$popup.close();
    },
  },
};
</script>

<style scoped>
.rotate-icon {
  transform: rotate(180deg);
  transition: transform 0.3s ease;
}
</style>



================================================
FILE: src/components/inputs/CheckBox.vue
================================================
<template>
  <v-switch
    v-if="is_switch"
    v-model="input"
    :color="$theme.primary()"
    :disabled="disabled"
    :label="label"
    density="compact"
    hide-details
  />
  <v-checkbox
    v-else
    v-model="input"
    :color="$theme.primary()"
    :disabled="disabled"
    :label="label"
    density="compact"
    hide-details
  />
</template>

<script>
export default {
  name: "CheckBoxComponent",
  props: {
    modelValue: Boolean,
    label: String,
    disabled: Boolean,
    switch: Boolean,
  },
  computed: {
    input: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },
    is_switch() {
      return this.switch;
    },
  },
};
</script>



================================================
FILE: src/components/inputs/Search.vue
================================================
<template>
  <v-text-field
    v-model="input"
    :color="$theme.primary()"
    :disabled="disabled"
    :label="label"
    prepend-inner-icon="mdi-magnify"
    :append-inner-icon="input ? 'mdi-close' : ''"
    density="compact"
    variant="outlined"
    :hide-details="!disabled"
    :hint="disabled ? disabledHint : ''"
    :persistent-hint="disabled"
    :loading="disabled"
    :error="error"
    @click:appendInner="reset()"
  />
</template>

<script>
export default {
  name: "SearchComponent",
  props: {
    modelValue: String,
    label: String,
    disabled: Boolean,
    disabledHint: String,
    error: Boolean,
  },
  computed: {
    input: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },
  },
  methods: {
    reset() {
      this.input = "";
    },
  },
};
</script>



================================================
FILE: src/components/inputs/Select.vue
================================================
<template>
  <v-select
    v-model="input"
    v-model:menu="menu"
    :label="label"
    :items="items"
    :item-title="itemTitle"
    :item-value="itemValue"
    :prepend-inner-icon="icon"
    density="compact"
    variant="outlined"
    :multiple="multiple"
    hide-details
  >
    <template v-slot:menu-header="{ search, filteredItems }">
      <div class="pa-2 border-b">
        <v-text-field
          v-model="search.value"
          :error="!!search.value && !filteredItems.length"
          density="compact"
          :placeholder="$t('components.inputs.search') + '...'"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          clearable
          hide-details
        ></v-text-field>
      </div>
    </template>
  </v-select>
</template>

<script>
export default {
  name: "SelectComponent",

  props: {
    modelValue: [String, Number, Array],
    label: String,
    icon: String,
    multiple: {
      type: Boolean,
      default: false,
    },
    items: {
      type: Array,
      default: () => [],
    },
    itemValue: {
      type: String,
      default: "id",
    },
    itemTitle: {
      type: String,
      default: "value",
    },
    itemSubtitle: {
      type: String,
      default: null,
    },
  },

  data() {
    return {
      menu: false,
    };
  },

  computed: {
    input: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },
  },
};
</script>



================================================
FILE: src/helpers/Alert.js
================================================
import $dev from "@/helpers/Dev";
import $appdata from "@/helpers/AppData";

export default {
  show(data, callback = function () {}) {
    data = this.getData(data);

    $dev.write("dialog", data, typeof data, Array.isArray(data));

    $appdata.set("alert.value", "");
    $appdata.set("alert.show", true);
    $appdata.set("alert.title", data.title || null);
    $appdata.set("alert.text", data.text || null);
    $appdata.set("alert.error", data.error || null);
    $appdata.set("alert.color", data.color || "");
    $appdata.set(
      "alert.translate",
      data.translate == null || data.translate == undefined
        ? true
        : data.translate
    );
    $appdata.set(
      "alert.buttons",
      data.buttons || [{ text: "alert.close", color: "error", value: "close" }]
    );

    let tmr = setInterval(function () {
      if (!$appdata.get("alert.show")) {
        clearInterval(tmr);
        callback($appdata.get("alert.value"));
      }
    }, 100);
  },

  yesno(data, callback = function () {}) {
    data = this.getData(data);

    this.show(
      {
        ...data,
        buttons: [
          { text: "alert.no", color: "error", value: "no" },
          { text: "alert.yes", color: "info", value: "yes" },
        ],
      },
      (resp, ret) => {
        callback(resp, ret);
      }
    );
  },

  info(data, callback = function () {}) {
    data = this.getData(data);

    this.show(
      {
        ...data,
        buttons: [{ text: "alert.close", color: "error", value: "close" }],
      },
      (resp, ret) => {
        callback(resp, ret);
      }
    );
  },

  error(data, callback = function () {}) {
    data = this.getData(data);

    this.show(
      {
        ...data,
        buttons: [{ text: "alert.close", color: "error", value: "close" }],
      },
      (resp, ret) => {
        callback(resp, ret);
      }
    );
  },

  getData(data) {
    if (typeof data == "string") {
      data = { text: data };
    } else if (Array.isArray(data)) {
      data = {
        title: data[0] ?? null,
        text: data[1] ?? null,
      };
    }

    return data;
  },
};



================================================
FILE: src/helpers/AppData.js
================================================
import store from "@/store";

export default {
  set(param, value) {
    store.commit("setData", [param, value]);

    const popup = this.get("popup");
    if (
      popup &&
      param != "popup" &&
      param != "is_popup" &&
      param != "is_fullscreen"
    ) {
      if (popup.closed) {
        this.set("popup", null);
        //this.set("popup_module", null);
      } else {
        try {
          popup.postMessage({ param, value }, window.location.origin);
        } catch (e) {
          console.log(e);
        }
      }
    }
  },

  get(param, ifnull = null) {
    if (param && !store.getters.exists(param)) {
      return ifnull;
    }

    return store.getters.getData(param);
  },

  getFlatten() {
    let data = Object.assign({}, this.get());
    delete data.popup;
    delete data.is_popup;
    data = JSON.parse(JSON.stringify(data));
    return this.flatten(data);
  },

  addElement(param, value) {
    store.commit("addElementArray", [param, value]);
  },

  removeElement(param, value) {
    store.commit("removeElementArray", [param, value]);
  },

  toogle(param) {
    this.set(param, !this.get(param));
  },

  exists(param) {
    return store.getters.exists(param);
  },

  flatten(data, parent = "", result = {}) {
    for (let key in data) {
      const prop = data[key];
      const newKey = parent ? `${parent}.${key}` : key;
      if (typeof prop === "object" && !Array.isArray(prop) && prop !== null) {
        this.flatten(prop, newKey, result);
      } else {
        result[newKey] = prop;
      }
    }
    return result;
  },
};



================================================
FILE: src/helpers/Database.js
================================================
import $alert from "@/helpers/Alert";
import $path from "@/helpers/Path";
import $dev from "@/helpers/Dev";
import $storage from "@/helpers/Storage";

export default {
  async get(file) {
    try {
      const cache_name = `db:${file}`;
      const cache = $storage.get(cache_name, null, "session");

      if (cache) {
        $dev.write(`Lendo BD do cache`, file);
        return cache;
      }

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      $dev.write("Abrindo BD", `${$path.db(`/${file}`)}?${date}`);
      const response = await fetch(`${$path.db(`/${file}`)}?${date}`, {
        headers: {
          "Api-Token": import.meta.env.VITE_API_TOKEN,
        },
      });

      if (!response.ok) throw new Error();
      const data = await response.json();

      $dev.write("Salvando BD em cache", file);
      $storage.set(cache_name, data, "session");

      return data;
    } catch (error) {
      $alert.error({ text: "messages.file_database_not_found", error });
      return null;
    }
  },
};



================================================
FILE: src/helpers/DateTime.js
================================================
export default {
  shortTime(time) {
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    if (isNaN(time)) {
      const [h, m, s] = time.split(":").map(Number);
      hours = h;
      minutes = m;
      seconds = s;
    } else {
      hours = Math.floor(time / 3600);
      minutes = Math.floor((time % 3600) / 60);
      seconds = time % 60;
    }

    minutes += hours * 60;
    return `${minutes}:${String(Math.floor(seconds)).padStart(2, "0")}`;
  },

  toNumber(time) {
    const parts = time.split(":").map(Number);

    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;

    return hours * 3600 + minutes * 60 + seconds;
  },
};



================================================
FILE: src/helpers/Dev.js
================================================
import $appdata from "@/helpers/AppData";
import $alert from "@/helpers/Alert";

export default {
  write() {
    if (this.debug()) {
      console.log(...Array.from(arguments), " << ");
    }
  },
  debug() {
    const is_dev = $appdata.get("is_dev");
    return is_dev;
  },
  toogle() {
    const is_dev = $appdata.get("is_dev");
    $appdata.set("is_dev", !is_dev);
    $alert.info(
      "messages." +
        (is_dev ? "developer_mode_disabled" : "developer_mode_enabled")
    );
  },
};



================================================
FILE: src/helpers/Media.js
================================================
import $dev from "@/helpers/Dev";
import $appdata from "@/helpers/AppData";
import $userdata from "@/helpers/UserData";
import $datetime from "@/helpers/DateTime";
import $path from "@/helpers/Path";
import $alert from "@/helpers/Alert";
import $modules from "@/helpers/Modules";
import $database from "@/helpers/Database";

export default {
  async open(params) {
    if (typeof params != "object") {
      params = { id_music: params };
    }

    $dev.write("open media", params);

    // Conexão remota está ativada? Se sim, abre do programa desktop
    if ($userdata.get("remote.is_connected")) {
      const tag =
        params.mode == "audio" ? 1 : params.mode == "instrumental" ? 2 : 3;

      const url =
        $userdata.get("remote.url") +
        "/api/open-song?id=" +
        params.id_music +
        "&tag=" +
        tag +
        "&token=" +
        $userdata.get("remote.token");

      $alert.info("modules.media.alerts.open_remote");
      try {
        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
        });

        const ret = await response.json();
        if (ret.status != "ok") {
          $alert.error({
            text:
              ret.code == "INVALID_TOKEN"
                ? "modules.remote_control.messages.invalid_token"
                : "modules.remote_control.messages.error",
            error: ret.code,
          });
        }
      } catch (error) {
        $alert.error({
          text: "modules.media.alerts.open_remote_error",
          error: error,
        });
      }
      return;
    }

    this.stopAudio();
    this.clearVariables();

    const id_music = params.id_music;
    const minimized = params.minimized ? params.minimized : false;
    const id_album = params.id_album ? params.id_album : null;
    let mode = params.mode ? params.mode : "no_audio";

    $appdata.set("modules.media.loading", true);

    let data = await $database.get(`music_${id_music}`);
    if (data == null) {
      this.close(true);
      return;
    }
    $appdata.set("modules.media.data", data);

    $appdata.set("modules.media.id_music", id_music);
    $appdata.set("modules.media.id_album", id_album);
    $appdata.set("modules.media.config.slide_index", 0);
    $appdata.set("modules.media.config.title", data.name);
    $appdata.set("modules.media.config.last_slide", this.slides().length);
    $appdata.set("modules.media.times", []);
    this.setAlbumInfo(id_album);

    if (minimized) {
      this.minimize();
    } else {
      this.maximize();
    }

    if (mode == "audio" || mode == "instrumental") {
      //Será executado com áudio... cria o elemento de audio
      const audio = this.getElement();
      const volume = $appdata.get("modules.media.config.volume");
      audio.volume = volume / 100;

      this.pause(true);
      audio.currentTime = 0;

      //Grava os tempos dos slides
      $appdata.set(
        "modules.media.times",
        this.slides().map((item) =>
          $datetime.toNumber(
            mode == "audio" ? item.time : item.instrumental_time,
          ),
        ),
      );

      $appdata.set(
        "modules.media.config.audio",
        $path.file(
          mode == "audio" ? data.url_music : data.url_instrumental_music,
        ),
      );

      if (
        $appdata.get("is_online") &&
        $userdata.get("modules.media.lazy_load")
      ) {
        //Se a opção lazy_load estiver marcada, execução rápida (o audio vai carregando enquanto é executado)
        $appdata.set("modules.media.config.lazy", true);
        audio.src = $appdata.get("modules.media.config.audio");
        audio.load();
        $appdata.set("modules.media.loading", false);
        this.play();
      } else {
        //Se a opção lazy_load estiver desmarcada, execução lenta (o audio só é executado depois de totalmente carregado)
        $appdata.set("modules.media.config.lazy", false);
        let self = this;
        let request = new XMLHttpRequest();
        try {
          request.open("GET", $appdata.get("modules.media.config.audio"), true);
        } catch (error) {
          $alert.error(
            { text: "modules.media.alerts.not_loaded", error },
            function (a) {
              if (a) {
                self.open(id_music);
              }
            },
          );
          return;
        }

        request.responseType = "blob";
        request.onload = function () {
          if (this.status == 200) {
            audio.src = URL.createObjectURL(this.response);
            audio.load();
            self.play();
          } else {
            $alert.error(
              {
                text: "modules.media.alerts.not_loaded",
                error: request.statusText || "",
              },
              function (a) {
                if (a) {
                  self.open(id_music);
                }
              },
            );
          }
        };
        request.onerror = function () {
          $alert.error(
            {
              text: "modules.media.alerts.not_loaded",
              error: request.statusText || "",
            },
            function (a) {
              if (a) {
                self.open(id_music);
              }
            },
          );
          return;
        };

        request.send();
        $appdata.set("modules.media.loading", false);
      }
    } else {
      $appdata.set("modules.media.config.audio", "");
      $appdata.set("modules.media.loading", false);
    }

    $appdata.set("modules.media.config.mode", mode);
  },

  close(force = false) {
    //Se force for true, fechamento forçado. Sem diálogo de confirmação!
    if (!force) {
      const self = this;
      $alert.yesno("modules.media.alerts.close", function (btn) {
        if (btn == "yes") {
          self.close(true);
        }
      });
      return;
    }

    this.stopAudio();
    this.clearVariables();
    $appdata.set("modules.media.show", false);
    $appdata.set("modules.media.minimized", false);
  },

  async openLyric(params) {
    if (params == null || params == undefined) {
      params = {
        id_music: $appdata.get("modules.media.id_music"),
        id_album: $appdata.get("modules.media.id_album"),
      };
    } else if (typeof params != "object") {
      params = { id_music: params };
    }
    $dev.write("open lyric", params);

    const id_music = params.id_music;
    const id_album = params.id_album ? params.id_album : null;

    $appdata.set("modules.lyric.loading", true);

    let data = await $database.get(`music_${id_music}`);
    if (data == null) {
      this.closeLyric();
      return;
    }

    $appdata.set("modules.lyric.data", data);

    $appdata.set("modules.lyric.id_music", id_music);
    $appdata.set("modules.lyric.id_album", id_album);
    $appdata.set("modules.lyric.config.title", data.name);

    this.setAlbumInfo(id_album, "lyric");

    $appdata.set("modules.lyric.show", true);
    $appdata.set("modules.lyric.loading", false);
  },
  closeLyric() {
    $dev.write("close lyric");
    $appdata.set("modules.lyric.show", false);

    $appdata.set("modules.lyric.data", {});
    $appdata.set("modules.lyric.id_music", null);
    $appdata.set("modules.lyric.id_album", null);
    $appdata.set("modules.lyric.config.title", null);
    $appdata.set("modules.lyric.loading", false);
  },

  async openAlbum(id_album) {
    $dev.write("open album", id_album);

    $appdata.set("modules.album.loading", true);

    let data = await $database.get(`album_${id_album}`);
    if (data == null) {
      this.closeAlbum();
      return;
    }

    $appdata.set("modules.album.data", data);

    let hymnal = data.categories.filter((item) =>
      item.startsWith("hymnal."),
    )[0];
    if (hymnal) {
      $modules.open(hymnal.split(".")[1]);
      return;
    }

    $appdata.set("modules.album.id_album", id_album);
    $appdata.set("modules.album.show", true);
    $appdata.set("modules.album.loading", false);
  },
  closeAlbum() {
    $dev.write("close album");
    $appdata.set("modules.album.show", false);

    $appdata.set("modules.album.data", {});
    $appdata.set("modules.album.id_album", null);
    $appdata.set("modules.album.loading", false);
  },

  async openAudio(params) {
    if (typeof params != "object") {
      params = { id_music: params };
    }
    $dev.write("open audio", params);

    const id_music = params.id_music;
    let mode = params.mode ? params.mode : "audio";

    $appdata.set("loading", true);

    let data = await $database.get(`music_${id_music}`);
    if (data == null) {
      $appdata.set("loading", false);
      return;
    }

    const url =
      mode == "instrumental" ? data.url_instrumental_music : data.url_music;

    window.open($path.file(url), "_blank");

    $appdata.set("loading", false);
  },

  stopAudio() {
    const audio = this.getElement();
    this.pause(true, () => {
      audio.setAttribute("src", "");
    });
  },

  clearVariables() {
    $appdata.set("modules.media.data", {});
    $appdata.set("modules.media.id_music", null);
    $appdata.set("modules.media.config.title", "");
    $appdata.set("modules.media.config.subtitle", "");
    $appdata.set("modules.media.config.track", 0);
    $appdata.set("modules.media.config.image", "");
    $appdata.set("modules.media.config.slide_index", 0);
    $appdata.set("modules.media.config.last_slide", 0);
    $appdata.set("modules.media.config.audio", "");
    $appdata.set("modules.media.config.lazy", false);
    $appdata.set("modules.media.config.current_time", 0);
    $appdata.set("modules.media.config.duration", 0);
    $appdata.set("modules.media.config.progress", 0);
    $appdata.set("modules.media.config.slide_progress", 0);
    $appdata.set("modules.media.config.buffered", 0);
    $appdata.set("modules.media.config.volume", 100);
    $appdata.set("modules.media.config.is_paused", false);
    $appdata.set("modules.media.config.is_fading", false);
  },

  minimize() {
    $appdata.set("modules.media.show", false);
    $appdata.set("modules.media.minimized", true);
  },

  maximize() {
    $appdata.set("modules.media.show", true);
    $appdata.set("modules.media.minimized", false);
  },

  isMinimized() {
    return $appdata.get("modules.media.minimized", false);
  },

  isLoading() {
    return $appdata.get("modules.media.loading", false);
  },

  config() {
    return $appdata.get("modules.media.config");
  },

  slides() {
    let data = $appdata.get("modules.media.data");

    let prev_image = data?.url_image;
    let prev_image_position = data?.image_position;

    return [
      {
        lyric: data?.name,
        cover: true,
        time: "00:00:00",
        instrumental_time: "00:00:00",
        url_image: data?.url_image,
        image_position: data?.image_position,
      },
      ...Object.values(data?.lyric || {})
        .filter((lyric) => lyric.show_slide === 1)
        .sort((a, b) => a.order - b.order)
        .map((lyric) => {
          if (lyric.url_image) {
            prev_image = lyric.url_image;
            prev_image_position = lyric.image_position;
          }
          return {
            ...lyric,
            cover: false,
            lyric: lyric.lyric ? lyric.lyric.replace(/[\r\n]+/g, "<br>") : "",
            url_image: prev_image,
            image_position: prev_image_position,
          };
        }),
    ];
  },

  slide() {
    let slides = this.slides() ?? [];
    let index = $appdata.get("modules.media.config.slide_index");
    return slides[index];
  },

  goToSlide(index) {
    const last_slide = $appdata.get("modules.media.config.last_slide");

    if (index > last_slide - 1) {
      index = last_slide - 1;
    }
    if (index < 0) {
      index = 0;
    }

    const duration = $appdata.get("modules.media.config.duration");
    const audio = $appdata.get("modules.media.config.audio");

    if (duration > 0 && audio != "") {
      const times = $appdata.get("modules.media.times");
      this.goToTime(times[index] || 0);
    } else {
      $appdata.set("modules.media.config.slide_index", index);
    }
  },
  goToTime(time) {
    const audio = this.getElement();
    const duration = $appdata.get("modules.media.config.duration");
    if (time == undefined || time < 0) {
      time = 0;
    } else if (time > duration) {
      time = duration;
    }
    audio.currentTime = time;
  },
  advanceTime(time = 10) {
    const duration = $appdata.get("modules.media.config.duration");
    const audio = $appdata.get("modules.media.config.audio");
    const current_time = $appdata.get("modules.media.config.current_time");

    if (duration > 0 && audio != "") {
      this.goToTime(current_time + time);
    }
  },

  play() {
    this.pause(false);
  },
  pause(bool = true, callback) {
    const audio = this.getElement();
    const fade_audio = $userdata.get("modules.media.fade_audio");

    if (bool) {
      if (fade_audio) {
        this.fadeOutAudio(() => {
          audio.pause();
          $appdata.set("modules.media.config.is_paused", bool);
          if (callback) callback();
        });
      } else {
        audio.pause();
        $appdata.set("modules.media.config.is_paused", bool);
        if (callback) callback();
      }
    } else {
      let self = this;
      audio.play().catch((e) => {
        $alert.error(
          {
            text: "modules.media.alerts.not_loaded",
            error: e || "",
          },
          function (a) {
            if (a) {
              self.open($appdata.get("modules.media.id_music"));
            }
          },
        );
      });
      if (fade_audio) {
        this.fadeInAudio(() => {
          if (callback) callback();
        });
      } else {
        const volume = $appdata.get("modules.media.config.volume") / 100;
        audio.volume = volume;
        if (callback) callback();
      }
      $appdata.set("modules.media.config.is_paused", bool);
    }
  },

  fadeInAudio(callback) {
    const audio = this.getElement();

    $appdata.set("modules.media.config.is_fading", true);
    const max_volume = $appdata.get("modules.media.config.volume") / 100;

    const fadeOut = setInterval(() => {
      if (audio.volume < max_volume) {
        audio.volume = Math.min(audio.volume + 0.05, max_volume); // Incrementa suavemente.
      } else {
        $appdata.set("modules.media.config.is_fading", false);
        clearInterval(fadeOut);
        if (callback) callback();
      }
    }, 60);
  },
  fadeOutAudio(callback) {
    const audio = this.getElement();

    if (audio.paused) {
      if (callback) callback();
      return;
    }

    $appdata.set("modules.media.config.is_fading", true);

    const fadeOut = setInterval(() => {
      if (audio.volume > 0) {
        audio.volume = Math.max(audio.volume - 0.05, 0);
      } else {
        $appdata.set("modules.media.config.is_fading", false);
        clearInterval(fadeOut);
        if (callback) callback();
      }
    }, 60);
  },

  firstSlide() {
    this.goToSlide(0);
  },
  prevSlide() {
    const slide_index = $appdata.get("modules.media.config.slide_index");
    this.goToSlide(slide_index - 1);
  },
  nextSlide() {
    const slide_index = $appdata.get("modules.media.config.slide_index");
    this.goToSlide(slide_index + 1);
  },
  lastSlide() {
    const last_slide = $appdata.get("modules.media.config.last_slide");
    this.goToSlide(last_slide - 1);
  },
  setVolume(val) {
    const audio = this.getElement();
    audio.volume = val / 100;
    $appdata.set("modules.media.config.volume", val);
  },
  toogleVolume() {
    let volume = $appdata.get("modules.media.config.volume");
    volume = volume < 100 ? 100 : 0;
    this.setVolume(volume);
  },

  fullscreen(value = true) {
    $appdata.set("modules.media.config.fullscreen", value);
  },

  setAlbumInfo(id_album, module = "media") {
    const data = $appdata.get(`modules.${module}.data`);
    if (data.albums.length <= 0) {
      $appdata.set(`modules.${module}.config.subtitle`, "");
      $appdata.set(`modules.${module}.config.track`, 0);
      $appdata.set(`modules.${module}.config.image`, "");
      return;
    }

    let album = null;
    if (id_album) {
      album = data.albums.filter((item) => item.id_album == id_album)[0];
    } else if (data.albums.length === 1) {
      album = data.albums[0];
    } else {
      album = data.albums.sort((a, b) => a.order - b.order)[0];
    }

    if (!album) {
      $appdata.set(`modules.${module}.config.subtitle`, "");
      $appdata.set(`modules.${module}.config.track`, 0);
      $appdata.set(`modules.${module}.config.image`, "");
      return;
    }

    $appdata.set(`modules.${module}.config.subtitle`, album.name);
    $appdata.set(`modules.${module}.config.track`, album.track);
    $appdata.set(`modules.${module}.config.image`, album.url_image);
  },

  timeUpdate() {
    const duration_db =
      $appdata.get("modules.media.config.mode") == "audio"
        ? $appdata.get("modules.media.data.duration", "00:00")
        : $appdata.get("modules.media.data.instrumental_duration", "00:00");

    const audio = this.getElement();
    const current_time = isNaN(audio.currentTime) ? 0 : audio.currentTime;
    const duration =
      isNaN(audio.duration) || !isFinite(audio.duration)
        ? $datetime.toNumber(duration_db)
        : audio.duration;
    const progress = duration <= 0 ? 0 : (current_time / duration) * 100;
    let buffered = 0;

    $appdata.set("modules.media.config.current_time", current_time);
    $appdata.set("modules.media.config.duration", duration);
    $appdata.set("modules.media.config.progress", progress);

    if (!$appdata.get("modules.media.config.lazy")) {
      try {
        audio.buffered = 100;
      } catch (error) {
        //
      }
      buffered = 100;
    } else {
      buffered = 0;
      let audio_buffered = audio.buffered; // Obter intervalos de buffer carregados
      if (audio_buffered.length > 0) {
        buffered = (audio_buffered.end(0) / audio.duration) * 100;
      }
    }

    $appdata.set("modules.media.config.buffered", buffered);

    const times = $appdata.get("modules.media.times");

    const slide_index =
      times && times?.length
        ? times.filter((time) => time <= current_time).length - 1
        : 1;
    $appdata.set(
      "modules.media.config.slide_index",
      slide_index <= 0 ? 0 : slide_index,
    );

    const start_time = times && times?.length ? times[slide_index] : 0;
    const end_time =
      times && times?.length ? times[slide_index + 1] || duration : duration;
    const slide_progress =
      ((current_time - start_time) / (end_time - start_time)) * 100;
    $appdata.set("modules.media.config.slide_progress", slide_progress);

    this.checkTime();
  },
  checkTime() {
    const is_paused = $appdata.get("modules.media.config.is_paused");
    const current_time = $appdata.get("modules.media.config.current_time");
    const duration = $appdata.get("modules.media.config.duration");
    if (!is_paused && current_time >= duration && duration > 0) {
      this.close(true);
    }
  },
  getElement() {
    let el;
    let id = "__audio";
    if (!document.getElementById(id)) {
      el = document.createElement("audio");
      el.setAttribute("id", id);
      el.setAttribute("preload", "auto");
      document.body.appendChild(el);
      el.addEventListener("timeupdate", this.timeUpdate.bind(this));
      el.addEventListener("progress", this.timeUpdate.bind(this));
    } else {
      el = document.getElementById(id);
    }

    el.setAttribute("autoplay", true);
    return el;
  },
};



================================================
FILE: src/helpers/ModuleManager.js
================================================
// @/helpers/ModuleManager.js
import $appdata from "./AppData";
import $userdata from "./UserData";
import $dev from "./Dev";
import $alert from "./Alert";

export default {
  modules: new Map(),
  manifests: new Map(),

  register(moduleName, module) {
    if (!this.modules.has(moduleName)) {
      this.modules.set(moduleName, module);
      return true;
    }
    return false;
  },

  async installModule(module) {
    try {
      // Auto-configure module
      const manifest = module.manifest;

      if (!manifest.active) {
        if ($appdata.get("is_dev")) {
          //Mostra o alerta somente no modo de desenvolvimento!
          console.warn(`Module ${module.manifest.id} disabled`);
        }
        return;
      }

      // Register module in application's modules
      $appdata.set(`modules.${manifest.id}`, {
        id: manifest.id,
        title: manifest.translationKey || `modules.${manifest.id}.title`,
        icon: manifest.icon || "mdi-puzzle",
        show: false,
        language: manifest.language,
        type: "module",
        showInMainMenu: manifest.showInMainMenu || false,
        development: manifest.development || false,
        ...(manifest.moduleOptions || {}),
        manifest,
      });

      // Add to module groups
      const category = manifest.category;
      if (category) {
        const moduleGroups = $appdata.get("module_group") || {};
        // Create category if not exists
        /*if (!moduleGroups[category]) {
        moduleGroups[category] = {
          title: `module_group.${category}.title`,
          modules: [],
        };
      }*/

        // Add module to category if not already present
        if (!moduleGroups[category].modules.includes(manifest.id)) {
          moduleGroups[category].modules.push(manifest.id);
        }

        // Save updated module groups
        $appdata.set("module_group", moduleGroups);
      }

      // Add to main menu
      const showInMainMenu = manifest.showInMainMenu;
      if (showInMainMenu) {
        const moduleMainMenu = $appdata.get("menu") || {};
        // Add module to main menu if not already present
        if (!moduleMainMenu.modules.includes(manifest.id)) {
          moduleMainMenu.modules.push(manifest.id);
        }
        // Save updated module groups
        $appdata.set("menu", moduleMainMenu);
      }

      // Auto-load translations
      if (manifest.translations) {
        Object.entries(manifest.translations).forEach(
          ([lang, translations]) => {
            this.i18n.global.mergeLocaleMessage(lang, {
              modules: { [manifest.id]: translations },
            });
          },
        );
      }

      // Install customization options
      if (manifest.customization) {
        Object.entries(manifest.customization).forEach(
          ([key, customization]) => {
            $userdata.setIfNull(
              `modules.${manifest.id}.${key}`,
              customization.default ?? null,
            );
          },
        );
      }

      // Log installation
      $dev.write(
        "module_install",
        manifest.id,
        manifest.development ? "[dev]" : "",
      );

      return true;
    } catch (error) {
      console.error(`Failed to install module ${module.manifest.id}:`, error);
      return false;
    }
  },

  // Remote module installation method
  async installRemoteModule(moduleId) {
    try {
      // Fetch module manifest from remote module store
      const manifest = await this.fetchModuleManifest(moduleId);

      // Download module module dynamically
      const ModuleClass = await this.downloadModuleModule(manifest);

      // Create module instance
      const moduleInstance = new ModuleClass();

      // Register and install module
      if (this.register(moduleId, moduleInstance)) {
        await this.installModule(moduleInstance);
        return moduleInstance;
      }

      return null;
    } catch (error) {
      console.error("Remote module installation failed:", error);
      throw error;
    }
  },

  async init(i18n) {
    this.i18n = i18n;

    const modules = import.meta.glob("@/modules/**/index.js", {
      eager: true,
    });

    for (const path in modules) {
      const ModuleClass = modules[path].default;
      if (typeof ModuleClass === "function") {
        const module = new ModuleClass();
        const parts = path.split("/");
        if (module?.manifest?.id != parts[parts.length - 2]) {
          $alert.error({
            text: "messages.misconfigured_module",
            error: path,
          });
        } else {
          await this.installModule(module);
        }
      }
    }

    //Importa as interfaces dos modules
    $appdata.set("import_modules", true);

    // Optional: Remote module installation
    try {
      // Uncomment and modify as needed
      // await ModuleManager.installRemoteModule('some-module-id');
    } catch (error) {
      console.error("Failed to install remote module", error);
    }
  },
};



================================================
FILE: src/helpers/Modules.js
================================================
import $dev from "@/helpers/Dev";
import $appdata from "@/helpers/AppData";

export default {
  open(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    $dev.write("open", id);
    $appdata.set(`modules.${id}.show`, true);
  },
  close(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    $dev.write("close", id);
    $appdata.set(`modules.${id}.show`, false);

    //Remove da TrayArea
    this.removeTray(id);
  },
  minimize(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    if ($appdata.get(`modules.${id}.title`, "") == "") {
      console.error(`Módulo ${id} não possui a prorpiedade "title"!`);
      return;
    }
    if ($appdata.get(`modules.${id}.icon`, "") == "") {
      console.error(`Módulo ${id} não possui a prorpiedade "icon"!`);
      return;
    }
    $dev.write("minimize", id);
    $appdata.set(`modules.${id}.show`, false);

    //Adiciona na TrayArea
    this.addTray(id);
  },
  get(list = null) {
    if (list == null) {
      return $appdata.get("modules");
    }

    if (typeof list == "string") {
      return $appdata.get(`modules.${list}`);
    }

    if (!list || list.length <= 0) {
      return {};
    }

    try {
      return {
        ...Object.fromEntries(
          list.map((module) => {
            return [
              module,
              { id: module, ...$appdata.get(`modules.${module}`) } || {
                invalid: true,
                title: "modules.invalid.title",
                icon: "mdi-alert-circle-outline",
              },
            ];
          })
        ),
      };
    } catch (e) {
      return {};
    }
  },
  addTray(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    $appdata.addElement(`tray_area.modules`, id);
  },
  removeTray(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    $appdata.removeElement(`tray_area.modules`, id);
  },
  getTray() {
    return this.get($appdata.get("tray_area.modules"));
  },
  setTray(data) {
    return $appdata.set("tray_area.modules", data);
  },

  getMenu() {
    return this.get($appdata.get("menu.modules"));
  },

  getGroups() {
    const module_group = JSON.parse(
      JSON.stringify($appdata.get("module_group") || {})
    );
    Object.keys(module_group).forEach((key) => {
      if (module_group[key].modules?.length <= 0) {
        module_group[key].modules = {};
      }

      module_group[key].modules = this.get(module_group[key].modules || []);
    });
    return module_group;
  },

  check(id) {
    return $appdata.exists(`modules.${id}`);
  },

  sort(modules, $t) {
    return Object.entries(modules)
      .sort(([, v1], [, v2]) => {
        const t1 = v1?.title ? $t(v1.title).toLowerCase() : "";
        const t2 = v2?.title ? $t(v2.title).toLowerCase() : "";
        return t1.localeCompare(t2);
      })
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
  },
};



================================================
FILE: src/helpers/ModuleTypes.js
================================================
// @/helpers/ModuleTypes.js
export const ModuleManifest = {
  create(options) {
    // Add validation
    const required = ["id", "name"];
    for (const field of required) {
      if (!options[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return {
      id: options.id,
      name: options.name,
      description: options.description,
      author: options.author,
      category: options.category || "misc",
      icon: options.icon,
      dependencies: options.dependencies || [],
    };
  },
};

export class BaseModule {
  constructor(manifest) {
    this.manifest = manifest;
    this.config = manifest.config || {};
  }

  // eslint-disable-next-line no-unused-vars
  async install(app, context) {
    // Abstract method to be implemented by specific Modules
    throw new Error("Module must implement install method");
  }

  // eslint-disable-next-line no-unused-vars
  async uninstall(context) {
    // Optional uninstall method
  }

  getConfig() {
    return this.config;
  }

  setConfig(config) {
    this.config = { ...this.config, ...config };
  }

  // Utility methods for module developers
  registerComponent(app, component, name) {
    app.component(name || component.name, component);
  }

  registerRoute(router, route) {
    router.addRoute(route);
  }

  registerStoreModule(store, module) {
    store.registerModule(this.manifest.id, module);
  }
}



================================================
FILE: src/helpers/Path.js
================================================
export default {
  db(path) {
    const url = import.meta.env.VITE_URL_DATABASE;
    return url + path;
  },
  file(path) {
    const url = import.meta.env.VITE_URL_FILES;
    return url + path;
  },
};



================================================
FILE: src/helpers/Popup.js
================================================
import $appdata from "@/helpers/AppData";
import $window from "@/helpers/Window";

let popup = null;

export default {
  async open(params) {
    if (typeof params != "object") {
      params = { module: params };
    }

    popup = $appdata.get("popup");
    if (popup && !popup.closed) {
      popup.focus();
    } else {
      popup = $window.open("/popup", "PopupWindow", "width=800,height=600");
    }
    $appdata.set("popup_module", params.module);
    $appdata.set("popup", popup);
  },
  async exit() {
    $appdata.set("popup_module", "");
  },
  async close() {
    popup.close();
    await this.exit();
    $appdata.set("popup", null);
  },
};



================================================
FILE: src/helpers/Storage.js
================================================
export default {
  set(item, data, type = "local") {
    if (typeof data == "object") {
      data = JSON.stringify(data);
    }

    this.storage(type).setItem(item, data);
  },
  get(item, ifnull = null, type = "local") {
    let data = this.storage(type).getItem(item);

    if (!data) {
      return ifnull;
    }

    if (ifnull == null) {
      let data_parse;
      try {
        data_parse = JSON.parse(data);
      } catch (e) {
        data_parse = data;
      }
      return data_parse;
    } else if (typeof ifnull == "object") {
      return JSON.parse(data);
    } else {
      return data;
    }
  },
  remove(item, type = "local") {
    this.storage(type).removeItem(item);
  },
  removeAll(item, type = "local") {
    for (let i = this.storage(type).length - 1; i >= 0; i--) {
      const key = this.storage(type).key(i);
      if (key.split(":")[0] == item) {
        this.remove(key);
      }
    }
  },

  storage(type = "local") {
    if (type == "session") {
      return sessionStorage;
    } else {
      return localStorage;
    }
  },
};



================================================
FILE: src/helpers/String.js
================================================
export default {
  clean(text) {
    text = text || "";

    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  },
  sort(a, b) {
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }

    a = a || "";
    b = b || "";

    return a
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .localeCompare(
        b
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      );
  },
};



================================================
FILE: src/helpers/Theme.js
================================================
import $appdata from "@/helpers/AppData";

export default {
  primary() {
    return !$appdata.get("is_dark") ? "primary" : undefined;
  },
};



================================================
FILE: src/helpers/UserData.js
================================================
import $dev from "@/helpers/Dev";
import $storage from "@/helpers/Storage";
import $appdata from "@/helpers/AppData";

export default {
  save() {
    $dev.write("salvando dados");
    /*if (store.state.desktop) {
          // SE FOR APLICAÇÃO DESKTOP, SALVA AS CONFIGURAÇÕES NA MAQUINA DO USUARIO
          IPC.send('save_data', JSON.stringify(store.state.data));
      }*/

    //Salvar no Storage
    $storage.set("user_data", $appdata.get("user_data"));
  },
  load() {
    $dev.write("carregando dados");
    let data = $appdata.flatten($storage.get("user_data"));

    Object.keys(data).map((item) => {
      $appdata.set(`user_data.${item}`, data[item]);
    });
  },

  set(param, value) {
    $dev.write("set userdata", { param, value });
    $appdata.set(`user_data.${param}`, value);

    //Salvar os Dados
    this.save();
  },

  setIfNull(param, value) {
    $dev.write("set userdata", { param, value });
    if (
      $appdata.get(`user_data.${param}`) === null ||
      $appdata.get(`user_data.${param}`) === undefined
    ) {
      $appdata.set(`user_data.${param}`, value);
    }
  },

  get(param, ifnull = null) {
    //$dev.write("get userdata", { param, ifnull });
    if (!param) {
      return $appdata.get("user_data", ifnull);
    }
    return $appdata.get(`user_data.${param}`, ifnull);
  },
};



================================================
FILE: src/helpers/Window.js
================================================
export default {
  open(url, target, features) {
    if (url.startsWith("/")) {
      url = (import.meta.env.BASE_URL ?? "/") + url.slice(1);
    }
    return window.open(url, target, features);
  },
};



================================================
FILE: src/lang/es.json
================================================
{
    "app": {
        "name": "Loor JA"
    },
    "modules": {
        "invalid": {
            "title": "#Error#"
        }
    },
    "module_group": {
        "musics": {
            "title": "Músicas"
        },
        "bible": {
            "title": "Biblia"
        },
        "utilities": {
            "title": "Utilidades"
        }
    },
    "components": {
        "letterpagination": {
            "all": "Todas"
        },
        "datatable": {
            "alerts": {
                "not_found": "¡No se pudo encontrar el archivo para mostrar esta información!"
            }
        },
        "inputs": {
            "search": "Buscar"
        },
        "customization": {
            "restore": "Restaurar",
            "restore_configs": "Restaurar Configuración",
            "restore_dialog": "¿Quieres restaurar la configuración?",
            "fit": {
                "none": "Ninguno",
                "fill": "Expandir",
                "contain": "Ajustar",
                "cover": "Rellenar"
            }
        }
    },
    "alert": {
        "close": "Cerrar",
        "yes": "Sí",
        "no": "No",
        "wait": "Aguardar..."
    },
    "popup": {
        "close": "Cerrar Ventana"
    },
    "messages": {
        "file_database_not_found": "Archivo de datos no encontrado!",
        "developer_mode_enabled": "Modo DESARROLLADOR activado!",
        "developer_mode_disabled": "Modo DESARROLLADOR desactivado!",
        "error_import_module": "Error al importar el módulo",
        "misconfigured_module": "Este módulo está mal configurado. ¡La identificación ingresada en manifest.json debe tener el mismo nombre que la carpeta donde se encuentra!"
    }
}


================================================
FILE: src/lang/pt.json
================================================
{
    "app": {
        "name": "Louvor JA"
    },
    "modules": {
        "invalid": {
            "title": "#Erro#"
        }
    },
    "module_group": {
        "musics": {
            "title": "Músicas"
        },
        "bible": {
            "title": "Bíblia"
        },
        "utilities": {
            "title": "Utilitários"
        }
    },
    "components": {
        "letterpagination": {
            "all": "Todas"
        },
        "datatable": {
            "alerts": {
                "not_found": "Não foi possível localizar o arquivo para exibir essas informações!"
            }
        },
        "inputs": {
            "search": "Buscar"
        },
        "customization": {
            "restore": "Restaurar",
            "restore_configs": "Restaurar Configurações",
            "restore_dialog": "Deseja restaurar as configurações?",
            "fit": {
                "none": "Nenhum",
                "fill": "Ampliar",
                "contain": "Ajustar",
                "cover": "Preencher"
            }
        }
    },
    "alert": {
        "close": "Fechar",
        "yes": "Sim",
        "no": "Não",
        "wait": "Aguarde..."
    },
    "popup": {
        "close": "Fechar Janela"
    },
    "messages": {
        "file_database_not_found": "Arquivo de dados não encontrado!",
        "developer_mode_enabled": "Modo DESENVOLVEDOR ativado!",
        "developer_mode_disabled": "Modo DESENVOLVEDOR desativado!",
        "error_import_module": "Erro ao importar módulo",
        "misconfigured_module": "Este módulo está mal configurado. O id informado no manifest.json deve ter o mesmo nome da pasta onde está localizado!"
    }
}


================================================
FILE: src/layout/Alert.vue
================================================
<template>
  <v-dialog
    v-model="alert.show"
    max-width="450"
    persistent
    :theme="$theme.primary()"
  >
    <v-card :color="alert.color">
      <v-card-title v-if="alert.title">
        <div v-if="alert.translate" v-html="$t(alert.title)" />
        <div v-else v-html="alert.title" />
      </v-card-title>
      <v-spacer></v-spacer>
      <v-card-text v-if="alert.text">
        <div v-if="alert.translate" v-html="$t(alert.text)" />
        <div v-else v-html="alert.text" />
        <small v-if="alert.error" class="text-error" v-html="alert.error" />
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          v-for="(btn, index) in alert.buttons"
          :key="index"
          :color="btn.color ? btn.color : layout.color"
          @click="clickBtn(btn.value)"
          variant="text"
        >
          {{ $t(btn.text) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: "AlertLayout",
  computed: {
    alert: function () {
      return this.$appdata.get("alert");
    },
  },
  methods: {
    clickBtn(value) {
      this.$appdata.set("alert.value", value);
      this.$appdata.set("alert.show", false);
    },
  },
};
</script>



================================================
FILE: src/layout/Apps.vue
================================================
<template>
  <div class="apps">
    <v-expansion-panels
      v-model="panels_active"
      flat
      multiple
      :rounded="false"
      class="ma-0 pa-0"
    >
      <v-expansion-panel
        v-for="(group, group_key) in module_group"
        :key="group_key"
        class="ma-0 pa-0"
      >
        <v-expansion-panel-title
          v-if="countModules(group.modules) != 0"
          class="my-0 py-0"
        >
          {{ $t(group.title) }}
        </v-expansion-panel-title>
        <v-expansion-panel-text
          v-if="countModules(group.modules) != 0"
          class="ma-0 pa-0"
        >
          <v-container fluid class="ma-0 pa-0">
            <v-row class="ma-0 pa-0" style="gap: 5px">
              <template
                v-for="(module, module_key) in sortModules(group.modules)"
                :key="module_key"
              >
                <v-card
                  v-if="
                    module.language
                      ? module.language == language
                      : !module.development || (is_dev && module.development)
                  "
                  :color="
                    module.invalid
                      ? 'error'
                      : module.development
                        ? 'warning'
                        : $theme.primary()
                  "
                  @click="$modules.open(module_key)"
                  class="ma-1"
                  :width="140"
                >
                  <v-card-text
                    class="d-flex flex-column align-center justify-center h-100 px-0"
                  >
                    <v-icon
                      :icon="module.icon"
                      color="#FFFFFF"
                      :size="40"
                      style="flex: 1"
                    />
                    <v-card-title
                      class="text-center font-weight-light text-title-small"
                      style="text-wrap: initial"
                    >
                      <small>{{ module.title ? $t(module.title) : "" }}</small>
                    </v-card-title>
                  </v-card-text>
                </v-card>
              </template>
            </v-row>
          </v-container>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script>
export default {
  name: "AppsLayout",
  data: () => ({
    panels_active: [],
  }),
  watch: {
    module_group() {
      this.panels_active = Object.keys(this.module_group).map((_, key) => key);
    },
  },
  computed: {
    module_group() {
      return Object.entries(this.$modules.getGroups())
        .filter(([, value]) => Object.keys(value.modules).length > 0)
        .reduce((result, [key, value]) => {
          result[key] = value;
          return result;
        }, {});
    },
    is_dev: {
      get() {
        return this.$appdata.get("is_dev");
      },
      set(value) {
        if (!value) {
          this.$appdata.set("is_dev", value);
        }
      },
    },
    language: {
      get() {
        return this.$userdata.get("language");
      },
      set(value) {
        if (!value) {
          this.$userdata.set("language", value);
        }
      },
    },
  },
  methods: {
    sortModules(modules) {
      //Ordena pelo idioma selecionado
      return this.$modules.sort(modules, this.$t);
    },
    countModules(modules) {
      return Object.keys(modules).filter((key) =>
        !this.is_dev
          ? !modules[key].development || modules[key].development === false
          : true,
      ).length;
    },
  },
  mounted() {
    this.panels_active = Object.keys(this.module_group).map((_, key) => key);
  },
};
</script>

<style scoped>
.apps {
  overflow: auto !important;
  width: 100%;
}
</style>



================================================
FILE: src/layout/AppsRibbon.vue
================================================
<template>
  <v-card flat :rounded="0">
    <v-sheet color="red">
      <v-tabs v-model="tab" :bg-color="$theme.primary()" :border="0">
        <v-tab
          v-for="(group, group_key) in module_group"
          :key="group_key"
          :value="group_key"
          v-show="countModules(group.modules) != 0"
          show-arrows
          class="px-8"
        >
          {{ $t(group.title) }}
        </v-tab>
      </v-tabs>
    </v-sheet>
    <v-tabs-window v-model="tab">
      <v-tabs-window-item
        v-for="(group, group_key) in module_group"
        :key="group_key"
        :value="group_key"
        v-show="countModules(group.modules) != 0"
      >
        <v-slide-group show-arrows>
          <v-slide-group-item
            v-for="(module, module_key) in sortModules(group.modules)"
            :key="module_key"
          >
            <v-card
              flat
              :rounded="0"
              v-if="
                module.language
                  ? module.language == language
                  : !module.development || (is_dev && module.development)
              "
              :color="
                module.invalid ? 'error' : module.development ? 'warning' : ''
              "
              @click="$modules.open(module_key)"
            >
              <v-card-text
                class="d-flex flex-column align-center justify-center h-100 pa-0 pt-1 px-2"
              >
                <v-icon :icon="module.icon" :size="40" style="flex: 1" />
                <v-card-title
                  class="text-center font-weight-light text-title-small"
                  style="text-wrap: initial"
                >
                  <small>{{ module.title ? $t(module.title) : "" }}</small>
                </v-card-title>
              </v-card-text>
            </v-card>
          </v-slide-group-item>
        </v-slide-group>
      </v-tabs-window-item>
    </v-tabs-window>
    <v-divider />
  </v-card>
</template>

<script>
export default {
  name: "AppsRibbonLayout",
  data: () => ({
    tab: null,
  }),
  computed: {
    module_group() {
      return Object.entries(this.$modules.getGroups())
        .filter(([, value]) => Object.keys(value.modules).length > 0)
        .reduce((result, [key, value]) => {
          result[key] = value;
          return result;
        }, {});
    },
    is_dev: {
      get() {
        return this.$appdata.get("is_dev");
      },
      set(value) {
        if (!value) {
          this.$appdata.set("is_dev", value);
        }
      },
    },
    language: {
      get() {
        return this.$userdata.get("language");
      },
      set(value) {
        if (!value) {
          this.$userdata.set("language", value);
        }
      },
    },
  },
  methods: {
    sortModules(modules) {
      //Ordena pelo idioma selecionado
      return this.$modules.sort(modules, this.$t);
    },
    countModules(modules) {
      return Object.keys(modules).filter((key) =>
        !this.is_dev
          ? !modules[key].development || modules[key].development === false
          : true,
      ).length;
    },
  },
};
</script>



================================================
FILE: src/layout/Footer.vue
================================================
<template>
  <v-footer id="footer-bar" class="pa-0" color="primary">
    <l-player v-if="$media.isMinimized()" location="footer" />
    <v-row v-else class="ma-0 pa-0">
      <span class="text-caption pa-1">Versão {{ version }}</span>
    </v-row>
  </v-footer>
</template>

<script>
import packageJson from "../../package.json";

import LPlayer from "@/components/Player.vue";

export default {
  name: "FooterLayout",
  components: {
    LPlayer,
  },
  data: () => ({
    db_version: 0,
  }),
  computed: {
    version() {
      return packageJson.version + "." + this.db_version;
    },
  },
  methods: {
    async loadDBVersion() {
      const config = await this.$database.get("config");
      this.db_version = config.version_number;
    },
  },
  async mounted() {
    await this.loadDBVersion();
  },
};
</script>

<style scoped>
#footer-bar {
  flex: 0 !important;
}
</style>



================================================
FILE: src/layout/Header.vue
================================================
<template>
  <v-app-bar id="header-bar" tile flat color="primary">
    <template v-slot:prepend>
      <v-app-bar-nav-icon @click="$appdata.toogle('menu.show')" />
    </template>
    <v-app-bar-title>{{ $t("app.name") }}</v-app-bar-title>
    <v-spacer />

    <v-bottom-sheet v-if="remote">
      <template v-slot:activator="{ props: activatorProps }">
        <v-btn v-bind="activatorProps" icon="mdi-keyboard-close" />
      </template>

      <v-card>
        <v-card-actions>
          <v-btn icon="mdi-keyboard-esc" size="x-large" @click="sendKey(27)" />
        </v-card-actions>
        <v-card-actions>
          <v-spacer />
          <v-btn icon="mdi-page-first" size="x-large" @click="sendKey(36)" />
          <v-btn icon="mdi-chevron-left" size="x-large" @click="sendKey(37)" />
          <v-btn icon="mdi-play-pause" size="x-large" @click="sendKey(32)" />
          <v-btn icon="mdi-chevron-right" size="x-large" @click="sendKey(39)" />
          <v-btn icon="mdi-page-last" size="x-large" @click="sendKey(35)" />
          <v-spacer />
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <v-tooltip v-if="remote" :text="remote_url">
      <template v-slot:activator="{ props }">
        <v-btn v-bind="props" icon="mdi-remote" @click="openRemote()" />
      </template>
    </v-tooltip>

    <v-divider v-if="remote" vertical />

    <v-btn
      :icon="layout == 'apps' ? 'mdi-tab' : 'mdi-apps'"
      @click="changeLayout()"
    />
    <LanguageSelector />
  </v-app-bar>
</template>

<script>
import LanguageSelector from "@/components/LanguageSelector.vue";

export default {
  name: "HeaderLayout",
  components: {
    LanguageSelector,
  },
  computed: {
    layout() {
      return this.$userdata.get("layout");
    },
    remote() {
      return this.$userdata.get("remote.is_connected");
    },
    remote_url() {
      return this.$userdata.get("remote.url");
    },
  },
  methods: {
    changeLayout() {
      if (this.layout == "apps") {
        this.$userdata.set("layout", "ribbon");
      } else {
        this.$userdata.set("layout", "apps");
      }
    },
    openRemote() {
      this.$modules.open("remote_control");
    },
    async sendKey(key) {
      const url =
        this.$userdata.get("remote.url") +
        "/api/keyboard?key=" +
        key +
        "&token=" +
        this.$userdata.get("remote.token");

      try {
        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
        });

        const ret = await response.json();
        if (ret.status != "ok") {
          this.$alert.error({
            text:
              ret.code == "INVALID_TOKEN"
                ? "modules.remote_control.messages.invalid_token"
                : "modules.remote_control.messages.error",
            error: ret.code,
          });
        }
      } catch (error) {
        this.$alert.error({
          text: "modules.remote_control.messages.failed_to_connect",
          error: error,
        });
      }
    },
  },
};
</script>

<style scoped>
#header-bar {
  position: initial !important;
  flex: 0 !important;
}
</style>



================================================
FILE: src/layout/Loading.vue
================================================
<template>
  <v-dialog v-model="show" max-width="320" persistent>
    <v-list color="primary" elevation="12" rounded="lg">
      <v-list-item prepend-icon="$louvorja">
        <template v-slot:prepend>
          <div class="pe-4">
            <img src="/ico/favicon.svg" :width="32" />
          </div>
        </template>

        {{ $t("alert.wait") }}

        <template v-slot:append>
          <v-progress-circular
            color="primary"
            indeterminate="disable-shrink"
            size="16"
            width="2"
          />
        </template>
      </v-list-item>
    </v-list>
  </v-dialog>
</template>

<script>
export default {
  name: "LoadingLayout",
  computed: {
    show: {
      get() {
        return this.$appdata.get("loading");
      },
      set(value) {
        this.$appdata.set("loading", value);
      },
    },
  },
};
</script>



================================================
FILE: src/layout/Menu.vue
================================================
<template>
  <v-navigation-drawer
    v-model="show"
    :location="$vuetify.display.width < 600 ? 'bottom' : undefined"
    temporary
  >
    <v-list :baseColor="$theme.primary()" nav>
      <template
        v-for="(module, module_key) in sortModules(menu_modules)"
        :key="module_key"
      >
        <v-list-item
          v-if="
            module.language
              ? module.language == language
              : !module.development || (is_dev && module.development)
          "
          :prepend-icon="module.icon"
          @click="
            $appdata.toogle('menu.show');
            $modules.open(module_key);
          "
        >
          <v-list-item-title>{{ $t(module.title) }}</v-list-item-title>
        </v-list-item>
      </template>
    </v-list>
  </v-navigation-drawer>
</template>

<script>
export default {
  name: "MenuLayout",
  computed: {
    show: {
      get() {
        return this.$appdata.get("menu.show");
      },
      set(value) {
        if (!value) {
          this.$appdata.toogle("menu.show");
        }
      },
    },
    menu_modules() {
      return this.$modules.getMenu();
    },
    modules() {
      return this.$appdata.get("modules");
    },
    is_dev: {
      get() {
        return this.$appdata.get("is_dev");
      },
      set(value) {
        if (!value) {
          this.$appdata.set("is_dev", value);
        }
      },
    },
    language: {
      get() {
        return this.$userdata.get("language");
      },
      set(value) {
        if (!value) {
          this.$userdata.set("language", value);
        }
      },
    },
  },
  methods: {
    sortModules(modules) {
      //Ordena pelo idioma selecionado
      return this.$modules.sort(modules, this.$t);
    },
  },
};
</script>



================================================
FILE: src/layout/Modules.vue
================================================
<template>
  <div v-if="import_modules">
    <component
      v-for="module in modules"
      :key="module.id"
      :is="loadModuleComponent(module)"
    />
  </div>
</template>

<script>
import { defineAsyncComponent } from "vue";

export default {
  name: "ModulesLayout",
  computed: {
    modules() {
      return this.$modules.get();
    },
    import_modules() {
      return this.$appdata.get("import_modules");
    },
  },
  methods: {
    loadModuleComponent(module) {
      return defineAsyncComponent(() => {
        // Try to load from modules interface directory
        return import(`@/modules/core/${module.id}/interface/Index.vue`).catch(
          () => {
            // Try to load from CUSTOM module interface directory
            return import(`@/modules/${module.id}/interface/Index.vue`).catch((e) => {
              this.$alert.error({
                text: "messages.error_import_module",
                error: e,
              });

              return null
            });
          }
        );
      });
    },
  },
};
</script>



================================================
FILE: src/layout/SystemBar.vue
================================================
<template>
  <v-system-bar v-if="is_desktop" id="system-bar" tile window color="primary">
    <v-icon class="me-2" icon="mdi-message"></v-icon>

    <span>Esta barra só irá aparecer na versão DESKTOP!!!!</span>

    <v-spacer />

    <v-btn icon="mdi-minus" variant="text"></v-btn>
    <v-btn icon="mdi-window-minimize" variant="text"></v-btn>
    <v-btn class="ms-2" icon="mdi-window-restore" variant="text" />
    <v-btn class="ms-2" icon="mdi-window-maximize" variant="text" />
    <v-btn class="ms-2" icon="mdi-open-in-new" variant="text" />
    <v-btn class="ms-2" icon="mdi-close" variant="text" />
  </v-system-bar>
</template>

<script>
export default {
  name: "SystemBarLayout",
  computed: {
    is_desktop() {
      return this.$appdata.get("is_desktop");
    },
  },
};
</script>

<style scoped>
#system-bar {
  position: initial !important;
  flex: 0 !important;
}
</style>



================================================
FILE: src/layout/TrayArea.vue
================================================
<template>
  <v-sheet
    class="apps-bar d-flex flex-column"
    v-if="Object.keys(modules).length > 0"
    :style="!horizontal ? 'width:80px;' : ''"
  >
    <div class="apps-bar-header"></div>
    <draggable
      v-model="modules"
      item-key="id"
      class="apps-bar-container d-flex align-center justify-center"
      :class="[`flex-${horizontal ? 'row' : 'column'}`]"
    >
      <!---->
      <template #item="{ element }">
        <div>
          <v-hover v-slot="{ isHovering, props }">
            <div v-bind="props" style="position: relative">
              <v-btn
                :color="$theme.primary()"
                style="margin: 3px"
                tonal
                icon
                @click="$modules.open(element.id)"
              >
                <v-icon :icon="element.icon"></v-icon>
                <v-tooltip activator="parent" location="start">
                  {{ $t(element.title) }}
                </v-tooltip>
              </v-btn>
              <v-btn
                v-if="isHovering"
                icon="mdi-close"
                variant="flat"
                color="error"
                size="x-small"
                style="
                  position: absolute;
                  top: 0;
                  right: -5px;
                  z-index: 10;
                  width: 20px;
                  height: 20px;
                  font-size: 9px;
                "
                @click.stop="$modules.close(element.id)"
              />
            </div>
          </v-hover>
        </div>
      </template>
    </draggable>

    <div class="apps-bar-footer"></div>
  </v-sheet>
</template>

<script>
import Draggable from "vuedraggable";

export default {
  name: "TrayAreaLayout",
  components: {
    Draggable,
  },
  props: {
    horizontal: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    modules: {
      get() {
        return Object.values(this.$modules.getTray());
      },
      set(value) {
        this.$modules.setTray(value.map((module) => module.id));
      },
    },
  },
};
</script>

<style scoped>
.apps-bar {
  padding: 5px;
}
.apps-bar-header,
.apps-bar-footer {
  flex: 0;
}
.apps-bar-container {
  flex: auto;
  overflow: auto;
  background-color: rgba(var(--v-theme-primary), 0.2) !important;
  border-radius: 15px;
}

.sortable-ghost {
  background-color: rgba(var(--v-theme-primary), 0.3) !important;
}
</style>



================================================
FILE: src/modules/BaseModule.js
================================================
export default class BaseModule {
  constructor(manifest) {
    this.manifest = {
      active: manifest.active ?? true,
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      category: manifest.category,
      icon: manifest.icon,
      showInMainMenu: manifest.showInMainMenu || false,
      development: manifest.development || false,
      language: manifest.language || null,
      dependencies: manifest.dependencies || [],
      translations: manifest.translations || {},
      system: manifest.system ?? false,
      customization: manifest.customization || {},
    };
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }

  getManifest() {
    return this.manifest;
  }

  getTranslations() {
    return this.manifest.translations;
  }

  getComponents() {
    return this.manifest.components;
  }

  getEntryComponent() {
    return this.manifest.componentsEntry;
  }

  getDependencies() {
    return this.manifest.dependencies;
  }
}



================================================
FILE: src/modules/animation/index.js
================================================
import BaseModule from "../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/animation/manifest.json
================================================
{
  "active": true,
  "development": true,
  "id": "animation",
  "name": "Animation Plugin",
  "description": "Simple animation to get dependencies",
  "category": "utilities",
  "icon": "mdi-animation-play",
  "dependencies": [
    {
      "animejs": {
        "version": "3.2.1",
        "cdn": "https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"
      }
    }
  ]
}


================================================
FILE: src/modules/animation/dependencies/animejs/README.md
================================================
> [!IMPORTANT]
> ## 🎉 Anime.js V4 is now available in early access 🎉
>
> After years in the making, Anime.js V4 is finally available in early access for my **[GitHub Sponsors](https://github.com/sponsors/juliangarnier)**!

<h1 align="center">
  <a href="https://animejs.com"><img src="/documentation/assets/img/animejs-v3-header-animation.gif" width="250"/></a>
  <br>
  anime.js
</h1>

<h4 align="center">JavaScript animation engine | <a href="https://animejs.com" target="_blank">animejs.com</a></h4>

<p align="center">
  <a href="https://www.npmjs.com/package/animejs" rel="nofollow"><img src="https://camo.githubusercontent.com/011820ee25bf1d3ddaf635d869903b98eccaeae7/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f616e696d656a732e7376673f7374796c653d666c61742d737175617265" alt="npm version" data-canonical-src="https://img.shields.io/npm/v/animejs.svg?style=flat-square" style="max-width:100%;"></a>
  <a href="https://www.npmjs.com/package/animejs" rel="nofollow"><img src="https://camo.githubusercontent.com/3e9b69d51aee25fad784a3097676696096621d47/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f646d2f616e696d656a732e7376673f7374796c653d666c61742d737175617265" alt="npm downloads" data-canonical-src="https://img.shields.io/npm/dm/animejs.svg?style=flat-square" style="max-width:100%;"></a>
</p>

<blockquote align="center">
  <em>Anime.js</em> (<code>/ˈæn.ə.meɪ/</code>) is a lightweight JavaScript animation library with a simple, yet powerful API.<br>
  It works with CSS properties, SVG, DOM attributes and JavaScript Objects.
</blockquote>

<p align="center">
  <a href="#getting-started">Getting started</a>&nbsp;|&nbsp;<a href="#documentation">Documentation</a>&nbsp;|&nbsp;<a href="#demos-and-examples">Demos and examples</a>&nbsp;|&nbsp;<a href="#browser-support">Browser support</a>
</p>

## Getting started

### Download

Via npm

```bash
$ npm install animejs --save
```

or manual [download](https://github.com/juliangarnier/anime/archive/master.zip).

### Usage

#### ES6 modules

```javascript
import anime from 'animejs/lib/anime.es.js';
```

#### CommonJS

```javascript
const anime = require('animejs');
```

#### File include

Link `anime.min.js` in your HTML :

```html
<script src="anime.min.js"></script>
```

### Hello world

```javascript
anime({
  targets: 'div',
  translateX: 250,
  rotate: '1turn',
  backgroundColor: '#FFF',
  duration: 800
});
```

## [Documentation](https://animejs.com/documentation/)

* [Targets](https://animejs.com/documentation/#cssSelector)
* [Properties](https://animejs.com/documentation/#cssProperties)
* [Property parameters](https://animejs.com/documentation/#duration)
* [Animation parameters](https://animejs.com/documentation/#direction)
* [Values](https://animejs.com/documentation/#unitlessValue)
* [Keyframes](https://animejs.com/documentation/#animationKeyframes)
* [Staggering](https://animejs.com/documentation/#staggeringBasics)
* [Timeline](https://animejs.com/documentation/#timelineBasics)
* [Controls](https://animejs.com/documentation/#playPause)
* [Callbacks and promises](https://animejs.com/documentation/#update)
* [SVG Animations](https://animejs.com/documentation/#motionPath)
* [Easing functions](https://animejs.com/documentation/#linearEasing)
* [Helpers](https://animejs.com/documentation/#remove)

## [Demos and examples](http://codepen.io/collection/b392d3a52d6abf5b8d9fda4e4cab61ab/)

* [CodePen demos and examples](http://codepen.io/collection/b392d3a52d6abf5b8d9fda4e4cab61ab/)
* [juliangarnier.com](http://juliangarnier.com)
* [animejs.com](https://animejs.com)
* [Moving letters](http://tobiasahlin.com/moving-letters/) by [@tobiasahlin](https://twitter.com/tobiasahlin)
* [Gradient topography animation](https://tympanus.net/Development/GradientTopographyAnimation/) by [@crnacura](https://twitter.com/crnacura)
* [Organic shape animations](https://tympanus.net/Development/OrganicShapeAnimations/) by [@crnacura](https://twitter.com/crnacura)
* [Pieces slider](https://tympanus.net/Tutorials/PiecesSlider/) by [@lmgonzalves](https://twitter.com/lmgonzalves)
* [Staggering animations](https://codepen.io/juliangarnier/pen/4fe31bbe8579a256e828cd4d48c86182?editors=0100)
* [Easings animations](https://codepen.io/juliangarnier/pen/444ed909fd5de38e3a77cc6e95fc1884)
* [Sphere animation](https://codepen.io/juliangarnier/pen/b3bb8ca599ad0f9d00dd044e56cbdea5?editors=0010)
* [Layered animations](https://codepen.io/juliangarnier/pen/6ca836535cbea42157d1b8d56d00be84?editors=0010)
* [anime.js logo animation](https://codepen.io/juliangarnier/pen/d43e8ec355c30871cbe775193255d6f6?editors=0010)


## Browser support

| Chrome | Safari | IE / Edge | Firefox | Opera |
| --- | --- | --- | --- | --- |
| 24+ | 8+ | 11+ | 32+ | 15+ |

## <a href="https://animejs.com"><img src="/documentation/assets/img/animejs-v3-logo-animation.gif" width="150" alt="anime-js-v3-logo"/></a>

[Website](https://animejs.com/) | [Documentation](https://animejs.com/documentation/) | [Demos and examples](http://codepen.io/collection/b392d3a52d6abf5b8d9fda4e4cab61ab/) | [MIT License](LICENSE.md) | © 2019 [Julian Garnier](http://juliangarnier.com).



================================================
FILE: src/modules/animation/dependencies/animejs/LICENSE.md
================================================
The MIT License

Copyright (c) 2019 Julian Garnier

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



================================================
FILE: src/modules/animation/dependencies/animejs/package.json
================================================
{
  "name": "animejs",
  "version": "3.2.2",
  "homepage": "http://animejs.com",
  "repository": "juliangarnier/anime",
  "description": "JavaScript animation engine",
  "umd:main": "lib/anime.min.js",
  "module": "lib/anime.es.js",
  "main": "lib/anime.js",
  "umd:name": "anime",
  "license": "MIT",
  "author": "Julian Garnier <hello@julian.gr>",
  "files": [
    "lib"
  ],
  "scripts": {
    "build": "node build"
  },
  "bugs": {
    "url": "https://github.com/juliangarnier/anime/issues"
  },
  "keywords": [
    "anime",
    "animation",
    "javascript",
    "CSS",
    "transforms",
    "SVG",
    "canvas"
  ],
  "devDependencies": {
    "gzip-size": "^4.1.0",
    "pretty-bytes": "^4.0.2",
    "rollup": "^0.53.2",
    "rollup-plugin-buble": "^0.18.0",
    "uglify-js": "^3.3.4"
  }
}



================================================
FILE: src/modules/animation/dependencies/animejs/lib/anime.es.js
================================================
/*
 * anime.js v3.2.2
 * (c) 2023 Julian Garnier
 * Released under the MIT license
 * animejs.com
 */

// Defaults

var defaultInstanceSettings = {
  update: null,
  begin: null,
  loopBegin: null,
  changeBegin: null,
  change: null,
  changeComplete: null,
  loopComplete: null,
  complete: null,
  loop: 1,
  direction: 'normal',
  autoplay: true,
  timelineOffset: 0
};

var defaultTweenSettings = {
  duration: 1000,
  delay: 0,
  endDelay: 0,
  easing: 'easeOutElastic(1, .5)',
  round: 0
};

var validTransforms = ['translateX', 'translateY', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'scale', 'scaleX', 'scaleY', 'scaleZ', 'skew', 'skewX', 'skewY', 'perspective', 'matrix', 'matrix3d'];

// Caching

var cache = {
  CSS: {},
  springs: {}
};

// Utils

function minMax(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function stringContains(str, text) {
  return str.indexOf(text) > -1;
}

function applyArguments(func, args) {
  return func.apply(null, args);
}

var is = {
  arr: function (a) { return Array.isArray(a); },
  obj: function (a) { return stringContains(Object.prototype.toString.call(a), 'Object'); },
  pth: function (a) { return is.obj(a) && a.hasOwnProperty('totalLength'); },
  svg: function (a) { return a instanceof SVGElement; },
  inp: function (a) { return a instanceof HTMLInputElement; },
  dom: function (a) { return a.nodeType || is.svg(a); },
  str: function (a) { return typeof a === 'string'; },
  fnc: function (a) { return typeof a === 'function'; },
  und: function (a) { return typeof a === 'undefined'; },
  nil: function (a) { return is.und(a) || a === null; },
  hex: function (a) { return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(a); },
  rgb: function (a) { return /^rgb/.test(a); },
  hsl: function (a) { return /^hsl/.test(a); },
  col: function (a) { return (is.hex(a) || is.rgb(a) || is.hsl(a)); },
  key: function (a) { return !defaultInstanceSettings.hasOwnProperty(a) && !defaultTweenSettings.hasOwnProperty(a) && a !== 'targets' && a !== 'keyframes'; },
};

// Easings

function parseEasingParameters(string) {
  var match = /\(([^)]+)\)/.exec(string);
  return match ? match[1].split(',').map(function (p) { return parseFloat(p); }) : [];
}

// Spring solver inspired by Webkit Copyright © 2016 Apple Inc. All rights reserved. https://webkit.org/demos/spring/spring.js

function spring(string, duration) {

  var params = parseEasingParameters(string);
  var mass = minMax(is.und(params[0]) ? 1 : params[0], .1, 100);
  var stiffness = minMax(is.und(params[1]) ? 100 : params[1], .1, 100);
  var damping = minMax(is.und(params[2]) ? 10 : params[2], .1, 100);
  var velocity =  minMax(is.und(params[3]) ? 0 : params[3], .1, 100);
  var w0 = Math.sqrt(stiffness / mass);
  var zeta = damping / (2 * Math.sqrt(stiffness * mass));
  var wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
  var a = 1;
  var b = zeta < 1 ? (zeta * w0 + -velocity) / wd : -velocity + w0;

  function solver(t) {
    var progress = duration ? (duration * t) / 1000 : t;
    if (zeta < 1) {
      progress = Math.exp(-progress * zeta * w0) * (a * Math.cos(wd * progress) + b * Math.sin(wd * progress));
    } else {
      progress = (a + b * progress) * Math.exp(-progress * w0);
    }
    if (t === 0 || t === 1) { return t; }
    return 1 - progress;
  }

  function getDuration() {
    var cached = cache.springs[string];
    if (cached) { return cached; }
    var frame = 1/6;
    var elapsed = 0;
    var rest = 0;
    while(true) {
      elapsed += frame;
      if (solver(elapsed) === 1) {
        rest++;
        if (rest >= 16) { break; }
      } else {
        rest = 0;
      }
    }
    var duration = elapsed * frame * 1000;
    cache.springs[string] = duration;
    return duration;
  }

  return duration ? solver : getDuration;

}

// Basic steps easing implementation https://developer.mozilla.org/fr/docs/Web/CSS/transition-timing-function

function steps(steps) {
  if ( steps === void 0 ) steps = 10;

  return function (t) { return Math.ceil((minMax(t, 0.000001, 1)) * steps) * (1 / steps); };
}

// BezierEasing https://github.com/gre/bezier-easing

var bezier = (function () {

  var kSplineTableSize = 11;
  var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

  function A(aA1, aA2) { return 1.0 - 3.0 * aA2 + 3.0 * aA1 }
  function B(aA1, aA2) { return 3.0 * aA2 - 6.0 * aA1 }
  function C(aA1)      { return 3.0 * aA1 }

  function calcBezier(aT, aA1, aA2) { return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT }
  function getSlope(aT, aA1, aA2) { return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1) }

  function binarySubdivide(aX, aA, aB, mX1, mX2) {
    var currentX, currentT, i = 0;
    do {
      currentT = aA + (aB - aA) / 2.0;
      currentX = calcBezier(currentT, mX1, mX2) - aX;
      if (currentX > 0.0) { aB = currentT; } else { aA = currentT; }
    } while (Math.abs(currentX) > 0.0000001 && ++i < 10);
    return currentT;
  }

  function newtonRaphsonIterate(aX, aGuessT, mX1, mX2) {
    for (var i = 0; i < 4; ++i) {
      var currentSlope = getSlope(aGuessT, mX1, mX2);
      if (currentSlope === 0.0) { return aGuessT; }
      var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
      aGuessT -= currentX / currentSlope;
    }
    return aGuessT;
  }

  function bezier(mX1, mY1, mX2, mY2) {

    if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) { return; }
    var sampleValues = new Float32Array(kSplineTableSize);

    if (mX1 !== mY1 || mX2 !== mY2) {
      for (var i = 0; i < kSplineTableSize; ++i) {
        sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
      }
    }

    function getTForX(aX) {

      var intervalStart = 0;
      var currentSample = 1;
      var lastSample = kSplineTableSize - 1;

      for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
        intervalStart += kSampleStepSize;
      }

      --currentSample;

      var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      var guessForT = intervalStart + dist * kSampleStepSize;
      var initialSlope = getSlope(guessForT, mX1, mX2);

      if (initialSlope >= 0.001) {
        return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
      } else if (initialSlope === 0.0) {
        return guessForT;
      } else {
        return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
      }

    }

    return function (x) {
      if (mX1 === mY1 && mX2 === mY2) { return x; }
      if (x === 0 || x === 1) { return x; }
      return calcBezier(getTForX(x), mY1, mY2);
    }

  }

  return bezier;

})();

var penner = (function () {

  // Based on jQuery UI's implemenation of easing equations from Robert Penner (http://www.robertpenner.com/easing)

  var eases = { linear: function () { return function (t) { return t; }; } };

  var functionEasings = {
    Sine: function () { return function (t) { return 1 - Math.cos(t * Math.PI / 2); }; },
    Expo: function () { return function (t) { return t ? Math.pow(2, 10 * t - 10) : 0; }; },
    Circ: function () { return function (t) { return 1 - Math.sqrt(1 - t * t); }; },
    Back: function () { return function (t) { return t * t * (3 * t - 2); }; },
    Bounce: function () { return function (t) {
      var pow2, b = 4;
      while (t < (( pow2 = Math.pow(2, --b)) - 1) / 11) {}
      return 1 / Math.pow(4, 3 - b) - 7.5625 * Math.pow(( pow2 * 3 - 2 ) / 22 - t, 2)
    }; },
    Elastic: function (amplitude, period) {
      if ( amplitude === void 0 ) amplitude = 1;
      if ( period === void 0 ) period = .5;

      var a = minMax(amplitude, 1, 10);
      var p = minMax(period, .1, 2);
      return function (t) {
        return (t === 0 || t === 1) ? t : 
          -a * Math.pow(2, 10 * (t - 1)) * Math.sin((((t - 1) - (p / (Math.PI * 2) * Math.asin(1 / a))) * (Math.PI * 2)) / p);
      }
    }
  };

  var baseEasings = ['Quad', 'Cubic', 'Quart', 'Quint'];

  baseEasings.forEach(function (name, i) {
    functionEasings[name] = function () { return function (t) { return Math.pow(t, i + 2); }; };
  });

  Object.keys(functionEasings).forEach(function (name) {
    var easeIn = functionEasings[name];
    eases['easeIn' + name] = easeIn;
    eases['easeOut' + name] = function (a, b) { return function (t) { return 1 - easeIn(a, b)(1 - t); }; };
    eases['easeInOut' + name] = function (a, b) { return function (t) { return t < 0.5 ? easeIn(a, b)(t * 2) / 2 : 
      1 - easeIn(a, b)(t * -2 + 2) / 2; }; };
    eases['easeOutIn' + name] = function (a, b) { return function (t) { return t < 0.5 ? (1 - easeIn(a, b)(1 - t * 2)) / 2 : 
      (easeIn(a, b)(t * 2 - 1) + 1) / 2; }; };
  });

  return eases;

})();

function parseEasings(easing, duration) {
  if (is.fnc(easing)) { return easing; }
  var name = easing.split('(')[0];
  var ease = penner[name];
  var args = parseEasingParameters(easing);
  switch (name) {
    case 'spring' : return spring(easing, duration);
    case 'cubicBezier' : return applyArguments(bezier, args);
    case 'steps' : return applyArguments(steps, args);
    default : return applyArguments(ease, args);
  }
}

// Strings

function selectString(str) {
  try {
    var nodes = document.querySelectorAll(str);
    return nodes;
  } catch(e) {
    return;
  }
}

// Arrays

function filterArray(arr, callback) {
  var len = arr.length;
  var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
  var result = [];
  for (var i = 0; i < len; i++) {
    if (i in arr) {
      var val = arr[i];
      if (callback.call(thisArg, val, i, arr)) {
        result.push(val);
      }
    }
  }
  return result;
}

function flattenArray(arr) {
  return arr.reduce(function (a, b) { return a.concat(is.arr(b) ? flattenArray(b) : b); }, []);
}

function toArray(o) {
  if (is.arr(o)) { return o; }
  if (is.str(o)) { o = selectString(o) || o; }
  if (o instanceof NodeList || o instanceof HTMLCollection) { return [].slice.call(o); }
  return [o];
}

function arrayContains(arr, val) {
  return arr.some(function (a) { return a === val; });
}

// Objects

function cloneObject(o) {
  var clone = {};
  for (var p in o) { clone[p] = o[p]; }
  return clone;
}

function replaceObjectProps(o1, o2) {
  var o = cloneObject(o1);
  for (var p in o1) { o[p] = o2.hasOwnProperty(p) ? o2[p] : o1[p]; }
  return o;
}

function mergeObjects(o1, o2) {
  var o = cloneObject(o1);
  for (var p in o2) { o[p] = is.und(o1[p]) ? o2[p] : o1[p]; }
  return o;
}

// Colors

function rgbToRgba(rgbValue) {
  var rgb = /rgb\((\d+,\s*[\d]+,\s*[\d]+)\)/g.exec(rgbValue);
  return rgb ? ("rgba(" + (rgb[1]) + ",1)") : rgbValue;
}

function hexToRgba(hexValue) {
  var rgx = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  var hex = hexValue.replace(rgx, function (m, r, g, b) { return r + r + g + g + b + b; } );
  var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  var r = parseInt(rgb[1], 16);
  var g = parseInt(rgb[2], 16);
  var b = parseInt(rgb[3], 16);
  return ("rgba(" + r + "," + g + "," + b + ",1)");
}

function hslToRgba(hslValue) {
  var hsl = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(hslValue) || /hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/g.exec(hslValue);
  var h = parseInt(hsl[1], 10) / 360;
  var s = parseInt(hsl[2], 10) / 100;
  var l = parseInt(hsl[3], 10) / 100;
  var a = hsl[4] || 1;
  function hue2rgb(p, q, t) {
    if (t < 0) { t += 1; }
    if (t > 1) { t -= 1; }
    if (t < 1/6) { return p + (q - p) * 6 * t; }
    if (t < 1/2) { return q; }
    if (t < 2/3) { return p + (q - p) * (2/3 - t) * 6; }
    return p;
  }
  var r, g, b;
  if (s == 0) {
    r = g = b = l;
  } else {
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return ("rgba(" + (r * 255) + "," + (g * 255) + "," + (b * 255) + "," + a + ")");
}

function colorToRgb(val) {
  if (is.rgb(val)) { return rgbToRgba(val); }
  if (is.hex(val)) { return hexToRgba(val); }
  if (is.hsl(val)) { return hslToRgba(val); }
}

// Units

function getUnit(val) {
  var split = /[+-]?\d*\.?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(%|px|pt|em|rem|in|cm|mm|ex|ch|pc|vw|vh|vmin|vmax|deg|rad|turn)?$/.exec(val);
  if (split) { return split[1]; }
}

function getTransformUnit(propName) {
  if (stringContains(propName, 'translate') || propName === 'perspective') { return 'px'; }
  if (stringContains(propName, 'rotate') || stringContains(propName, 'skew')) { return 'deg'; }
}

// Values

function getFunctionValue(val, animatable) {
  if (!is.fnc(val)) { return val; }
  return val(animatable.target, animatable.id, animatable.total);
}

function getAttribute(el, prop) {
  return el.getAttribute(prop);
}

function convertPxToUnit(el, value, unit) {
  var valueUnit = getUnit(value);
  if (arrayContains([unit, 'deg', 'rad', 'turn'], valueUnit)) { return value; }
  var cached = cache.CSS[value + unit];
  if (!is.und(cached)) { return cached; }
  var baseline = 100;
  var tempEl = document.createElement(el.tagName);
  var parentEl = (el.parentNode && (el.parentNode !== document)) ? el.parentNode : document.body;
  parentEl.appendChild(tempEl);
  tempEl.style.position = 'absolute';
  tempEl.style.width = baseline + unit;
  var factor = baseline / tempEl.offsetWidth;
  parentEl.removeChild(tempEl);
  var convertedUnit = factor * parseFloat(value);
  cache.CSS[value + unit] = convertedUnit;
  return convertedUnit;
}

function getCSSValue(el, prop, unit) {
  if (prop in el.style) {
    var uppercasePropName = prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    var value = el.style[prop] || getComputedStyle(el).getPropertyValue(uppercasePropName) || '0';
    return unit ? convertPxToUnit(el, value, unit) : value;
  }
}

function getAnimationType(el, prop) {
  if (is.dom(el) && !is.inp(el) && (!is.nil(getAttribute(el, prop)) || (is.svg(el) && el[prop]))) { return 'attribute'; }
  if (is.dom(el) && arrayContains(validTransforms, prop)) { return 'transform'; }
  if (is.dom(el) && (prop !== 'transform' && getCSSValue(el, prop))) { return 'css'; }
  if (el[prop] != null) { return 'object'; }
}

function getElementTransforms(el) {
  if (!is.dom(el)) { return; }
  var str = el.style.transform || '';
  var reg  = /(\w+)\(([^)]*)\)/g;
  var transforms = new Map();
  var m; while (m = reg.exec(str)) { transforms.set(m[1], m[2]); }
  return transforms;
}

function getTransformValue(el, propName, animatable, unit) {
  var defaultVal = stringContains(propName, 'scale') ? 1 : 0 + getTransformUnit(propName);
  var value = getElementTransforms(el).get(propName) || defaultVal;
  if (animatable) {
    animatable.transforms.list.set(propName, value);
    animatable.transforms['last'] = propName;
  }
  return unit ? convertPxToUnit(el, value, unit) : value;
}

function getOriginalTargetValue(target, propName, unit, animatable) {
  switch (getAnimationType(target, propName)) {
    case 'transform': return getTransformValue(target, propName, animatable, unit);
    case 'css': return getCSSValue(target, propName, unit);
    case 'attribute': return getAttribute(target, propName);
    default: return target[propName] || 0;
  }
}

function getRelativeValue(to, from) {
  var operator = /^(\*=|\+=|-=)/.exec(to);
  if (!operator) { return to; }
  var u = getUnit(to) || 0;
  var x = parseFloat(from);
  var y = parseFloat(to.replace(operator[0], ''));
  switch (operator[0][0]) {
    case '+': return x + y + u;
    case '-': return x - y + u;
    case '*': return x * y + u;
  }
}

function validateValue(val, unit) {
  if (is.col(val)) { return colorToRgb(val); }
  if (/\s/g.test(val)) { return val; }
  var originalUnit = getUnit(val);
  var unitLess = originalUnit ? val.substr(0, val.length - originalUnit.length) : val;
  if (unit) { return unitLess + unit; }
  return unitLess;
}

// getTotalLength() equivalent for circle, rect, polyline, polygon and line shapes
// adapted from https://gist.github.com/SebLambla/3e0550c496c236709744

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function getCircleLength(el) {
  return Math.PI * 2 * getAttribute(el, 'r');
}

function getRectLength(el) {
  return (getAttribute(el, 'width') * 2) + (getAttribute(el, 'height') * 2);
}

function getLineLength(el) {
  return getDistance(
    {x: getAttribute(el, 'x1'), y: getAttribute(el, 'y1')}, 
    {x: getAttribute(el, 'x2'), y: getAttribute(el, 'y2')}
  );
}

function getPolylineLength(el) {
  var points = el.points;
  var totalLength = 0;
  var previousPos;
  for (var i = 0 ; i < points.numberOfItems; i++) {
    var currentPos = points.getItem(i);
    if (i > 0) { totalLength += getDistance(previousPos, currentPos); }
    previousPos = currentPos;
  }
  return totalLength;
}

function getPolygonLength(el) {
  var points = el.points;
  return getPolylineLength(el) + getDistance(points.getItem(points.numberOfItems - 1), points.getItem(0));
}

// Path animation

function getTotalLength(el) {
  if (el.getTotalLength) { return el.getTotalLength(); }
  switch(el.tagName.toLowerCase()) {
    case 'circle': return getCircleLength(el);
    case 'rect': return getRectLength(el);
    case 'line': return getLineLength(el);
    case 'polyline': return getPolylineLength(el);
    case 'polygon': return getPolygonLength(el);
  }
}

function setDashoffset(el) {
  var pathLength = getTotalLength(el);
  el.setAttribute('stroke-dasharray', pathLength);
  return pathLength;
}

// Motion path

function getParentSvgEl(el) {
  var parentEl = el.parentNode;
  while (is.svg(parentEl)) {
    if (!is.svg(parentEl.parentNode)) { break; }
    parentEl = parentEl.parentNode;
  }
  return parentEl;
}

function getParentSvg(pathEl, svgData) {
  var svg = svgData || {};
  var parentSvgEl = svg.el || getParentSvgEl(pathEl);
  var rect = parentSvgEl.getBoundingClientRect();
  var viewBoxAttr = getAttribute(parentSvgEl, 'viewBox');
  var width = rect.width;
  var height = rect.height;
  var viewBox = svg.viewBox || (viewBoxAttr ? viewBoxAttr.split(' ') : [0, 0, width, height]);
  return {
    el: parentSvgEl,
    viewBox: viewBox,
    x: viewBox[0] / 1,
    y: viewBox[1] / 1,
    w: width,
    h: height,
    vW: viewBox[2],
    vH: viewBox[3]
  }
}

function getPath(path, percent) {
  var pathEl = is.str(path) ? selectString(path)[0] : path;
  var p = percent || 100;
  return function(property) {
    return {
      property: property,
      el: pathEl,
      svg: getParentSvg(pathEl),
      totalLength: getTotalLength(pathEl) * (p / 100)
    }
  }
}

function getPathProgress(path, progress, isPathTargetInsideSVG) {
  function point(offset) {
    if ( offset === void 0 ) offset = 0;

    var l = progress + offset >= 1 ? progress + offset : 0;
    return path.el.getPointAtLength(l);
  }
  var svg = getParentSvg(path.el, path.svg);
  var p = point();
  var p0 = point(-1);
  var p1 = point(+1);
  var scaleX = isPathTargetInsideSVG ? 1 : svg.w / svg.vW;
  var scaleY = isPathTargetInsideSVG ? 1 : svg.h / svg.vH;
  switch (path.property) {
    case 'x': return (p.x - svg.x) * scaleX;
    case 'y': return (p.y - svg.y) * scaleY;
    case 'angle': return Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
  }
}

// Decompose value

function decomposeValue(val, unit) {
  // const rgx = /-?\d*\.?\d+/g; // handles basic numbers
  // const rgx = /[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g; // handles exponents notation
  var rgx = /[+-]?\d*\.?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g; // handles exponents notation
  var value = validateValue((is.pth(val) ? val.totalLength : val), unit) + '';
  return {
    original: value,
    numbers: value.match(rgx) ? value.match(rgx).map(Number) : [0],
    strings: (is.str(val) || unit) ? value.split(rgx) : []
  }
}

// Animatables

function parseTargets(targets) {
  var targetsArray = targets ? (flattenArray(is.arr(targets) ? targets.map(toArray) : toArray(targets))) : [];
  return filterArray(targetsArray, function (item, pos, self) { return self.indexOf(item) === pos; });
}

function getAnimatables(targets) {
  var parsed = parseTargets(targets);
  return parsed.map(function (t, i) {
    return {target: t, id: i, total: parsed.length, transforms: { list: getElementTransforms(t) } };
  });
}

// Properties

function normalizePropertyTweens(prop, tweenSettings) {
  var settings = cloneObject(tweenSettings);
  // Override duration if easing is a spring
  if (/^spring/.test(settings.easing)) { settings.duration = spring(settings.easing); }
  if (is.arr(prop)) {
    var l = prop.length;
    var isFromTo = (l === 2 && !is.obj(prop[0]));
    if (!isFromTo) {
      // Duration divided by the number of tweens
      if (!is.fnc(tweenSettings.duration)) { settings.duration = tweenSettings.duration / l; }
    } else {
      // Transform [from, to] values shorthand to a valid tween value
      prop = {value: prop};
    }
  }
  var propArray = is.arr(prop) ? prop : [prop];
  return propArray.map(function (v, i) {
    var obj = (is.obj(v) && !is.pth(v)) ? v : {value: v};
    // Default delay value should only be applied to the first tween
    if (is.und(obj.delay)) { obj.delay = !i ? tweenSettings.delay : 0; }
    // Default endDelay value should only be applied to the last tween
    if (is.und(obj.endDelay)) { obj.endDelay = i === propArray.length - 1 ? tweenSettings.endDelay : 0; }
    return obj;
  }).map(function (k) { return mergeObjects(k, settings); });
}


function flattenKeyframes(keyframes) {
  var propertyNames = filterArray(flattenArray(keyframes.map(function (key) { return Object.keys(key); })), function (p) { return is.key(p); })
  .reduce(function (a,b) { if (a.indexOf(b) < 0) { a.push(b); } return a; }, []);
  var properties = {};
  var loop = function ( i ) {
    var propName = propertyNames[i];
    properties[propName] = keyframes.map(function (key) {
      var newKey = {};
      for (var p in key) {
        if (is.key(p)) {
          if (p == propName) { newKey.value = key[p]; }
        } else {
          newKey[p] = key[p];
        }
      }
      return newKey;
    });
  };

  for (var i = 0; i < propertyNames.length; i++) loop( i );
  return properties;
}

function getProperties(tweenSettings, params) {
  var properties = [];
  var keyframes = params.keyframes;
  if (keyframes) { params = mergeObjects(flattenKeyframes(keyframes), params); }
  for (var p in params) {
    if (is.key(p)) {
      properties.push({
        name: p,
        tweens: normalizePropertyTweens(params[p], tweenSettings)
      });
    }
  }
  return properties;
}

// Tweens

function normalizeTweenValues(tween, animatable) {
  var t = {};
  for (var p in tween) {
    var value = getFunctionValue(tween[p], animatable);
    if (is.arr(value)) {
      value = value.map(function (v) { return getFunctionValue(v, animatable); });
      if (value.length === 1) { value = value[0]; }
    }
    t[p] = value;
  }
  t.duration = parseFloat(t.duration);
  t.delay = parseFloat(t.delay);
  return t;
}

function normalizeTweens(prop, animatable) {
  var previousTween;
  return prop.tweens.map(function (t) {
    var tween = normalizeTweenValues(t, animatable);
    var tweenValue = tween.value;
    var to = is.arr(tweenValue) ? tweenValue[1] : tweenValue;
    var toUnit = getUnit(to);
    var originalValue = getOriginalTargetValue(animatable.target, prop.name, toUnit, animatable);
    var previousValue = previousTween ? previousTween.to.original : originalValue;
    var from = is.arr(tweenValue) ? tweenValue[0] : previousValue;
    var fromUnit = getUnit(from) || getUnit(originalValue);
    var unit = toUnit || fromUnit;
    if (is.und(to)) { to = previousValue; }
    tween.from = decomposeValue(from, unit);
    tween.to = decomposeValue(getRelativeValue(to, from), unit);
    tween.start = previousTween ? previousTween.end : 0;
    tween.end = tween.start + tween.delay + tween.duration + tween.endDelay;
    tween.easing = parseEasings(tween.easing, tween.duration);
    tween.isPath = is.pth(tweenValue);
    tween.isPathTargetInsideSVG = tween.isPath && is.svg(animatable.target);
    tween.isColor = is.col(tween.from.original);
    if (tween.isColor) { tween.round = 1; }
    previousTween = tween;
    return tween;
  });
}

// Tween progress

var setProgressValue = {
  css: function (t, p, v) { return t.style[p] = v; },
  attribute: function (t, p, v) { return t.setAttribute(p, v); },
  object: function (t, p, v) { return t[p] = v; },
  transform: function (t, p, v, transforms, manual) {
    transforms.list.set(p, v);
    if (p === transforms.last || manual) {
      var str = '';
      transforms.list.forEach(function (value, prop) { str += prop + "(" + value + ") "; });
      t.style.transform = str;
    }
  }
};

// Set Value helper

function setTargetsValue(targets, properties) {
  var animatables = getAnimatables(targets);
  animatables.forEach(function (animatable) {
    for (var property in properties) {
      var value = getFunctionValue(properties[property], animatable);
      var target = animatable.target;
      var valueUnit = getUnit(value);
      var originalValue = getOriginalTargetValue(target, property, valueUnit, animatable);
      var unit = valueUnit || getUnit(originalValue);
      var to = getRelativeValue(validateValue(value, unit), originalValue);
      var animType = getAnimationType(target, property);
      setProgressValue[animType](target, property, to, animatable.transforms, true);
    }
  });
}

// Animations

function createAnimation(animatable, prop) {
  var animType = getAnimationType(animatable.target, prop.name);
  if (animType) {
    var tweens = normalizeTweens(prop, animatable);
    var lastTween = tweens[tweens.length - 1];
    return {
      type: animType,
      property: prop.name,
      animatable: animatable,
      tweens: tweens,
      duration: lastTween.end,
      delay: tweens[0].delay,
      endDelay: lastTween.endDelay
    }
  }
}

function getAnimations(animatables, properties) {
  return filterArray(flattenArray(animatables.map(function (animatable) {
    return properties.map(function (prop) {
      return createAnimation(animatable, prop);
    });
  })), function (a) { return !is.und(a); });
}

// Create Instance

function getInstanceTimings(animations, tweenSettings) {
  var animLength = animations.length;
  var getTlOffset = function (anim) { return anim.timelineOffset ? anim.timelineOffset : 0; };
  var timings = {};
  timings.duration = animLength ? Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration; })) : tweenSettings.duration;
  timings.delay = animLength ? Math.min.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.delay; })) : tweenSettings.delay;
  timings.endDelay = animLength ? timings.duration - Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration - anim.endDelay; })) : tweenSettings.endDelay;
  return timings;
}

var instanceID = 0;

function createNewInstance(params) {
  var instanceSettings = replaceObjectProps(defaultInstanceSettings, params);
  var tweenSettings = replaceObjectProps(defaultTweenSettings, params);
  var properties = getProperties(tweenSettings, params);
  var animatables = getAnimatables(params.targets);
  var animations = getAnimations(animatables, properties);
  var timings = getInstanceTimings(animations, tweenSettings);
  var id = instanceID;
  instanceID++;
  return mergeObjects(instanceSettings, {
    id: id,
    children: [],
    animatables: animatables,
    animations: animations,
    duration: timings.duration,
    delay: timings.delay,
    endDelay: timings.endDelay
  });
}

// Core

var activeInstances = [];

var engine = (function () {
  var raf;

  function play() {
    if (!raf && (!isDocumentHidden() || !anime.suspendWhenDocumentHidden) && activeInstances.length > 0) {
      raf = requestAnimationFrame(step);
    }
  }
  function step(t) {
    // memo on algorithm issue:
    // dangerous iteration over mutable `activeInstances`
    // (that collection may be updated from within callbacks of `tick`-ed animation instances)
    var activeInstancesLength = activeInstances.length;
    var i = 0;
    while (i < activeInstancesLength) {
      var activeInstance = activeInstances[i];
      if (!activeInstance.paused) {
        activeInstance.tick(t);
        i++;
      } else {
        activeInstances.splice(i, 1);
        activeInstancesLength--;
      }
    }
    raf = i > 0 ? requestAnimationFrame(step) : undefined;
  }

  function handleVisibilityChange() {
    if (!anime.suspendWhenDocumentHidden) { return; }

    if (isDocumentHidden()) {
      // suspend ticks
      raf = cancelAnimationFrame(raf);
    } else { // is back to active tab
      // first adjust animations to consider the time that ticks were suspended
      activeInstances.forEach(
        function (instance) { return instance ._onDocumentVisibility(); }
      );
      engine();
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return play;
})();

function isDocumentHidden() {
  return !!document && document.hidden;
}

// Public Instance

function anime(params) {
  if ( params === void 0 ) params = {};


  var startTime = 0, lastTime = 0, now = 0;
  var children, childrenLength = 0;
  var resolve = null;

  function makePromise(instance) {
    var promise = window.Promise && new Promise(function (_resolve) { return resolve = _resolve; });
    instance.finished = promise;
    return promise;
  }

  var instance = createNewInstance(params);
  var promise = makePromise(instance);

  function toggleInstanceDirection() {
    var direction = instance.direction;
    if (direction !== 'alternate') {
      instance.direction = direction !== 'normal' ? 'normal' : 'reverse';
    }
    instance.reversed = !instance.reversed;
    children.forEach(function (child) { return child.reversed = instance.reversed; });
  }

  function adjustTime(time) {
    return instance.reversed ? instance.duration - time : time;
  }

  function resetTime() {
    startTime = 0;
    lastTime = adjustTime(instance.currentTime) * (1 / anime.speed);
  }

  function seekChild(time, child) {
    if (child) { child.seek(time - child.timelineOffset); }
  }

  function syncInstanceChildren(time) {
    if (!instance.reversePlayback) {
      for (var i = 0; i < childrenLength; i++) { seekChild(time, children[i]); }
    } else {
      for (var i$1 = childrenLength; i$1--;) { seekChild(time, children[i$1]); }
    }
  }

  function setAnimationsProgress(insTime) {
    var i = 0;
    var animations = instance.animations;
    var animationsLength = animations.length;
    while (i < animationsLength) {
      var anim = animations[i];
      var animatable = anim.animatable;
      var tweens = anim.tweens;
      var tweenLength = tweens.length - 1;
      var tween = tweens[tweenLength];
      // Only check for keyframes if there is more than one tween
      if (tweenLength) { tween = filterArray(tweens, function (t) { return (insTime < t.end); })[0] || tween; }
      var elapsed = minMax(insTime - tween.start - tween.delay, 0, tween.duration) / tween.duration;
      var eased = isNaN(elapsed) ? 1 : tween.easing(elapsed);
      var strings = tween.to.strings;
      var round = tween.round;
      var numbers = [];
      var toNumbersLength = tween.to.numbers.length;
      var progress = (void 0);
      for (var n = 0; n < toNumbersLength; n++) {
        var value = (void 0);
        var toNumber = tween.to.numbers[n];
        var fromNumber = tween.from.numbers[n] || 0;
        if (!tween.isPath) {
          value = fromNumber + (eased * (toNumber - fromNumber));
        } else {
          value = getPathProgress(tween.value, eased * toNumber, tween.isPathTargetInsideSVG);
        }
        if (round) {
          if (!(tween.isColor && n > 2)) {
            value = Math.round(value * round) / round;
          }
        }
        numbers.push(value);
      }
      // Manual Array.reduce for better performances
      var stringsLength = strings.length;
      if (!stringsLength) {
        progress = numbers[0];
      } else {
        progress = strings[0];
        for (var s = 0; s < stringsLength; s++) {
          var a = strings[s];
          var b = strings[s + 1];
          var n$1 = numbers[s];
          if (!isNaN(n$1)) {
            if (!b) {
              progress += n$1 + ' ';
            } else {
              progress += n$1 + b;
            }
          }
        }
      }
      setProgressValue[anim.type](animatable.target, anim.property, progress, animatable.transforms);
      anim.currentValue = progress;
      i++;
    }
  }

  function setCallback(cb) {
    if (instance[cb] && !instance.passThrough) { instance[cb](instance); }
  }

  function countIteration() {
    if (instance.remaining && instance.remaining !== true) {
      instance.remaining--;
    }
  }

  function setInstanceProgress(engineTime) {
    var insDuration = instance.duration;
    var insDelay = instance.delay;
    var insEndDelay = insDuration - instance.endDelay;
    var insTime = adjustTime(engineTime);
    instance.progress = minMax((insTime / insDuration) * 100, 0, 100);
    instance.reversePlayback = insTime < instance.currentTime;
    if (children) { syncInstanceChildren(insTime); }
    if (!instance.began && instance.currentTime > 0) {
      instance.began = true;
      setCallback('begin');
    }
    if (!instance.loopBegan && instance.currentTime > 0) {
      instance.loopBegan = true;
      setCallback('loopBegin');
    }
    if (insTime <= insDelay && instance.currentTime !== 0) {
      setAnimationsProgress(0);
    }
    if ((insTime >= insEndDelay && instance.currentTime !== insDuration) || !insDuration) {
      setAnimationsProgress(insDuration);
    }
    if (insTime > insDelay && insTime < insEndDelay) {
      if (!instance.changeBegan) {
        instance.changeBegan = true;
        instance.changeCompleted = false;
        setCallback('changeBegin');
      }
      setCallback('change');
      setAnimationsProgress(insTime);
    } else {
      if (instance.changeBegan) {
        instance.changeCompleted = true;
        instance.changeBegan = false;
        setCallback('changeComplete');
      }
    }
    instance.currentTime = minMax(insTime, 0, insDuration);
    if (instance.began) { setCallback('update'); }
    if (engineTime >= insDuration) {
      lastTime = 0;
      countIteration();
      if (!instance.remaining) {
        instance.paused = true;
        if (!instance.completed) {
          instance.completed = true;
          setCallback('loopComplete');
          setCallback('complete');
          if (!instance.passThrough && 'Promise' in window) {
            resolve();
            promise = makePromise(instance);
          }
        }
      } else {
        startTime = now;
        setCallback('loopComplete');
        instance.loopBegan = false;
        if (instance.direction === 'alternate') {
          toggleInstanceDirection();
        }
      }
    }
  }

  instance.reset = function() {
    var direction = instance.direction;
    instance.passThrough = false;
    instance.currentTime = 0;
    instance.progress = 0;
    instance.paused = true;
    instance.began = false;
    instance.loopBegan = false;
    instance.changeBegan = false;
    instance.completed = false;
    instance.changeCompleted = false;
    instance.reversePlayback = false;
    instance.reversed = direction === 'reverse';
    instance.remaining = instance.loop;
    children = instance.children;
    childrenLength = children.length;
    for (var i = childrenLength; i--;) { instance.children[i].reset(); }
    if (instance.reversed && instance.loop !== true || (direction === 'alternate' && instance.loop === 1)) { instance.remaining++; }
    setAnimationsProgress(instance.reversed ? instance.duration : 0);
  };

  // internal method (for engine) to adjust animation timings before restoring engine ticks (rAF)
  instance._onDocumentVisibility = resetTime;

  // Set Value helper

  instance.set = function(targets, properties) {
    setTargetsValue(targets, properties);
    return instance;
  };

  instance.tick = function(t) {
    now = t;
    if (!startTime) { startTime = now; }
    setInstanceProgress((now + (lastTime - startTime)) * anime.speed);
  };

  instance.seek = function(time) {
    setInstanceProgress(adjustTime(time));
  };

  instance.pause = function() {
    instance.paused = true;
    resetTime();
  };

  instance.play = function() {
    if (!instance.paused) { return; }
    if (instance.completed) { instance.reset(); }
    instance.paused = false;
    activeInstances.push(instance);
    resetTime();
    engine();
  };

  instance.reverse = function() {
    toggleInstanceDirection();
    instance.completed = instance.reversed ? false : true;
    resetTime();
  };

  instance.restart = function() {
    instance.reset();
    instance.play();
  };

  instance.remove = function(targets) {
    var targetsArray = parseTargets(targets);
    removeTargetsFromInstance(targetsArray, instance);
  };

  instance.reset();

  if (instance.autoplay) { instance.play(); }

  return instance;

}

// Remove targets from animation

function removeTargetsFromAnimations(targetsArray, animations) {
  for (var a = animations.length; a--;) {
    if (arrayContains(targetsArray, animations[a].animatable.target)) {
      animations.splice(a, 1);
    }
  }
}

function removeTargetsFromInstance(targetsArray, instance) {
  var animations = instance.animations;
  var children = instance.children;
  removeTargetsFromAnimations(targetsArray, animations);
  for (var c = children.length; c--;) {
    var child = children[c];
    var childAnimations = child.animations;
    removeTargetsFromAnimations(targetsArray, childAnimations);
    if (!childAnimations.length && !child.children.length) { children.splice(c, 1); }
  }
  if (!animations.length && !children.length) { instance.pause(); }
}

function removeTargetsFromActiveInstances(targets) {
  var targetsArray = parseTargets(targets);
  for (var i = activeInstances.length; i--;) {
    var instance = activeInstances[i];
    removeTargetsFromInstance(targetsArray, instance);
  }
}

// Stagger helpers

function stagger(val, params) {
  if ( params === void 0 ) params = {};

  var direction = params.direction || 'normal';
  var easing = params.easing ? parseEasings(params.easing) : null;
  var grid = params.grid;
  var axis = params.axis;
  var fromIndex = params.from || 0;
  var fromFirst = fromIndex === 'first';
  var fromCenter = fromIndex === 'center';
  var fromLast = fromIndex === 'last';
  var isRange = is.arr(val);
  var val1 = isRange ? parseFloat(val[0]) : parseFloat(val);
  var val2 = isRange ? parseFloat(val[1]) : 0;
  var unit = getUnit(isRange ? val[1] : val) || 0;
  var start = params.start || 0 + (isRange ? val1 : 0);
  var values = [];
  var maxValue = 0;
  return function (el, i, t) {
    if (fromFirst) { fromIndex = 0; }
    if (fromCenter) { fromIndex = (t - 1) / 2; }
    if (fromLast) { fromIndex = t - 1; }
    if (!values.length) {
      for (var index = 0; index < t; index++) {
        if (!grid) {
          values.push(Math.abs(fromIndex - index));
        } else {
          var fromX = !fromCenter ? fromIndex%grid[0] : (grid[0]-1)/2;
          var fromY = !fromCenter ? Math.floor(fromIndex/grid[0]) : (grid[1]-1)/2;
          var toX = index%grid[0];
          var toY = Math.floor(index/grid[0]);
          var distanceX = fromX - toX;
          var distanceY = fromY - toY;
          var value = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
          if (axis === 'x') { value = -distanceX; }
          if (axis === 'y') { value = -distanceY; }
          values.push(value);
        }
        maxValue = Math.max.apply(Math, values);
      }
      if (easing) { values = values.map(function (val) { return easing(val / maxValue) * maxValue; }); }
      if (direction === 'reverse') { values = values.map(function (val) { return axis ? (val < 0) ? val * -1 : -val : Math.abs(maxValue - val); }); }
    }
    var spacing = isRange ? (val2 - val1) / maxValue : val1;
    return start + (spacing * (Math.round(values[i] * 100) / 100)) + unit;
  }
}

// Timeline

function timeline(params) {
  if ( params === void 0 ) params = {};

  var tl = anime(params);
  tl.duration = 0;
  tl.add = function(instanceParams, timelineOffset) {
    var tlIndex = activeInstances.indexOf(tl);
    var children = tl.children;
    if (tlIndex > -1) { activeInstances.splice(tlIndex, 1); }
    function passThrough(ins) { ins.passThrough = true; }
    for (var i = 0; i < children.length; i++) { passThrough(children[i]); }
    var insParams = mergeObjects(instanceParams, replaceObjectProps(defaultTweenSettings, params));
    insParams.targets = insParams.targets || params.targets;
    var tlDuration = tl.duration;
    insParams.autoplay = false;
    insParams.direction = tl.direction;
    insParams.timelineOffset = is.und(timelineOffset) ? tlDuration : getRelativeValue(timelineOffset, tlDuration);
    passThrough(tl);
    tl.seek(insParams.timelineOffset);
    var ins = anime(insParams);
    passThrough(ins);
    children.push(ins);
    var timings = getInstanceTimings(children, params);
    tl.delay = timings.delay;
    tl.endDelay = timings.endDelay;
    tl.duration = timings.duration;
    tl.seek(0);
    tl.reset();
    if (tl.autoplay) { tl.play(); }
    return tl;
  };
  return tl;
}

anime.version = '3.2.1';
anime.speed = 1;
// TODO:#review: naming, documentation
anime.suspendWhenDocumentHidden = true;
anime.running = activeInstances;
anime.remove = removeTargetsFromActiveInstances;
anime.get = getOriginalTargetValue;
anime.set = setTargetsValue;
anime.convertPx = convertPxToUnit;
anime.path = getPath;
anime.setDashoffset = setDashoffset;
anime.stagger = stagger;
anime.timeline = timeline;
anime.easing = parseEasings;
anime.penner = penner;
anime.random = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };

export default anime;



================================================
FILE: src/modules/animation/dependencies/animejs/lib/anime.js
================================================
/*
 * anime.js v3.2.2
 * (c) 2023 Julian Garnier
 * Released under the MIT license
 * animejs.com
 */

'use strict';

// Defaults

var defaultInstanceSettings = {
  update: null,
  begin: null,
  loopBegin: null,
  changeBegin: null,
  change: null,
  changeComplete: null,
  loopComplete: null,
  complete: null,
  loop: 1,
  direction: 'normal',
  autoplay: true,
  timelineOffset: 0
};

var defaultTweenSettings = {
  duration: 1000,
  delay: 0,
  endDelay: 0,
  easing: 'easeOutElastic(1, .5)',
  round: 0
};

var validTransforms = ['translateX', 'translateY', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'scale', 'scaleX', 'scaleY', 'scaleZ', 'skew', 'skewX', 'skewY', 'perspective', 'matrix', 'matrix3d'];

// Caching

var cache = {
  CSS: {},
  springs: {}
};

// Utils

function minMax(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function stringContains(str, text) {
  return str.indexOf(text) > -1;
}

function applyArguments(func, args) {
  return func.apply(null, args);
}

var is = {
  arr: function (a) { return Array.isArray(a); },
  obj: function (a) { return stringContains(Object.prototype.toString.call(a), 'Object'); },
  pth: function (a) { return is.obj(a) && a.hasOwnProperty('totalLength'); },
  svg: function (a) { return a instanceof SVGElement; },
  inp: function (a) { return a instanceof HTMLInputElement; },
  dom: function (a) { return a.nodeType || is.svg(a); },
  str: function (a) { return typeof a === 'string'; },
  fnc: function (a) { return typeof a === 'function'; },
  und: function (a) { return typeof a === 'undefined'; },
  nil: function (a) { return is.und(a) || a === null; },
  hex: function (a) { return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(a); },
  rgb: function (a) { return /^rgb/.test(a); },
  hsl: function (a) { return /^hsl/.test(a); },
  col: function (a) { return (is.hex(a) || is.rgb(a) || is.hsl(a)); },
  key: function (a) { return !defaultInstanceSettings.hasOwnProperty(a) && !defaultTweenSettings.hasOwnProperty(a) && a !== 'targets' && a !== 'keyframes'; },
};

// Easings

function parseEasingParameters(string) {
  var match = /\(([^)]+)\)/.exec(string);
  return match ? match[1].split(',').map(function (p) { return parseFloat(p); }) : [];
}

// Spring solver inspired by Webkit Copyright © 2016 Apple Inc. All rights reserved. https://webkit.org/demos/spring/spring.js

function spring(string, duration) {

  var params = parseEasingParameters(string);
  var mass = minMax(is.und(params[0]) ? 1 : params[0], .1, 100);
  var stiffness = minMax(is.und(params[1]) ? 100 : params[1], .1, 100);
  var damping = minMax(is.und(params[2]) ? 10 : params[2], .1, 100);
  var velocity =  minMax(is.und(params[3]) ? 0 : params[3], .1, 100);
  var w0 = Math.sqrt(stiffness / mass);
  var zeta = damping / (2 * Math.sqrt(stiffness * mass));
  var wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
  var a = 1;
  var b = zeta < 1 ? (zeta * w0 + -velocity) / wd : -velocity + w0;

  function solver(t) {
    var progress = duration ? (duration * t) / 1000 : t;
    if (zeta < 1) {
      progress = Math.exp(-progress * zeta * w0) * (a * Math.cos(wd * progress) + b * Math.sin(wd * progress));
    } else {
      progress = (a + b * progress) * Math.exp(-progress * w0);
    }
    if (t === 0 || t === 1) { return t; }
    return 1 - progress;
  }

  function getDuration() {
    var cached = cache.springs[string];
    if (cached) { return cached; }
    var frame = 1/6;
    var elapsed = 0;
    var rest = 0;
    while(true) {
      elapsed += frame;
      if (solver(elapsed) === 1) {
        rest++;
        if (rest >= 16) { break; }
      } else {
        rest = 0;
      }
    }
    var duration = elapsed * frame * 1000;
    cache.springs[string] = duration;
    return duration;
  }

  return duration ? solver : getDuration;

}

// Basic steps easing implementation https://developer.mozilla.org/fr/docs/Web/CSS/transition-timing-function

function steps(steps) {
  if ( steps === void 0 ) steps = 10;

  return function (t) { return Math.ceil((minMax(t, 0.000001, 1)) * steps) * (1 / steps); };
}

// BezierEasing https://github.com/gre/bezier-easing

var bezier = (function () {

  var kSplineTableSize = 11;
  var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

  function A(aA1, aA2) { return 1.0 - 3.0 * aA2 + 3.0 * aA1 }
  function B(aA1, aA2) { return 3.0 * aA2 - 6.0 * aA1 }
  function C(aA1)      { return 3.0 * aA1 }

  function calcBezier(aT, aA1, aA2) { return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT }
  function getSlope(aT, aA1, aA2) { return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1) }

  function binarySubdivide(aX, aA, aB, mX1, mX2) {
    var currentX, currentT, i = 0;
    do {
      currentT = aA + (aB - aA) / 2.0;
      currentX = calcBezier(currentT, mX1, mX2) - aX;
      if (currentX > 0.0) { aB = currentT; } else { aA = currentT; }
    } while (Math.abs(currentX) > 0.0000001 && ++i < 10);
    return currentT;
  }

  function newtonRaphsonIterate(aX, aGuessT, mX1, mX2) {
    for (var i = 0; i < 4; ++i) {
      var currentSlope = getSlope(aGuessT, mX1, mX2);
      if (currentSlope === 0.0) { return aGuessT; }
      var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
      aGuessT -= currentX / currentSlope;
    }
    return aGuessT;
  }

  function bezier(mX1, mY1, mX2, mY2) {

    if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) { return; }
    var sampleValues = new Float32Array(kSplineTableSize);

    if (mX1 !== mY1 || mX2 !== mY2) {
      for (var i = 0; i < kSplineTableSize; ++i) {
        sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
      }
    }

    function getTForX(aX) {

      var intervalStart = 0;
      var currentSample = 1;
      var lastSample = kSplineTableSize - 1;

      for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
        intervalStart += kSampleStepSize;
      }

      --currentSample;

      var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      var guessForT = intervalStart + dist * kSampleStepSize;
      var initialSlope = getSlope(guessForT, mX1, mX2);

      if (initialSlope >= 0.001) {
        return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
      } else if (initialSlope === 0.0) {
        return guessForT;
      } else {
        return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
      }

    }

    return function (x) {
      if (mX1 === mY1 && mX2 === mY2) { return x; }
      if (x === 0 || x === 1) { return x; }
      return calcBezier(getTForX(x), mY1, mY2);
    }

  }

  return bezier;

})();

var penner = (function () {

  // Based on jQuery UI's implemenation of easing equations from Robert Penner (http://www.robertpenner.com/easing)

  var eases = { linear: function () { return function (t) { return t; }; } };

  var functionEasings = {
    Sine: function () { return function (t) { return 1 - Math.cos(t * Math.PI / 2); }; },
    Expo: function () { return function (t) { return t ? Math.pow(2, 10 * t - 10) : 0; }; },
    Circ: function () { return function (t) { return 1 - Math.sqrt(1 - t * t); }; },
    Back: function () { return function (t) { return t * t * (3 * t - 2); }; },
    Bounce: function () { return function (t) {
      var pow2, b = 4;
      while (t < (( pow2 = Math.pow(2, --b)) - 1) / 11) {}
      return 1 / Math.pow(4, 3 - b) - 7.5625 * Math.pow(( pow2 * 3 - 2 ) / 22 - t, 2)
    }; },
    Elastic: function (amplitude, period) {
      if ( amplitude === void 0 ) amplitude = 1;
      if ( period === void 0 ) period = .5;

      var a = minMax(amplitude, 1, 10);
      var p = minMax(period, .1, 2);
      return function (t) {
        return (t === 0 || t === 1) ? t : 
          -a * Math.pow(2, 10 * (t - 1)) * Math.sin((((t - 1) - (p / (Math.PI * 2) * Math.asin(1 / a))) * (Math.PI * 2)) / p);
      }
    }
  };

  var baseEasings = ['Quad', 'Cubic', 'Quart', 'Quint'];

  baseEasings.forEach(function (name, i) {
    functionEasings[name] = function () { return function (t) { return Math.pow(t, i + 2); }; };
  });

  Object.keys(functionEasings).forEach(function (name) {
    var easeIn = functionEasings[name];
    eases['easeIn' + name] = easeIn;
    eases['easeOut' + name] = function (a, b) { return function (t) { return 1 - easeIn(a, b)(1 - t); }; };
    eases['easeInOut' + name] = function (a, b) { return function (t) { return t < 0.5 ? easeIn(a, b)(t * 2) / 2 : 
      1 - easeIn(a, b)(t * -2 + 2) / 2; }; };
    eases['easeOutIn' + name] = function (a, b) { return function (t) { return t < 0.5 ? (1 - easeIn(a, b)(1 - t * 2)) / 2 : 
      (easeIn(a, b)(t * 2 - 1) + 1) / 2; }; };
  });

  return eases;

})();

function parseEasings(easing, duration) {
  if (is.fnc(easing)) { return easing; }
  var name = easing.split('(')[0];
  var ease = penner[name];
  var args = parseEasingParameters(easing);
  switch (name) {
    case 'spring' : return spring(easing, duration);
    case 'cubicBezier' : return applyArguments(bezier, args);
    case 'steps' : return applyArguments(steps, args);
    default : return applyArguments(ease, args);
  }
}

// Strings

function selectString(str) {
  try {
    var nodes = document.querySelectorAll(str);
    return nodes;
  } catch(e) {
    return;
  }
}

// Arrays

function filterArray(arr, callback) {
  var len = arr.length;
  var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
  var result = [];
  for (var i = 0; i < len; i++) {
    if (i in arr) {
      var val = arr[i];
      if (callback.call(thisArg, val, i, arr)) {
        result.push(val);
      }
    }
  }
  return result;
}

function flattenArray(arr) {
  return arr.reduce(function (a, b) { return a.concat(is.arr(b) ? flattenArray(b) : b); }, []);
}

function toArray(o) {
  if (is.arr(o)) { return o; }
  if (is.str(o)) { o = selectString(o) || o; }
  if (o instanceof NodeList || o instanceof HTMLCollection) { return [].slice.call(o); }
  return [o];
}

function arrayContains(arr, val) {
  return arr.some(function (a) { return a === val; });
}

// Objects

function cloneObject(o) {
  var clone = {};
  for (var p in o) { clone[p] = o[p]; }
  return clone;
}

function replaceObjectProps(o1, o2) {
  var o = cloneObject(o1);
  for (var p in o1) { o[p] = o2.hasOwnProperty(p) ? o2[p] : o1[p]; }
  return o;
}

function mergeObjects(o1, o2) {
  var o = cloneObject(o1);
  for (var p in o2) { o[p] = is.und(o1[p]) ? o2[p] : o1[p]; }
  return o;
}

// Colors

function rgbToRgba(rgbValue) {
  var rgb = /rgb\((\d+,\s*[\d]+,\s*[\d]+)\)/g.exec(rgbValue);
  return rgb ? ("rgba(" + (rgb[1]) + ",1)") : rgbValue;
}

function hexToRgba(hexValue) {
  var rgx = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  var hex = hexValue.replace(rgx, function (m, r, g, b) { return r + r + g + g + b + b; } );
  var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  var r = parseInt(rgb[1], 16);
  var g = parseInt(rgb[2], 16);
  var b = parseInt(rgb[3], 16);
  return ("rgba(" + r + "," + g + "," + b + ",1)");
}

function hslToRgba(hslValue) {
  var hsl = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(hslValue) || /hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/g.exec(hslValue);
  var h = parseInt(hsl[1], 10) / 360;
  var s = parseInt(hsl[2], 10) / 100;
  var l = parseInt(hsl[3], 10) / 100;
  var a = hsl[4] || 1;
  function hue2rgb(p, q, t) {
    if (t < 0) { t += 1; }
    if (t > 1) { t -= 1; }
    if (t < 1/6) { return p + (q - p) * 6 * t; }
    if (t < 1/2) { return q; }
    if (t < 2/3) { return p + (q - p) * (2/3 - t) * 6; }
    return p;
  }
  var r, g, b;
  if (s == 0) {
    r = g = b = l;
  } else {
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return ("rgba(" + (r * 255) + "," + (g * 255) + "," + (b * 255) + "," + a + ")");
}

function colorToRgb(val) {
  if (is.rgb(val)) { return rgbToRgba(val); }
  if (is.hex(val)) { return hexToRgba(val); }
  if (is.hsl(val)) { return hslToRgba(val); }
}

// Units

function getUnit(val) {
  var split = /[+-]?\d*\.?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(%|px|pt|em|rem|in|cm|mm|ex|ch|pc|vw|vh|vmin|vmax|deg|rad|turn)?$/.exec(val);
  if (split) { return split[1]; }
}

function getTransformUnit(propName) {
  if (stringContains(propName, 'translate') || propName === 'perspective') { return 'px'; }
  if (stringContains(propName, 'rotate') || stringContains(propName, 'skew')) { return 'deg'; }
}

// Values

function getFunctionValue(val, animatable) {
  if (!is.fnc(val)) { return val; }
  return val(animatable.target, animatable.id, animatable.total);
}

function getAttribute(el, prop) {
  return el.getAttribute(prop);
}

function convertPxToUnit(el, value, unit) {
  var valueUnit = getUnit(value);
  if (arrayContains([unit, 'deg', 'rad', 'turn'], valueUnit)) { return value; }
  var cached = cache.CSS[value + unit];
  if (!is.und(cached)) { return cached; }
  var baseline = 100;
  var tempEl = document.createElement(el.tagName);
  var parentEl = (el.parentNode && (el.parentNode !== document)) ? el.parentNode : document.body;
  parentEl.appendChild(tempEl);
  tempEl.style.position = 'absolute';
  tempEl.style.width = baseline + unit;
  var factor = baseline / tempEl.offsetWidth;
  parentEl.removeChild(tempEl);
  var convertedUnit = factor * parseFloat(value);
  cache.CSS[value + unit] = convertedUnit;
  return convertedUnit;
}

function getCSSValue(el, prop, unit) {
  if (prop in el.style) {
    var uppercasePropName = prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    var value = el.style[prop] || getComputedStyle(el).getPropertyValue(uppercasePropName) || '0';
    return unit ? convertPxToUnit(el, value, unit) : value;
  }
}

function getAnimationType(el, prop) {
  if (is.dom(el) && !is.inp(el) && (!is.nil(getAttribute(el, prop)) || (is.svg(el) && el[prop]))) { return 'attribute'; }
  if (is.dom(el) && arrayContains(validTransforms, prop)) { return 'transform'; }
  if (is.dom(el) && (prop !== 'transform' && getCSSValue(el, prop))) { return 'css'; }
  if (el[prop] != null) { return 'object'; }
}

function getElementTransforms(el) {
  if (!is.dom(el)) { return; }
  var str = el.style.transform || '';
  var reg  = /(\w+)\(([^)]*)\)/g;
  var transforms = new Map();
  var m; while (m = reg.exec(str)) { transforms.set(m[1], m[2]); }
  return transforms;
}

function getTransformValue(el, propName, animatable, unit) {
  var defaultVal = stringContains(propName, 'scale') ? 1 : 0 + getTransformUnit(propName);
  var value = getElementTransforms(el).get(propName) || defaultVal;
  if (animatable) {
    animatable.transforms.list.set(propName, value);
    animatable.transforms['last'] = propName;
  }
  return unit ? convertPxToUnit(el, value, unit) : value;
}

function getOriginalTargetValue(target, propName, unit, animatable) {
  switch (getAnimationType(target, propName)) {
    case 'transform': return getTransformValue(target, propName, animatable, unit);
    case 'css': return getCSSValue(target, propName, unit);
    case 'attribute': return getAttribute(target, propName);
    default: return target[propName] || 0;
  }
}

function getRelativeValue(to, from) {
  var operator = /^(\*=|\+=|-=)/.exec(to);
  if (!operator) { return to; }
  var u = getUnit(to) || 0;
  var x = parseFloat(from);
  var y = parseFloat(to.replace(operator[0], ''));
  switch (operator[0][0]) {
    case '+': return x + y + u;
    case '-': return x - y + u;
    case '*': return x * y + u;
  }
}

function validateValue(val, unit) {
  if (is.col(val)) { return colorToRgb(val); }
  if (/\s/g.test(val)) { return val; }
  var originalUnit = getUnit(val);
  var unitLess = originalUnit ? val.substr(0, val.length - originalUnit.length) : val;
  if (unit) { return unitLess + unit; }
  return unitLess;
}

// getTotalLength() equivalent for circle, rect, polyline, polygon and line shapes
// adapted from https://gist.github.com/SebLambla/3e0550c496c236709744

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function getCircleLength(el) {
  return Math.PI * 2 * getAttribute(el, 'r');
}

function getRectLength(el) {
  return (getAttribute(el, 'width') * 2) + (getAttribute(el, 'height') * 2);
}

function getLineLength(el) {
  return getDistance(
    {x: getAttribute(el, 'x1'), y: getAttribute(el, 'y1')}, 
    {x: getAttribute(el, 'x2'), y: getAttribute(el, 'y2')}
  );
}

function getPolylineLength(el) {
  var points = el.points;
  var totalLength = 0;
  var previousPos;
  for (var i = 0 ; i < points.numberOfItems; i++) {
    var currentPos = points.getItem(i);
    if (i > 0) { totalLength += getDistance(previousPos, currentPos); }
    previousPos = currentPos;
  }
  return totalLength;
}

function getPolygonLength(el) {
  var points = el.points;
  return getPolylineLength(el) + getDistance(points.getItem(points.numberOfItems - 1), points.getItem(0));
}

// Path animation

function getTotalLength(el) {
  if (el.getTotalLength) { return el.getTotalLength(); }
  switch(el.tagName.toLowerCase()) {
    case 'circle': return getCircleLength(el);
    case 'rect': return getRectLength(el);
    case 'line': return getLineLength(el);
    case 'polyline': return getPolylineLength(el);
    case 'polygon': return getPolygonLength(el);
  }
}

function setDashoffset(el) {
  var pathLength = getTotalLength(el);
  el.setAttribute('stroke-dasharray', pathLength);
  return pathLength;
}

// Motion path

function getParentSvgEl(el) {
  var parentEl = el.parentNode;
  while (is.svg(parentEl)) {
    if (!is.svg(parentEl.parentNode)) { break; }
    parentEl = parentEl.parentNode;
  }
  return parentEl;
}

function getParentSvg(pathEl, svgData) {
  var svg = svgData || {};
  var parentSvgEl = svg.el || getParentSvgEl(pathEl);
  var rect = parentSvgEl.getBoundingClientRect();
  var viewBoxAttr = getAttribute(parentSvgEl, 'viewBox');
  var width = rect.width;
  var height = rect.height;
  var viewBox = svg.viewBox || (viewBoxAttr ? viewBoxAttr.split(' ') : [0, 0, width, height]);
  return {
    el: parentSvgEl,
    viewBox: viewBox,
    x: viewBox[0] / 1,
    y: viewBox[1] / 1,
    w: width,
    h: height,
    vW: viewBox[2],
    vH: viewBox[3]
  }
}

function getPath(path, percent) {
  var pathEl = is.str(path) ? selectString(path)[0] : path;
  var p = percent || 100;
  return function(property) {
    return {
      property: property,
      el: pathEl,
      svg: getParentSvg(pathEl),
      totalLength: getTotalLength(pathEl) * (p / 100)
    }
  }
}

function getPathProgress(path, progress, isPathTargetInsideSVG) {
  function point(offset) {
    if ( offset === void 0 ) offset = 0;

    var l = progress + offset >= 1 ? progress + offset : 0;
    return path.el.getPointAtLength(l);
  }
  var svg = getParentSvg(path.el, path.svg);
  var p = point();
  var p0 = point(-1);
  var p1 = point(+1);
  var scaleX = isPathTargetInsideSVG ? 1 : svg.w / svg.vW;
  var scaleY = isPathTargetInsideSVG ? 1 : svg.h / svg.vH;
  switch (path.property) {
    case 'x': return (p.x - svg.x) * scaleX;
    case 'y': return (p.y - svg.y) * scaleY;
    case 'angle': return Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
  }
}

// Decompose value

function decomposeValue(val, unit) {
  // const rgx = /-?\d*\.?\d+/g; // handles basic numbers
  // const rgx = /[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g; // handles exponents notation
  var rgx = /[+-]?\d*\.?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g; // handles exponents notation
  var value = validateValue((is.pth(val) ? val.totalLength : val), unit) + '';
  return {
    original: value,
    numbers: value.match(rgx) ? value.match(rgx).map(Number) : [0],
    strings: (is.str(val) || unit) ? value.split(rgx) : []
  }
}

// Animatables

function parseTargets(targets) {
  var targetsArray = targets ? (flattenArray(is.arr(targets) ? targets.map(toArray) : toArray(targets))) : [];
  return filterArray(targetsArray, function (item, pos, self) { return self.indexOf(item) === pos; });
}

function getAnimatables(targets) {
  var parsed = parseTargets(targets);
  return parsed.map(function (t, i) {
    return {target: t, id: i, total: parsed.length, transforms: { list: getElementTransforms(t) } };
  });
}

// Properties

function normalizePropertyTweens(prop, tweenSettings) {
  var settings = cloneObject(tweenSettings);
  // Override duration if easing is a spring
  if (/^spring/.test(settings.easing)) { settings.duration = spring(settings.easing); }
  if (is.arr(prop)) {
    var l = prop.length;
    var isFromTo = (l === 2 && !is.obj(prop[0]));
    if (!isFromTo) {
      // Duration divided by the number of tweens
      if (!is.fnc(tweenSettings.duration)) { settings.duration = tweenSettings.duration / l; }
    } else {
      // Transform [from, to] values shorthand to a valid tween value
      prop = {value: prop};
    }
  }
  var propArray = is.arr(prop) ? prop : [prop];
  return propArray.map(function (v, i) {
    var obj = (is.obj(v) && !is.pth(v)) ? v : {value: v};
    // Default delay value should only be applied to the first tween
    if (is.und(obj.delay)) { obj.delay = !i ? tweenSettings.delay : 0; }
    // Default endDelay value should only be applied to the last tween
    if (is.und(obj.endDelay)) { obj.endDelay = i === propArray.length - 1 ? tweenSettings.endDelay : 0; }
    return obj;
  }).map(function (k) { return mergeObjects(k, settings); });
}


function flattenKeyframes(keyframes) {
  var propertyNames = filterArray(flattenArray(keyframes.map(function (key) { return Object.keys(key); })), function (p) { return is.key(p); })
  .reduce(function (a,b) { if (a.indexOf(b) < 0) { a.push(b); } return a; }, []);
  var properties = {};
  var loop = function ( i ) {
    var propName = propertyNames[i];
    properties[propName] = keyframes.map(function (key) {
      var newKey = {};
      for (var p in key) {
        if (is.key(p)) {
          if (p == propName) { newKey.value = key[p]; }
        } else {
          newKey[p] = key[p];
        }
      }
      return newKey;
    });
  };

  for (var i = 0; i < propertyNames.length; i++) loop( i );
  return properties;
}

function getProperties(tweenSettings, params) {
  var properties = [];
  var keyframes = params.keyframes;
  if (keyframes) { params = mergeObjects(flattenKeyframes(keyframes), params); }
  for (var p in params) {
    if (is.key(p)) {
      properties.push({
        name: p,
        tweens: normalizePropertyTweens(params[p], tweenSettings)
      });
    }
  }
  return properties;
}

// Tweens

function normalizeTweenValues(tween, animatable) {
  var t = {};
  for (var p in tween) {
    var value = getFunctionValue(tween[p], animatable);
    if (is.arr(value)) {
      value = value.map(function (v) { return getFunctionValue(v, animatable); });
      if (value.length === 1) { value = value[0]; }
    }
    t[p] = value;
  }
  t.duration = parseFloat(t.duration);
  t.delay = parseFloat(t.delay);
  return t;
}

function normalizeTweens(prop, animatable) {
  var previousTween;
  return prop.tweens.map(function (t) {
    var tween = normalizeTweenValues(t, animatable);
    var tweenValue = tween.value;
    var to = is.arr(tweenValue) ? tweenValue[1] : tweenValue;
    var toUnit = getUnit(to);
    var originalValue = getOriginalTargetValue(animatable.target, prop.name, toUnit, animatable);
    var previousValue = previousTween ? previousTween.to.original : originalValue;
    var from = is.arr(tweenValue) ? tweenValue[0] : previousValue;
    var fromUnit = getUnit(from) || getUnit(originalValue);
    var unit = toUnit || fromUnit;
    if (is.und(to)) { to = previousValue; }
    tween.from = decomposeValue(from, unit);
    tween.to = decomposeValue(getRelativeValue(to, from), unit);
    tween.start = previousTween ? previousTween.end : 0;
    tween.end = tween.start + tween.delay + tween.duration + tween.endDelay;
    tween.easing = parseEasings(tween.easing, tween.duration);
    tween.isPath = is.pth(tweenValue);
    tween.isPathTargetInsideSVG = tween.isPath && is.svg(animatable.target);
    tween.isColor = is.col(tween.from.original);
    if (tween.isColor) { tween.round = 1; }
    previousTween = tween;
    return tween;
  });
}

// Tween progress

var setProgressValue = {
  css: function (t, p, v) { return t.style[p] = v; },
  attribute: function (t, p, v) { return t.setAttribute(p, v); },
  object: function (t, p, v) { return t[p] = v; },
  transform: function (t, p, v, transforms, manual) {
    transforms.list.set(p, v);
    if (p === transforms.last || manual) {
      var str = '';
      transforms.list.forEach(function (value, prop) { str += prop + "(" + value + ") "; });
      t.style.transform = str;
    }
  }
};

// Set Value helper

function setTargetsValue(targets, properties) {
  var animatables = getAnimatables(targets);
  animatables.forEach(function (animatable) {
    for (var property in properties) {
      var value = getFunctionValue(properties[property], animatable);
      var target = animatable.target;
      var valueUnit = getUnit(value);
      var originalValue = getOriginalTargetValue(target, property, valueUnit, animatable);
      var unit = valueUnit || getUnit(originalValue);
      var to = getRelativeValue(validateValue(value, unit), originalValue);
      var animType = getAnimationType(target, property);
      setProgressValue[animType](target, property, to, animatable.transforms, true);
    }
  });
}

// Animations

function createAnimation(animatable, prop) {
  var animType = getAnimationType(animatable.target, prop.name);
  if (animType) {
    var tweens = normalizeTweens(prop, animatable);
    var lastTween = tweens[tweens.length - 1];
    return {
      type: animType,
      property: prop.name,
      animatable: animatable,
      tweens: tweens,
      duration: lastTween.end,
      delay: tweens[0].delay,
      endDelay: lastTween.endDelay
    }
  }
}

function getAnimations(animatables, properties) {
  return filterArray(flattenArray(animatables.map(function (animatable) {
    return properties.map(function (prop) {
      return createAnimation(animatable, prop);
    });
  })), function (a) { return !is.und(a); });
}

// Create Instance

function getInstanceTimings(animations, tweenSettings) {
  var animLength = animations.length;
  var getTlOffset = function (anim) { return anim.timelineOffset ? anim.timelineOffset : 0; };
  var timings = {};
  timings.duration = animLength ? Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration; })) : tweenSettings.duration;
  timings.delay = animLength ? Math.min.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.delay; })) : tweenSettings.delay;
  timings.endDelay = animLength ? timings.duration - Math.max.apply(Math, animations.map(function (anim) { return getTlOffset(anim) + anim.duration - anim.endDelay; })) : tweenSettings.endDelay;
  return timings;
}

var instanceID = 0;

function createNewInstance(params) {
  var instanceSettings = replaceObjectProps(defaultInstanceSettings, params);
  var tweenSettings = replaceObjectProps(defaultTweenSettings, params);
  var properties = getProperties(tweenSettings, params);
  var animatables = getAnimatables(params.targets);
  var animations = getAnimations(animatables, properties);
  var timings = getInstanceTimings(animations, tweenSettings);
  var id = instanceID;
  instanceID++;
  return mergeObjects(instanceSettings, {
    id: id,
    children: [],
    animatables: animatables,
    animations: animations,
    duration: timings.duration,
    delay: timings.delay,
    endDelay: timings.endDelay
  });
}

// Core

var activeInstances = [];

var engine = (function () {
  var raf;

  function play() {
    if (!raf && (!isDocumentHidden() || !anime.suspendWhenDocumentHidden) && activeInstances.length > 0) {
      raf = requestAnimationFrame(step);
    }
  }
  function step(t) {
    // memo on algorithm issue:
    // dangerous iteration over mutable `activeInstances`
    // (that collection may be updated from within callbacks of `tick`-ed animation instances)
    var activeInstancesLength = activeInstances.length;
    var i = 0;
    while (i < activeInstancesLength) {
      var activeInstance = activeInstances[i];
      if (!activeInstance.paused) {
        activeInstance.tick(t);
        i++;
      } else {
        activeInstances.splice(i, 1);
        activeInstancesLength--;
      }
    }
    raf = i > 0 ? requestAnimationFrame(step) : undefined;
  }

  function handleVisibilityChange() {
    if (!anime.suspendWhenDocumentHidden) { return; }

    if (isDocumentHidden()) {
      // suspend ticks
      raf = cancelAnimationFrame(raf);
    } else { // is back to active tab
      // first adjust animations to consider the time that ticks were suspended
      activeInstances.forEach(
        function (instance) { return instance ._onDocumentVisibility(); }
      );
      engine();
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return play;
})();

function isDocumentHidden() {
  return !!document && document.hidden;
}

// Public Instance

function anime(params) {
  if ( params === void 0 ) params = {};


  var startTime = 0, lastTime = 0, now = 0;
  var children, childrenLength = 0;
  var resolve = null;

  function makePromise(instance) {
    var promise = window.Promise && new Promise(function (_resolve) { return resolve = _resolve; });
    instance.finished = promise;
    return promise;
  }

  var instance = createNewInstance(params);
  var promise = makePromise(instance);

  function toggleInstanceDirection() {
    var direction = instance.direction;
    if (direction !== 'alternate') {
      instance.direction = direction !== 'normal' ? 'normal' : 'reverse';
    }
    instance.reversed = !instance.reversed;
    children.forEach(function (child) { return child.reversed = instance.reversed; });
  }

  function adjustTime(time) {
    return instance.reversed ? instance.duration - time : time;
  }

  function resetTime() {
    startTime = 0;
    lastTime = adjustTime(instance.currentTime) * (1 / anime.speed);
  }

  function seekChild(time, child) {
    if (child) { child.seek(time - child.timelineOffset); }
  }

  function syncInstanceChildren(time) {
    if (!instance.reversePlayback) {
      for (var i = 0; i < childrenLength; i++) { seekChild(time, children[i]); }
    } else {
      for (var i$1 = childrenLength; i$1--;) { seekChild(time, children[i$1]); }
    }
  }

  function setAnimationsProgress(insTime) {
    var i = 0;
    var animations = instance.animations;
    var animationsLength = animations.length;
    while (i < animationsLength) {
      var anim = animations[i];
      var animatable = anim.animatable;
      var tweens = anim.tweens;
      var tweenLength = tweens.length - 1;
      var tween = tweens[tweenLength];
      // Only check for keyframes if there is more than one tween
      if (tweenLength) { tween = filterArray(tweens, function (t) { return (insTime < t.end); })[0] || tween; }
      var elapsed = minMax(insTime - tween.start - tween.delay, 0, tween.duration) / tween.duration;
      var eased = isNaN(elapsed) ? 1 : tween.easing(elapsed);
      var strings = tween.to.strings;
      var round = tween.round;
      var numbers = [];
      var toNumbersLength = tween.to.numbers.length;
      var progress = (void 0);
      for (var n = 0; n < toNumbersLength; n++) {
        var value = (void 0);
        var toNumber = tween.to.numbers[n];
        var fromNumber = tween.from.numbers[n] || 0;
        if (!tween.isPath) {
          value = fromNumber + (eased * (toNumber - fromNumber));
        } else {
          value = getPathProgress(tween.value, eased * toNumber, tween.isPathTargetInsideSVG);
        }
        if (round) {
          if (!(tween.isColor && n > 2)) {
            value = Math.round(value * round) / round;
          }
        }
        numbers.push(value);
      }
      // Manual Array.reduce for better performances
      var stringsLength = strings.length;
      if (!stringsLength) {
        progress = numbers[0];
      } else {
        progress = strings[0];
        for (var s = 0; s < stringsLength; s++) {
          var a = strings[s];
          var b = strings[s + 1];
          var n$1 = numbers[s];
          if (!isNaN(n$1)) {
            if (!b) {
              progress += n$1 + ' ';
            } else {
              progress += n$1 + b;
            }
          }
        }
      }
      setProgressValue[anim.type](animatable.target, anim.property, progress, animatable.transforms);
      anim.currentValue = progress;
      i++;
    }
  }

  function setCallback(cb) {
    if (instance[cb] && !instance.passThrough) { instance[cb](instance); }
  }

  function countIteration() {
    if (instance.remaining && instance.remaining !== true) {
      instance.remaining--;
    }
  }

  function setInstanceProgress(engineTime) {
    var insDuration = instance.duration;
    var insDelay = instance.delay;
    var insEndDelay = insDuration - instance.endDelay;
    var insTime = adjustTime(engineTime);
    instance.progress = minMax((insTime / insDuration) * 100, 0, 100);
    instance.reversePlayback = insTime < instance.currentTime;
    if (children) { syncInstanceChildren(insTime); }
    if (!instance.began && instance.currentTime > 0) {
      instance.began = true;
      setCallback('begin');
    }
    if (!instance.loopBegan && instance.currentTime > 0) {
      instance.loopBegan = true;
      setCallback('loopBegin');
    }
    if (insTime <= insDelay && instance.currentTime !== 0) {
      setAnimationsProgress(0);
    }
    if ((insTime >= insEndDelay && instance.currentTime !== insDuration) || !insDuration) {
      setAnimationsProgress(insDuration);
    }
    if (insTime > insDelay && insTime < insEndDelay) {
      if (!instance.changeBegan) {
        instance.changeBegan = true;
        instance.changeCompleted = false;
        setCallback('changeBegin');
      }
      setCallback('change');
      setAnimationsProgress(insTime);
    } else {
      if (instance.changeBegan) {
        instance.changeCompleted = true;
        instance.changeBegan = false;
        setCallback('changeComplete');
      }
    }
    instance.currentTime = minMax(insTime, 0, insDuration);
    if (instance.began) { setCallback('update'); }
    if (engineTime >= insDuration) {
      lastTime = 0;
      countIteration();
      if (!instance.remaining) {
        instance.paused = true;
        if (!instance.completed) {
          instance.completed = true;
          setCallback('loopComplete');
          setCallback('complete');
          if (!instance.passThrough && 'Promise' in window) {
            resolve();
            promise = makePromise(instance);
          }
        }
      } else {
        startTime = now;
        setCallback('loopComplete');
        instance.loopBegan = false;
        if (instance.direction === 'alternate') {
          toggleInstanceDirection();
        }
      }
    }
  }

  instance.reset = function() {
    var direction = instance.direction;
    instance.passThrough = false;
    instance.currentTime = 0;
    instance.progress = 0;
    instance.paused = true;
    instance.began = false;
    instance.loopBegan = false;
    instance.changeBegan = false;
    instance.completed = false;
    instance.changeCompleted = false;
    instance.reversePlayback = false;
    instance.reversed = direction === 'reverse';
    instance.remaining = instance.loop;
    children = instance.children;
    childrenLength = children.length;
    for (var i = childrenLength; i--;) { instance.children[i].reset(); }
    if (instance.reversed && instance.loop !== true || (direction === 'alternate' && instance.loop === 1)) { instance.remaining++; }
    setAnimationsProgress(instance.reversed ? instance.duration : 0);
  };

  // internal method (for engine) to adjust animation timings before restoring engine ticks (rAF)
  instance._onDocumentVisibility = resetTime;

  // Set Value helper

  instance.set = function(targets, properties) {
    setTargetsValue(targets, properties);
    return instance;
  };

  instance.tick = function(t) {
    now = t;
    if (!startTime) { startTime = now; }
    setInstanceProgress((now + (lastTime - startTime)) * anime.speed);
  };

  instance.seek = function(time) {
    setInstanceProgress(adjustTime(time));
  };

  instance.pause = function() {
    instance.paused = true;
    resetTime();
  };

  instance.play = function() {
    if (!instance.paused) { return; }
    if (instance.completed) { instance.reset(); }
    instance.paused = false;
    activeInstances.push(instance);
    resetTime();
    engine();
  };

  instance.reverse = function() {
    toggleInstanceDirection();
    instance.completed = instance.reversed ? false : true;
    resetTime();
  };

  instance.restart = function() {
    instance.reset();
    instance.play();
  };

  instance.remove = function(targets) {
    var targetsArray = parseTargets(targets);
    removeTargetsFromInstance(targetsArray, instance);
  };

  instance.reset();

  if (instance.autoplay) { instance.play(); }

  return instance;

}

// Remove targets from animation

function removeTargetsFromAnimations(targetsArray, animations) {
  for (var a = animations.length; a--;) {
    if (arrayContains(targetsArray, animations[a].animatable.target)) {
      animations.splice(a, 1);
    }
  }
}

function removeTargetsFromInstance(targetsArray, instance) {
  var animations = instance.animations;
  var children = instance.children;
  removeTargetsFromAnimations(targetsArray, animations);
  for (var c = children.length; c--;) {
    var child = children[c];
    var childAnimations = child.animations;
    removeTargetsFromAnimations(targetsArray, childAnimations);
    if (!childAnimations.length && !child.children.length) { children.splice(c, 1); }
  }
  if (!animations.length && !children.length) { instance.pause(); }
}

function removeTargetsFromActiveInstances(targets) {
  var targetsArray = parseTargets(targets);
  for (var i = activeInstances.length; i--;) {
    var instance = activeInstances[i];
    removeTargetsFromInstance(targetsArray, instance);
  }
}

// Stagger helpers

function stagger(val, params) {
  if ( params === void 0 ) params = {};

  var direction = params.direction || 'normal';
  var easing = params.easing ? parseEasings(params.easing) : null;
  var grid = params.grid;
  var axis = params.axis;
  var fromIndex = params.from || 0;
  var fromFirst = fromIndex === 'first';
  var fromCenter = fromIndex === 'center';
  var fromLast = fromIndex === 'last';
  var isRange = is.arr(val);
  var val1 = isRange ? parseFloat(val[0]) : parseFloat(val);
  var val2 = isRange ? parseFloat(val[1]) : 0;
  var unit = getUnit(isRange ? val[1] : val) || 0;
  var start = params.start || 0 + (isRange ? val1 : 0);
  var values = [];
  var maxValue = 0;
  return function (el, i, t) {
    if (fromFirst) { fromIndex = 0; }
    if (fromCenter) { fromIndex = (t - 1) / 2; }
    if (fromLast) { fromIndex = t - 1; }
    if (!values.length) {
      for (var index = 0; index < t; index++) {
        if (!grid) {
          values.push(Math.abs(fromIndex - index));
        } else {
          var fromX = !fromCenter ? fromIndex%grid[0] : (grid[0]-1)/2;
          var fromY = !fromCenter ? Math.floor(fromIndex/grid[0]) : (grid[1]-1)/2;
          var toX = index%grid[0];
          var toY = Math.floor(index/grid[0]);
          var distanceX = fromX - toX;
          var distanceY = fromY - toY;
          var value = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
          if (axis === 'x') { value = -distanceX; }
          if (axis === 'y') { value = -distanceY; }
          values.push(value);
        }
        maxValue = Math.max.apply(Math, values);
      }
      if (easing) { values = values.map(function (val) { return easing(val / maxValue) * maxValue; }); }
      if (direction === 'reverse') { values = values.map(function (val) { return axis ? (val < 0) ? val * -1 : -val : Math.abs(maxValue - val); }); }
    }
    var spacing = isRange ? (val2 - val1) / maxValue : val1;
    return start + (spacing * (Math.round(values[i] * 100) / 100)) + unit;
  }
}

// Timeline

function timeline(params) {
  if ( params === void 0 ) params = {};

  var tl = anime(params);
  tl.duration = 0;
  tl.add = function(instanceParams, timelineOffset) {
    var tlIndex = activeInstances.indexOf(tl);
    var children = tl.children;
    if (tlIndex > -1) { activeInstances.splice(tlIndex, 1); }
    function passThrough(ins) { ins.passThrough = true; }
    for (var i = 0; i < children.length; i++) { passThrough(children[i]); }
    var insParams = mergeObjects(instanceParams, replaceObjectProps(defaultTweenSettings, params));
    insParams.targets = insParams.targets || params.targets;
    var tlDuration = tl.duration;
    insParams.autoplay = false;
    insParams.direction = tl.direction;
    insParams.timelineOffset = is.und(timelineOffset) ? tlDuration : getRelativeValue(timelineOffset, tlDuration);
    passThrough(tl);
    tl.seek(insParams.timelineOffset);
    var ins = anime(insParams);
    passThrough(ins);
    children.push(ins);
    var timings = getInstanceTimings(children, params);
    tl.delay = timings.delay;
    tl.endDelay = timings.endDelay;
    tl.duration = timings.duration;
    tl.seek(0);
    tl.reset();
    if (tl.autoplay) { tl.play(); }
    return tl;
  };
  return tl;
}

anime.version = '3.2.1';
anime.speed = 1;
// TODO:#review: naming, documentation
anime.suspendWhenDocumentHidden = true;
anime.running = activeInstances;
anime.remove = removeTargetsFromActiveInstances;
anime.get = getOriginalTargetValue;
anime.set = setTargetsValue;
anime.convertPx = convertPxToUnit;
anime.path = getPath;
anime.setDashoffset = setDashoffset;
anime.stagger = stagger;
anime.timeline = timeline;
anime.easing = parseEasings;
anime.penner = penner;
anime.random = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };

module.exports = anime;



================================================
FILE: src/modules/animation/interface/Index.vue
================================================
<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    <template #header>
      <!-- Your header content -->
    </template>

    <!-- Your main content -->
    <h1>{{ t("title") }} | Clock With Anime.js</h1>
    <button @click="openShowAnimation = !openShowAnimation">
      Show Animation
    </button>
    <br />
    <button @click="openEditAnimation = !openEditAnimation">
      Edit Animation
    </button>

    <ShowAnimation v-if="openShowAnimation" />
    <EditAnimation v-if="openEditAnimation" />
  </ModuleContainer>
</template>

<script setup>
import ModuleContainer from "@/components/ModuleContainer.vue";
import { ref, watch } from "vue";
import manifest from "../manifest.json";
import ShowAnimation from "./components/modals/ShowAnimation.vue";
import EditAnimation from "./components/modals/EditAnimation.vue";

// ---- Obrigatório para tradução -------
const moduleContainer = ref(null);
const t = (key) => {
  return moduleContainer.value?.t(key) || key;
};

// ---------------------------------------

const openShowAnimation = ref(false);
const openEditAnimation = ref(false);

// Watcher open (Only one modal can be open at a time, if one is open, the other is closed)

watch(openShowAnimation, (value) => {
  if (value) {
    openEditAnimation.value = false;
  }
});

watch(openEditAnimation, (value) => {
  if (value) {
    openShowAnimation.value = false;
  }
});
</script>



================================================
FILE: src/modules/animation/interface/components/modals/EditAnimation.vue
================================================
<template>
  <div>
    <div class="main_container">
      <!-- svg making up the clock -->
      <svg viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <!-- filters describing the shadows, applied on the larger and smaller shapes -->
          <filter id="shadow-large">
            <feDropShadow dx="0" dy="0" stdDeviation="4" />
          </filter>
          <filter id="shadow-small">
            <feDropShadow dx="0" dy="0" stdDeviation="0.2" />
          </filter>

          <!-- mask used to cut out a sliver of the overlaid circle -->
          <mask id="mask">
            <g transform="translate(50 50)">
              <!-- starting at -15, incrementing by 30 for each hour -->
              <g class="hours" transform="rotate(-15)">
                <circle cx="0" cy="0" r="50" fill="#fff"></circle>
                <path d="M 0 -50 v 50 l 28.86 -50" fill="#000"></path>
              </g>
            </g>
          </mask>
        </defs>

        <!-- circle making up the bottom of the clock -->
        <circle cx="50" cy="50" r="46" fill="#303335"></circle>

        <!-- circle with the accent color, overlaid before the text elements -->
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="#EA3F3F"
          filter="url(#shadow-large)"
        ></circle>

        <!-- text elements, positioned from the center around the clock -->
        <g
          class="clock--face"
          font-size="8px"
          transform="translate(50 50)"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          <!-- the elements are included through the script, at intervals of 30 degrees -->
          <!--
        <text
            transform="rotate(-90) translate(35 0) rotate(90)" >
            12
        </text>

        <text
            transform="rotate(-0) translate(35 0) rotate(0)" >
            03
        </text>
        --></g>

        <!-- circle overlaid on the accent circle and text elements -->
        <circle
          mask="url(#mask)"
          cx="50"
          cy="50"
          r="50"
          fill="#303335"
        ></circle>

        <!-- smaller circle on which the hands sit -->
        <circle
          cx="50"
          cy="50"
          r="4"
          filter="url(#shadow-small)"
          fill="#303335"
        ></circle>

        <!-- clock's hands -->
        <!-- centered in the clock and rotated according to the passage of time in the 0-360 range -->
        <g class="hands" transform="translate(50 50)">
          <g class="minutes" transform="rotate(240)">
            <!-- change rotation of this group to affect both clock's hand -->
            <path fill="#fff" d="M -0.4 8 h 0.8 v -33 h -0.8 z"></path>
            <circle fill="#303335" cx="0" cy="0" r="0.6"></circle>
          </g>

          <g class="seconds" transform="rotate(80)">
            <!-- change rotation of this group to affect both clock's hand -->
            <path fill="#EA3F3F" d="M -0.4 10 h 0.8 v -45 h -0.8 z"></path>
            <circle
              stroke-width="0.4"
              stroke="#EA3F3F"
              fill="#303335"
              cx="0"
              cy="0"
              r="0.8"
            ></circle>
          </g>
        </g>
      </svg>

      <!-- div wrapping the controls to change the number of hours/minutes/seconds -->
      <div class="controls">
        <div class="controls_control" data-control="hours">
          <button>+</button>
          <span class="control--hours">h</span>
          <button>-</button>
        </div>

        <div class="controls_control" data-control="minutes">
          <button>+</button>
          <span class="control--minutes">m</span>
          <button>-</button>
        </div>

        <div class="controls_control" data-control="seconds">
          <button>+</button>
          <span class="control--seconds">s</span>
          <button>-</button>
        </div>
      </div>
    </div>
  </div>
</template>

<!-- ONLINE - Load Dependencie by CDN -->
<script setup>
import { onMounted } from "vue";
import log from "../../../scripts/log.js";

log("CreateAnimation.vue");

onMounted(() => {
  log("CreateAnimation.vue mounted");
  const script = document.createElement("script");
  script.src =
    "https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js";
  script.async = true;

  script.onload = () => {
    const zeroPadded = (number) =>
      number >= 10 ? number.toString() : `0${number}`;

    // function taking as input an hour value in the [0-23] range and returning the 12 hours format
    const twelveClock = (twentyFourClock) => {
      if (twentyFourClock === 0) {
        return 12;
      }
      if (twentyFourClock > 12) {
        return twentyFourClock - 12;
      }
      return twentyFourClock;
    };

    // 1. SVG clock face
    const clockFace = document.querySelector("svg g.clock--face");
    // add the twelve numbers by rotating, translating and then rotating back text elements
    // ! add a zero to the numbers smaller than 10 through the utility function
    for (let i = 0; i < 12; i += 1) {
      clockFace.innerHTML += `
    <text
        transform="rotate(${-90 + 30 * (i + 1)}) translate(34 0) rotate(${
        90 - 30 * (i + 1)
      })" >
        ${zeroPadded(i + 1)}
    </text>
  `;
    }

    // SVG & BUTTONS current time
    // retrieve the current number of hours, minutes and seconds
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // as hours in the 0-23 range, normalize the values in the 1-12 range
    const time = {
      hours: twelveClock(hours), // 1-12
      minutes, // 0-59
      seconds, // 0-59
    };

    // create another object describing the time's value, for the rotation of the hands
    // this to avoid the glitch occurring when the time goes back to 0 (or back to 1 for the hours)
    const rotation = {
      hours: twelveClock(hours),
      minutes,
      seconds,
    };

    // use the values to update the svg and the text of the span elements
    const entries = Object.entries(time);
    entries.forEach(([key, value]) => {
      anime({
        targets: `g.${key}`,
        transform:
          key === "hours"
            ? `rotate(${-15 + value * 30})`
            : `rotate(${value * 6})`,
        duration: 2000,
      });

      const span = document.querySelector(`span.control--${key}`);
      span.textContent = zeroPadded(value);
    });

    // BUTTONS click event
    const buttons = document.querySelectorAll("button");

    // function returning new values for the time and rotation object, according to the input instructions
    function updateValues(instructions) {
      /* destructure the necessary information
  key: hours, minutes or seconds
  operation: + or -
  timeValue: number in the [1-12] or [0-59] range
  rotationValue: number
  */
      const { key, operation } = instructions;
      const { timeValue, rotationValue } = instructions;

      // create a number of degrees based on the previous value and the current operation
      const degrees = operation === "+" ? rotationValue + 1 : rotationValue - 1;
      // create a number of hours/minutes/seconds on the basis of the operation
      let value = operation === "+" ? timeValue + 1 : timeValue - 1;

      // format the value to fall in the prescribed range
      if (key === "hours") {
        value = value > 12 ? 1 : value === 0 ? 12 : value;
      } else {
        value = value > 59 ? 0 : value < 0 ? 59 : value;
      }

      // return the updated time and rotation value
      return { value, degrees };
    }

    // function called when a click is registered on the button elements
    function handleClick() {
      // retrieve the necessary information from the wrapping container and the current element
      const key = this.parentElement.getAttribute("data-control");
      const operation = this.textContent;
      // retrieve the previous values
      const timeValue = time[key];
      const rotationValue = rotation[key];

      // based on the set instruction call the function updating the time and rotation values
      const instructions = {
        key,
        operation,
        timeValue,
        rotationValue,
      };
      const { value, degrees } = updateValues(instructions);

      // update the objects
      time[key] = value;
      rotation[key] = degrees;

      // update the position of the matching hand
      anime({
        targets: `g.${key}`,
        transform:
          key === "hours"
            ? `rotate(${-15 + degrees * 30})`
            : `rotate(${degrees * 6})`,
        duration: 400,
        // remove the event listeners from the input buttons until the animation is complete
        begin: () =>
          buttons.forEach((button) =>
            button.removeEventListener("click", handleClick)
          ),
        complete: () =>
          buttons.forEach((button) =>
            button.addEventListener("click", handleClick)
          ),
      });

      // update the text of the matching span
      if (key !== null) {
        const span = document.querySelector(`span.control--${key}`);
        span.textContent = zeroPadded(value);
      }
    }

    buttons.forEach((button) => button.addEventListener("click", handleClick));
  };
  document.body.appendChild(script);
});
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css?family=Barlow|Barlow+Condensed&display=swap");

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}
/* position the svg and div wrapping the controls one atop the other */
body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #262728;
  font-family: "Barlow", sans-serif;
}
/* have the clock describing the svg expand to cover a sizeable portion of the viewport */
svg {
  margin-top: 1rem;
  width: 60vmin;
  height: auto;
  filter: url(#shadow-large);
}
svg text {
  font-family: "Barlow Condensed", sans-serif;
}

/* display the controls side by side */
.controls {
  display: flex;
  flex-wrap: wrap;
  margin-top: 2rem;
}
/* display the button+span elements in columns */
.controls div {
  text-align: center;
  display: flex;
  flex-direction: column;
  margin: 1rem;
}
/* style the buttons with the same colors used for the clock */
.controls div button {
  border: none;
  border-radius: 50%;
  background: #ea3f3f;
  padding: 0.25rem;
  color: #fff;
  width: 48px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem;
  filter: url(#shadow-large);
  margin: 0.5rem 0;
}
.controls div span {
  color: #fff;
}

.main_container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}
</style>



================================================
FILE: src/modules/animation/interface/components/modals/ShowAnimation.vue
================================================
<template>
  <div>
    <div class="main_container">
      <!-- svg making up the clock -->
      <svg viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <!-- filters describing the shadows, applied on the larger and smaller shapes -->
          <filter id="shadow-large">
            <feDropShadow dx="0" dy="0" stdDeviation="4" />
          </filter>
          <filter id="shadow-small">
            <feDropShadow dx="0" dy="0" stdDeviation="0.2" />
          </filter>

          <!-- mask used to cut out a sliver of the overlaid circle -->
          <mask id="mask">
            <g transform="translate(50 50)">
              <!-- starting at -15, incrementing by 30 for each hour -->
              <g class="hours" transform="rotate(-15)">
                <circle cx="0" cy="0" r="50" fill="#fff"></circle>
                <path d="M 0 -50 v 50 l 28.86 -50" fill="#000"></path>
              </g>
            </g>
          </mask>
        </defs>

        <!-- circle making up the bottom of the clock -->
        <circle cx="50" cy="50" r="46" fill="#303335"></circle>

        <!-- circle with the accent color, overlaid before the text elements -->
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="#EA3F3F"
          filter="url(#shadow-large)"
        ></circle>

        <!-- text elements, positioned from the center around the clock -->
        <g
          class="clock--face"
          font-size="8px"
          transform="translate(50 50)"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          <!-- the elements are included through the script, at intervals of 30 degrees -->
          <!--
        <text
            transform="rotate(-90) translate(35 0) rotate(90)" >
            12
        </text>

        <text
            transform="rotate(-0) translate(35 0) rotate(0)" >
            03
        </text>
        --></g>

        <!-- circle overlaid on the accent circle and text elements -->
        <circle
          mask="url(#mask)"
          cx="50"
          cy="50"
          r="50"
          fill="#303335"
        ></circle>

        <!-- smaller circle on which the hands sit -->
        <circle
          cx="50"
          cy="50"
          r="4"
          filter="url(#shadow-small)"
          fill="#303335"
        ></circle>

        <!-- clock's hands -->
        <!-- centered in the clock and rotated according to the passage of time in the 0-360 range -->
        <g class="hands" transform="translate(50 50)">
          <g class="minutes" transform="rotate(240)">
            <!-- change rotation of this group to affect both clock's hand -->
            <path fill="#fff" d="M -0.4 8 h 0.8 v -33 h -0.8 z"></path>
            <circle fill="#303335" cx="0" cy="0" r="0.6"></circle>
          </g>

          <g class="seconds" transform="rotate(80)">
            <!-- change rotation of this group to affect both clock's hand -->
            <path fill="#EA3F3F" d="M -0.4 10 h 0.8 v -45 h -0.8 z"></path>
            <circle
              stroke-width="0.4"
              stroke="#EA3F3F"
              fill="#303335"
              cx="0"
              cy="0"
              r="0.8"
            ></circle>
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<!-- OFFLINE - Load Dependencie By File -->
<script setup>
import { onMounted } from "vue";
import log from "../../../scripts/log.js";

// Offline Method (Preferred)
import anime from "../../../dependencies/animejs/lib/anime.es.js";
log("CreateAnimation.vue");

onMounted(() => {
  log("CreateAnimation.vue mounted");

  const zeroPadded = (number) =>
    number >= 10 ? number.toString() : `0${number}`;

  // function taking as input an hour value in the [0-23] range and returning the 12 hours format
  const twelveClock = (twentyFourClock) => {
    if (twentyFourClock === 0) {
      return 12;
    }
    if (twentyFourClock > 12) {
      return twentyFourClock - 12;
    }
    return twentyFourClock;
  };

  // 1. SVG clock face
  const clockFace = document.querySelector("svg g.clock--face");
  // add the twelve numbers by rotating, translating and then rotating back text elements
  // ! add a zero to the numbers smaller than 10 through the utility function
  for (let i = 0; i < 12; i += 1) {
    clockFace.innerHTML += `
    <text
        transform="rotate(${-90 + 30 * (i + 1)}) translate(34 0) rotate(${
      90 - 30 * (i + 1)
    })" >
        ${zeroPadded(i + 1)}
    </text>
  `;
  }

  // SVG & BUTTONS current time
  // retrieve the current number of hours, minutes and seconds
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // as hours in the 0-23 range, normalize the values in the 1-12 range
  const time = {
    hours: twelveClock(hours), // 1-12
    minutes, // 0-59
    seconds, // 0-59
  };

  // create another object describing the time's value, for the rotation of the hands
  // this to avoid the glitch occurring when the time goes back to 0 (or back to 1 for the hours)
  const rotation = {
    hours: twelveClock(hours),
    minutes,
    seconds,
  };

  // use the values to update the svg and the text of the span elements
  const entries = Object.entries(time);
  entries.forEach(([key, value]) => {
    anime({
      targets: `g.${key}`,
      transform:
        key === "hours"
          ? `rotate(${-15 + value * 30})`
          : `rotate(${value * 6})`,
      duration: 2000,
    });
  });
});
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css?family=Barlow|Barlow+Condensed&display=swap");

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}
/* position the svg and div wrapping the controls one atop the other */
body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #262728;
  font-family: "Barlow", sans-serif;
}
/* have the clock describing the svg expand to cover a sizeable portion of the viewport */
svg {
  margin-top: 1rem;
  width: 60vmin;
  height: auto;
  filter: url(#shadow-large);
}
svg text {
  font-family: "Barlow Condensed", sans-serif;
}

.main_container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}
</style>



================================================
FILE: src/modules/animation/lang/es.json
================================================
{
    "title": "Animaciones",
    "text": "ESPANHOL",
    "modals": {
        "create": {
            "title": "Crear animación",
            "name": "Nombre",
            "description": "Descripción"
        },
        "edit": {
            "title": "Editar animación",
            "name": "Nombre",
            "description": "Descripción"
        }
    }
}


================================================
FILE: src/modules/animation/lang/pt.json
================================================
{
    "title": "Animação",
    "text": "PORTUGUES",
    "modals": {
        "create": {
            "title": "Criar animação",
            "name": "Nome",
            "description": "Descrição"
        },
        "edit": {
            "title": "Editar animação",
            "name": "Nome",
            "description": "Descrição"
        }
    }
}


================================================
FILE: src/modules/animation/scripts/log.js
================================================
export default (message) => {
  console.log(message);

  return {
    status: 'success',
    message: 'Log message printed successfully'
  }
}


================================================
FILE: src/modules/base_module/index.js
================================================
import BaseModule from "../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/base_module/manifest.json
================================================
{
  "id": "base_module",
  "name": "Módulo Template",
  "development": true,
  "description": "Módulo base para criação de outros módulos",
  "category": "utilities",
  "icon": "mdi-monitor-dashboard",
  "customization": {
    "font": {
      "type": "font",
      "label": "customization.font",
      "default": "Arial, sans-serif"
    },
    "font_color": {
      "type": "color",
      "label": "customization.color",
      "default": "#FFFFFF"
    },
    "font_size": {
      "type": "font-size",
      "label": "customization.size",
      "default": 30
    },
    "background_color": {
      "type": "color",
      "label": "customization.color",
      "default": "#000000"
    },
    "border_spacing": {
      "type": "border-spacing",
      "label": "customization.border",
      "default": 10
    },
    "vertical_align": {
      "type": "v-align",
      "label": "customization.vertical",
      "default": "center"
    },
    "horizontal_align": {
      "type": "h-align",
      "label": "customization.horizontal",
      "default": "center"
    },
    "image": {
      "type": "image",
      "label": "customization.image",
      "default": ""
    },
    "image_opacity": {
      "type": "opacity",
      "label": "customization.transparency",
      "default": 100
    },
    "image_fit": {
      "type": "object-fit",
      "label": "customization.adjust",
      "default": "cover"
    },
    "hour_cycle": {
      "type": "select",
      "label": "customization.hour_cycle",
      "default": "24h"
    },
    "time_format": {
      "type": "select",
      "label": "customization.time_format",
      "default": "hh:mm:ss"
    }
  }
}


================================================
FILE: src/modules/base_module/components/Screen.vue
================================================
<template>
  <div
    ref="container"
    class="d-flex"
    :class="alignClass"
    :style="containerStyle"
  >
    <img
      v-if="userdata.image"
      :src="userdata.image"
      :style="{
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        position: 'absolute',
        objectFit: userdata.image_fit,
        opacity: userdata.image_opacity / 100,
      }"
    />

    <span class="text-right" :style="textStyle">
      {{ time }}
    </span>
  </div>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "ClockPage",
  data: () => ({
    s_width: 0,
    s_height: 0,
    timer: null,
    time: null,
  }),
  computed: {
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    backgroundColor() {
      return this.userdata.background_color || "#000000";
    },
    font() {
      return this.userdata.font || "Arial, sans-serif";
    },
    fontColor() {
      return this.userdata.font_color || "#FFFFFF";
    },
    fontSize() {
      return this.userdata.font_size || 30;
    },
    borderSpacing() {
      return this.userdata.border_spacing || 10;
    },
    verticalAlign() {
      return this.userdata.vertical_align || "center";
    },
    horizontalAlign() {
      return this.userdata.horizontal_align || "center";
    },
    image() {
      return this.userdata.image || "";
    },
    imageOpacity() {
      return (this.userdata.image_opacity || 100) / 100;
    },
    imageFit() {
      return this.userdata.image_fit || "cover";
    },
    hourCycle() {
      return this.userdata.hour_cycle || "24h";
    },
    timeFormat() {
      return this.userdata.time_format || "hh:mm:ss";
    },
    alignClass() {
      const vertical = {
        start: "align-start",
        center: "align-center",
        end: "align-end",
      };
      const horizontal = {
        start: "justify-start",
        center: "justify-center",
        end: "justify-end",
      };
      return `${vertical[this.verticalAlign]} ${horizontal[this.horizontalAlign]}`;
    },
    containerStyle() {
      return {
        background: this.backgroundColor,
        width: "100%",
        height: "100%",
        position: "relative",
        color: this.fontColor,
        padding: `${this.borderSpacing}px`,
      };
    },
    textStyle() {
      return {
        fontFamily: this.font,
        color: this.fontColor,
        zIndex: 1,
        fontSize: `${this.fontSizePc(this.fontSize)}px`,
        textAlign: `${this.horizontalAlign}`,
      };
    },
  },
  methods: {
    fontSizePc(pc) {
      const v = Math.min(this.s_width, this.s_height);
      return (pc * v) / 100 / 2;
    },
    windowResize() {
      const container = this.$refs.container;
      if (container) {
        this.s_width = container.offsetWidth;
        this.s_height = container.offsetHeight;

        if (this.s_width <= 0 || this.s_height <= 0) {
          const self = this;
          setTimeout(function () {
            self.windowResize();
          }, 100);
        }
      }
    },
    updateTime() {
      const now = new Date();
      let hours = now.getHours();
      const is12Hour = this.hourCycle === "12h";
      const displayHours =
        is12Hour && hours > 12
          ? hours - 12
          : is12Hour && hours === 0
            ? 12
            : hours;
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      const pad = (v) => String(v).padStart(2, "0");

      const tokens = {
        hh: pad(displayHours),
        mm: pad(minutes),
        ss: pad(seconds),
      };

      let timeStr = this.timeFormat.replace(
        /hh|mm|ss/g,
        (match) => tokens[match],
      );

      if (is12Hour) {
        timeStr += hours >= 12 ? " PM" : " AM";
      }

      this.time = timeStr;
    },
  },
  mounted() {
    this.windowResize();
    window.addEventListener("resize", this.windowResize);
    this.updateTime();
    this.timer = setInterval(() => {
      this.updateTime();
    }, 1000);
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
    clearInterval(this.timer);
  },
};
</script>



================================================
FILE: src/modules/base_module/interface/Index.vue
================================================
<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    Módulo Base
  </ModuleContainer>
</template>

<script setup>
/* ########################################################### */
/* ####### INSTALAÇÃO DO MODULO ############################## */
/* ########################################################### */
import { ref, computed } from "vue";
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
const moduleContainer = ref(null);
const t = (key) => {
  return moduleContainer.value?.t(key) || key;
};
const userdata = computed(() => {
  return moduleContainer.value?.userdata;
});
const appdata = computed(() => {
  return moduleContainer.value?.appdata;
});
/* ########################################################### */
/* ########################################################### */
/* ########################################################### */
</script>



================================================
FILE: src/modules/base_module/interface/Popup.vue
================================================
<template>
  <Screen />
</template>

<script>
import manifest from "../manifest.json";

import Screen from "../components/Screen.vue";

export default {
  name: "PopupBiblePage",
  components: {
    Screen,
  },
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
  },
};
</script>



================================================
FILE: src/modules/base_module/lang/es.json
================================================
{
    "title": "Título del módulo",
    "customization": {
        "background": "Fondo",
        "color": "Color",
        "image": "Imagen",
        "transparency": "Transparencia",
        "adjust": "Ajustar",
        "align": "Alineacion",
        "font": "Fuente",
        "text": "Texto",
        "window": "Ventana",
        "vertical": "Vertical",
        "horizontal": "Horizontal",
        "border": "Borde",
        "size": "Tamano",
        "hour_cycle": "Ciclo de Horas",
        "time_format": "Formato de Hora"
    }
}


================================================
FILE: src/modules/base_module/lang/pt.json
================================================
{
    "title": "Título do Módulo",
    "customization": {
        "background": "Fundo",
        "color": "Cor",
        "image": "Imagem",
        "transparency": "Transparência",
        "adjust": "Ajustar",
        "align": "Alinhamento",
        "font": "Fonte",
        "text": "Texto",
        "window": "Janela",
        "vertical": "Vertical",
        "horizontal": "Horizontal",
        "border": "Borda",
        "size": "Tamanho",
        "hour_cycle": "Ciclo de Horas",
        "time_format": "Formato de Hora"
    }
}


================================================
FILE: src/modules/clock/index.js
================================================
import BaseModule from "../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/clock/manifest.json
================================================
{
  "id": "clock",
  "name": "Relógio",
  "description": "Relógio",
  "category": "utilities",
  "icon": "mdi-clock-outline",
  "customization": {
    "font": {
      "type": "font",
      "label": "customization.font",
      "default": "Arial, sans-serif"
    },
    "font_color": {
      "type": "color",
      "label": "customization.color",
      "default": "#FFFFFF"
    },
    "font_size": {
      "type": "font-size",
      "label": "customization.size",
      "default": 30
    },
    "background_color": {
      "type": "color",
      "label": "customization.color",
      "default": "#000000"
    },
    "border_spacing": {
      "type": "border-spacing",
      "label": "customization.border",
      "default": 10
    },
    "vertical_align": {
      "type": "v-align",
      "label": "customization.vertical",
      "default": "center"
    },
    "horizontal_align": {
      "type": "h-align",
      "label": "customization.horizontal",
      "default": "center"
    },
    "image": {
      "type": "image",
      "label": "customization.image",
      "default": ""
    },
    "image_opacity": {
      "type": "opacity",
      "label": "customization.transparency",
      "default": 100
    },
    "image_fit": {
      "type": "object-fit",
      "label": "customization.adjust",
      "default": "cover"
    },
    "hour_cycle": {
      "type": "select",
      "label": "customization.hour_cycle",
      "default": "24h"
    },
    "time_format": {
      "type": "select",
      "label": "customization.time_format",
      "default": "hh:mm:ss"
    }
  }
}


================================================
FILE: src/modules/clock/components/Screen.vue
================================================
<template>
  <div
    ref="container"
    class="d-flex"
    :class="alignClass"
    :style="containerStyle"
  >
    <img
      v-if="userdata.image"
      :src="userdata.image"
      :style="{
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        position: 'absolute',
        objectFit: userdata.image_fit,
        opacity: userdata.image_opacity / 100,
      }"
    />

    <span class="text-right" :style="textStyle">
      {{ time }}
    </span>
  </div>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "ClockPage",
  data: () => ({
    s_width: 0,
    s_height: 0,
    timer: null,
    time: null,
  }),
  computed: {
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    backgroundColor() {
      return this.userdata.background_color || "#000000";
    },
    font() {
      return this.userdata.font || "Arial, sans-serif";
    },
    fontColor() {
      return this.userdata.font_color || "#FFFFFF";
    },
    fontSize() {
      return this.userdata.font_size || 30;
    },
    borderSpacing() {
      return this.userdata.border_spacing || 10;
    },
    verticalAlign() {
      return this.userdata.vertical_align || "center";
    },
    horizontalAlign() {
      return this.userdata.horizontal_align || "center";
    },
    image() {
      return this.userdata.image || "";
    },
    imageOpacity() {
      return (this.userdata.image_opacity || 100) / 100;
    },
    imageFit() {
      return this.userdata.image_fit || "cover";
    },
    hourCycle() {
      return this.userdata.hour_cycle || "24h";
    },
    timeFormat() {
      return this.userdata.time_format || "hh:mm:ss";
    },
    alignClass() {
      const vertical = {
        start: "align-start",
        center: "align-center",
        end: "align-end",
      };
      const horizontal = {
        start: "justify-start",
        center: "justify-center",
        end: "justify-end",
      };
      return `${vertical[this.verticalAlign]} ${horizontal[this.horizontalAlign]}`;
    },
    containerStyle() {
      return {
        background: this.backgroundColor,
        width: "100%",
        height: "100%",
        position: "relative",
        color: this.fontColor,
        padding: `${this.borderSpacing}px`,
      };
    },
    textStyle() {
      return {
        fontFamily: this.font,
        color: this.fontColor,
        zIndex: 1,
        fontSize: `${this.fontSizePc(this.fontSize)}px`,
        textAlign: `${this.horizontalAlign}`,
      };
    },
  },
  methods: {
    fontSizePc(pc) {
      const v = Math.min(this.s_width, this.s_height);
      return (pc * v) / 100 / 2;
    },
    windowResize() {
      const container = this.$refs.container;
      if (container) {
        this.s_width = container.offsetWidth;
        this.s_height = container.offsetHeight;

        if (this.s_width <= 0 || this.s_height <= 0) {
          const self = this;
          setTimeout(function () {
            self.windowResize();
          }, 100);
        }
      }
    },
    updateTime() {
      const now = new Date();
      let hours = now.getHours();
      const is12Hour = this.hourCycle === "12h";
      const displayHours =
        is12Hour && hours > 12
          ? hours - 12
          : is12Hour && hours === 0
            ? 12
            : hours;
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      const pad = (v) => String(v).padStart(2, "0");

      const tokens = {
        hh: pad(displayHours),
        mm: pad(minutes),
        ss: pad(seconds),
      };

      let timeStr = this.timeFormat.replace(
        /hh|mm|ss/g,
        (match) => tokens[match],
      );

      if (is12Hour) {
        timeStr += hours >= 12 ? " PM" : " AM";
      }

      this.time = timeStr;
    },
  },
  mounted() {
    this.windowResize();
    window.addEventListener("resize", this.windowResize);
    this.updateTime();
    this.timer = setInterval(() => {
      this.updateTime();
    }, 1000);
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
    clearInterval(this.timer);
  },
};
</script>



================================================
FILE: src/modules/clock/interface/Index.vue
================================================
<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    @close="close()"
    @minimize="$modules.minimize(module_id)"
    @resize="resize"
    :index="show ? 1 : 0"
  >
    <template v-slot:customize>
      <l-customization-tools
        :module="module"
        :items="[
          {
            name: t('customization.background'),
            items: [
              'background_color',
              ['image', 'image_opacity', 'image_fit'],
            ],
          },
          {
            name: t('customization.align'),
            items: [['horizontal_align', 'vertical_align']],
          },
          {
            name: t('customization.text'),
            items: [['font', 'font_size', 'font_color']],
          },
          { name: t('customization.window'), items: ['border_spacing'] },
        ]"
      />
    </template>

    <template v-slot:system_buttons>
      <LScreenBtn module="clock" />
    </template>

    <template v-slot:header>
      <l-toolbar>
        <l-toolbar-item>
          <l-select
            :label="t('customization.hour_cycle')"
            v-model="userdata.hour_cycle"
            :items="timeFormatOptions"
            item-value="value"
            item-title="title"
            density="compact"
            hide-details
            style="width: 130px"
          />
        </l-toolbar-item>

        <l-toolbar-item>
          <l-select
            :label="t('customization.time_format')"
            v-model="userdata.time_format"
            :items="timeTypeOptions"
            item-value="value"
            item-title="title"
            density="compact"
            hide-details
            style="width: 160px"
          />
        </l-toolbar-item>
      </l-toolbar>
    </template>

    <Screen />
  </l-window>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import Screen from "../components/Screen.vue";
import LScreenBtn from "@/components/buttons/Screen.vue";
import LSelect from "@/components/inputs/Select.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";
import LToolbar from "@/components/Toolbar.vue";
import LToolbarItem from "@/components/ToolbarItem.vue";

export default {
  name: manifest.id,
  components: {
    LWindow,
    Screen,
    LScreenBtn,
    LSelect,
    LCustomizationTools,
    LToolbar,
    LToolbarItem,
  },
  data: () => ({
    width: 0,
    height: 0,
    timeFormatOptions: [
      { title: "24h", value: "24h" },
      { title: "12h", value: "12h" },
    ],
    timeTypeOptions: [
      { title: "hh:mm:ss", value: "hh:mm:ss" },
      { title: "hh:mm", value: "hh:mm" },
      { title: "hh", value: "hh" },
    ],
    fonts: [
      "Arial, sans-serif",
      "Helvetica, sans-serif",
      "Times New Roman, serif",
      "Georgia, serif",
      "Courier New, monospace",
      "Verdana, sans-serif",
      "Roboto, sans-serif",
    ],
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    show() {
      return this.module.show;
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIAS - FIM */

    resize(data) {
      this.width = data.container_width;
      this.height = data.container_height;
    },

    close() {
      this.$modules.close(this.module_id);
    },
  },
};
</script>



================================================
FILE: src/modules/clock/interface/Popup.vue
================================================
<template>
  <Screen />
</template>

<script>
import manifest from "../manifest.json";

import Screen from "../components/Screen.vue";

export default {
  name: "PopupBiblePage",
  components: {
    Screen,
  },
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
  },
};
</script>



================================================
FILE: src/modules/clock/lang/es.json
================================================
{
    "title": "Reloj",
    "customization": {
        "background": "Fondo",
        "color": "Color",
        "image": "Imagen",
        "transparency": "Transparencia",
        "adjust": "Ajustar",
        "align": "Alineacion",
        "font": "Fuente",
        "text": "Texto",
        "window": "Ventana",
        "vertical": "Vertical",
        "horizontal": "Horizontal",
        "border": "Borde",
        "size": "Tamano",
        "hour_cycle": "Ciclo de Horas",
        "time_format": "Formato de Hora"
    }
}


================================================
FILE: src/modules/clock/lang/pt.json
================================================
{
    "title": "Relógio",
    "customization": {
        "background": "Fundo",
        "color": "Cor",
        "image": "Imagem",
        "transparency": "Transparência",
        "adjust": "Ajustar",
        "align": "Alinhamento",
        "font": "Fonte",
        "text": "Texto",
        "window": "Janela",
        "vertical": "Vertical",
        "horizontal": "Horizontal",
        "border": "Borda",
        "size": "Tamanho",
        "hour_cycle": "Ciclo de Horas",
        "time_format": "Formato de Hora"
    }
}


================================================
FILE: src/modules/core/album/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/album/manifest.json
================================================
{
  "id": "album",
  "name": "Álbum",
  "description": "Exibe as músicas de um álbum (função $media.openAlbum)",
  "category": null,
  "icon": null,
  "dependencies": []
}


================================================
FILE: src/modules/core/album/interface/Index.vue
================================================
<template>
  <Window
    v-model="module.show"
    :title="module?.data?.name"
    :image="module?.data?.url_image ? $path.file(module.data.url_image) : ''"
    closable
    compact
    title-class="text-h4 font-weight-light"
    :image-size="125"
    :color="module?.data?.color"
    @close="$media.closeAlbum()"
    slot-left-class="w-100"
  >
    <template v-slot:left>
      <v-table
        v-if="!loading"
        fixed-header
        hover
        class="w-100 h-100"
        :style="{ backgroundColor: module.data.color, color: '#FFF' }"
      >
        <thead>
          <tr>
            <th
              class="text-right"
              :style="{ backgroundColor: module.data.color, color: '#FFF' }"
            >
              {{ t("table.track") }}
            </th>
            <th
              class="text-left"
              :style="{ backgroundColor: module.data.color, color: '#FFF' }"
            >
              {{ t("table.music_name") }}
            </th>
            <th
              class="text-right"
              :style="{ backgroundColor: module.data.color, color: '#FFF' }"
            >
              {{ t("table.duration") }}
            </th>
            <th
              :style="{ backgroundColor: module.data.color, color: '#FFF' }"
            />
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in module.data.musics" :key="item.id_music">
            <td class="text-right">
              {{ item.track }}
            </td>
            <td>{{ item.name }}</td>
            <td class="text-right">{{ $datetime.shortTime(item.duration) }}</td>
            <td>
              <div class="d-flex justify-end">
                <MusicMenuTable
                  color="#FFF"
                  :id_music="item.id_music"
                  :has_instrumental_music="item.has_instrumental_music"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>

      <v-progress-linear v-if="loading" color="white" indeterminate />
    </template>
  </Window>
</template>

<script>
import manifest from "../manifest.json";

import Window from "@/components/Window.vue";
import MusicMenuTable from "@/components/MusicMenuTable.vue";

export default {
  name: "AlbumModule",
  components: {
    Window,
    MusicMenuTable,
  },
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    loading() {
      return this.$appdata.get("modules.album.loading");
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIOS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIOS - FIM */
  },
};
</script>



================================================
FILE: src/modules/core/album/lang/es.json
================================================
{
    "table": {
        "track": "Pista",
        "music_name": "Nombre",
        "duration": "Duración"
    }
}


================================================
FILE: src/modules/core/album/lang/pt.json
================================================
{
    "table": {
        "track": "Faixa",
        "music_name": "Nome",
        "duration": "Duração"
    }
}


================================================
FILE: src/modules/core/bible/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/bible/manifest.json
================================================
{
  "id": "bible",
  "name": "Bíblia",
  "description": "Bíblia",
  "category": "bible",
  "icon": "mdi-book-cross",
  "dependencies": [],
  "customization": {
    "font": {
      "type": "font",
      "label": "customization.font",
      "default": "Arial, sans-serif"
    },
    "font_color": {
      "type": "color",
      "label": "customization.color",
      "default": "#FFFFFF"
    },
    "font_size": {
      "type": "font-size",
      "label": "customization.size",
      "default": 15
    },
    "reference_font": {
      "type": "font",
      "label": "customization.font",
      "default": "Arial, sans-serif"
    },
    "reference_font_color": {
      "type": "color",
      "label": "customization.color",
      "default": "#FB8C00"
    },
    "reference_font_size": {
      "type": "font-size",
      "label": "customization.size",
      "default": 10
    },
    "background_color": {
      "type": "color",
      "label": "customization.color",
      "default": "#000000"
    },
    "border_spacing": {
      "type": "border-spacing",
      "label": "customization.border",
      "default": 10
    },
    "vertical_align": {
      "type": "v-align",
      "label": "customization.vertical",
      "default": "center"
    },
    "horizontal_align": {
      "type": "h-align",
      "label": "customization.horizontal",
      "default": "center"
    },
    "image": {
      "type": "image",
      "label": "customization.image",
      "default": ""
    },
    "image_opacity": {
      "type": "opacity",
      "label": "customization.transparency",
      "default": 100
    },
    "image_fit": {
      "type": "object-fit",
      "label": "customization.adjust",
      "default": "cover"
    }
  }
}


================================================
FILE: src/modules/core/bible/components/Screen.vue
================================================
<template>
  <div
    ref="container"
    :class="[
      'd-flex',
      `align-${userdata.vertical_align}`,
      `justify-${userdata.horizontal_align}`,
    ]"
    :style="{
      position: 'relative',
      background: userdata.background_color,
      width: '100%',
      height: height ? height + 'px' : '100%',
      padding: `${this.fontSizePc(userdata.border_spacing)}px`,
    }"
  >
    <img
      v-if="userdata.image"
      :src="userdata.image"
      :style="{
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        position: 'absolute',
        objectFit: userdata.image_fit,
        opacity: userdata.image_opacity / 100,
      }"
    />

    <div v-if="bible" class="d-flex flex-column">
      <span
        v-if="bible.text"
        :class="
          'text-' +
          (userdata.horizontal_align == 'start'
            ? 'left'
            : userdata.horizontal_align == 'end'
              ? 'right'
              : 'center')
        "
        :style="{
          zIndex: 1,
          color: userdata.font_color,
          fontSize: `${this.fontSizePc(userdata.font_size)}px`,
          fontFamily: userdata.font || 'Arial, sans-serif',
        }"
      >
        {{ bible.text }}
      </span>
      <span
        v-if="bible.scriptural_reference"
        :class="
          'text-' + (userdata.horizontal_align == 'start' ? 'left' : 'right')
        "
        :style="{
          zIndex: 1,
          color: userdata.reference_font_color,
          fontSize: `${this.fontSizePc(userdata.reference_font_size)}px`,
          fontFamily: userdata.reference_font || 'Arial, sans-serif',
        }"
      >
        {{ bible.scriptural_reference }}
      </span>
    </div>
  </div>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "ScreenBiblePage",
  props: {
    height: Number,
  },
  data: () => ({
    s_width: 0,
    s_height: 0,
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    bible() {
      return this.$appdata.get("modules.bible.data");
    },
  },
  methods: {
    fontSizePc(pc) {
      const v = Math.min(this.s_width, this.s_height);
      return (pc * v) / 100 / 2;
    },
    windowResize() {
      const container = this.$refs.container;
      if (container) {
        this.s_width = container.offsetWidth;
        this.s_height = container.offsetHeight;

        if (this.width <= 0 || this.height <= 0) {
          const self = this;
          setTimeout(function () {
            self.windowResize();
          }, 100);
        }
      }
    },
  },
  mounted() {
    this.windowResize();
    window.addEventListener("resize", this.windowResize);
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
  },
};
</script>



================================================
FILE: src/modules/core/bible/interface/Index.vue
================================================
<template>
  <l-window
    v-model="module.show"
    :title="scripturalReference(bible)"
    :icon="module.icon"
    closable
    minimizable
    compact
    @close="
      close();
      $modules.close(module_id);
    "
    @minimize="$modules.minimize(module_id)"
    @resize="resize"
    :slot-left-style="{ width: compact ? 0 : (width / 100) * 60 + 'px' }"
    :slot-right-style="{ width: compact ? width : (width / 100) * 40 + 'px' }"
    :index="loading"
  >
    <template v-slot:customize>
      <l-customization-tools
        :module="module"
        :items="[
          {
            name: t('customization.background'),
            items: [
              'background_color',
              ['image', 'image_opacity', 'image_fit'],
            ],
          },
          {
            name: t('customization.align'),
            items: [['horizontal_align', 'vertical_align']],
          },
          {
            name: t('customization.text'),
            items: [['font', 'font_size', 'font_color']],
          },
          {
            name: t('customization.reference'),
            items: [
              ['reference_font', 'reference_font_size', 'reference_font_color'],
            ],
          },
          { name: t('customization.window'), items: ['border_spacing'] },
        ]"
      />
    </template>

    <template v-slot:system_buttons>
      <LScreenBtn module="bible" />
    </template>

    <template v-slot:header>
      <l-select
        :label="t('version')"
        v-model="bible.id_bible_version"
        :items="versions_list ?? []"
        item-value="value"
        item-title="title"
      />

      <!-- Os campos abaixo serão exibidos apenas no mobile / reolução pequena -->
      <div v-if="compact">
        <div class="my-2" />
        <l-select
          :label="t('book')"
          v-model="bible.id_bible_book"
          :items="books ?? []"
          item-value="id_bible_book"
          item-title="name"
          item-subtitle="abbreviation"
          icon="mdi-book-open-page-variant"
        />
        <div class="my-2" />
        <l-select
          :label="t('chapter')"
          v-model="bible.chapter"
          :items="chaptersList()"
          item-value="id"
          item-title="value"
          icon="mdi-bookmark"
        />
        <div class="my-2" />
        <l-select
          :label="t('verses')"
          v-model="bible_verses"
          :items="versesList()"
          item-value="id"
          item-title="value"
          multiple
          icon="mdi-format-list-numbered"
        />
      </div>
    </template>

    <template v-slot:left>
      <div v-if="!compact" class="d-flex flex-row h-100">
        <!-- Combined Book Selection Area -->
        <div class="w-70 h-100 d-flex flex-column pt-2">
          <!-- Book Search Menu (inline above book list) -->
          <div style="flex-shrink: 0" class="ps-4 pe-1">
            <l-select
              :label="t('book')"
              v-model="bible.id_bible_book"
              :items="books ?? []"
              item-value="id_bible_book"
              item-title="name"
              item-subtitle="abbreviation"
              icon="mdi-book-open-page-variant"
            />
          </div>

          <!-- Book Grid List -->
          <div
            :style="`height: ${height - 65}px`"
            class="overflow-auto d-flex flex-row flex-wrap justify-center align-content-start px-2 mt-2"
          >
            <v-skeleton-loader
              v-for="n in 10"
              :key="n"
              v-show="loading_book"
              class="ma-1"
              :height="80"
              :width="100"
            />
            <v-card
              v-for="book in books"
              :key="book.id_bible_book"
              :color="book.color"
              class="ma-1 d-flex align-center flex-column"
              :height="80"
              :width="100"
              hover
              :variant="
                book.id_bible_book == bible.id_bible_book ? 'flat' : 'tonal'
              "
              @click="selBook(book.id_bible_book)"
              :id="`listBook_${book.id_bible_book}`"
            >
              <v-card-title
                class="flex-grow-1 pa-0 ma-0 text-h4 d-flex align-center"
              >
                {{ book.abbreviation }}
              </v-card-title>
              <v-card-text
                class="flex-grow-0 pa-0 px-1 ma-0 text-caption text-truncate text-center w-100"
              >
                {{ book.name }}
              </v-card-text>
            </v-card>
          </div>
        </div>

        <!-- compoenente dos versiculos -->
        <div class="w-30 h-100 d-flex flex-column pt-2">
          <!-- Chapter Search Menu (inline above chapter list) -->
          <div style="flex-shrink: 0" class="px-1">
            <l-select
              :label="t('chapter')"
              v-model="bible.chapter"
              :items="chaptersList()"
              item-value="id"
              item-title="value"
              icon="mdi-bookmark"
            />
          </div>

          <!-- Chapter Grid List -->
          <div
            :style="`height: ${height - 65}px`"
            class="overflow-auto d-flex flex-row flex-wrap justify-center align-content-start px-2 mt-2"
          >
            <v-skeleton-loader
              v-for="n in 10"
              :key="n"
              v-show="loading_book"
              class="ma-1"
              :height="40"
              :width="40"
            />
            <v-card
              v-for="chapter in chapters"
              :key="chapter"
              :color="book?.color"
              class="ma-1 d-flex align-center flex-column"
              :height="40"
              :width="40"
              hover
              :variant="chapter == bible.chapter ? 'flat' : 'tonal'"
              @click="selChapter(chapter)"
              :id="`listChapter_${chapter}`"
            >
              <v-card-title
                class="flex-grow-1 pa-0 ma-0 d-flex align-center font-weight-regular"
                style="font-size: 16px"
              >
                {{ chapter }}
              </v-card-title>
            </v-card>
          </div>
        </div>
      </div>
    </template>

    <template v-slot:right>
      <div class="d-flex flex-row h-100 pt-2">
        <div
          :style="{
            height: height + 'px',
            width: (compact ? width : (width / 100) * 40) + 'px',
          }"
        >
          <!-- Verse Search Menu (above verse list) -->
          <div class="ps-1 pe-4 pb-3" style="flex-shrink: 0">
            <l-select
              :label="t('verses')"
              v-if="!compact"
              v-model="bible_verses"
              :items="versesList()"
              item-value="id"
              item-title="value"
              multiple
              icon="mdi-format-list-numbered"
            />
          </div>

          <div :style="`height: ${height / 2 - 30}px;`" class="mt-2">
            <v-skeleton-loader
              v-show="loading_book || loading_verses"
              type="list-item-two-line"
            />
            <v-list class="overflow h-100 ma-0 pa-0 no-select" width="100%">
              <v-list-item
                v-for="(verse, num) in verses"
                :key="num"
                link
                variant="flat"
                :value="verse"
                :active="bible.verses.includes(+num)"
                @click="selVerse($event, num)"
                density="compact"
                :id="`listVerse_${num}`"
              >
                <template v-slot:prepend>
                  <v-chip class="mr-2">{{ num }}</v-chip>
                </template>

                <div v-html="verse" class="text-caption"></div>
              </v-list-item>
            </v-list>
          </div>
          <div style="height: 48px">
            <v-toolbar density="compact">
              <v-spacer />
              <v-divider vertical />
              <v-btn
                :disabled="
                  !(select_bible?.verses && select_bible.verses.length > 0)
                "
                variant="text"
                size="small"
                icon="mdi-chevron-left "
                @click="prevVerse()"
                @shortkey="prevVerse()"
                v-shortkey="['arrowleft']"
              />
              <v-btn
                :disabled="
                  !(select_bible?.verses && select_bible.verses.length > 0)
                "
                variant="text"
                size="small"
                icon="mdi-chevron-right "
                @click="nextVerse()"
                @shortkey="nextVerse()"
                v-shortkey="['arrowright']"
              />
              <v-divider vertical />
              <v-btn
                :disabled="
                  !(select_bible?.verses && select_bible.verses.length > 0)
                "
                variant="text"
                size="small"
                icon="mdi-eraser"
                @click="clean()"
                @shortkey="clean()"
                v-shortkey="['del']"
              />
              <v-divider vertical />
              <LScreenBtn module="bible" />
            </v-toolbar>
          </div>
          <Screen :height="compact ? height / 2 - 48 : height / 2 - 88" />
        </div>
      </div>
    </template>
  </l-window>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import Screen from "../components/Screen.vue";
import LSelect from "@/components/inputs/Select.vue";
import LScreenBtn from "@/components/buttons/Screen.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";

export default {
  name: "CollectionsModule",
  components: {
    LWindow,
    Screen,
    LScreenBtn,
    LSelect,
    LCustomizationTools,
  },
  data: () => ({
    lang: null,
    loading: false,
    loading_book: false,
    loading_verses: false,
    tab: null,
    width: 0,
    height: 0,
    bible: {
      id_bible_version: null,
      id_bible_book: null,
      version: null,
      book: null,
      chapter: null,
      verses: [],
    },
    select_bible: {
      id_bible_version: null,
      id_bible_book: null,
      version: null,
      book: null,
      chapter: null,
      verses: [],
      scriptural_reference: null,
      text: null,
    },
    versions: [],
    books: [],
    verses: [],
    last_verse: 1,
    last_bible_file: null,
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    show() {
      return this.module.show;
    },

    bible_verses: {
      get() {
        //return Object.assign([], this.bible.verses);
        return this.bible.verses;
      },
      set(value) {
        if (value.length == 0) {
          this.clean();
          return;
        }
        if (value.length == 1) {
          this.selVerse(null, value[0]);
        } else {
          const added = value.filter((v) => !this.bible.verses.includes(v));
          const removed = this.bible.verses.filter((v) => !value.includes(v));

          const event = { ctrlKey: true };
          if (added.length > 0) {
            this.selVerse(event, added[0]);
          } else if (removed.length > 0) {
            this.selVerse(event, removed[0]);
          }
        }
      },
    },

    book() {
      return this.books.find(
        (b) => b.id_bible_book == this.bible.id_bible_book,
      );
    },
    version() {
      return this.versions.find(
        (b) => b.id_bible_version == this.bible.id_bible_version,
      );
    },
    chapters() {
      return this.book?.chapters;
    },
    versions_list() {
      return this.versions.map((version) => ({
        title: version.abbreviation + " - " + version.name,
        value: version.id_bible_version,
      }));
    },
    compact: function () {
      return this.$vuetify.display.width <= 750;
    },
    super_compact: function () {
      return this.$vuetify.display.width <= 400;
    },
  },
  watch: {
    async show() {
      if (this.show && this.lang != this.$i18n.locale) {
        this.versions = [];
        this.books = [];
        this.verses = [];
        this.bible = {
          id_bible_version: null,
          id_bible_book: null,
          version: null,
          book: null,
          chapter: null,
          verses: [],
        };
        this.select_bible = Object.assign({}, this.bible);
        await this.loadData();
      }
    },
    async "bible.id_bible_book"() {
      await this.selBook();
    },
    async "bible.chapter"() {
      await this.selChapter();
    },
    async "bible.id_bible_version"() {
      await this.selVersion();
    },
    select_bible() {
      this.send("scriptural_reference", this.select_bible.scriptural_reference);
      this.send("text", this.select_bible.text);
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIOS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIOS - FIM */
    send(param, value) {
      this.$appdata.set(`modules.${this.module_id}.data.${param}`, value);
    },
    async loadData() {
      this.loading = true;

      if (this.books.length <= 0) {
        this.loading_book = true;
        this.books = await this.$database.get(
          `${this.$i18n.locale}_bible_book`,
        );
        if (!this.bible.id_bible_book) {
          await this.selBook(this.books[0].id_bible_book);
        }
        this.loading_book = false;
      }

      if (this.versions.length <= 0) {
        this.versions = await this.$database.get(
          `${this.$i18n.locale}_bible_version`,
        );
        if (!this.bible.id_bible_version) {
          await this.selVersion(this.versions[0].id_bible_version);
        }
      }

      const bible_file = `bible_${this.bible.id_bible_version}_${this.bible.id_bible_book}_${this.bible.chapter}`;
      if (bible_file != this.last_bible_file) {
        this.loading_verses = true;
        this.verses = {};
        this.verses = await this.$database.get(bible_file);
        this.last_bible_file = bible_file;
        this.loading_verses = false;
      }

      if (
        this.select_bible.id_bible_book == this.bible.id_bible_book &&
        this.select_bible.chapter == this.bible.chapter &&
        this.select_bible.id_bible_version == this.bible.id_bible_version
      ) {
        this.bible.verses = this.select_bible.verses;
      }

      this.lang = this.$i18n.locale;
      this.loading = false;
    },
    resize(data) {
      this.width = data.container_width;
      this.height = data.container_height;
    },

    async selVersion(id_bible_version) {
      if (id_bible_version) {
        this.bible.id_bible_version = id_bible_version;
      }
      this.bible.version = this.version?.abbreviation;
      this.bible.verses = [];
      this.last_verse = 1;
      await this.loadData();
    },
    async selBook(id_bible_book) {
      if (id_bible_book) {
        this.bible.id_bible_book = id_bible_book;
      }
      this.bible.book = this.book.name;
      this.bible.verses = [];
      this.last_verse = 1;
      if (!this.bible.chapter) {
        this.selChapter(1);
      } else if (this.bible.chapter > this.book.chapters) {
        this.selChapter(this.book.chapters);
      } else {
        await this.loadData();
      }

      const element = document.getElementById(`listBook_${id_bible_book}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    async selChapter(chapter) {
      if (chapter) {
        this.bible.chapter = chapter;
      }
      this.bible.verses = [];
      this.last_verse = 1;
      await this.loadData();

      const element = document.getElementById(`listChapter_${chapter}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    async selVerse(event, num) {
      if (event) {
        try {
          event.preventDefault();
        } catch (e) {
          null;
        }
      }

      num = parseInt(num);
      if (isNaN(num)) {
        return;
      }

      if (event?.ctrlKey) {
        const index = this.bible.verses.indexOf(num);
        if (index === -1) {
          this.bible.verses.push(num);
        } else {
          this.bible.verses.splice(index, 1);
        }
      } else if (event?.shiftKey) {
        const start = Math.min(num, this.last_verse);
        const end = Math.max(num, this.last_verse);
        for (let i = start; i <= end; i++) {
          if (!this.bible.verses.includes(i)) {
            this.bible.verses.push(i);
          }
        }
      } else {
        if (this.bible.verses.length == 1 && this.bible.verses[0] == num) {
          this.bible.verses.splice(0, 1);
          this.clean();
          return;
        }
        this.bible.verses = [num];
      }

      this.last_verse = num;
      this.bible.verses.sort((a, b) => a - b);
      this.select_bible = Object.assign({}, this.bible);
      this.select_bible.scriptural_reference = this.scripturalReference(
        this.select_bible,
      );
      this.select_bible.text = this.getSelectedVerses(this.select_bible.verses);

      const element = document.getElementById(`listVerse_${this.last_verse}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    lastSelectedVerse(verse) {
      this.selVerse(null, +verse);
    },
    async prevVerse() {
      if (this.select_bible?.id_bible_version) {
        await this.selVersion(this.select_bible.id_bible_version);
      }
      if (this.select_bible?.id_bible_book) {
        await this.selBook(this.select_bible.id_bible_book);
      }
      if (this.select_bible?.chapter) {
        await this.selChapter(this.select_bible.chapter);
      }
      if (this.select_bible?.verses && this.select_bible.verses.length > 0) {
        let verse = Math.min(
          ...this.select_bible.verses.filter((num) => num > 0),
        );
        if (verse > 1) {
          verse--;
        } else if (this.select_bible.chapter > 1) {
          await this.selChapter(this.select_bible.chapter - 1);
          verse = Math.max(...Object.keys(this.verses).map(Number));
        } else {
          let bookIndex = this.books.findIndex(
            (b) => b.id_bible_book == this.bible.id_bible_book,
          );
          const book =
            bookIndex > 0
              ? this.books[bookIndex - 1]
              : this.books[this.books.length - 1];
          await this.selBook(book.id_bible_book);
          await this.selChapter(book.chapters);
          verse = Math.max(...Object.keys(this.verses).map(Number));
        }
        this.selVerse(null, verse);
      }
    },
    async nextVerse() {
      if (this.select_bible?.id_bible_version) {
        await this.selVersion(this.select_bible.id_bible_version);
      }
      if (this.select_bible?.id_bible_book) {
        await this.selBook(this.select_bible.id_bible_book);
      }
      if (this.select_bible?.chapter) {
        await this.selChapter(this.select_bible.chapter);
      }
      if (this.select_bible?.verses && this.select_bible.verses.length > 0) {
        let verse = Math.max(...this.select_bible.verses);
        const max_verse = Math.max(...Object.keys(this.verses).map(Number));
        const max_chapter = this.book.chapters;
        if (verse < max_verse) {
          verse++;
        } else if (this.select_bible.chapter < max_chapter) {
          await this.selChapter(this.select_bible.chapter + 1);
          verse = 1;
        } else {
          let bookIndex = this.books.findIndex(
            (b) => b.id_bible_book == this.bible.id_bible_book,
          );
          const book =
            bookIndex < this.books.length - 1
              ? this.books[bookIndex + 1]
              : this.books[0];
          await this.selBook(book.id_bible_book);
          await this.selChapter(1);
          verse = 1;
        }
        this.selVerse(null, verse);
      }
    },
    chaptersList() {
      if (!this.chapters) {
        return [];
      }
      return Array.from({ length: this.chapters }, (_, index) => {
        return {
          id: index + 1,
          value: /*this.t("chapter") + " " +*/ index + 1,
        };
      });
    },
    versesList() {
      if (!this?.verses) {
        return [];
      }
      return Object.keys(this.verses).map((verse) => {
        return { id: +verse, value: /*this.t("verse") + " "*/ +verse };
      });
    },
    numbersInterval(numbers) {
      if (!numbers || numbers.length === 0) return "";

      numbers.sort((a, b) => a - b);

      let result = [];
      let start = numbers[0];
      let end = numbers[0];

      for (let i = 1; i <= numbers.length; i++) {
        if (numbers[i] === end + 1) {
          // O número atual é uma continuação da sequência
          end = numbers[i];
        } else {
          // A sequência terminou
          if (start === end) {
            result.push(`${start}`);
          } else {
            result.push(`${start}-${end}`);
          }
          // Reinicia para a próxima sequência
          start = numbers[i];
          end = numbers[i];
        }
      }

      return result.join(", ");
    },
    scripturalReference(data) {
      const verses_interval = this.numbersInterval(data.verses);

      if (!data.book || !data.version) {
        return "";
      }

      return (
        data.book +
        " " +
        data.chapter +
        (verses_interval ? `:${verses_interval}` : "") +
        (data.version ? ` (${data.version})` : "")
      ).trim();
    },

    getSelectedVerses(keys) {
      keys.sort((a, b) => a - b); // Ordena os versículos para garantir a sequência correta
      let result = "";
      let previousKey = null;

      keys.forEach((key) => {
        if (previousKey !== null && key - previousKey > 1) {
          result += " [...] "; // Adiciona "..." se os versos não forem sequenciais
        } else if (result) {
          result += " "; // Adiciona um espaço entre versos consecutivos
        }
        result += this.verses[key];
        previousKey = key;
      });

      return result;
    },
    clean: function () {
      this.bible.verses = [];
      this.select_bible = {
        id_bible_version: null,
        id_bible_book: null,
        version: null,
        book: null,
        chapter: null,
        verses: [],
        scriptural_reference: null,
        text: null,
      };
    },

    close() {
      this.$popup.exit();
      this.bible.verses = [];
      this.select_bible = {
        id_bible_version: null,
        id_bible_book: null,
        version: null,
        book: null,
        chapter: null,
        verses: [],
        scriptural_reference: null,
        text: null,
      };
    },
  },
  async mounted() {
    await this.loadData();
  },
};
</script>



================================================
FILE: src/modules/core/bible/interface/Popup.vue
================================================
<template>
  <Screen :config="bibleConfig" />
</template>

<script>
import manifest from "../manifest.json";

import Screen from "../components/Screen.vue";

export default {
  name: "PopupBiblePage",
  components: {
    Screen,
  },
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    
    bibleConfig() {
      const savedConfig = this.$appdata.get(`modules.bible.config`);
      return savedConfig || {
        background: '#000000',
        textColor: '#ffffff',
        referenceColor: '#aaaaaa',
        textFontSize: 48,
        referenceFontSize: 32,
        fontFamily: 'Arial, sans-serif',
      };
    },
  },
};
</script>



================================================
FILE: src/modules/core/bible/lang/es.json
================================================
{
    "title": "Biblia",
    "version": "Versión",
    "book": "Libro",
    "chapter": "Capítulo",
    "verse": "Versículo",
    "verses": "Versículos",
    "verses_select": "Seleccionar versículos",
    "customization": {
        "font": "Fuente",
        "color": "Color",
        "reference": "Referencia",
        "size": "Tamaño",
        "border": "Bordes",
        "background": "Fondo",
        "text": "Texto",
        "window": "Ventana",
        "align": "Alineación",
        "vertical": "Vertical",
        "horizontal": "Horizontal",
        "image": "Imagen",
        "transparency": "Transparencia",
        "adjust": "Ajuste"
    }
}


================================================
FILE: src/modules/core/bible/lang/pt.json
================================================
{
    "title": "Bíblia",
    "version": "Versão",
    "book": "Livro",
    "chapter": "Capítulo",
    "verse": "Versículo",
    "verses": "Versículos",
    "verses_select": "Selecione os versículos",
    "customization": {
        "font": "Fonte",
        "color": "Cor",
        "reference": "Referência",
        "size": "Tamanho",
        "border": "Borda",
        "background": "Fundo",
        "text": "Texto",
        "window": "Janela",
        "align": "Alinhamento",
        "vertical": "Vertical",
        "horizontal": "Horizontal",
        "image": "Imagem",
        "transparency": "Transparência",
        "adjust": "Ajuste"
    }
}


================================================
FILE: src/modules/core/collections/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/collections/manifest.json
================================================
{
  "id": "collections",
  "name": "Álbuns",
  "description": "Lista as coletâneas",
  "category": "musics",
  "icon": "mdi-music-box-multiple",
  "dependencies": [
    "album"
  ]
}


================================================
FILE: src/modules/core/collections/interface/Index.vue
================================================
<template>
  <ModuleContainer
    ref="moduleContainer"
    :manifest="manifest"
    @show="show"
    @close="close"
  >
    <template v-slot:header>
      <v-toolbar color="transparent" v-if="compact">
        <template v-slot:prepend>
          <v-menu>
            <template v-slot:activator="{ props }">
              <v-btn icon="$menu" v-bind="props" />
            </template>
            <v-list :color="$theme.primary()" class="d-flex flex-column h-100">
              <v-list-item
                v-for="category in categories"
                :key="category.id_category"
                :title="category.name"
                :active="id_category == category.id_category"
                @click="setCategory(category.id_category)"
              />

              <v-divider />

              <v-list-item
                class="mt-auto"
                :title="t('all_collections')"
                :active="id_category == 0"
                @click="setCategory(0)"
              />
            </v-list>
          </v-menu>
        </template>

        <v-toolbar-title
          v-if="!id_category || id_category == 0"
          class="text-h6"
          :text="t('all_collections')"
        />
        <v-toolbar-title
          v-else
          class="text-h6"
          :text="categories.find((c) => c.id_category == id_category).name"
        />
      </v-toolbar>
    </template>

    <template v-slot:left>
      <v-list
        v-if="!compact"
        :color="$theme.primary()"
        :width="200"
        class="d-flex flex-column h-100"
      >
        <v-progress-linear
          :color="$theme.primary()"
          indeterminate
          v-if="loading"
        />
        <v-list-item
          v-for="category in categories"
          :key="category.id_category"
          :title="category.name"
          :active="id_category == category.id_category"
          @click="setCategory(category.id_category)"
        />

        <v-list-item
          class="mt-auto"
          :title="t('all_collections')"
          :active="id_category == 0"
          @click="setCategory(0)"
        />
      </v-list>
    </template>

    <v-alert
      v-if="error"
      type="error"
      :text="error"
      variant="tonal"
      border="start"
      class="ma-2"
    />

    <div class="d-flex flex-wrap justify-center">
      <v-card
        :style="
          $vuetify.display.width > 350
            ? 'min-width: 300px; max-width: 300px'
            : 'width:100%'
        "
        theme="dark"
        v-for="album in albums"
        :key="album.id_album"
        width="320"
        class="ma-2"
        :color="album.color || '#385F73'"
        dark
        @click="openAlbum(album.id_album)"
      >
        <div class="d-flex flex-no-wrap justify-space-between align-center">
          <v-avatar
            v-if="album.url_image"
            class="ma-3"
            :size="$vuetify.display.width > 350 ? 125 : 75"
            tile
            rounded="0"
          >
            <v-img :src="$path.file(album.url_image)" />
          </v-avatar>
          <div class="flex-grow-1 d-flex flex-column">
            <div class="text-h6 pt-2" v-text="album.name" />

            <div class="h6" v-text="album.subtitle" />
          </div>
        </div>
      </v-card>
    </div>
  </ModuleContainer>
</template>

<script>
export default {
  name: manifest.id,
  data: () => ({
    categories: [],
    lang: null,
    id_category: null,
    loading: false,
    error: null,
  }),
  computed: {
    /*show() {
      let module = this.$modules.get(manifest.id);
      return module.show;
    },*/
    albums() {
      if (!this.categories) {
        return [];
      }
      if (!this.id_category) {
        return [
          ...new Map(
            this.categories
              .reduce((acc, category) => acc.concat(category.albums), [])
              .map((album) => [album.id_album, { ...album, subtitle: null }]),
          ).values(),
        ].sort((a, b) => this.$string.sort(a.name, b.name));
      }

      return this.categories
        .filter((item) => item.id_category == this.id_category)[0]
        ?.albums.sort((a, b) => a.order - b.order);
    },
    compact: function () {
      return this.$vuetify.display.width <= 600;
    },
  },
  methods: {
    async loadData() {
      this.id_category = null;
      this.categories = [];
      this.loading = true;

      this.categories = await this.$database.get(
        `${this.$i18n.locale}_categories`,
      );

      if (this.categories == null) {
        this.$modules.close(this.module_id);
        return;
      }

      if (this.categories.length > 0) {
        this.categories.sort((a, b) => a.order - b.order);
        this.id_category = this.categories[0].id_category;
      } else {
        this.id_category = 0;
      }

      this.lang = this.$i18n.locale;
      this.loading = false;
    },
    setCategory(id = null) {
      this.id_category = id;
    },
    openAlbum(id_album) {
      this.$media.openAlbum(id_album);
    },
    async show(value) {
      if (value && this.lang != this.$i18n.locale) {
        await this.loadData();
      } else if (
        value &&
        this.categories.length > 0 &&
        this.id_category == null
      ) {
        this.id_category = this.categories[0].id_category;
      }
    },
    close() {
      //Se fechar a janela, não manter o histórico.
      this.id_category = null;
    },
  },
  async mounted() {
    await this.loadData();
  },
};
</script>

<!-- ########################################################### -->
<!-- ####### SETUP OBRIGATÓRIA PARA INSTALAÇÃO DO MODULO ####### -->
<!-- ########################################################### -->
<script setup>
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
import { ref } from "vue";
const moduleContainer = ref(null);
const t = (key) => {
  return moduleContainer.value?.t(key) || key;
};
</script>
<!-- ########################################################### -->
<!-- ########################################################### -->
<!-- ########################################################### -->



================================================
FILE: src/modules/core/collections/lang/es.json
================================================
{
    "title": "Colecciones",
    "all_collections": "Todas las Colecciones"
}


================================================
FILE: src/modules/core/collections/lang/pt.json
================================================
{
    "title": "Coletâneas",
    "all_collections": "Todas as Coletâneas"
}


================================================
FILE: src/modules/core/dev/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/dev/manifest.json
================================================
{
  "id": "dev",
  "name": "Desenvolvedor",
  "description": "Exibir informações do sistema ao desenvolvedor.",
  "category": null,
  "showInMainMenu": true,
  "development": true,
  "icon": "mdi-code-braces",
  "dependencies": []
}


================================================
FILE: src/modules/core/dev/components/ModuleList.vue
================================================
<template>
  <v-card v-for="(module, key) in modules" :key="key" class="ma-2">
    <div class="d-flex flex-no-wrap justify-space-between">
      <v-avatar class="ma-3" rounded="0" size="50">
        <v-icon :icon="module.icon" />
      </v-avatar>

      <div class="w-100">
        <v-card-title class="pa-0">
          {{ module.manifest.name }}
          <v-chip color="green" size="small" class="ma-1">
            {{ module.manifest.id }}
          </v-chip>
          <v-chip
            v-if="module.manifest.system"
            color="red"
            size="small"
            class="ma-1"
          >
            system module
          </v-chip>
        </v-card-title>

        <v-card-text class="px-0 py-1">
          {{ module.manifest.description }}
        </v-card-text>
        <v-card-text
          class="pa-0"
          v-if="module.manifest.dependencies.length > 0"
        >
          <b>Dependencies:</b>
          <v-chip
            v-for="(dependency, key) in module.manifest.dependencies"
            :key="key"
            color="orange"
            size="small"
            class="ma-1"
            label
          >
            {{ dependency }}
          </v-chip>
        </v-card-text>

        <v-card-actions>
          <v-chip
            v-if="module.manifest.category"
            color="info"
            size="small"
            class="ma-1"
          >
            {{ module.manifest.category }}
          </v-chip>
          <v-chip v-else color="info" size="small">no-category</v-chip>
          <v-chip
            v-if="module.manifest.development"
            color="red"
            size="small"
            class="ma-1"
          >
            development
          </v-chip>
          <v-chip
            v-if="module.manifest.showInMainMenu"
            color="orange"
            size="small"
            class="ma-1"
          >
            menu
          </v-chip>
        </v-card-actions>
      </div>
    </div>
  </v-card>
</template>

<script>
export default {
  name: "ModuleList",
  computed: {
    modules() {
      return this.$appdata.get("modules");
    },
  },
};
</script>



================================================
FILE: src/modules/core/dev/interface/Index.vue
================================================
<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    <template v-slot:header>
      <v-tabs v-model="tab" align-tabs="center" :color="$theme.primary()">
        <v-tab :value="1">{{ t("modules") }}</v-tab>
        <v-tab :value="2">{{ t("global-variables") }}</v-tab>
        <v-tab :value="3">{{ t("user-variables") }}</v-tab>
        <v-tab :value="4">{{ t("vue-variables") }}</v-tab>
      </v-tabs>
    </template>

    <v-tabs-window v-model="tab">
      <v-tabs-window-item v-for="n in 4" :key="n" :value="n">
        <v-container fluid>
          <ModuleList v-if="n == 1" />
          <VueJsonPretty v-if="n == 2" :data="$appdata.get()" />
          <VueJsonPretty v-if="n == 3" :data="$userdata.get()" />
          <VueJsonPretty v-if="n == 4" :data="$vuetify" />
        </v-container>
      </v-tabs-window-item>
    </v-tabs-window>
  </ModuleContainer>
</template>

<script>
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import ModuleList from "../components/ModuleList.vue";

export default {
  name: manifest.id,
  components: {
    ModuleContainer,
    VueJsonPretty,
    ModuleList,
  },
  data: () => ({
    tab: null,
  }),
};
</script>

<!-- ########################################################### -->
<!-- ####### SETUP OBRIGATÓRIA PARA INSTALAÇÃO DO MODULO ####### -->
<!-- ########################################################### -->
<script setup>
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
import { ref } from "vue";
const moduleContainer = ref(null);
const t = (key) => {
  return moduleContainer.value?.t(key) || key;
};
</script>
<!-- ########################################################### -->
<!-- ########################################################### -->
<!-- ########################################################### -->



================================================
FILE: src/modules/core/dev/lang/es.json
================================================
{
    "title": "Desarrollador",
    "global-variables": "Variables Globales",
    "user-variables": "Variables de Usuario",
    "vue-variables": "Variables de Vue",
    "modules": "Módulos"
}


================================================
FILE: src/modules/core/dev/lang/pt.json
================================================
{
    "title": "Desenvolvedor",
    "global-variables": "Variáveis Globais",
    "user-variables": "Variáveis do Usuário",
    "vue-variables": "Variáveis do Vue",
    "modules": "Módulos"
}


================================================
FILE: src/modules/core/hymnal/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/hymnal/manifest.json
================================================
{
  "id": "hymnal",
  "name": "Hinário Adventista",
  "description": "Lista as músicas do Hinário Adventista",
  "category": "musics",
  "icon": "mdi-music-clef-treble",
  "dependencies": [
    "media",
    "lyric"
  ]
}


================================================
FILE: src/modules/core/hymnal/interface/Index.vue
================================================
<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    compact
    @close="
      close();
      $modules.close(module_id);
    "
    @minimize="$modules.minimize(module_id)"
    @scroll="onScroll"
    @hasScroll="hasScroll"
    :index="data.count"
  >
    <template v-slot:header>
      <div :class="classform.group">
        <div :class="classform.group_item" style="flex-basis: 600px">
          <l-search
            v-model="search"
            :label="t('inputs.search')"
            :error="data.filter_count <= 0"
          />
        </div>
      </div>
    </template>

    <l-table
      v-model="data"
      :search="search"
      letter=""
      :searchable_fields="{
        track: true,
        name: true,
      }"
      :scroll="scroll"
      :has_scroll="has_scroll"
      sort_by="track"
      :file="`${$i18n.locale}_hymnal`"
    >
      <thead>
        <tr>
          <th class="text-right">{{ t("table.track") }}</th>
          <th class="text-left">{{ t("table.music_name") }}</th>
          <th class="text-right">{{ t("table.duration") }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in data.data" :key="item.id_music">
          <td class="text-right">
            {{ item.track }}
          </td>
          <td>
            {{ item.name }}
          </td>
          <td class="text-right">{{ $datetime.shortTime(item.duration) }}</td>
          <td>
            <div class="d-flex justify-end">
              <l-music-menu-table
                :id_music="item.id_music"
                :has_instrumental_music="item.has_instrumental_music"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </l-table>

    <v-alert
      v-if="search && data.filter_count <= 0"
      type="error"
      :text="t('data.not_found')"
      variant="tonal"
      border="start"
      class="ma-2"
    />

    <template v-slot:footer>
      <div class="w-100">
        <div class="text-right">
          <small>
            {{ t("data.records") }}:
            {{ data.filter_count }}
          </small>
        </div>
      </div>
    </template>
  </l-window>
</template>

<script>
import manifest from "../manifest.json";

import LWindow from "@/components/Window.vue";
import LTable from "@/components/DataTable.vue";
import LSearch from "@/components/inputs/Search.vue";
import LMusicMenuTable from "@/components/MusicMenuTable.vue";

export default {
  name: "HymnalModule",
  components: {
    LWindow,
    LTable,
    LSearch,
    LMusicMenuTable,
  },

  data: () => ({
    search: "",
    data: [],
    scroll: {},
    has_scroll: false,
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    classform() {
      return {
        group: "d-flex flex-wrap",
        group_item:
          "flex-shrink-1 flex-grow-1 d-flex flex-wrap justify-space-around",
      };
    },
    compact: function () {
      return this.$vuetify.display.width <= 800;
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIOS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIOS - FIM */

    onScroll(data) {
      this.scroll = data;
    },
    hasScroll(data) {
      this.has_scroll = data;
    },
    close() {
      //Se fechar a janela, não manter o histórico de pesquisa.
      this.search = "";
    },
  },
};
</script>



================================================
FILE: src/modules/core/hymnal/lang/es.json
================================================
{
    "title": "Himnario Adventista",
    "inputs": {
        "search": "Escriba el número o nombre del himno..."
    },
    "table": {
        "track": "Pista",
        "music_name": "Nombre",
        "album_name": "Álbum",
        "duration": "Duración"
    },
    "data": {
        "records": "Registros totales",
        "not_found": "No se encontraron registros con los filtros seleccionados. Intente cambiar los filtros de búsqueda."
    }
}


================================================
FILE: src/modules/core/hymnal/lang/pt.json
================================================
{
    "title": "Hinário Adventista",
    "inputs": {
        "search": "Digite o número ou nome do hino..."
    },
    "table": {
        "track": "Faixa",
        "music_name": "Nome",
        "album_name": "Álbum",
        "duration": "Duração"
    },
    "data": {
        "records": "Total de registros",
        "not_found": "Não foram encontados registros com os filtros selecionados! Tente alterar os filtros de pesquisa."
    }
}


================================================
FILE: src/modules/core/hymnal_1996/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/hymnal_1996/manifest.json
================================================
{
  "id": "hymnal_1996",
  "name": "Hinário Adventista - 1996",
  "description": "Lista as músicas do Hinário Adventistal, versão de 1996",
  "category": "musics",
  "icon": "mdi-music-clef-treble",
  "language": "pt",
  "dependencies": [
    "media",
    "lyric"
  ]
}


================================================
FILE: src/modules/core/hymnal_1996/interface/Index.vue
================================================
<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    compact
    @close="
      close();
      $modules.close(module_id);
    "
    @minimize="$modules.minimize(module_id)"
    @scroll="onScroll"
    @hasScroll="hasScroll"
    :index="data.count"
  >
    <template v-slot:header>
      <div :class="classform.group">
        <div :class="classform.group_item" style="flex-basis: 600px">
          <l-search
            v-model="search"
            :label="t('inputs.search')"
            :error="data.filter_count <= 0"
          />
        </div>
      </div>
    </template>

    <l-table
      v-model="data"
      :search="search"
      letter=""
      :searchable_fields="{
        track: true,
        name: true,
      }"
      :scroll="scroll"
      :has_scroll="has_scroll"
      sort_by="track"
      :file="`${$i18n.locale}_hymnal_1996`"
    >
      <thead>
        <tr>
          <th class="text-right">{{ t("table.track") }}</th>
          <th class="text-left">{{ t("table.music_name") }}</th>
          <th class="text-right">{{ t("table.duration") }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in data.data" :key="item.id_music">
          <td class="text-right">
            {{ item.track }}
          </td>
          <td>
            {{ item.name }}
          </td>
          <td class="text-right">{{ $datetime.shortTime(item.duration) }}</td>
          <td>
            <div class="d-flex justify-end">
              <l-music-menu-table
                :id_music="item.id_music"
                :has_instrumental_music="item.has_instrumental_music"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </l-table>

    <v-alert
      v-if="search && data.filter_count <= 0"
      type="error"
      :text="t('data.not_found')"
      variant="tonal"
      border="start"
      class="ma-2"
    />

    <template v-slot:footer>
      <div class="w-100">
        <div class="text-right">
          <small>
            {{ t("data.records") }}:
            {{ data.filter_count }}
          </small>
        </div>
      </div>
    </template>
  </l-window>
</template>

<script>
import manifest from "../manifest.json";

import LWindow from "@/components/Window.vue";
import LTable from "@/components/DataTable.vue";
import LSearch from "@/components/inputs/Search.vue";
import LMusicMenuTable from "@/components/MusicMenuTable.vue";

export default {
  name: "Hymnal1996Module",
  components: {
    LWindow,
    LTable,
    LSearch,
    LMusicMenuTable,
  },

  data: () => ({
    search: "",
    data: [],
    scroll: {},
    has_scroll: false,
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    classform() {
      return {
        group: "d-flex flex-wrap",
        group_item:
          "flex-shrink-1 flex-grow-1 d-flex flex-wrap justify-space-around",
      };
    },
    compact: function () {
      return this.$vuetify.display.width <= 800;
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIOS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIOS - FIM */

    onScroll(data) {
      this.scroll = data;
    },
    hasScroll(data) {
      this.has_scroll = data;
    },
    close() {
      //Se fechar a janela, não manter o histórico de pesquisa.
      this.search = "";
    },
  },
};
</script>



================================================
FILE: src/modules/core/hymnal_1996/lang/es.json
================================================
{
    "title": "Himnario Adventista 1996",
    "inputs": {
        "search": "Escriba el número o nombre del himno..."
    },
    "table": {
        "track": "Pista",
        "music_name": "Nombre",
        "album_name": "Álbum",
        "duration": "Duración"
    },
    "data": {
        "records": "Registros totales",
        "not_found": "No se encontraron registros con los filtros seleccionados. Intente cambiar los filtros de búsqueda."
    }
}


================================================
FILE: src/modules/core/hymnal_1996/lang/pt.json
================================================
{
    "title": "Hinário Adventista 1996",
    "inputs": {
        "search": "Digite o número ou nome do hino..."
    },
    "table": {
        "track": "Faixa",
        "music_name": "Nome",
        "album_name": "Álbum",
        "duration": "Duração"
    },
    "data": {
        "records": "Total de registros",
        "not_found": "Não foram encontados registros com os filtros selecionados! Tente alterar os filtros de pesquisa."
    }
}


================================================
FILE: src/modules/core/lyric/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/lyric/manifest.json
================================================
{
  "id": "lyric",
  "name": "Letra",
  "description": "Exibe a letra da música (função $media.openLyric)",
  "category": null,
  "icon": null,
  "dependencies": []
}


================================================
FILE: src/modules/core/lyric/interface/Index.vue
================================================
<template>
  <Window
    v-model="module.show"
    :title="config?.title"
    :subtitle="
      config?.subtitle +
      (config?.track > 0 ? ' | ' + t('track') + ' ' + config.track : '')
    "
    :image="config?.image ? $path.file(config.image) : ''"
    closable
    size="small"
    @close="$media.closeLyric()"
  >
    <v-skeleton-loader v-if="module.loading" type="text@5" />
    <div v-else>
      <div v-for="line in lyric" :key="line.id_lyric">
        <b v-if="line.aux_lyric">{{ line.aux_lyric }}</b>
        {{ line.lyric }}&nbsp;
      </div>
    </div>
  </Window>
</template>

<script>
import manifest from "../manifest.json";

import Window from "@/components/Window.vue";

export default {
  name: "LyricModule",
  components: {
    Window,
  },
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    config() {
      return this.module?.config;
    },
    lyric() {
      return this.module?.data?.lyric
        ?.slice()
        .sort((a, b) => a.order - b.order);
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIOS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIOS - FIM */
  },
};
</script>



================================================
FILE: src/modules/core/lyric/lang/es.json
================================================
{
    "track": "Pista"
}


================================================
FILE: src/modules/core/lyric/lang/pt.json
================================================
{
    "track": "Faixa"
}


================================================
FILE: src/modules/core/media/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/media/manifest.json
================================================
{
  "id": "media",
  "name": "Slide",
  "description": "Monta o slide da música (função $media.open)",
  "category": null,
  "icon": null,
  "dependencies": []
}


================================================
FILE: src/modules/core/media/interface/Index.vue
================================================
<template>
  <Window
    v-model="module.show"
    :title="config?.title"
    :subtitle="
      config?.subtitle +
      (config?.track > 0 ? ' | ' + t('general.track') + ' ' + config.track : '')
    "
    :image="config?.image ? $path.file(config.image) : ''"
    title-class="text-h4 font-weight-light"
    closable
    minimizable
    compact
    compact_footer
    @close="$media.close()"
    @minimize="$media.minimize()"
    @resize="resize"
    size="large"
    :scrollPos="scrollPos"
    dark
  >
    <template v-slot:system_buttons>
      <v-menu v-if="is_online">
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            class="ms-2"
            icon="mdi-menu"
            variant="text"
            size="small"
          />
        </template>
        <v-card>
          <v-card-text>
            <v-tooltip :text="t('inputs.lazy_load_tooltip')">
              <template v-slot:activator="{ props }">
                <v-switch
                  color="blue"
                  v-bind="props"
                  v-model="lazy_load"
                  :label="t('inputs.lazy_load')"
                />
              </template>
            </v-tooltip>
            <v-tooltip :text="t('inputs.fade_audio_tooltip')">
              <template v-slot:activator="{ props }">
                <v-switch
                  color="blue"
                  v-bind="props"
                  v-model="fade_audio"
                  :label="t('inputs.fade_audio')"
                />
              </template>
            </v-tooltip>
          </v-card-text>
        </v-card>
      </v-menu>
    </template>

    <div
      class="d-flex flex-no-wrap align-stretch flex-row justify-space-between"
    >
      <div class="w-100">
        <fullscreen
          v-model="fullscreen"
          class="position-sticky w-100"
          :style="`top: 0; height:${preview_height}px; overflow: hidden;`"
        >
          <l-slide
            v-if="slide"
            :slide_number="config.slide_index"
            :cover="slide.cover == true"
            :text="slide.lyric"
            :aux_text="slide.aux_lyric"
            :image="slide.url_image ? $path.file(slide.url_image) : null"
            :image_position="slide.image_position"
          />
          <l-fullscreen-player v-if="fullscreen" />
        </fullscreen>
      </div>
      <div v-if="$vuetify.display.width > 600">
        <v-list class="overflow h-100 ma-0 pa-0" bg-color="black" :width="250">
          <v-list-item
            @click="$media.goToSlide(index)"
            v-for="(item, index) in slides"
            :key="index"
            link
            :active="config.slide_index === index"
            ref="slideItem"
            variant="tonal"
            :height="58"
          >
            <template v-slot:prepend>
              <v-chip class="mr-2">{{ index + 1 }}</v-chip>
            </template>

            <v-list-item-title v-if="item.cover">
              {{ item.lyric }}
            </v-list-item-title>
            <div
              class="text-caption text-truncate"
              v-else
              v-html="item.lyric"
            />
            <v-progress-linear
              v-if="config.audio != '' && config.slide_index == index"
              v-model="config.slide_progress"
              :indeterminate="loading"
              :height="5"
              :color="config.is_paused ? 'orange' : 'white'"
            />

            <img
              v-if="item.url_image"
              :src="$path.file(item.url_image)"
              style="display: none"
            />
          </v-list-item>
        </v-list>
      </div>
    </div>

    <template v-slot:footer>
      <l-player location="window" />
    </template>
  </Window>
</template>

<script>
import manifest from "../manifest.json";

import Window from "@/components/Window.vue";

import LSlide from "@/components/Slide.vue";
import LPlayer from "@/components/Player.vue";
import LFullscreenPlayer from "@/components/FullscreenPlayer.vue";

export default {
  name: "MediaComponent",
  components: {
    Window,
    LSlide,
    LPlayer,
    LFullscreenPlayer,
  },
  data: () => ({
    preview_height: 0,
    scrollPos: 0,
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    is_online() {
      return this.$appdata.get("is_online");
    },
    loading() {
      return this.module.loading;
    },
    config() {
      return this.$media.config();
    },
    slide_index() {
      return this.config?.slide_index;
    },
    slides() {
      return this.$media.slides();
    },
    slide() {
      return this.$media.slide();
    },
    fullscreen: {
      get() {
        return this.module.config.fullscreen;
      },
      set(value) {
        this.$media.fullscreen(value);
      },
    },
    lazy_load: {
      get() {
        return this.$userdata.get("modules.media.lazy_load");
      },
      set(value) {
        this.$userdata.set("modules.media.lazy_load", value);
      },
    },
    fade_audio: {
      get() {
        return this.$userdata.get("modules.media.fade_audio");
      },
      set(value) {
        this.$userdata.set("modules.media.fade_audio", value);
      },
    },
  },
  watch: {
    slide_index() {
      if (!this.module.show) {
        return;
      }

      if (this.$refs?.slideItem && this.$refs?.slideItem[0]?.$el) {
        let self = this;
        let height = this.$refs.slideItem[0].$el.offsetHeight;
        setTimeout(function () {
          self.scrollPos = self.slide_index * height - height;
        }, 100);
      }
    },
  },
  methods: {
    /* METHODS OBRIGATÓRIOS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIOS - FIM */
    resize(data) {
      this.preview_height = data.container_height;
    },
  },
};
</script>



================================================
FILE: src/modules/core/media/interface/Popup.vue
================================================
<template>
  <l-slide
    v-if="slide"
    :slide_number="config.slide_index"
    :cover="slide.cover == true"
    :text="slide.lyric"
    :aux_text="slide.aux_lyric"
    :image="slide.url_image ? $path.file(slide.url_image) : null"
    :image_position="slide.image_position"
  />
</template>

<script>
import manifest from "../manifest.json";

import LSlide from "@/components/Slide.vue";

export default {
  name: "PopupMediaPage",
  components: {
    LSlide,
  },
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
    config() {
      return this.$media.config();
    },
    slide_index() {
      return this.config.slide_index;
    },
    slide() {
      return this.$media.slide();
    },
  },
};
</script>



================================================
FILE: src/modules/core/media/lang/es.json
================================================
{
    "alerts": {
        "not_loaded": "¡Ocurrió un error al cargar este audio!",
        "close": "¿Quieres cerrar esta presentacion?",
        "open_remote": "La música se abre en tu aplicación de escritorio.",
        "open_remote_error": "Se produjo un error al reproducir tu música en la aplicación de escritorio. Comprueba si la transmisión está activada o desactiva la conexión remota para reproducirla en esta ubicación."
    },
    "general": {
        "sung": "Cantado",
        "instrumental": "Pista",
        "no_audio": "Sin Audio",
        "lyric": "Letra de la Canción",
        "track": "Pista"
    },
    "inputs": {
        "lazy_load": "Carga Dinámica",
        "lazy_load_tooltip": "Si se desmarca, el audio solo se reproducirá después de cargarse completamente en la memoria.",
        "fade_audio": "Efecto de Desvanecimiento en el audio",
        "fade_audio_tooltip": "Si se marca, el audio reducirá o aumentará el volumen suavemente al pausar o reproducir."
    }
}


================================================
FILE: src/modules/core/media/lang/pt.json
================================================
{
    "alerts": {
        "not_loaded": "Ocorreu um erro ao carregar este áudio!",
        "close": "Deseja fechar este slide?",
        "open_remote": "A música está sendo aberta em sua aplicação desktop.",
        "open_remote_error": "Ocorreu um erro ao executar sua música em sua aplicação desktop. Verifique se a transmissão está ativa, ou desative a conexão remota para executar neste local."
    },
    "general": {
        "sung": "Cantado",
        "instrumental": "Playback",
        "no_audio": "Sem Áudio",
        "lyric": "Letra da Música",
        "track": "Faixa"
    },
    "inputs": {
        "lazy_load": "Carregamento Dinâmico",
        "lazy_load_tooltip": "Se desmarcado, o áudio só será executado depois de totalmente carregado na memória.",
        "fade_audio": "Efeito de Fade no áudio",
        "fade_audio_tooltip": "Se marcado, o áudio irá reduzir ou aumentar o volume suavemente ao pausar ou dar play."
    }
}


================================================
FILE: src/modules/core/musics/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/musics/manifest.json
================================================
{
  "id": "musics",
  "name": "Músicas",
  "description": "Lista todas as músicas do programa, com filtros de busca.",
  "category": "musics",
  "icon": "mdi-music",
  "dependencies": [
    "media",
    "lyric",
    "album"
  ]
}


================================================
FILE: src/modules/core/musics/interface/Index.vue
================================================
<template>
  <ModuleContainer
    ref="moduleContainer"
    :manifest="manifest"
    compact
    @close="close()"
    @scroll="onScroll"
    @hasScroll="hasScroll"
    :index="data.count"
  >
    <template v-slot:header>
      <div :class="classform.group">
        <div :class="classform.group_item" style="flex-basis: 600px">
          <Search
            v-model="search"
            :label="t('inputs.search')"
            :error="data.filter_count <= 0"
            :disabled="disabled"
            :disabled-hint="t('inputs.search_disabled')"
          />
        </div>
        <div :class="classform.group_item" style="flex-basis: 350px">
          <Checkbox
            v-model="userdata.search.name"
            :label="t('inputs.filter_name')"
          />
          <Checkbox
            v-model="userdata.search.lyric"
            :label="t('inputs.filter_lyric')"
          />
          <Checkbox
            v-model="userdata.search.album"
            :label="t('inputs.filter_album')"
          />
          <Checkbox
            v-model="userdata.search.track"
            :label="t('inputs.filter_track')"
          />
        </div>
        <v-divider vertical />
        <div :class="classform.group_item" style="flex-basis: 200px">
          <div>
            <Checkbox
              switch
              v-model="userdata.filter.instrumental_music"
              :label="t('inputs.filter_instrumental')"
            />
          </div>
        </div>
      </div>
    </template>

    <Table
      v-model="data"
      :search="search"
      :letter="letter"
      :searchable_fields="{
        name: search_name,
        lyric: search_lyric,
        albums_names: search_album,
        track: search_track,
      }"
      :filter="{ has_instrumental_music: filter_instrumental_music }"
      :scroll="scroll"
      :has_scroll="has_scroll"
      sort_by="name"
      :file="`${$i18n.locale}_musics`"
    >
      <thead>
        <tr>
          <th class="text-left">{{ t("table.music_name") }}</th>
          <th v-if="!compact" class="text-left">
            {{ t("table.album_name") }}
          </th>
          <th class="text-right">{{ t("table.duration") }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in data.data" :key="item.id_music">
          <td>
            {{ item.name }}
            <div v-if="compact" class="pb-1">
              <v-chip
                v-for="album in item.albums"
                :key="album.id_album"
                :color="$theme.primary()"
                size="x-small"
                @click="openAlbum(album.id_album)"
              >
                {{ album.name }}
              </v-chip>
            </div>
          </td>
          <td v-if="!compact">
            <v-chip
              v-for="album in item.albums"
              :key="album.id_album"
              :color="$theme.primary()"
              density="compact"
              @click="openAlbum(album.id_album)"
            >
              {{ album.name }}
            </v-chip>
          </td>
          <td class="text-right">{{ $datetime.shortTime(item.duration) }}</td>
          <td>
            <div class="d-flex justify-end">
              <MusicMenuTable
                :id_music="item.id_music"
                :has_instrumental_music="item.has_instrumental_music"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </Table>

    <v-alert
      v-if="search && data.filter_count <= 0"
      type="error"
      :text="t('data.not_found')"
      variant="tonal"
      border="start"
      class="ma-2"
    />

    <template v-slot:footer>
      <div class="w-100">
        <LetterPaginate v-model="letter" />
        <div class="text-right">
          <small>
            {{ t("data.records") }}:
            {{ data.filter_count }}
          </small>
        </div>
      </div>
    </template>
  </ModuleContainer>
</template>

<script setup>
/* ########################################################### */
/* ####### INSTALAÇÃO DO MODULO ############################## */
/* ########################################################### */
import { ref, computed, getCurrentInstance } from "vue";
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
const moduleContainer = ref(null);
const t = (key) => {
  return moduleContainer.value?.t(key) || key;
};
const userdata = computed(() => {
  return moduleContainer.value?.userdata;
});
/* ########################################################### */
/* ########################################################### */
/* ########################################################### */

import Table from "@/components/DataTable.vue";
import Search from "@/components/inputs/Search.vue";
import Checkbox from "@/components/inputs/CheckBox.vue";
import MusicMenuTable from "@/components/MusicMenuTable.vue";
import LetterPaginate from "@/components/LetterPagination.vue";

/* -------------------------------------------------- */
/* STATE                                              */
/* -------------------------------------------------- */
const { proxy } = getCurrentInstance();

const search = ref("");
const data = ref([]);
const scroll = ref({});
const has_scroll = ref(false);
const letter = ref("");

/* -------------------------------------------------- */
/* COMPUTEDS                                          */
/* -------------------------------------------------- */
const search_name = computed(() => {
  return userdata.value.search.name;
});

const search_lyric = computed(() => {
  return userdata.value.search.lyric;
});

const search_album = computed(() => {
  return userdata.value.search.album;
});

const search_track = computed(() => {
  return userdata.value.search.track;
});

const filter_instrumental_music = computed(() => {
  return userdata.value.filter.instrumental_music;
});

const disabled = computed(() => {
  return (
    !search_name.value &&
    !search_lyric.value &&
    !search_album.value &&
    !search_track.value
  );
});

const classform = computed(() => ({
  group: "d-flex flex-wrap",
  group_item: "flex-shrink-1 flex-grow-1 d-flex flex-wrap justify-space-around",
}));

const compact = computed(() => {
  return proxy.$vuetify.display.width <= 800;
});

/* -------------------------------------------------- */
/* METHODS                                            */
/* -------------------------------------------------- */
function onScroll(value) {
  scroll.value = value;
}

function hasScroll(value) {
  has_scroll.value = value;
}

function openAlbum(id_album) {
  proxy.$media.openAlbum(id_album);
}

function close() {
  search.value = "";
}
</script>



================================================
FILE: src/modules/core/musics/lang/es.json
================================================
{
    "title": "Músicas",
    "inputs": {
        "search": "Buscar por...",
        "search_disabled": "Seleccione una opción de búsqueda para habilitar la búsqueda!",
        "filter_name": "Nombre",
        "filter_lyric": "Letra",
        "filter_album": "Álbum",
        "filter_track": "Número",
        "filter_instrumental": "Con Instrumental"
    },
    "table": {
        "music_name": "Nombre",
        "album_name": "Álbum",
        "duration": "Duración"
    },
    "data": {
        "records": "Registros totales",
        "not_found": "No se encontraron registros con los filtros seleccionados. Intente cambiar los filtros de búsqueda."
    }
}


================================================
FILE: src/modules/core/musics/lang/pt.json
================================================
{
    "title": "Músicas",
    "inputs": {
        "search": "Buscar por...",
        "search_disabled": "Selecione uma opção de busca para habilitar a busca!",
        "filter_name": "Nome",
        "filter_lyric": "Letra",
        "filter_album": "Álbum",
        "filter_track": "Número",
        "filter_instrumental": "Com Playback"
    },
    "table": {
        "music_name": "Nome",
        "album_name": "Álbum",
        "duration": "Duração"
    },
    "data": {
        "records": "Total de registros",
        "not_found": "Não foram encontados registros com os filtros selecionados! Tente alterar os filtros de pesquisa."
    }
}


================================================
FILE: src/modules/core/remote_control/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/remote_control/manifest.json
================================================
{
  "id": "remote_control",
  "name": "Controle Remoto",
  "description": "Conecta na aplicação desktop para fazer o acionamento remoto das músicas.",
  "category": null,
  "showInMainMenu": true,
  "icon": "mdi-remote",
  "dependencies": [],
  "moduleOptions": {
    "size": "small"
  }
}


================================================
FILE: src/modules/core/remote_control/interface/Index.vue
================================================
<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    <v-card flat>
      <v-card-text class="px-0">
        <small>{{ t("info_module") }}</small>
      </v-card-text>
      <v-card-text class="px-0">
        <v-text-field
          v-model="url"
          :disabled="loading || is_connected"
          :label="t('labels.ip')"
          density="compact"
          variant="outlined"
          prepend-icon="mdi-ip-network"
          :hint="t('messages.get_ip')"
          persistent-hint
          :loading="loading ? 'warning' : null"
        />
        <v-text-field
          v-model="token"
          :disabled="loading || is_connected"
          :label="t('labels.token')"
          class="mt-3"
          density="compact"
          variant="outlined"
          prepend-icon="mdi-code-braces"
          persistent-hint
          :loading="loading ? 'warning' : null"
        />
      </v-card-text>
      <v-card-actions class="px-0">
        <v-spacer></v-spacer>
        <v-btn color="info" :text="t('labels.test_connection')" @click="test" />
        <v-btn
          v-if="!is_connected"
          color="success"
          text="Conectar"
          @click="connect"
        />
        <v-btn
          v-else
          color="error"
          :text="t('labels.disconnect')"
          @click="disonnect"
        />
      </v-card-actions>
    </v-card>
  </ModuleContainer>
</template>

<script setup>
/* ########################################################### */
/* ####### INSTALAÇÃO DO MODULO ############################## */
/* ########################################################### */
import { ref, computed, getCurrentInstance, onMounted } from "vue";
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
const moduleContainer = ref(null);
const t = (key) => {
  return moduleContainer.value?.t(key) || key;
};
/* ########################################################### */
/* ########################################################### */
/* ########################################################### */

const { proxy } = getCurrentInstance();
const url = ref("");
const token = ref("");
const loading = ref(false);

const is_connected = computed(() => {
  return proxy.$userdata.get("remote.is_connected");
});

/* ########################################################### */
/* ###################### METHODS ############################# */
/* ########################################################### */

function getUrl(url) {
  url = url
    .trim()
    .replace(/\s+/g, "") // remove qualquer espaço na string
    .replace(/\\/g, "/") // converte \ para /
    .replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(url)) {
    url = "http://" + url;
  }

  if (url == "http://") {
    url = "";
  }

  return url;
}

async function testUrl(url) {
  if (!url || url == "http://" || url == "https://") {
    return {
      message: "modules.remote_control.messages.url_not_provided",
      error: "",
      status: false,
    };
  }

  try {
    const response = await fetch(url + "/api/ping?token=" + token.value, {
      method: "GET",
      mode: "cors",
    });

    if (!response.ok) {
      return {
        message: "modules.remote_control.messages.url_not_provided",
        error: response.status,
        status: false,
      };
    }

    const data = await response.json();

    if (data.status != "ok") {
      return {
        message:
          data.code == "INVALID_TOKEN"
            ? "modules.remote_control.messages.invalid_token"
            : "modules.remote_control.messages.error",
        error: data.code,
        status: false,
      };
    }
    console.log(data);

    return {
      message: "modules.remote_control.messages.success",
      data: data,
      status: true,
    };
  } catch (error) {
    return {
      message: "modules.remote_control.messages.failed_to_connect",
      error: error.message,
      status: false,
    };
  }
}

async function test() {
  url.value = getUrl(url.value);

  loading.value = true;
  const ret = await testUrl(url.value);
  loading.value = false;

  if (!ret.status) {
    proxy.$alert.error({
      text: ret.message,
      error: ret.error,
    });
    return false;
  }

  if (!ret.status == "ok" && !ret.app == "LouvorJA") {
    proxy.$alert.error({
      text: ret.invalid_url,
    });
    return false;
  }

  proxy.$alert.info({
    text: "modules.remote_control.messages.success",
  });

  return true;
}

async function connect() {
  proxy.$userdata.set("remote.url", getUrl(url.value));
  proxy.$userdata.set("remote.token", token.value);

  if (!(await test())) {
    return;
  }

  proxy.$userdata.set("remote.is_connected", true);
}

function disonnect() {
  proxy.$userdata.set("remote.is_connected", false);
}

/* ########################################################### */
/* ###################### MOUNTED ############################# */
/* ########################################################### */

onMounted(() => {
  url.value = proxy.$userdata.get("remote.url");
  token.value = proxy.$userdata.get("remote.token");
});
</script>



================================================
FILE: src/modules/core/remote_control/lang/es.json
================================================
{
    "title": "Control Remoto",
    "messages": {
        "url_not_provided": "Informe la IP de la conexión",
        "failed_to_connect": "¡Error al conectar! Verifique si la URL es correcta y si el programa está transmitiendo.",
        "http_error": "Error HTTP",
        "invalid_url": "URL inválida",
        "success": "¡Conexión realizada con éxito!",
        "get_ip": "Obtenga la dirección IP utilizando la opción 'Transmitir' del programa.",
        "invalid_token": "Token inválido",
        "error": "Error al acceder al enlace"
    },
    "info_module": "Ejecuta las canciones de su aplicación de forma remota. Para que este recurso funcione, este sitio debe estar ejecutándose dentro de la misma red del programa. Es necesario que el programa esté al menos en la versión 26.3.",
    "labels": {
        "ip": "IP de la Conexión",
        "test_connection": "Probar Conexión",
        "disconnect": "Desconectar",
        "token": "Token"
    }
}


================================================
FILE: src/modules/core/remote_control/lang/pt.json
================================================
{
    "title": "Controle Remoto",
    "messages": {
        "url_not_provided": "Informe o IP da conexão",
        "failed_to_connect": "Falha ao conectar! Verifique se a url está correta e se o programa está transmitindo.",
        "http_error": "Erro HTTP",
        "invalid_url": "Url inválida",
        "success": "Conexão realizada com sucesso!",
        "get_ip": "Obtenha o IP através da opção 'Transmitir' do programa",
        "invalid_token": "Token inválido",
        "error": "Erro ao acessar link"
    },
    "info_module": "Executa as músicas de sua aplicação remotamente. Para que esse recurso funcione, este site precisa estar executando dentro da mesma rede do programa. Necessário que o programa esteja pelo menos na versão 26.3.",
    "labels": {
        "ip": "IP da Conexão",
        "test_connection": "Testar Conexão",
        "disconnect": "Desconectar",
        "token": "Token"
    }
}


================================================
FILE: src/modules/core/theme/index.js
================================================
import BaseModule from "../../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/core/theme/manifest.json
================================================
{
  "id": "theme",
  "name": "Temas",
  "description": "Fornece ferramentas para customização das cores do programa.",
  "category": null,
  "showInMainMenu": true,
  "icon": "mdi-palette",
  "dependencies": [],
  "moduleOptions": {
    "size": "small"
  }
}


================================================
FILE: src/modules/core/theme/interface/Index.vue
================================================
<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    <div v-for="(group, mode) in themes" :key="mode" class="mb-3">
      <div class="subtitle-1 font-weight-medium">
        {{ mode == "dark" ? t("dark-themes") : t("light-themes") }}
      </div>

      <v-btn
        v-for="(theme, theme_id) in group"
        :key="theme_id"
        icon
        density="compact"
        :variant="current == theme_id ? 'outlined' : 'text'"
        class="mx-1"
        @click="setTheme(theme_id)"
      >
        <v-avatar :color="theme.colors.primary" size="22" />
      </v-btn>
    </div>
  </ModuleContainer>
</template>

<script setup>
/* ########################################################### */
/* ####### INSTALAÇÃO DO MODULO ############################## */
/* ########################################################### */
import { ref, computed, getCurrentInstance, onMounted } from "vue";
import manifest from "../manifest.json";
import ModuleContainer from "@/components/ModuleContainer.vue";
const moduleContainer = ref(null);
const t = (key) => {
  return moduleContainer.value?.t(key) || key;
};
/* ########################################################### */
/* ########################################################### */
/* ########################################################### */

const { proxy } = getCurrentInstance();

const current = ref("");
const themes = ref({
  light: {},
  dark: {},
});

/* ########################################################### */
/* ###################### METHODS ############################# */
/* ########################################################### */

function setTheme(theme_id) {
  current.value = theme_id;
  proxy.$vuetify.theme.change(current.value);
  proxy.$userdata.set("theme", current.value);
  proxy.$appdata.set("is_dark", proxy.$vuetify.theme.global.current.dark);
}

/* ########################################################### */
/* ###################### MOUNTED ############################# */
/* ########################################################### */

onMounted(() => {
  current.value = proxy.$vuetify.theme.global.name;
  themes.value = { light: {}, dark: {} };

  for (const key in proxy.$vuetify.theme.themes) {
    const item = proxy.$vuetify.theme.themes[key];

    if (item.dark) {
      themes.value.dark[key] = item;
    } else {
      themes.value.light[key] = item;
    }
  }
});
</script>



================================================
FILE: src/modules/core/theme/lang/es.json
================================================
{
    "title": "Apariencia",
    "light-themes": "Temas Claros",
    "dark-themes": "Temas Oscuros"
}


================================================
FILE: src/modules/core/theme/lang/pt.json
================================================
{
    "title": "Aparência",
    "light-themes": "Temas Claros",
    "dark-themes": "Temas Escuros"
}


================================================
FILE: src/modules/counter/index.js
================================================
import BaseModule from "../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/counter/manifest.json
================================================
{
  "active": true,
  "development": true,
  "id": "counter",
  "name": "Counter Module",
  "description": "Simple counter utility",
  "category": "utilities",
  "icon": "mdi-counter",
  "dependencies": []
}


================================================
FILE: src/modules/counter/interface/Index.vue
================================================
<template>
  <ModuleContainer ref="moduleContainer" :manifest="manifest">
    <template v-slot:header>
      <v-tabs v-model="tab" align-tabs="center" :color="$theme.primary()">
        <v-tab :value="1">Simple Counter</v-tab>
        <v-tab :value="2">Advanced Counter</v-tab>
        <v-tab :value="3">Counter History</v-tab>
      </v-tabs>
    </template>

    <v-tabs-window v-model="tab">
      <v-tabs-window-item :value="1">
        <v-container fluid>
          <div class="d-flex flex-column align-center justify-center pa-6">
            <h2 class="text-h4 mb-4">Simple Counter</h2>
            <div class="d-flex align-center">
              <v-btn
                icon="mdi-minus"
                variant="outlined"
                @click="decrement"
              ></v-btn>
              <div class="text-h3 mx-4">{{ count }}</div>
              <v-btn
                icon="mdi-plus"
                variant="outlined"
                @click="increment"
              ></v-btn>
            </div>
            <v-btn class="mt-4" color="primary" @click="reset"> Reset </v-btn>
          </div>
        </v-container>
      </v-tabs-window-item>

      <v-tabs-window-item :value="2">
        <v-container fluid>
          <div class="d-flex flex-column align-center justify-center pa-6">
            <h2 class="text-h4 mb-4">Advanced Counter</h2>
            <div class="d-flex align-center">
              <v-text-field
                v-model.number="step"
                label="Increment Step"
                type="number"
                variant="outlined"
                class="mr-4"
                style="width: 120px"
              ></v-text-field>
              <v-btn
                icon="mdi-minus"
                variant="outlined"
                @click="decrementBy(step)"
              ></v-btn>
              <div class="text-h3 mx-4">{{ count }}</div>
              <v-btn
                icon="mdi-plus"
                variant="outlined"
                @click="incrementBy(step)"
              ></v-btn>
            </div>
            <v-btn class="mt-4" color="primary" @click="reset"> Reset </v-btn>
          </div>
        </v-container>
      </v-tabs-window-item>

      <v-tabs-window-item :value="3">
        <v-container fluid>
          <v-list>
            <v-list-item
              v-for="(value, index) in history"
              :key="index"
              :title="`Change ${index + 1}`"
              :subtitle="value > 0 ? `+${value}` : value"
            >
              <template v-slot:prepend>
                <v-icon
                  :color="value > 0 ? 'green' : 'red'"
                  :icon="value > 0 ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                ></v-icon>
              </template>
            </v-list-item>
          </v-list>
        </v-container>
      </v-tabs-window-item>
    </v-tabs-window>
  </ModuleContainer>
</template>

<script>
export default {
  name: "CounterModule",
};
</script>

<script setup>
import { ref } from "vue";
import ModuleContainer from "@/components/ModuleContainer.vue";
import manifest from "../manifest.json";

// ---- Obrigatório para tradução -------
const moduleContainer = ref(null);
const t = (key) => {
  return moduleContainer.value?.t(key) || key;
};
// ---------------------------------------

let tab = ref(1);
let count = ref(0);
let step = ref(1);
let history = ref([]);

function increment() {
  count.value++;
  history.value.unshift(1);
}

function decrement() {
  count.value--;
  history.value.unshift(-1);
}

function incrementBy(value) {
  count.value += value;
  history.value.unshift(value);
}

function decrementBy(value) {
  count.value -= value;
  history.value.unshift(-value);
}

function reset() {
  count.value = 0;
  history.value = [];
}
</script>



================================================
FILE: src/modules/counter/lang/es.json
================================================
{
    "title": "Contable",
    "text": "ESPANHOL"
}


================================================
FILE: src/modules/counter/lang/pt.json
================================================
{
    "title": "Contador",
    "text": "PORTUGUES"
}


================================================
FILE: src/modules/stopwatch/index.js
================================================
import BaseModule from "../BaseModule";
import es from "./lang/es.json";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    // Load translations
    manifest.translations = { pt, es };

    // Load manifest
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}



================================================
FILE: src/modules/stopwatch/manifest.json
================================================
{
  "id": "stopwatch",
  "name": "Cronômetro",
  "description": "Cronômetro",
  "category": "utilities",
  "icon": "mdi-timer-outline",
  "customization": {
    "font": {
      "type": "font",
      "label": "customization.font",
      "default": "Arial, sans-serif"
    },
    "font_color": {
      "type": "color",
      "label": "customization.color",
      "default": "#FFFFFF"
    },
    "font_size": {
      "type": "font-size",
      "label": "customization.size",
      "default": 30
    },
    "background_color": {
      "type": "color",
      "label": "customization.color",
      "default": "#000000"
    },
    "border_spacing": {
      "type": "border-spacing",
      "label": "customization.border",
      "default": 10
    },
    "vertical_align": {
      "type": "v-align",
      "label": "customization.vertical",
      "default": "center"
    },
    "horizontal_align": {
      "type": "h-align",
      "label": "customization.horizontal",
      "default": "center"
    },
    "image": {
      "type": "image",
      "label": "customization.image",
      "default": ""
    },
    "image_opacity": {
      "type": "opacity",
      "label": "customization.transparency",
      "default": 100
    },
    "image_fit": {
      "type": "object-fit",
      "label": "customization.adjust",
      "default": "cover"
    },
    "time_format": {
      "type": "select",
      "label": "customization.time_format",
      "default": "hh.mm.ss.ms"
    }
  }
}


================================================
FILE: src/modules/stopwatch/components/Screen.vue
================================================
<template>
  <div
    ref="container"
    class="d-flex"
    :class="alignClass"
    :style="containerStyle"
  >
    <img
      v-if="userdata.image"
      :src="userdata.image"
      :style="{
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        position: 'absolute',
        objectFit: userdata.image_fit,
        opacity: userdata.image_opacity / 100,
      }"
    />
    <span class="text-right" :style="textStyle">
      {{ formattedTime }}
    </span>
  </div>
</template>

<script>
import manifest from "../manifest.json";

export default {
  name: "StopwatchPage",
  data: () => ({
    s_width: 0,
    s_height: 0,
    timer: null,
    elapsedTime: 0,
    now: null,
  }),
  computed: {
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    appdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$appdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$appdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    backgroundColor() {
      return this.userdata.background_color || "#000000";
    },
    font() {
      return this.userdata.font || "Arial, sans-serif";
    },
    fontColor() {
      return this.userdata.font_color || "#FFFFFF";
    },
    fontSize() {
      return this.userdata.font_size || 30;
    },
    borderSpacing() {
      return this.userdata.border_spacing || 10;
    },
    verticalAlign() {
      return this.userdata.vertical_align || "center";
    },
    horizontalAlign() {
      return this.userdata.horizontal_align || "center";
    },
    image() {
      return this.userdata.image || "";
    },
    imageOpacity() {
      return (this.userdata.image_opacity || 100) / 100;
    },
    imageFit() {
      return this.userdata.image_fit || "cover";
    },
    timeFormat() {
      return this.userdata.time_format || "hh.mm.ss.ms";
    },
    alignClass() {
      const vertical = {
        start: "align-start",
        center: "align-center",
        end: "align-end",
      };
      const horizontal = {
        start: "justify-start",
        center: "justify-center",
        end: "justify-end",
      };
      return `${vertical[this.verticalAlign]} ${horizontal[this.horizontalAlign]}`;
    },
    containerStyle() {
      return {
        background: this.backgroundColor,
        width: "100%",
        height: "100%",
        position: "relative",
        color: this.fontColor,
        padding: `${this.borderSpacing}px`,
      };
    },
    textStyle() {
      return {
        fontFamily: this.font,
        color: this.fontColor,
        zIndex: 1,
        fontSize: `${this.fontSizePc(this.fontSize)}px`,
        textAlign: `${this.horizontalAlign}`,
      };
    },

    startTime() {
      const value = this.appdata.start_time;
      if (!value) return null;
      return value instanceof Date ? value : new Date(value);
    },
    pausedTime() {
      const value = this.appdata.paused_time;
      if (!value) return null;
      return value instanceof Date ? value : new Date(value);
    },
    isRunning() {
      return this.appdata.is_running ?? null;
    },

    formattedTime() {
      const elapsedTime = this.now
        ? this.now - (this.startTime ?? this.now)
        : 0;

      const totalMilliseconds = elapsedTime;
      const hours = Math.floor(totalMilliseconds / 3600000);
      const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
      const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
      const milliseconds = Math.floor((totalMilliseconds % 1000) / 10);

      const pad = (v) => String(v).padStart(2, "0");

      const tokens = {
        hh: pad(hours),
        mm: pad(minutes),
        ss: pad(seconds),
        ms: pad(milliseconds),
      };

      return this.timeFormat.replace(/hh|mm|ss|ms/g, (match) => tokens[match]);
    },
  },
  watch: {
    isRunning() {
      if (this.isRunning) {
        this.timer = setInterval(() => {
          this.now = new Date();
        }, 10);
      } else {
        clearInterval(this.timer);
        this.now = this.pausedTime;
      }
    },
  },
  methods: {
    fontSizePc(pc) {
      const v = Math.min(this.s_width, this.s_height);
      return (pc * v) / 100 / 2;
    },
    windowResize() {
      const container = this.$refs.container;
      if (container) {
        this.s_width = container.offsetWidth;
        this.s_height = container.offsetHeight;

        if (this.s_width <= 0 || this.s_height <= 0) {
          const self = this;
          setTimeout(function () {
            self.windowResize();
          }, 100);
        }
      }
    },
  },
  mounted() {
    this.windowResize();
    window.addEventListener("resize", this.windowResize);

    if (this.isRunning) {
      this.timer = setInterval(() => {
        this.now = new Date();
      }, 10);
    }
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
    clearInterval(this.timer);
  },
};
</script>



================================================
FILE: src/modules/stopwatch/interface/Index.vue
================================================
<template>
  <l-window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    closable
    minimizable
    @close="close()"
    @minimize="$modules.minimize(module_id)"
    @resize="resize"
    :index="show ? 1 : 0"
  >
    <template v-slot:customize>
      <l-customization-tools
        :module="module"
        :items="[
          {
            name: t('customization.background'),
            items: [
              'background_color',
              ['image', 'image_opacity', 'image_fit'],
            ],
          },
          {
            name: t('customization.align'),
            items: [['horizontal_align', 'vertical_align']],
          },
          {
            name: t('customization.text'),
            items: [['font', 'font_size', 'font_color']],
          },
          { name: t('customization.window'), items: ['border_spacing'] },
        ]"
      />
    </template>

    <template v-slot:system_buttons>
      <LScreenBtn module="stopwatch" />
    </template>

    <template v-slot:header>
      <l-toolbar>
        <l-toolbar-item>
          <l-select
            :label="t('customization.time_format')"
            v-model="userdata.time_format"
            :items="timeFormatOptions"
            item-value="value"
            item-title="title"
            density="compact"
            hide-details
            style="max-width: 170px"
          />
        </l-toolbar-item>

        <v-spacer />
        <l-toolbar-item>
          <v-btn
            v-if="!isRunning"
            color="green"
            size="small"
            @click="startStopwatch"
            variant="tonal"
          >
            <v-icon left>mdi-play</v-icon>
            {{ t("start") }}
          </v-btn>

          <v-btn
            v-else
            color="orange"
            size="small"
            @click="pauseStopwatch"
            variant="tonal"
          >
            <v-icon left>mdi-pause</v-icon>
            {{ t("pause") }}
          </v-btn>

          <v-btn
            color="red"
            size="small"
            @click="resetStopwatch"
            style="margin-left: 8px"
            variant="tonal"
          >
            <v-icon left>mdi-refresh</v-icon>
            {{ t("reset") }}
          </v-btn>

          <v-btn
            color="blue"
            size="small"
            @click="saveTime"
            style="margin-left: 8px"
            variant="tonal"
          >
            <v-icon left>mdi-content-save</v-icon>
            {{ t("save") }}
          </v-btn>
        </l-toolbar-item>

        <v-spacer />
      </l-toolbar>
    </template>

    <Screen ref="screen" />

    <template v-slot:right v-if="savedTimes.length > 0">
      <v-card
        flat
        class="pa-2 d-flex flex-column"
        style="width: 240px; height: 100%"
      >
        <v-card-title class="font-weight-light">
          <v-badge
            location="top right"
            color="warning"
            :content="savedTimes.length"
          >
            {{ t("saved_times") }} &nbsp;
          </v-badge>
        </v-card-title>
        <template v-slot:actions>
          <v-btn
            size="small"
            color="red"
            @click="clearSavedTimes"
            variant="tonal"
            block
          >
            {{ t("clear_all") }}
          </v-btn>
        </template>
        <v-card-text class="pa-0 ma-0">
          <v-list density="compact" class="bg-transparent">
            <v-list-item
              v-for="(item, index) in savedTimes"
              :key="index"
              class="px-0"
            >
              <template v-slot:prepend>
                <v-icon size="small">mdi-timer</v-icon>
              </template>
              <v-list-item-title>
                {{ formatted(item) }}
              </v-list-item-title>
              <template v-slot:append>
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  color="red"
                  @click="deleteSavedTime(index)"
                >
                  <v-icon size="small">mdi-delete</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </template>
  </l-window>
</template>

<script>
import manifest from "../manifest.json";
import LWindow from "@/components/Window.vue";
import Screen from "../components/Screen.vue";
import LScreenBtn from "@/components/buttons/Screen.vue";
import LSelect from "@/components/inputs/Select.vue";
import LCustomizationTools from "@/components/CustomizationTools.vue";
import LToolbar from "@/components/Toolbar.vue";
import LToolbarItem from "@/components/ToolbarItem.vue";

export default {
  name: manifest.id,
  components: {
    LWindow,
    Screen,
    LScreenBtn,
    LSelect,
    LCustomizationTools,
    LToolbar,
    LToolbarItem,
  },
  data: () => ({
    width: 0,
    height: 0,
    isRunning: false,
    startTime: null,
    pausedTime: null,
    savedTimes: [],
    timeFormatOptions: [
      { title: "hh:mm:ss.ms", value: "hh:mm:ss.ms" },
      { title: "hh:mm:ss", value: "hh:mm:ss" },
      { title: "mm:ss.ms", value: "mm:ss.ms" },
      { title: "mm:ss", value: "mm:ss" },
    ],
  }),
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$userdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    appdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => {
            return this.$appdata.get(`modules.${this.module.id}.${key}`, null);
          },
          set: (_, key, value) => {
            this.$appdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */

    show() {
      return this.module.show;
    },
  },

  watch: {
    startTime() {
      this.appdata.start_time = this.startTime;
    },
    pausedTime() {
      this.appdata.paused_time = this.pausedTime;
    },
    isRunning() {
      this.appdata.is_running = this.isRunning;
    },
  },

  methods: {
    /* METHODS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    t(text) {
      return this.$t(`modules.${this.module_id}.${text}`);
    },
    /* METHODS OBRIGATÓRIAS - FIM */

    resize(data) {
      this.width = data.container_width;
      this.height = data.container_height;
    },

    close() {
      this.pauseStopwatch();
      this.resetStopwatch();
      this.$modules.close(this.module_id);
    },

    startStopwatch() {
      if (!this.startTime) {
        this.startTime = new Date();
      }
      this.pausedTime = null;
      this.isRunning = true;
    },

    pauseStopwatch() {
      this.pausedTime = new Date();
      this.isRunning = false;
    },

    resetStopwatch() {
      this.startTime = null;
      if (this.isRunning) {
        this.startStopwatch();
      }
      this.pausedTime = null;
    },

    saveTime() {
      const now = this.isRunning ? new Date() : this.pausedTime;
      const elapsedTime = now ? now - (this.startTime ?? now) : 0;

      this.savedTimes.push(elapsedTime);
    },

    deleteSavedTime(index) {
      this.savedTimes.splice(index, 1);
    },

    clearSavedTimes() {
      this.savedTimes = [];
    },

    formatted(time) {
      const totalMilliseconds = time;
      const hours = Math.floor(totalMilliseconds / 3600000);
      const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
      const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
      const milliseconds = Math.floor((totalMilliseconds % 1000) / 10);

      const pad = (v) => String(v).padStart(2, "0");

      const tokens = {
        hh: pad(hours),
        mm: pad(minutes),
        ss: pad(seconds),
        ms: pad(milliseconds),
      };

      return this.userdata.time_format.replace(
        /hh|mm|ss|ms/g,
        (match) => tokens[match],
      );
    },
  },
};
</script>



================================================
FILE: src/modules/stopwatch/interface/Popup.vue
================================================
<template>
  <Screen />
</template>

<script>
import manifest from "../manifest.json";

import Screen from "../components/Screen.vue";

export default {
  name: "PopupScreenPage",
  components: {
    Screen,
  },
  computed: {
    /* COMPUTEDS OBRIGATÓRIAS - INÍCIO */
    /* NÃO MODIFICAR */
    module_id() {
      return manifest.id;
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    /* COMPUTEDS OBRIGATÓRIAS - FIM */
  },
};
</script>



================================================
FILE: src/modules/stopwatch/lang/es.json
================================================
{
    "title": "Cronómetro",
    "start": "Iniciar",
    "pause": "Pausar",
    "reset": "Reiniciar",
    "save": "Guardar",
    "lap": "Vuelta",
    "laps": "Vueltas",
    "clearLaps": "Limpiar Vueltas",
    "saved_times": "Tiempos Guardados",
    "clear_all": "Limpiar Todos",
    "no_saved_times": "Sin tiempos guardados",
    "customization": {
        "background": "Fondo",
        "color": "Color",
        "image": "Imagen",
        "transparency": "Transparencia",
        "adjust": "Ajustar",
        "align": "Alineación",
        "font": "Fuente",
        "text": "Texto",
        "window": "Ventana",
        "vertical": "Vertical",
        "horizontal": "Horizontal",
        "border": "Borde",
        "size": "Tamaño",
        "time_format": "Formato"
    }
}



================================================
FILE: src/modules/stopwatch/lang/pt.json
================================================
{
    "title": "Cronômetro",
    "start": "Iniciar",
    "pause": "Pausar",
    "reset": "Reiniciar",
    "save": "Salvar",
    "lap": "Volta",
    "laps": "Voltas",
    "clearLaps": "Limpar Voltas",
    "saved_times": "Tempos Salvos",
    "clear_all": "Limpar Todos",
    "no_saved_times": "Nenhum tempo salvo",
    "customization": {
        "background": "Fundo",
        "color": "Cor",
        "image": "Imagem",
        "transparency": "Transparência",
        "adjust": "Ajustar",
        "align": "Alinhamento",
        "font": "Fonte",
        "text": "Texto",
        "window": "Janela",
        "vertical": "Vertical",
        "horizontal": "Horizontal",
        "border": "Borda",
        "size": "Tamanho",
        "time_format": "Formato"
    }
}



================================================
FILE: src/plugins/vuetify.js
================================================
// Styles
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";

// Vuetify
import { createVuetify } from "vuetify";

export default createVuetify({
  theme: {
    defaultTheme: "darkblue",
    themes: {
      light: {
        dark: false,
        colors: {
          primary: "#29569b",
        },
      },
      darkblue: {
        dark: false,
        colors: {
          primary: "#1b2a41",
        },
      },
      blue: {
        dark: false,
        colors: {
          primary: "#0b3d62",
        },
      },
      green: {
        dark: false,
        colors: {
          primary: "#077568",
        },
      },
      orange: {
        dark: false,
        colors: {
          primary: "#d24726",
        },
      },
      purple: {
        dark: false,
        colors: {
          primary: "#80397b",
        },
      },
      pink: {
        dark: false,
        colors: {
          primary: "#e91e63",
        },
      },
      black: {
        dark: false,
        colors: {
          primary: "#2e2e2e",
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: "#2e2e2e",
        },
      },
    },
  },
});



================================================
FILE: src/plugins/webfontloader.js
================================================
/**
 * plugins/webfontloader.js
 *
 * webfontloader documentation: https://github.com/typekit/webfontloader
 */

export async function loadFonts () {
  const webFontLoader = await import(/* webpackChunkName: "webfontloader" */'webfontloader')

  webFontLoader.load({
    google: {
      families: ['Roboto:100,300,400,500,700,900&display=swap'],
    },
  })
}



================================================
FILE: src/router/index.js
================================================
import { createRouter, createWebHistory } from "vue-router";
import Main from "@/views/Main.vue"; // Importando um componente de exemplo
import Popup from "@/views/Popup.vue";

const routes = [
  {
    path: "/",
    name: "Main",
    component: Main,
  },
  {
    path: "/popup",
    name: "Popup",
    component: Popup,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL ?? "/"),
  routes,
});

export default router;



================================================
FILE: src/store/actions.js
================================================
export default {};



================================================
FILE: src/store/getters.js
================================================
export default {
  getData:
    (state) =>
    (data = "") => {
      if (!data) return state;

      const keys = data.split(".");
      let result = state;

      for (let key of keys) {
        if (result) {
          result = result[key];
        } else {
          return undefined;
        }
      }

      return result;
    },

  exists: (state) => (data) => {
    const keys = data.split(".");
    let current = state;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    return current[keys[keys.length - 1]] !== undefined;
  },
};



================================================
FILE: src/store/index.js
================================================
import { createStore } from 'vuex';
import state from './state';
import mutations from './mutations';
import actions from './actions';
import getters from './getters';

const store = createStore({
  state,
  mutations,
  actions,
  getters,
});

export default store;



================================================
FILE: src/store/mutations.js
================================================
export default {
  setData(state, data) {
    const value = data.pop();
    const param = data.join(".");

    const keys = param.split(".");
    let current = state;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  },

  addElementArray(state, data) {
    const value = data.pop();
    const param = data.join(".");

    const keys = param.split(".");
    let current = state;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]].push(value);
  },
  removeElementArray(state, data) {
    const value = data.pop();
    const param = data.join(".");

    const keys = param.split(".");
    let current = state;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = current[keys[keys.length - 1]].filter(
      (item) => item !== value
    );
  },
};



================================================
FILE: src/store/state.js
================================================
export default {
  is_dev: false,
  is_dark: false,
  is_popup: false,
  is_mobile: false,
  is_desktop: false,
  is_online: false,
  popup: null,
  popup_module: null,
  import_modules: false,
  loading: false,
  modules: {},
  module_group: {
    musics: {
      title: "module_group.musics.title",
      modules: ["musics", "hymnal", "hymnal_1996"],
    },
    bible: {
      title: "module_group.bible.title",
      modules: [],
    },
    utilities: {
      title: "module_group.utilities.title",
      modules: [],
    },
  },
  menu: {
    show: false,
    modules: [],
  },
  tray_area: {
    modules: [],
  },
  languages: {
    pt: { name: "Português", flag: "br" },
    es: { name: "Español", flag: "es" },
  },
  alert: {
    show: false,
    title: "",
    text: "",
    error: "",
    color: "",
    buttons: [],
    value: "",
    translate: false,
  },
  user_data: {
    theme: "",
    language: "",
    layout: "apps",
    remote: {
      is_connected: false,
      url: "",
      token: "",
    },
    modules: {
      musics: {
        search: {
          name: true,
          lyric: false,
          album: false,
          track: false,
        },
        filter: {
          instrumental_music: false,
        },
      },
      media: {
        lazy_load: true,
        fade_audio: true,
      },
    },
  },
};



================================================
FILE: src/views/Main.vue
================================================
<template>
  <AppSystemBar />
  <AppHeader />
  <AppMenu />

  <AppModules />
  <AppAlert />

  <AppsRibbon v-if="this.$userdata.get('layout') == 'ribbon'" />

  <v-main v-if="this.$userdata.get('layout') !== 'ribbon'" class="bg-main">
    <Apps />
    <AppTrayArea />
  </v-main>
  <v-main class="d-flex flex-column" v-else>
    <v-sheet
      :color="$theme.primary()"
      width="100%"
      height="100%"
      class="d-flex align-center justify-center"
    >
      <img src="@/assets/imgs/logo.svg" />
    </v-sheet>
    <AppTrayArea horizontal />
  </v-main>

  <AppFooter />
</template>

<script>
import AppSystemBar from "@/layout/SystemBar.vue";
import AppHeader from "@/layout/Header.vue";
import AppFooter from "@/layout/Footer.vue";
import AppMenu from "@/layout/Menu.vue";
import AppModules from "@/layout/Modules.vue";
import AppAlert from "@/layout/Alert.vue";
import Apps from "@/layout/Apps.vue";
import AppsRibbon from "@/layout/AppsRibbon.vue";
import AppTrayArea from "@/layout/TrayArea.vue";

export default {
  name: "MainPage",
  components: {
    AppSystemBar,
    AppHeader,
    AppFooter,
    AppMenu,
    AppModules,
    AppAlert,
    Apps,
    AppsRibbon,
    AppTrayArea,
  },
  mounted() {
    //Carregar os dados salvos
    this.$userdata.load();

    //Carrega o tema
    let theme = this.$userdata.get("theme");
    if (theme != "") {
      this.$vuetify.theme.change(theme);
    }
    this.$appdata.set("is_dark", this.$vuetify.theme.global.current.dark);

    //Carrega o idioma
    let lang = this.$userdata.get("language");
    if (lang != "") {
      this.$i18n.locale = lang;
    } else {
      this.$userdata.set("language", this.$i18n.locale);
    }

    //Checa se está em modo de desenvolvimento
    let is_dev = import.meta.env.VITE_APP_MODE == "development";
    this.$appdata.set("is_dev", is_dev);

    if (!is_dev) {
      //Prevenir REFRESH
      window.addEventListener("beforeunload", (event) => {
        event.preventDefault();
        event.returnValue = "";
      });
    }

    //Checa as plataformas
    this.$appdata.set(
      "is_mobile",
      this.$vuetify.display.platform.android ||
        this.$vuetify.display.platform.ios,
    );

    if (this.$vuetify.display.platform.electron) {
      this.$appdata.set("is_desktop", true);
    } else {
      this.$appdata.set("is_desktop", false);
      this.$appdata.set("is_online", true);
    }

    window.addEventListener("message", (event) => {
      if (event.origin === window.location.origin) {
        if (event.data == "mounted") {
          const popup = this.$appdata.get("popup");
          if (popup) {
            const data = this.$appdata.getFlatten();
            Object.keys(data).map((item) => {
              popup.postMessage(
                { param: item, value: data[item] },
                window.location.origin,
              );
            });
            //popup.postMessage({ all: data }, window.location.origin);
          }
        } else if (event.data == "closed") {
          this.$popup.close();
        }
      }
    });

    /*********************************************************************/
    /*********************************************************************/
    /* ********************* PROVISORIO ******************************** */
    if (is_dev) {
      //const self = this;
      setTimeout(function () {
        //self.$media.open({ id_music: 112, mode: "audio", minimized: false });
        //self.$modules.open("clock");
        //self.$modules.open("collections");
        //self.$media.openAlbum(9);
      }, 100);
    }
    /*********************************************************************/
    /*********************************************************************/
  },
};
</script>

<style>
main {
  display: flex !important;
  flex: auto !important;
  align-items: stretch !important;
  --v-layout-top: 0 !important;
  padding-top: 0 !important;
  overflow: auto !important;
}
</style>



================================================
FILE: src/views/Popup.vue
================================================
<template>
  <div class="w-100 h-100" style="background: #000">
    <component v-if="module" :is="loadModuleComponent()" />
  </div>
</template>

<script>
import { defineAsyncComponent } from "vue";

export default {
  name: "PopupPage",
  data: () => ({
    message: null,
  }),
  computed: {
    module() {
      return this.$appdata.get("popup_module");
    },
  },
  methods: {
    loadModuleComponent() {
      return defineAsyncComponent(() => {
        // Try to load from modules interface directory
        return import(
          `@/modules/core/${this.module}/interface/Popup.vue`
        ).catch(() => {
          // Try to load from CUSTOM module interface directory
          return import(`@/modules/${this.module}/interface/Popup.vue`).catch(
            (e) => {
              this.$alert.error({
                text: "messages.error_import_module",
                error: e,
              });

              return null;
            }
          );
        });
      });
    },
  },
  mounted() {
    this.$appdata.set("is_popup", true);
    window.addEventListener("message", (event) => {
      if (event.origin === window.location.origin) {
        this.message = event.data;
        if (event.data.param) {
          this.$appdata.set(event.data.param, event.data.value);
        }
      }
    });

    window.opener.postMessage("mounted", window.location.origin);

    window.addEventListener("beforeunload", () => {
      window.opener?.postMessage("closed", window.location.origin);
    });
  },
};
</script>



================================================
FILE: .github/workflows/deploy.yaml
================================================
name: deploy
on:
  push:
    branches:
      - main
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: checkout code
        uses: actions/checkout@v3
      - name: set up node.js
        uses: actions/setup-node@v3
        with:
          node-version: 22
      - name: setup git auth
        env:
          email: ${{ secrets.EMAIL }}
          username: ${{ secrets.USERNAME }}
          access_token: ${{ secrets.ACCESS_TOKEN }}
        run: |
          git config --global credential.helper store
          echo "https://${access_token}:x-oauth-basic@github.com" > ~/.git-credentials
          git config --global user.email $email
          git config --global user.name $username
      - name: fetch CNAME from dist branch
        run: |
          git fetch origin dist:dist
          git show dist:CNAME > CNAME || echo "CNAME not found, skipping"
      - name: install dependencies
        run: npm install
      - name: build project
        run: npm run build
        env:
          NODE_ENV: production
          VITE_BASE_URL: /
      - name: copy CNAME to dist (if exists)
        run: |
          if [ -f CNAME ]; then
            cp CNAME dist/CNAME
          fi
      - name: copy index.html to 404.html
        run: |
          cp dist/index.html dist/404.html
      - name: deploy to dist
        run: |
          cd dist
          git init
          git checkout -b dist  # Cria a branch dist se não existir
          git add -A
          git commit -m "🚀 Deploy id ${GITHUB_RUN_ID}"
          git remote add origin "https://github.com/${GITHUB_REPOSITORY}.git"
          git push -f origin dist  # Faz push forçado para a branch dist


