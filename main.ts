import {
    App,
    Modal,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TFolder,
    Vault,
    requestUrl
} from "obsidian";

interface TmdbPluginSettings {
    tmdbApiKey: string;
    tmdbLanguage: string;
    notesFolder: string;
    movieFolder: string;
    seriesFolder: string;
    separateFolders: boolean;
    openNoteAfterCreation: boolean; // NOVA OPÇÃO
}

const DEFAULT_SETTINGS: TmdbPluginSettings = {
    tmdbApiKey: "",
    tmdbLanguage: "pt-BR",
    notesFolder: "",
    movieFolder: "",
    seriesFolder: "",
    separateFolders: false,
    openNoteAfterCreation: true, // Padrão será verdadeiro (ligado)
};

interface TmdbItem {
    id: number;
    title?: string;
    name?: string;
    poster_path?: string;
    release_date?: string;
    first_air_date?: string;
    genre_ids: number[];
    overview?: string;
}

export default class TmdbPlugin extends Plugin {
    settings: TmdbPluginSettings;

    async onload() {
        await this.loadSettings();

        const ribbonIconEl = this.addRibbonIcon(
            "film",
            "TMDB Plugin",
            () => {
                new Notice("Buscando filmes...");
                this.openSearchModal();
            }
        );
        ribbonIconEl.addClass("tmdb-plugin-ribbon-class");

        this.addCommand({
            id: "search-movie",
            name: "Buscar Filme na TMDB",
            callback: () => {
                this.openSearchModal();
            },
        });

        this.addSettingTab(new TmdbSettingTab(this.app, this));
    }

    openSearchModal() {
        new SearchMovieModal(this.app, this).open();
    }

    async loadSettings() {
        const loadedData = (await this.loadData()) as Partial<TmdbPluginSettings>;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SearchMovieModal extends Modal {
    plugin: TmdbPlugin;

    constructor(app: App, plugin: TmdbPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h1", { text: "Buscar Filme ou Série" });

        const form = contentEl.createEl("form");

        form.setCssStyles({
            display: "flex",
            flexDirection: "column",
            gap: "10px",
        });

        const input = form.createEl("input", {
            type: "text",
            placeholder: "Digite o nome do filme ou série...",
        });

        const typeSelect = form.createEl("select");
        typeSelect.createEl("option", { text: "Filme", value: "movie" });
        typeSelect.createEl("option", { text: "Série", value: "tv" });

        form.createEl("button", { text: "Buscar", type: "submit" });

        form.onsubmit = (e) => {
            e.preventDefault();
            const query = input.value.trim();
            const type = typeSelect.value;
            if (query) {
                (async () => {
                    await this.searchMovieOrSeries(query, type);
                })();
            } else {
                new Notice("Por favor, insira um nome.");
            }
        };
    }

    async searchMovieOrSeries(query: string, type: string) {
        const url = `https://api.themoviedb.org/3/search/${type}?api_key=${this.plugin.settings.tmdbApiKey}&query=${encodeURIComponent(query)}&language=${this.plugin.settings.tmdbLanguage}`;

        try {
            const response = await requestUrl(url);
            const data = response.json as { results: TmdbItem[] };

            if (data.results && data.results.length > 0) {
                this.displayResults(data.results, type);
            } else {
                new Notice("Nenhum resultado encontrado.");
            }
        } catch (error) {
            console.error(error);
            new Notice("Erro ao buscar dados. Verifique sua conexão e Chave da API.");
        }
    }

    displayResults(results: TmdbItem[], type: string) {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Resultados da Busca" });

        results.forEach((item) => {
            const itemEl = contentEl.createEl("div", { cls: "item-result" });

            const posterPath = item.poster_path
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : "";
            
            const imageEl = itemEl.createEl("img", {
                attr: {
                    src: posterPath,
                    alt: item.title || item.name || "Poster",
                    width: "100"
                }
            });

            const infoEl = itemEl.createEl("div");
            const releaseYear = item.release_date
                ? item.release_date.split("-")[0]
                : item.first_air_date
                ? item.first_air_date.split("-")[0]
                : "Desconhecido";

            infoEl.createEl("span", {
                text: `${item.title || item.name} (${releaseYear})`,
            });

            itemEl.onclick = () => {
                (async () => {
                    await this.createNoteForItem(item, type);
                })();
            };

            itemEl.setCssStyles({
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                cursor: "pointer",
            });
            imageEl.setCssStyles({
                marginRight: "10px",
            });
        });
    }

    async createNoteForItem(item: TmdbItem, type: string) {
        const cleanFileName = (str: string) => {
            return str.replace(/[\\/:*?"<>|]/g, ""); 
        };

        const title = item.title || item.name || "Sem Título";
        const year = item.release_date
            ? item.release_date.split("-")[0]
            : item.first_air_date
            ? item.first_air_date.split("-")[0]
            : "Desconhecido";

        const fileName = `${cleanFileName(title)} (${year}).md`;

        const genresList = item.genre_ids && item.genre_ids.length > 0 
            ? item.genre_ids.map((id: number) => this.getGenreName(id)).join("\n  - ")
            : "Desconhecido";

        const fileContent = `---
titulo: "${title}"
tipo: ${type === "movie" ? "Filme" : "Série"}
ano: "${year}"
gênero:
  - ${genresList}
image: https://image.tmdb.org/t/p/w500${item.poster_path || ""}
lançado: ${item.release_date || item.first_air_date || "Desconhecido"}
assistido: false
nota:
tags:
  - ${type === "movie" ? "filme" : "série"}
---
# Resumo
${item.overview || "Nenhuma descrição disponível."}
`;

        const folderPath = this.plugin.settings.separateFolders
            ? (type === "movie"
                ? this.plugin.settings.movieFolder
                : this.plugin.settings.seriesFolder)
            : this.plugin.settings.notesFolder;

        const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName;

        try {
            // Salvamos o arquivo recém-criado em uma variável
            const newFile = await this.app.vault.create(fullPath, fileContent);
            new Notice(`Nota criada: ${fullPath}`);
            
            // LÓGICA NOVA: Fecha o modal de pesquisa e abre a nota recém criada se a opção estiver ativada
            this.close();
            
            if (this.plugin.settings.openNoteAfterCreation) {
                // Abre o arquivo na aba ativa atual
                await this.app.workspace.getLeaf(false).openFile(newFile);
            }

        } catch (err) {
            new Notice("Erro ao criar a nota. Verifique se a pasta existe.");
            console.error(err);
        }
    }

    getGenreName(id: number): string {
        const genres: Record<number, string> = {
            28: "Ação",
            12: "Aventura",
            16: "Animação",
            35: "Comédia",
            80: "Crime",
            99: "Documentário",
            18: "Drama",
            10751: "Família",
            14: "Fantasia",
            36: "História",
            27: "Terror",
            10402: "Música",
            9648: "Mistério",
            10749: "Romance",
            878: "Ficção Científica",
            10770: "Filme de TV",
            53: "Thriller",
            10752: "Guerra",
            37: "Ocidental",
        };
        return genres[id] || "Desconhecido";
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class TmdbSettingTab extends PluginSettingTab {
    plugin: TmdbPlugin;

    constructor(app: App, plugin: TmdbPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions() {
        return []; 
    }

    getFolders(): string[] {
        const folders: string[] = [];
        this.app.vault.getAbstractFileByPath("/");
        Vault.recurseChildren(this.app.vault.getRoot(), (file) => {
            if (file instanceof TFolder && file.path !== "/") {
                folders.push(file.path);
            }
        });
        return folders.sort();
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Chave da API TMDB")
            .setDesc("Adicione sua chave de API da TMDB para buscar filmes.")
            .addText((text) =>
                text
                    .setPlaceholder("Insira sua chave de API aqui")
                    .setValue(this.plugin.settings.tmdbApiKey)
                    .onChange((value) => {
                        this.plugin.settings.tmdbApiKey = value;
                        (async () => {
                            await this.plugin.saveSettings();
                        })();
                    })
            );

        new Setting(containerEl)
            .setName("Idioma")
            .setDesc("Escolha o idioma para os resultados de busca (ex: pt-BR, en-US).")
            .addText((text) =>
                text
                    .setPlaceholder("pt-BR")
                    .setValue(this.plugin.settings.tmdbLanguage)
                    .onChange((value) => {
                        this.plugin.settings.tmdbLanguage = value;
                        (async () => {
                            await this.plugin.saveSettings();
                        })();
                    })
            );

        // NOVA CONFIGURAÇÃO NA TELA: Abrir nota após criação
        new Setting(containerEl)
            .setName("Abrir nota automaticamente")
            .setDesc("Abre a nota do filme ou série recém-criada imediatamente.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.openNoteAfterCreation)
                    .onChange((value) => {
                        this.plugin.settings.openNoteAfterCreation = value;
                        (async () => {
                            await this.plugin.saveSettings();
                        })();
                    })
            );

        new Setting(containerEl)
            .setName("Pastas separadas por tipo")
            .setDesc("Separar filmes e séries em pastas diferentes.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.separateFolders)
                    .onChange((value) => {
                        this.plugin.settings.separateFolders = value;
                        (async () => {
                            await this.plugin.saveSettings();
                            containerEl.empty();
                            this.display();
                        })();
                    })
            );

        if (!this.plugin.settings.separateFolders) {
            new Setting(containerEl)
                .setName("Pasta para as Notas")
                .setDesc("Pasta onde filmes e séries serão criados.")
                .addDropdown((dropdown) => {
                    const folders = this.getFolders();
                    dropdown.addOption("", "— Raiz do Vault —");
                    folders.forEach((folder) => dropdown.addOption(folder, folder));
                    dropdown
                        .setValue(this.plugin.settings.notesFolder)
                        .onChange((value) => {
                            this.plugin.settings.notesFolder = value;
                            (async () => {
                                await this.plugin.saveSettings();
                            })();
                        });
                });
        } else {
            new Setting(containerEl)
                .setName("Pasta para Filmes")
                .setDesc("Pasta onde as notas de filmes serão criadas.")
                .addDropdown((dropdown) => {
                    const folders = this.getFolders();
                    dropdown.addOption("", "— Raiz do Vault —");
                    folders.forEach((folder) => dropdown.addOption(folder, folder));
                    dropdown
                        .setValue(this.plugin.settings.movieFolder)
                        .onChange((value) => {
                            this.plugin.settings.movieFolder = value;
                            (async () => {
                                await this.plugin.saveSettings();
                            })();
                        });
                });

            new Setting(containerEl)
                .setName("Pasta para Séries")
                .setDesc("Pasta onde as notas de séries serão criadas.")
                .addDropdown((dropdown) => {
                    const folders = this.getFolders();
                    dropdown.addOption("", "— Raiz do Vault —");
                    folders.forEach((folder) => dropdown.addOption(folder, folder));
                    dropdown
                        .setValue(this.plugin.settings.seriesFolder)
                        .onChange((value) => {
                            this.plugin.settings.seriesFolder = value;
                            (async () => {
                                await this.plugin.saveSettings();
                            })();
                        });
                });
        }
    }
}
