<div align="center">
  
# Obsidian Plugin TMDB 

<p align="center">
	<img src="https://img.shields.io/badge/version project-1.0-brightgreen" alt="version project">
	<img src="https://img.shields.io/npm/v/npm.svg?logo=nodedotjs" alt="node version">
</p>

Um plugin para buscar informações de filmes usando a API TMDB. 
<img src="https://user-images.githubusercontent.com/62897976/185768581-1d051a52-2e60-4378-b31d-39028cbfb5c8.svg" alt="status-em-andamento">

</div>


## Estrutura do Plugin
```
obsidian-plugin-tmdb/
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json           
├── manifest.json
├── main.ts
├── dist/                   # Arquivos gerados pelo build
└── test-vault/             # Cofre do Obsidian para testes
    ├── .obsidian/          # Configurações específicas do cofre
    │   ├── plugins/        # Plugins do cofre
    │   │   ├── hot-reload/ # Plugin para recarregar plugin durante desenvolvimento
    │   │   └── obsidian-plugin-tmdb/ # Plugin
    │   ├── workspace.json
    │   └── app.json
    ├── Notes/              # Notas de exemplo
    │   └── Test Note.md
    └── Attachments/        # Arquivos anexos para teste
```

## 🎯 Implementações/Features

- [x] Começando
- [x] Estilos Globais do Projeto
- [x] Estruturação/Estilização Avançada
- [x] Resolvendo Bugs
- [x] Organizando Estrutura da pasta
- [x] Projeto Finalizado
- [x] Publicando
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
