# Search Movies and TV Shows TMDB <img src="https://img.shields.io/badge/version project-1.0.1-brightgreen" alt="version project">
Um plugin para buscar informações de filmes usando a API TMDB. 

<img alt="image" src="https://github.com/user-attachments/assets/d623ed6c-f519-4720-a0ae-af14b7a34d3d" />

## Funcionalidades
- Busca no TMDB: Busque filmes e séries de TV através da paleta de comandos, com busca automática de metadados.
- Registros com Modelos: Gere automaticamente arquivos Markdown com pôsteres, classificações, sinopses, etc.
- Suporte a Séries: Acompanhe séries de TV por temporada, incluindo listas de episódios e progresso de visualização.
- Visualização em Cartões: Navegue por todos os registros de visualização em uma grade visual de cartões.
- Campos Pessoais: Preencha com suas impressões, classificação pessoal, plataforma de visualização, status de visualização, etc.
- Recomendo usar com plugin: [Obsidian-projects](https://github.com/obsmd-projects/obsidian-projects).

## 🚀 Como Instalar (Installation)
**Método 1: Instalar a partir dos Plugins da Comunidade Obsidian (Recomendado)**
1. Abra o Obsidian → Configurações → Plugins da Comunidade → Procurar
2. Pesquise por "Search Movies and TV Shows TMDB"
3. Clique em Instalar e Ativar

**Método 2: você pode instalar este plugin manualmente:**

1. Baixe o último release (`main.js`, `manifest.json`) na página de [Releases](../../releases) do repositório.
2. No seu cofre (vault) do Obsidian, abra a pasta `.obsidian/plugins/`. Se a pasta `plugins` não existir, crie-a.
3. Crie uma nova pasta chamada `search-movies-tv-tmdb`.
4. Extraia os arquivos baixados para dentro desta nova pasta.
5. Abra o Obsidian, vá em **Configurações > Plugins da comunidade**, desative o "Modo de segurança" (se estiver ativo) e ative o plugin "Search Movies and TV Shows TMDB".

## 💻 Como Usar (Usage)

1. Após ativar o plugin, acesse as configurações do plugin no Obsidian.
   <img width="555" height="549" alt="image" src="https://github.com/user-attachments/assets/846e55f1-815b-42fe-99d5-4d2f74cc4fec" />
2. Insira a sua chave da API do TMDB (TMDB API Key). Você pode conseguir uma gratuitamente no site do [TMDB](https://www.themoviedb.org/).
3. Abra a Paleta de Comandos (`Ctrl/Cmd + P`) e digite **TMDB**.
   <img width="751" height="272" alt="image" src="https://github.com/user-attachments/assets/30368bb7-2570-49af-b493-ac16752ebb3a" />
4. Selecione a opção para buscar um filme ou série e digite o nome da obra.
   <img width="606" height="762" alt="image" src="https://github.com/user-attachments/assets/2a011ed0-7743-4b9f-b862-a2cf384d60b6" />
5. As informações serão importadas automaticamente para a sua nota atual!
   <img width="593" height="751" alt="image" src="https://github.com/user-attachments/assets/c128d979-4a3f-4371-92b4-5d2ff41aab16" />

## 🤔 Como Ajudar

- Bifurque este repositório;
- Crie uma ramificação com seu recurso: `git checkout -b my-feature`;
- Confirme suas alterações: `git commit -m "feat: my new feature"`;
- Envie para sua filial: `git push origin my-feature`.

Depois que sua solicitação de pull for mesclada, você pode excluir sua branch.


## 📕 Referencias e Links Complementares
- [Construindo Plugin](https://publish.obsidian.md/help-pt-br/Desenvolvedores/Construir+plugins#:~:text=A%20maneira%20mais%20f%C3%A1cil%20de,o%20Plugin%20de%20amostra%20Obsidian.&text=N%C3%A3o%20desenvolva%20plugins%20em%20seu,de%20excluir%20permanentemente%20seu%20cofre.)

## 📝 Licença
Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.
