# Instalando o LouvorJA no macOS

## Download

1. Acesse a [pagina de releases](https://github.com/nickksoares/louvorja-multiplataform/releases) e baixe o arquivo `.dmg`.
   - Tanto Macs com Apple Silicon (M1/M2/M3/M4) quanto Intel sao suportados — a versao correta e selecionada automaticamente.

## Instalar

2. Abra o arquivo `.dmg` baixado.

3. Arraste o icone do **LouvorJA** para a pasta **Aplicativos**.

4. Abra o **LouvorJA** pela pasta Aplicativos (ou Launchpad).

5. **Se aparecer "LouvorJA nao pode ser aberto porque e de um desenvolvedor nao identificado":**
   - Isso e normal ate a assinatura digital ser configurada. O download e seguro.
   - Abra **Ajustes do Sistema** → **Privacidade e Seguranca**
   - Role para baixo e clique em **"Abrir Mesmo Assim"** ao lado da mensagem do LouvorJA
   - Clique em **"Abrir"** na janela de confirmacao

## Primeiro uso

6. Selecione seu idioma preferido (Portugues, Ingles ou Espanhol).

7. Escolha **"Comecar do zero"** ou **"Importar da versao Delphi"** se voce tiver um banco de dados existente.

## Verifique sua instalacao

8. Confira o numero da versao na barra de status inferior (ex: `v0.1.0`).

## Atualizacoes automaticas

O LouvorJA verifica atualizacoes automaticamente. Quando uma nova versao estiver disponivel, uma notificacao aparecera no canto inferior direito. Durante um culto, a notificacao e adiada ate o culto terminar — sua projecao nunca sera interrompida.

## Solucao de problemas

- **Erro "App esta danificado":** Abra o Terminal e execute: `xattr -cr /Applications/LouvorJA.app`, depois tente abrir novamente.
- **App nao abre:** Verifique se voce tem macOS 11 (Big Sur) ou superior.
- **Precisa de ajuda?** Abra um chamado em [github.com/nickksoares/louvorja-multiplataform/issues](https://github.com/nickksoares/louvorja-multiplataform/issues).
