# Izy Notion Assistant

Extensão minimalista para Chrome para aumentar sua produtividade no Notion.

## Funcionalidades

*   **Autenticação Segura**: Armazena seu Token de Integração localmente.
*   **Recentes**: Visualize as últimas 10 páginas editadas.
*   **Busca**: Pesquise páginas e databases em tempo real.
*   **Nota Rápida**: Envie notas de texto diretamente para sua página "Inbox".
*   **Favoritos**: Fixe páginas importantes localmente na extensão.

## Instalação (Modo Desenvolvedor)

1.  Clone ou baixe este repositório.
2.  Abra `chrome://extensions/` no Chrome.
3.  Ative o "Modo do desenvolvedor" (Developer mode).
4.  Clique em "Carregar sem compactação" (Load Unpacked).
5.  Selecione a pasta deste projeto.

## Configuração

1.  Obtenha seu Token em [Notion Integrations](https://www.notion.so/my-integrations).
2.  Crie uma nova integração e copie o "Internal Integration Secret".
3.  Dê acesso à integração nas páginas desejadas do Notion (Menu ... > Add connections).
4.  Abra a extensão, insira o Token.
5.  (Opcional) Insira o ID da página "Inbox" para notas rápidas, ou deixe em branco para buscar automaticamente por uma página chamada "Inbox".

## Tecnologias

*   HTML, CSS, JavaScript (Vanilla)
*   Manifest V3
*   Notion API v1
