# Izy Notion Assistant 🤖

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4.svg)

**Izy** é uma extensão inteligente para Google Chrome que conecta você ao seu workspace do Notion. Busque páginas, filtre databases e converse com seus documentos usando Inteligência Artificial.

## ✨ Funcionalidades

*   **⚡ Busca Instantânea**: Encontre qualquer página ou database em milissegundos.
*   **🧠 Izy AI**: Pergunte ao assistente sobre seus dados (ex: "O que trabalhei na última semana?", "Resuma a ata da reunião").
*   **⭐ Favoritos**: Fixe páginas importantes para acesso rápido.
*   **📝 Quick Notes**: Área de rascunho rápido salva localmente.
*   **🔒 Seguro**: Seus dados trafegam diretamente entre seu navegador e a API do Notion.

## 🚀 Como Instalar (Developer Mode)

Como a extensão ainda não está na Chrome Web Store, você pode instalar manualmente:

1.  Clone este repositório:
    ```bash
    git clone https://github.com/seu-usuario/izy-notion-assistant.git
    ```
2.  Abra o Chrome e digite na barra de endereços: `chrome://extensions/`
3.  No canto superior direito, ative o botão **Modo do desenvolvedor** (Developer mode).
4.  Clique no botão **Carregar sem compactação** (Load Unpacked).
5.  Selecione a pasta do projeto que você acabou de clonar.

## ⚙️ Configuração Inicial

1.  Clique no ícone da extensão Izy no seu navegador.
2.  Vá para a aba **Configurações** (ícone de engrenagem).
3.  Você precisará de um **Token de Integração do Notion**:
    *   Acesse [notion.so/my-integrations](https://www.notion.so/my-integrations).
    *   Clique em "New integration".
    *   Dê um nome (ex: "Izy Assistant") e envie.
    *   Copie o "Internal Integration Secret".
4.  Cole o token no Izy e salve.
5.  **Importante**: No Notion, vá até as páginas/databases que deseja que o Izy veja, clique nos `...` (menu) -> `Conexões` (Connections) -> Adicione a integração que você criou.

## 🛠️ Tecnologias Usadas

*   **Core**: React 18, TypeScript
*   **Estilização**: Tailwind CSS
*   **AI**: Google Gemini API via `@google/genai` SDK
*   **API**: Notion Official API
*   **Arquitetura**: Chrome Extension V3 (Sandboxed Iframe Architecture)

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.
