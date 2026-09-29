import {
    App,
    Modal,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    TFolder,
    Vault,
    normalizePath,
    requestUrl
} from "obsidian";

interface TmdbPluginSettings {
    tmdbApiKey: string;
    tmdbLanguage: string;
    notesFolder: string;
    movieFolder: string;
    seriesFolder: string;
    separateFolders: boolean;
    openNoteAfterCreation: boolean;
    typeCasing: "lowercase" | "capitalized";
    searchTypeDefault: "multi" | "movie" | "tv";
    customTemplate: string;
}

const DEFAULT_TEMPLATE = `---
titulo: "{{title}}"
tipo: "{{type}}"
ano: "{{year}}"
gênero:
{{genres}}
diretor: "{{director}}"
duracao: "{{runtime}}"
nota_tmdb: {{rating}}
image: "{{poster}}"
banner: "{{banner}}"
lançado: "{{release_date}}"
assistido: false
nota:
tags:
  - {{type}}
---
# Resumo
{{overview}}
`;

const DEFAULT_SETTINGS: TmdbPluginSettings = {
    tmdbApiKey: "",
    tmdbLanguage: "pt-BR",
    notesFolder: "",
    movieFolder: "",
    seriesFolder: "",
    separateFolders: false,
    openNoteAfterCreation: true,
    typeCasing: "lowercase",
    searchTypeDefault: "multi",
    customTemplate: DEFAULT_TEMPLATE,
};

interface TmdbItem {
    id: number;
    title?: string;
    name?: string;
    poster_path?: string;
    backdrop_path?: string;
    release_date?: string;
    first_air_date?: string;
    genre_ids?: number[];
    overview?: string;
    vote_average?: number;
    vote_count?: number;
    media_type?: string;
}

interface TmdbDetails {
    id: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    overview?: string;
    release_date?: string;
    first_air_date?: string;
    runtime?: number;
    episode_run_time?: number[];
    vote_average?: number;
    vote_count?: number;
    poster_path?: string;
    backdrop_path?: string;
    number_of_seasons?: number;
    number_of_episodes?: number;
    status?: string;
    genres?: Array<{ id: number; name: string }>;
    created_by?: Array<{ id: number; name: string }>;
    credits?: {
        cast?: Array<{ id: number; name: string; character: string }>;
        crew?: Array<{ id: number; name: string; job: string; department: string }>;
    };
}

function cleanFileName(str: string): string {
    return str
        .replace(/[\\/:*?"<>|#^]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\.+$/, "");
}

function formatRuntime(minutes?: number): string {
    if (!minutes || minutes <= 0) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
        return `${minutes} min (${hours}h ${mins}m)`;
    } else if (hours > 0) {
        return `${minutes} min (${hours}h)`;
    }
    return `${minutes} min`;
}

function getTmdbGenreName(id: number): string {
    const genres: Record<number, string> = {
        // Filmes & Séries comuns
        16: "Animação",
        35: "Comédia",
        80: "Crime",
        99: "Documentário",
        18: "Drama",
        10751: "Família",
        9648: "Mistério",
        37: "Faroeste",
        // Filmes
        28: "Ação",
        12: "Aventura",
        14: "Fantasia",
        36: "História",
        27: "Terror",
        10402: "Música",
        10749: "Romance",
        878: "Ficção Científica",
        10770: "Cinema TV",
        53: "Thriller",
        10752: "Guerra",
        // Séries (TV)
        10759: "Ação e Aventura",
        10762: "Kids",
        10763: "Notícias",
        10764: "Reality",
        10765: "Ficção Científica e Fantasia",
        10766: "Novela",
        10767: "Talk Show",
        10768: "Guerra e Política",
    };
    return genres[id] || "Outro";
}

export default class TmdbPlugin extends Plugin {
    settings: TmdbPluginSettings;

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon(
            "film",
            "Buscar Filmes e Séries no TMDB",
            () => {
                this.openSearchModal();
            }
        );

        this.addCommand({
            id: "search-tmdb",
            name: "Buscar no TMDB (Filmes e Séries)",
            callback: () => {
                this.openSearchModal();
            },
        });

        // Retrocompatibilidade para quem já utilizava o comando anterior
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
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData || {});
        if (!this.settings.customTemplate) {
            this.settings.customTemplate = DEFAULT_TEMPLATE;
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    applyTemplate(template: string, data: Record<string, string>): string {
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, "g");
            result = result.replace(regex, value);
        }
        return result;
    }

    async ensureFolderExists(folderPath: string): Promise<void> {
        if (!folderPath || folderPath === "/" || folderPath === ".") return;
        const normalized = normalizePath(folderPath);
        const parts = normalized.split("/").filter((p) => p.length > 0);
        let current = "";
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            const file = this.app.vault.getAbstractFileByPath(current);
            if (!file) {
                try {
                    await this.app.vault.createFolder(current);
                } catch {
                    // Pasta já criada concorrentemente ou ignorar
                }
            }
        }
    }
}

class SearchMovieModal extends Modal {
    plugin: TmdbPlugin;
    activeType: "multi" | "movie" | "tv";
    resultsContainer: HTMLElement;

    constructor(app: App, plugin: TmdbPlugin) {
        super(app);
        this.plugin = plugin;
        this.activeType = plugin.settings.searchTypeDefault || "multi";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("tmdb-modal");

        const header = contentEl.createDiv({ cls: "tmdb-modal-header" });
        header.createEl("h2", { text: "Buscar no TMDB", cls: "tmdb-modal-title" });

        const searchBar = header.createDiv({ cls: "tmdb-search-bar" });
        const searchInput = searchBar.createEl("input", {
            type: "text",
            placeholder: "Digite o título do filme ou série...",
            cls: "tmdb-search-input",
        });

        const searchBtn = searchBar.createEl("button", {
            text: "Buscar",
            cls: "mod-cta tmdb-btn-search",
        });

        const filterContainer = header.createDiv({ cls: "tmdb-filters" });
        const filterOptions: Array<{ label: string; value: "multi" | "movie" | "tv" }> = [
            { label: "Todos", value: "multi" },
            { label: "Filmes", value: "movie" },
            { label: "Séries", value: "tv" },
        ];

        const filterButtons: HTMLButtonElement[] = [];

        filterOptions.forEach((opt) => {
            const btn = filterContainer.createEl("button", {
                text: opt.label,
                cls: `tmdb-filter-btn ${this.activeType === opt.value ? "is-active" : ""}`,
            });
            btn.onclick = () => {
                if (this.activeType === opt.value) return;
                this.activeType = opt.value;
                filterButtons.forEach((b) => b.removeClass("is-active"));
                btn.addClass("is-active");

                const q = searchInput.value.trim();
                if (q) {
                    void this.search(q, this.activeType);
                }
            };
            filterButtons.push(btn);
        });

        this.resultsContainer = contentEl.createDiv({ cls: "tmdb-results-container" });
        this.resultsContainer.createDiv({
            cls: "tmdb-status-msg",
            text: "Digite o título e pressione Enter ou clique em Buscar.",
        });

        const triggerSearch = () => {
            const query = searchInput.value.trim();
            if (query) {
                void this.search(query, this.activeType);
            } else {
                new Notice("Por favor, digite o título.");
            }
        };

        searchBtn.onclick = triggerSearch;
        searchInput.onkeydown = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                triggerSearch();
            }
        };

        // Foco automático no campo de pesquisa
        setTimeout(() => searchInput.focus(), 60);
    }

    async search(query: string, type: "multi" | "movie" | "tv") {
        if (!this.plugin.settings.tmdbApiKey) {
            new Notice("Por favor, configure sua chave da API TMDB nas configurações do plugin.");
            return;
        }

        this.resultsContainer.empty();
        const loadingEl = this.resultsContainer.createDiv({ cls: "tmdb-status-msg" });
        loadingEl.createSpan({ cls: "tmdb-spinner" });
        loadingEl.createSpan({ text: "Buscando no TMDB..." });

        const endpoint = type === "multi" ? "search/multi" : `search/${type}`;
        const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${this.plugin.settings.tmdbApiKey}&query=${encodeURIComponent(query)}&language=${this.plugin.settings.tmdbLanguage}`;

        try {
            const response = await requestUrl(url);
            const data = response.json as { results?: TmdbItem[] };
            let results = data.results || [];

            if (type === "multi") {
                results = results.filter((item) => item.media_type === "movie" || item.media_type === "tv");
            } else {
                results.forEach((item) => {
                    item.media_type = type;
                });
            }

            this.displayResults(results, query);
        } catch (error) {
            console.error("TMDB search error:", error);
            this.resultsContainer.empty();
            this.resultsContainer.createDiv({
                cls: "tmdb-status-msg",
                text: "Erro ao buscar dados. Verifique sua chave da API e conexão.",
            });
            new Notice("Erro ao buscar dados no TMDB.");
        }
    }

    displayResults(results: TmdbItem[], query: string) {
        this.resultsContainer.empty();

        if (results.length === 0) {
            this.resultsContainer.createDiv({
                cls: "tmdb-status-msg",
                text: `Nenhum resultado encontrado para "${query}".`,
            });
            return;
        }

        results.forEach((item) => {
            const card = this.resultsContainer.createDiv({ cls: "tmdb-result-card" });
            card.setAttribute("tabindex", "0");

            const mediaType = item.media_type === "tv" ? "tv" : "movie";
            const isMovie = mediaType === "movie";
            const title = item.title || item.name || "Sem Título";
            const releaseYear = (item.release_date || item.first_air_date || "").split("-")[0] || "Desconhecido";

            // Pôster
            if (item.poster_path) {
                card.createEl("img", {
                    cls: "tmdb-poster",
                    attr: {
                        src: `https://image.tmdb.org/t/p/w200${item.poster_path}`,
                        alt: title,
                        loading: "lazy",
                    },
                });
            } else {
                const placeholder = card.createDiv({ cls: "tmdb-poster-placeholder" });
                placeholder.setText("🎬");
            }

            // Conteúdo
            const content = card.createDiv({ cls: "tmdb-card-content" });

            // Cabeçalho: Título + Ano + Badge
            const headerEl = content.createDiv({ cls: "tmdb-card-header" });
            headerEl.createSpan({ cls: "tmdb-card-title", text: title });
            headerEl.createSpan({ cls: "tmdb-card-year", text: `(${releaseYear})` });
            headerEl.createSpan({
                cls: `tmdb-badge ${isMovie ? "tmdb-badge-movie" : "tmdb-badge-tv"}`,
                text: isMovie ? "Filme" : "Série",
            });

            // Metadados: Nota + Gêneros
            const metaEl = content.createDiv({ cls: "tmdb-card-meta" });
            if (item.vote_average && item.vote_average > 0) {
                metaEl.createSpan({
                    cls: "tmdb-rating",
                    text: `⭐ ${item.vote_average.toFixed(1)}`,
                });
            }

            if (item.genre_ids && item.genre_ids.length > 0) {
                const genreNames = item.genre_ids
                    .map((id) => getTmdbGenreName(id))
                    .slice(0, 3)
                    .join(", ");
                metaEl.createSpan({
                    cls: "tmdb-genres",
                    text: genreNames,
                });
            }

            // Sinopse
            const overviewText = item.overview || "Sem sinopse disponível.";
            content.createDiv({
                cls: "tmdb-card-overview",
                text: overviewText,
            });

            const selectItem = () => {
                void this.createNoteForItem(item, mediaType);
            };

            card.onclick = selectItem;
            card.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectItem();
                }
            };
        });
    }

    async createNoteForItem(item: TmdbItem, type: string) {
        const isMovie = type === "movie";
        const initialTitle = item.title || item.name || "Sem Título";

        new Notice(`Obtendo detalhes de "${initialTitle}"...`);

        let details: TmdbDetails | null = null;
        try {
            const detailsUrl = `https://api.themoviedb.org/3/${type}/${item.id}?api_key=${this.plugin.settings.tmdbApiKey}&language=${this.plugin.settings.tmdbLanguage}&append_to_response=credits`;
            const res = await requestUrl(detailsUrl);
            details = res.json as TmdbDetails;
        } catch (e) {
            console.warn("Não foi possível obter detalhes complementares do TMDB, utilizando dados básicos:", e);
        }

        const title = details?.title || details?.name || initialTitle;
        const year = (details?.release_date || details?.first_air_date || item.release_date || item.first_air_date || "").split("-")[0] || "Desconhecido";
        const releaseDate = details?.release_date || details?.first_air_date || item.release_date || item.first_air_date || "Desconhecido";
        const overview = (details?.overview || item.overview || "Nenhuma descrição disponível.").trim();

        // Diretor (Filme) ou Criador / Produtor (Série)
        let director = "";
        if (isMovie) {
            director = details?.credits?.crew
                ?.filter((c) => c.job === "Director")
                ?.map((c) => c.name)
                ?.join(", ") || "";
        } else {
            director = details?.created_by?.map((c) => c.name).join(", ")
                || details?.credits?.crew?.filter((c) => c.job === "Director" || c.job === "Executive Producer")?.slice(0, 2)?.map((c) => c.name)?.join(", ")
                || "";
        }

        // Duração
        let runtime = "";
        if (isMovie && details?.runtime) {
            runtime = formatRuntime(details.runtime);
        } else if (!isMovie && details?.episode_run_time && details.episode_run_time.length > 0) {
            runtime = formatRuntime(details.episode_run_time[0]);
        }

        // Nota TMDB
        const voteAvg = details?.vote_average ?? item.vote_average;
        const rating = voteAvg && voteAvg > 0 ? voteAvg.toFixed(1) : "";

        // Pôster e Banner
        const posterPath = details?.poster_path || item.poster_path || "";
        const poster = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : "";
        const backdropPath = details?.backdrop_path || item.backdrop_path || "";
        const banner = backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : "";

        // Gêneros formatados como lista YAML válida
        let genreNames: string[] = [];
        if (details?.genres && details.genres.length > 0) {
            genreNames = details.genres.map((g) => g.name);
        } else if (item.genre_ids && item.genre_ids.length > 0) {
            genreNames = item.genre_ids.map((id) => getTmdbGenreName(id));
        }
        const genresYaml = genreNames.length > 0
            ? genreNames.map((g) => `  - ${g}`).join("\n")
            : "  - Desconhecido";

        // Tipo com casing consistente (minúsculo por padrão, ex: "filme", ou "Filme")
        const typeValue = this.plugin.settings.typeCasing === "capitalized"
            ? (isMovie ? "Filme" : "Série")
            : (isMovie ? "filme" : "série");

        // Elenco principal
        const cast = details?.credits?.cast?.slice(0, 5).map((c) => c.name).join(", ") || "";

        // Séries específicas
        const seasons = details?.number_of_seasons ? String(details.number_of_seasons) : "";
        const episodes = details?.number_of_episodes ? String(details.number_of_episodes) : "";
        const status = details?.status || "";

        // Preenche o template
        const template = this.plugin.settings.customTemplate?.trim() || DEFAULT_TEMPLATE;
        const fileContent = this.plugin.applyTemplate(template, {
            title: title.replace(/"/g, '\\"'),
            type: typeValue,
            year: year,
            genres: genresYaml,
            director: director.replace(/"/g, '\\"'),
            runtime: runtime,
            rating: rating,
            poster: poster,
            banner: banner,
            release_date: releaseDate,
            overview: overview,
            cast: cast.replace(/"/g, '\\"'),
            seasons: seasons,
            episodes: episodes,
            status: status,
        });

        const fileName = `${cleanFileName(title)} (${year}).md`;
        const folderPath = this.plugin.settings.separateFolders
            ? (isMovie ? this.plugin.settings.movieFolder : this.plugin.settings.seriesFolder)
            : this.plugin.settings.notesFolder;

        const fullPath = folderPath ? normalizePath(`${folderPath}/${fileName}`) : normalizePath(fileName);

        try {
            await this.plugin.ensureFolderExists(folderPath);

            const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
            if (existingFile instanceof TFile) {
                new Notice(`A nota "${fileName}" já existe. Abrindo...`);
                this.close();
                if (this.plugin.settings.openNoteAfterCreation) {
                    await this.app.workspace.getLeaf(false).openFile(existingFile);
                }
                return;
            }

            const newFile = await this.app.vault.create(fullPath, fileContent);
            new Notice(`Nota criada com sucesso: ${fileName}`);
            this.close();

            if (this.plugin.settings.openNoteAfterCreation) {
                await this.app.workspace.getLeaf(false).openFile(newFile);
            }
        } catch (err) {
            new Notice("Erro ao criar a nota. Verifique o console para mais detalhes.");
            console.error("Erro ao criar nota TMDB:", err);
        }
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
        try {
            const files = this.app.vault.getAllLoadedFiles();
            for (const file of files) {
                if (file instanceof TFolder && file.path !== "/") {
                    folders.push(file.path);
                }
            }
        } catch {
            Vault.recurseChildren(this.app.vault.getRoot(), (file) => {
                if (file instanceof TFolder && file.path !== "/") {
                    folders.push(file.path);
                }
            });
        }
        return folders.sort();
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Chave da API TMDB")
            .setDesc("Adicione sua chave de API da TMDB para buscar filmes e séries.")
            .addText((text) =>
                text
                    .setPlaceholder("Insira sua chave de API aqui")
                    .setValue(this.plugin.settings.tmdbApiKey || "")
                    .onChange((value) => {
                        this.plugin.settings.tmdbApiKey = value.trim();
                        void this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Idioma")
            .setDesc("Idioma para os resultados de busca e metadados (ex: pt-BR, en-US).")
            .addText((text) =>
                text
                    .setPlaceholder("pt-BR")
                    .setValue(this.plugin.settings.tmdbLanguage || "pt-BR")
                    .onChange((value) => {
                        this.plugin.settings.tmdbLanguage = value.trim();
                        void this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Padrão de escrita do Tipo (Casing)")
            .setDesc("Formato do valor do campo 'tipo' e das tags geradas.")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("lowercase", "minúsculo (filme / série)")
                    .addOption("capitalized", "Primeira maiúscula (Filme / Série)")
                    .setValue(this.plugin.settings.typeCasing || "lowercase")
                    .onChange((value: "lowercase" | "capitalized") => {
                        this.plugin.settings.typeCasing = value;
                        void this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Filtro padrão de busca")
            .setDesc("Qual filtro deve vir ativo ao abrir a janela de busca.")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("multi", "Todos (Multi-search)")
                    .addOption("movie", "Apenas Filmes")
                    .addOption("tv", "Apenas Séries")
                    .setValue(this.plugin.settings.searchTypeDefault || "multi")
                    .onChange((value: "multi" | "movie" | "tv") => {
                        this.plugin.settings.searchTypeDefault = value;
                        void this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Abrir nota automaticamente")
            .setDesc("Abre a nota recém-criada imediatamente na aba ativa.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.openNoteAfterCreation ?? true)
                    .onChange((value) => {
                        this.plugin.settings.openNoteAfterCreation = value;
                        void this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Pastas separadas por tipo")
            .setDesc("Separar filmes e séries em pastas diferentes.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.separateFolders ?? false)
                    .onChange((value) => {
                        this.plugin.settings.separateFolders = value;
                        void this.plugin.saveSettings().then(() => {
                            this.display();
                        });
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
                        .setValue(this.plugin.settings.notesFolder || "")
                        .onChange((value) => {
                            this.plugin.settings.notesFolder = value;
                            void this.plugin.saveSettings();
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
                        .setValue(this.plugin.settings.movieFolder || "")
                        .onChange((value) => {
                            this.plugin.settings.movieFolder = value;
                            void this.plugin.saveSettings();
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
                        .setValue(this.plugin.settings.seriesFolder || "")
                        .onChange((value) => {
                            this.plugin.settings.seriesFolder = value;
                            void this.plugin.saveSettings();
                        });
                });
        }

        // Customização de Template
        containerEl.createEl("h3", { text: "Modelo da Nota (Template)" });
        const templateDesc = containerEl.createEl("p", {
            cls: "setting-item-description",
            text: "Personalize o conteúdo e os campos da nota. Placeholders disponíveis: {{title}}, {{type}}, {{year}}, {{genres}}, {{director}}, {{runtime}}, {{rating}}, {{poster}}, {{banner}}, {{release_date}}, {{overview}}, {{cast}}, {{seasons}}, {{episodes}}, {{status}}.",
        });
        templateDesc.setCssStyles({ marginBottom: "10px" });

        const templateTextArea = containerEl.createEl("textarea", {
            cls: "tmdb-template-textarea",
        });
        templateTextArea.value = this.plugin.settings.customTemplate || DEFAULT_TEMPLATE;
        templateTextArea.onchange = () => {
            this.plugin.settings.customTemplate = templateTextArea.value;
            void this.plugin.saveSettings();
        };

        new Setting(containerEl)
            .setName("Restaurar modelo padrão")
            .setDesc("Restaura o modelo original de criação de notas.")
            .addButton((btn) =>
                btn
                    .setButtonText("Restaurar Padrão")
                    .setWarning()
                    .onClick(() => {
                        this.plugin.settings.customTemplate = DEFAULT_TEMPLATE;
                        templateTextArea.value = DEFAULT_TEMPLATE;
                        void this.plugin.saveSettings();
                        new Notice("Modelo restaurado para o padrão!");
                    })
            );
    }
}
