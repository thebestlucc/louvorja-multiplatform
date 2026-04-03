use crate::error::AppError;
use rusqlite::Connection;

pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );",
    )?;

    let current_version: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
        [],
        |row| row.get(0),
    )?;

    if current_version < 1 {
        migrate_v1(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (1)", [])?;
    }

    if current_version < 2 {
        migrate_v2(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (2)", [])?;
    }

    if current_version < 3 {
        migrate_v3(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (3)", [])?;
    }

    if current_version < 4 {
        migrate_v4(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (4)", [])?;
    }

    if current_version < 5 {
        migrate_v5(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (5)", [])?;
    }

    if current_version < 6 {
        migrate_v6(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (6)", [])?;
    }

    if current_version < 7 {
        migrate_v7(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (7)", [])?;
    }

    if current_version < 8 {
        migrate_v8(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (8)", [])?;
    }

    if current_version < 9 {
        migrate_v9(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (9)", [])?;
    }

    if current_version < 10 {
        migrate_v10(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (10)", [])?;
    }

    if current_version < 11 {
        migrate_v11(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (11)", [])?;
    }

    if current_version < 12 {
        migrate_v12(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (12)", [])?;
    }

    if current_version < 13 {
        migrate_v13(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (13)", [])?;
    }

    if current_version < 14 {
        migrate_v14(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (14)", [])?;
    }

    if current_version < 15 {
        migrate_v15(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (15)", [])?;
    }

    if current_version < 16 {
        migrate_v16(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (16)", [])?;
    }

    if current_version < 17 {
        migrate_v17(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (17)", [])?;
    }

    if current_version < 18 {
        migrate_v18(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (18)", [])?;
    }

    if current_version < 19 {
        migrate_v19(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (19)", [])?;
    }

    if current_version < 20 {
        migrate_v20(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (20)", [])?;
    }

    if current_version < 21 {
        migrate_v21(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (21)", [])?;
    }

    if current_version < 22 {
        migrate_v22(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (22)", [])?;
    }

    if current_version < 23 {
        migrate_v23(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (23)", [])?;
    }

    if current_version < 24 {
        migrate_v24(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (24)", [])?;
    }

    if current_version < 25 {
        migrate_v25(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (25)", [])?;
    }

    if current_version < 26 {
        migrate_v26(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (26)", [])?;
    }

    if current_version < 27 {
        migrate_v27(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (27)", [])?;
    }

    if current_version < 28 {
        migrate_v28(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (28)", [])?;
    }

    if current_version < 29 {
        migrate_v29(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (29)", [])?;
    }

    // Force v30 check: tables might be missing if a placeholder was run previously
    let v30_missing = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='media_library_categories'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0) == 0;

    if current_version < 30 || v30_missing {
        migrate_v30(conn)?;
        conn.execute("INSERT OR IGNORE INTO schema_version (version) VALUES (30)", [])?;
    }

    if current_version < 31 {
        migrate_v31(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (31)", [])?;
    }

    if current_version < 32 {
        migrate_v32(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (32)", [])?;
    }

    let v33_missing = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='content_sync_packs'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0) == 0;

    if current_version < 33 || v33_missing {
        migrate_v33(conn)?;
        conn.execute("INSERT OR IGNORE INTO schema_version (version) VALUES (33)", [])?;
    }

    if current_version < 34 || v33_missing {
        migrate_v34(conn)?;
        conn.execute("INSERT OR IGNORE INTO schema_version (version) VALUES (34)", [])?;
    }

    if current_version < 35 {
        migrate_v35(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (35)", [])?;
    }

    if current_version < 36 {
        migrate_v36(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (36)", [])?;
    }

    if current_version < 37 {
        migrate_v37(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (37)", [])?;
    }

    if current_version < 38 {
        migrate_v38(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (38)", [])?;
    }

    if current_version < 39 {
        migrate_v39(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (39)", [])?;
    }

    if current_version < 40 {
        migrate_v40(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (40)", [])?;
    }

    if current_version < 41 {
        migrate_v41(conn)?;
        conn.execute("INSERT INTO schema_version (version) VALUES (41)", [])?;
    }

    Ok(())
    }

    fn migrate_v35(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.slides-next.local', 'ArrowRight');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.slides-next.global', 'Alt+Right');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.slides-prev.local', 'ArrowLeft');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.slides-prev.global', 'Alt+Left');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.slides-clear.local', 'Escape');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.display-projector.local', 'F5');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.display-return.local', 'Shift+F5');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.display-black.local', 'b');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.display-black.global', 'Alt+B');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.display-logo.local', 'l');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.display-logo.global', 'Alt+L');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.app-command-palette.local', 'Meta+k');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.app-command-palette.global', 'CmdOrCtrl+Shift+K');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.app-shortcuts-help.local', 'Meta+/');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut.app-shortcuts-help.global', 'Alt+H');
        ",
    )?;
    Ok(())
    }

    fn migrate_v31(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(
        conn,
        "media_library_items",
        "scheduled_date",
        "TEXT",
    )?;
    Ok(())
}

fn migrate_v32(conn: &Connection) -> Result<(), AppError> {
    // Bible data has moved to a dedicated bible.db (separate connection pool).
    // Remove the now-redundant bible tables from the main DB.
    // bible_fts must be dropped before bible_verses (content table dependency).
    conn.execute_batch(
        "DROP TABLE IF EXISTS bible_fts;
         DROP TABLE IF EXISTS bible_verses;
         DROP TABLE IF EXISTS bible_versions;",
    )?;
    Ok(())
}

fn migrate_v30(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS media_library_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            id_language TEXT NOT NULL DEFAULT 'pt'
        );

        CREATE TABLE IF NOT EXISTS media_library_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES media_library_categories(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            thumbnail_path TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_media_library_items_category ON media_library_items(category_id);
        ",
    )?;
    Ok(())
}

fn migrate_v29(conn: &Connection) -> Result<(), AppError> {

    // Recreate hymns_fts triggers with proper category filtering.
    // This fixes "database disk image is malformed" errors caused by undefined behavior 
    // when deleting/updating hymns that were not indexed (category != 'hymnal').
    conn.execute_batch(
        "
        DROP TRIGGER IF EXISTS hymns_ad;
        DROP TRIGGER IF EXISTS hymns_au;

        -- Fix hymns_ad: Only try to delete from FTS if it was indexed
        CREATE TRIGGER hymns_ad
        AFTER DELETE ON hymns
        WHEN OLD.category = 'hymnal'
        BEGIN
            INSERT INTO hymns_fts(hymns_fts, rowid, title, lyrics, author, album)
            VALUES ('delete', OLD.id, OLD.title, COALESCE(OLD.lyrics,''), COALESCE(OLD.author,''), COALESCE(OLD.album,''));
        END;

        -- Fix hymns_au: Only try to delete from FTS if it was indexed
        CREATE TRIGGER hymns_au
        AFTER UPDATE ON hymns
        BEGIN
            -- Delete old version from FTS if it was indexed
            INSERT INTO hymns_fts(hymns_fts, rowid, title, lyrics, author, album)
            SELECT 'delete', OLD.id, OLD.title, COALESCE(OLD.lyrics,''), COALESCE(OLD.author,''), COALESCE(OLD.album,'')
            WHERE OLD.category = 'hymnal';

            -- Insert new version into FTS if it should be indexed
            INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
            SELECT NEW.id, NEW.title, COALESCE(NEW.lyrics,''), COALESCE(NEW.author,''), COALESCE(NEW.album,'')
            WHERE NEW.category = 'hymnal';
        END;
        ",
    )?;
    Ok(())
}

fn migrate_v21(conn: &Connection) -> Result<(), AppError> {
    // We need to drop and recreate collections_fts to add the cover_path column
    // and also rebuild the hymns_fts index to ensure the category filter is correct.
    conn.execute_batch(
        "
        DROP TABLE IF EXISTS collections_fts;
        CREATE VIRTUAL TABLE collections_fts USING fts5(
            entity_type UNINDEXED,
            collection_id UNINDEXED,
            song_id UNINDEXED,
            cover_path UNINDEXED,
            collection_name,
            title,
            description,
            body
        );
        ",
    )?;
    crate::db::queries::collections::rebuild_collections_search_index(conn)?;
    crate::db::queries::music::rebuild_hymns_search_index(conn)?;
    Ok(())
}

fn migrate_v1(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS hymns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number INTEGER,
            title TEXT NOT NULL,
            author TEXT,
            album TEXT,
            lyrics TEXT,
            chords TEXT,
            audio_path TEXT,
            category TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bible_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            abbreviation TEXT NOT NULL UNIQUE,
            language TEXT NOT NULL DEFAULT 'pt',
            file_path TEXT
        );

        CREATE TABLE IF NOT EXISTS bible_verses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id INTEGER NOT NULL REFERENCES bible_versions(id),
            book TEXT NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            text TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS presentations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT,
            aspect_ratio TEXT NOT NULL DEFAULT '16:9',
            file_path TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS slides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            presentation_id INTEGER NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
            slide_index INTEGER NOT NULL,
            slide_type TEXT NOT NULL DEFAULT 'text',
            content TEXT NOT NULL DEFAULT '{}',
            notes TEXT,
            transition TEXT
        );

        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            date TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS service_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            item_type TEXT NOT NULL,
            item_id INTEGER,
            title TEXT NOT NULL,
            item_order INTEGER NOT NULL,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_type TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS monitor_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            monitor_id TEXT NOT NULL,
            role TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_hymns_number ON hymns(number);
        CREATE INDEX IF NOT EXISTS idx_hymns_title ON hymns(title);
        CREATE INDEX IF NOT EXISTS idx_bible_verses_lookup ON bible_verses(version_id, book, chapter, verse);
        CREATE INDEX IF NOT EXISTS idx_slides_presentation ON slides(presentation_id, slide_index);
        CREATE INDEX IF NOT EXISTS idx_service_items_service ON service_items(service_id, item_order);
        CREATE INDEX IF NOT EXISTS idx_favorites_type ON favorites(item_type, item_id);

        -- FTS5 virtual tables
        CREATE VIRTUAL TABLE IF NOT EXISTS hymns_fts USING fts5(
            title, lyrics, author, album, content=hymns, content_rowid=id
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS bible_fts USING fts5(
            text, book, content=bible_verses, content_rowid=id
        );
        "
    )?;

    Ok(())
}

fn migrate_v2(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS audio_sync_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hymn_id INTEGER NOT NULL REFERENCES hymns(id) ON DELETE CASCADE,
            slide_index INTEGER NOT NULL,
            timestamp_ms INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audio_sync_hymn ON audio_sync_points(hymn_id);
        ",
    )?;

    Ok(())
}

fn migrate_v3(conn: &Connection) -> Result<(), AppError> {
    // Check if ARA version already exists
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM bible_versions WHERE abbreviation = 'ARA'",
        [],
        |row| row.get(0),
    )?;
    if count > 0 {
        return Ok(());
    }

    conn.execute(
        "INSERT INTO bible_versions (name, abbreviation, language) VALUES ('Almeida Revista e Atualizada', 'ARA', 'pt')",
        [],
    )?;
    let version_id = conn.last_insert_rowid();

    let mut stmt = conn.prepare(
        "INSERT INTO bible_verses (version_id, book, chapter, verse, text) VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;

    let book = "Gênesis";

    // Genesis 1
    let gen1: &[(i64, &str)] = &[
        (1, "No princípio, criou Deus os céus e a terra."),
        (2, "A terra, porém, estava sem forma e vazia; havia trevas sobre a face do abismo, e o Espírito de Deus pairava por sobre as águas."),
        (3, "Disse Deus: Haja luz; e houve luz."),
        (4, "E viu Deus que a luz era boa; e fez separação entre a luz e as trevas."),
        (5, "Chamou Deus à luz Dia e às trevas, Noite. Houve tarde e manhã, o primeiro dia."),
        (6, "E disse Deus: Haja firmamento no meio das águas e separação entre águas e águas."),
        (7, "Fez, pois, Deus o firmamento e separação entre as águas debaixo do firmamento e as águas sobre o firmamento. E assim se fez."),
        (8, "E chamou Deus ao firmamento Céus. Houve tarde e manhã, o segundo dia."),
        (9, "Disse também Deus: Ajuntem-se as águas debaixo dos céus num só lugar, e apareça a porção seca. E assim se fez."),
        (10, "À porção seca chamou Deus Terra e ao ajuntamento das águas, Mares. E viu Deus que isso era bom."),
        (11, "E disse: Produza a terra relva, ervas que deem semente e árvores frutíferas que deem fruto segundo a sua espécie, cuja semente esteja nele, sobre a terra. E assim se fez."),
        (12, "A terra, pois, produziu relva, ervas que davam semente segundo a sua espécie e árvores que davam fruto, cuja semente estava nele, conforme a sua espécie. E viu Deus que isso era bom."),
        (13, "Houve tarde e manhã, o terceiro dia."),
        (14, "Disse também Deus: Haja luzeiros no firmamento dos céus, para fazerem separação entre o dia e a noite; e sejam eles para sinais, para estações, para dias e anos."),
        (15, "E sejam para luzeiros no firmamento dos céus, para alumiar a terra. E assim se fez."),
        (16, "Fez Deus os dois grandes luzeiros: o maior para governar o dia, e o menor para governar a noite; e fez também as estrelas."),
        (17, "E os colocou no firmamento dos céus para alumiarem a terra,"),
        (18, "para governarem o dia e a noite e fazerem separação entre a luz e as trevas. E viu Deus que isso era bom."),
        (19, "Houve tarde e manhã, o quarto dia."),
        (20, "Disse também Deus: Produzam as águas enxames de seres viventes; e voem as aves sobre a terra, sob o firmamento dos céus."),
        (21, "Criou, pois, Deus os grandes animais marinhos e todos os seres viventes que rastejam, os quais povoavam as águas, segundo as suas espécies; e todas as aves, segundo as suas espécies. E viu Deus que isso era bom."),
        (22, "E Deus os abençoou, dizendo: Sede fecundos, multiplicai-vos e enchei as águas dos mares; e, na terra, se multipliquem as aves."),
        (23, "Houve tarde e manhã, o quinto dia."),
        (24, "Disse também Deus: Produza a terra seres viventes, conforme a sua espécie: animais domésticos, répteis e animais selváticos, segundo a sua espécie. E assim se fez."),
        (25, "E fez Deus os animais selváticos, segundo a sua espécie, e os animais domésticos, conforme a sua espécie, e todos os répteis da terra, conforme a sua espécie. E viu Deus que isso era bom."),
        (26, "Também disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança; tenha ele domínio sobre os peixes do mar, sobre as aves dos céus, sobre os animais domésticos, sobre toda a terra e sobre todos os répteis que rastejam pela terra."),
        (27, "Criou Deus, pois, o homem à sua imagem, à imagem de Deus o criou; homem e mulher os criou."),
        (28, "E Deus os abençoou e lhes disse: Sede fecundos, multiplicai-vos, enchei a terra e sujeitai-a; dominai sobre os peixes do mar, sobre as aves dos céus e sobre todo animal que rasteja pela terra."),
        (29, "E disse Deus ainda: Eis que vos tenho dado todas as ervas que dão semente e se acham na superfície de toda a terra e todas as árvores em que há fruto que dê semente; isso vos será para mantimento."),
        (30, "E a todos os animais da terra, e a todas as aves dos céus, e a todos os répteis da terra, em que há fôlego de vida, toda erva verde lhes será para mantimento. E assim se fez."),
        (31, "Viu Deus tudo quanto fizera, e eis que era muito bom. Houve tarde e manhã, o sexto dia."),
    ];

    for (verse, text) in gen1 {
        stmt.execute(rusqlite::params![version_id, book, 1i64, verse, text])?;
    }

    // Genesis 2
    let gen2: &[(i64, &str)] = &[
        (1, "Assim, pois, foram acabados os céus e a terra e todo o seu exército."),
        (2, "E, havendo Deus terminado no dia sétimo a sua obra, que fizera, descansou nesse dia de toda a sua obra que tinha feito."),
        (3, "E abençoou Deus o dia sétimo e o santificou; porque nele descansou de toda a obra que, como Criador, fizera."),
        (4, "Esta é a gênese dos céus e da terra quando foram criados, quando o SENHOR Deus os criou."),
        (5, "Não havia ainda nenhuma planta do campo na terra, pois nenhuma erva do campo havia ainda brotado; porque o SENHOR Deus não fizera chover sobre a terra, e também não havia homem para lavrar o solo."),
        (6, "Mas uma neblina subia da terra e regava toda a superfície do solo."),
        (7, "Então, formou o SENHOR Deus ao homem do pó da terra e lhe soprou nas narinas o fôlego de vida, e o homem passou a ser alma vivente."),
        (8, "E plantou o SENHOR Deus um jardim no Éden, na direção do Oriente, e pôs nele o homem que havia formado."),
        (9, "Do solo fez o SENHOR Deus brotar toda sorte de árvores agradáveis à vista e boas para alimento; e também a árvore da vida no meio do jardim e a árvore do conhecimento do bem e do mal."),
        (10, "E saía um rio do Éden para regar o jardim e dali se dividia, repartindo-se em quatro braços."),
        (11, "O primeiro chama-se Pisom; é o que rodeia a terra de Havilá, onde há ouro."),
        (12, "O ouro dessa terra é bom; também se encontram lá o bdélio e a pedra de ônix."),
        (13, "O segundo rio chama-se Giom; é o que circunda a terra de Cuxe."),
        (14, "O nome do terceiro rio é Tigre; é o que corre pelo oriente da Assíria. E o quarto rio é o Eufrates."),
        (15, "Tomou, pois, o SENHOR Deus ao homem e o colocou no jardim do Éden para o cultivar e o guardar."),
        (16, "E o SENHOR Deus lhe deu esta ordem: De toda árvore do jardim comerás livremente,"),
        (17, "mas da árvore do conhecimento do bem e do mal não comerás; porque, no dia em que dela comeres, certamente morrerás."),
        (18, "Disse mais o SENHOR Deus: Não é bom que o homem esteja só; far-lhe-ei uma auxiliadora que lhe seja idônea."),
        (19, "Havendo, pois, o SENHOR Deus formado da terra todos os animais do campo e todas as aves dos céus, trouxe-os ao homem, para ver como este lhes chamaria; e o nome que o homem desse a todos os seres viventes, esse seria o nome deles."),
        (20, "Deu nome o homem a todos os animais domésticos, às aves dos céus e a todos os animais selváticos; para o homem, todavia, não se achava uma auxiliadora que lhe fosse idônea."),
        (21, "Então, o SENHOR Deus fez cair pesado sono sobre o homem, e este adormeceu; tomou uma das suas costelas e fechou o lugar com carne."),
        (22, "E a costela que o SENHOR Deus tomara ao homem, transformou-a numa mulher e lha trouxe."),
        (23, "E disse o homem: Esta, afinal, é osso dos meus ossos e carne da minha carne; chamar-se-á varoa, porquanto do varão foi tomada."),
        (24, "Por isso, deixa o homem pai e mãe e se une à sua mulher, tornando-se os dois uma só carne."),
        (25, "Ora, um e outro, o homem e sua mulher, estavam nus e não se envergonhavam."),
    ];

    for (verse, text) in gen2 {
        stmt.execute(rusqlite::params![version_id, book, 2i64, verse, text])?;
    }

    // Genesis 3
    let gen3: &[(i64, &str)] = &[
        (1, "Mas a serpente, mais sagaz que todos os animais selváticos que o SENHOR Deus tinha feito, disse à mulher: É assim que Deus disse: Não comereis de toda árvore do jardim?"),
        (2, "Respondeu-lhe a mulher: Do fruto das árvores do jardim podemos comer,"),
        (3, "mas do fruto da árvore que está no meio do jardim, disse Deus: Dele não comereis, nem tocareis nele, para que não morrais."),
        (4, "Então, a serpente disse à mulher: É certo que não morrereis."),
        (5, "Porque Deus sabe que no dia em que dele comerdes se vos abrirão os olhos e, como Deus, sereis conhecedores do bem e do mal."),
        (6, "Vendo a mulher que a árvore era boa para se comer, agradável aos olhos e árvore desejável para dar entendimento, tomou-lhe do fruto e comeu e deu também ao marido, e ele comeu."),
        (7, "Abriram-se, então, os olhos de ambos e perceberam que estavam nus; coseram folhas de figueira e fizeram cintas para si."),
        (8, "Quando ouviram a voz do SENHOR Deus, que passeava no jardim pela viração do dia, esconderam-se da presença do SENHOR Deus, o homem e sua mulher, por entre as árvores do jardim."),
        (9, "E chamou o SENHOR Deus ao homem e lhe perguntou: Onde estás?"),
        (10, "Ele respondeu: Ouvi a tua voz no jardim, e, porque estava nu, tive medo, e me escondi."),
        (11, "Perguntou-lhe Deus: Quem te fez saber que estavas nu? Comeste da árvore de que te ordenei que não comesses?"),
        (12, "Então, disse o homem: A mulher que me deste por esposa, ela me deu da árvore, e eu comi."),
        (13, "Disse o SENHOR Deus à mulher: Que é isso que fizeste? Respondeu a mulher: A serpente me enganou, e eu comi."),
        (14, "Então, o SENHOR Deus disse à serpente: Visto que isso fizeste, maldita és entre todos os animais domésticos e o és entre todos os animais selváticos; rastejarás sobre o teu ventre e comerás pó todos os dias da tua vida."),
        (15, "Porei inimizade entre ti e a mulher, entre a tua descendência e o seu descendente. Este te ferirá a cabeça, e tu lhe ferirás o calcanhar."),
        (16, "E à mulher disse: Multiplicarei sobremodo os sofrimentos da tua gravidez; em meio de dores darás à luz filhos; o teu desejo será para o teu marido, e ele te governará."),
        (17, "E a Adão disse: Visto que atendeste a voz de tua mulher e comeste da árvore que eu te ordenara não comesses, maldita é a terra por tua causa; em fadigas obterás dela o sustento durante os dias de tua vida."),
        (18, "Ela produzirá também cardos e abrolhos, e tu comerás a erva do campo."),
        (19, "No suor do rosto comerás o teu pão, até que tornes à terra, pois dela foste formado; porque tu és pó e ao pó tornarás."),
        (20, "E deu o homem o nome de Eva a sua mulher, por ser a mãe de todos os seres humanos."),
        (21, "Fez o SENHOR Deus vestimenta de peles para Adão e sua mulher e os vestiu."),
        (22, "Então, disse o SENHOR Deus: Eis que o homem se tornou como um de nós, conhecedor do bem e do mal; assim, que não estenda a mão, e tome também da árvore da vida, e coma, e viva eternamente."),
        (23, "O SENHOR Deus, por isso, o lançou fora do jardim do Éden, para lavrar a terra de que fora tomado."),
        (24, "E, expulso o homem, colocou querubins ao oriente do jardim do Éden e o refulgir de uma espada que se revolvia, para guardar o caminho da árvore da vida."),
    ];

    for (verse, text) in gen3 {
        stmt.execute(rusqlite::params![version_id, book, 3i64, verse, text])?;
    }

    // Rebuild FTS index
    conn.execute_batch(
        "INSERT INTO bible_fts(bible_fts) VALUES('delete-all');
         INSERT INTO bible_fts(rowid, text, book) SELECT id, text, book FROM bible_verses;",
    )?;

    Ok(())
}

fn migrate_v4(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO settings (key, value) VALUES ('streaming.port', '7070');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('streaming.autoStart', 'false');
        ",
    )?;

    Ok(())
}

fn migrate_v5(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO settings (key, value) VALUES ('video.ffprobeEnabled', 'false');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('video.ffprobePath', '');
        ",
    )?;

    Ok(())
}

fn migrate_v6(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO settings (key, value) VALUES ('app.theme', 'azure');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('app.language', 'pt');
        ",
    )?;

    Ok(())
}

fn migrate_v7(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO settings (key, value) VALUES ('timer.alertVolume', '1');
        ",
    )?;

    Ok(())
}

fn migrate_v8(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(conn, "hymns", "cover_path", "TEXT")?;
    add_column_if_missing(
        conn,
        "presentations",
        "library_kind",
        "TEXT NOT NULL DEFAULT 'presentation'",
    )?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            cover_path TEXT,
            auto_cover_path TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS collection_songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            source_path TEXT NOT NULL,
            source_format TEXT NOT NULL,
            source_hash TEXT,
            source_mtime_ms INTEGER,
            cache_presentation_id INTEGER REFERENCES presentations(id) ON DELETE SET NULL,
            sync_status TEXT NOT NULL DEFAULT 'in_sync',
            last_sync_at TEXT,
            item_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
        CREATE INDEX IF NOT EXISTS idx_collection_songs_collection_order ON collection_songs(collection_id, item_order);

        INSERT OR IGNORE INTO settings (key, value) VALUES ('collections.autoCheckSourceOnOpen', 'true');
        UPDATE presentations SET library_kind = 'presentation' WHERE library_kind IS NULL OR library_kind = '';
        ",
    )?;

    Ok(())
}

fn migrate_v9(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(conn, "collections", "year", "INTEGER")?;
    Ok(())
}

fn migrate_v10(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE VIRTUAL TABLE IF NOT EXISTS collections_fts USING fts5(
            entity_type UNINDEXED,
            collection_id UNINDEXED,
            song_id UNINDEXED,
            cover_path UNINDEXED,
            collection_name,
            title,
            description,
            body
        );
        ",
    )?;
    crate::db::queries::collections::rebuild_collections_search_index(conn)?;
    Ok(())
}

fn migrate_v11(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO settings (key, value) VALUES ('projector.default.contentType', 'logo');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('projector.default.text', 'LouvorJA');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('projector.default.mediaPath', '');
        ",
    )?;
    Ok(())
}

fn migrate_v12(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO settings (key, value) VALUES ('projector.logo.imagePath', '');
        ",
    )?;
    Ok(())
}

fn migrate_v13(conn: &Connection) -> Result<(), AppError> {
    // Only run if legacy Delphi-schema tables exist
    if !table_exists(conn, "musics")? {
        return Ok(());
    }

    // Skip if hymns already has data — either already imported or user has their own hymns
    let hymn_count: i64 = conn.query_row("SELECT COUNT(*) FROM hymns", [], |row| row.get(0))?;
    if hymn_count > 0 {
        return Ok(());
    }

    // Import musics + lyrics + albums + files → hymns
    // Legacy schema (from analysis of database.db):
    //   musics(id_music, name, id_file_music, id_language)
    //   albums(id_album, name)
    //   albums_musics(id_album, id_music, track)
    //   categories(id_category, slug)
    //   categories_albums(id_category, id_album, id_language)
    //   lyrics(id_lyric, id_music, lyric, "order", show_slide, id_language)
    //   files(id_file, name, dir)
    conn.execute_batch(
        "
        INSERT INTO hymns (number, title, album, lyrics, audio_path, category)
        SELECT
            am.track,
            m.name,
            a.name,
            (
                SELECT GROUP_CONCAT(l.lyric, char(10) || char(10))
                FROM lyrics l
                WHERE l.id_music = m.id_music
                  AND l.id_language = 'pt'
                ORDER BY l.\"order\"
            ),
            CASE
                WHEN f.dir IS NOT NULL AND f.name IS NOT NULL
                THEN f.dir || '/' || f.name
                ELSE NULL
            END,
            cat.slug
        FROM musics m
        INNER JOIN albums_musics am ON am.id_album = (
            SELECT MIN(id_album) FROM albums_musics WHERE id_music = m.id_music
        ) AND am.id_music = m.id_music
        INNER JOIN albums a ON a.id_album = am.id_album
        LEFT JOIN files f ON f.id_file = m.id_file_music
        LEFT JOIN categories_albums ca ON ca.id_album = a.id_album
            AND ca.id_language = 'pt'
        LEFT JOIN categories cat ON cat.id_category = ca.id_category
        WHERE m.id_language = 'pt'
        ORDER BY am.track;

        INSERT INTO hymns_fts(hymns_fts) VALUES('delete-all');
        INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
        SELECT id, title, COALESCE(lyrics, ''), COALESCE(author, ''), COALESCE(album, '')
        FROM hymns;
    ",
    )?;

    // Import legacy bible data if legacy tables exist and new bible_verses is sparse
    if !table_exists(conn, "bible_verse")?
        || !table_exists(conn, "bible_book")?
        || !table_exists(conn, "bible_version")?
    {
        return Ok(());
    }

    let new_verse_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM bible_verses", [], |row| row.get(0))?;
    // ARA seed (migrate_v3) has ~100 verses; full bible has 31000+.
    // Skip if we already have a substantial bible imported.
    if new_verse_count > 1000 {
        return Ok(());
    }

    conn.execute_batch(
        "
        INSERT OR IGNORE INTO bible_versions (name, abbreviation, language)
        SELECT name, abbreviation, id_language
        FROM bible_version
        WHERE id_language = 'pt';

        INSERT OR IGNORE INTO bible_verses (version_id, book, chapter, verse, text)
        SELECT
            nv.id,
            bb.name,
            bv.chapter,
            bv.verse,
            bv.text
        FROM bible_verse bv
        INNER JOIN bible_version lv ON lv.id_bible_version = bv.id_bible_version
        INNER JOIN bible_book bb ON bb.id_bible_book = bv.id_bible_book
        INNER JOIN bible_versions nv ON nv.abbreviation = lv.abbreviation
        WHERE lv.id_language = 'pt';

        INSERT INTO bible_fts(bible_fts) VALUES('delete-all');
        INSERT INTO bible_fts(rowid, text, book)
        SELECT id, text, book FROM bible_verses;
    ",
    )?;

    Ok(())
}

fn table_exists(conn: &Connection, table: &str) -> Result<bool, AppError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
        rusqlite::params![table],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), AppError> {
    if !column_exists(conn, table, column)? {
        let sql = format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, definition);
        conn.execute(&sql, [])?;
    }
    Ok(())
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool, AppError> {
    let pragma = format!("PRAGMA table_info({})", table);
    let mut stmt = conn.prepare(&pragma)?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>("name"))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(columns.iter().any(|name| name == column))
}
fn migrate_v14(conn: &Connection) -> Result<(), AppError> {
    // Add legacy_file_id column to preserve references to legacy files table
    // This allows resolving audio/image paths from the legacy database
    add_column_if_missing(conn, "hymns", "legacy_file_id", "INTEGER")?;

    // If legacy tables exist and audio_path is populated, try to capture the file IDs
    if table_exists(conn, "musics")? && table_exists(conn, "files")? {
        // Update hymns.legacy_file_id by joining back to legacy data
        // For each hymn, find its corresponding musics.id_file_music
        conn.execute_batch(
            "
            UPDATE hymns
            SET legacy_file_id = (
                SELECT m.id_file_music
                FROM musics m
                WHERE m.name = hymns.title
                  AND m.id_language = 'pt'
                LIMIT 1
            )
            WHERE legacy_file_id IS NULL
              AND audio_path IS NOT NULL;
            ",
        )?;
    }

    Ok(())
}

fn migrate_v15(conn: &Connection) -> Result<(), AppError> {
    // Add playback_path column for instrumental/karaoke audio files
    add_column_if_missing(conn, "hymns", "playback_path", "TEXT")?;

    // Add lyrics_sync column to store synchronized lyrics data (JSON format)
    // Format: [{ "lyric": "...", "order": 0, "time": "00:00:03", "instrumental_time": "00:00:05" }, ...]
    add_column_if_missing(conn, "hymns", "lyrics_sync", "TEXT")?;

    Ok(())
}

fn migrate_v16(conn: &Connection) -> Result<(), AppError> {
    // Create collection_hymns join table for API-imported album ↔ hymn links
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS collection_hymns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            hymn_id INTEGER NOT NULL REFERENCES hymns(id) ON DELETE CASCADE,
            item_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(collection_id, hymn_id)
        );
        CREATE INDEX IF NOT EXISTS idx_collection_hymns_collection ON collection_hymns(collection_id);
        CREATE INDEX IF NOT EXISTS idx_collection_hymns_hymn ON collection_hymns(hymn_id);",
    )?;

    // Extend collections with source_type and api_album_id
    add_column_if_missing(
        conn,
        "collections",
        "source_type",
        "TEXT NOT NULL DEFAULT 'file'",
    )?;
    add_column_if_missing(conn, "collections", "api_album_id", "INTEGER")?;

    // Extend hymns with api_music_id
    add_column_if_missing(conn, "hymns", "api_music_id", "INTEGER")?;

    Ok(())
}

fn migrate_v17(conn: &Connection) -> Result<(), AppError> {
    // Index to speed up filtering API albums from the Hinário tab
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS collection_hymns_hymn_idx ON collection_hymns(hymn_id);",
    )?;
    Ok(())
}

fn migrate_v18(conn: &Connection) -> Result<(), AppError> {
    // 1. Identify all hymns linked to an API-imported collection and mark them as 'album'
    conn.execute_batch(
        "UPDATE hymns SET category = 'album' 
         WHERE id IN (
             SELECT ch.hymn_id FROM collection_hymns ch
             JOIN collections c ON c.id = ch.collection_id
             WHERE c.api_album_id IS NOT NULL
         );",
    )?;

    // 2. Mark everything else as 'hymnal' (the default for the Hinário tab)
    // Also, if they have no album name, give them the default hymnal name
    // to ensure they appear in the Hinário Cards view.
    conn.execute_batch(
        "UPDATE hymns SET category = 'hymnal' WHERE category IS NULL OR category = '';
         UPDATE hymns SET album = 'Hinário Adventista' 
         WHERE category = 'hymnal' AND (album IS NULL OR album = '');",
    )?;

    Ok(())
}

fn migrate_v19(conn: &Connection) -> Result<(), AppError> {
    // Rebuild all FTS indexes to fix desynchronization and include new search documents
    crate::db::queries::music::rebuild_hymns_search_index(conn)?;
    crate::db::queries::collections::rebuild_collections_search_index(conn)?;
    Ok(())
}

fn migrate_v20(conn: &Connection) -> Result<(), AppError> {
    // Rebuild collections FTS to clean up duplicated hymns and improve song indexing
    crate::db::queries::collections::rebuild_collections_search_index(conn)?;
    Ok(())
}

fn migrate_v22(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS schedule_departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT,
            name_pt TEXT,
            name_en TEXT,
            name_es TEXT,
            icon TEXT NOT NULL,
            color TEXT NOT NULL,
            people_per_day INTEGER NOT NULL DEFAULT 1,
            shuffle_on_generate INTEGER NOT NULL DEFAULT 0,
            group_dates_in_print INTEGER NOT NULL DEFAULT 0,
            repeat_members_in_grouped_dates INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_system INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS schedule_department_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            department_id INTEGER NOT NULL REFERENCES schedule_departments(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS schedule_months (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS schedule_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_month_id INTEGER NOT NULL REFERENCES schedule_months(id) ON DELETE CASCADE,
            service_date TEXT NOT NULL,
            label TEXT,
            source_kind TEXT NOT NULL DEFAULT 'manual',
            responsible_department_id INTEGER REFERENCES schedule_departments(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS schedule_day_departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_day_id INTEGER NOT NULL REFERENCES schedule_days(id) ON DELETE CASCADE,
            department_id INTEGER NOT NULL REFERENCES schedule_departments(id) ON DELETE CASCADE,
            people_per_day INTEGER NOT NULL DEFAULT 1,
            manual_override INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS schedule_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_day_department_id INTEGER NOT NULL REFERENCES schedule_day_departments(id) ON DELETE CASCADE,
            member_id INTEGER NOT NULL REFERENCES schedule_department_members(id) ON DELETE CASCADE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_departments_code
            ON schedule_departments(code)
            WHERE code IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_schedule_department_members_department
            ON schedule_department_members(department_id, sort_order);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_months_year_month
            ON schedule_months(year, month);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_days_month_date
            ON schedule_days(schedule_month_id, service_date);
        CREATE INDEX IF NOT EXISTS idx_schedule_days_responsible_department
            ON schedule_days(responsible_department_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_day_departments_unique
            ON schedule_day_departments(schedule_day_id, department_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_day_departments_department
            ON schedule_day_departments(department_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_assignments_unique
            ON schedule_assignments(schedule_day_department_id, member_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_assignments_order
            ON schedule_assignments(schedule_day_department_id, sort_order);
        ",
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO schedule_departments
            (code, name_pt, name_en, name_es, icon, color, people_per_day, sort_order, is_system, is_active)
         VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, 1, 1)",
        rusqlite::params![
            "music",
            "Música",
            "Song",
            "Música",
            "music",
            "#A855F7",
            1,
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO schedule_departments
            (code, name_pt, name_en, name_es, icon, color, people_per_day, sort_order, is_system, is_active)
         VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, 1, 1)",
        rusqlite::params![
            "multimedia",
            "Multimídia / Sonoplastia",
            "Multimedia",
            "Multimedia / Sonido",
            "monitor-play",
            "#2563EB",
            2,
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO schedule_departments
            (code, name_pt, name_en, name_es, icon, color, people_per_day, sort_order, is_system, is_active)
         VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, 1, 1)",
        rusqlite::params![
            "reception",
            "Recepção",
            "Reception",
            "Recepción",
            "handshake",
            "#16A34A",
            3,
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO schedule_departments
            (code, name_pt, name_en, name_es, icon, color, people_per_day, sort_order, is_system, is_active)
         VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, 1, 1)",
        rusqlite::params![
            "deacons",
            "Diáconos",
            "Deacons",
            "Diáconos",
            "shield",
            "#D97706",
            4,
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO schedule_departments
            (code, name_pt, name_en, name_es, icon, color, people_per_day, sort_order, is_system, is_active)
         VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, 1, 1)",
        rusqlite::params![
            "deaconesses",
            "Diaconisas",
            "Deaconesses",
            "Diaconisas",
            "shield-check",
            "#EC4899",
            5,
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO schedule_departments
            (code, name_pt, name_en, name_es, icon, color, people_per_day, sort_order, is_system, is_active)
         VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, 1, 1)",
        rusqlite::params![
            "communication",
            "Comunicação",
            "Communication",
            "Comunicación",
            "megaphone",
            "#DC2626",
            6,
        ],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO schedule_departments
            (code, name_pt, name_en, name_es, icon, color, people_per_day, sort_order, is_system, is_active)
         VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, 1, 1)",
        rusqlite::params![
            "cleaning",
            "Limpeza",
            "Cleaning",
            "Limpieza",
            "sparkles",
            "#0891B2",
            7,
        ],
    )?;

    Ok(())
}

fn migrate_v23(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        -- Auto-sync hymns_fts when hymns are inserted
        CREATE TRIGGER IF NOT EXISTS hymns_ai
        AFTER INSERT ON hymns
        WHEN NEW.category = 'hymnal'
        BEGIN
            INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
            VALUES (NEW.id, NEW.title, COALESCE(NEW.lyrics,''), COALESCE(NEW.author,''), COALESCE(NEW.album,''));
        END;

        -- Auto-sync hymns_fts when hymns are deleted
        CREATE TRIGGER IF NOT EXISTS hymns_ad
        AFTER DELETE ON hymns
        BEGIN
            INSERT INTO hymns_fts(hymns_fts, rowid, title, lyrics, author, album)
            VALUES ('delete', OLD.id, OLD.title, COALESCE(OLD.lyrics,''), COALESCE(OLD.author,''), COALESCE(OLD.album,''));
        END;

        -- Auto-sync hymns_fts when hymns are updated
        CREATE TRIGGER IF NOT EXISTS hymns_au
        AFTER UPDATE ON hymns
        BEGIN
            INSERT INTO hymns_fts(hymns_fts, rowid, title, lyrics, author, album)
            VALUES ('delete', OLD.id, OLD.title, COALESCE(OLD.lyrics,''), COALESCE(OLD.author,''), COALESCE(OLD.album,''));
            INSERT INTO hymns_fts(rowid, title, lyrics, author, album)
            SELECT NEW.id, NEW.title, COALESCE(NEW.lyrics,''), COALESCE(NEW.author,''), COALESCE(NEW.album,'')
            WHERE NEW.category = 'hymnal';
        END;
        ",
    )?;
    // Rebuild index to ensure it's current (handles any previously-missed upserts)
    crate::db::queries::music::rebuild_hymns_search_index(conn)?;
    Ok(())
}

fn migrate_v24(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(
        conn,
        "schedule_departments",
        "shuffle_on_generate",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    Ok(())
}

fn migrate_v25(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(
        conn,
        "schedule_departments",
        "group_dates_in_print",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    Ok(())
}

fn migrate_v26(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(
        conn,
        "schedule_departments",
        "repeat_members_in_grouped_dates",
        "INTEGER NOT NULL DEFAULT 1",
    )?;
    Ok(())
}

fn migrate_v27(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(
        conn,
        "audio_sync_points",
        "instrumental_timestamp_ms",
        "INTEGER",
    )?;
    Ok(())
}

fn migrate_v28(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS content_sync_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            content_version INTEGER,
            last_checked_at TEXT,
            last_synced_at TEXT,
            last_sync_status TEXT,
            last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS content_sync_entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            remote_id INTEGER NOT NULL,
            local_id INTEGER,
            remote_version INTEGER,
            content_hash TEXT,
            lyrics_hash TEXT,
            image_version TEXT,
            audio_version TEXT,
            playback_version TEXT,
            updated_at TEXT,
            deleted INTEGER NOT NULL DEFAULT 0,
            last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_local_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(entity_type, remote_id)
        );
        CREATE INDEX IF NOT EXISTS idx_content_sync_entities_type_remote
            ON content_sync_entities(entity_type, remote_id);

        CREATE TABLE IF NOT EXISTS content_sync_runs (
            id TEXT PRIMARY KEY,
            mode TEXT NOT NULL,
            status TEXT NOT NULL,
            requested_version INTEGER,
            completed_version INTEGER,
            planned_changes_json TEXT,
            result_json TEXT,
            error_json TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            finished_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_content_sync_runs_status_created_at
            ON content_sync_runs(status, created_at DESC);
        ",
    )?;

    Ok(())
}

fn migrate_v33(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS content_sync_packs (
            pack_id     TEXT PRIMARY KEY,
            local_version INTEGER NOT NULL DEFAULT 0,
            extracted_at  TEXT
        );"
    ).map_err(AppError::Database)?;
    Ok(())
}

fn migrate_v34(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(conn, "content_sync_packs", "extracted_version", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "content_sync_packs", "db_version", "INTEGER NOT NULL DEFAULT 0")?;
    Ok(())
}

fn migrate_v37(conn: &Connection) -> Result<(), AppError> {
    // Create FTS5 virtual table for online video playlists
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS online_video_playlists_fts USING fts5(
            title,
            description,
            channel_title,
            tokenize='unicode61 remove_diacritics 1'
        );",
    )?;

    // Populate from existing data
    conn.execute_batch(
        "INSERT OR REPLACE INTO online_video_playlists_fts(rowid, title, description, channel_title)
         SELECT p.id, COALESCE(p.title, ''), COALESCE(p.description, ''), COALESCE(c.title, '')
         FROM online_videos_playlists p
         LEFT JOIN online_videos_channels c ON c.id = p.id_channel;",
    )?;

    // Triggers for auto-maintenance
    conn.execute_batch(
        "CREATE TRIGGER IF NOT EXISTS online_video_playlists_ai
         AFTER INSERT ON online_videos_playlists BEGIN
             INSERT INTO online_video_playlists_fts(rowid, title, description, channel_title)
             VALUES (NEW.id, COALESCE(NEW.title, ''), COALESCE(NEW.description, ''),
                     COALESCE((SELECT title FROM online_videos_channels WHERE id = NEW.id_channel), ''));
         END;

         CREATE TRIGGER IF NOT EXISTS online_video_playlists_ad
         AFTER DELETE ON online_videos_playlists BEGIN
             DELETE FROM online_video_playlists_fts WHERE rowid = OLD.id;
         END;

         CREATE TRIGGER IF NOT EXISTS online_video_playlists_au
         AFTER UPDATE ON online_videos_playlists BEGIN
             DELETE FROM online_video_playlists_fts WHERE rowid = OLD.id;
             INSERT INTO online_video_playlists_fts(rowid, title, description, channel_title)
             VALUES (NEW.id, COALESCE(NEW.title, ''), COALESCE(NEW.description, ''),
                     COALESCE((SELECT title FROM online_videos_channels WHERE id = NEW.id_channel), ''));
         END;",
    )?;

    Ok(())
}

fn migrate_v38(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(conn, "services", "week_day", "INTEGER DEFAULT NULL")?;
    Ok(())
}

fn migrate_v39(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(
        conn,
        "service_items",
        "parent_id",
        "INTEGER REFERENCES service_items(id) ON DELETE SET NULL",
    )?;
    Ok(())
}

fn migrate_v36(conn: &Connection) -> Result<(), AppError> {
    // 1. Create languages table (may not exist on fresh installs)
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS languages (
            id_language VARCHAR PRIMARY KEY NOT NULL,
            language VARCHAR,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO languages (id_language, language) VALUES ('pt', 'Português');
        INSERT OR IGNORE INTO languages (id_language, language) VALUES ('en', 'English');
        INSERT OR IGNORE INTO languages (id_language, language) VALUES ('es', 'Español');
        INSERT OR IGNORE INTO languages (id_language, language) VALUES ('und', 'Undetermined');"
    )?;

    // 2. Create online_videos_channels
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS online_videos_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_language VARCHAR NOT NULL DEFAULT 'und',
            channel_id VARCHAR NOT NULL UNIQUE,
            title VARCHAR,
            description TEXT,
            images TEXT,
            status VARCHAR NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'validated', 'error')),
            playlists TEXT,
            error TEXT,
            base64 TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_language) REFERENCES languages(id_language)
        );"
    )?;

    // 3. Create online_videos_playlists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS online_videos_playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_language VARCHAR NOT NULL DEFAULT 'und',
            id_channel INTEGER,
            playlist_id VARCHAR NOT NULL UNIQUE,
            title VARCHAR,
            description TEXT,
            images TEXT,
            status VARCHAR NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'validated', 'error')),
            error TEXT,
            base64 TEXT,
            cover_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_language) REFERENCES languages(id_language),
            FOREIGN KEY (id_channel) REFERENCES online_videos_channels(id) ON DELETE CASCADE
        );"
    )?;

    // 4. Create online_videos
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS online_videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_language VARCHAR NOT NULL DEFAULT 'und',
            id_playlist INTEGER NOT NULL,
            video_id VARCHAR NOT NULL,
            sequence INTEGER DEFAULT 0,
            title VARCHAR,
            description TEXT,
            images TEXT,
            status VARCHAR NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'validated', 'error')),
            error TEXT,
            local_path TEXT,
            duration_seconds INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(id_playlist, video_id),
            FOREIGN KEY (id_language) REFERENCES languages(id_language),
            FOREIGN KEY (id_playlist) REFERENCES online_videos_playlists(id) ON DELETE CASCADE
        );"
    )?;

    Ok(())
}

fn migrate_v40(conn: &Connection) -> Result<(), AppError> {
    use serde_json::{Map, Value};

    let tx = conn.unchecked_transaction()?;

    let rows: Vec<(i64, String)> = {
        let mut stmt = tx.prepare("SELECT id, content FROM slides")?;
        let rows = stmt
            .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };

    for (id, content_str) in rows {
        let mut obj: Map<String, Value> = match serde_json::from_str(&content_str) {
            Ok(Value::Object(m)) => m,
            _ => continue,
        };

        // Skip already-migrated rows (have both slideType and background keys)
        if obj.contains_key("slideType") && obj.contains_key("background") {
            continue;
        }

        let slide_type = match obj.get("slideType").and_then(|v| v.as_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };

        // Build background object from old flat fields
        let build_background = |obj: &Map<String, Value>| -> Value {
            let color = obj.get("backgroundColor").and_then(|v| v.as_str()).map(|s| s.to_string());
            let image_path = obj.get("backgroundImage").and_then(|v| v.as_str()).map(|s| s.to_string());
            let kind = if image_path.is_some() { "image" } else { "solid" };
            let mut bg = serde_json::Map::new();
            bg.insert("kind".into(), Value::String(kind.into()));
            bg.insert("color".into(), color.map(Value::String).unwrap_or(Value::Null));
            bg.insert("image_path".into(), image_path.map(Value::String).unwrap_or(Value::Null));
            bg.insert("gradient_start".into(), Value::Null);
            bg.insert("gradient_end".into(), Value::Null);
            bg.insert("gradient_angle".into(), Value::Null);
            bg.insert("opacity".into(), Value::Null);
            Value::Object(bg)
        };

        let parse_bible_mode = |mode_str: &str| -> Value {
            let mut alignment = "center".to_string();
            let mut ref_position = "bottom".to_string();
            let mut text_shadow = false;
            let mut gradient: Option<Value> = None;

            for token in mode_str.split_whitespace() {
                match token {
                    "align-left" => alignment = "left".into(),
                    "align-center" => alignment = "center".into(),
                    "align-right" => alignment = "right".into(),
                    "ref-bottom" => ref_position = "bottom".into(),
                    "ref-top" => ref_position = "top".into(),
                    "ref-hidden" => ref_position = "hidden".into(),
                    "text-shadow" => text_shadow = true,
                    t if t.starts_with("gradient-") => {
                        let parts: Vec<&str> = t.splitn(4, '-').collect();
                        // format: gradient-<angle>-<startColor>-<endColor>
                        if parts.len() == 4 {
                            let angle = parts[1].parse::<i64>().unwrap_or(180);
                            let mut g = serde_json::Map::new();
                            g.insert("angle".into(), Value::Number(angle.into()));
                            g.insert("startColor".into(), Value::String(format!("#{}", parts[2])));
                            g.insert("endColor".into(), Value::String(format!("#{}", parts[3])));
                            gradient = Some(Value::Object(g));
                        }
                    }
                    _ => {}
                }
            }

            let mut mode = serde_json::Map::new();
            mode.insert("alignment".into(), Value::String(alignment));
            mode.insert("ref_position".into(), Value::String(ref_position));
            mode.insert("text_shadow".into(), Value::Bool(text_shadow));
            mode.insert("gradient".into(), gradient.unwrap_or(Value::Null));
            Value::Object(mode)
        };

        let new_obj: Map<String, Value> = match slide_type.as_str() {
            "cover" => {
                let mut m = Map::new();
                m.insert("slideType".into(), Value::String("cover".into()));
                m.insert("title".into(), obj.get("title").cloned().unwrap_or(Value::String(String::new())));
                m.insert("subtitle".into(), obj.get("subtitle").cloned().unwrap_or(Value::Null));
                m.insert("background".into(), build_background(&obj));
                m.insert("text_color".into(), obj.get("textColor").cloned().unwrap_or(Value::Null));
                m.insert("text_size".into(), obj.get("textSize").cloned().unwrap_or(Value::Null));
                m
            }
            "lyrics" => {
                let mut m = Map::new();
                m.insert("slideType".into(), Value::String("lyrics".into()));
                m.insert("text".into(), obj.get("text").cloned().unwrap_or(Value::String(String::new())));
                m.insert("label".into(), obj.get("label").cloned().unwrap_or(Value::Null));
                m.insert("background".into(), build_background(&obj));
                m.insert("text_color".into(), obj.get("textColor").cloned().unwrap_or(Value::Null));
                m.insert("text_size".into(), obj.get("textSize").cloned().unwrap_or(Value::Null));
                m
            }
            "text" => {
                let mut m = Map::new();
                m.insert("slideType".into(), Value::String("text".into()));
                m.insert("content".into(), obj.get("text").cloned().unwrap_or(Value::String(String::new())));
                m.insert("background".into(), build_background(&obj));
                m.insert("text_color".into(), obj.get("textColor").cloned().unwrap_or(Value::Null));
                m.insert("text_size".into(), obj.get("textSize").cloned().unwrap_or(Value::Null));
                m
            }
            "image" => {
                let path = obj.get("backgroundImage").cloned().unwrap_or(Value::String(String::new()));
                let fit = obj.get("mode").and_then(|v| v.as_str()).unwrap_or("cover").to_string();
                let mut bg = Map::new();
                bg.insert("kind".into(), Value::String("solid".into()));
                bg.insert("color".into(), obj.get("backgroundColor").cloned().unwrap_or(Value::Null));
                bg.insert("image_path".into(), Value::Null);
                bg.insert("gradient_start".into(), Value::Null);
                bg.insert("gradient_end".into(), Value::Null);
                bg.insert("gradient_angle".into(), Value::Null);
                bg.insert("opacity".into(), Value::Null);
                let mut m = Map::new();
                m.insert("slideType".into(), Value::String("image".into()));
                m.insert("path".into(), path);
                m.insert("caption".into(), obj.get("label").cloned().unwrap_or(Value::Null));
                m.insert("fit".into(), Value::String(fit));
                m.insert("background".into(), Value::Object(bg));
                m
            }
            "video" => {
                let mut m = Map::new();
                m.insert("slideType".into(), Value::String("video".into()));
                m.insert("path".into(), obj.get("videoPath").cloned().unwrap_or(Value::String(String::new())));
                m.insert("auto_play".into(), obj.get("autoPlay").cloned().unwrap_or(Value::Bool(false)));
                m.insert("loop_video".into(), obj.get("loop").cloned().unwrap_or(Value::Bool(false)));
                m.insert("muted".into(), obj.get("muted").cloned().unwrap_or(Value::Bool(false)));
                m.insert("mode".into(), obj.get("mode").cloned().unwrap_or(Value::String("fullscreen".into())));
                m.insert("overlay_text".into(), obj.get("text").cloned().unwrap_or(Value::Null));
                m.insert("audio_path".into(), obj.get("audioPath").cloned().unwrap_or(Value::Null));
                m
            }
            "bible" => {
                let mode_val = match obj.get("mode").and_then(|v| v.as_str()) {
                    Some(s) => parse_bible_mode(s),
                    None => {
                        let mut mode = Map::new();
                        mode.insert("alignment".into(), Value::String("center".into()));
                        mode.insert("ref_position".into(), Value::String("bottom".into()));
                        mode.insert("text_shadow".into(), Value::Bool(false));
                        mode.insert("gradient".into(), Value::Null);
                        Value::Object(mode)
                    }
                };
                let mut m = Map::new();
                m.insert("slideType".into(), Value::String("bible".into()));
                m.insert("reference".into(), obj.get("title").cloned().unwrap_or(Value::String(String::new())));
                m.insert("text".into(), obj.get("text").cloned().unwrap_or(Value::String(String::new())));
                m.insert("mode".into(), mode_val);
                m.insert("background".into(), build_background(&obj));
                m.insert("text_color".into(), obj.get("textColor").cloned().unwrap_or(Value::Null));
                m.insert("text_size".into(), obj.get("textSize").cloned().unwrap_or(Value::Null));
                m
            }
            "online_video" => {
                let source = match obj.get("videoSource").and_then(|v| v.as_str()) {
                    Some("youtube") => "youtube",
                    _ => "local",
                };
                let mut m = Map::new();
                m.insert("slideType".into(), Value::String("onlineVideo".into()));
                m.insert("url".into(), obj.get("videoUrl").cloned().unwrap_or(Value::String(String::new())));
                m.insert("video_id".into(), obj.get("videoId").cloned().unwrap_or(Value::String(String::new())));
                m.insert("source".into(), Value::String(source.into()));
                m.insert("title".into(), obj.get("videoTitle").cloned().unwrap_or(Value::Null));
                m
            }
            "pause" => {
                let mut m = Map::new();
                m.insert("slideType".into(), Value::String("pause".into()));
                m
            }
            _ => continue,
        };

        let new_content = serde_json::to_string(&new_obj)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        tx.execute("UPDATE slides SET content = ?1 WHERE id = ?2", rusqlite::params![new_content, id])?;
    }

    tx.commit()?;
    Ok(())
}

fn migrate_v41(conn: &Connection) -> Result<(), AppError> {
    add_column_if_missing(
        conn,
        "online_videos_playlists",
        "is_custom",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn creates_schedule_schema_and_seeds_departments() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");

        run_migrations(&conn).expect("run migrations");

        for table in [
            "schedule_departments",
            "schedule_department_members",
            "schedule_months",
            "schedule_days",
            "schedule_day_departments",
            "schedule_assignments",
        ] {
            assert!(
                table_exists(&conn, table).expect("table exists"),
                "missing table {table}"
            );
        }

        let schema_version: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .expect("schema version");
        assert_eq!(schema_version, 36);

        for table in ["media_library_categories", "media_library_items"] {
            assert!(
                table_exists(&conn, table).expect("table exists"),
                "missing table {table}"
            );
        }

        for table in [
            "content_sync_state",
            "content_sync_entities",
            "content_sync_runs",
        ] {
            assert!(
                table_exists(&conn, table).expect("table exists"),
                "missing table {table}"
            );
        }

        assert!(
            column_exists(&conn, "audio_sync_points", "instrumental_timestamp_ms",)
                .expect("instrumental_timestamp_ms column exists"),
            "missing instrumental_timestamp_ms column",
        );

        assert!(
            column_exists(&conn, "schedule_departments", "shuffle_on_generate")
                .expect("shuffle_on_generate column exists"),
            "missing shuffle_on_generate column"
        );
        assert!(
            column_exists(&conn, "schedule_departments", "group_dates_in_print")
                .expect("group_dates_in_print column exists"),
            "missing group_dates_in_print column"
        );
        assert!(
            column_exists(
                &conn,
                "schedule_departments",
                "repeat_members_in_grouped_dates"
            )
            .expect("repeat_members_in_grouped_dates column exists"),
            "missing repeat_members_in_grouped_dates column"
        );

        let department_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schedule_departments", [], |row| {
                row.get(0)
            })
            .expect("department count");
        assert_eq!(department_count, 7);

        let schedule_fts_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name LIKE 'schedule%fts%'",
                [],
                |row| row.get(0),
            )
            .expect("schedule fts count");
        assert_eq!(schedule_fts_count, 0);

        assert!(
            table_exists(&conn, "content_sync_packs").expect("content_sync_packs table exists"),
            "missing table content_sync_packs"
        );

        let mut stmt = conn
            .prepare("SELECT code FROM schedule_departments ORDER BY sort_order ASC")
            .expect("prepare seeded department query");
        let codes = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .expect("query seeded departments")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect seeded departments");

        assert_eq!(
            codes,
            vec![
                "music".to_string(),
                "multimedia".to_string(),
                "reception".to_string(),
                "deacons".to_string(),
                "deaconesses".to_string(),
                "communication".to_string(),
                "cleaning".to_string(),
            ]
        );
    }

    // FIXME(nitpick): content_sync_packs_table_created_on_v33 duplicates the smoke test's assertion — consider merging or expanding to verify column schema instead - Test Reviewer, 2026-03-19, Severity: Cosmetic
    #[test]
    fn content_sync_packs_table_created_on_v33() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='content_sync_packs'",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn fresh_migration_chain_stepwise_reaches_v35() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");

        for (version, migration) in [
            (1_i64, migrate_v1 as fn(&Connection) -> Result<(), AppError>),
            (2, migrate_v2),
            (3, migrate_v3),
            (4, migrate_v4),
            (5, migrate_v5),
            (6, migrate_v6),
            (7, migrate_v7),
            (8, migrate_v8),
            (9, migrate_v9),
            (10, migrate_v10),
            (11, migrate_v11),
            (12, migrate_v12),
            (13, migrate_v13),
            (14, migrate_v14),
            (15, migrate_v15),
            (16, migrate_v16),
            (17, migrate_v17),
            (18, migrate_v18),
            (19, migrate_v19),
            (20, migrate_v20),
            (21, migrate_v21),
            (22, migrate_v22),
            (23, migrate_v23),
            (24, migrate_v24),
            (25, migrate_v25),
            (26, migrate_v26),
            (27, migrate_v27),
            (28, migrate_v28),
            (29, migrate_v29),
            (30, migrate_v30),
            (31, migrate_v31),
            (32, migrate_v32),
            (33, migrate_v33),
            (34, migrate_v34),
            (35, migrate_v35),
            (36, migrate_v36),
            (37, migrate_v37),
            (38, migrate_v38),
            (39, migrate_v39),
        ] {
            migration(&conn)
                .unwrap_or_else(|error| panic!("migration v{version} failed: {error:?}"));
        }
    }
}
