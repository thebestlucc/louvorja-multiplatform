# Instalando o LouvorJA no Linux

## Opcao A: AppImage (recomendado — funciona em qualquer distribuicao)

### Download

1. Acesse a [pagina de releases](https://github.com/nickksoares/louvorja-multiplataform/releases) e baixe o arquivo `.AppImage`.

### Instalar

2. Torne o arquivo executavel:
   - **Gerenciador de arquivos:** Clique com o botao direito → Propriedades → Permissoes → marque "Permitir execucao como programa"
   - **Terminal:** `chmod +x LouvorJA_0.1.0_amd64.AppImage`

3. Clique duas vezes no AppImage para executar.

4. **Se nada acontecer**, instale as bibliotecas necessarias:
   ```bash
   sudo apt install libwebkit2gtk-4.1-0 libappindicator3-1
   ```

### Primeiro uso

5. Selecione seu idioma preferido (Portugues, Ingles ou Espanhol).

6. Escolha **"Comecar do zero"** ou **"Importar da versao Delphi"** se voce tiver um banco de dados existente.

---

## Opcao B: Debian/Ubuntu (pacote .deb)

### Download

1. Acesse a [pagina de releases](https://github.com/nickksoares/louvorja-multiplataform/releases) e baixe o arquivo `.deb`.

### Instalar

2. Instale com um destes metodos:
   - **Clique duplo** no arquivo `.deb` para abrir na Central de Software, depois clique em "Instalar"
   - **Terminal:** `sudo dpkg -i LouvorJA_0.1.0_amd64.deb`

3. Se aparecerem erros de dependencia no terminal:
   ```bash
   sudo apt-get install -f
   ```

4. Abra o **LouvorJA** pelo menu de aplicativos.

---

## Verifique sua instalacao

7. Abra o aplicativo e confira o numero da versao na barra de status inferior (ex: `v0.1.0`).

## Atualizacoes automaticas

O LouvorJA verifica atualizacoes automaticamente. Quando uma nova versao estiver disponivel, uma notificacao aparecera no canto inferior direito. Durante um culto, a notificacao e adiada ate o culto terminar — sua projecao nunca sera interrompida.

## Solucao de problemas

- **AppImage nao executa:** Verifique se e executavel (`chmod +x`) e se o FUSE esta instalado: `sudo apt install libfuse2`.
- **Bibliotecas faltando:** Execute `sudo apt install libwebkit2gtk-4.1-0 libappindicator3-1 librsvg2-2`.
- **Precisa de ajuda?** Abra um chamado em [github.com/nickksoares/louvorja-multiplataform/issues](https://github.com/nickksoares/louvorja-multiplataform/issues).
