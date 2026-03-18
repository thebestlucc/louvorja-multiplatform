Directory structure:
└── louvorja-api/
    ├── README.md
    ├── artisan
    ├── composer.json
    ├── composer.lock
    ├── phpunit.xml
    ├── server.bat
    ├── vscode.bat
    ├── .editorconfig
    ├── .env.example
    ├── .styleci.yml
    ├── app/
    │   ├── Console/
    │   │   ├── Kernel.php
    │   │   └── Commands/
    │   │       └── .gitkeep
    │   ├── Events/
    │   │   ├── Event.php
    │   │   └── ExampleEvent.php
    │   ├── Exceptions/
    │   │   └── Handler.php
    │   ├── Helpers/
    │   │   ├── Configs.php
    │   │   ├── Data.php
    │   │   ├── DataBase.php
    │   │   ├── Files.php
    │   │   ├── Ftp.php
    │   │   ├── OnlineVideos.php
    │   │   ├── Params.php
    │   │   ├── Tables.php
    │   │   └── Validations.php
    │   ├── Http/
    │   │   ├── Controllers/
    │   │   │   ├── AlbumController.php
    │   │   │   ├── AlbumMusicController.php
    │   │   │   ├── AuthController.php
    │   │   │   ├── CategoryAlbumController.php
    │   │   │   ├── CategoryController.php
    │   │   │   ├── ConfigController.php
    │   │   │   ├── Controller.php
    │   │   │   ├── DatabaseJsonController.php
    │   │   │   ├── DownloadController.php
    │   │   │   ├── FileController.php
    │   │   │   ├── FtpController.php
    │   │   │   ├── HymnalController.php
    │   │   │   ├── LanguageController.php
    │   │   │   ├── LyricController.php
    │   │   │   ├── MusicController.php
    │   │   │   ├── OnlineVideosController.php
    │   │   │   ├── ParamsController.php
    │   │   │   ├── PlayerController.php
    │   │   │   ├── TaskController.php
    │   │   │   ├── UserController.php
    │   │   │   └── VersionLogController.php
    │   │   └── Middleware/
    │   │       ├── AccessMiddleware.php
    │   │       ├── ApiMiddleware.php
    │   │       ├── Authenticate.php
    │   │       ├── ConfirmedPasswordMiddleware.php
    │   │       ├── CorsMiddleware.php
    │   │       ├── GeneralMiddleware.php
    │   │       └── LangMiddleware.php
    │   ├── Jobs/
    │   │   ├── ExampleJob.php
    │   │   └── Job.php
    │   ├── Listeners/
    │   │   └── ExampleListener.php
    │   ├── Models/
    │   │   ├── Album.php
    │   │   ├── AlbumMusic.php
    │   │   ├── BaseModel.php
    │   │   ├── BibleBook.php
    │   │   ├── BibleVerse.php
    │   │   ├── BibleVersion.php
    │   │   ├── Category.php
    │   │   ├── CategoryAlbum.php
    │   │   ├── Config.php
    │   │   ├── DownloadLog.php
    │   │   ├── File.php
    │   │   ├── Ftp.php
    │   │   ├── FtpLog.php
    │   │   ├── Language.php
    │   │   ├── Log.php
    │   │   ├── Lyric.php
    │   │   ├── Music.php
    │   │   ├── OnlineVideo.php
    │   │   ├── OnlineVideoChannel.php
    │   │   ├── OnlineVideoPlaylist.php
    │   │   └── User.php
    │   ├── Providers/
    │   │   ├── AppServiceProvider.php
    │   │   ├── AuthServiceProvider.php
    │   │   └── EventServiceProvider.php
    │   └── Services/
    │       ├── TelegramService.php
    │       └── YoutubeService.php
    ├── bootstrap/
    │   └── app.php
    ├── config/
    │   ├── auth.php
    │   ├── database.php
    │   └── jwt.php
    ├── database/
    │   ├── factories/
    │   │   └── UserFactory.php
    │   ├── migrations/
    │   │   ├── 2022_07_17_232239_create_languages_table.php
    │   │   ├── 2022_07_17_232242_create_files_table.php
    │   │   ├── 2022_07_17_232541_create_albums_table.php
    │   │   ├── 2022_07_17_233541_create_categories_table.php
    │   │   ├── 2022_07_17_234427_create_musics_table.php
    │   │   ├── 2022_07_17_235106_create_lyrics_table.php
    │   │   ├── 2022_07_17_235826_create_albums_musics_table.php
    │   │   ├── 2022_07_18_000254_create_categories_albums_table.php
    │   │   ├── 2023_01_06_005513_create_configs_table.php
    │   │   ├── 2023_10_14_231224_create_bible_book_table.php
    │   │   ├── 2023_10_14_234620_create_bible_version_table.php
    │   │   ├── 2023_10_15_144259_create_bible_verse_table.php
    │   │   ├── 2024_08_07_162923_create_users_table.php
    │   │   ├── 2024_08_07_164953_add_admin_user_to_users_table.php
    │   │   ├── 2024_09_19_120917_create_logs_table.php
    │   │   ├── 2025_03_08_221253_create_download_logs_table.php
    │   │   ├── 2025_03_13_143424_create_ftp_table.php
    │   │   ├── 2025_03_13_185423_create_ftp_logs_table.php
    │   │   ├── 2025_03_16_165612_create_online_videos_channels_table.php
    │   │   ├── 2025_03_17_132956_create_online_videos_playlists_table.php
    │   │   ├── 2025_03_17_153425_create_online_videos_table.php
    │   │   └── .gitkeep
    │   └── seeders/
    │       ├── DatabaseSeeder.php
    │       ├── TaskControllerSeeder.php
    │       └── UsersTableSeeder.php
    ├── public/
    │   ├── index.php
    │   ├── robots.txt
    │   └── .htaccess
    ├── resources/
    │   └── views/
    │       └── .gitkeep
    ├── routes/
    │   └── web.php
    └── tests/
        ├── ExampleTest.php
        └── TestCase.php

================================================
FILE: README.md
================================================
# Lumen PHP Framework

[![Build Status](https://travis-ci.org/laravel/lumen-framework.svg)](https://travis-ci.org/laravel/lumen-framework)
[![Total Downloads](https://img.shields.io/packagist/dt/laravel/framework)](https://packagist.org/packages/laravel/lumen-framework)
[![Latest Stable Version](https://img.shields.io/packagist/v/laravel/framework)](https://packagist.org/packages/laravel/lumen-framework)
[![License](https://img.shields.io/packagist/l/laravel/framework)](https://packagist.org/packages/laravel/lumen-framework)

Laravel Lumen is a stunningly fast PHP micro-framework for building web applications with expressive, elegant syntax. We believe development must be an enjoyable, creative experience to be truly fulfilling. Lumen attempts to take the pain out of development by easing common tasks used in the majority of web projects, such as routing, database abstraction, queueing, and caching.

## Official Documentation

Documentation for the framework can be found on the [Lumen website](https://lumen.laravel.com/docs).

## Contributing

Thank you for considering contributing to Lumen! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Security Vulnerabilities

If you discover a security vulnerability within Lumen, please send an e-mail to Taylor Otwell at taylor@laravel.com. All security vulnerabilities will be promptly addressed.

## License

The Lumen framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).



================================================
FILE: artisan
================================================
#!/usr/bin/env php
<?php

use Symfony\Component\Console\Input\ArgvInput;
use Symfony\Component\Console\Output\ConsoleOutput;

/*
|--------------------------------------------------------------------------
| Create The Application
|--------------------------------------------------------------------------
|
| First we need to get an application instance. This creates an instance
| of the application / container and bootstraps the application so it
| is ready to receive HTTP / Console requests from the environment.
|
*/

$app = require __DIR__.'/bootstrap/app.php';

/*
|--------------------------------------------------------------------------
| Run The Artisan Application
|--------------------------------------------------------------------------
|
| When we run the console application, the current CLI command will be
| executed in this console and the response sent back to a terminal
| or another output device for the developers. Here goes nothing!
|
*/

$kernel = $app->make(
    'Illuminate\Contracts\Console\Kernel'
);

exit($kernel->handle(new ArgvInput, new ConsoleOutput));



================================================
FILE: composer.json
================================================
{
    "require": {
        "php": ">=8.1",
        "laravel/lumen-framework": "^10.0",
        "illuminate/database": "^10.49",
        "illuminate/events": "^10.49",
        "illuminate/support": "^10.49",
        "illuminate/auth": "^10.49",
        "illuminate/validation": "^10.49",
        "doctrine/dbal": "^3.10",
        "php-open-source-saver/jwt-auth": "^2.3",
        "firebase/php-jwt": "^7.0",
        "guzzlehttp/guzzle": "^7.10",
        "league/flysystem": "^3.30",
        "james-heinrich/getid3": "^1.9",
        "league/flysystem-ftp": "3.0"
    },
    "autoload": {
        "psr-4": {
            "App\\": "app/"
        }
    }
}



================================================
FILE: composer.lock
================================================
{
    "_readme": [
        "This file locks the dependencies of your project to a known state",
        "Read more about it at https://getcomposer.org/doc/01-basic-usage.md#installing-dependencies",
        "This file is @generated automatically"
    ],
    "content-hash": "86b370d3ec102fbd6cd718c541bd5d47",
    "packages": [
        {
            "name": "brick/math",
            "version": "0.12.3",
            "source": {
                "type": "git",
                "url": "https://github.com/brick/math.git",
                "reference": "866551da34e9a618e64a819ee1e01c20d8a588ba"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/brick/math/zipball/866551da34e9a618e64a819ee1e01c20d8a588ba",
                "reference": "866551da34e9a618e64a819ee1e01c20d8a588ba",
                "shasum": ""
            },
            "require": {
                "php": "^8.1"
            },
            "require-dev": {
                "php-coveralls/php-coveralls": "^2.2",
                "phpunit/phpunit": "^10.1",
                "vimeo/psalm": "6.8.8"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Brick\\Math\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "description": "Arbitrary-precision arithmetic library",
            "keywords": [
                "Arbitrary-precision",
                "BigInteger",
                "BigRational",
                "arithmetic",
                "bigdecimal",
                "bignum",
                "bignumber",
                "brick",
                "decimal",
                "integer",
                "math",
                "mathematics",
                "rational"
            ],
            "support": {
                "issues": "https://github.com/brick/math/issues",
                "source": "https://github.com/brick/math/tree/0.12.3"
            },
            "funding": [
                {
                    "url": "https://github.com/BenMorel",
                    "type": "github"
                }
            ],
            "time": "2025-02-28T13:11:00+00:00"
        },
        {
            "name": "carbonphp/carbon-doctrine-types",
            "version": "2.1.0",
            "source": {
                "type": "git",
                "url": "https://github.com/CarbonPHP/carbon-doctrine-types.git",
                "reference": "99f76ffa36cce3b70a4a6abce41dba15ca2e84cb"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/CarbonPHP/carbon-doctrine-types/zipball/99f76ffa36cce3b70a4a6abce41dba15ca2e84cb",
                "reference": "99f76ffa36cce3b70a4a6abce41dba15ca2e84cb",
                "shasum": ""
            },
            "require": {
                "php": "^7.4 || ^8.0"
            },
            "conflict": {
                "doctrine/dbal": "<3.7.0 || >=4.0.0"
            },
            "require-dev": {
                "doctrine/dbal": "^3.7.0",
                "nesbot/carbon": "^2.71.0 || ^3.0.0",
                "phpunit/phpunit": "^10.3"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Carbon\\Doctrine\\": "src/Carbon/Doctrine/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "KyleKatarn",
                    "email": "kylekatarnls@gmail.com"
                }
            ],
            "description": "Types to use Carbon in Doctrine",
            "keywords": [
                "carbon",
                "date",
                "datetime",
                "doctrine",
                "time"
            ],
            "support": {
                "issues": "https://github.com/CarbonPHP/carbon-doctrine-types/issues",
                "source": "https://github.com/CarbonPHP/carbon-doctrine-types/tree/2.1.0"
            },
            "funding": [
                {
                    "url": "https://github.com/kylekatarnls",
                    "type": "github"
                },
                {
                    "url": "https://opencollective.com/Carbon",
                    "type": "open_collective"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/nesbot/carbon",
                    "type": "tidelift"
                }
            ],
            "time": "2023-12-11T17:09:12+00:00"
        },
        {
            "name": "doctrine/dbal",
            "version": "3.10.4",
            "source": {
                "type": "git",
                "url": "https://github.com/doctrine/dbal.git",
                "reference": "63a46cb5aa6f60991186cc98c1d1b50c09311868"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/doctrine/dbal/zipball/63a46cb5aa6f60991186cc98c1d1b50c09311868",
                "reference": "63a46cb5aa6f60991186cc98c1d1b50c09311868",
                "shasum": ""
            },
            "require": {
                "composer-runtime-api": "^2",
                "doctrine/deprecations": "^0.5.3|^1",
                "doctrine/event-manager": "^1|^2",
                "php": "^7.4 || ^8.0",
                "psr/cache": "^1|^2|^3",
                "psr/log": "^1|^2|^3"
            },
            "conflict": {
                "doctrine/cache": "< 1.11"
            },
            "require-dev": {
                "doctrine/cache": "^1.11|^2.0",
                "doctrine/coding-standard": "14.0.0",
                "fig/log-test": "^1",
                "jetbrains/phpstorm-stubs": "2023.1",
                "phpstan/phpstan": "2.1.30",
                "phpstan/phpstan-strict-rules": "^2",
                "phpunit/phpunit": "9.6.29",
                "slevomat/coding-standard": "8.24.0",
                "squizlabs/php_codesniffer": "4.0.0",
                "symfony/cache": "^5.4|^6.0|^7.0|^8.0",
                "symfony/console": "^4.4|^5.4|^6.0|^7.0|^8.0"
            },
            "suggest": {
                "symfony/console": "For helpful console commands such as SQL execution and import of files."
            },
            "bin": [
                "bin/doctrine-dbal"
            ],
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Doctrine\\DBAL\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Guilherme Blanco",
                    "email": "guilhermeblanco@gmail.com"
                },
                {
                    "name": "Roman Borschel",
                    "email": "roman@code-factory.org"
                },
                {
                    "name": "Benjamin Eberlei",
                    "email": "kontakt@beberlei.de"
                },
                {
                    "name": "Jonathan Wage",
                    "email": "jonwage@gmail.com"
                }
            ],
            "description": "Powerful PHP database abstraction layer (DBAL) with many features for database schema introspection and management.",
            "homepage": "https://www.doctrine-project.org/projects/dbal.html",
            "keywords": [
                "abstraction",
                "database",
                "db2",
                "dbal",
                "mariadb",
                "mssql",
                "mysql",
                "oci8",
                "oracle",
                "pdo",
                "pgsql",
                "postgresql",
                "queryobject",
                "sasql",
                "sql",
                "sqlite",
                "sqlserver",
                "sqlsrv"
            ],
            "support": {
                "issues": "https://github.com/doctrine/dbal/issues",
                "source": "https://github.com/doctrine/dbal/tree/3.10.4"
            },
            "funding": [
                {
                    "url": "https://www.doctrine-project.org/sponsorship.html",
                    "type": "custom"
                },
                {
                    "url": "https://www.patreon.com/phpdoctrine",
                    "type": "patreon"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/doctrine%2Fdbal",
                    "type": "tidelift"
                }
            ],
            "time": "2025-11-29T10:46:08+00:00"
        },
        {
            "name": "doctrine/deprecations",
            "version": "1.1.5",
            "source": {
                "type": "git",
                "url": "https://github.com/doctrine/deprecations.git",
                "reference": "459c2f5dd3d6a4633d3b5f46ee2b1c40f57d3f38"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/doctrine/deprecations/zipball/459c2f5dd3d6a4633d3b5f46ee2b1c40f57d3f38",
                "reference": "459c2f5dd3d6a4633d3b5f46ee2b1c40f57d3f38",
                "shasum": ""
            },
            "require": {
                "php": "^7.1 || ^8.0"
            },
            "conflict": {
                "phpunit/phpunit": "<=7.5 || >=13"
            },
            "require-dev": {
                "doctrine/coding-standard": "^9 || ^12 || ^13",
                "phpstan/phpstan": "1.4.10 || 2.1.11",
                "phpstan/phpstan-phpunit": "^1.0 || ^2",
                "phpunit/phpunit": "^7.5 || ^8.5 || ^9.6 || ^10.5 || ^11.5 || ^12",
                "psr/log": "^1 || ^2 || ^3"
            },
            "suggest": {
                "psr/log": "Allows logging deprecations via PSR-3 logger implementation"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Doctrine\\Deprecations\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "description": "A small layer on top of trigger_error(E_USER_DEPRECATED) or PSR-3 logging with options to disable all deprecations or selectively for packages.",
            "homepage": "https://www.doctrine-project.org/",
            "support": {
                "issues": "https://github.com/doctrine/deprecations/issues",
                "source": "https://github.com/doctrine/deprecations/tree/1.1.5"
            },
            "time": "2025-04-07T20:06:18+00:00"
        },
        {
            "name": "doctrine/event-manager",
            "version": "2.1.0",
            "source": {
                "type": "git",
                "url": "https://github.com/doctrine/event-manager.git",
                "reference": "c07799fcf5ad362050960a0fd068dded40b1e312"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/doctrine/event-manager/zipball/c07799fcf5ad362050960a0fd068dded40b1e312",
                "reference": "c07799fcf5ad362050960a0fd068dded40b1e312",
                "shasum": ""
            },
            "require": {
                "php": "^8.1"
            },
            "conflict": {
                "doctrine/common": "<2.9"
            },
            "require-dev": {
                "doctrine/coding-standard": "^14",
                "phpdocumentor/guides-cli": "^1.4",
                "phpstan/phpstan": "^2.1.32",
                "phpunit/phpunit": "^10.5.58"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Doctrine\\Common\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Guilherme Blanco",
                    "email": "guilhermeblanco@gmail.com"
                },
                {
                    "name": "Roman Borschel",
                    "email": "roman@code-factory.org"
                },
                {
                    "name": "Benjamin Eberlei",
                    "email": "kontakt@beberlei.de"
                },
                {
                    "name": "Jonathan Wage",
                    "email": "jonwage@gmail.com"
                },
                {
                    "name": "Johannes Schmitt",
                    "email": "schmittjoh@gmail.com"
                },
                {
                    "name": "Marco Pivetta",
                    "email": "ocramius@gmail.com"
                }
            ],
            "description": "The Doctrine Event Manager is a simple PHP event system that was built to be used with the various Doctrine projects.",
            "homepage": "https://www.doctrine-project.org/projects/event-manager.html",
            "keywords": [
                "event",
                "event dispatcher",
                "event manager",
                "event system",
                "events"
            ],
            "support": {
                "issues": "https://github.com/doctrine/event-manager/issues",
                "source": "https://github.com/doctrine/event-manager/tree/2.1.0"
            },
            "funding": [
                {
                    "url": "https://www.doctrine-project.org/sponsorship.html",
                    "type": "custom"
                },
                {
                    "url": "https://www.patreon.com/phpdoctrine",
                    "type": "patreon"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/doctrine%2Fevent-manager",
                    "type": "tidelift"
                }
            ],
            "time": "2026-01-17T22:40:21+00:00"
        },
        {
            "name": "doctrine/inflector",
            "version": "2.1.0",
            "source": {
                "type": "git",
                "url": "https://github.com/doctrine/inflector.git",
                "reference": "6d6c96277ea252fc1304627204c3d5e6e15faa3b"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/doctrine/inflector/zipball/6d6c96277ea252fc1304627204c3d5e6e15faa3b",
                "reference": "6d6c96277ea252fc1304627204c3d5e6e15faa3b",
                "shasum": ""
            },
            "require": {
                "php": "^7.2 || ^8.0"
            },
            "require-dev": {
                "doctrine/coding-standard": "^12.0 || ^13.0",
                "phpstan/phpstan": "^1.12 || ^2.0",
                "phpstan/phpstan-phpunit": "^1.4 || ^2.0",
                "phpstan/phpstan-strict-rules": "^1.6 || ^2.0",
                "phpunit/phpunit": "^8.5 || ^12.2"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Doctrine\\Inflector\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Guilherme Blanco",
                    "email": "guilhermeblanco@gmail.com"
                },
                {
                    "name": "Roman Borschel",
                    "email": "roman@code-factory.org"
                },
                {
                    "name": "Benjamin Eberlei",
                    "email": "kontakt@beberlei.de"
                },
                {
                    "name": "Jonathan Wage",
                    "email": "jonwage@gmail.com"
                },
                {
                    "name": "Johannes Schmitt",
                    "email": "schmittjoh@gmail.com"
                }
            ],
            "description": "PHP Doctrine Inflector is a small library that can perform string manipulations with regard to upper/lowercase and singular/plural forms of words.",
            "homepage": "https://www.doctrine-project.org/projects/inflector.html",
            "keywords": [
                "inflection",
                "inflector",
                "lowercase",
                "manipulation",
                "php",
                "plural",
                "singular",
                "strings",
                "uppercase",
                "words"
            ],
            "support": {
                "issues": "https://github.com/doctrine/inflector/issues",
                "source": "https://github.com/doctrine/inflector/tree/2.1.0"
            },
            "funding": [
                {
                    "url": "https://www.doctrine-project.org/sponsorship.html",
                    "type": "custom"
                },
                {
                    "url": "https://www.patreon.com/phpdoctrine",
                    "type": "patreon"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/doctrine%2Finflector",
                    "type": "tidelift"
                }
            ],
            "time": "2025-08-10T19:31:58+00:00"
        },
        {
            "name": "doctrine/lexer",
            "version": "3.0.1",
            "source": {
                "type": "git",
                "url": "https://github.com/doctrine/lexer.git",
                "reference": "31ad66abc0fc9e1a1f2d9bc6a42668d2fbbcd6dd"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/doctrine/lexer/zipball/31ad66abc0fc9e1a1f2d9bc6a42668d2fbbcd6dd",
                "reference": "31ad66abc0fc9e1a1f2d9bc6a42668d2fbbcd6dd",
                "shasum": ""
            },
            "require": {
                "php": "^8.1"
            },
            "require-dev": {
                "doctrine/coding-standard": "^12",
                "phpstan/phpstan": "^1.10",
                "phpunit/phpunit": "^10.5",
                "psalm/plugin-phpunit": "^0.18.3",
                "vimeo/psalm": "^5.21"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Doctrine\\Common\\Lexer\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Guilherme Blanco",
                    "email": "guilhermeblanco@gmail.com"
                },
                {
                    "name": "Roman Borschel",
                    "email": "roman@code-factory.org"
                },
                {
                    "name": "Johannes Schmitt",
                    "email": "schmittjoh@gmail.com"
                }
            ],
            "description": "PHP Doctrine Lexer parser library that can be used in Top-Down, Recursive Descent Parsers.",
            "homepage": "https://www.doctrine-project.org/projects/lexer.html",
            "keywords": [
                "annotations",
                "docblock",
                "lexer",
                "parser",
                "php"
            ],
            "support": {
                "issues": "https://github.com/doctrine/lexer/issues",
                "source": "https://github.com/doctrine/lexer/tree/3.0.1"
            },
            "funding": [
                {
                    "url": "https://www.doctrine-project.org/sponsorship.html",
                    "type": "custom"
                },
                {
                    "url": "https://www.patreon.com/phpdoctrine",
                    "type": "patreon"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/doctrine%2Flexer",
                    "type": "tidelift"
                }
            ],
            "time": "2024-02-05T11:56:58+00:00"
        },
        {
            "name": "dragonmantank/cron-expression",
            "version": "v3.6.0",
            "source": {
                "type": "git",
                "url": "https://github.com/dragonmantank/cron-expression.git",
                "reference": "d61a8a9604ec1f8c3d150d09db6ce98b32675013"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/dragonmantank/cron-expression/zipball/d61a8a9604ec1f8c3d150d09db6ce98b32675013",
                "reference": "d61a8a9604ec1f8c3d150d09db6ce98b32675013",
                "shasum": ""
            },
            "require": {
                "php": "^8.2|^8.3|^8.4|^8.5"
            },
            "replace": {
                "mtdowling/cron-expression": "^1.0"
            },
            "require-dev": {
                "phpstan/extension-installer": "^1.4.3",
                "phpstan/phpstan": "^1.12.32|^2.1.31",
                "phpunit/phpunit": "^8.5.48|^9.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "3.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Cron\\": "src/Cron/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Chris Tankersley",
                    "email": "chris@ctankersley.com",
                    "homepage": "https://github.com/dragonmantank"
                }
            ],
            "description": "CRON for PHP: Calculate the next or previous run date and determine if a CRON expression is due",
            "keywords": [
                "cron",
                "schedule"
            ],
            "support": {
                "issues": "https://github.com/dragonmantank/cron-expression/issues",
                "source": "https://github.com/dragonmantank/cron-expression/tree/v3.6.0"
            },
            "funding": [
                {
                    "url": "https://github.com/dragonmantank",
                    "type": "github"
                }
            ],
            "time": "2025-10-31T18:51:33+00:00"
        },
        {
            "name": "egulias/email-validator",
            "version": "4.0.4",
            "source": {
                "type": "git",
                "url": "https://github.com/egulias/EmailValidator.git",
                "reference": "d42c8731f0624ad6bdc8d3e5e9a4524f68801cfa"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/egulias/EmailValidator/zipball/d42c8731f0624ad6bdc8d3e5e9a4524f68801cfa",
                "reference": "d42c8731f0624ad6bdc8d3e5e9a4524f68801cfa",
                "shasum": ""
            },
            "require": {
                "doctrine/lexer": "^2.0 || ^3.0",
                "php": ">=8.1",
                "symfony/polyfill-intl-idn": "^1.26"
            },
            "require-dev": {
                "phpunit/phpunit": "^10.2",
                "vimeo/psalm": "^5.12"
            },
            "suggest": {
                "ext-intl": "PHP Internationalization Libraries are required to use the SpoofChecking validation"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "4.0.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Egulias\\EmailValidator\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Eduardo Gulias Davis"
                }
            ],
            "description": "A library for validating emails against several RFCs",
            "homepage": "https://github.com/egulias/EmailValidator",
            "keywords": [
                "email",
                "emailvalidation",
                "emailvalidator",
                "validation",
                "validator"
            ],
            "support": {
                "issues": "https://github.com/egulias/EmailValidator/issues",
                "source": "https://github.com/egulias/EmailValidator/tree/4.0.4"
            },
            "funding": [
                {
                    "url": "https://github.com/egulias",
                    "type": "github"
                }
            ],
            "time": "2025-03-06T22:45:56+00:00"
        },
        {
            "name": "firebase/php-jwt",
            "version": "v7.0.2",
            "source": {
                "type": "git",
                "url": "https://github.com/firebase/php-jwt.git",
                "reference": "5645b43af647b6947daac1d0f659dd1fbe8d3b65"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/firebase/php-jwt/zipball/5645b43af647b6947daac1d0f659dd1fbe8d3b65",
                "reference": "5645b43af647b6947daac1d0f659dd1fbe8d3b65",
                "shasum": ""
            },
            "require": {
                "php": "^8.0"
            },
            "require-dev": {
                "guzzlehttp/guzzle": "^7.4",
                "phpspec/prophecy-phpunit": "^2.0",
                "phpunit/phpunit": "^9.5",
                "psr/cache": "^2.0||^3.0",
                "psr/http-client": "^1.0",
                "psr/http-factory": "^1.0"
            },
            "suggest": {
                "ext-sodium": "Support EdDSA (Ed25519) signatures",
                "paragonie/sodium_compat": "Support EdDSA (Ed25519) signatures when libsodium is not present"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Firebase\\JWT\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "BSD-3-Clause"
            ],
            "authors": [
                {
                    "name": "Neuman Vong",
                    "email": "neuman+pear@twilio.com",
                    "role": "Developer"
                },
                {
                    "name": "Anant Narayanan",
                    "email": "anant@php.net",
                    "role": "Developer"
                }
            ],
            "description": "A simple library to encode and decode JSON Web Tokens (JWT) in PHP. Should conform to the current spec.",
            "homepage": "https://github.com/firebase/php-jwt",
            "keywords": [
                "jwt",
                "php"
            ],
            "support": {
                "issues": "https://github.com/firebase/php-jwt/issues",
                "source": "https://github.com/firebase/php-jwt/tree/v7.0.2"
            },
            "time": "2025-12-16T22:17:28+00:00"
        },
        {
            "name": "fruitcake/php-cors",
            "version": "v1.4.0",
            "source": {
                "type": "git",
                "url": "https://github.com/fruitcake/php-cors.git",
                "reference": "38aaa6c3fd4c157ffe2a4d10aa8b9b16ba8de379"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/fruitcake/php-cors/zipball/38aaa6c3fd4c157ffe2a4d10aa8b9b16ba8de379",
                "reference": "38aaa6c3fd4c157ffe2a4d10aa8b9b16ba8de379",
                "shasum": ""
            },
            "require": {
                "php": "^8.1",
                "symfony/http-foundation": "^5.4|^6.4|^7.3|^8"
            },
            "require-dev": {
                "phpstan/phpstan": "^2",
                "phpunit/phpunit": "^9",
                "squizlabs/php_codesniffer": "^4"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "1.3-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Fruitcake\\Cors\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fruitcake",
                    "homepage": "https://fruitcake.nl"
                },
                {
                    "name": "Barryvdh",
                    "email": "barryvdh@gmail.com"
                }
            ],
            "description": "Cross-origin resource sharing library for the Symfony HttpFoundation",
            "homepage": "https://github.com/fruitcake/php-cors",
            "keywords": [
                "cors",
                "laravel",
                "symfony"
            ],
            "support": {
                "issues": "https://github.com/fruitcake/php-cors/issues",
                "source": "https://github.com/fruitcake/php-cors/tree/v1.4.0"
            },
            "funding": [
                {
                    "url": "https://fruitcake.nl",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/barryvdh",
                    "type": "github"
                }
            ],
            "time": "2025-12-03T09:33:47+00:00"
        },
        {
            "name": "graham-campbell/result-type",
            "version": "v1.1.4",
            "source": {
                "type": "git",
                "url": "https://github.com/GrahamCampbell/Result-Type.git",
                "reference": "e01f4a821471308ba86aa202fed6698b6b695e3b"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/GrahamCampbell/Result-Type/zipball/e01f4a821471308ba86aa202fed6698b6b695e3b",
                "reference": "e01f4a821471308ba86aa202fed6698b6b695e3b",
                "shasum": ""
            },
            "require": {
                "php": "^7.2.5 || ^8.0",
                "phpoption/phpoption": "^1.9.5"
            },
            "require-dev": {
                "phpunit/phpunit": "^8.5.41 || ^9.6.22 || ^10.5.45 || ^11.5.7"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "GrahamCampbell\\ResultType\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Graham Campbell",
                    "email": "hello@gjcampbell.co.uk",
                    "homepage": "https://github.com/GrahamCampbell"
                }
            ],
            "description": "An Implementation Of The Result Type",
            "keywords": [
                "Graham Campbell",
                "GrahamCampbell",
                "Result Type",
                "Result-Type",
                "result"
            ],
            "support": {
                "issues": "https://github.com/GrahamCampbell/Result-Type/issues",
                "source": "https://github.com/GrahamCampbell/Result-Type/tree/v1.1.4"
            },
            "funding": [
                {
                    "url": "https://github.com/GrahamCampbell",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/graham-campbell/result-type",
                    "type": "tidelift"
                }
            ],
            "time": "2025-12-27T19:43:20+00:00"
        },
        {
            "name": "guzzlehttp/guzzle",
            "version": "7.10.0",
            "source": {
                "type": "git",
                "url": "https://github.com/guzzle/guzzle.git",
                "reference": "b51ac707cfa420b7bfd4e4d5e510ba8008e822b4"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/guzzle/guzzle/zipball/b51ac707cfa420b7bfd4e4d5e510ba8008e822b4",
                "reference": "b51ac707cfa420b7bfd4e4d5e510ba8008e822b4",
                "shasum": ""
            },
            "require": {
                "ext-json": "*",
                "guzzlehttp/promises": "^2.3",
                "guzzlehttp/psr7": "^2.8",
                "php": "^7.2.5 || ^8.0",
                "psr/http-client": "^1.0",
                "symfony/deprecation-contracts": "^2.2 || ^3.0"
            },
            "provide": {
                "psr/http-client-implementation": "1.0"
            },
            "require-dev": {
                "bamarni/composer-bin-plugin": "^1.8.2",
                "ext-curl": "*",
                "guzzle/client-integration-tests": "3.0.2",
                "php-http/message-factory": "^1.1",
                "phpunit/phpunit": "^8.5.39 || ^9.6.20",
                "psr/log": "^1.1 || ^2.0 || ^3.0"
            },
            "suggest": {
                "ext-curl": "Required for CURL handler support",
                "ext-intl": "Required for Internationalized Domain Name (IDN) support",
                "psr/log": "Required for using the Log middleware"
            },
            "type": "library",
            "extra": {
                "bamarni-bin": {
                    "bin-links": true,
                    "forward-command": false
                }
            },
            "autoload": {
                "files": [
                    "src/functions_include.php"
                ],
                "psr-4": {
                    "GuzzleHttp\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Graham Campbell",
                    "email": "hello@gjcampbell.co.uk",
                    "homepage": "https://github.com/GrahamCampbell"
                },
                {
                    "name": "Michael Dowling",
                    "email": "mtdowling@gmail.com",
                    "homepage": "https://github.com/mtdowling"
                },
                {
                    "name": "Jeremy Lindblom",
                    "email": "jeremeamia@gmail.com",
                    "homepage": "https://github.com/jeremeamia"
                },
                {
                    "name": "George Mponos",
                    "email": "gmponos@gmail.com",
                    "homepage": "https://github.com/gmponos"
                },
                {
                    "name": "Tobias Nyholm",
                    "email": "tobias.nyholm@gmail.com",
                    "homepage": "https://github.com/Nyholm"
                },
                {
                    "name": "Márk Sági-Kazár",
                    "email": "mark.sagikazar@gmail.com",
                    "homepage": "https://github.com/sagikazarmark"
                },
                {
                    "name": "Tobias Schultze",
                    "email": "webmaster@tubo-world.de",
                    "homepage": "https://github.com/Tobion"
                }
            ],
            "description": "Guzzle is a PHP HTTP client library",
            "keywords": [
                "client",
                "curl",
                "framework",
                "http",
                "http client",
                "psr-18",
                "psr-7",
                "rest",
                "web service"
            ],
            "support": {
                "issues": "https://github.com/guzzle/guzzle/issues",
                "source": "https://github.com/guzzle/guzzle/tree/7.10.0"
            },
            "funding": [
                {
                    "url": "https://github.com/GrahamCampbell",
                    "type": "github"
                },
                {
                    "url": "https://github.com/Nyholm",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/guzzlehttp/guzzle",
                    "type": "tidelift"
                }
            ],
            "time": "2025-08-23T22:36:01+00:00"
        },
        {
            "name": "guzzlehttp/promises",
            "version": "2.3.0",
            "source": {
                "type": "git",
                "url": "https://github.com/guzzle/promises.git",
                "reference": "481557b130ef3790cf82b713667b43030dc9c957"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/guzzle/promises/zipball/481557b130ef3790cf82b713667b43030dc9c957",
                "reference": "481557b130ef3790cf82b713667b43030dc9c957",
                "shasum": ""
            },
            "require": {
                "php": "^7.2.5 || ^8.0"
            },
            "require-dev": {
                "bamarni/composer-bin-plugin": "^1.8.2",
                "phpunit/phpunit": "^8.5.44 || ^9.6.25"
            },
            "type": "library",
            "extra": {
                "bamarni-bin": {
                    "bin-links": true,
                    "forward-command": false
                }
            },
            "autoload": {
                "psr-4": {
                    "GuzzleHttp\\Promise\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Graham Campbell",
                    "email": "hello@gjcampbell.co.uk",
                    "homepage": "https://github.com/GrahamCampbell"
                },
                {
                    "name": "Michael Dowling",
                    "email": "mtdowling@gmail.com",
                    "homepage": "https://github.com/mtdowling"
                },
                {
                    "name": "Tobias Nyholm",
                    "email": "tobias.nyholm@gmail.com",
                    "homepage": "https://github.com/Nyholm"
                },
                {
                    "name": "Tobias Schultze",
                    "email": "webmaster@tubo-world.de",
                    "homepage": "https://github.com/Tobion"
                }
            ],
            "description": "Guzzle promises library",
            "keywords": [
                "promise"
            ],
            "support": {
                "issues": "https://github.com/guzzle/promises/issues",
                "source": "https://github.com/guzzle/promises/tree/2.3.0"
            },
            "funding": [
                {
                    "url": "https://github.com/GrahamCampbell",
                    "type": "github"
                },
                {
                    "url": "https://github.com/Nyholm",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/guzzlehttp/promises",
                    "type": "tidelift"
                }
            ],
            "time": "2025-08-22T14:34:08+00:00"
        },
        {
            "name": "guzzlehttp/psr7",
            "version": "2.8.0",
            "source": {
                "type": "git",
                "url": "https://github.com/guzzle/psr7.git",
                "reference": "21dc724a0583619cd1652f673303492272778051"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/guzzle/psr7/zipball/21dc724a0583619cd1652f673303492272778051",
                "reference": "21dc724a0583619cd1652f673303492272778051",
                "shasum": ""
            },
            "require": {
                "php": "^7.2.5 || ^8.0",
                "psr/http-factory": "^1.0",
                "psr/http-message": "^1.1 || ^2.0",
                "ralouphie/getallheaders": "^3.0"
            },
            "provide": {
                "psr/http-factory-implementation": "1.0",
                "psr/http-message-implementation": "1.0"
            },
            "require-dev": {
                "bamarni/composer-bin-plugin": "^1.8.2",
                "http-interop/http-factory-tests": "0.9.0",
                "phpunit/phpunit": "^8.5.44 || ^9.6.25"
            },
            "suggest": {
                "laminas/laminas-httphandlerrunner": "Emit PSR-7 responses"
            },
            "type": "library",
            "extra": {
                "bamarni-bin": {
                    "bin-links": true,
                    "forward-command": false
                }
            },
            "autoload": {
                "psr-4": {
                    "GuzzleHttp\\Psr7\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Graham Campbell",
                    "email": "hello@gjcampbell.co.uk",
                    "homepage": "https://github.com/GrahamCampbell"
                },
                {
                    "name": "Michael Dowling",
                    "email": "mtdowling@gmail.com",
                    "homepage": "https://github.com/mtdowling"
                },
                {
                    "name": "George Mponos",
                    "email": "gmponos@gmail.com",
                    "homepage": "https://github.com/gmponos"
                },
                {
                    "name": "Tobias Nyholm",
                    "email": "tobias.nyholm@gmail.com",
                    "homepage": "https://github.com/Nyholm"
                },
                {
                    "name": "Márk Sági-Kazár",
                    "email": "mark.sagikazar@gmail.com",
                    "homepage": "https://github.com/sagikazarmark"
                },
                {
                    "name": "Tobias Schultze",
                    "email": "webmaster@tubo-world.de",
                    "homepage": "https://github.com/Tobion"
                },
                {
                    "name": "Márk Sági-Kazár",
                    "email": "mark.sagikazar@gmail.com",
                    "homepage": "https://sagikazarmark.hu"
                }
            ],
            "description": "PSR-7 message implementation that also provides common utility methods",
            "keywords": [
                "http",
                "message",
                "psr-7",
                "request",
                "response",
                "stream",
                "uri",
                "url"
            ],
            "support": {
                "issues": "https://github.com/guzzle/psr7/issues",
                "source": "https://github.com/guzzle/psr7/tree/2.8.0"
            },
            "funding": [
                {
                    "url": "https://github.com/GrahamCampbell",
                    "type": "github"
                },
                {
                    "url": "https://github.com/Nyholm",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/guzzlehttp/psr7",
                    "type": "tidelift"
                }
            ],
            "time": "2025-08-23T21:21:41+00:00"
        },
        {
            "name": "guzzlehttp/uri-template",
            "version": "v1.0.5",
            "source": {
                "type": "git",
                "url": "https://github.com/guzzle/uri-template.git",
                "reference": "4f4bbd4e7172148801e76e3decc1e559bdee34e1"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/guzzle/uri-template/zipball/4f4bbd4e7172148801e76e3decc1e559bdee34e1",
                "reference": "4f4bbd4e7172148801e76e3decc1e559bdee34e1",
                "shasum": ""
            },
            "require": {
                "php": "^7.2.5 || ^8.0",
                "symfony/polyfill-php80": "^1.24"
            },
            "require-dev": {
                "bamarni/composer-bin-plugin": "^1.8.2",
                "phpunit/phpunit": "^8.5.44 || ^9.6.25",
                "uri-template/tests": "1.0.0"
            },
            "type": "library",
            "extra": {
                "bamarni-bin": {
                    "bin-links": true,
                    "forward-command": false
                }
            },
            "autoload": {
                "psr-4": {
                    "GuzzleHttp\\UriTemplate\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Graham Campbell",
                    "email": "hello@gjcampbell.co.uk",
                    "homepage": "https://github.com/GrahamCampbell"
                },
                {
                    "name": "Michael Dowling",
                    "email": "mtdowling@gmail.com",
                    "homepage": "https://github.com/mtdowling"
                },
                {
                    "name": "George Mponos",
                    "email": "gmponos@gmail.com",
                    "homepage": "https://github.com/gmponos"
                },
                {
                    "name": "Tobias Nyholm",
                    "email": "tobias.nyholm@gmail.com",
                    "homepage": "https://github.com/Nyholm"
                }
            ],
            "description": "A polyfill class for uri_template of PHP",
            "keywords": [
                "guzzlehttp",
                "uri-template"
            ],
            "support": {
                "issues": "https://github.com/guzzle/uri-template/issues",
                "source": "https://github.com/guzzle/uri-template/tree/v1.0.5"
            },
            "funding": [
                {
                    "url": "https://github.com/GrahamCampbell",
                    "type": "github"
                },
                {
                    "url": "https://github.com/Nyholm",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/guzzlehttp/uri-template",
                    "type": "tidelift"
                }
            ],
            "time": "2025-08-22T14:27:06+00:00"
        },
        {
            "name": "illuminate/auth",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/auth.git",
                "reference": "89e184e33ed4e0f7e1e2b87c38983f43ecc54050"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/auth/zipball/89e184e33ed4e0f7e1e2b87c38983f43ecc54050",
                "reference": "89e184e33ed4e0f7e1e2b87c38983f43ecc54050",
                "shasum": ""
            },
            "require": {
                "ext-hash": "*",
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/http": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/queue": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "suggest": {
                "illuminate/console": "Required to use the auth:clear-resets command (^10.0).",
                "illuminate/queue": "Required to fire login / logout events (^10.0).",
                "illuminate/session": "Required to use the session based guard (^10.0)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Auth\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Auth package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/broadcasting",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/broadcasting.git",
                "reference": "53789bddc7c707e65c649be3ca9bb85df7bb9655"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/broadcasting/zipball/53789bddc7c707e65c649be3ca9bb85df7bb9655",
                "reference": "53789bddc7c707e65c649be3ca9bb85df7bb9655",
                "shasum": ""
            },
            "require": {
                "illuminate/bus": "^10.0",
                "illuminate/collections": "^10.0",
                "illuminate/container": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/queue": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1",
                "psr/log": "^1.0|^2.0|^3.0"
            },
            "suggest": {
                "ably/ably-php": "Required to use the Ably broadcast driver (^1.0).",
                "ext-hash": "Required to use the Ably and Pusher broadcast drivers.",
                "pusher/pusher-php-server": "Required to use the Pusher broadcast driver (^6.0|^7.0)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Broadcasting\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Broadcasting package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/bus",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/bus.git",
                "reference": "053f902d546d719c3f2752f7d3805a466e317312"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/bus/zipball/053f902d546d719c3f2752f7d3805a466e317312",
                "reference": "053f902d546d719c3f2752f7d3805a466e317312",
                "shasum": ""
            },
            "require": {
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/pipeline": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "suggest": {
                "illuminate/queue": "Required to use closures when chaining jobs (^7.0)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Bus\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Bus package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/cache",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/cache.git",
                "reference": "20f36c3209107ee5c8c646f88a0562a2c1b05a6c"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/cache/zipball/20f36c3209107ee5c8c646f88a0562a2c1b05a6c",
                "reference": "20f36c3209107ee5c8c646f88a0562a2c1b05a6c",
                "shasum": ""
            },
            "require": {
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "provide": {
                "psr/simple-cache-implementation": "1.0|2.0|3.0"
            },
            "suggest": {
                "ext-apcu": "Required to use the APC cache driver.",
                "ext-filter": "Required to use the DynamoDb cache driver.",
                "ext-memcached": "Required to use the memcache cache driver.",
                "illuminate/database": "Required to use the database cache driver (^10.0).",
                "illuminate/filesystem": "Required to use the file cache driver (^10.0).",
                "illuminate/redis": "Required to use the redis cache driver (^10.0).",
                "symfony/cache": "Required to use PSR-6 cache bridge (^6.2)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Cache\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Cache package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2024-11-21T14:02:44+00:00"
        },
        {
            "name": "illuminate/collections",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/collections.git",
                "reference": "6ae9c74fa92d4e1824d1b346cd435e8eacdc3232"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/collections/zipball/6ae9c74fa92d4e1824d1b346cd435e8eacdc3232",
                "reference": "6ae9c74fa92d4e1824d1b346cd435e8eacdc3232",
                "shasum": ""
            },
            "require": {
                "illuminate/conditionable": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/macroable": "^10.0",
                "php": "^8.1"
            },
            "suggest": {
                "symfony/var-dumper": "Required to use the dump method (^6.2)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "files": [
                    "helpers.php"
                ],
                "psr-4": {
                    "Illuminate\\Support\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Collections package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-09-08T19:05:53+00:00"
        },
        {
            "name": "illuminate/conditionable",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/conditionable.git",
                "reference": "47c700320b7a419f0d188d111f3bbed978fcbd3f"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/conditionable/zipball/47c700320b7a419f0d188d111f3bbed978fcbd3f",
                "reference": "47c700320b7a419f0d188d111f3bbed978fcbd3f",
                "shasum": ""
            },
            "require": {
                "php": "^8.0.2"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Support\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Conditionable package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/config",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/config.git",
                "reference": "d5e83ceff5c4d5607b1b81763eb4c436911c35da"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/config/zipball/d5e83ceff5c4d5607b1b81763eb4c436911c35da",
                "reference": "d5e83ceff5c4d5607b1b81763eb4c436911c35da",
                "shasum": ""
            },
            "require": {
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Config\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Config package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2022-08-21T15:47:27+00:00"
        },
        {
            "name": "illuminate/console",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/console.git",
                "reference": "d4d9fbdbbe4e1d881669fe6e3d6c71d86573b410"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/console/zipball/d4d9fbdbbe4e1d881669fe6e3d6c71d86573b410",
                "reference": "d4d9fbdbbe4e1d881669fe6e3d6c71d86573b410",
                "shasum": ""
            },
            "require": {
                "ext-mbstring": "*",
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/support": "^10.0",
                "illuminate/view": "^10.0",
                "laravel/prompts": "^0.1.9",
                "nunomaduro/termwind": "^1.13",
                "php": "^8.1",
                "symfony/console": "^6.2",
                "symfony/process": "^6.2"
            },
            "suggest": {
                "dragonmantank/cron-expression": "Required to use scheduler (^3.3.2).",
                "ext-pcntl": "Required to use signal trapping.",
                "guzzlehttp/guzzle": "Required to use the ping methods on schedules (^7.5).",
                "illuminate/bus": "Required to use the scheduled job dispatcher (^10.0).",
                "illuminate/container": "Required to use the scheduler (^10.0).",
                "illuminate/filesystem": "Required to use the generator command (^10.0).",
                "illuminate/queue": "Required to use closures for scheduled jobs (^10.0)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Console\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Console package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/container",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/container.git",
                "reference": "b4956de5de18524c21ef36221a8ffd7fa3b534db"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/container/zipball/b4956de5de18524c21ef36221a8ffd7fa3b534db",
                "reference": "b4956de5de18524c21ef36221a8ffd7fa3b534db",
                "shasum": ""
            },
            "require": {
                "illuminate/contracts": "^10.0",
                "php": "^8.1",
                "psr/container": "^1.1.1|^2.0.1"
            },
            "provide": {
                "psr/container-implementation": "1.1|2.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Container\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Container package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/contracts",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/contracts.git",
                "reference": "2393ef579e020d88e24283913c815c3e2c143323"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/contracts/zipball/2393ef579e020d88e24283913c815c3e2c143323",
                "reference": "2393ef579e020d88e24283913c815c3e2c143323",
                "shasum": ""
            },
            "require": {
                "php": "^8.1",
                "psr/container": "^1.1.1|^2.0.1",
                "psr/simple-cache": "^1.0|^2.0|^3.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Contracts\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Contracts package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/database",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/database.git",
                "reference": "711519fa4eca9c55d4f3d6680ffca71b28317e7a"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/database/zipball/711519fa4eca9c55d4f3d6680ffca71b28317e7a",
                "reference": "711519fa4eca9c55d4f3d6680ffca71b28317e7a",
                "shasum": ""
            },
            "require": {
                "brick/math": "^0.9.3|^0.10.2|^0.11|^0.12",
                "ext-pdo": "*",
                "illuminate/collections": "^10.0",
                "illuminate/container": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "conflict": {
                "carbonphp/carbon-doctrine-types": ">=3.0",
                "doctrine/dbal": ">=4.0"
            },
            "suggest": {
                "doctrine/dbal": "Required to rename columns and drop SQLite columns (^3.5.1).",
                "ext-filter": "Required to use the Postgres database driver.",
                "fakerphp/faker": "Required to use the eloquent factory builder (^1.21).",
                "illuminate/console": "Required to use the database commands (^10.0).",
                "illuminate/events": "Required to use the observers with Eloquent (^10.0).",
                "illuminate/filesystem": "Required to use the migrations (^10.0).",
                "illuminate/pagination": "Required to paginate the result set (^10.0).",
                "symfony/finder": "Required to use Eloquent model factories (^6.2)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Database\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Database package.",
            "homepage": "https://laravel.com",
            "keywords": [
                "database",
                "laravel",
                "orm",
                "sql"
            ],
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/encryption",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/encryption.git",
                "reference": "0ab9942a891f82f927d03abb9a7320b89262f2a2"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/encryption/zipball/0ab9942a891f82f927d03abb9a7320b89262f2a2",
                "reference": "0ab9942a891f82f927d03abb9a7320b89262f2a2",
                "shasum": ""
            },
            "require": {
                "ext-hash": "*",
                "ext-mbstring": "*",
                "ext-openssl": "*",
                "illuminate/contracts": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Encryption\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Encryption package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2023-11-21T16:21:31+00:00"
        },
        {
            "name": "illuminate/events",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/events.git",
                "reference": "4a8e4fbc95c7e46aa6152fd8c900d56e5ef538cf"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/events/zipball/4a8e4fbc95c7e46aa6152fd8c900d56e5ef538cf",
                "reference": "4a8e4fbc95c7e46aa6152fd8c900d56e5ef538cf",
                "shasum": ""
            },
            "require": {
                "illuminate/bus": "^10.0",
                "illuminate/collections": "^10.0",
                "illuminate/container": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "files": [
                    "functions.php"
                ],
                "psr-4": {
                    "Illuminate\\Events\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Events package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/filesystem",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/filesystem.git",
                "reference": "584ff4da2218e63e7210bba1c541ce526f24f37e"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/filesystem/zipball/584ff4da2218e63e7210bba1c541ce526f24f37e",
                "reference": "584ff4da2218e63e7210bba1c541ce526f24f37e",
                "shasum": ""
            },
            "require": {
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1",
                "symfony/finder": "^6.2"
            },
            "suggest": {
                "ext-fileinfo": "Required to use the Filesystem class.",
                "ext-ftp": "Required to use the Flysystem FTP driver.",
                "ext-hash": "Required to use the Filesystem class.",
                "illuminate/http": "Required for handling uploaded files (^7.0).",
                "league/flysystem": "Required to use the Flysystem local driver (^3.0.16).",
                "league/flysystem-aws-s3-v3": "Required to use the Flysystem S3 driver (^3.0).",
                "league/flysystem-ftp": "Required to use the Flysystem FTP driver (^3.0).",
                "league/flysystem-sftp-v3": "Required to use the Flysystem SFTP driver (^3.0).",
                "psr/http-message": "Required to allow Storage::put to accept a StreamInterface (^1.0).",
                "symfony/filesystem": "Required to enable support for relative symbolic links (^6.2).",
                "symfony/mime": "Required to enable support for guessing extensions (^6.2)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "files": [
                    "functions.php"
                ],
                "psr-4": {
                    "Illuminate\\Filesystem\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Filesystem package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-01-24T16:09:31+00:00"
        },
        {
            "name": "illuminate/hashing",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/hashing.git",
                "reference": "7ab4eae83a55aaef1c2ba5c06ea5bfd46bee1286"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/hashing/zipball/7ab4eae83a55aaef1c2ba5c06ea5bfd46bee1286",
                "reference": "7ab4eae83a55aaef1c2ba5c06ea5bfd46bee1286",
                "shasum": ""
            },
            "require": {
                "illuminate/contracts": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Hashing\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Hashing package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2023-10-25T19:32:34+00:00"
        },
        {
            "name": "illuminate/http",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/http.git",
                "reference": "45dd7db0731bb1f28acbb5d6b59b029e83d3cb8e"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/http/zipball/45dd7db0731bb1f28acbb5d6b59b029e83d3cb8e",
                "reference": "45dd7db0731bb1f28acbb5d6b59b029e83d3cb8e",
                "shasum": ""
            },
            "require": {
                "ext-filter": "*",
                "fruitcake/php-cors": "^1.2",
                "guzzlehttp/uri-template": "^1.0",
                "illuminate/collections": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/session": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1",
                "symfony/http-foundation": "^6.4",
                "symfony/http-kernel": "^6.2",
                "symfony/mime": "^6.2"
            },
            "suggest": {
                "ext-gd": "Required to use Illuminate\\Http\\Testing\\FileFactory::image().",
                "guzzlehttp/guzzle": "Required to use the HTTP Client (^7.5)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Http\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Http package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/log",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/log.git",
                "reference": "bf5daf65187ebb6bc045fd5f4925f196b46953ec"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/log/zipball/bf5daf65187ebb6bc045fd5f4925f196b46953ec",
                "reference": "bf5daf65187ebb6bc045fd5f4925f196b46953ec",
                "shasum": ""
            },
            "require": {
                "illuminate/contracts": "^10.0",
                "illuminate/support": "^10.0",
                "monolog/monolog": "^3.0",
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Log\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Log package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/macroable",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/macroable.git",
                "reference": "dff667a46ac37b634dcf68909d9d41e94dc97c27"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/macroable/zipball/dff667a46ac37b634dcf68909d9d41e94dc97c27",
                "reference": "dff667a46ac37b634dcf68909d9d41e94dc97c27",
                "shasum": ""
            },
            "require": {
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Support\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Macroable package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2023-06-05T12:46:42+00:00"
        },
        {
            "name": "illuminate/pagination",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/pagination.git",
                "reference": "616874b9607ff35925347e1710a8b5151858cdf2"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/pagination/zipball/616874b9607ff35925347e1710a8b5151858cdf2",
                "reference": "616874b9607ff35925347e1710a8b5151858cdf2",
                "shasum": ""
            },
            "require": {
                "ext-filter": "*",
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Pagination\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Pagination package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2024-04-11T14:31:05+00:00"
        },
        {
            "name": "illuminate/pipeline",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/pipeline.git",
                "reference": "c12e4f1d8a1fbecdc1e0fa4dc9fe17b4315832e9"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/pipeline/zipball/c12e4f1d8a1fbecdc1e0fa4dc9fe17b4315832e9",
                "reference": "c12e4f1d8a1fbecdc1e0fa4dc9fe17b4315832e9",
                "shasum": ""
            },
            "require": {
                "illuminate/contracts": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Pipeline\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Pipeline package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/queue",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/queue.git",
                "reference": "f61e60eeed4a20dab6ed8ead1af9fd4d1e531226"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/queue/zipball/f61e60eeed4a20dab6ed8ead1af9fd4d1e531226",
                "reference": "f61e60eeed4a20dab6ed8ead1af9fd4d1e531226",
                "shasum": ""
            },
            "require": {
                "illuminate/collections": "^10.0",
                "illuminate/console": "^10.0",
                "illuminate/container": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/database": "^10.0",
                "illuminate/filesystem": "^10.0",
                "illuminate/pipeline": "^10.0",
                "illuminate/support": "^10.0",
                "laravel/serializable-closure": "^1.2.2",
                "php": "^8.1",
                "ramsey/uuid": "^4.7",
                "symfony/process": "^6.2"
            },
            "suggest": {
                "aws/aws-sdk-php": "Required to use the SQS queue driver and DynamoDb failed job storage (^3.235.5).",
                "ext-filter": "Required to use the SQS queue worker.",
                "ext-mbstring": "Required to use the database failed job providers.",
                "ext-pcntl": "Required to use all features of the queue worker.",
                "ext-pdo": "Required to use the database queue worker.",
                "ext-posix": "Required to use all features of the queue worker.",
                "illuminate/redis": "Required to use the Redis queue driver (^10.0).",
                "pda/pheanstalk": "Required to use the Beanstalk queue driver (^4.0)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Queue\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Queue package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/session",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/session.git",
                "reference": "ddfa808aadcfeaec6586349d013fc55776146283"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/session/zipball/ddfa808aadcfeaec6586349d013fc55776146283",
                "reference": "ddfa808aadcfeaec6586349d013fc55776146283",
                "shasum": ""
            },
            "require": {
                "ext-ctype": "*",
                "ext-session": "*",
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/filesystem": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1",
                "symfony/finder": "^6.2",
                "symfony/http-foundation": "^6.4"
            },
            "suggest": {
                "illuminate/console": "Required to use the session:table command (^10.0)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Session\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Session package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/support",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/support.git",
                "reference": "28b505e671dbe119e4e32a75c78f87189d046e39"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/support/zipball/28b505e671dbe119e4e32a75c78f87189d046e39",
                "reference": "28b505e671dbe119e4e32a75c78f87189d046e39",
                "shasum": ""
            },
            "require": {
                "doctrine/inflector": "^2.0",
                "ext-ctype": "*",
                "ext-filter": "*",
                "ext-mbstring": "*",
                "illuminate/collections": "^10.0",
                "illuminate/conditionable": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/macroable": "^10.0",
                "nesbot/carbon": "^2.67",
                "php": "^8.1",
                "voku/portable-ascii": "^2.0"
            },
            "conflict": {
                "tightenco/collect": "<5.5.33"
            },
            "suggest": {
                "illuminate/filesystem": "Required to use the composer class (^10.0).",
                "league/commonmark": "Required to use Str::markdown() and Stringable::markdown() (^2.6).",
                "ramsey/uuid": "Required to use Str::uuid() (^4.7).",
                "symfony/process": "Required to use the composer class (^6.2).",
                "symfony/uid": "Required to use Str::ulid() (^6.2).",
                "symfony/var-dumper": "Required to use the dd function (^6.2).",
                "vlucas/phpdotenv": "Required to use the Env class and env helper (^5.4.1)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "files": [
                    "helpers.php"
                ],
                "psr-4": {
                    "Illuminate\\Support\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Support package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-09-08T19:05:53+00:00"
        },
        {
            "name": "illuminate/testing",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/testing.git",
                "reference": "8a1d54de95b097101682e56b3a87200760289451"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/testing/zipball/8a1d54de95b097101682e56b3a87200760289451",
                "reference": "8a1d54de95b097101682e56b3a87200760289451",
                "shasum": ""
            },
            "require": {
                "ext-mbstring": "*",
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "suggest": {
                "brianium/paratest": "Required to run tests in parallel (^6.0).",
                "illuminate/console": "Required to assert console commands (^10.0).",
                "illuminate/database": "Required to assert databases (^10.0).",
                "illuminate/http": "Required to assert responses (^10.0).",
                "mockery/mockery": "Required to use mocking (^1.5.1).",
                "phpunit/phpunit": "Required to use assertions and run tests (^9.5.8|^10.0.7)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Testing\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Testing package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/translation",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/translation.git",
                "reference": "4da8ed16d6ea6008acf43c7375a9b2073fb10e0b"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/translation/zipball/4da8ed16d6ea6008acf43c7375a9b2073fb10e0b",
                "reference": "4da8ed16d6ea6008acf43c7375a9b2073fb10e0b",
                "shasum": ""
            },
            "require": {
                "illuminate/collections": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/filesystem": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Translation\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Translation package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2024-01-30T15:55:48+00:00"
        },
        {
            "name": "illuminate/validation",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/validation.git",
                "reference": "87b25b339ae01782d1047295f625d82ce159a96b"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/validation/zipball/87b25b339ae01782d1047295f625d82ce159a96b",
                "reference": "87b25b339ae01782d1047295f625d82ce159a96b",
                "shasum": ""
            },
            "require": {
                "brick/math": "^0.9.3|^0.10.2|^0.11|^0.12",
                "egulias/email-validator": "^3.2.5|^4.0",
                "ext-filter": "*",
                "ext-mbstring": "*",
                "illuminate/collections": "^10.0",
                "illuminate/container": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/support": "^10.0",
                "illuminate/translation": "^10.0",
                "php": "^8.1",
                "symfony/http-foundation": "^6.4",
                "symfony/mime": "^6.2"
            },
            "suggest": {
                "illuminate/database": "Required to use the database presence verifier (^10.0)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\Validation\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate Validation package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "illuminate/view",
            "version": "v10.49.0",
            "source": {
                "type": "git",
                "url": "https://github.com/illuminate/view.git",
                "reference": "c3f12dd27c8bf8c3167c8f753554d8d8d1f6a619"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/illuminate/view/zipball/c3f12dd27c8bf8c3167c8f753554d8d8d1f6a619",
                "reference": "c3f12dd27c8bf8c3167c8f753554d8d8d1f6a619",
                "shasum": ""
            },
            "require": {
                "ext-tokenizer": "*",
                "illuminate/collections": "^10.0",
                "illuminate/container": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/events": "^10.0",
                "illuminate/filesystem": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/support": "^10.0",
                "php": "^8.1"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Illuminate\\View\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Illuminate View package.",
            "homepage": "https://laravel.com",
            "support": {
                "issues": "https://github.com/laravel/framework/issues",
                "source": "https://github.com/laravel/framework"
            },
            "time": "2025-03-24T11:47:24+00:00"
        },
        {
            "name": "james-heinrich/getid3",
            "version": "v1.9.24",
            "source": {
                "type": "git",
                "url": "https://github.com/JamesHeinrich/getID3.git",
                "reference": "1e11b9b6eb468b522fe604a42a9fdc8ee759bf8a"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/JamesHeinrich/getID3/zipball/1e11b9b6eb468b522fe604a42a9fdc8ee759bf8a",
                "reference": "1e11b9b6eb468b522fe604a42a9fdc8ee759bf8a",
                "shasum": ""
            },
            "require": {
                "php": ">=5.3.0"
            },
            "require-dev": {
                "php-parallel-lint/php-parallel-lint": "^1.0"
            },
            "suggest": {
                "ext-SimpleXML": "SimpleXML extension is required to analyze RIFF/WAV/BWF audio files (also requires `ext-libxml`).",
                "ext-com_dotnet": "COM extension is required when loading files larger than 2GB on Windows.",
                "ext-ctype": "ctype extension is required when loading files larger than 2GB on 32-bit PHP (also on 64-bit PHP on Windows) or executing `getid3_lib::CopyTagsToComments`.",
                "ext-dba": "DBA extension is required to use the DBA database as a cache storage.",
                "ext-exif": "EXIF extension is required for graphic modules.",
                "ext-iconv": "iconv extension is required to work with different character sets (when `ext-mbstring` is not available).",
                "ext-json": "JSON extension is required to analyze Apple Quicktime videos.",
                "ext-libxml": "libxml extension is required to analyze RIFF/WAV/BWF audio files.",
                "ext-mbstring": "mbstring extension is required to work with different character sets.",
                "ext-mysql": "MySQL extension is required to use the MySQL database as a cache storage (deprecated in PHP 5.5, removed in PHP >= 7.0, use `ext-mysqli` instead).",
                "ext-mysqli": "MySQLi extension is required to use the MySQL database as a cache storage.",
                "ext-rar": "RAR extension is required for RAR archive module.",
                "ext-sqlite3": "SQLite3 extension is required to use the SQLite3 database as a cache storage.",
                "ext-xml": "XML extension is required for graphic modules to analyze the XML metadata.",
                "ext-zlib": "Zlib extension is required for archive modules and compressed metadata."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "1.9.x-dev"
                }
            },
            "autoload": {
                "classmap": [
                    "getid3/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "GPL-1.0-or-later",
                "LGPL-3.0-only",
                "MPL-2.0"
            ],
            "description": "PHP script that extracts useful information from popular multimedia file formats",
            "homepage": "https://www.getid3.org/",
            "keywords": [
                "codecs",
                "php",
                "tags"
            ],
            "support": {
                "issues": "https://github.com/JamesHeinrich/getID3/issues",
                "source": "https://github.com/JamesHeinrich/getID3/tree/v1.9.24"
            },
            "time": "2025-10-09T17:48:17+00:00"
        },
        {
            "name": "laravel/lumen-framework",
            "version": "v10.0.4",
            "source": {
                "type": "git",
                "url": "https://github.com/laravel/lumen-framework.git",
                "reference": "c88d8cb1cbaf578c5261b4f9c8e1f070eaff1496"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/laravel/lumen-framework/zipball/c88d8cb1cbaf578c5261b4f9c8e1f070eaff1496",
                "reference": "c88d8cb1cbaf578c5261b4f9c8e1f070eaff1496",
                "shasum": ""
            },
            "require": {
                "composer-runtime-api": "^2.2",
                "dragonmantank/cron-expression": "^3.1",
                "illuminate/auth": "^10.0",
                "illuminate/broadcasting": "^10.0",
                "illuminate/bus": "^10.0",
                "illuminate/cache": "^10.0",
                "illuminate/collections": "^10.0",
                "illuminate/config": "^10.0",
                "illuminate/console": "^10.0",
                "illuminate/container": "^10.0",
                "illuminate/contracts": "^10.0",
                "illuminate/database": "^10.0",
                "illuminate/encryption": "^10.0",
                "illuminate/events": "^10.0",
                "illuminate/filesystem": "^10.0",
                "illuminate/hashing": "^10.0",
                "illuminate/http": "^10.0",
                "illuminate/log": "^10.0",
                "illuminate/macroable": "^10.0",
                "illuminate/pagination": "^10.0",
                "illuminate/pipeline": "^10.0",
                "illuminate/queue": "^10.0",
                "illuminate/support": "^10.0",
                "illuminate/testing": "^10.0",
                "illuminate/translation": "^10.0",
                "illuminate/validation": "^10.0",
                "illuminate/view": "^10.0",
                "nikic/fast-route": "^1.3",
                "php": "^8.1",
                "symfony/console": "^6.1",
                "symfony/error-handler": "^6.1",
                "symfony/http-foundation": "^6.1",
                "symfony/http-kernel": "^6.1",
                "symfony/mime": "^6.1",
                "symfony/var-dumper": "^6.1",
                "vlucas/phpdotenv": "^5.4.1"
            },
            "require-dev": {
                "mockery/mockery": "^1.4.4",
                "phpunit/phpunit": "10.5.3"
            },
            "suggest": {
                "laravel/tinker": "Required to use the tinker console command (^2.7).",
                "nyholm/psr7": "Required to use PSR-7 bridging features (^1.2).",
                "symfony/psr-http-message-bridge": "Required to use PSR-7 bridging features (^2.0)."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "10.x-dev"
                }
            },
            "autoload": {
                "files": [
                    "src/helpers.php"
                ],
                "psr-4": {
                    "Laravel\\Lumen\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                }
            ],
            "description": "The Laravel Lumen Framework.",
            "homepage": "https://lumen.laravel.com",
            "keywords": [
                "framework",
                "laravel",
                "lumen"
            ],
            "support": {
                "issues": "https://github.com/laravel/lumen-framework/issues",
                "source": "https://github.com/laravel/lumen-framework"
            },
            "time": "2024-11-26T15:27:51+00:00"
        },
        {
            "name": "laravel/prompts",
            "version": "v0.1.25",
            "source": {
                "type": "git",
                "url": "https://github.com/laravel/prompts.git",
                "reference": "7b4029a84c37cb2725fc7f011586e2997040bc95"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/laravel/prompts/zipball/7b4029a84c37cb2725fc7f011586e2997040bc95",
                "reference": "7b4029a84c37cb2725fc7f011586e2997040bc95",
                "shasum": ""
            },
            "require": {
                "ext-mbstring": "*",
                "illuminate/collections": "^10.0|^11.0",
                "php": "^8.1",
                "symfony/console": "^6.2|^7.0"
            },
            "conflict": {
                "illuminate/console": ">=10.17.0 <10.25.0",
                "laravel/framework": ">=10.17.0 <10.25.0"
            },
            "require-dev": {
                "mockery/mockery": "^1.5",
                "pestphp/pest": "^2.3",
                "phpstan/phpstan": "^1.11",
                "phpstan/phpstan-mockery": "^1.1"
            },
            "suggest": {
                "ext-pcntl": "Required for the spinner to be animated."
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-main": "0.1.x-dev"
                }
            },
            "autoload": {
                "files": [
                    "src/helpers.php"
                ],
                "psr-4": {
                    "Laravel\\Prompts\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "description": "Add beautiful and user-friendly forms to your command-line applications.",
            "support": {
                "issues": "https://github.com/laravel/prompts/issues",
                "source": "https://github.com/laravel/prompts/tree/v0.1.25"
            },
            "time": "2024-08-12T22:06:33+00:00"
        },
        {
            "name": "laravel/serializable-closure",
            "version": "v1.3.7",
            "source": {
                "type": "git",
                "url": "https://github.com/laravel/serializable-closure.git",
                "reference": "4f48ade902b94323ca3be7646db16209ec76be3d"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/laravel/serializable-closure/zipball/4f48ade902b94323ca3be7646db16209ec76be3d",
                "reference": "4f48ade902b94323ca3be7646db16209ec76be3d",
                "shasum": ""
            },
            "require": {
                "php": "^7.3|^8.0"
            },
            "require-dev": {
                "illuminate/support": "^8.0|^9.0|^10.0|^11.0",
                "nesbot/carbon": "^2.61|^3.0",
                "pestphp/pest": "^1.21.3",
                "phpstan/phpstan": "^1.8.2",
                "symfony/var-dumper": "^5.4.11|^6.2.0|^7.0.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "1.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Laravel\\SerializableClosure\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Taylor Otwell",
                    "email": "taylor@laravel.com"
                },
                {
                    "name": "Nuno Maduro",
                    "email": "nuno@laravel.com"
                }
            ],
            "description": "Laravel Serializable Closure provides an easy and secure way to serialize closures in PHP.",
            "keywords": [
                "closure",
                "laravel",
                "serializable"
            ],
            "support": {
                "issues": "https://github.com/laravel/serializable-closure/issues",
                "source": "https://github.com/laravel/serializable-closure"
            },
            "time": "2024-11-14T18:34:49+00:00"
        },
        {
            "name": "lcobucci/clock",
            "version": "2.2.0",
            "source": {
                "type": "git",
                "url": "https://github.com/lcobucci/clock.git",
                "reference": "fb533e093fd61321bfcbac08b131ce805fe183d3"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/lcobucci/clock/zipball/fb533e093fd61321bfcbac08b131ce805fe183d3",
                "reference": "fb533e093fd61321bfcbac08b131ce805fe183d3",
                "shasum": ""
            },
            "require": {
                "php": "^8.0",
                "stella-maris/clock": "^0.1.4"
            },
            "require-dev": {
                "infection/infection": "^0.26",
                "lcobucci/coding-standard": "^8.0",
                "phpstan/extension-installer": "^1.1",
                "phpstan/phpstan": "^0.12",
                "phpstan/phpstan-deprecation-rules": "^0.12",
                "phpstan/phpstan-phpunit": "^0.12",
                "phpstan/phpstan-strict-rules": "^0.12",
                "phpunit/phpunit": "^9.5"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Lcobucci\\Clock\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Luís Cobucci",
                    "email": "lcobucci@gmail.com"
                }
            ],
            "description": "Yet another clock abstraction",
            "support": {
                "issues": "https://github.com/lcobucci/clock/issues",
                "source": "https://github.com/lcobucci/clock/tree/2.2.0"
            },
            "funding": [
                {
                    "url": "https://github.com/lcobucci",
                    "type": "github"
                },
                {
                    "url": "https://www.patreon.com/lcobucci",
                    "type": "patreon"
                }
            ],
            "time": "2022-04-19T19:34:17+00:00"
        },
        {
            "name": "lcobucci/jwt",
            "version": "4.0.4",
            "source": {
                "type": "git",
                "url": "https://github.com/lcobucci/jwt.git",
                "reference": "55564265fddf810504110bd68ca311932324b0e9"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/lcobucci/jwt/zipball/55564265fddf810504110bd68ca311932324b0e9",
                "reference": "55564265fddf810504110bd68ca311932324b0e9",
                "shasum": ""
            },
            "require": {
                "ext-mbstring": "*",
                "ext-openssl": "*",
                "lcobucci/clock": "^2.0",
                "php": "^7.4 || ^8.0"
            },
            "require-dev": {
                "infection/infection": "^0.20",
                "lcobucci/coding-standard": "^6.0",
                "mikey179/vfsstream": "^1.6",
                "phpbench/phpbench": "^0.17",
                "phpstan/extension-installer": "^1.0",
                "phpstan/phpstan": "^0.12",
                "phpstan/phpstan-deprecation-rules": "^0.12",
                "phpstan/phpstan-phpunit": "^0.12",
                "phpstan/phpstan-strict-rules": "^0.12",
                "phpunit/php-invoker": "^3.1",
                "phpunit/phpunit": "^9.4"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "4.0-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Lcobucci\\JWT\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "BSD-3-Clause"
            ],
            "authors": [
                {
                    "name": "Luís Cobucci",
                    "email": "lcobucci@gmail.com",
                    "role": "Developer"
                }
            ],
            "description": "A simple library to work with JSON Web Token and JSON Web Signature",
            "keywords": [
                "JWS",
                "jwt"
            ],
            "support": {
                "issues": "https://github.com/lcobucci/jwt/issues",
                "source": "https://github.com/lcobucci/jwt/tree/4.0.4"
            },
            "funding": [
                {
                    "url": "https://github.com/lcobucci",
                    "type": "github"
                },
                {
                    "url": "https://www.patreon.com/lcobucci",
                    "type": "patreon"
                }
            ],
            "time": "2021-09-28T19:18:28+00:00"
        },
        {
            "name": "league/flysystem",
            "version": "3.30.2",
            "source": {
                "type": "git",
                "url": "https://github.com/thephpleague/flysystem.git",
                "reference": "5966a8ba23e62bdb518dd9e0e665c2dbd4b5b277"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/thephpleague/flysystem/zipball/5966a8ba23e62bdb518dd9e0e665c2dbd4b5b277",
                "reference": "5966a8ba23e62bdb518dd9e0e665c2dbd4b5b277",
                "shasum": ""
            },
            "require": {
                "league/flysystem-local": "^3.0.0",
                "league/mime-type-detection": "^1.0.0",
                "php": "^8.0.2"
            },
            "conflict": {
                "async-aws/core": "<1.19.0",
                "async-aws/s3": "<1.14.0",
                "aws/aws-sdk-php": "3.209.31 || 3.210.0",
                "guzzlehttp/guzzle": "<7.0",
                "guzzlehttp/ringphp": "<1.1.1",
                "phpseclib/phpseclib": "3.0.15",
                "symfony/http-client": "<5.2"
            },
            "require-dev": {
                "async-aws/s3": "^1.5 || ^2.0",
                "async-aws/simple-s3": "^1.1 || ^2.0",
                "aws/aws-sdk-php": "^3.295.10",
                "composer/semver": "^3.0",
                "ext-fileinfo": "*",
                "ext-ftp": "*",
                "ext-mongodb": "^1.3|^2",
                "ext-zip": "*",
                "friendsofphp/php-cs-fixer": "^3.5",
                "google/cloud-storage": "^1.23",
                "guzzlehttp/psr7": "^2.6",
                "microsoft/azure-storage-blob": "^1.1",
                "mongodb/mongodb": "^1.2|^2",
                "phpseclib/phpseclib": "^3.0.36",
                "phpstan/phpstan": "^1.10",
                "phpunit/phpunit": "^9.5.11|^10.0",
                "sabre/dav": "^4.6.0"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "League\\Flysystem\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Frank de Jonge",
                    "email": "info@frankdejonge.nl"
                }
            ],
            "description": "File storage abstraction for PHP",
            "keywords": [
                "WebDAV",
                "aws",
                "cloud",
                "file",
                "files",
                "filesystem",
                "filesystems",
                "ftp",
                "s3",
                "sftp",
                "storage"
            ],
            "support": {
                "issues": "https://github.com/thephpleague/flysystem/issues",
                "source": "https://github.com/thephpleague/flysystem/tree/3.30.2"
            },
            "time": "2025-11-10T17:13:11+00:00"
        },
        {
            "name": "league/flysystem-ftp",
            "version": "3.0.0",
            "source": {
                "type": "git",
                "url": "https://github.com/thephpleague/flysystem-ftp.git",
                "reference": "2a3833d05e3abcaab926751311431065f50a493b"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/thephpleague/flysystem-ftp/zipball/2a3833d05e3abcaab926751311431065f50a493b",
                "reference": "2a3833d05e3abcaab926751311431065f50a493b",
                "shasum": ""
            },
            "require": {
                "ext-ftp": "*",
                "league/flysystem": "^2.0.0 || ^3.0.0",
                "league/mime-type-detection": "^1.0.0",
                "php": "^8.0.2"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "League\\Flysystem\\Ftp\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Frank de Jonge",
                    "email": "info@frankdejonge.nl"
                }
            ],
            "description": "FTP filesystem adapter for Flysystem.",
            "keywords": [
                "Flysystem",
                "file",
                "files",
                "filesystem",
                "ftp",
                "ftpd"
            ],
            "support": {
                "source": "https://github.com/thephpleague/flysystem-ftp/tree/3.0.0"
            },
            "funding": [
                {
                    "url": "https://offset.earth/frankdejonge",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/frankdejonge",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/league/flysystem",
                    "type": "tidelift"
                }
            ],
            "time": "2022-01-12T20:39:47+00:00"
        },
        {
            "name": "league/flysystem-local",
            "version": "3.30.2",
            "source": {
                "type": "git",
                "url": "https://github.com/thephpleague/flysystem-local.git",
                "reference": "ab4f9d0d672f601b102936aa728801dd1a11968d"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/thephpleague/flysystem-local/zipball/ab4f9d0d672f601b102936aa728801dd1a11968d",
                "reference": "ab4f9d0d672f601b102936aa728801dd1a11968d",
                "shasum": ""
            },
            "require": {
                "ext-fileinfo": "*",
                "league/flysystem": "^3.0.0",
                "league/mime-type-detection": "^1.0.0",
                "php": "^8.0.2"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "League\\Flysystem\\Local\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Frank de Jonge",
                    "email": "info@frankdejonge.nl"
                }
            ],
            "description": "Local filesystem adapter for Flysystem.",
            "keywords": [
                "Flysystem",
                "file",
                "files",
                "filesystem",
                "local"
            ],
            "support": {
                "source": "https://github.com/thephpleague/flysystem-local/tree/3.30.2"
            },
            "time": "2025-11-10T11:23:37+00:00"
        },
        {
            "name": "league/mime-type-detection",
            "version": "1.16.0",
            "source": {
                "type": "git",
                "url": "https://github.com/thephpleague/mime-type-detection.git",
                "reference": "2d6702ff215bf922936ccc1ad31007edc76451b9"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/thephpleague/mime-type-detection/zipball/2d6702ff215bf922936ccc1ad31007edc76451b9",
                "reference": "2d6702ff215bf922936ccc1ad31007edc76451b9",
                "shasum": ""
            },
            "require": {
                "ext-fileinfo": "*",
                "php": "^7.4 || ^8.0"
            },
            "require-dev": {
                "friendsofphp/php-cs-fixer": "^3.2",
                "phpstan/phpstan": "^0.12.68",
                "phpunit/phpunit": "^8.5.8 || ^9.3 || ^10.0"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "League\\MimeTypeDetection\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Frank de Jonge",
                    "email": "info@frankdejonge.nl"
                }
            ],
            "description": "Mime-type detection for Flysystem",
            "support": {
                "issues": "https://github.com/thephpleague/mime-type-detection/issues",
                "source": "https://github.com/thephpleague/mime-type-detection/tree/1.16.0"
            },
            "funding": [
                {
                    "url": "https://github.com/frankdejonge",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/league/flysystem",
                    "type": "tidelift"
                }
            ],
            "time": "2024-09-21T08:32:55+00:00"
        },
        {
            "name": "monolog/monolog",
            "version": "3.10.0",
            "source": {
                "type": "git",
                "url": "https://github.com/Seldaek/monolog.git",
                "reference": "b321dd6749f0bf7189444158a3ce785cc16d69b0"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/Seldaek/monolog/zipball/b321dd6749f0bf7189444158a3ce785cc16d69b0",
                "reference": "b321dd6749f0bf7189444158a3ce785cc16d69b0",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "psr/log": "^2.0 || ^3.0"
            },
            "provide": {
                "psr/log-implementation": "3.0.0"
            },
            "require-dev": {
                "aws/aws-sdk-php": "^3.0",
                "doctrine/couchdb": "~1.0@dev",
                "elasticsearch/elasticsearch": "^7 || ^8",
                "ext-json": "*",
                "graylog2/gelf-php": "^1.4.2 || ^2.0",
                "guzzlehttp/guzzle": "^7.4.5",
                "guzzlehttp/psr7": "^2.2",
                "mongodb/mongodb": "^1.8 || ^2.0",
                "php-amqplib/php-amqplib": "~2.4 || ^3",
                "php-console/php-console": "^3.1.8",
                "phpstan/phpstan": "^2",
                "phpstan/phpstan-deprecation-rules": "^2",
                "phpstan/phpstan-strict-rules": "^2",
                "phpunit/phpunit": "^10.5.17 || ^11.0.7",
                "predis/predis": "^1.1 || ^2",
                "rollbar/rollbar": "^4.0",
                "ruflin/elastica": "^7 || ^8",
                "symfony/mailer": "^5.4 || ^6",
                "symfony/mime": "^5.4 || ^6"
            },
            "suggest": {
                "aws/aws-sdk-php": "Allow sending log messages to AWS services like DynamoDB",
                "doctrine/couchdb": "Allow sending log messages to a CouchDB server",
                "elasticsearch/elasticsearch": "Allow sending log messages to an Elasticsearch server via official client",
                "ext-amqp": "Allow sending log messages to an AMQP server (1.0+ required)",
                "ext-curl": "Required to send log messages using the IFTTTHandler, the LogglyHandler, the SendGridHandler, the SlackWebhookHandler or the TelegramBotHandler",
                "ext-mbstring": "Allow to work properly with unicode symbols",
                "ext-mongodb": "Allow sending log messages to a MongoDB server (via driver)",
                "ext-openssl": "Required to send log messages using SSL",
                "ext-sockets": "Allow sending log messages to a Syslog server (via UDP driver)",
                "graylog2/gelf-php": "Allow sending log messages to a GrayLog2 server",
                "mongodb/mongodb": "Allow sending log messages to a MongoDB server (via library)",
                "php-amqplib/php-amqplib": "Allow sending log messages to an AMQP server using php-amqplib",
                "rollbar/rollbar": "Allow sending log messages to Rollbar",
                "ruflin/elastica": "Allow sending log messages to an Elastic Search server"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-main": "3.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Monolog\\": "src/Monolog"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Jordi Boggiano",
                    "email": "j.boggiano@seld.be",
                    "homepage": "https://seld.be"
                }
            ],
            "description": "Sends your logs to files, sockets, inboxes, databases and various web services",
            "homepage": "https://github.com/Seldaek/monolog",
            "keywords": [
                "log",
                "logging",
                "psr-3"
            ],
            "support": {
                "issues": "https://github.com/Seldaek/monolog/issues",
                "source": "https://github.com/Seldaek/monolog/tree/3.10.0"
            },
            "funding": [
                {
                    "url": "https://github.com/Seldaek",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/monolog/monolog",
                    "type": "tidelift"
                }
            ],
            "time": "2026-01-02T08:56:05+00:00"
        },
        {
            "name": "namshi/jose",
            "version": "7.2.3",
            "source": {
                "type": "git",
                "url": "https://github.com/namshi/jose.git",
                "reference": "89a24d7eb3040e285dd5925fcad992378b82bcff"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/namshi/jose/zipball/89a24d7eb3040e285dd5925fcad992378b82bcff",
                "reference": "89a24d7eb3040e285dd5925fcad992378b82bcff",
                "shasum": ""
            },
            "require": {
                "ext-date": "*",
                "ext-hash": "*",
                "ext-json": "*",
                "ext-pcre": "*",
                "ext-spl": "*",
                "php": ">=5.5",
                "symfony/polyfill-php56": "^1.0"
            },
            "require-dev": {
                "phpseclib/phpseclib": "^2.0",
                "phpunit/phpunit": "^4.5|^5.0",
                "satooshi/php-coveralls": "^1.0"
            },
            "suggest": {
                "ext-openssl": "Allows to use OpenSSL as crypto engine.",
                "phpseclib/phpseclib": "Allows to use Phpseclib as crypto engine, use version ^2.0."
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Namshi\\JOSE\\": "src/Namshi/JOSE/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Alessandro Nadalin",
                    "email": "alessandro.nadalin@gmail.com"
                },
                {
                    "name": "Alessandro Cinelli (cirpo)",
                    "email": "alessandro.cinelli@gmail.com"
                }
            ],
            "description": "JSON Object Signing and Encryption library for PHP.",
            "keywords": [
                "JSON Web Signature",
                "JSON Web Token",
                "JWS",
                "json",
                "jwt",
                "token"
            ],
            "support": {
                "issues": "https://github.com/namshi/jose/issues",
                "source": "https://github.com/namshi/jose/tree/master"
            },
            "time": "2016-12-05T07:27:31+00:00"
        },
        {
            "name": "nesbot/carbon",
            "version": "2.73.0",
            "source": {
                "type": "git",
                "url": "https://github.com/CarbonPHP/carbon.git",
                "reference": "9228ce90e1035ff2f0db84b40ec2e023ed802075"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/CarbonPHP/carbon/zipball/9228ce90e1035ff2f0db84b40ec2e023ed802075",
                "reference": "9228ce90e1035ff2f0db84b40ec2e023ed802075",
                "shasum": ""
            },
            "require": {
                "carbonphp/carbon-doctrine-types": "*",
                "ext-json": "*",
                "php": "^7.1.8 || ^8.0",
                "psr/clock": "^1.0",
                "symfony/polyfill-mbstring": "^1.0",
                "symfony/polyfill-php80": "^1.16",
                "symfony/translation": "^3.4 || ^4.0 || ^5.0 || ^6.0"
            },
            "provide": {
                "psr/clock-implementation": "1.0"
            },
            "require-dev": {
                "doctrine/dbal": "^2.0 || ^3.1.4 || ^4.0",
                "doctrine/orm": "^2.7 || ^3.0",
                "friendsofphp/php-cs-fixer": "^3.0",
                "kylekatarnls/multi-tester": "^2.0",
                "ondrejmirtes/better-reflection": "<6",
                "phpmd/phpmd": "^2.9",
                "phpstan/extension-installer": "^1.0",
                "phpstan/phpstan": "^0.12.99 || ^1.7.14",
                "phpunit/php-file-iterator": "^2.0.5 || ^3.0.6",
                "phpunit/phpunit": "^7.5.20 || ^8.5.26 || ^9.5.20",
                "squizlabs/php_codesniffer": "^3.4"
            },
            "bin": [
                "bin/carbon"
            ],
            "type": "library",
            "extra": {
                "laravel": {
                    "providers": [
                        "Carbon\\Laravel\\ServiceProvider"
                    ]
                },
                "phpstan": {
                    "includes": [
                        "extension.neon"
                    ]
                },
                "branch-alias": {
                    "dev-2.x": "2.x-dev",
                    "dev-master": "3.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Carbon\\": "src/Carbon/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Brian Nesbitt",
                    "email": "brian@nesbot.com",
                    "homepage": "https://markido.com"
                },
                {
                    "name": "kylekatarnls",
                    "homepage": "https://github.com/kylekatarnls"
                }
            ],
            "description": "An API extension for DateTime that supports 281 different languages.",
            "homepage": "https://carbon.nesbot.com",
            "keywords": [
                "date",
                "datetime",
                "time"
            ],
            "support": {
                "docs": "https://carbon.nesbot.com/docs",
                "issues": "https://github.com/briannesbitt/Carbon/issues",
                "source": "https://github.com/briannesbitt/Carbon"
            },
            "funding": [
                {
                    "url": "https://github.com/sponsors/kylekatarnls",
                    "type": "github"
                },
                {
                    "url": "https://opencollective.com/Carbon#sponsor",
                    "type": "opencollective"
                },
                {
                    "url": "https://tidelift.com/subscription/pkg/packagist-nesbot-carbon?utm_source=packagist-nesbot-carbon&utm_medium=referral&utm_campaign=readme",
                    "type": "tidelift"
                }
            ],
            "time": "2025-01-08T20:10:23+00:00"
        },
        {
            "name": "nikic/fast-route",
            "version": "v1.3.0",
            "source": {
                "type": "git",
                "url": "https://github.com/nikic/FastRoute.git",
                "reference": "181d480e08d9476e61381e04a71b34dc0432e812"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/nikic/FastRoute/zipball/181d480e08d9476e61381e04a71b34dc0432e812",
                "reference": "181d480e08d9476e61381e04a71b34dc0432e812",
                "shasum": ""
            },
            "require": {
                "php": ">=5.4.0"
            },
            "require-dev": {
                "phpunit/phpunit": "^4.8.35|~5.7"
            },
            "type": "library",
            "autoload": {
                "files": [
                    "src/functions.php"
                ],
                "psr-4": {
                    "FastRoute\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "BSD-3-Clause"
            ],
            "authors": [
                {
                    "name": "Nikita Popov",
                    "email": "nikic@php.net"
                }
            ],
            "description": "Fast request router for PHP",
            "keywords": [
                "router",
                "routing"
            ],
            "support": {
                "issues": "https://github.com/nikic/FastRoute/issues",
                "source": "https://github.com/nikic/FastRoute/tree/master"
            },
            "time": "2018-02-13T20:26:39+00:00"
        },
        {
            "name": "nunomaduro/termwind",
            "version": "v1.17.0",
            "source": {
                "type": "git",
                "url": "https://github.com/nunomaduro/termwind.git",
                "reference": "5369ef84d8142c1d87e4ec278711d4ece3cbf301"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/nunomaduro/termwind/zipball/5369ef84d8142c1d87e4ec278711d4ece3cbf301",
                "reference": "5369ef84d8142c1d87e4ec278711d4ece3cbf301",
                "shasum": ""
            },
            "require": {
                "ext-mbstring": "*",
                "php": "^8.1",
                "symfony/console": "^6.4.15"
            },
            "require-dev": {
                "illuminate/console": "^10.48.24",
                "illuminate/support": "^10.48.24",
                "laravel/pint": "^1.18.2",
                "pestphp/pest": "^2.36.0",
                "pestphp/pest-plugin-mock": "2.0.0",
                "phpstan/phpstan": "^1.12.11",
                "phpstan/phpstan-strict-rules": "^1.6.1",
                "symfony/var-dumper": "^6.4.15",
                "thecodingmachine/phpstan-strict-rules": "^1.0.0"
            },
            "type": "library",
            "extra": {
                "laravel": {
                    "providers": [
                        "Termwind\\Laravel\\TermwindServiceProvider"
                    ]
                }
            },
            "autoload": {
                "files": [
                    "src/Functions.php"
                ],
                "psr-4": {
                    "Termwind\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nuno Maduro",
                    "email": "enunomaduro@gmail.com"
                }
            ],
            "description": "Its like Tailwind CSS, but for the console.",
            "keywords": [
                "cli",
                "console",
                "css",
                "package",
                "php",
                "style"
            ],
            "support": {
                "issues": "https://github.com/nunomaduro/termwind/issues",
                "source": "https://github.com/nunomaduro/termwind/tree/v1.17.0"
            },
            "funding": [
                {
                    "url": "https://www.paypal.com/paypalme/enunomaduro",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/nunomaduro",
                    "type": "github"
                },
                {
                    "url": "https://github.com/xiCO2k",
                    "type": "github"
                }
            ],
            "time": "2024-11-21T10:36:35+00:00"
        },
        {
            "name": "php-open-source-saver/jwt-auth",
            "version": "2.3.0",
            "source": {
                "type": "git",
                "url": "https://github.com/PHP-Open-Source-Saver/jwt-auth.git",
                "reference": "a4fadedab4b89ea05b28801557c7ca9c1db408bd"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/PHP-Open-Source-Saver/jwt-auth/zipball/a4fadedab4b89ea05b28801557c7ca9c1db408bd",
                "reference": "a4fadedab4b89ea05b28801557c7ca9c1db408bd",
                "shasum": ""
            },
            "require": {
                "ext-json": "*",
                "illuminate/auth": "^10|^11",
                "illuminate/contracts": "^10|^11",
                "illuminate/http": "^10|^11",
                "illuminate/support": "^10|^11",
                "lcobucci/jwt": "^4.0",
                "namshi/jose": "^7.0",
                "nesbot/carbon": "^2.0|^3.0",
                "php": "^8.1"
            },
            "require-dev": {
                "friendsofphp/php-cs-fixer": "^3",
                "illuminate/console": "^10|^11",
                "illuminate/routing": "^10|^11",
                "mockery/mockery": "^1.4.4",
                "orchestra/testbench": "^8|^9",
                "phpstan/phpstan": "^1",
                "phpunit/phpunit": "^10.5|^11"
            },
            "type": "library",
            "extra": {
                "laravel": {
                    "aliases": {
                        "JWTAuth": "PHPOpenSourceSaver\\JWTAuth\\Facades\\JWTAuth",
                        "JWTFactory": "PHPOpenSourceSaver\\JWTAuth\\Facades\\JWTFactory"
                    },
                    "providers": [
                        "PHPOpenSourceSaver\\JWTAuth\\Providers\\LaravelServiceProvider"
                    ]
                },
                "branch-alias": {
                    "dev-develop": "2.0-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "PHPOpenSourceSaver\\JWTAuth\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Sean Tymon",
                    "email": "tymon148@gmail.com",
                    "homepage": "https://tymon.xyz",
                    "role": "Forked package creator | Developer"
                },
                {
                    "name": "Eric Schricker",
                    "email": "eric.schricker@adiutabyte.de",
                    "role": "Developer"
                },
                {
                    "name": "Fabio William Conceição",
                    "email": "messhias@gmail.com",
                    "role": "Developer"
                }
            ],
            "description": "JSON Web Token Authentication for Laravel and Lumen",
            "homepage": "https://github.com/PHP-Open-Source-Saver/jwt-auth",
            "keywords": [
                "Authentication",
                "JSON Web Token",
                "auth",
                "jwt",
                "laravel"
            ],
            "support": {
                "issues": "https://github.com/PHP-Open-Source-Saver/jwt-auth/issues",
                "source": "https://github.com/PHP-Open-Source-Saver/jwt-auth"
            },
            "time": "2024-04-08T11:22:39+00:00"
        },
        {
            "name": "phpoption/phpoption",
            "version": "1.9.5",
            "source": {
                "type": "git",
                "url": "https://github.com/schmittjoh/php-option.git",
                "reference": "75365b91986c2405cf5e1e012c5595cd487a98be"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/schmittjoh/php-option/zipball/75365b91986c2405cf5e1e012c5595cd487a98be",
                "reference": "75365b91986c2405cf5e1e012c5595cd487a98be",
                "shasum": ""
            },
            "require": {
                "php": "^7.2.5 || ^8.0"
            },
            "require-dev": {
                "bamarni/composer-bin-plugin": "^1.8.2",
                "phpunit/phpunit": "^8.5.44 || ^9.6.25 || ^10.5.53 || ^11.5.34"
            },
            "type": "library",
            "extra": {
                "bamarni-bin": {
                    "bin-links": true,
                    "forward-command": false
                },
                "branch-alias": {
                    "dev-master": "1.9-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "PhpOption\\": "src/PhpOption/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "Apache-2.0"
            ],
            "authors": [
                {
                    "name": "Johannes M. Schmitt",
                    "email": "schmittjoh@gmail.com",
                    "homepage": "https://github.com/schmittjoh"
                },
                {
                    "name": "Graham Campbell",
                    "email": "hello@gjcampbell.co.uk",
                    "homepage": "https://github.com/GrahamCampbell"
                }
            ],
            "description": "Option Type for PHP",
            "keywords": [
                "language",
                "option",
                "php",
                "type"
            ],
            "support": {
                "issues": "https://github.com/schmittjoh/php-option/issues",
                "source": "https://github.com/schmittjoh/php-option/tree/1.9.5"
            },
            "funding": [
                {
                    "url": "https://github.com/GrahamCampbell",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/phpoption/phpoption",
                    "type": "tidelift"
                }
            ],
            "time": "2025-12-27T19:41:33+00:00"
        },
        {
            "name": "psr/cache",
            "version": "3.0.0",
            "source": {
                "type": "git",
                "url": "https://github.com/php-fig/cache.git",
                "reference": "aa5030cfa5405eccfdcb1083ce040c2cb8d253bf"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/php-fig/cache/zipball/aa5030cfa5405eccfdcb1083ce040c2cb8d253bf",
                "reference": "aa5030cfa5405eccfdcb1083ce040c2cb8d253bf",
                "shasum": ""
            },
            "require": {
                "php": ">=8.0.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "1.0.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Psr\\Cache\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "PHP-FIG",
                    "homepage": "https://www.php-fig.org/"
                }
            ],
            "description": "Common interface for caching libraries",
            "keywords": [
                "cache",
                "psr",
                "psr-6"
            ],
            "support": {
                "source": "https://github.com/php-fig/cache/tree/3.0.0"
            },
            "time": "2021-02-03T23:26:27+00:00"
        },
        {
            "name": "psr/clock",
            "version": "1.0.0",
            "source": {
                "type": "git",
                "url": "https://github.com/php-fig/clock.git",
                "reference": "e41a24703d4560fd0acb709162f73b8adfc3aa0d"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/php-fig/clock/zipball/e41a24703d4560fd0acb709162f73b8adfc3aa0d",
                "reference": "e41a24703d4560fd0acb709162f73b8adfc3aa0d",
                "shasum": ""
            },
            "require": {
                "php": "^7.0 || ^8.0"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Psr\\Clock\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "PHP-FIG",
                    "homepage": "https://www.php-fig.org/"
                }
            ],
            "description": "Common interface for reading the clock.",
            "homepage": "https://github.com/php-fig/clock",
            "keywords": [
                "clock",
                "now",
                "psr",
                "psr-20",
                "time"
            ],
            "support": {
                "issues": "https://github.com/php-fig/clock/issues",
                "source": "https://github.com/php-fig/clock/tree/1.0.0"
            },
            "time": "2022-11-25T14:36:26+00:00"
        },
        {
            "name": "psr/container",
            "version": "2.0.2",
            "source": {
                "type": "git",
                "url": "https://github.com/php-fig/container.git",
                "reference": "c71ecc56dfe541dbd90c5360474fbc405f8d5963"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/php-fig/container/zipball/c71ecc56dfe541dbd90c5360474fbc405f8d5963",
                "reference": "c71ecc56dfe541dbd90c5360474fbc405f8d5963",
                "shasum": ""
            },
            "require": {
                "php": ">=7.4.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "2.0.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Psr\\Container\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "PHP-FIG",
                    "homepage": "https://www.php-fig.org/"
                }
            ],
            "description": "Common Container Interface (PHP FIG PSR-11)",
            "homepage": "https://github.com/php-fig/container",
            "keywords": [
                "PSR-11",
                "container",
                "container-interface",
                "container-interop",
                "psr"
            ],
            "support": {
                "issues": "https://github.com/php-fig/container/issues",
                "source": "https://github.com/php-fig/container/tree/2.0.2"
            },
            "time": "2021-11-05T16:47:00+00:00"
        },
        {
            "name": "psr/event-dispatcher",
            "version": "1.0.0",
            "source": {
                "type": "git",
                "url": "https://github.com/php-fig/event-dispatcher.git",
                "reference": "dbefd12671e8a14ec7f180cab83036ed26714bb0"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/php-fig/event-dispatcher/zipball/dbefd12671e8a14ec7f180cab83036ed26714bb0",
                "reference": "dbefd12671e8a14ec7f180cab83036ed26714bb0",
                "shasum": ""
            },
            "require": {
                "php": ">=7.2.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "1.0.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Psr\\EventDispatcher\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "PHP-FIG",
                    "homepage": "http://www.php-fig.org/"
                }
            ],
            "description": "Standard interfaces for event handling.",
            "keywords": [
                "events",
                "psr",
                "psr-14"
            ],
            "support": {
                "issues": "https://github.com/php-fig/event-dispatcher/issues",
                "source": "https://github.com/php-fig/event-dispatcher/tree/1.0.0"
            },
            "time": "2019-01-08T18:20:26+00:00"
        },
        {
            "name": "psr/http-client",
            "version": "1.0.3",
            "source": {
                "type": "git",
                "url": "https://github.com/php-fig/http-client.git",
                "reference": "bb5906edc1c324c9a05aa0873d40117941e5fa90"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/php-fig/http-client/zipball/bb5906edc1c324c9a05aa0873d40117941e5fa90",
                "reference": "bb5906edc1c324c9a05aa0873d40117941e5fa90",
                "shasum": ""
            },
            "require": {
                "php": "^7.0 || ^8.0",
                "psr/http-message": "^1.0 || ^2.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "1.0.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Psr\\Http\\Client\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "PHP-FIG",
                    "homepage": "https://www.php-fig.org/"
                }
            ],
            "description": "Common interface for HTTP clients",
            "homepage": "https://github.com/php-fig/http-client",
            "keywords": [
                "http",
                "http-client",
                "psr",
                "psr-18"
            ],
            "support": {
                "source": "https://github.com/php-fig/http-client"
            },
            "time": "2023-09-23T14:17:50+00:00"
        },
        {
            "name": "psr/http-factory",
            "version": "1.1.0",
            "source": {
                "type": "git",
                "url": "https://github.com/php-fig/http-factory.git",
                "reference": "2b4765fddfe3b508ac62f829e852b1501d3f6e8a"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/php-fig/http-factory/zipball/2b4765fddfe3b508ac62f829e852b1501d3f6e8a",
                "reference": "2b4765fddfe3b508ac62f829e852b1501d3f6e8a",
                "shasum": ""
            },
            "require": {
                "php": ">=7.1",
                "psr/http-message": "^1.0 || ^2.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "1.0.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Psr\\Http\\Message\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "PHP-FIG",
                    "homepage": "https://www.php-fig.org/"
                }
            ],
            "description": "PSR-17: Common interfaces for PSR-7 HTTP message factories",
            "keywords": [
                "factory",
                "http",
                "message",
                "psr",
                "psr-17",
                "psr-7",
                "request",
                "response"
            ],
            "support": {
                "source": "https://github.com/php-fig/http-factory"
            },
            "time": "2024-04-15T12:06:14+00:00"
        },
        {
            "name": "psr/http-message",
            "version": "2.0",
            "source": {
                "type": "git",
                "url": "https://github.com/php-fig/http-message.git",
                "reference": "402d35bcb92c70c026d1a6a9883f06b2ead23d71"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/php-fig/http-message/zipball/402d35bcb92c70c026d1a6a9883f06b2ead23d71",
                "reference": "402d35bcb92c70c026d1a6a9883f06b2ead23d71",
                "shasum": ""
            },
            "require": {
                "php": "^7.2 || ^8.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "2.0.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Psr\\Http\\Message\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "PHP-FIG",
                    "homepage": "https://www.php-fig.org/"
                }
            ],
            "description": "Common interface for HTTP messages",
            "homepage": "https://github.com/php-fig/http-message",
            "keywords": [
                "http",
                "http-message",
                "psr",
                "psr-7",
                "request",
                "response"
            ],
            "support": {
                "source": "https://github.com/php-fig/http-message/tree/2.0"
            },
            "time": "2023-04-04T09:54:51+00:00"
        },
        {
            "name": "psr/log",
            "version": "3.0.2",
            "source": {
                "type": "git",
                "url": "https://github.com/php-fig/log.git",
                "reference": "f16e1d5863e37f8d8c2a01719f5b34baa2b714d3"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/php-fig/log/zipball/f16e1d5863e37f8d8c2a01719f5b34baa2b714d3",
                "reference": "f16e1d5863e37f8d8c2a01719f5b34baa2b714d3",
                "shasum": ""
            },
            "require": {
                "php": ">=8.0.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "3.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Psr\\Log\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "PHP-FIG",
                    "homepage": "https://www.php-fig.org/"
                }
            ],
            "description": "Common interface for logging libraries",
            "homepage": "https://github.com/php-fig/log",
            "keywords": [
                "log",
                "psr",
                "psr-3"
            ],
            "support": {
                "source": "https://github.com/php-fig/log/tree/3.0.2"
            },
            "time": "2024-09-11T13:17:53+00:00"
        },
        {
            "name": "psr/simple-cache",
            "version": "3.0.0",
            "source": {
                "type": "git",
                "url": "https://github.com/php-fig/simple-cache.git",
                "reference": "764e0b3939f5ca87cb904f570ef9be2d78a07865"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/php-fig/simple-cache/zipball/764e0b3939f5ca87cb904f570ef9be2d78a07865",
                "reference": "764e0b3939f5ca87cb904f570ef9be2d78a07865",
                "shasum": ""
            },
            "require": {
                "php": ">=8.0.0"
            },
            "type": "library",
            "extra": {
                "branch-alias": {
                    "dev-master": "3.0.x-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Psr\\SimpleCache\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "PHP-FIG",
                    "homepage": "https://www.php-fig.org/"
                }
            ],
            "description": "Common interfaces for simple caching",
            "keywords": [
                "cache",
                "caching",
                "psr",
                "psr-16",
                "simple-cache"
            ],
            "support": {
                "source": "https://github.com/php-fig/simple-cache/tree/3.0.0"
            },
            "time": "2021-10-29T13:26:27+00:00"
        },
        {
            "name": "ralouphie/getallheaders",
            "version": "3.0.3",
            "source": {
                "type": "git",
                "url": "https://github.com/ralouphie/getallheaders.git",
                "reference": "120b605dfeb996808c31b6477290a714d356e822"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/ralouphie/getallheaders/zipball/120b605dfeb996808c31b6477290a714d356e822",
                "reference": "120b605dfeb996808c31b6477290a714d356e822",
                "shasum": ""
            },
            "require": {
                "php": ">=5.6"
            },
            "require-dev": {
                "php-coveralls/php-coveralls": "^2.1",
                "phpunit/phpunit": "^5 || ^6.5"
            },
            "type": "library",
            "autoload": {
                "files": [
                    "src/getallheaders.php"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Ralph Khattar",
                    "email": "ralph.khattar@gmail.com"
                }
            ],
            "description": "A polyfill for getallheaders.",
            "support": {
                "issues": "https://github.com/ralouphie/getallheaders/issues",
                "source": "https://github.com/ralouphie/getallheaders/tree/develop"
            },
            "time": "2019-03-08T08:55:37+00:00"
        },
        {
            "name": "ramsey/collection",
            "version": "2.1.1",
            "source": {
                "type": "git",
                "url": "https://github.com/ramsey/collection.git",
                "reference": "344572933ad0181accbf4ba763e85a0306a8c5e2"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/ramsey/collection/zipball/344572933ad0181accbf4ba763e85a0306a8c5e2",
                "reference": "344572933ad0181accbf4ba763e85a0306a8c5e2",
                "shasum": ""
            },
            "require": {
                "php": "^8.1"
            },
            "require-dev": {
                "captainhook/plugin-composer": "^5.3",
                "ergebnis/composer-normalize": "^2.45",
                "fakerphp/faker": "^1.24",
                "hamcrest/hamcrest-php": "^2.0",
                "jangregor/phpstan-prophecy": "^2.1",
                "mockery/mockery": "^1.6",
                "php-parallel-lint/php-console-highlighter": "^1.0",
                "php-parallel-lint/php-parallel-lint": "^1.4",
                "phpspec/prophecy-phpunit": "^2.3",
                "phpstan/extension-installer": "^1.4",
                "phpstan/phpstan": "^2.1",
                "phpstan/phpstan-mockery": "^2.0",
                "phpstan/phpstan-phpunit": "^2.0",
                "phpunit/phpunit": "^10.5",
                "ramsey/coding-standard": "^2.3",
                "ramsey/conventional-commits": "^1.6",
                "roave/security-advisories": "dev-latest"
            },
            "type": "library",
            "extra": {
                "captainhook": {
                    "force-install": true
                },
                "ramsey/conventional-commits": {
                    "configFile": "conventional-commits.json"
                }
            },
            "autoload": {
                "psr-4": {
                    "Ramsey\\Collection\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Ben Ramsey",
                    "email": "ben@benramsey.com",
                    "homepage": "https://benramsey.com"
                }
            ],
            "description": "A PHP library for representing and manipulating collections.",
            "keywords": [
                "array",
                "collection",
                "hash",
                "map",
                "queue",
                "set"
            ],
            "support": {
                "issues": "https://github.com/ramsey/collection/issues",
                "source": "https://github.com/ramsey/collection/tree/2.1.1"
            },
            "time": "2025-03-22T05:38:12+00:00"
        },
        {
            "name": "ramsey/uuid",
            "version": "4.9.2",
            "source": {
                "type": "git",
                "url": "https://github.com/ramsey/uuid.git",
                "reference": "8429c78ca35a09f27565311b98101e2826affde0"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/ramsey/uuid/zipball/8429c78ca35a09f27565311b98101e2826affde0",
                "reference": "8429c78ca35a09f27565311b98101e2826affde0",
                "shasum": ""
            },
            "require": {
                "brick/math": "^0.8.16 || ^0.9 || ^0.10 || ^0.11 || ^0.12 || ^0.13 || ^0.14",
                "php": "^8.0",
                "ramsey/collection": "^1.2 || ^2.0"
            },
            "replace": {
                "rhumsaa/uuid": "self.version"
            },
            "require-dev": {
                "captainhook/captainhook": "^5.25",
                "captainhook/plugin-composer": "^5.3",
                "dealerdirect/phpcodesniffer-composer-installer": "^1.0",
                "ergebnis/composer-normalize": "^2.47",
                "mockery/mockery": "^1.6",
                "paragonie/random-lib": "^2",
                "php-mock/php-mock": "^2.6",
                "php-mock/php-mock-mockery": "^1.5",
                "php-parallel-lint/php-parallel-lint": "^1.4.0",
                "phpbench/phpbench": "^1.2.14",
                "phpstan/extension-installer": "^1.4",
                "phpstan/phpstan": "^2.1",
                "phpstan/phpstan-mockery": "^2.0",
                "phpstan/phpstan-phpunit": "^2.0",
                "phpunit/phpunit": "^9.6",
                "slevomat/coding-standard": "^8.18",
                "squizlabs/php_codesniffer": "^3.13"
            },
            "suggest": {
                "ext-bcmath": "Enables faster math with arbitrary-precision integers using BCMath.",
                "ext-gmp": "Enables faster math with arbitrary-precision integers using GMP.",
                "ext-uuid": "Enables the use of PeclUuidTimeGenerator and PeclUuidRandomGenerator.",
                "paragonie/random-lib": "Provides RandomLib for use with the RandomLibAdapter",
                "ramsey/uuid-doctrine": "Allows the use of Ramsey\\Uuid\\Uuid as Doctrine field type."
            },
            "type": "library",
            "extra": {
                "captainhook": {
                    "force-install": true
                }
            },
            "autoload": {
                "files": [
                    "src/functions.php"
                ],
                "psr-4": {
                    "Ramsey\\Uuid\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "description": "A PHP library for generating and working with universally unique identifiers (UUIDs).",
            "keywords": [
                "guid",
                "identifier",
                "uuid"
            ],
            "support": {
                "issues": "https://github.com/ramsey/uuid/issues",
                "source": "https://github.com/ramsey/uuid/tree/4.9.2"
            },
            "time": "2025-12-14T04:43:48+00:00"
        },
        {
            "name": "stella-maris/clock",
            "version": "0.1.7",
            "source": {
                "type": "git",
                "url": "https://github.com/stella-maris-solutions/clock.git",
                "reference": "fa23ce16019289a18bb3446fdecd45befcdd94f8"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/stella-maris-solutions/clock/zipball/fa23ce16019289a18bb3446fdecd45befcdd94f8",
                "reference": "fa23ce16019289a18bb3446fdecd45befcdd94f8",
                "shasum": ""
            },
            "require": {
                "php": "^7.0|^8.0",
                "psr/clock": "^1.0"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "StellaMaris\\Clock\\": "src"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Andreas Heigl",
                    "role": "Maintainer"
                }
            ],
            "description": "A pre-release of the proposed PSR-20 Clock-Interface",
            "homepage": "https://gitlab.com/stella-maris/clock",
            "keywords": [
                "clock",
                "datetime",
                "point in time",
                "psr20"
            ],
            "support": {
                "source": "https://github.com/stella-maris-solutions/clock/tree/0.1.7"
            },
            "time": "2022-11-25T16:15:06+00:00"
        },
        {
            "name": "symfony/console",
            "version": "v6.4.31",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/console.git",
                "reference": "f9f8a889f54c264f9abac3fc0f7a371ffca51997"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/console/zipball/f9f8a889f54c264f9abac3fc0f7a371ffca51997",
                "reference": "f9f8a889f54c264f9abac3fc0f7a371ffca51997",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "symfony/deprecation-contracts": "^2.5|^3",
                "symfony/polyfill-mbstring": "~1.0",
                "symfony/service-contracts": "^2.5|^3",
                "symfony/string": "^5.4|^6.0|^7.0"
            },
            "conflict": {
                "symfony/dependency-injection": "<5.4",
                "symfony/dotenv": "<5.4",
                "symfony/event-dispatcher": "<5.4",
                "symfony/lock": "<5.4",
                "symfony/process": "<5.4"
            },
            "provide": {
                "psr/log-implementation": "1.0|2.0|3.0"
            },
            "require-dev": {
                "psr/log": "^1|^2|^3",
                "symfony/config": "^5.4|^6.0|^7.0",
                "symfony/dependency-injection": "^5.4|^6.0|^7.0",
                "symfony/event-dispatcher": "^5.4|^6.0|^7.0",
                "symfony/http-foundation": "^6.4|^7.0",
                "symfony/http-kernel": "^6.4|^7.0",
                "symfony/lock": "^5.4|^6.0|^7.0",
                "symfony/messenger": "^5.4|^6.0|^7.0",
                "symfony/process": "^5.4|^6.0|^7.0",
                "symfony/stopwatch": "^5.4|^6.0|^7.0",
                "symfony/var-dumper": "^5.4|^6.0|^7.0"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Symfony\\Component\\Console\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fabien Potencier",
                    "email": "fabien@symfony.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Eases the creation of beautiful and testable command line interfaces",
            "homepage": "https://symfony.com",
            "keywords": [
                "cli",
                "command-line",
                "console",
                "terminal"
            ],
            "support": {
                "source": "https://github.com/symfony/console/tree/v6.4.31"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-12-22T08:30:34+00:00"
        },
        {
            "name": "symfony/deprecation-contracts",
            "version": "v3.6.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/deprecation-contracts.git",
                "reference": "63afe740e99a13ba87ec199bb07bbdee937a5b62"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/deprecation-contracts/zipball/63afe740e99a13ba87ec199bb07bbdee937a5b62",
                "reference": "63afe740e99a13ba87ec199bb07bbdee937a5b62",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/contracts",
                    "name": "symfony/contracts"
                },
                "branch-alias": {
                    "dev-main": "3.6-dev"
                }
            },
            "autoload": {
                "files": [
                    "function.php"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "A generic function and convention to trigger deprecation notices",
            "homepage": "https://symfony.com",
            "support": {
                "source": "https://github.com/symfony/deprecation-contracts/tree/v3.6.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2024-09-25T14:21:43+00:00"
        },
        {
            "name": "symfony/error-handler",
            "version": "v6.4.26",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/error-handler.git",
                "reference": "41bedcaec5b72640b0ec2096547b75fda72ead6c"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/error-handler/zipball/41bedcaec5b72640b0ec2096547b75fda72ead6c",
                "reference": "41bedcaec5b72640b0ec2096547b75fda72ead6c",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "psr/log": "^1|^2|^3",
                "symfony/var-dumper": "^5.4|^6.0|^7.0"
            },
            "conflict": {
                "symfony/deprecation-contracts": "<2.5",
                "symfony/http-kernel": "<6.4"
            },
            "require-dev": {
                "symfony/deprecation-contracts": "^2.5|^3",
                "symfony/http-kernel": "^6.4|^7.0",
                "symfony/serializer": "^5.4|^6.0|^7.0"
            },
            "bin": [
                "Resources/bin/patch-type-declarations"
            ],
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Symfony\\Component\\ErrorHandler\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fabien Potencier",
                    "email": "fabien@symfony.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Provides tools to manage errors and ease debugging PHP code",
            "homepage": "https://symfony.com",
            "support": {
                "source": "https://github.com/symfony/error-handler/tree/v6.4.26"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-09-11T09:57:09+00:00"
        },
        {
            "name": "symfony/event-dispatcher",
            "version": "v7.4.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/event-dispatcher.git",
                "reference": "9dddcddff1ef974ad87b3708e4b442dc38b2261d"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/event-dispatcher/zipball/9dddcddff1ef974ad87b3708e4b442dc38b2261d",
                "reference": "9dddcddff1ef974ad87b3708e4b442dc38b2261d",
                "shasum": ""
            },
            "require": {
                "php": ">=8.2",
                "symfony/event-dispatcher-contracts": "^2.5|^3"
            },
            "conflict": {
                "symfony/dependency-injection": "<6.4",
                "symfony/service-contracts": "<2.5"
            },
            "provide": {
                "psr/event-dispatcher-implementation": "1.0",
                "symfony/event-dispatcher-implementation": "2.0|3.0"
            },
            "require-dev": {
                "psr/log": "^1|^2|^3",
                "symfony/config": "^6.4|^7.0|^8.0",
                "symfony/dependency-injection": "^6.4|^7.0|^8.0",
                "symfony/error-handler": "^6.4|^7.0|^8.0",
                "symfony/expression-language": "^6.4|^7.0|^8.0",
                "symfony/framework-bundle": "^6.4|^7.0|^8.0",
                "symfony/http-foundation": "^6.4|^7.0|^8.0",
                "symfony/service-contracts": "^2.5|^3",
                "symfony/stopwatch": "^6.4|^7.0|^8.0"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Symfony\\Component\\EventDispatcher\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fabien Potencier",
                    "email": "fabien@symfony.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Provides tools that allow your application components to communicate with each other by dispatching events and listening to them",
            "homepage": "https://symfony.com",
            "support": {
                "source": "https://github.com/symfony/event-dispatcher/tree/v7.4.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-10-28T09:38:46+00:00"
        },
        {
            "name": "symfony/event-dispatcher-contracts",
            "version": "v3.6.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/event-dispatcher-contracts.git",
                "reference": "59eb412e93815df44f05f342958efa9f46b1e586"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/event-dispatcher-contracts/zipball/59eb412e93815df44f05f342958efa9f46b1e586",
                "reference": "59eb412e93815df44f05f342958efa9f46b1e586",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "psr/event-dispatcher": "^1"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/contracts",
                    "name": "symfony/contracts"
                },
                "branch-alias": {
                    "dev-main": "3.6-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Symfony\\Contracts\\EventDispatcher\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Generic abstractions related to dispatching event",
            "homepage": "https://symfony.com",
            "keywords": [
                "abstractions",
                "contracts",
                "decoupling",
                "interfaces",
                "interoperability",
                "standards"
            ],
            "support": {
                "source": "https://github.com/symfony/event-dispatcher-contracts/tree/v3.6.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2024-09-25T14:21:43+00:00"
        },
        {
            "name": "symfony/finder",
            "version": "v6.4.31",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/finder.git",
                "reference": "5547f2e1f0ca8e2e7abe490156b62da778cfbe2b"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/finder/zipball/5547f2e1f0ca8e2e7abe490156b62da778cfbe2b",
                "reference": "5547f2e1f0ca8e2e7abe490156b62da778cfbe2b",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1"
            },
            "require-dev": {
                "symfony/filesystem": "^6.0|^7.0"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Symfony\\Component\\Finder\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fabien Potencier",
                    "email": "fabien@symfony.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Finds files and directories via an intuitive fluent interface",
            "homepage": "https://symfony.com",
            "support": {
                "source": "https://github.com/symfony/finder/tree/v6.4.31"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-12-11T14:52:17+00:00"
        },
        {
            "name": "symfony/http-foundation",
            "version": "v6.4.31",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/http-foundation.git",
                "reference": "a35ee6f47e4775179704d7877a8b0da3cb09241a"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/http-foundation/zipball/a35ee6f47e4775179704d7877a8b0da3cb09241a",
                "reference": "a35ee6f47e4775179704d7877a8b0da3cb09241a",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "symfony/deprecation-contracts": "^2.5|^3",
                "symfony/polyfill-mbstring": "~1.1",
                "symfony/polyfill-php83": "^1.27"
            },
            "conflict": {
                "symfony/cache": "<6.4.12|>=7.0,<7.1.5"
            },
            "require-dev": {
                "doctrine/dbal": "^2.13.1|^3|^4",
                "predis/predis": "^1.1|^2.0",
                "symfony/cache": "^6.4.12|^7.1.5",
                "symfony/dependency-injection": "^5.4|^6.0|^7.0",
                "symfony/expression-language": "^5.4|^6.0|^7.0",
                "symfony/http-kernel": "^5.4.12|^6.0.12|^6.1.4|^7.0",
                "symfony/mime": "^5.4|^6.0|^7.0",
                "symfony/rate-limiter": "^5.4|^6.0|^7.0"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Symfony\\Component\\HttpFoundation\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fabien Potencier",
                    "email": "fabien@symfony.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Defines an object-oriented layer for the HTTP specification",
            "homepage": "https://symfony.com",
            "support": {
                "source": "https://github.com/symfony/http-foundation/tree/v6.4.31"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-12-17T10:10:57+00:00"
        },
        {
            "name": "symfony/http-kernel",
            "version": "v6.4.31",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/http-kernel.git",
                "reference": "16b0d46d8e11f480345c15b229cfc827a8a0f731"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/http-kernel/zipball/16b0d46d8e11f480345c15b229cfc827a8a0f731",
                "reference": "16b0d46d8e11f480345c15b229cfc827a8a0f731",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "psr/log": "^1|^2|^3",
                "symfony/deprecation-contracts": "^2.5|^3",
                "symfony/error-handler": "^6.4|^7.0",
                "symfony/event-dispatcher": "^5.4|^6.0|^7.0",
                "symfony/http-foundation": "^6.4|^7.0",
                "symfony/polyfill-ctype": "^1.8"
            },
            "conflict": {
                "symfony/browser-kit": "<5.4",
                "symfony/cache": "<5.4",
                "symfony/config": "<6.1",
                "symfony/console": "<5.4",
                "symfony/dependency-injection": "<6.4",
                "symfony/doctrine-bridge": "<5.4",
                "symfony/form": "<5.4",
                "symfony/http-client": "<5.4",
                "symfony/http-client-contracts": "<2.5",
                "symfony/mailer": "<5.4",
                "symfony/messenger": "<5.4",
                "symfony/translation": "<5.4",
                "symfony/translation-contracts": "<2.5",
                "symfony/twig-bridge": "<5.4",
                "symfony/validator": "<6.4",
                "symfony/var-dumper": "<6.3",
                "twig/twig": "<2.13"
            },
            "provide": {
                "psr/log-implementation": "1.0|2.0|3.0"
            },
            "require-dev": {
                "psr/cache": "^1.0|^2.0|^3.0",
                "symfony/browser-kit": "^5.4|^6.0|^7.0",
                "symfony/clock": "^6.2|^7.0",
                "symfony/config": "^6.1|^7.0",
                "symfony/console": "^5.4|^6.0|^7.0",
                "symfony/css-selector": "^5.4|^6.0|^7.0",
                "symfony/dependency-injection": "^6.4|^7.0",
                "symfony/dom-crawler": "^5.4|^6.0|^7.0",
                "symfony/expression-language": "^5.4|^6.0|^7.0",
                "symfony/finder": "^5.4|^6.0|^7.0",
                "symfony/http-client-contracts": "^2.5|^3",
                "symfony/process": "^5.4|^6.0|^7.0",
                "symfony/property-access": "^5.4.5|^6.0.5|^7.0",
                "symfony/routing": "^5.4|^6.0|^7.0",
                "symfony/serializer": "^6.4.4|^7.0.4",
                "symfony/stopwatch": "^5.4|^6.0|^7.0",
                "symfony/translation": "^5.4|^6.0|^7.0",
                "symfony/translation-contracts": "^2.5|^3",
                "symfony/uid": "^5.4|^6.0|^7.0",
                "symfony/validator": "^6.4|^7.0",
                "symfony/var-dumper": "^5.4|^6.4|^7.0",
                "symfony/var-exporter": "^6.2|^7.0",
                "twig/twig": "^2.13|^3.0.4"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Symfony\\Component\\HttpKernel\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fabien Potencier",
                    "email": "fabien@symfony.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Provides a structured process for converting a Request into a Response",
            "homepage": "https://symfony.com",
            "support": {
                "source": "https://github.com/symfony/http-kernel/tree/v6.4.31"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-12-31T08:27:27+00:00"
        },
        {
            "name": "symfony/mime",
            "version": "v6.4.30",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/mime.git",
                "reference": "69aeef5d2692bb7c18ce133b09f67b27260b7acf"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/mime/zipball/69aeef5d2692bb7c18ce133b09f67b27260b7acf",
                "reference": "69aeef5d2692bb7c18ce133b09f67b27260b7acf",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "symfony/deprecation-contracts": "^2.5|^3",
                "symfony/polyfill-intl-idn": "^1.10",
                "symfony/polyfill-mbstring": "^1.0"
            },
            "conflict": {
                "egulias/email-validator": "~3.0.0",
                "phpdocumentor/reflection-docblock": "<3.2.2",
                "phpdocumentor/type-resolver": "<1.4.0",
                "symfony/mailer": "<5.4",
                "symfony/serializer": "<6.4.3|>7.0,<7.0.3"
            },
            "require-dev": {
                "egulias/email-validator": "^2.1.10|^3.1|^4",
                "league/html-to-markdown": "^5.0",
                "phpdocumentor/reflection-docblock": "^3.0|^4.0|^5.0",
                "symfony/dependency-injection": "^5.4|^6.0|^7.0",
                "symfony/process": "^5.4|^6.4|^7.0",
                "symfony/property-access": "^5.4|^6.0|^7.0",
                "symfony/property-info": "^5.4|^6.0|^7.0",
                "symfony/serializer": "^6.4.3|^7.0.3"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Symfony\\Component\\Mime\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fabien Potencier",
                    "email": "fabien@symfony.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Allows manipulating MIME messages",
            "homepage": "https://symfony.com",
            "keywords": [
                "mime",
                "mime-type"
            ],
            "support": {
                "source": "https://github.com/symfony/mime/tree/v6.4.30"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-11-16T09:57:53+00:00"
        },
        {
            "name": "symfony/polyfill-ctype",
            "version": "v1.33.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/polyfill-ctype.git",
                "reference": "a3cc8b044a6ea513310cbd48ef7333b384945638"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/polyfill-ctype/zipball/a3cc8b044a6ea513310cbd48ef7333b384945638",
                "reference": "a3cc8b044a6ea513310cbd48ef7333b384945638",
                "shasum": ""
            },
            "require": {
                "php": ">=7.2"
            },
            "provide": {
                "ext-ctype": "*"
            },
            "suggest": {
                "ext-ctype": "For best performance"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/polyfill",
                    "name": "symfony/polyfill"
                }
            },
            "autoload": {
                "files": [
                    "bootstrap.php"
                ],
                "psr-4": {
                    "Symfony\\Polyfill\\Ctype\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Gert de Pagter",
                    "email": "BackEndTea@gmail.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Symfony polyfill for ctype functions",
            "homepage": "https://symfony.com",
            "keywords": [
                "compatibility",
                "ctype",
                "polyfill",
                "portable"
            ],
            "support": {
                "source": "https://github.com/symfony/polyfill-ctype/tree/v1.33.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2024-09-09T11:45:10+00:00"
        },
        {
            "name": "symfony/polyfill-intl-grapheme",
            "version": "v1.33.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/polyfill-intl-grapheme.git",
                "reference": "380872130d3a5dd3ace2f4010d95125fde5d5c70"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/polyfill-intl-grapheme/zipball/380872130d3a5dd3ace2f4010d95125fde5d5c70",
                "reference": "380872130d3a5dd3ace2f4010d95125fde5d5c70",
                "shasum": ""
            },
            "require": {
                "php": ">=7.2"
            },
            "suggest": {
                "ext-intl": "For best performance"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/polyfill",
                    "name": "symfony/polyfill"
                }
            },
            "autoload": {
                "files": [
                    "bootstrap.php"
                ],
                "psr-4": {
                    "Symfony\\Polyfill\\Intl\\Grapheme\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Symfony polyfill for intl's grapheme_* functions",
            "homepage": "https://symfony.com",
            "keywords": [
                "compatibility",
                "grapheme",
                "intl",
                "polyfill",
                "portable",
                "shim"
            ],
            "support": {
                "source": "https://github.com/symfony/polyfill-intl-grapheme/tree/v1.33.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-06-27T09:58:17+00:00"
        },
        {
            "name": "symfony/polyfill-intl-idn",
            "version": "v1.33.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/polyfill-intl-idn.git",
                "reference": "9614ac4d8061dc257ecc64cba1b140873dce8ad3"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/polyfill-intl-idn/zipball/9614ac4d8061dc257ecc64cba1b140873dce8ad3",
                "reference": "9614ac4d8061dc257ecc64cba1b140873dce8ad3",
                "shasum": ""
            },
            "require": {
                "php": ">=7.2",
                "symfony/polyfill-intl-normalizer": "^1.10"
            },
            "suggest": {
                "ext-intl": "For best performance"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/polyfill",
                    "name": "symfony/polyfill"
                }
            },
            "autoload": {
                "files": [
                    "bootstrap.php"
                ],
                "psr-4": {
                    "Symfony\\Polyfill\\Intl\\Idn\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Laurent Bassin",
                    "email": "laurent@bassin.info"
                },
                {
                    "name": "Trevor Rowbotham",
                    "email": "trevor.rowbotham@pm.me"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Symfony polyfill for intl's idn_to_ascii and idn_to_utf8 functions",
            "homepage": "https://symfony.com",
            "keywords": [
                "compatibility",
                "idn",
                "intl",
                "polyfill",
                "portable",
                "shim"
            ],
            "support": {
                "source": "https://github.com/symfony/polyfill-intl-idn/tree/v1.33.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2024-09-10T14:38:51+00:00"
        },
        {
            "name": "symfony/polyfill-intl-normalizer",
            "version": "v1.33.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/polyfill-intl-normalizer.git",
                "reference": "3833d7255cc303546435cb650316bff708a1c75c"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/polyfill-intl-normalizer/zipball/3833d7255cc303546435cb650316bff708a1c75c",
                "reference": "3833d7255cc303546435cb650316bff708a1c75c",
                "shasum": ""
            },
            "require": {
                "php": ">=7.2"
            },
            "suggest": {
                "ext-intl": "For best performance"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/polyfill",
                    "name": "symfony/polyfill"
                }
            },
            "autoload": {
                "files": [
                    "bootstrap.php"
                ],
                "psr-4": {
                    "Symfony\\Polyfill\\Intl\\Normalizer\\": ""
                },
                "classmap": [
                    "Resources/stubs"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Symfony polyfill for intl's Normalizer class and related functions",
            "homepage": "https://symfony.com",
            "keywords": [
                "compatibility",
                "intl",
                "normalizer",
                "polyfill",
                "portable",
                "shim"
            ],
            "support": {
                "source": "https://github.com/symfony/polyfill-intl-normalizer/tree/v1.33.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2024-09-09T11:45:10+00:00"
        },
        {
            "name": "symfony/polyfill-mbstring",
            "version": "v1.33.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/polyfill-mbstring.git",
                "reference": "6d857f4d76bd4b343eac26d6b539585d2bc56493"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/polyfill-mbstring/zipball/6d857f4d76bd4b343eac26d6b539585d2bc56493",
                "reference": "6d857f4d76bd4b343eac26d6b539585d2bc56493",
                "shasum": ""
            },
            "require": {
                "ext-iconv": "*",
                "php": ">=7.2"
            },
            "provide": {
                "ext-mbstring": "*"
            },
            "suggest": {
                "ext-mbstring": "For best performance"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/polyfill",
                    "name": "symfony/polyfill"
                }
            },
            "autoload": {
                "files": [
                    "bootstrap.php"
                ],
                "psr-4": {
                    "Symfony\\Polyfill\\Mbstring\\": ""
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Symfony polyfill for the Mbstring extension",
            "homepage": "https://symfony.com",
            "keywords": [
                "compatibility",
                "mbstring",
                "polyfill",
                "portable",
                "shim"
            ],
            "support": {
                "source": "https://github.com/symfony/polyfill-mbstring/tree/v1.33.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2024-12-23T08:48:59+00:00"
        },
        {
            "name": "symfony/polyfill-php56",
            "version": "v1.20.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/polyfill-php56.git",
                "reference": "54b8cd7e6c1643d78d011f3be89f3ef1f9f4c675"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/polyfill-php56/zipball/54b8cd7e6c1643d78d011f3be89f3ef1f9f4c675",
                "reference": "54b8cd7e6c1643d78d011f3be89f3ef1f9f4c675",
                "shasum": ""
            },
            "require": {
                "php": ">=7.1"
            },
            "type": "metapackage",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/polyfill",
                    "name": "symfony/polyfill"
                },
                "branch-alias": {
                    "dev-main": "1.20-dev"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Symfony polyfill backporting some PHP 5.6+ features to lower PHP versions",
            "homepage": "https://symfony.com",
            "keywords": [
                "compatibility",
                "polyfill",
                "portable",
                "shim"
            ],
            "support": {
                "source": "https://github.com/symfony/polyfill-php56/tree/v1.20.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2020-10-23T14:02:19+00:00"
        },
        {
            "name": "symfony/polyfill-php80",
            "version": "v1.33.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/polyfill-php80.git",
                "reference": "0cc9dd0f17f61d8131e7df6b84bd344899fe2608"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/polyfill-php80/zipball/0cc9dd0f17f61d8131e7df6b84bd344899fe2608",
                "reference": "0cc9dd0f17f61d8131e7df6b84bd344899fe2608",
                "shasum": ""
            },
            "require": {
                "php": ">=7.2"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/polyfill",
                    "name": "symfony/polyfill"
                }
            },
            "autoload": {
                "files": [
                    "bootstrap.php"
                ],
                "psr-4": {
                    "Symfony\\Polyfill\\Php80\\": ""
                },
                "classmap": [
                    "Resources/stubs"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Ion Bazan",
                    "email": "ion.bazan@gmail.com"
                },
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Symfony polyfill backporting some PHP 8.0+ features to lower PHP versions",
            "homepage": "https://symfony.com",
            "keywords": [
                "compatibility",
                "polyfill",
                "portable",
                "shim"
            ],
            "support": {
                "source": "https://github.com/symfony/polyfill-php80/tree/v1.33.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-01-02T08:10:11+00:00"
        },
        {
            "name": "symfony/polyfill-php83",
            "version": "v1.33.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/polyfill-php83.git",
                "reference": "17f6f9a6b1735c0f163024d959f700cfbc5155e5"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/polyfill-php83/zipball/17f6f9a6b1735c0f163024d959f700cfbc5155e5",
                "reference": "17f6f9a6b1735c0f163024d959f700cfbc5155e5",
                "shasum": ""
            },
            "require": {
                "php": ">=7.2"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/polyfill",
                    "name": "symfony/polyfill"
                }
            },
            "autoload": {
                "files": [
                    "bootstrap.php"
                ],
                "psr-4": {
                    "Symfony\\Polyfill\\Php83\\": ""
                },
                "classmap": [
                    "Resources/stubs"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Symfony polyfill backporting some PHP 8.3+ features to lower PHP versions",
            "homepage": "https://symfony.com",
            "keywords": [
                "compatibility",
                "polyfill",
                "portable",
                "shim"
            ],
            "support": {
                "source": "https://github.com/symfony/polyfill-php83/tree/v1.33.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-07-08T02:45:35+00:00"
        },
        {
            "name": "symfony/process",
            "version": "v6.4.31",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/process.git",
                "reference": "8541b7308fca001320e90bca8a73a28aa5604a6e"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/process/zipball/8541b7308fca001320e90bca8a73a28aa5604a6e",
                "reference": "8541b7308fca001320e90bca8a73a28aa5604a6e",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "Symfony\\Component\\Process\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fabien Potencier",
                    "email": "fabien@symfony.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Executes commands in sub-processes",
            "homepage": "https://symfony.com",
            "support": {
                "source": "https://github.com/symfony/process/tree/v6.4.31"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-12-15T19:26:35+00:00"
        },
        {
            "name": "symfony/service-contracts",
            "version": "v3.6.1",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/service-contracts.git",
                "reference": "45112560a3ba2d715666a509a0bc9521d10b6c43"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/service-contracts/zipball/45112560a3ba2d715666a509a0bc9521d10b6c43",
                "reference": "45112560a3ba2d715666a509a0bc9521d10b6c43",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "psr/container": "^1.1|^2.0",
                "symfony/deprecation-contracts": "^2.5|^3"
            },
            "conflict": {
                "ext-psr": "<1.1|>=2"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/contracts",
                    "name": "symfony/contracts"
                },
                "branch-alias": {
                    "dev-main": "3.6-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Symfony\\Contracts\\Service\\": ""
                },
                "exclude-from-classmap": [
                    "/Test/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Generic abstractions related to writing services",
            "homepage": "https://symfony.com",
            "keywords": [
                "abstractions",
                "contracts",
                "decoupling",
                "interfaces",
                "interoperability",
                "standards"
            ],
            "support": {
                "source": "https://github.com/symfony/service-contracts/tree/v3.6.1"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-07-15T11:30:57+00:00"
        },
        {
            "name": "symfony/string",
            "version": "v7.4.0",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/string.git",
                "reference": "d50e862cb0a0e0886f73ca1f31b865efbb795003"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/string/zipball/d50e862cb0a0e0886f73ca1f31b865efbb795003",
                "reference": "d50e862cb0a0e0886f73ca1f31b865efbb795003",
                "shasum": ""
            },
            "require": {
                "php": ">=8.2",
                "symfony/deprecation-contracts": "^2.5|^3.0",
                "symfony/polyfill-ctype": "~1.8",
                "symfony/polyfill-intl-grapheme": "~1.33",
                "symfony/polyfill-intl-normalizer": "~1.0",
                "symfony/polyfill-mbstring": "~1.0"
            },
            "conflict": {
                "symfony/translation-contracts": "<2.5"
            },
            "require-dev": {
                "symfony/emoji": "^7.1|^8.0",
                "symfony/http-client": "^6.4|^7.0|^8.0",
                "symfony/intl": "^6.4|^7.0|^8.0",
                "symfony/translation-contracts": "^2.5|^3.0",
                "symfony/var-exporter": "^6.4|^7.0|^8.0"
            },
            "type": "library",
            "autoload": {
                "files": [
                    "Resources/functions.php"
                ],
                "psr-4": {
                    "Symfony\\Component\\String\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Provides an object-oriented API to strings and deals with bytes, UTF-8 code points and grapheme clusters in a unified way",
            "homepage": "https://symfony.com",
            "keywords": [
                "grapheme",
                "i18n",
                "string",
                "unicode",
                "utf-8",
                "utf8"
            ],
            "support": {
                "source": "https://github.com/symfony/string/tree/v7.4.0"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-11-27T13:27:24+00:00"
        },
        {
            "name": "symfony/translation",
            "version": "v6.4.31",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/translation.git",
                "reference": "81579408ecf7dc5aa2d8462a6d5c3a430a80e6f2"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/translation/zipball/81579408ecf7dc5aa2d8462a6d5c3a430a80e6f2",
                "reference": "81579408ecf7dc5aa2d8462a6d5c3a430a80e6f2",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "symfony/deprecation-contracts": "^2.5|^3",
                "symfony/polyfill-mbstring": "~1.0",
                "symfony/translation-contracts": "^2.5|^3.0"
            },
            "conflict": {
                "symfony/config": "<5.4",
                "symfony/console": "<5.4",
                "symfony/dependency-injection": "<5.4",
                "symfony/http-client-contracts": "<2.5",
                "symfony/http-kernel": "<5.4",
                "symfony/service-contracts": "<2.5",
                "symfony/twig-bundle": "<5.4",
                "symfony/yaml": "<5.4"
            },
            "provide": {
                "symfony/translation-implementation": "2.3|3.0"
            },
            "require-dev": {
                "nikic/php-parser": "^4.18|^5.0",
                "psr/log": "^1|^2|^3",
                "symfony/config": "^5.4|^6.0|^7.0",
                "symfony/console": "^5.4|^6.0|^7.0",
                "symfony/dependency-injection": "^5.4|^6.0|^7.0",
                "symfony/finder": "^5.4|^6.0|^7.0",
                "symfony/http-client-contracts": "^2.5|^3.0",
                "symfony/http-kernel": "^5.4|^6.0|^7.0",
                "symfony/intl": "^5.4|^6.0|^7.0",
                "symfony/polyfill-intl-icu": "^1.21",
                "symfony/routing": "^5.4|^6.0|^7.0",
                "symfony/service-contracts": "^2.5|^3",
                "symfony/yaml": "^5.4|^6.0|^7.0"
            },
            "type": "library",
            "autoload": {
                "files": [
                    "Resources/functions.php"
                ],
                "psr-4": {
                    "Symfony\\Component\\Translation\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Fabien Potencier",
                    "email": "fabien@symfony.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Provides tools to internationalize your application",
            "homepage": "https://symfony.com",
            "support": {
                "source": "https://github.com/symfony/translation/tree/v6.4.31"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-12-18T11:37:55+00:00"
        },
        {
            "name": "symfony/translation-contracts",
            "version": "v3.6.1",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/translation-contracts.git",
                "reference": "65a8bc82080447fae78373aa10f8d13b38338977"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/translation-contracts/zipball/65a8bc82080447fae78373aa10f8d13b38338977",
                "reference": "65a8bc82080447fae78373aa10f8d13b38338977",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1"
            },
            "type": "library",
            "extra": {
                "thanks": {
                    "url": "https://github.com/symfony/contracts",
                    "name": "symfony/contracts"
                },
                "branch-alias": {
                    "dev-main": "3.6-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Symfony\\Contracts\\Translation\\": ""
                },
                "exclude-from-classmap": [
                    "/Test/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Generic abstractions related to translation",
            "homepage": "https://symfony.com",
            "keywords": [
                "abstractions",
                "contracts",
                "decoupling",
                "interfaces",
                "interoperability",
                "standards"
            ],
            "support": {
                "source": "https://github.com/symfony/translation-contracts/tree/v3.6.1"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-07-15T13:41:35+00:00"
        },
        {
            "name": "symfony/var-dumper",
            "version": "v6.4.26",
            "source": {
                "type": "git",
                "url": "https://github.com/symfony/var-dumper.git",
                "reference": "cfae1497a2f1eaad78dbc0590311c599c7178d4a"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/symfony/var-dumper/zipball/cfae1497a2f1eaad78dbc0590311c599c7178d4a",
                "reference": "cfae1497a2f1eaad78dbc0590311c599c7178d4a",
                "shasum": ""
            },
            "require": {
                "php": ">=8.1",
                "symfony/deprecation-contracts": "^2.5|^3",
                "symfony/polyfill-mbstring": "~1.0"
            },
            "conflict": {
                "symfony/console": "<5.4"
            },
            "require-dev": {
                "symfony/console": "^5.4|^6.0|^7.0",
                "symfony/error-handler": "^6.3|^7.0",
                "symfony/http-kernel": "^5.4|^6.0|^7.0",
                "symfony/process": "^5.4|^6.0|^7.0",
                "symfony/uid": "^5.4|^6.0|^7.0",
                "twig/twig": "^2.13|^3.0.4"
            },
            "bin": [
                "Resources/bin/var-dump-server"
            ],
            "type": "library",
            "autoload": {
                "files": [
                    "Resources/functions/dump.php"
                ],
                "psr-4": {
                    "Symfony\\Component\\VarDumper\\": ""
                },
                "exclude-from-classmap": [
                    "/Tests/"
                ]
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Nicolas Grekas",
                    "email": "p@tchwork.com"
                },
                {
                    "name": "Symfony Community",
                    "homepage": "https://symfony.com/contributors"
                }
            ],
            "description": "Provides mechanisms for walking through any arbitrary PHP variable",
            "homepage": "https://symfony.com",
            "keywords": [
                "debug",
                "dump"
            ],
            "support": {
                "source": "https://github.com/symfony/var-dumper/tree/v6.4.26"
            },
            "funding": [
                {
                    "url": "https://symfony.com/sponsor",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/fabpot",
                    "type": "github"
                },
                {
                    "url": "https://github.com/nicolas-grekas",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/symfony/symfony",
                    "type": "tidelift"
                }
            ],
            "time": "2025-09-25T15:37:27+00:00"
        },
        {
            "name": "vlucas/phpdotenv",
            "version": "v5.6.3",
            "source": {
                "type": "git",
                "url": "https://github.com/vlucas/phpdotenv.git",
                "reference": "955e7815d677a3eaa7075231212f2110983adecc"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/vlucas/phpdotenv/zipball/955e7815d677a3eaa7075231212f2110983adecc",
                "reference": "955e7815d677a3eaa7075231212f2110983adecc",
                "shasum": ""
            },
            "require": {
                "ext-pcre": "*",
                "graham-campbell/result-type": "^1.1.4",
                "php": "^7.2.5 || ^8.0",
                "phpoption/phpoption": "^1.9.5",
                "symfony/polyfill-ctype": "^1.26",
                "symfony/polyfill-mbstring": "^1.26",
                "symfony/polyfill-php80": "^1.26"
            },
            "require-dev": {
                "bamarni/composer-bin-plugin": "^1.8.2",
                "ext-filter": "*",
                "phpunit/phpunit": "^8.5.34 || ^9.6.13 || ^10.4.2"
            },
            "suggest": {
                "ext-filter": "Required to use the boolean validator."
            },
            "type": "library",
            "extra": {
                "bamarni-bin": {
                    "bin-links": true,
                    "forward-command": false
                },
                "branch-alias": {
                    "dev-master": "5.6-dev"
                }
            },
            "autoload": {
                "psr-4": {
                    "Dotenv\\": "src/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "BSD-3-Clause"
            ],
            "authors": [
                {
                    "name": "Graham Campbell",
                    "email": "hello@gjcampbell.co.uk",
                    "homepage": "https://github.com/GrahamCampbell"
                },
                {
                    "name": "Vance Lucas",
                    "email": "vance@vancelucas.com",
                    "homepage": "https://github.com/vlucas"
                }
            ],
            "description": "Loads environment variables from `.env` to `getenv()`, `$_ENV` and `$_SERVER` automagically.",
            "keywords": [
                "dotenv",
                "env",
                "environment"
            ],
            "support": {
                "issues": "https://github.com/vlucas/phpdotenv/issues",
                "source": "https://github.com/vlucas/phpdotenv/tree/v5.6.3"
            },
            "funding": [
                {
                    "url": "https://github.com/GrahamCampbell",
                    "type": "github"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/vlucas/phpdotenv",
                    "type": "tidelift"
                }
            ],
            "time": "2025-12-27T19:49:13+00:00"
        },
        {
            "name": "voku/portable-ascii",
            "version": "2.0.3",
            "source": {
                "type": "git",
                "url": "https://github.com/voku/portable-ascii.git",
                "reference": "b1d923f88091c6bf09699efcd7c8a1b1bfd7351d"
            },
            "dist": {
                "type": "zip",
                "url": "https://api.github.com/repos/voku/portable-ascii/zipball/b1d923f88091c6bf09699efcd7c8a1b1bfd7351d",
                "reference": "b1d923f88091c6bf09699efcd7c8a1b1bfd7351d",
                "shasum": ""
            },
            "require": {
                "php": ">=7.0.0"
            },
            "require-dev": {
                "phpunit/phpunit": "~6.0 || ~7.0 || ~9.0"
            },
            "suggest": {
                "ext-intl": "Use Intl for transliterator_transliterate() support"
            },
            "type": "library",
            "autoload": {
                "psr-4": {
                    "voku\\": "src/voku/"
                }
            },
            "notification-url": "https://packagist.org/downloads/",
            "license": [
                "MIT"
            ],
            "authors": [
                {
                    "name": "Lars Moelleken",
                    "homepage": "https://www.moelleken.org/"
                }
            ],
            "description": "Portable ASCII library - performance optimized (ascii) string functions for php.",
            "homepage": "https://github.com/voku/portable-ascii",
            "keywords": [
                "ascii",
                "clean",
                "php"
            ],
            "support": {
                "issues": "https://github.com/voku/portable-ascii/issues",
                "source": "https://github.com/voku/portable-ascii/tree/2.0.3"
            },
            "funding": [
                {
                    "url": "https://www.paypal.me/moelleken",
                    "type": "custom"
                },
                {
                    "url": "https://github.com/voku",
                    "type": "github"
                },
                {
                    "url": "https://opencollective.com/portable-ascii",
                    "type": "open_collective"
                },
                {
                    "url": "https://www.patreon.com/voku",
                    "type": "patreon"
                },
                {
                    "url": "https://tidelift.com/funding/github/packagist/voku/portable-ascii",
                    "type": "tidelift"
                }
            ],
            "time": "2024-11-21T01:49:47+00:00"
        }
    ],
    "packages-dev": [],
    "aliases": [],
    "minimum-stability": "stable",
    "stability-flags": {},
    "prefer-stable": false,
    "prefer-lowest": false,
    "platform": {
        "php": ">=8.1"
    },
    "platform-dev": {},
    "plugin-api-version": "2.9.0"
}



================================================
FILE: phpunit.xml
================================================
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="./vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true"
>
    <testsuites>
        <testsuite name="Application Test Suite">
            <directory suffix="Test.php">./tests</directory>
        </testsuite>
    </testsuites>
    <php>
        <env name="APP_ENV" value="testing"/>
        <env name="CACHE_DRIVER" value="array"/>
        <env name="QUEUE_CONNECTION" value="sync"/>
    </php>
</phpunit>



================================================
FILE: server.bat
================================================
php -S localhost:8000 -t public


================================================
FILE: vscode.bat
================================================
code .


================================================
FILE: .editorconfig
================================================
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 4
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2



================================================
FILE: .env.example
================================================
APP_NAME=Lumen
APP_ENV=local
APP_KEY=7a4da50cbb1e7ce7c37db492386397c8
APP_DEBUG=true
APP_URL=https://localhost
APP_TIMEZONE=UTC
APP_CACHE=false

FILES_DIR=\home
FILES_URL=https://localhost

API_TOKEN=xxxxxxxxxxxx

LOG_CHANNEL=stack
LOG_SLACK_WEBHOOK_URL=

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=database
DB_USERNAME=username
DB_PASSWORD=xxxxxxxxxxxx

DB_SQLITE_CONNECTION=sqlite
DB_SQLITE_DATABASE=db/database.db

CACHE_DRIVER=file
QUEUE_CONNECTION=sync


================================================
FILE: .styleci.yml
================================================
php:
  preset: laravel
  disabled:
    - unused_use
js: true
css: true



================================================
FILE: app/Console/Kernel.php
================================================
<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Laravel\Lumen\Console\Kernel as ConsoleKernel;
use App\Http\Controllers\TaskController;
use App\Helpers\Configs;
use App\Services\TelegramService;

class Kernel extends ConsoleKernel
{
    /**
     * The Artisan commands provided by your application.
     *
     * @var array
     */
    protected $commands = [
        //
    ];

    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        $schedule->call(function () {
            $controller = new TaskController();
            Configs::set('schedule:01.refresh_configs.start', date('Y-m-d H:i:s'), 'datetime');
            $ret = $controller->refresh_configs();
            Configs::set('schedule:02.refresh_configs.end', date('Y-m-d H:i:s'), 'datetime', $ret);

            echo "Tarefa: refresh_configs" . PHP_EOL;
            if ($ret) {
                echo "Executado!" . PHP_EOL;
                $telegramService = new TelegramService();
                $telegramService->sendMessage("⏰ Rotina executada: Atualização de configurações!");
                $telegramService->sendMessage("<pre>" . json_encode($ret, JSON_PRETTY_PRINT) . "</pre>");
            }
        })->dailyAt('00:00');

        $schedule->call(function () {
            $controller = new TaskController();
            Configs::set('schedule:03.refresh_files_size.start', date('Y-m-d H:i:s'), 'datetime');
            $ret = $controller->refresh_files_size();
            Configs::set('schedule:04.refresh_files_size.end', date('Y-m-d H:i:s'), 'datetime', $ret);

            echo "Tarefa: refresh_files_size" . PHP_EOL;
            if ($ret) {
                echo "Executado!" . PHP_EOL;
                $telegramService = new TelegramService();
                $telegramService->sendMessage("⏰ Rotina executada: Atualização de tamanho de arquivos no Banco de Dados!");
                $telegramService->sendMessage("<pre>" . json_encode($ret, JSON_PRETTY_PRINT) . "</pre>");
            }
        })->hourly();

        $schedule->call(function () {
            $controller = new TaskController();
            Configs::set('schedule:05.refresh_files_duration.start', date('Y-m-d H:i:s'), 'datetime');
            $ret = $controller->refresh_files_duration();
            Configs::set('schedule:06.refresh_files_duration.end', date('Y-m-d H:i:s'), 'datetime', $ret);

            echo "Tarefa: refresh_files_duration" . PHP_EOL;
            if ($ret) {
                echo "Executado!" . PHP_EOL;
                $telegramService = new TelegramService();
                $telegramService->sendMessage("⏰ Rotina executada: Atualização de duração de arquivos no Banco de Dados!");
                $telegramService->sendMessage("<pre>" . json_encode($ret, JSON_PRETTY_PRINT) . "</pre>");
            }
        })->hourly();

        $schedule->call(function () {
            $controller = new TaskController();
            Configs::set('schedule:07.refresh_online_videos.start', date('Y-m-d H:i:s'), 'datetime');
            $ret = $controller->refresh_online_videos();
            Configs::set('schedule:08.refresh_online_videos.end', date('Y-m-d H:i:s'), 'datetime', $ret);

            echo "Tarefa: refresh_files_duration" . PHP_EOL;
            if ($ret) {
                echo "Executado!" . PHP_EOL;
                $telegramService = new TelegramService();
                $telegramService->sendMessage("⏰ Rotina executada: Atualização de vídeos online!");
                $telegramService->sendMessage("<pre>" . json_encode($ret, JSON_PRETTY_PRINT) . "</pre>");
            }
        })->monthly();
        //})->daily();

        $schedule->call(function () {
            $controller = new TaskController();
            Configs::set('schedule:09.export_database.start', date('Y-m-d H:i:s'), 'datetime');
            $ret = $controller->export_database();
            Configs::set('schedule:10.export_database.end', date('Y-m-d H:i:s'), 'datetime', $ret);

            echo "Tarefa: export_database" . PHP_EOL;
            if ($ret) {
                echo "Executado!" . PHP_EOL;
                $telegramService = new TelegramService();
                $telegramService->sendMessage("⏰ Rotina executada: Exportação de Banco de Dados!");
                $telegramService->sendMessage("<pre>" . json_encode($ret, JSON_PRETTY_PRINT) . "</pre>");
            }
        })->hourly();

        $schedule->call(function () {
            $controller = new TaskController();
            Configs::set('schedule:11.export_database_json.start', date('Y-m-d H:i:s'), 'datetime');
            $ret = $controller->export_database_json();
            Configs::set('schedule:12.export_database_json.end', date('Y-m-d H:i:s'), 'datetime', $ret);

            echo "Tarefa: export_database_json" . PHP_EOL;
            if ($ret) {
                echo "Executado!" . PHP_EOL;
                $telegramService = new TelegramService();
                $telegramService->sendMessage("⏰ Rotina executada: Exportação de Banco de Dados em JSON!");
                $telegramService->sendMessage("<pre>" . json_encode($ret, JSON_PRETTY_PRINT) . "</pre>");
            }
        })->hourly();

        $schedule->call(function () {
            $controller = new TaskController();
            Configs::set('schedule:13.send_database_ftp.start', date('Y-m-d H:i:s'), 'datetime');
            $ret = $controller->send_database_ftp();
            Configs::set('schedule:14.send_database_ftp.end', date('Y-m-d H:i:s'), 'datetime', $ret);

            echo "Tarefa: send_database_ftp" . PHP_EOL;
            if ($ret) {
                echo "Executado!" . PHP_EOL;
                $telegramService = new TelegramService();
                $telegramService->sendMessage("⏰ Rotina executada: Envio de Banco de Dados via FTP!");
                $telegramService->sendMessage("<pre>" . json_encode($ret, JSON_PRETTY_PRINT) . "</pre>");
            }
        })->hourly();

        //})->everyMinute();
    }
}
//php artisan schedule:run



================================================
FILE: app/Console/Commands/.gitkeep
================================================
[Empty file]


================================================
FILE: app/Events/Event.php
================================================
<?php

namespace App\Events;

use Illuminate\Queue\SerializesModels;

abstract class Event
{
    use SerializesModels;
}



================================================
FILE: app/Events/ExampleEvent.php
================================================
<?php

namespace App\Events;

class ExampleEvent extends Event
{
    /**
     * Create a new event instance.
     *
     * @return void
     */
    public function __construct()
    {
        //
    }
}



================================================
FILE: app/Exceptions/Handler.php
================================================
<?php

namespace App\Exceptions;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Laravel\Lumen\Exceptions\Handler as ExceptionHandler;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * A list of the exception types that should not be reported.
     *
     * @var array
     */
    protected $dontReport = [
        AuthorizationException::class,
        HttpException::class,
        ModelNotFoundException::class,
        ValidationException::class,
    ];

    /**
     * Report or log an exception.
     *
     * This is a great spot to send exceptions to Sentry, Bugsnag, etc.
     *
     * @param  \Throwable  $exception
     * @return void
     *
     * @throws \Exception
     */
    public function report(Throwable $exception)
    {
        parent::report($exception);
    }

    /**
     * Render an exception into an HTTP response.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Throwable  $exception
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
     *
     * @throws \Throwable
     */
    public function render($request, Throwable $exception)
    {
        $rendered = parent::render($request, $exception);

        if ($exception instanceof ValidationException) {
            $errors = $exception->errors();
            $errorMessages = [];

            foreach ($errors as $field => $messages) {
                foreach ($messages as $message) {
                    $errorMessages[] = $message;
                }
            }

            return response()->json([
                'error' => implode(PHP_EOL, $errorMessages),
                'messages' => $exception->errors(),
            ], 422);
        } elseif ($exception instanceof NotFoundHttpException) {
            $message = $exception->getMessage() ? $exception->getMessage() : Response::$statusTexts[$rendered->getStatusCode()];
            $exception = new NotFoundHttpException($message, $exception);
        } elseif ($exception instanceof HttpException) {
            $message = $exception->getMessage() ? $exception->getMessage() : Response::$statusTexts[$rendered->getStatusCode()];
            $exception = new HttpException($rendered->getStatusCode(), $message);
        } else {
            $statusCode = Response::HTTP_INTERNAL_SERVER_ERROR;
            $message = env('APP_DEBUG', false) ? $exception->getMessage() : Response::$statusTexts[$statusCode];
            $exception = new HttpException($statusCode, $message);
        }

        // Resonse
        return response()->json([
            'error' => $exception->getMessage(),
            'code' => $rendered->getStatusCode(),
        ], $rendered->getStatusCode());
    }
}



================================================
FILE: app/Helpers/Configs.php
================================================
<?php

namespace App\Helpers;

use App\Models\Config;
use App\Helpers\Tables;
use Illuminate\Support\Facades\DB;

class Configs
{

    public static function get($key = "")
    {
        if (is_array($key)) {
            $config = Config::select()->whereIn("key", $key)->get();
        } elseif ($key <> "") {
            $config = Config::select()->where("key", $key)->get();
        } else {
            $config = Config::select()->get();
        }

        $data = [];
        foreach ($config as $c) {
            if ($c["type"] == "json") {
                $data[$c["key"]] = json_decode($c["value"]);
            } elseif ($c["type"] == "number") {
                $data[$c["key"]] = +$c["value"];
            } else {
                $data[$c["key"]] = $c["value"];
            }
        }

        if ($key <> "" && !is_array($key)) {
            $data = $data[$key] ?? null;
        }
        return $data;
    }

    public static function set($key, $value = "", $type = "", $details = null)
    {
        if ($type == "") {
            if (is_numeric($value)) {
                $type = "number";
            } else {
                $type = "string";
            }
        }
        Config::where('key', $key)->delete();
        Config::create(['key' => $key, 'type' => $type, 'value' => $value, 'details' => $details]);

        $config = Configs::get($key);
        return [$key => $config];
    }

    public static function refresh()
    {
        Config::where('key', 'error')->delete();

        try {
            //Cria uma transação, pois em caso de erros, deve ser feito o rollback
            DB::beginTransaction();

            $tables = Tables::public();

            //Obter a data e hora da alteração mais recente
            $latestUpdatedAt = null;
            foreach ($tables as $table) {
                try {
                    $maxUpdatedAtInTable = DB::table($table)
                        ->orderBy('updated_at', 'desc')
                        ->value('updated_at');

                    if ($maxUpdatedAtInTable > $latestUpdatedAt) {
                        $latestUpdatedAt = $maxUpdatedAtInTable;
                    }
                } catch (\Exception $e) {
                    //
                }
            }

            $version = self::get("version");
            if ($version == strtotime($latestUpdatedAt)) {
                $status = "";
                $message = null;
            } else {

                $version_number = self::get("version_number");
                if ($version_number == "") {
                    $version_number = 1;
                } else {
                    $version_number++;
                }
                self::set("version_number", $version_number++);

                Config::where('key', 'latest_updated')->delete();
                Config::create(['key' => 'latest_updated', 'type' => 'datetime', 'value' => $latestUpdatedAt]);

                Config::where('key', 'version')->delete();
                Config::create(['key' => 'version', 'type' => 'number', 'value' => strtotime($latestUpdatedAt)]);


                //Grava data e hora da atualização
                Config::where('key', 'date')->delete();
                Config::create(['key' => 'date', 'type' => 'date', 'value' => date('Y-m-d')]);
                Config::where('key', 'time')->delete();
                Config::create(['key' => 'time', 'type' => 'time', 'value' => date('H:i:s')]);
                Config::where('key', 'datetime')->delete();
                Config::create(['key' => 'datetime', 'type' => 'datetime', 'value' => date('Y-m-d H:i:s')]);


                $status = "success";
                $message = null;
            }
            DB::commit();
        } catch (\Exception $e) {
            //Rollback em caso de erros
            DB::rollback();

            Config::where('key', 'error')->delete();
            Config::create(['key' => 'error', 'type' => 'string', 'value' => $e->getMessage()]);

            $status = "error";
            $message = $e->getMessage();
        }

        return ["status" => $status, "message" => $message];
    }
}



================================================
FILE: app/Helpers/Data.php
================================================
<?php

namespace App\Helpers;

use Illuminate\Support\Facades\DB;

class Data
{

    public static function data($data, $request, $fillable)
    {
        if ($request->limit && $request->limit <= 0) {
            $request->limit = 9999;
        }
        if ($request->sort_by) {
            $items = explode(",", $request->sort_by);
            foreach ($items as $item) {
                $f = explode(".", $item);
                $f[1] = (@$f[1] ? $f[1] : "asc");
                $data->orderBy($f[0], $f[1]);
            }
        }

        $fields = Data::arrayFilter($request->all(), $fillable);
        foreach ($fields as $field => $value) {
            $we = Data::whereExplode($value);

            if ($we['sep'] == "or") {
                $data->orWhere(DB::raw($field), $we['op'], $we['value']);
            } else {
                $data->where(DB::raw($field), $we['op'], $we['value']);
            }
        }
        //echo PHP_EOL . $data->toSql();
        //dd($data->toSql());
        return $data->paginate($request->limit);
    }

    public static function arrayFilter($all, $get)
    {
        $fields = [];
        foreach ($get as $field) {
            if ($field instanceof \Illuminate\Database\Query\Expression) {
                $field = $field->getValue(DB::connection()->getQueryGrammar());
            }
            // Se for um objeto que tem método getValue()
            elseif (is_object($field) && method_exists($field, 'getValue')) {
                $field = $field->getValue();
            }

            $sep = explode(' ', $field);
            if (count($sep) > 1) {
                $field = end($sep);
                array_pop($sep);
                if (end($sep) == 'as') {
                    array_pop($sep);
                }

                $tfield = implode(" ", $sep);
            } else {
                $field = end($sep);
                $tfield = $field;
            }

            $sep = explode('.', $field);
            $field = end($sep);

            if (isset($all[$field])) {
                $fields[$tfield] = $all[$field];
            }
        }
        return $fields;
    }

    public static function value($value)
    {
        if ($value == "true") {
            $value = true;
        } elseif ($value == "false") {
            $value = false;
        }
        return $value;
    }

    public static function whereExplode($text)
    {
        $type = '=';
        $value = $text;
        $sep = 'and';

        $term = explode(":", $text);
        if (!isset($term[1])) {
            $value = Data::value($value);
        } else {
            $op = $term[0];
            if ($op == "like" || $op == "orlike") {
                $type = "like";
                if ($op == "orlike") {
                    $sep = 'or';
                }
                unset($term[0]);
                $value = implode(":", $term);
                $value = str_replace("*", "%", $value);
                $value = Data::value($value);
            } elseif ($op == "or") {
                $sep = 'or';
                unset($term[0]);
                $value = implode(":", $term);
                $value = Data::value($value);
            } else {
                $value = Data::value($value);
            }
        }

        return ['op' => $type, 'value' => $value, 'sep' => $sep];
    }
}



================================================
FILE: app/Helpers/DataBase.php
================================================
<?php

namespace App\Helpers;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use App\Helpers\Tables;
use App\Helpers\Configs;
use App\Helpers\Files;
use App\Models\File as FileModel;
use App\Models\Music;
use App\Models\Category;
use App\Models\Album;
use App\Models\Lyric;
use App\Models\Language;
use App\Models\BibleVersion;
use App\Models\BibleBook;
use App\Models\BibleVerse;


class DataBase
{

    public static function fn_sqlite_no_accents($field)
    {
        return "
        LOWER(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        REPLACE(
        LOWER($field),
        'á', 'a'),
        'ã', 'a'),
        'â', 'a'),
        'à', 'a'),
        'é', 'e'),
        'ê', 'e'),
        'í', 'i'),
        'ó', 'o'),
        'õ', 'o'),
        'ô', 'o'),
        'ú', 'u'),
        'ç', 'c'),
        'É', 'e'),
        'Ê', 'e'),
        'Ó', 'o')
        )";
    }

    public static function save_file($dir, $name, $data)
    {
        try {
            file_put_contents($dir . $name, $data);
            return [
                'status' => 'success',
                'file' => $dir . $name,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
                'file' => $dir . $name,
            ];
        }
    }

    public static function export_json()
    {
        $logs = [];

        $path = app()->basePath('public/db/json/');
        if (!File::exists($path)) {
            File::makeDirectory($path, 0755, true);
        }

        /*$files = File::files($path);
        foreach ($files as $file) {
            File::delete($file);
        }*/

        $config = Configs::get(["version_number", "version", "datetime", "latest_updated"]);
        $ret = self::save_file($path, "config.json", json_encode($config));
        $logs[] = $ret;

        $langs = Language::orderBy("id_language", "desc")->get();
        foreach ($langs as $lang) {
            $l = $lang->id_language;

            $data = Music::select([
                'musics.id_music',
                'musics.name',
                DB::raw("if(ifnull(id_file_instrumental_music,0) > 0,1,0) as has_instrumental_music"),
                DB::raw("files_music.duration as duration"),
                DB::raw("(select group_concat(lyric separator ' ') from lyrics where lyrics.id_music=musics.id_music) as lyric"),
                DB::raw("(select group_concat(distinct albums.name separator '|')
                    from albums
                    inner join albums_musics on (albums_musics.id_album=albums.id_album)
                    inner join categories_albums on (categories_albums.id_album=albums.id_album)
                    inner join categories on (categories.id_category=categories_albums.id_category)
                    where 1=1
                    and categories.type in ('hymnal','collection')
                    and albums_musics.id_music=musics.id_music) as albums_names"),
            ])
                ->leftJoin('files as files_music', 'musics.id_file_music', 'files_music.id_file')
                ->where("id_language", $l)
                ->with(['albums' => function ($query) {
                    $query->select(['albums.id_album', 'albums.name', DB::raw('min(categories.order) as `order`'), 'categories.type'])
                        ->leftJoin('categories_albums', 'categories_albums.id_album', 'albums.id_album')
                        ->leftJoin('categories', 'categories.id_category', 'categories_albums.id_category')
                        ->whereIn('categories.type', ['hymnal', 'collection'])
                        ->groupBy(['albums.id_album', 'albums.name', 'albums_musics.id_music', 'albums_musics.id_album', 'albums_musics.track', 'categories.type'])
                        ->orderBy('order');
                }])
                ->get();
            //dd($data->toArray());
            $ret = self::save_file($path, $l . "_musics.json", $data->toJson());
            $logs[] = $ret;

            $categories = Category::select()->where("type", "hymnal")->where("id_language", $l)->get();
            foreach ($categories as $category) {
                $data = Music::select([
                    'musics.id_music',
                    'musics.name',
                    'albums_musics.track',
                    DB::raw("if(ifnull(id_file_instrumental_music,0) > 0,1,0) as has_instrumental_music"),
                    DB::raw("files_music.duration as duration"),
                    DB::raw("(select group_concat(lyric separator ' ') from lyrics where lyrics.id_music=musics.id_music) as lyric"),
                ])
                    ->leftJoin('files as files_music', 'musics.id_file_music', 'files_music.id_file')
                    ->join('albums_musics', 'albums_musics.id_music', 'musics.id_music')
                    ->join('categories_albums', 'categories_albums.id_album', 'albums_musics.id_album')
                    ->join('categories', 'categories.id_category', 'categories_albums.id_category')
                    ->where("categories.id_category", $category->id_category)
                    ->where("musics.id_language", $l)
                    ->orderBy('albums_musics.track')
                    ->get();
                //dd($data->toArray());
                $ret = self::save_file($path, $l . "_" . $category->slug . ".json", $data->toJson());
                $logs[] = $ret;
            }

            $data = Category::select([
                "id_category",
                "name",
                "slug",
                "order"
            ])
                ->where("type", "collection")->where("id_language", $l)
                ->orderBy("order")
                ->with(['albums' => function ($query) {
                    $query->select([
                        'albums.id_album',
                        'albums.name',
                        'albums.color',
                        DB::raw("concat(files_image.dir,'/',files_image.file_name) as url_image"),
                        DB::raw("categories_albums.name as subtitle"),
                        'categories_albums.order'
                    ])
                        ->leftJoin('files as files_image', 'albums.id_file_image', 'files_image.id_file')
                        ->orderBy('categories_albums.order');
                }])
                ->get();
            $data->each(function ($item) {
                $item->albums->makeHidden('pivot');
            });
            //dd($data->toArray());
            $ret = self::save_file($path, $l . "_categories.json", $data->toJson());
            $logs[] = $ret;

            $data = BibleVersion::select([
                "id_bible_version",
                "name",
                "abbreviation"
            ])
                ->where("id_language", $l)
                ->orderBy("name")
                ->get();
            //dd($data->toArray());
            $ret = self::save_file($path, $l . "_bible_version.json", $data->toJson());
            $logs[] = $ret;

            $data = BibleBook::select([
                "id_bible_book",
                "book_number",
                "name",
                "chapters",
                "testament",
                "keywords",
                "abbreviation",
                "color"
            ])
                ->where("id_language", $l)
                ->orderBy("book_number")
                ->get();
            //dd($data->toArray());
            $ret = self::save_file($path, $l . "_bible_book.json", $data->toJson());
            $logs[] = $ret;
        }


        $musics = Music::select([
            'musics.id_music',
            'musics.name',
            DB::raw("files_music.duration as duration"),
            DB::raw("files_instrumental_music.duration as instrumental_duration"),
            DB::raw("concat(files_image.dir,'/',files_image.file_name) as url_image"),
            DB::raw("files_image.image_position"),
            DB::raw("concat(files_music.dir,'/',files_music.file_name) as url_music"),
            DB::raw("concat(files_instrumental_music.dir,'/',files_instrumental_music.file_name) as url_instrumental_music"),
        ])
            ->leftJoin('files as files_image', 'musics.id_file_image', 'files_image.id_file')
            ->leftJoin('files as files_music', 'musics.id_file_music', 'files_music.id_file')
            ->leftJoin('files as files_instrumental_music', 'musics.id_file_instrumental_music', 'files_instrumental_music.id_file')
            ->with(['lyric' => function ($query) {
                $query->select([
                    'lyrics.id_lyric',
                    'lyrics.id_music',
                    'lyrics.lyric',
                    'lyrics.aux_lyric',
                    DB::raw("concat(files_image.dir,'/',files_image.file_name) as url_image"),
                    DB::raw("files_image.image_position"),
                    'lyrics.time',
                    DB::raw('if(lyrics.instrumental_time = 0,lyrics.time,lyrics.instrumental_time) as instrumental_time'),
                    'lyrics.show_slide',
                    'lyrics.order',
                ])
                    ->leftJoin('files as files_image', 'lyrics.id_file_image', 'files_image.id_file')
                    ->orderBy('lyrics.order', 'asc');
            }])
            ->with(['albums' => function ($query) {
                $query->select([
                    'albums.id_album',
                    'albums.name',
                    'albums_musics.track',
                    DB::raw("concat(files_image.dir,'/',files_image.file_name) as url_image"),
                    DB::raw('min(categories.order) as `order`'),
                ])
                    ->leftJoin('files as files_image', 'albums.id_file_image', 'files_image.id_file')
                    ->leftJoin('categories_albums', 'categories_albums.id_album', 'albums.id_album')
                    ->leftJoin('categories', 'categories.id_category', 'categories_albums.id_category')
                    ->whereIn('categories.type', ['hymnal', 'collection'])
                    ->groupBy(['albums.id_album', 'albums.name', 'albums_musics.id_music', 'albums_musics.id_album', 'albums_musics.track'])
                    ->orderBy('order')
                ;
            }])
            ->get();
        $musics->each(function ($item) {
            $item->albums->makeHidden('pivot');
        });
        foreach ($musics as $music) {
            $ret = self::save_file($path, "music_" . $music->id_music . ".json", $music->toJson());
            $logs[] = $ret;
        }
        //dd($musics->toJson());


        $albums = Album::select([
            'albums.id_album',
            'albums.name',
            'albums.color',
            DB::raw("concat(files_image.dir,'/',files_image.file_name) as url_image"),
            DB::raw("(
                select group_concat(concat(type,'.',slug) separator '|') from categories
                    inner join categories_albums on (categories_albums.id_category=categories.id_category)
                    where categories_albums.id_album=albums.id_album
            ) as categories"),
        ])
            ->leftJoin('files as files_image', 'albums.id_file_image', 'files_image.id_file')
            ->with(['musics' => function ($query) {
                $query->select([
                    'musics.id_music',
                    'musics.name',
                    DB::raw("if(ifnull(id_file_instrumental_music,0) > 0,1,0) as has_instrumental_music"),
                    DB::raw("files_music.duration as duration"),
                    'albums_musics.track',
                ])
                    ->leftJoin('files as files_music', 'musics.id_file_music', 'files_music.id_file')
                    ->orderBy('albums_musics.track', 'asc');
            }])
            ->get();
        $albums->each(function ($item) {
            $item->musics->makeHidden('pivot');
            $item->categories = explode("|", $item->categories);
        });
        //dd($albums->toJson());
        foreach ($albums as $album) {
            $ret = self::save_file($path, "album_" . $album->id_album . ".json", $album->toJson());
            $logs[] = $ret;
        }

        $verses = BibleVerse::select()
            ->orderBy('id_bible_version')
            ->orderBy('id_bible_book')
            ->orderBy('chapter')
            ->orderBy('verse')
            ->get();

        //dd($verses->toArray());
        $key = "";
        $data = [];
        foreach ($verses as $verse) {
            $last_key = $verse->id_bible_version . "_" . $verse->id_bible_book . "_" . $verse->chapter;
            if ($key <> $last_key) {
                if ($key <> "") {
                    $ret = self::save_file($path, "bible_" . $key . ".json", json_encode($data));
                    $logs[] = $ret;
                }
                $data = [];
                $key = $last_key;
            }
            $data[$verse->verse] =  $verse->text;
        }
        $ret = self::save_file($path, "bible_" . $key . ".json", json_encode($data));
        $logs[] = $ret;

        return $logs;
    }

    public static function export()
    {

        $database = env('DB_SQLITE_DATABASE');

        $langs =  Language::get();

        $log = [];
        $error = null;

        foreach ($langs as $lang) {
            $id_language = $lang->id_language;

            if (File::exists($database)) {
                unlink($database);
            }

            $dir_database = dirname($database);
            if ($dir_database <> "") {
                if (!file_exists($dir_database)) {
                    mkdir($dir_database, 0755, true);
                }
            }

            $tables = Tables::public();
            $system_tables = Tables::system();
            touch($database);

            Artisan::call('migrate', [
                '--database' => 'sqlite',
                '--path' => 'database/migrations',
            ]);

            DB::connection('sqlite')->statement("ATTACH DATABASE '{$database}' AS sqlite_db");
            foreach ($system_tables as $table) {
                DB::connection('sqlite')->statement("DROP TABLE IF EXISTS {$table}");
            }

            DB::connection('sqlite')->statement('PRAGMA foreign_keys = OFF;');

            $log[$id_language] = [];

            $chunkSize = 50;
            foreach ($tables as $table) {
                try {
                    $log[$id_language][$table]["table_name"] = $table;

                    if ($table == "languages") {
                        DB::connection('sqlite')->table($table)->truncate();
                    }

                    if ($table == "files") {
                        $data = DB::connection('mysql')->table($table)->get();
                    } else {
                        $data = DB::connection('mysql')->table($table)->where('id_language', $id_language)->get();
                    }
                    $log[$id_language][$table]["count"] = $data->count();
                    $chunks = array_chunk($data->toArray(), $chunkSize);
                    DB::connection('sqlite')->beginTransaction();
                    try {
                        foreach ($chunks as $chunk) {
                            $chunk = json_decode(json_encode($chunk), true);
                            DB::connection('sqlite')->table($table)->insert($chunk);
                        }
                        DB::connection('sqlite')->commit();
                    } catch (\Exception $e) {
                        DB::connection('sqlite')->rollBack();
                        $log[$id_language][$table]["error"] = $e->getMessage();
                        $log[$id_language][$table]["status"] = "error";
                    }
                } catch (\Exception $e) {
                    $log[$id_language][$table]["error"] = $e->getMessage();
                    $log[$id_language][$table]["status"] = "error";
                }
            }

            /* CRIAÇÃO DE VIEWS E TABELAS PARA RETROCOMPATIBILIDADE (COM A VERSÂO DELPHI) */

            DB::connection('sqlite')->statement("CREATE VIEW ALBUM AS
                SELECT
                    albums.id_album ID,
                    albums.name NOME,
                    files.file_name IMAGEM,
                    CASE WHEN categories.slug = 'hymnal'
                        THEN 'N'
                        ELSE 'S'
                    END AS PERMITE_DESATIVAR
                FROM albums
                LEFT JOIN files ON files.id_file = albums.id_file_image
                LEFT JOIN categories_albums ON categories_albums.id_album = albums.id_album
                LEFT JOIN categories ON categories.id_category = categories_albums.id_category
                WHERE albums.id_language = '" . $id_language . "'");

            DB::connection('sqlite')->statement("CREATE TABLE ALBUM_MUSICAS AS
                SELECT
                    albums_musics.id_album ID_ALBUM,
                    albums_musics.id_music ID_MUSICA,
                    albums_musics.track FAIXA
                FROM albums_musics
                WHERE albums_musics.id_language = '" . $id_language . "'");

            DB::connection('sqlite')->statement("CREATE VIEW ALBUM_TIPO AS
                SELECT
                    categories_albums.id_album ID_ALBUM,
                    CASE
                        WHEN categories.slug = 'misc' THEN 'DIV'
                        WHEN categories.slug = 'doxology' THEN 'DOX'
                        WHEN categories.slug = 'hymnal' THEN 'HASD'
                        WHEN categories.slug = 'hymnal_1996' THEN 'HASD_1996'
                        WHEN categories.slug = 'children' THEN 'INF'
                        WHEN categories.slug = 'aym' THEN 'JA_ANO'
                        ELSE 'DIV'
                    END AS TIPO,
                    categories_albums.name SUBTITULO,
                    categories_albums.`order` ORDEM
                FROM categories_albums
                LEFT JOIN categories ON categories.id_category = categories_albums.id_category
                WHERE categories_albums.id_language = '" . $id_language . "'");

            DB::connection('sqlite')->statement("CREATE TABLE TIPOS_ALBUM AS
                SELECT 'DIV' ID, 'Diversas' TIPO
                UNION
                SELECT 'DOX' ID, 'Doxologia' TIPO
                UNION
                SELECT 'HASD' ID, 'Hinário Adventista' TIPO
                UNION
                SELECT 'HASD_1996' ID, 'Hinário Adventista 1996' TIPO
                UNION
                SELECT 'INF' ID, 'Infantis' TIPO
                UNION
                SELECT 'JA_ANO' ID, 'CDs Oficiais/Ano' TIPO");

            DB::connection('sqlite')->statement("CREATE TABLE ARQUIVOS_ADICIONAIS AS
                SELECT '1' AS ID, '1minuto_escsb.mp3' AS ARQUIVO, 'config\\1minuto_escsb.mp3' AS URL
                UNION ALL
                SELECT '2' AS ID, '5minutos_escsb.mp3' AS ARQUIVO, 'config\\5minutos_escsb.mp3' AS URL
                UNION ALL
                SELECT '3' AS ID, 'abertura_escsb.mp3' AS ARQUIVO, 'config\\abertura_escsb.mp3' AS URL
                UNION ALL
                SELECT '4' AS ID, 'din-condensed-bold.ttf' AS ARQUIVO, 'config\\fontes\\din-condensed-bold.ttf' AS URL
                UNION ALL
                SELECT '6' AS ID, 'bass.dll' AS ARQUIVO, 'bass.dll' AS URL
                UNION ALL
                SELECT '7' AS ID, 'borlndmm.dll' AS ARQUIVO, 'borlndmm.dll' AS URL
                UNION ALL
                SELECT '8' AS ID, 'midas.dll' AS ARQUIVO, 'midas.dll' AS URL
                UNION ALL
                SELECT '10' AS ID, 'LouvorJA.exe' AS ARQUIVO, 'LouvorJA.exe' AS URL
                UNION ALL
                SELECT '11' AS ID, 'ssleay32.dll' AS ARQUIVO, 'ssleay32.dll' AS URL
                UNION ALL
                SELECT '12' AS ID, 'libeay32.dll' AS ARQUIVO, 'libeay32.dll' AS URL
                UNION ALL
                SELECT '13' AS ID, 'louvorja_slja.ico' AS ARQUIVO, 'config\\ico\\louvorja_slja.ico' AS URL
                UNION ALL
                SELECT '14' AS ID, 'pagina_nao_encontrada.htm' AS ARQUIVO, 'config\\server\\pagina_nao_encontrada.htm' AS URL
                UNION ALL
                SELECT '15' AS ID, 'page.htm' AS ARQUIVO, 'config\\server\\page.htm' AS URL
                UNION ALL
                SELECT '16' AS ID, 'index.htm' AS ARQUIVO, 'config\\server\\index.htm' AS URL
                UNION ALL
                SELECT '17' AS ID, 'file.ja' AS ARQUIVO, 'config\\server\\file\\file.ja' AS URL
                UNION ALL
                SELECT '18' AS ID, 'estilo.css' AS ARQUIVO, 'config\\server\\lib\\estilo.css' AS URL
                UNION ALL
                SELECT '19' AS ID, 'scripts.js' AS ARQUIVO, 'config\\server\\lib\\scripts.js' AS URL");

            DB::connection('sqlite')->statement("CREATE TABLE IMAGEM_POSICAO AS
                SELECT `name` IMAGEM,image_position POSICAO FROM files WHERE image_position IS NOT NULL");

            DB::connection('sqlite')->statement("CREATE VIEW MUSICAS AS
                SELECT
                    musics.id_music ID,
                    substr(files_url.dir, 12, 100) ALBUM,
                    musics.name NOME,
                    files_image.name IMAGEM,
                    files_url.name URL,
                    files_url_instrumental.name URL_INSTRUMENTAL,
                    upper(musics.id_language) IDIOMA,
                    0 TAMANHO_LETRA,
                    '' COR_LETRA,
                    1 FUNDO_LETRA,
                    files_image.size TAMANHO_IMAGEM,
                    files_url.size TAMANHO_ARQUIVO,
                    files_url_instrumental.size TAMANHO_ARQUIVO_PB,
                    (SELECT GROUP_CONCAT(lyric) FROM lyrics WHERE lyrics.id_music = musics.id_music) LETRA
                FROM musics
                INNER JOIN albums_musics ON albums_musics.id_music = musics.id_music
                LEFT JOIN files files_image ON files_image.id_file = musics.id_file_image
                LEFT JOIN files files_url ON files_url.id_file = musics.id_file_music
                LEFT JOIN files files_url_instrumental ON files_url_instrumental.id_file = musics.id_file_instrumental_music
                WHERE musics.id_language = '" . $id_language . "'");

            DB::connection('sqlite')->statement("CREATE VIEW MUSICAS_LETRA AS
                SELECT
                    lyrics.id_lyric ID,
                    lyrics.show_slide EXIBE_SLIDE,
                    lyrics.`order` ORDEM,
                    files.name IMAGEM,
                    lyrics.lyric LETRA,
                    '' COR_LETRA,
                    lyrics.id_music MUSICA,
                    lyrics.time TEMPO,
                    CASE WHEN lyrics.instrumental_time = '00:00:00'
                        THEN lyrics.time
                        ELSE lyrics.instrumental_time
                    END AS TEMPO_PB,
                    1 FUNDO_LETRA,
                    0 TAMANHO_LETRA,
                    lyrics.aux_lyric LETRA_AUX,
                    0 TAMANHO_LETRA_AUX,
                    '' COR_LETRA_AUX,
                    files.size TAMANHO_IMAGEM
                FROM lyrics
                LEFT JOIN files ON files.id_file = lyrics.id_file_image
                WHERE lyrics.id_language = '" . $id_language . "'");


            $version = Configs::get("version_number");
            DB::connection('sqlite')->statement("CREATE TABLE VERSAO AS
                SELECT
                    1 ID,
                    $version VERSAO_BD");

            DB::connection('sqlite')->statement("CREATE VIEW HINARIO_ADVENTISTA AS
                SELECT
                    musics.id_music ID,
                    albums_musics.track FAIXA,
                    musics.name NOME,
                    " . self::fn_sqlite_no_accents("musics.name") . " AS NOME_SEMAC,
                    SUBSTR('00' || albums_musics.track, -3, 3) || ' - ' || musics.name NOME_COM,
                    substr(files_url.dir, 12, 100) ALBUM,
                    files_url.name URL,
                    files_url_instrumental.name URL_INSTRUMENTAL
                FROM musics
                INNER JOIN albums_musics ON albums_musics.id_music = musics.id_music
                INNER JOIN categories_albums ON categories_albums.id_album = albums_musics.id_album
                INNER JOIN categories ON categories.id_category = categories_albums.id_category
                LEFT JOIN files files_url ON files_url.id_file = musics.id_file_music
                LEFT JOIN files files_url_instrumental ON files_url_instrumental.id_file = musics.id_file_instrumental_music
                WHERE musics.id_language = '" . $id_language . "'
                    AND categories.slug = 'hymnal'
                ORDER BY albums_musics.track");

            DB::connection('sqlite')->statement("CREATE VIEW HINARIO_ADVENTISTA_1996 AS
                SELECT
                    musics.id_music ID,
                    albums_musics.track FAIXA,
                    musics.name NOME,
                    " . self::fn_sqlite_no_accents("musics.name") . " AS NOME_SEMAC,
                    SUBSTR('00' || albums_musics.track, -3, 3) || ' - ' || musics.name NOME_COM,
                    substr(files_url.dir, 12, 100) ALBUM,
                    files_url.name URL,
                    files_url_instrumental.name URL_INSTRUMENTAL
                FROM musics
                INNER JOIN albums_musics ON albums_musics.id_music = musics.id_music
                INNER JOIN categories_albums ON categories_albums.id_album = albums_musics.id_album
                INNER JOIN categories ON categories.id_category = categories_albums.id_category
                LEFT JOIN files files_url ON files_url.id_file = musics.id_file_music
                LEFT JOIN files files_url_instrumental ON files_url_instrumental.id_file = musics.id_file_instrumental_music
                WHERE musics.id_language = '" . $id_language . "'
                    AND categories.slug = 'hymnal_1996'
                ORDER BY albums_musics.track");

            DB::connection('sqlite')->statement("CREATE TABLE _ALBUM_IGNORAR (ID INT)");
            DB::connection('sqlite')->statement("CREATE TABLE _COLETANEAS_PERSONALIZADAS (ID STRING, NOME STRING, URL STRING)");

            DB::connection('sqlite')->statement("CREATE TABLE ONL_CANAIS AS
                SELECT
                    channel_id CANAL_ID,title NOME,custom_url CUSTOM_URL,default_image IMAGEM,default_image_base64 IMAGEM_64
                FROM online_videos_channels
                WHERE id_language='" . $id_language . "'");

            DB::connection('sqlite')->statement("CREATE TABLE ONL_PLAYLISTS AS
                SELECT
                    playlist_id PLAYLIST_ID,
                    (SELECT channel_id FROM online_videos_channels WHERE online_videos_channels.id_online_video_channel=online_videos_playlists.id_online_video_channel) CANAL_ID,
                    title NOME,default_image IMAGEM,default_image_base64 IMAGEM_64
                FROM online_videos_playlists
                WHERE id_language='" . $id_language . "'");

            DB::connection('sqlite')->statement("CREATE TABLE ONL_VIDEOS AS
                SELECT
                    video_id VIDEO_ID,
                    (SELECT playlist_id FROM online_videos_playlists WHERE online_videos_playlists.id_online_video_playlist=online_videos.id_online_video_playlist) PLAYLIST_ID,
                    title NOME,sequence POSICAO,default_image IMAGEM,default_image_base64 IMAGEM_64
                FROM online_videos
                WHERE id_language='" . $id_language . "'");

            DB::connection('sqlite')->statement("CREATE TABLE ARQUIVOS_SISTEMA AS
                SELECT 'ARQUIVOS_ADICIONAIS' AS TIPO,
                    ARQUIVO,
                    URL,
                    0 AS TAMANHO,
                    '' AS TABELA,
                    '' AS CAMPO_ARQ,
                    '' AS CAMPO_ARQ_TAM,
                    '' AS CHAVE
                FROM ARQUIVOS_ADICIONAIS
                WHERE TRIM(URL) <> ''
                
                UNION
                
                SELECT 'MUSICA' AS TIPO,
                    MUSICAS.URL AS ARQUIVO,
                    'config\musicas\' || MUSICAS.ALBUM || '\' || MUSICAS.URL AS URL,
                    TAMANHO_ARQUIVO AS TAMANHO,
                    'MUSICAS' AS TABELA,
                    'ALBUM' || '\' || URL AS CAMPO_ARQ,
                    'TAMANHO_ARQUIVO' AS CAMPO_ARQ_TAM,
                    MUSICAS.ALBUM || '\' || MUSICAS.URL AS CHAVE
                FROM ALBUM
                    INNER JOIN (MUSICAS INNER JOIN ALBUM_MUSICAS ON MUSICAS.ID = ALBUM_MUSICAS.ID_MUSICA) ON ALBUM.ID = ALBUM_MUSICAS.ID_ALBUM
                WHERE 1=1
                    AND ((ALBUM.PERMITE_DESATIVAR = 'N') OR (ALBUM.PERMITE_DESATIVAR = 'S' AND ALBUM.ID NOT IN (SELECT ID FROM _ALBUM_IGNORAR)))
                    AND (TRIM(MUSICAS.URL) <> '')
                    AND (TRIM(MUSICAS.ALBUM) <> '')
                
                UNION
                
                SELECT 'MUSICA_PB' AS TIPO,
                    MUSICAS.URL_INSTRUMENTAL AS ARQUIVO,
                    'config\musicas\' || MUSICAS.ALBUM || '\' || MUSICAS.URL_INSTRUMENTAL AS URL,
                    TAMANHO_ARQUIVO_PB AS TAMANHO,
                    'MUSICAS' AS TABELA,
                    'ALBUM' || '\' || URL_INSTRUMENTAL AS CAMPO_ARQ,
                    'TAMANHO_ARQUIVO_PB' AS CAMPO_ARQ_TAM,
                    MUSICAS.ALBUM || '\' || MUSICAS.URL_INSTRUMENTAL AS CHAVE
                FROM ALBUM
                    INNER JOIN (MUSICAS INNER JOIN ALBUM_MUSICAS ON MUSICAS.ID = ALBUM_MUSICAS.ID_MUSICA) ON ALBUM.ID = ALBUM_MUSICAS.ID_ALBUM
                WHERE 1=1
                    AND ((ALBUM.PERMITE_DESATIVAR = 'N') OR (ALBUM.PERMITE_DESATIVAR = 'S' AND ALBUM.ID NOT IN (SELECT ID FROM _ALBUM_IGNORAR)))
                    AND (TRIM(MUSICAS.URL_INSTRUMENTAL) <> '')
                    AND (TRIM(MUSICAS.ALBUM) <> '')
                
                UNION
                
                SELECT 'IMAGEM_FUNDO' AS TIPO,
                    IMAGEM AS ARQUIVO,
                    'config\imagens\' || IMAGEM AS URL,
                    TAMANHO_IMAGEM AS TAMANHO,
                    'MUSICAS_LETRA' AS TABELA,
                    'IMAGEM' AS CAMPO_ARQ,
                    'TAMANHO_IMAGEM' AS CAMPO_ARQ_TAM,
                    IMAGEM AS CHAVE
                FROM MUSICAS_LETRA
                WHERE TRIM(IMAGEM) <> ''
                
                UNION
                
                SELECT 'IMAGEM_FUNDO_CAPA' AS TIPO,
                    IMAGEM AS ARQUIVO,
                    'config\imagens\' || IMAGEM AS URL,
                    TAMANHO_IMAGEM AS TAMANHO,
                    'MUSICAS' AS TABELA,
                    'IMAGEM' AS CAMPO_ARQ,
                    'TAMANHO_IMAGEM' AS CAMPO_ARQ_TAM,
                    IMAGEM AS CHAVE
                FROM MUSICAS
                WHERE TRIM(IMAGEM) <> ''
                
                UNION
                
                SELECT 'IMAGEM_ALBUM' AS TIPO,
                    IMAGEM AS ARQUIVO,
                    'config\capas\' || IMAGEM AS URL,
                    0 AS TAMANHO,
                    '' AS TABELA,
                    '' AS CAMPO_ARQ,
                    '' AS CAMPO_ARQ_TAM,
                    '' AS CHAVE
                FROM ALBUM
                WHERE 1=1
                    AND ((PERMITE_DESATIVAR = 'N') OR (PERMITE_DESATIVAR = 'S' AND ID NOT IN (SELECT ID FROM _ALBUM_IGNORAR)))
                    AND TRIM(IMAGEM) <> ''
                            
                ORDER BY ARQUIVO");

            DB::connection('sqlite')->statement("CREATE VIEW LISTA_MUSICAS AS
                SELECT M.ID,
                    A.ID AS ID_ALBUM,
                    A.NOME AS NOME_ALBUM,
                    A.NOME ||
                    COALESCE(
                        (SELECT ' (' || ALBUM_TIPO.SUBTITULO || ')'
                            FROM ALBUM_TIPO
                            WHERE ALBUM_TIPO.ID_ALBUM = A.ID
                            AND ALBUM_TIPO.TIPO = 'JA_ANO'
                        ),
                    '') AS NOME_ALBUM_COM,
                    
                    AM.FAIXA,
                    M.NOME ||
                    (CASE WHEN EXISTS (SELECT 1 FROM ALBUM_TIPO WHERE ALBUM_TIPO.ID_ALBUM = A.ID AND ALBUM_TIPO.TIPO = 'HASD') THEN ' (Hino nº ' || SUBSTR('00' || AM.FAIXA, -3, 3) || ') ' ELSE '' END) AS NOME,
                    
                    (CASE WHEN EXISTS (SELECT 1 FROM ALBUM_TIPO WHERE ALBUM_TIPO.ID_ALBUM = A.ID AND ALBUM_TIPO.TIPO = 'HASD')
                        THEN SUBSTR('00' || AM.FAIXA, -3, 3) || ' - '
                        ELSE ''
                    END) || M.NOME || ' (' ||
                    COALESCE(
                        (SELECT ALBUM_TIPO.SUBTITULO || ' - '
                            FROM ALBUM_TIPO
                            WHERE ALBUM_TIPO.ID_ALBUM = A.ID
                            AND ALBUM_TIPO.TIPO = 'JA_ANO'
                        )
                    ,'') || A.NOME || ')' AS NOME_COM,
                    
                    (CASE WHEN EXISTS (SELECT 1 FROM ALBUM_TIPO WHERE ALBUM_TIPO.ID_ALBUM = A.ID AND ALBUM_TIPO.TIPO = 'HASD') THEN 'S' ELSE 'N' END) AS TIPO_HASD,
                    (CASE WHEN EXISTS (SELECT 1 FROM ALBUM_TIPO WHERE ALBUM_TIPO.ID_ALBUM = A.ID AND ALBUM_TIPO.TIPO = 'JA_ANO') THEN 'S' ELSE 'N' END) AS TIPO_JA,
                    'S' AS TIPO_BAIXADA,
                    'N' AS TIPO_WEB,
                    'N' AS TIPO_PERSO,
                    'B' AS TIPO,
                    '' AS URL_ALBUM,
                    M.ALBUM,
                    M.URL,
                    M.URL_INSTRUMENTAL,
                    M.IDIOMA,
                    M.LETRA,

                    " . self::fn_sqlite_no_accents("M.NOME ||(CASE WHEN EXISTS (SELECT 1 FROM ALBUM_TIPO WHERE ALBUM_TIPO.ID_ALBUM = A.ID AND ALBUM_TIPO.TIPO = 'HASD') THEN ' (Hino nº ' || SUBSTR('00' || AM.FAIXA, -3, 3) || ') ' ELSE '' END)") . " AS NOME_SEMAC,
                    " . self::fn_sqlite_no_accents("M.LETRA") . " AS LETRA_SEMAC,
                    " . self::fn_sqlite_no_accents("
                    A.NOME ||
                    COALESCE(
                        (SELECT ' (' || ALBUM_TIPO.SUBTITULO || ')'
                            FROM ALBUM_TIPO
                            WHERE ALBUM_TIPO.ID_ALBUM = A.ID
                            AND ALBUM_TIPO.TIPO = 'JA_ANO'
                        ),
                    '')") . " AS NOME_ALBUM_COM_SEMAC
                FROM MUSICAS AS M
                LEFT JOIN ALBUM_MUSICAS AS AM ON M.ID = AM.ID_MUSICA
                LEFT JOIN ALBUM AS A ON AM.ID_ALBUM = A.ID
                WHERE 1=1
                AND (
                        (A.PERMITE_DESATIVAR = 'N')
                        OR
                        (A.PERMITE_DESATIVAR = 'S' AND A.ID NOT IN (SELECT ID FROM _ALBUM_IGNORAR))
                    )");

            DB::connection('sqlite')->statement("CREATE VIEW LISTA_MUSICAS_ONL AS
                SELECT ONL_VIDEOS.VIDEO_ID AS ID,
                    0 AS ID_ALBUM,
                    ONL_PLAYLISTS.NOME AS NOME_ALBUM,
                    ONL_PLAYLISTS.NOME || ' (Canal ' || ONL_CANAIS.NOME || ')' AS NOME_ALBUM_COM,
                    ONL_VIDEOS.POSICAO AS FAIXA,
                    ONL_VIDEOS.NOME AS NOME,
                    ONL_VIDEOS.NOME || ' (Canal ' || ONL_CANAIS.NOME || ')' AS NOME_COM,
                    'N' AS TIPO_HASD,
                    'N' AS TIPO_JA,
                    'N' AS TIPO_BAIXADA,
                    'S' AS TIPO_WEB,
                    'N' AS TIPO_PERSO,
                    'W' AS TIPO,
                    ONL_VIDEOS.VIDEO_ID AS URL_ALBUM,
                    '' AS ALBUM,
                    '' AS URL,
                    '' AS URL_INSTRUMENTAL,
                    '' AS IDIOMA,
                    '' AS LETRA,

                    " . self::fn_sqlite_no_accents("ONL_VIDEOS.NOME") . " AS NOME_SEMAC,
                    '' AS LETRA_SEMAC,
                    " . self::fn_sqlite_no_accents("ONL_PLAYLISTS.NOME || ' (Canal ' || ONL_CANAIS.NOME || ')'") . " AS NOME_ALBUM_COM_SEMAC
                FROM ONL_VIDEOS
                INNER JOIN ONL_PLAYLISTS ON ONL_VIDEOS.PLAYLIST_ID = ONL_PLAYLISTS.PLAYLIST_ID
                INNER JOIN ONL_CANAIS ON ONL_PLAYLISTS.CANAL_ID = ONL_CANAIS.CANAL_ID
                ORDER BY ONL_VIDEOS.NOME");

            DB::connection('sqlite')->statement("CREATE VIEW LISTA_MUSICAS_PERSO AS
                SELECT ID,
                    0 AS ID_ALBUM,
                    'Coletâneas Personalizadas' AS NOME_ALBUM,
                    'Coletâneas Personalizadas' AS NOME_ALBUM_COM,
                    0 AS FAIXA,
                    NOME,
                    NOME AS NOME_COM,
                    'N' AS TIPO_HASD,
                    'N' AS TIPO_JA,
                    'N' AS TIPO_BAIXADA,
                    'N' AS TIPO_WEB,
                    'S' AS TIPO_PERSO,
                    'P' AS TIPO,
                    '' AS URL_ALBUM,
                    '' AS ALBUM,
                    URL,
                    '' AS URL_INSTRUMENTAL,
                    '' AS IDIOMA,
                    '' AS LETRA,

                    " . self::fn_sqlite_no_accents("NOME") . " AS NOME_SEMAC,
                    '' AS LETRA_SEMAC,
                    'coletaneas personalizadas' AS NOME_ALBUM_COM_SEMAC
                FROM _COLETANEAS_PERSONALIZADAS
                ORDER BY NOME");


            DB::connection('sqlite')->statement("CREATE VIEW LISTA_MUSICAS_TODAS AS
                SELECT * FROM LISTA_MUSICAS
                UNION
                SELECT * FROM LISTA_MUSICAS_ONL
                UNION
                SELECT * FROM LISTA_MUSICAS_PERSO
                ORDER BY NOME");

            DB::connection('sqlite')->statement("CREATE TABLE MUSICAS_SLIDE AS
                SELECT
                    'CAPA' AS TIPO,
                    ID AS MUSICA_ID,
                    -1 AS LETRA_ID,
                    ALBUM || '/' || URL AS URL_MUSICA,
                    CASE WHEN URL_INSTRUMENTAL <> '' THEN ALBUM || '/' || URL_INSTRUMENTAL ELSE '' END AS URL_MUSICA_PB,
                    NOME AS LETRA,
                    UPPER(NOME) AS LETRA_UCASE,
                    -1 AS ORDEM,
                    MUSICAS.IMAGEM AS IMAGEM,
                    IFNULL(IMAGEM_POSICAO.POSICAO, 0) AS IMAGEM_POSICAO,
                    '00:00:00' AS TEMPO,
                    '00:00:00' AS TEMPO_PB,
                    FUNDO_LETRA,
                    TAMANHO_LETRA,
                    COR_LETRA,
                    '' AS LETRA_AUX,
                    0 AS TAMANHO_LETRA_AUX,
                    '' AS COR_LETRA_AUX
                FROM
                    MUSICAS
                LEFT JOIN
                    IMAGEM_POSICAO ON IMAGEM_POSICAO.IMAGEM = MUSICAS.IMAGEM
                
                UNION
                
                SELECT
                    'LETRA' AS TIPO,
                    MUSICA AS MUSICA_ID,
                    ID AS LETRA_ID,
                    '' AS URL_MUSICA,
                    '' AS URL_MUSICA_PB,
                    LETRA,
                    UPPER(LETRA) AS LETRA_UCASE,
                    ORDEM,
                    MUSICAS_LETRA.IMAGEM AS IMAGEM,
                    IFNULL(IMAGEM_POSICAO.POSICAO, 0) AS IMAGEM_POSICAO,
                    TEMPO,
                    CASE WHEN IFNULL(MUSICAS_LETRA.TEMPO_PB, 0) > 0 THEN IFNULL(MUSICAS_LETRA.TEMPO_PB, 0) ELSE TEMPO END AS TEMPO_PB,
                    FUNDO_LETRA,
                    TAMANHO_LETRA,
                    COR_LETRA,
                    LETRA_AUX,
                    TAMANHO_LETRA_AUX,
                    COR_LETRA_AUX
                FROM
                    MUSICAS_LETRA
                LEFT JOIN
                    IMAGEM_POSICAO ON IMAGEM_POSICAO.IMAGEM = MUSICAS_LETRA.IMAGEM
                WHERE
                    EXIBE_SLIDE = 1
                ORDER BY MUSICA_ID, ORDEM");

            DB::connection('sqlite')->statement("CREATE VIEW LISTA_COLETANEAS AS
                SELECT DISTINCT A.ID AS ID,
                    T.ID_ALBUM AS ID_ALBUM,
                    T.TIPO,
                    T.SUBTITULO,
                    A.NOME,
                    A.NOME || (CASE WHEN T.SUBTITULO <> '' THEN ' (' || T.SUBTITULO || ')' ELSE '' END) AS NOME_ALBUM,
                    A.IMAGEM
                FROM ALBUM AS A
                LEFT JOIN ALBUM_TIPO AS T ON T.ID_ALBUM = A.ID
                WHERE (A.PERMITE_DESATIVAR = 'N' OR (A.PERMITE_DESATIVAR = 'S' AND A.ID NOT IN (SELECT ID FROM _ALBUM_IGNORAR)))
                ORDER BY T.ORDEM, A.NOME");

            DB::connection('sqlite')->statement("CREATE VIEW DOXOLOGIA_ALBUNS AS
                SELECT A.ID, A.NOME, A.IMAGEM
                FROM ALBUM AS A
                LEFT JOIN ALBUM_TIPO AS AT ON A.ID = AT.ID_ALBUM
                WHERE AT.TIPO = 'DOX'
                ORDER BY AT.ORDEM, A.NOME");

            DB::connection('sqlite')->statement("CREATE VIEW MUSICAS_INFANTIS AS
                SELECT MUSICA.ID, MUSICA.NOME, MUSICA.ALBUM, MUSICA.URL, MUSICA.URL_INSTRUMENTAL
                FROM MUSICAS AS MUSICA
                JOIN ALBUM_MUSICAS AS ALBUM_MUSICAS ON MUSICA.ID = ALBUM_MUSICAS.ID_MUSICA
                JOIN ALBUM AS ALBUM ON ALBUM_MUSICAS.ID_ALBUM = ALBUM.ID
                JOIN ALBUM_TIPO AS ALBUM_TIPO ON ALBUM.ID = ALBUM_TIPO.ID_ALBUM
                WHERE ALBUM_TIPO.TIPO = 'INF'
                ORDER BY MUSICA.NOME");

            DB::connection('sqlite')->statement("CREATE VIEW BIBLIA AS
                SELECT
                    bible_verse.id_bible_verse ID,
                    (SELECT abbreviation FROM bible_version WHERE id_bible_version=bible_verse.id_bible_version) VERSAO,
                    CASE WHEN bible_verse.id_bible_book>66 THEN bible_verse.id_bible_book-66 ELSE bible_verse.id_bible_book END LIVRO,
                    bible_verse.chapter CAPITULO,
                    bible_verse.verse VERSICULO,
                    bible_verse.text PASSAGEM
                FROM bible_verse
                WHERE bible_verse.id_language = '" . $id_language . "'");

            DB::connection('sqlite')->statement("CREATE VIEW LIVRO AS
                SELECT 
                    book_number ID,
                    abbreviation SIGLA, 
                    CASE WHEN book_number > 39 THEN book_number-39 ELSE book_number END ID_SECAO,
                    CASE WHEN testament = 1 THEN 'AT' ELSE 'NT' END TESTAMENTO,
                    `name` LIVRO, 
                    keywords PALAVRACHAVE,
                    CASE WHEN SUBSTR(abbreviation,1,1) IN ('1','2','3') THEN SUBSTR(abbreviation,2,5) ELSE abbreviation END SIGLA_L,
                    CASE WHEN SUBSTR(abbreviation,1,1) IN ('1','2','3') THEN SUBSTR(abbreviation,1,1) ELSE '' END SIGLA_N,
                    chapters CAPITULOS,
                    '$0' || SUBSTR(color,6,2) || SUBSTR(color,4,2) || SUBSTR(color,2,2) COR
                FROM bible_book
                WHERE bible_book.id_language = '" . $id_language . "'");

            DB::connection('sqlite')->statement("CREATE VIEW VERSAO_BIBLICA AS
                SELECT
                        abbreviation SIGLA,
                        name VERSAO,
                        CASE WHEN abbreviation = 'NTLH'
                            THEN 0
                            ELSE 1
                        END AS QUEBRA,
                        CASE WHEN abbreviation = 'NTLH'
                            THEN '<pb/>'
                            ELSE ''
                        END AS SIMBOLO_QUEBRA,
                        '' EXPLICACAO_VERSOS
                FROM bible_version WHERE id_language='" . $id_language . "'");

            /* Renomeia para identificar a versão */
            $version = Configs::get("version_number");
            $path_parts = pathinfo($database);
            $newname = app()->basePath('public/db/db_' . $id_language . '_' . $version . '.' . $path_parts['extension']);
            $path_database = null;
            if (rename($database, $newname)) {
                $path_database = $newname;
            }
            $log[$id_language]["path_database"] = $path_database;
            if (!$path_database || !file_exists($path_database)) {
                $error = "Erro ao copiar banco de dados. De: \"" . $database . "\", Para: \"" . $newname . "\"";
                $log[$id_language]["error"] = $error;
            }

            Configs::set($id_language . "_path_database", $path_database);

            DB::connection('sqlite')->disconnect();
        }

        return ["logs" => $log, "error" => $error];
    }

    public static function import_file($file_path)
    {
        if (!File::exists($file_path)) {
            return ['error' => 'Arquivo não encontrado.'];
        }

        $info = pathinfo($file_path);
        $mime = mime_content_type($file_path);

        if ($mime == "application/zip") {

            $output = dirname($file_path);
            $output = rtrim($output, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
            $output = $output . '~' . $info['filename'];

            Files::unzip($file_path, $output);

            $text_file = $output . DIRECTORY_SEPARATOR . 'slides.lja';
            $content = File::get($text_file);

            $sections = preg_split('/\[(.*?)\]/', $content, -1, PREG_SPLIT_NO_EMPTY | PREG_SPLIT_DELIM_CAPTURE);

            $slides = [];
            for ($i = 0; $i < count($sections); $i += 2) {
                $sectionName = trim($sections[$i]);

                $lines = explode("\n", trim($sections[$i + 1]));
                $data = [];
                foreach ($lines as $line) {
                    list($key, $value) = explode('=', $line, 2);
                    $data[trim($key)] = trim($value);
                }

                $slides[$sectionName] = $data;
            }

            $music = [];
            $lyrics = [];

            $id_music = null;
            $id_image = null;
            $order = 0;
            foreach ($slides as $key => $slide) {
                $text = trim($slide["letra"] ?? "");
                $text = mb_convert_encoding($text, 'UTF-8', 'ISO-8859-1');
                $text = str_replace("|", PHP_EOL, $text);
                $text = ucfirst($text);

                $slide["url_musica"] = mb_convert_encoding($slide["url_musica"] ?? "", 'UTF-8', 'ISO-8859-1');
                $slide["imagem"] = mb_convert_encoding($slide["imagem"] ?? "", 'UTF-8', 'ISO-8859-1');

                if ($key == "Geral") {
                    if ($slide["url_musica"] <> "") {
                        $file = FileModel::where("name", basename($slide["url_musica"]))->first();
                        if (!$file) {
                            $file = FileModel::create([
                                "name" => basename($slide["url_musica"]),
                                "file_name" => basename($slide["url_musica"]),
                                "type" => "music",
                                "size" => 0,
                                "dir" => "/",
                                "version" => 1,
                            ]);
                        }
                        $id_music = $file["id_file"];
                    }
                } else {
                    if ($slide["imagem"] <> "") {
                        $file = FileModel::where("name", basename($slide["imagem"]))->first();
                        if (!$file) {
                            $file = FileModel::create([
                                "name" => basename($slide["imagem"]),
                                "file_name" => basename($slide["imagem"]),
                                "type" => "image_music",
                                "size" => 0,
                                "dir" => "/",
                                "version" => 1,
                            ]);
                        }
                        $id_image = $file["id_file"];
                    }

                    if ($slide["tipo"] == "CAPA") {
                        $text = str_replace(PHP_EOL, " ", $text);

                        $music["name"] = $text;
                        $music["id_file_music"] = $id_music;
                        $music["id_file_image"] = $id_image;
                        $music["id_language"] = "pt";
                    } else {
                        $order = $order + 10;
                        $lyrics[] = [
                            "lyric" => $text,
                            "id_file_image" => $id_image,
                            "time" => "00:" . $slide["tempo_hms"],
                            "instrumental_time" => '00:00:00',
                            "show_slide" => 1,
                            "order" => $order,
                            "id_language" => "pt",
                        ];
                    }
                }
            }

            File::deleteDirectory($output);
            $new_path = dirname($file_path);
            $new_path = rtrim($new_path, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
            $new_path = $new_path . 'imported' . DIRECTORY_SEPARATOR;

            if (!File::isDirectory($new_path)) {
                File::makeDirectory($new_path, 0755, true);
            }
            File::move($file_path, $new_path . basename($file_path));

            $music = Music::create($music);
            foreach ($lyrics as $lyric) {
                $lyric["id_music"] = $music->id_music;
                Lyric::create($lyric);
            }

            return ['music' => $music];
        } else {
            return ['error' => 'Formato não suportado.'];
        }
    }
}



================================================
FILE: app/Helpers/Files.php
================================================
<?php

namespace App\Helpers;

use App\Models\File as FileModel;
use Illuminate\Support\Facades\File;
use zipArchive;
use getID3;

class Files
{

    public static function refresh_size()
    {
        $log = [];
        //$files = Files::all();
        //$files = Files::take(3)->get();
        $files = FileModel::where('size', '<=', 0)->get();
        foreach ($files as $file) {
            $url = env("FILES_URL") . $file["dir"] . "/" . $file["file_name"];
            $dir = env("FILES_DIR") . $file["dir"] . "/" . $file["file_name"];

            $log[$file->id_file]["url"] = $url;
            $log[$file->id_file]["dir"] = $dir;

            if (file_exists($dir)) {
                $contentLength = filesize($dir);
                $file->size = $contentLength;
                $file->save();

                $log[$file->id_file]["status"] = "success";
                $log[$file->id_file]["size"] = $contentLength;
            } else {
                $log[$file->id_file]["status"] = "error";
            }
        }
        return ["logs" => $log];
    }

    public static function refresh_duration()
    {
        $getID3 = new getID3;

        $log = [];
        $files = FileModel::whereNull('duration')->where('type', 'music')->get();
        foreach ($files as $file) {
            $url = env("FILES_URL") . $file["dir"] . "/" .  $file["file_name"];
            $dir = env("FILES_DIR") . $file["dir"] . "/" . $file["file_name"];

            $log[$file->id_file]["url"] = $url;
            $log[$file->id_file]["dir"] = $dir;

            if (file_exists($dir)) {
                $fileInfo = $getID3->analyze($dir);
                $duration = gmdate("H:i:s", $fileInfo['playtime_seconds']);
                $file->duration = $duration;
                $file->save();

                $log[$file->id_file]["status"] = "success";
                $log[$file->id_file]["duration"] = $duration;
            } else {
                $log[$file->id_file]["status"] = "error";
            }
        }
        return ["logs" => $log];
    }

    public static function list_files($directoryPath)
    {
        if (!File::exists($directoryPath)) {
            return ['error' => 'Diretório não encontrado.'];
        }

        $allFilesAndDirs = File::files($directoryPath);

        $files = array_filter($allFilesAndDirs, function ($file) {
            return $file->isFile();
        });

        $fileNames = array_map(function ($file) use ($directoryPath) {
            return [
                'name' => $file->getFilename(),
                'path' => $directoryPath . $file->getFilename(),
                'mime' => mime_content_type($directoryPath . $file->getFilename()),
            ];
        }, $files);

        return $fileNames;
    }

    public static function zip_filenames(\ZipArchive $zipArchive)
    {
        $filenames = array();
        $fileCount = $zipArchive->numFiles;

        for ($i = 0; $i < $fileCount; $i++) {
            $filename = $zipArchive->getNameIndex($i);

            if ($filename !== false) {
                $filenames[] = $filename;
            }
        }

        return $filenames;
    }

    public static function unzip($file, $output = '')
    {
        if (!File::exists($file)) {
            return ['error' => 'Arquivo não encontrado.'];
        }

        $info = pathinfo($file);

        if ($output == '') {
            $output = dirname($file);
            $output = rtrim($output, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $info['filename'];
        }

        $zipArchive = new ZipArchive;
        $zipArchive->open($file);
        $filenames  = self::zip_filenames($zipArchive);

        $zipArchive->extractTo($output, $filenames);

        $zipArchive->close();

        return ['files' => $filenames, 'output' => $output];
    }
}



================================================
FILE: app/Helpers/Ftp.php
================================================
<?php

namespace App\Helpers;

use Illuminate\Support\Facades\Storage;
use App\Helpers\Configs;
use App\Models\Language;
use App\Models\Ftp as FtpModel;

class Ftp
{

    public static function send_database()
    {

        $ret = ["status" => true];
        $langs = Language::orderBy("id_language", "desc")->get();

        foreach ($langs as $lang) {
            $id_language = $lang->id_language;

            $ret[$id_language]["lang"] = $id_language;
            $ftp_list = FtpModel::select()->where('id_language', $id_language)->get();
            foreach ($ftp_list as $ftp_item) {
                $data = $ftp_item->data;

                $ret[$id_language]["ftp"][$ftp_item->id_ftp]["id_ftp"] = $ftp_item->id_ftp;

                $file = Configs::get($id_language . "_path_database");
                if ($file == "") {
                    $ret[$id_language]["ftp"][$ftp_item->id_ftp]["error"] = "Caminho do banco de dados não encontrado.";
                    $ret["status"] = false;
                    $ret["message"] = "Caminho do banco de dados não encontrado.";
                    continue;
                }

                try {
                    $ftp = Storage::build([
                        'driver'   => 'ftp',
                        'host'     => $data["host"],
                        'username' => $data["username"],
                        'password' => $data["password"],
                        'root'     => ($data["root"] ?? '/') . 'config',
                        'port'     => $data["port"] ?? 21,
                        'passive'  => true,
                        'ssl'      => false,
                        'timeout'  => 30,
                    ]);


                    $ftp->put('database.db', fopen($file, 'r+'));
                    $ret[$id_language]["file"] = $file;
                } catch (\Throwable $e) {
                    $ret[$id_language]["ftp"][$ftp_item->id_ftp]["error"] = $e->getMessage();
                    $ret["status"] = false;
                    $ret["message"] = $e->getMessage();
                }
            }
        }

        if ($ret["status"] == true) {
            Configs::set("version_number_ftp", Configs::get("version_number"));
        }

        return $ret;
    }
}



================================================
FILE: app/Helpers/OnlineVideos.php
================================================
<?php

namespace App\Helpers;

use App\Models\OnlineVideoChannel;
use App\Models\OnlineVideoPlaylist;
use App\Models\OnlineVideo;
use App\Services\YoutubeService;

class OnlineVideos
{

    public static function refresh()
    {
        $channels = self::refresh_channels();
        $playlists = self::refresh_playlists();
        $videos = self::refresh_videos();

        $status = ($channels || $playlists || $videos ? "ok" : "");

        return [
            "status" => $status,
            "channels" => $channels,
            "playlists" => $playlists,
            "videos" => $videos,
        ];
    }
    public static function refresh_channels()
    {
        $logs = [];

        $youtube = new YoutubeService();

        $channels = OnlineVideoChannel::where('status', 'pending')->get();
        foreach ($channels as $channel) {
            $data = $youtube->channel($channel->channel_id);
            if (isset($data["error"])) {
                $channel->error = $data["error"];
                $channel->status = "error";
            } else {
                $channel->error = null;
                $channel->title = $data["snippet"]["title"];
                $channel->description = $data["snippet"]["description"];
                $channel->custom_url = $data["snippet"]["customUrl"];
                $channel->default_image = $data["snippet"]["thumbnails"]["default"]["url"] ?? '';
                $channel->medium_image = $data["snippet"]["thumbnails"]["medium"]["url"] ?? '';
                $channel->high_image = $data["snippet"]["thumbnails"]["high"]["url"] ?? '';
                try {
                    if (isset($data["snippet"]["thumbnails"]["default"]["url"])) {
                        $image_data = file_get_contents($data["snippet"]["thumbnails"]["default"]["url"]);
                        $channel->default_image_base64 = 'data:image/png;base64,' . base64_encode($image_data);
                    }
                    $channel->status = "validated";
                } catch (\Exception $e) {
                    $channel->error = $e->getMessage();
                    $channel->status = "error";
                }
            }
            $logs[] = ["channel_id" => $channel->channel_id, "status" => $channel->status];

            $channel->save();
        }
        return $logs;
    }

    public static function refresh_playlists()
    {
        $logs = [];

        $channels = OnlineVideoChannel::select('id_online_video_channel', 'playlists', 'id_language')->get();
        foreach ($channels as $channel) {
            $delete = OnlineVideoPlaylist::where('id_online_video_channel', $channel->id_online_video_channel)
                ->whereNotIn('playlist_id', $channel->playlists)->delete();

            if ($delete > 0) {
                $logs[] = ["id_online_video_channel" => $channel->id_online_video_channel, "removed" => $delete];
            }

            $playlists_exists = OnlineVideoPlaylist::select('playlist_id')
                ->where('id_online_video_channel', $channel->id_online_video_channel)
                ->whereIn('playlist_id', $channel->playlists)
                ->pluck('playlist_id')
                ->toArray();

            $playlists = array_diff($channel->playlists, $playlists_exists);

            foreach ($playlists as $playlist) {
                OnlineVideoPlaylist::create([
                    'id_online_video_channel' => $channel->id_online_video_channel,
                    'playlist_id' => $playlist,
                    'id_language' => $channel->id_language,
                ]);
            }
        }

        /* ------------------------------------------------------------------------------ */

        $youtube = new YoutubeService();

        $playlists = OnlineVideoPlaylist::where('status', 'pending')->get();
        foreach ($playlists as $playlist) {
            $data = $youtube->playlist($playlist->playlist_id);
            if (isset($data["error"])) {
                $playlist->error = $data["error"];
                $playlist->status = "error";
            } else {
                $playlist->error = null;
                $playlist->title = $data["snippet"]["title"];
                $playlist->description = $data["snippet"]["description"];
                $playlist->default_image = $data["snippet"]["thumbnails"]["default"]["url"] ?? '';
                $playlist->medium_image = $data["snippet"]["thumbnails"]["medium"]["url"] ?? '';
                $playlist->high_image = $data["snippet"]["thumbnails"]["high"]["url"] ?? '';
                $playlist->standard_image = $data["snippet"]["thumbnails"]["high"]["url"] ?? '';
                $playlist->maxres_image = $data["snippet"]["thumbnails"]["maxres"]["url"] ?? '';
                try {
                    if (isset($data["snippet"]["thumbnails"]["default"]["url"])) {
                        $image_data = file_get_contents($data["snippet"]["thumbnails"]["default"]["url"]);
                        $playlist->default_image_base64 = 'data:image/png;base64,' . base64_encode($image_data);
                    }
                    $playlist->status = "validated";
                } catch (\Exception $e) {
                    $playlist->error = $e->getMessage();
                    $playlist->status = "error";
                }
            }
            $logs[] = ["playlist_id" => $playlist->playlist_id, "status" => $playlist->status];

            $playlist->save();
        }
        return $logs;
    }

    public static function refresh_videos()
    {
        $logs = [];

        $youtube = new YoutubeService();

        $playlists = OnlineVideoPlaylist::get();
        foreach ($playlists as $playlist) {
            $list = $youtube->playlistItems($playlist->playlist_id);
            if (!isset($list["error"])) {
                $ids = array_map(function ($item) {
                    if (count($item['snippet']['thumbnails']) <= 0) {
                        return null;
                    }
                    return $item['snippet']['resourceId']['videoId'];
                }, $list);

                $ids = array_filter($ids, function ($item) {
                    return $item !== null;
                });


                $delete = OnlineVideo::where('id_online_video_playlist', $playlist->id_online_video_playlist)
                    ->whereNotIn('video_id', $ids)->delete();

                if ($delete > 0) {
                    $logs[] = ["playlist_id" => $playlist->playlist_id, "removed" => $delete];
                }

                $ids_exists = OnlineVideo::select('video_id')
                    ->where('id_online_video_playlist', $playlist->id_online_video_playlist)
                    ->whereIn('video_id', $ids)
                    ->pluck('video_id')
                    ->toArray();

                $videos = array_diff($ids, $ids_exists);

                foreach ($videos as $video) {
                    $data = array_filter($list, function ($item) use ($video) {
                        return $item['snippet']['resourceId']['videoId'] == $video;
                    });
                    $data = array_shift($data);

                    $video = new OnlineVideo();

                    $video->error = null;
                    $video->id_online_video_playlist = $playlist->id_online_video_playlist;
                    $video->id_language = $playlist->id_language;
                    $video->video_id = $data["snippet"]["resourceId"]["videoId"];
                    $video->title = $data["snippet"]["title"];
                    $video->description = $data["snippet"]["description"];
                    $video->sequence = $data["snippet"]["position"];
                    $video->default_image = $data["snippet"]["thumbnails"]["default"]["url"] ?? '';
                    $video->medium_image = $data["snippet"]["thumbnails"]["medium"]["url"] ?? '';
                    $video->high_image = $data["snippet"]["thumbnails"]["high"]["url"] ?? '';
                    $video->standard_image = $data["snippet"]["thumbnails"]["high"]["url"] ?? '';
                    $video->maxres_image = $data["snippet"]["thumbnails"]["maxres"]["url"] ?? '';
                    try {
                        if (isset($data["snippet"]["thumbnails"]["default"]["url"])) {
                            $image_data = file_get_contents($data["snippet"]["thumbnails"]["default"]["url"]);
                            $video->default_image_base64 = 'data:image/png;base64,' . base64_encode($image_data);
                        }
                        $video->status = "validated";
                    } catch (\Exception $e) {
                        $video->error = $e->getMessage();
                        $video->status = "error";
                    }

                    $logs[] = ["video_id" => $video->video_id, "title" => $video->title, "status" => $video->status];

                    $video->save();
                }
            }
        }
        return $logs;
    }
}



================================================
FILE: app/Helpers/Params.php
================================================
<?php

namespace App\Helpers;

use App\Helpers\Configs;
use Firebase\JWT\JWT;
use App\Models\Language;

class Params
{

    public static function all()
    {

        $file_name = [
            "pt" => "LouvorJA_Instalador",
            "es" => "LoorJA_Instalador"
        ];

        $params = [];

        $langs = Language::all();
        foreach ($langs as $lang) {
            $id_language = $lang->id_language;

            $version = Configs::get($id_language . "_delphi_version"); // mudar depois para ser 2 digitos ex.: 26.0
            $params["versao" . strtoupper($id_language)] = $version . ".0.0"; // remover depois -- adaptar no Delphi primeiro (removido na versao 26)
            $params["instalador" . strtoupper($id_language)] = "setup\Output\\" . $file_name[$id_language] . $version . ".exe"; // remover depois -- adaptar no Delphi primeiro  (removido na versao 26)

            $params[$id_language . "_version"] = $version;

            $version_array = explode(".", $version);
            $version_software = $version_array[0] . "." . $version_array[1];
            $params[$id_language . "_version_software"] = $version_software;

            $params[$id_language . "_setup_name"] = $file_name[$id_language] . $version_software . ".exe";

            $params["setup_name" . strtoupper($id_language)] = $file_name[$id_language] . $version . ".exe"; // remover depois -- adaptar no Delphi primeiro
            if ($version_array[0] >= "26") {
                $params[$id_language . "_download"] = "https://github.com/louvorja/desktop/releases/download/v" . $version_software . "/" . $params[$id_language . "_setup_name"];
            } else {
                $params[$id_language . "_download"] = "https://github.com/louvorja/desktop/releases/download/v" . $version_software . "/" . $params["setup_name" . strtoupper($id_language)]; // remover depois -- adaptar no Delphi primeiro (removido na versao 26)
            }

            $params["download" . strtoupper($id_language)] = $params[$id_language . "_download"]; // remover depois -- adaptar no Delphi primeiro


            if ($lang->id_language == "pt") {
                $params["versao"] = $version . ".0.0"; // remover depois -- adaptar no Delphi primeiro (removido na versao 26)
                $params["instalador"] = $params["instalador" . strtoupper($id_language)]; // remover depois -- adaptar no Delphi primeiro (removido na versao 26)
                $params["download"] = $params["download" . strtoupper($id_language)]; // remover depois -- adaptar no Delphi primeiro
                $params["setup_name"] = $params["setup_name" . strtoupper($id_language)]; // remover depois -- adaptar no Delphi primeiro
            }
        }

        $params["db_version"] = Configs::get("version_number_ftp");

        $token_ftp = JWT::encode(['exp' => time() + 30], env('JWT_SECRET'), 'HS256');
        $params["conn_ftp"] = "https://api.louvorja.com.br/ftp?token=" . $token_ftp;
        $params["version_log"] = "https://api.louvorja.com.br/version_log";
        $params["help"] = "https://louvorja.com.br/ajuda/";

        /* A partir daqui, são todos parâmetros do Delphi */
        $params["coletaneas_online"] = "https://api.louvorja.com.br/onlinevideos";
        $params["embed_youtube"] = "https://www.youtube.com/embed/{videoID}";
        //$params["ftp"] = "https://api.louvorja.com.br/ftp"; // REMOVER DEPOIS PARA MANTER A FORMA SEGURA (COM TOKEN)
        $params["helpPT"] = $params["help"] . "?lang=pt";
        $params["helpES"] = $params["help"] . "?lang=es";
        $params["logs_versao"] = $params["version_log"];

        return $params;
    }
}



================================================
FILE: app/Helpers/Tables.php
================================================
<?php

namespace App\Helpers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Tables
{
    public static $system_tables = [
        "migrations",
        "configs",
        "users",
        "download_logs",
        "ftp_logs",
        "ftp",
        "logs"
    ];

    public static function all()
    {
        return Schema::getConnection()->getDoctrineSchemaManager()->listTableNames();
    }

    public static function system()
    {
        sort(self::$system_tables);
        return self::$system_tables;
    }

    public static function public()
    {
        return array_diff(self::all(), self::system());
    }
}



================================================
FILE: app/Helpers/Validations.php
================================================
<?php

namespace App\Helpers;

class Validations
{

    public static function validationMessages($key = "")
    {
        return [
            'required' => 'O campo :attribute é obrigatório.',
            'email' => 'O campo :attribute deve conter um endereço de email válido.',
            'unique' => 'O :attribute já está em uso.',
            'min' => 'O campo :attribute deve ter no mínimo :min caracteres.',
            'max' => 'O campo :attribute não pode ter mais de :max caracteres.',
            'exists' => 'O :attribute escolhido é inválido.',
        ];
    }
}



================================================
FILE: app/Http/Controllers/AlbumController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Helpers\Validations;
use App\Models\Album;
use App\Models\Music;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AlbumController extends Controller
{
    public function validationRules(Request $request, $id = null)
    {
        return [
            'name' => 'required|string',
            'id_language' => 'required|string|exists:languages,id_language',
        ];
    }

    private function validationMessages()
    {
        return Validations::validationMessages();
    }

    public function index(Request $request)
    {
        $model = new Album;
        $fields = [
            'albums.id_album',
            'albums.name',
            'albums.id_file_image',
            DB::raw('concat("' . env("FILES_URL") . '",files.dir,"/",files.file_name) as url_image'),
            DB::raw('files.version as image_version'),
            'albums.id_language',
            'albums.color',
            DB::raw((isset($request["categories_slug"]) ? 'categories_albums.name' : '""') . ' as subtitle'),
            DB::raw((isset($request["categories_slug"]) ? 'categories_albums.order' : '""') . ' as `order`'),
            'albums.created_at',
            'albums.updated_at',
        ];
        $data = $model->select($fields)
            ->leftJoin('files', 'albums.id_file_image', 'files.id_file');

        if ($request->id_language) {
            $data->where('albums.id_language', $request->id_language);
        }

        if (isset($request["categories_slug"])) {
            $categories = explode(",", $request["categories_slug"]);
            $data = $data
                ->join('categories_albums', 'categories_albums.id_album', 'albums.id_album')
                ->join('categories', 'categories.id_category', 'categories_albums.id_category')
                ->whereIn('categories.slug', $categories);
        }

        if (isset($request["with_categories"]) && $request["with_categories"] == 1) {
            $data = $data->with('categories');
        }
        $data = $data->distinct();

        return response()->json(Data::data($data, $request, $fields));
    }

    public function show($id, Request $request)
    {
        $album = Album::select(
            'albums.id_album',
            'albums.name',
            'albums.id_file_image',
            DB::raw('concat("' . env("FILES_URL") . '",files.dir,"/",files.file_name) as url_image'),
            'files.version as image_version',
            'albums.id_language',
            'albums.color',
            'albums.created_at',
            'albums.updated_at',
        )
            ->leftJoin('files', 'albums.id_file_image', 'files.id_file')
            ->find($id);
        if ($album) {
            $album->musics = Music::where('albums_musics.id_album', $album->id_album)
                ->leftJoin('albums_musics', 'albums_musics.id_music', 'musics.id_music')
                ->leftJoin('files as files_image', 'musics.id_file_image', 'files_image.id_file')
                ->leftJoin('files as files_music', 'musics.id_file_music', 'files_music.id_file')
                ->leftJoin('files as files_instrumental_music', 'musics.id_file_instrumental_music', 'files_instrumental_music.id_file')
                ->select(
                    'musics.id_music',
                    'albums_musics.track',
                    'musics.name',
                    'musics.id_file_image',
                    DB::raw('concat("' . env("FILES_URL") . '",files_image.dir,"/",files_image.file_name) as url_image'),
                    'files_image.version as image_version',
                    'musics.id_file_music',
                    DB::raw('concat("' . env("FILES_URL") . '",files_music.dir,"/",files_music.file_name) as url_music'),
                    'files_music.version as music_version',
                    'musics.id_file_instrumental_music',
                    DB::raw('concat("' . env("FILES_URL") . '",files_instrumental_music.dir,"/",files_instrumental_music.file_name) as url_instrumental_music'),
                    'files_instrumental_music.version as instrumental_music_version',
                    'musics.id_language',
                    'musics.created_at',
                    'musics.updated_at',
                )
                ->orderBy('albums_musics.track')
                ->get();
        }

        $data = (object) [];
        $data->data = $album;

        if (!$album) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $this->validate($request, $this->validationRules($request), $this->validationMessages());

        $album = Album::create($request->all());

        $data = (object) [];
        $data->data = $album;
        $data->message = 'Registro cadastrado com sucesso!';
        return response()->json($data, 201);
    }

    public function update(Request $request, $id)
    {
        $this->validate($request, $this->validationRules($request, $id), $this->validationMessages());

        $album = Album::find($id);

        $data = (object) [];
        $data->data = $album;

        if (!$album) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $album->update($request->all());

        $data->message = 'Registro alterado com sucesso!';
        return response()->json($data);
    }

    public function destroy($id)
    {
        $album = Album::find($id);

        $data = (object) [];
        $data->data = $album;

        if (!$album) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $album->delete();
        return response()->json(['message' => 'Registro excluído com sucesso!']);
    }
}



================================================
FILE: app/Http/Controllers/AlbumMusicController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Helpers\Validations;
use App\Models\AlbumMusic;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AlbumMusicController extends Controller
{
    public function validationRules(Request $request, $id = null)
    {
        return [
            'id_music' => 'required',
            'id_album' => 'required|unique:albums_musics,id_album,' . ($id ? $id : 'NULL') . ',id_album_music,id_music,' . $request->input('id_music'),
            'id_language' => 'required|string|exists:languages,id_language',
        ];
    }

    private function validationMessages()
    {
        return Validations::validationMessages();
    }

    public function index(Request $request)
    {
        $model = new AlbumMusic;
        $fields = [
            'albums_musics.id_album_music',
            'albums_musics.id_music',
            DB::raw('musics.name as music_name'),
            'albums_musics.id_album',
            DB::raw('albums.name as album_name'),
            'albums_musics.track',
            'albums_musics.id_language',
        ];
        $data = $model->select($fields)
            ->leftJoin('musics', 'albums_musics.id_music', 'musics.id_music')
            ->leftJoin('albums', 'albums_musics.id_album', 'albums.id_album');
        if ($request->id_language) {
            $data->where('albums_musics.id_language', $request->id_language);
        }
        return response()->json(Data::data($data, $request, $fields));
    }

    public function show($id, Request $request)
    {
        $album_music = AlbumMusic::with(['album', 'music'])->find($id);

        $data = (object) [];
        $data->data = $album_music;

        if (!$album_music) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $this->validate($request, $this->validationRules($request), $this->validationMessages());

        $album_music = AlbumMusic::create($request->all());

        $data = (object) [];
        $data->data = $album_music;
        $data->message = 'Registro cadastrado com sucesso!';
        return response()->json($data, 201);
    }

    public function update(Request $request, $id)
    {
        $this->validate($request, $this->validationRules($request, $id), $this->validationMessages());

        $album_music = AlbumMusic::find($id);

        $data = (object) [];
        $data->data = $album_music;

        if (!$album_music) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $album_music->update($request->all());

        $data->message = 'Registro alterado com sucesso!';
        return response()->json($data);
    }

    public function destroy($id)
    {
        $album_music = AlbumMusic::find($id);

        $data = (object) [];
        $data->data = $album_music;

        if (!$album_music) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $album_music->delete();
        return response()->json(['message' => 'Registro excluído com sucesso!']);
    }
}



================================================
FILE: app/Http/Controllers/AuthController.php
================================================
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $this->validate($request, [
            'username' => 'required|string',
            'password' => 'required|string',
        ], [
            'username.required' => 'O campo nome de usuário é obrigatório.',
            'username.string' => 'O campo nome de usuário deve ser uma string.',
            'password.required' => 'O campo senha é obrigatório.',
            'password.string' => 'O campo senha deve ser uma string.',
        ]);

        $credentials = $request->only('username', 'password');

        try {
            if (!$token = JWTAuth::attempt($credentials)) {
                return response()->json(['error' => 'Login ou senha incorretos.'], 401);
            }
            $user = auth()->user();
        } catch (JWTException $e) {
            return response()->json(['error' => 'Ocorreu um erro ao tentar fazer o login.'], 500);
        }

        return response()->json(['token' => $token, 'user' => $user]);
    }

    public function me()
    {
        return response()->json(JWTAuth::parseToken()->authenticate());
    }

    public function refreshToken(Request $request)
    {
        try {
            $currentToken = JWTAuth::getToken();

            if (!$newToken = JWTAuth::refresh($currentToken)) {
                return response()->json([
                    'error' => 'Não foi possível atualizar o token.',
                ], 500);
            }

            $user = auth()->user();

            return response()->json([
                'token' => $newToken,
                'user' => $user
            ]);
        } catch (JWTException $e) {
            return response()->json([
                'error' => 'Token inválido ou expirado.',
            ], 401);
        }
    }

    public function logout(Request $request)
    {
        try {
            // Obtém o token do cabeçalho Authorization
            $token = JWTAuth::getToken();

            // Invalida o token
            JWTAuth::invalidate($token);

            return response()->json([]);
        } catch (JWTException $e) {
            return response()->json([
                'error' => 'Não foi possível realizar o logout.',
            ], 500);
        }
    }

    public function changePassword(Request $request)
    {
        $this->validate($request, [
            'current_password' => 'required|string',
            'new_password' =>  [
                'required',
                'string',
                'min:8',
                'confirmed',
                'regex:/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/'
            ],
        ], [
            'current_password.required' => 'O campo senha atual é obrigatório.',
            'new_password.required' => 'O campo nova senha é obrigatório.',
            'new_password.min' => 'A nova senha deve ter no mínimo 8 caracteres.',
            'new_password.confirmed' => 'A confirmação da nova senha não coincide.',
            'new_password.regex' => 'A nova senha deve conter pelo menos uma letra, um número e um caractere especial.',
        ]);

        $user = $request->user();

        if (!Hash::check($request->input('current_password'), $user->password)) {
            return response()->json(['error' => 'Senha atual incorreta.'], 400);
        }

        if (Hash::check($request->input('new_password'), $user->password)) {
            return response()->json(['error' => 'A nova senha não pode ser igual à senha atual.'], 400);
        }

        $user->password = Hash::make($request->input('new_password'));
        $user->is_temporary_password = false;
        $user->save();

        return response()->json(['message' => 'Senha alterada com sucesso.']);
    }
}



================================================
FILE: app/Http/Controllers/CategoryAlbumController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Helpers\Validations;
use App\Models\CategoryAlbum;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategoryAlbumController extends Controller
{
    public function validationRules(Request $request, $id = null)
    {
        return [
            'id_category' => 'required',
            'id_album' => 'required|unique:categories_albums,id_album,' . ($id ? $id : 'NULL') . ',id_category_album,id_category,' . $request->input('id_category'),
            'id_language' => 'required|string|exists:languages,id_language',
        ];
    }

    private function validationMessages()
    {
        return Validations::validationMessages();
    }

    public function index(Request $request)
    {
        $model = new CategoryAlbum;
        $fields = [
            'categories_albums.id_category_album',
            'categories_albums.id_category',
            DB::raw('categories.name as category_name'),
            'categories_albums.id_album',
            DB::raw('albums.name as album_name'),
            'categories_albums.name',
            'categories_albums.order',
            'categories_albums.id_language',
        ];
        $data = $model->select($fields)
            ->leftJoin('categories', 'categories_albums.id_category', 'categories.id_category')
            ->leftJoin('albums', 'categories_albums.id_album', 'albums.id_album');
        if ($request->id_language) {
            $data->where('categories_albums.id_language', $request->id_language);
        }
        return response()->json(Data::data($data, $request, $fields));
    }

    public function show($id, Request $request)
    {
        $category_album = CategoryAlbum::with(['category', 'album'])->find($id);

        $data = (object) [];
        $data->data = $category_album;

        if (!$category_album) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        return response()->json($data);
    }
  
    public function store(Request $request)
    {
        $this->validate($request, $this->validationRules($request), $this->validationMessages());

        $inputs = $request->all();
        if (!$request->filled('order')) {
            $inputs['order'] = 0;
        }
        if (!$request->filled('name')) {
            $inputs['name'] = '';
        }
        $category_album = CategoryAlbum::create($inputs);

        $data = (object) [];
        $data->data = $category_album;
        $data->message = 'Registro cadastrado com sucesso!';
        return response()->json($data, 201);
    }

    public function update(Request $request, $id)
    {
        $this->validate($request, $this->validationRules($request, $id), $this->validationMessages());

        $category_album = CategoryAlbum::find($id);

        $data = (object) [];
        $data->data = $category_album;

        if (!$category_album) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $category_album->update($request->all());

        $data->message = 'Registro alterado com sucesso!';
        return response()->json($data);
    }

    public function destroy($id)
    {
        $category_album = CategoryAlbum::find($id);

        $data = (object) [];
        $data->data = $category_album;

        if (!$category_album) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $category_album->delete();
        return response()->json(['message' => 'Registro excluído com sucesso!']);
    }
}



================================================
FILE: app/Http/Controllers/CategoryController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Helpers\Validations;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function validationRules(Request $request, $id = null)
    {
        return [
            'name' => 'required|string',
            'slug' => 'required|string|unique:categories,slug,' . ($id ? $id : 'NULL') . ',id_category,id_language,' . $request->input('id_language'),
            'id_language' => 'required|string|exists:languages,id_language',
        ];
    }

    private function validationMessages()
    {
        return Validations::validationMessages();
    }

    public function index(Request $request)
    {
        $model = new Category;
        $data = $model->select();
        if ($request->id_language) {
            $data->where('id_language', $request->id_language);
        }
        return response()->json(Data::data($data, $request, [$model->getKeyName(), ...$model->getFillable()]));
    }

    public function show($id, Request $request)
    {
        $category = Category::find($id);

        $data = (object) [];
        $data->data = $category;

        if (!$category) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $this->validate($request, $this->validationRules($request), $this->validationMessages());

        $inputs = $request->all();
        if (!$request->filled('order')) {
            $inputs['order'] = 0;
        }
        $category = Category::create($inputs);

        $data = (object) [];
        $data->data = $category;
        $data->message = 'Registro cadastrado com sucesso!';
        return response()->json($data, 201);
    }

    public function update(Request $request, $id)
    {
        $this->validate($request, $this->validationRules($request, $id), $this->validationMessages());

        $category = Category::find($id);

        $data = (object) [];
        $data->data = $category;

        if (!$category) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $category->update($request->all());

        $data->message = 'Registro alterado com sucesso!';
        return response()->json($data);
    }

    public function destroy($id)
    {
        $category = Category::find($id);

        $data = (object) [];
        $data->data = $category;

        if (!$category) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $category->delete();
        return response()->json(['message' => 'Registro excluído com sucesso!']);
    }
}



================================================
FILE: app/Http/Controllers/ConfigController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Models\Config;
use App\Helpers\Configs;
use Illuminate\Http\Request;

class ConfigController extends Controller
{
    public function __construct()
    {

    }

    public function index(Request $request)
    {
        //Verifica se já foi feita atualização no dia, e faz em caso de negativa
        $datetime = Config::select()->where('key', 'date')->where('value', date('Y-m-d'))->first();
        if (!$datetime) {
            Configs::refresh();
        }
        return $this->configs();

    }
    public function refresh()
    {
        Configs::refresh();
        return $this->configs();
    }

    public function configs()
    {
        $data = Configs::get();
        return response()->json(["data" => $data]);
    }
}



================================================
FILE: app/Http/Controllers/Controller.php
================================================
<?php

namespace App\Http\Controllers;

use Laravel\Lumen\Routing\Controller as BaseController;

class Controller extends BaseController
{
    //
}



================================================
FILE: app/Http/Controllers/DatabaseJsonController.php
================================================
<?php

namespace App\Http\Controllers;

class DatabaseJsonController extends Controller
{
    public function __construct()
    {
        ini_set('memory_limit', '-1');
        set_time_limit(60 * 60);
    }

    public function index($file)
    {
        $file = $file . ".json";
        $filePath = base_path('public/db/json/' . $file);

        if (!file_exists($filePath)) {
            return response()->json(['error' => 'Arquivo não encontrado!', 'path' => $filePath], 404);
        }

        $content = file_get_contents($filePath);
        if ($content === false) {
            return response()->json(['error' => 'Erro ao ler o arquivo!'], 500);
        }

        return response()->json(json_decode($content, true));
    }
}



================================================
FILE: app/Http/Controllers/DownloadController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Params;
use App\Models\DownloadLog;
use Illuminate\Http\Request;


class DownloadController extends Controller
{
    public function index(Request $request)
    {
        $id_language = strtolower($request->id_language ?? $request->query('lang') ?? "pt");
        $params = Params::all();

        $url = $params[$id_language . "_download"];

        DownloadLog::create(['version' => $params[$id_language . "_version"], 'id_language' => $id_language]);

        return redirect($url);
    }
}



================================================
FILE: app/Http/Controllers/FileController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Models\File;
use App\Models\Ftp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FileController extends Controller
{
    public function __construct() {}

    public function index(Request $request)
    {
        $model = new File;
        $data = $model->select();

        if (isset($request["id_album"])) {
            $data = $data
                ->whereRaw('id_file in (select id_file_image from albums where albums.id_album=' . $request["id_album"] . ')')
                ->orWhereRaw('id_file in (select id_file_image from musics inner join albums_musics on albums_musics.id_music=musics.id_music where albums_musics.id_album=' . $request["id_album"] . ')')
                ->orWhereRaw('id_file in (select id_file_music from musics inner join albums_musics on albums_musics.id_music=musics.id_music where albums_musics.id_album=' . $request["id_album"] . ')')
                ->orWhereRaw('id_file in (select id_file_instrumental_music from musics inner join albums_musics on albums_musics.id_music=musics.id_music where albums_musics.id_album=' . $request["id_album"] . ')')
                ->orWhereRaw('id_file in (select id_file_image from lyrics inner join albums_musics on albums_musics.id_music=lyrics.id_music where albums_musics.id_album=' . $request["id_album"] . ')');
        }

        return response()->json(Data::data($data, $request, [$model->getKeyName(), ...$model->getFillable()], 'files'));
    }

    public function show($id, Request $request)
    {
        $file = File::select()->find($id);

        $data = (object) [];
        $data->data = $file;

        if (!$file) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        return response()->json($data);
    }

    public function open($path)
    {
        $replaces = [
            [],
            ['images/', 'imagens/'],
            ['musics/pt/', 'musicas/'],
            ['musics/es/', 'musicas/'],
            ['covers/', 'capas/'],
        ];

        $path = urldecode($path);

        //Checa se o arquivo existe no diretório
        $exist = false;
        $original_path = $path;
        foreach ($replaces as $replace) {
            $search = $replace[0] ?? "";
            $to = $replace[1] ?? "";

            if ($search <> "") {
                $path = str_replace($search, $to, $original_path);
            }

            $path = app()->basePath('public') . "/files/" . $path;
            if (file_exists($path)) {
                $exist = true;
                break;
            }
        }

        if ($exist) {
            $mimeType = $this->getMimeType($path);
            $fileSize = filesize($path);
            $fileName = basename($path);

            // Criar stream do arquivo
            $stream = fopen($path, 'rb');

            // Retornar a resposta com os headers corretos
            return response()->stream(
                function () use ($stream) {
                    fpassthru($stream);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                },
                200,
                [
                    'Content-Type' => $mimeType,
                    'Content-Length' => $fileSize,
                    'Content-Disposition' => 'inline; filename="' . $fileName . '"',
                    'Cache-Control' => 'public, max-age=3600',
                    'Accept-Ranges' => 'bytes',
                ]
            );
        }





        //Arquivo não existe no diretório, tenta pegar de um servidor FTP
        $path = $original_path;

        $ftp = Ftp::inRandomOrder()->first();

        if (!$ftp) {
            return response()->json([
                'error' => 'Nenhum servidor FTP disponível'
            ], 503);
        }


        $data = $ftp->data;
        $storage = Storage::build([
            'driver'   => 'ftp',
            'host'     => $data["host"],
            'username' => $data["username"],
            'password' => $data["password"],
            'root'     => ($data["root"] ?? '/') . 'config',
            'port'     => $data["port"] ?? 21,
            'passive'  => true,
            'ssl'      => false,
            'timeout'  => 30,
        ]);

        $exist = false;
        $original_path = $path;
        foreach ($replaces as $replace) {
            $search = $replace[0] ?? "";
            $to = $replace[1] ?? "";

            if ($search <> "") {
                $path = str_replace($search, $to, $original_path);
            }

            if ($storage->exists($path)) {
                $exist = true;
                break;
            }
        }

        if (!$exist) {
            return response()->json([
                'error' => 'Arquivo não encontrado!',
                'path' => $path
            ], 404);
        }


        $mimeType = $this->getMimeType($path);
        $fileSize = $storage->size($path);
        $fileName = basename($path);

        // Criar stream do arquivo
        $stream = $storage->readStream($path);

        // Retornar a resposta com os headers corretos
        return response()->stream(
            function () use ($stream) {
                fpassthru($stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
            },
            200,
            [
                'Content-Type' => $mimeType,
                'Content-Length' => $fileSize,
                'Content-Disposition' => 'inline; filename="' . $fileName . '"',
                'Cache-Control' => 'public, max-age=3600',
                'Accept-Ranges' => 'bytes',
            ]
        );
    }


    private function getMimeType($path)
    {
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        $mimeTypes = [
            'mp3' => 'audio/mpeg',
            'wav' => 'audio/wav',
            'ogg' => 'audio/ogg',
            'm4a' => 'audio/mp4',
            'mp4' => 'video/mp4',
            'avi' => 'video/x-msvideo',
            'mov' => 'video/quicktime',
            'mkv' => 'video/x-matroska',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'bmp' => 'image/bmp',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'pdf' => 'application/pdf',
            'txt' => 'text/plain',
        ];

        return $mimeTypes[$extension] ?? 'application/octet-stream';
    }
}



================================================
FILE: app/Http/Controllers/FtpController.php
================================================
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Ftp;
use App\Models\FtpLog;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class FtpController extends Controller
{
    public function index(Request $request)
    {
        $id_language = strtolower($request->id_language ?? $request->query('lang') ?? "pt");
        if ($id_language == "") {
            $id_language = "pt";
        }

        $key = env('JWT_SECRET');
        $jwt = $request->get("token");

        $ftp = Ftp::where('id_language', $id_language)->inRandomOrder()->first();

        try {
            JWT::decode($jwt, new Key($key, 'HS256'));
        } catch (\Exception $e) {
            $error = [
                'error' => 'Token inválido',
                'details' => $e->getMessage(),
                'token' => $jwt,
            ];
            self::save_log($request,  $ftp->id_ftp, $error);
            return response()->json($error, 401);
        }

        self::save_log($request, $ftp->id_ftp);

        $data = $ftp->data;
        $data["lang"] = $id_language;

        $text = "";
        foreach ($data as $key => $param) {
            $text .= "$key=$param\r\n";
        }
        return response(base64_encode($text), 200)->header('Content-Type', 'text/plain');
    }

    public function save_log(Request $request, $id_ftp, $error = null)
    {
        $data = [];

        if ($id_ftp) {
            $ftp = Ftp::find($id_ftp);

            $data = [
                'id_ftp' => $ftp->id_ftp ?? null,
                'id_language' => $ftp->id_language ?? null,
            ];
        }
        $data['request'] = $request->toArray();


        $request->request->remove('limit');
        if ($request->data) {
            parse_str(base64_decode($request->data), $p);
            $data["id_language"] = strtolower($p["lang"] ?? "") ?: $ftp->id_language;
            $data["version"] = $p["version"] ?? "";
            $data["bin_version"] = $p["bin_version"] ?? "";
            $data["datetime"] = $p["datetime"] ?? null;
            $data["ip"] = $p["ip"] ?? "";
            $data["directory"] = mb_convert_encoding($p["directory"] ?? "", 'UTF-8', 'auto');
            $data["pc_name"] = mb_convert_encoding($p["pc_name"] ?? "", 'UTF-8', 'auto');
        } elseif ($request->p) {
            //RETROCOMPATIBILIDADE
            parse_str(base64_decode($request->p), $p);
            $data["id_language"] = strtolower($p["lang"] ?? "") ?: $ftp->id_language;
            $data["version"] = $p["versao"] ?? "";
            $data["bin_version"] = $p["versao_exe"] ?? "";
            $data["datetime"] = $p["datahora"] ?? null;
            $data["ip"] = $p["ip"] ?? "";
            $data["directory"] = mb_convert_encoding($p["dir"] ?? "", 'UTF-8', 'auto');
            $data["pc_name"] = mb_convert_encoding($p["pc_name"] ?? "", 'UTF-8', 'auto');
        }
        $data["error"] = $error;


        FtpLog::create($data);
    }
}



================================================
FILE: app/Http/Controllers/HymnalController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Models\Music;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HymnalController extends Controller
{
    public function __construct() {}

    public function index(Request $request)
    {
        $model = new Music;
        $fields = [
            'musics.id_music',
            'musics.name',
            'albums_musics.track',
            'musics.id_file_image',
            DB::raw('concat("' . env("FILES_URL") . '",files_image.dir,"/",files_image.file_name) as url_image'),
            'files_image.version as image_version',
            'musics.id_file_music',
            DB::raw('concat("' . env("FILES_URL") . '",files_music.dir,"/",files_music.file_name) as url_music'),
            'files_music.version as music_version',
            'musics.id_file_instrumental_music',
            DB::raw('concat("' . env("FILES_URL") . '",files_instrumental_music.dir,"/",files_instrumental_music.file_name) as url_instrumental_music'),
            'files_instrumental_music.version as instrumental_music_version',
            'musics.id_language',
            'musics.created_at',
            'musics.updated_at',
        ];
        $data = $model->select($fields)
            ->where('musics.id_language', $request->id_language)
            ->join('albums_musics', 'albums_musics.id_music', 'musics.id_music')
            ->join('categories_albums', 'categories_albums.id_album', 'albums_musics.id_album')
            ->join('categories', 'categories.id_category', 'categories_albums.id_category')
            ->leftJoin('files as files_image', 'musics.id_file_image', 'files_image.id_file')
            ->leftJoin('files as files_music', 'musics.id_file_music', 'files_music.id_file')
            ->leftJoin('files as files_instrumental_music', 'musics.id_file_instrumental_music', 'files_instrumental_music.id_file')
            ->where('categories.slug', 'hymnal')
            ->where('categories.id_language', $request->id_language);
        return response()->json(Data::data($data, $request, $fields));
    }
}



================================================
FILE: app/Http/Controllers/LanguageController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Models\Language;
use Illuminate\Http\Request;

class LanguageController extends Controller
{
    public function __construct() {}

    public function index(Request $request)
    {
        $model = new Language;
        $data = $model->select();

        $data = $data->distinct();
        return response()->json(Data::data($data, $request, [$model->getKeyName(), ...$model->getFillable()]));
    }
}



================================================
FILE: app/Http/Controllers/LyricController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Helpers\Validations;
use App\Models\Lyric;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LyricController extends Controller
{
    public function validationRules(Request $request, $id = null)
    {
        return [
            'id_music' => 'required|exists:musics,id_music',
            'id_language' => 'required|string|exists:languages,id_language',
        ];
    }

    private function validationMessages()
    {
        return Validations::validationMessages();
    }

    public function index(Request $request)
    {
        $model = new Lyric;
        $fields = [
            'lyrics.id_lyric',
            'lyrics.id_music',
            DB::raw('musics.name as music'),
            'lyrics.lyric',
            'lyrics.aux_lyric',
            'lyrics.id_file_image',
            'lyrics.time',
            'lyrics.instrumental_time',
            'lyrics.show_slide',
            'lyrics.order',
            'lyrics.id_language',
        ];
        $data = $model->select($fields)
            ->leftJoin('musics', 'musics.id_music', 'lyrics.id_music');

        if ($request->id_language) {
            $data->where('lyrics.id_language', $request->id_language);
        }

        if (isset($request["id_album"])) {
            $data = $data
                ->join('albums_musics', 'albums_musics.id_music', 'lyrics.id_music')
                ->where('albums_musics.id_album', $request["id_album"]);
        }

        return response()->json(Data::data($data, $request, $fields));
    }

    public function show($id, Request $request)
    {
        $lyric = Lyric::select(
            'lyrics.id_lyric',
            'lyrics.id_music',
            'lyrics.lyric',
            'lyrics.aux_lyric',
            'lyrics.id_file_image',
            DB::raw('concat("' . env("FILES_URL") . '",files.dir,"/",files.file_name) as url_image'),
            DB::raw('files.version as image_version'),
            'lyrics.time',
            'lyrics.instrumental_time',
            'lyrics.show_slide',
            'lyrics.order',
            'lyrics.id_language',
            'lyrics.created_at',
            'lyrics.updated_at',
        )
            ->leftJoin('files', 'lyrics.id_file_image', 'files.id_file')
            ->find($id);

        $data = (object) [];
        $data->data = $lyric;

        if (!$lyric) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $this->validate($request, $this->validationRules($request), $this->validationMessages());

        $lyric = Lyric::create($request->all());

        $data = (object) [];
        $data->data = $lyric;
        $data->message = 'Registro cadastrado com sucesso!';
        return response()->json($data, 201);
    }

    public function update(Request $request, $id)
    {
        $this->validate($request, $this->validationRules($request, $id), $this->validationMessages());

        $lyric = Lyric::find($id);

        $data = (object) [];
        $data->data = $lyric;

        if (!$lyric) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $lyric->update($request->all());

        $data->message = 'Registro alterado com sucesso!';
        return response()->json($data);
    }

    public function destroy($id)
    {
        $lyric = Lyric::find($id);

        $data = (object) [];
        $data->data = $lyric;

        if (!$lyric) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $lyric->delete();
        return response()->json(['message' => 'Registro excluído com sucesso!']);
    }
}



================================================
FILE: app/Http/Controllers/MusicController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Helpers\Validations;
use App\Models\Lyric;
use App\Models\AlbumMusic;
use App\Models\Music;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MusicController extends Controller
{
    public function validationRules(Request $request, $id = null)
    {
        return [
            'name' => 'required|string',
            'id_language' => 'required|string|exists:languages,id_language',
        ];
    }

    private function validationMessages()
    {
        return Validations::validationMessages();
    }

    public function index(Request $request)
    {
        $model = new Music;
        $fields = [
            'musics.id_music',
            'musics.name',
            'musics.id_file_image',
            DB::raw('concat("' . env("FILES_URL") . '",files_image.dir,"/",files_image.file_name) as url_image'),
            'files_image.version as image_version',
            'musics.id_file_music',
            DB::raw('concat("' . env("FILES_URL") . '",files_music.dir,"/",files_music.file_name) as url_music'),
            'files_music.version as music_version',
            'musics.id_file_instrumental_music',
            DB::raw('concat("' . env("FILES_URL") . '",files_instrumental_music.dir,"/",files_instrumental_music.file_name) as url_instrumental_music'),
            'files_instrumental_music.version as instrumental_music_version',
            'musics.id_language',
            'musics.created_at',
            'musics.updated_at',
        ];
        $data = $model->select($fields)
            ->leftJoin('files as files_image', 'musics.id_file_image', 'files_image.id_file')
            ->leftJoin('files as files_music', 'musics.id_file_music', 'files_music.id_file')
            ->leftJoin('files as files_instrumental_music', 'musics.id_file_instrumental_music', 'files_instrumental_music.id_file');
        if ($request->id_language) {
            $data->where('musics.id_language', $request->id_language);
        }

        if (isset($request["with_albums"]) && $request["with_albums"] == 1) {
            $data = $data->with('albums');
        }

        if (isset($request["id_album"])) {
            $data = $data
                ->join('albums_musics', 'albums_musics.id_music', 'musics.id_music')
                ->where('albums_musics.id_album', $request["id_album"]);
        }

        return response()->json(Data::data($data, $request, $fields));
    }

    public function show($id, Request $request)
    {
        $music = Music::select(
            'musics.id_music',
            'musics.name',
            'musics.id_file_image',
            DB::raw('concat("' . env("FILES_URL") . '",files_image.dir,"/",files_image.file_name) as url_image'),
            DB::raw('files_image.version as image_version'),
            DB::raw('files_image.image_position as image_position'),
            'musics.id_file_music',
            DB::raw('concat("' . env("FILES_URL") . '",files_music.dir,"/",files_music.file_name) as url_music'),
            DB::raw('files_music.version as music_version'),
            'musics.id_file_instrumental_music',
            DB::raw('concat("' . env("FILES_URL") . '",files_instrumental_music.dir,"/",files_instrumental_music.file_name) as url_instrumental_music'),
            DB::raw('files_instrumental_music.version as instrumental_music_version'),
            'musics.id_language',
            'musics.created_at',
            'musics.updated_at',
        )
            ->leftJoin('files as files_image', 'musics.id_file_image', 'files_image.id_file')
            ->leftJoin('files as files_music', 'musics.id_file_music', 'files_music.id_file')
            ->leftJoin('files as files_instrumental_music', 'musics.id_file_instrumental_music', 'files_instrumental_music.id_file')
            ->find($id);
        if ($music) {
            $music->lyric = Lyric::where('id_music', $music->id_music)
                ->leftJoin('files as files_image', 'lyrics.id_file_image', 'files_image.id_file')
                ->select(
                    'lyrics.id_lyric',
                    'lyrics.id_music',
                    'lyrics.lyric',
                    DB::raw('ifnull(lyrics.id_file_image,0' . $music->id_file_image . ') id_file_image'),
                    DB::raw('ifnull(concat("' . env("FILES_URL") . '",files_image.dir,"/",files_image.file_name),"' . $music->url_image . '") as url_image'),
                    DB::raw('ifnull(files_image.version,0' . $music->image_version . ') as image_version'),
                    DB::raw('ifnull(files_image.image_position,0' . $music->image_position . ') as image_position'),
                    'lyrics.time',
                    'lyrics.instrumental_time',
                    'lyrics.show_slide',
                    'lyrics.order',
                    'lyrics.id_language',
                    'lyrics.created_at',
                    'lyrics.updated_at',
                )
                ->orderBy('order')->get();
        }

        $data = (object) [];
        $data->data = $music;

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $this->validate($request, $this->validationRules($request), $this->validationMessages());

        $music = Music::create($request->all());

        $data = (object) [];
        $data->data = $music;
        $data->message = 'Registro cadastrado com sucesso!';
        return response()->json($data, 201);
    }

    public function update(Request $request, $id)
    {
        $this->validate($request, $this->validationRules($request, $id), $this->validationMessages());

        $music = Music::find($id);

        $data = (object) [];
        $data->data = $music;

        if (!$music) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $music->update($request->all());

        $data->message = 'Registro alterado com sucesso!';
        return response()->json($data);
    }

    public function destroy($id)
    {
        $music = Music::find($id);

        $data = (object) [];
        $data->data = $music;

        if (!$music) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        Lyric::where('id_music', $id)->delete();
        AlbumMusic::where('id_music', $id)->delete();
        $music->delete();
        return response()->json(['message' => 'Registro excluído com sucesso!']);
    }
}



================================================
FILE: app/Http/Controllers/OnlineVideosController.php
================================================
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\OnlineVideo;
use App\Models\OnlineVideoPlaylist;
use App\Models\OnlineVideoChannel;

class OnlineVideosController extends Controller
{
    public function index(Request $request)
    {
        $id_language = strtolower($request->id_language ?? $request->query('lang') ?? "pt");
        if ($id_language == "") {
            $id_language = "pt";
        }

        $type = $request->query('tipo') ?? "tudo";
        $id = $request->query('id') ?? "";

        $sql = [];

        // SQL CANAIS
        if ($type == "canais" || $type == "tudo") {
            $sql[] = "DELETE FROM ONL_CANAIS";

            $channels = OnlineVideoChannel::where('id_language', $id_language)->where('status', 'validated')->get();
            foreach ($channels as $channel) {
                $sql[] = sprintf(
                    "INSERT INTO ONL_CANAIS (CANAL_ID,NOME,CUSTOM_URL,IMAGEM,IMAGEM_64) VALUES ('%s','%s','%s','%s','%s')",
                    $this->escapeString($channel->channel_id),
                    $this->escapeString($channel->title),
                    $this->escapeString($channel->custom_url),
                    $this->escapeString($channel->default_image),
                    $this->escapeString($channel->default_image_base64)
                );
            }
        }

        // SQL PLAYLISTS
        if ($type == "playlists" || $type == "tudo") {
            $sql[] = sprintf("DELETE FROM ONL_PLAYLISTS %s", $id ? "WHERE CANAL_ID = '$id'" : "");

            $playlists = OnlineVideoPlaylist::where('id_language', $id_language)->where('status', 'validated');
            if ($id <> "") {
                $playlists->with('channel')->whereHas('channel', function ($query) use ($id) {
                    $query->where('channel_id', $id);
                });
            }
            $playlists = $playlists->get();
            foreach ($playlists as $playlist) {
                $sql[] = sprintf(
                    "INSERT INTO ONL_PLAYLISTS (PLAYLIST_ID,CANAL_ID,NOME,IMAGEM,IMAGEM_64) VALUES ('%s','%s','%s','%s','%s')",
                    $this->escapeString($playlist->playlist_id),
                    $this->escapeString($playlist->channel->channel_id),
                    $this->escapeString($playlist->title),
                    $this->escapeString($playlist->default_image),
                    $this->escapeString($playlist->default_image_base64)
                );
            }
        }

        // SQL VIDEOS
        if ($type == "videos" || $type == "tudo") {
            $sql[] = sprintf("DELETE FROM ONL_VIDEOS %s", $id ? "WHERE PLAYLIST_ID = '$id'" : "");

            $videos = OnlineVideo::where('id_language', $id_language)->where('status', 'validated');
            if ($id <> "") {
                $videos->with('playlist')->whereHas('playlist', function ($query) use ($id) {
                    $query->where('playlist_id', $id);
                });
            }
            $videos = $videos->get();
            foreach ($videos as $video) {
                $sql[] = sprintf(
                    "INSERT INTO ONL_VIDEOS (VIDEO_ID,PLAYLIST_ID,NOME,POSICAO,IMAGEM,IMAGEM_64) VALUES ('%s','%s','%s','%s','%s','%s')",
                    $this->escapeString($video->video_id),
                    $this->escapeString($video->playlist->playlist_id),
                    $this->escapeString($video->title),
                    $this->escapeString($video->sequence),
                    $this->escapeString($video->default_image),
                    $this->escapeString($video->default_image_base64)
                );
            }
        }

        return implode("|", $sql) . PHP_EOL;
    }

    private function escapeString($string)
    {
        return str_replace("'", "\'", $string);
    }
}



================================================
FILE: app/Http/Controllers/ParamsController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Params;
use Illuminate\Http\Request;

class ParamsController extends Controller
{
    public function index(Request $request)
    {
        $type = $request->get("type") ?? "json";

        $params = Params::all();

        if ($type == "env") {
            $text = "";
            foreach ($params as $key => $param) {
                $text .= "$key=$param\r\n";
            }
            return response($text, 200)->header('Content-Type', 'text/plain');
        } else {
            return response()->json($params);
        }
    }
}



================================================
FILE: app/Http/Controllers/PlayerController.php
================================================
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class PlayerController extends Controller
{
    public function __construct() {}

    public function index(Request $request)
    {
        $id = $request->v;
        $url = "https://www.youtube.com/embed/$id";

        return "
            <html>
                <head>
                    <title>Player</title>
                    <style>
                        html,body{
                            margin:0;
                            padding:0;
                            background:#000;
                        }
                        iframe{
                            position:absolute;
                            width:100%;
                            height:100%;
                            top:0;
                            left:0;
                            border:0;
                        }
                    </style>
                </head>
                <body>
                    <iframe src='$url' title='Player' frameborder='0' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share' referrerpolicy='strict-origin-when-cross-origin' allowfullscreen>
                    </iframe>
                </body>
            </html>
        ";
    }
}



================================================
FILE: app/Http/Controllers/TaskController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Configs;
use App\Helpers\Files;
use App\Helpers\OnlineVideos;
use App\Helpers\DataBase;
use App\Helpers\Ftp;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function __construct()
    {
        ini_set('memory_limit', '-1');
        set_time_limit(60 * 60);
    }

    public function refresh_files_size($check_version = true)
    {
        if ($check_version) {
            $version = Configs::get("version");
            $last_version = Configs::get("version_files_size");
            if ($last_version == $version) {
                return;
            }
        }
        $ret = Files::refresh_size();
        Configs::set("version_files_size", $version);
        return $ret;
    }

    public function refresh_files_duration($check_version = true)
    {
        if ($check_version) {
            $version = Configs::get("version");
            $last_version = Configs::get("version_files_duration");
            if ($last_version == $version) {
                return;
            }
        }
        $ret = Files::refresh_duration();
        Configs::set("version_files_duration", $version);
        return $ret;
    }

    public function refresh_online_videos()
    {
        $ret = OnlineVideos::refresh();
        if ($ret["status"] == "") {
            $ret = [];
        }
        return $ret;
    }

    public function refresh_configs()
    {
        $ret = Configs::refresh();
        if ($ret["status"] <> "") {
            $data = Configs::get();
            $ret["data"] = $data;
        } else {
            $ret = [];
        }

        return $ret;
    }

    public function export_database($check_version = true)
    {
        if ($check_version) {
            $version = Configs::get("version");
            $last_version = Configs::get("version_export_database");
            if ($last_version == $version) {
                return;
            }
        }

        $ret = DataBase::export();
        if ($ret["error"] && $ret["error"] <> "") {
            Configs::set("version_export_database", -1);
        } else {
            Configs::set("version_export_database", $version);
        }
        return $ret;
    }

    public function export_database_json($check_version = true)
    {
        if (request("force") && request("force") == "true") {
            $check_version = false;
        }

        if ($check_version) {
            $version = Configs::get("version");
            $last_version = Configs::get("version_export_database_json");
            if ($last_version == $version) {
                return [];
            }
        }

        $ret = DataBase::export_json();
        if ($check_version) {
            Configs::set("version_export_database_json", $version);
        }
        return $ret;
    }

    public function send_database_ftp($check_version = true)
    {
        if ($check_version) {
            $version = Configs::get("version");
            $last_version = Configs::get("version_send_database_ftp");
            if ($last_version == $version) {
                return;
            }
        }

        $ret = Ftp::send_database();
        if ($ret["status"] == true) {
            Configs::set("version_send_database_ftp", $version);
        }
        return $ret;
    }

    public function import_slides()
    {
        $dir = app()->basePath('public') . DIRECTORY_SEPARATOR . 'import' . DIRECTORY_SEPARATOR;

        $files = Files::list_files($dir);

        if (isset($files["error"])) {
            return response()->json($files);
        }

        $log = [];
        foreach ($files as $file) {
            $ret = DataBase::import_file($file["path"]);
            $log[] = ['file' => $file['name'], 'status' => $ret];
        }

        return response()->json($log);
    }

    public function index(Request $request)
    {
        /*  Configs::refresh();

        $version = Configs::get("version");
        $last_version = Configs::get("last_version");
        $force = ($request->force ?? 0);
        $logs = [];

        if ($force == 1 || $last_version <> $version) {

            //Teve alterações no banco de dados. Gera os dados novamente

            //Ajusta tamanho dos arquivos, caso tenham novos arquivos
            $logs["refresh_files_size"] = Files::refresh_size();

            //Exporta o banco de dados
            $logs["export_database"] = DataBase::export();


            //Atualiza a versão anterior para ficar igual a atual
            $logs["new_version"] = Configs::set("last_version", $version);
        }

        $data = Configs::get();
        return response()->json(["logs" => $logs, "data" => $data]);*/

        return response()->json([]);
    }
}



================================================
FILE: app/Http/Controllers/UserController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Data;
use App\Helpers\Validations;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function validationRules(Request $request, $id = null)
    {
        return [
            'name' => 'required|string',
            'username' => 'required|string|unique:users,username' . ($id ? ",$id" : ''),
            'email' => 'required|string|email|unique:users,email' . ($id ? ",$id" : ''),
        ];
    }

    private function validationMessages()
    {
        return Validations::validationMessages();
    }


    public function index(Request $request)
    {
        $model = new User;
        $data = $model->select();

        return response()->json(Data::data($data, $request, [$model->getKeyName(), ...$model->getFillable()]));
    }

    public function show($id, Request $request)
    {
        $user = User::find($id);

        $data = (object) [];
        $data->data = $user;

        if (!$user) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $rules = $this->validationRules($request);
        $rules['password'] = 'required|string|min:6';

        $this->validate($request, $rules, $this->validationMessages());

        $inputs = $request->except('is_admin');
        if ($request->filled('password')) {
            $inputs['password'] = Hash::make($request->input('password'));
            $inputs['is_temporary_password'] = true;
        }
        $user = User::create($inputs);

        $data = (object) [];
        $data->data = $user;
        $data->message = 'Registro cadastrado com sucesso!';
        return response()->json($data, 201);
    }

    public function update(Request $request, $id)
    {
        $rules = $this->validationRules($request, $id);
        if ($request->filled('password')) {
            $rules['password'] = 'required|string|min:6';
        }

        $this->validate($request, $rules, $this->validationMessages());

        $user = User::find($id);

        $data = (object) [];
        $data->data = $user;

        if (!$user) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        $inputs = $request->except('is_admin');
        if ($request->filled('password')) {
            if ($user->is_admin) {
                return response()->json(['error' => 'A senha do administrador não pode ser alterada por esta rota!'], 400);
            }
            $inputs['password'] = Hash::make($request->input('password'));
            $inputs['is_temporary_password'] = true;
        }
        if ($user->is_admin) {
            unset($inputs['permissions']);
        }
        $user->update($inputs);

        $data->message = 'Registro alterado com sucesso!';
        return response()->json($data);
    }

    public function destroy($id)
    {
        $user = User::find($id);

        $data = (object) [];
        $data->data = $user;

        if (!$user) {
            return response()->json(['error' => 'Registro não encontrado!'], 404);
        }

        if ($user->is_admin) {
            return response()->json(['error' => 'Este usuário não pode ser excluído!'], 400);
        }

        $user->delete();
        return response()->json(['message' => 'Registro excluído com sucesso!']);
    }
}



================================================
FILE: app/Http/Controllers/VersionLogController.php
================================================
<?php

namespace App\Http\Controllers;

use App\Helpers\Params;
use Illuminate\Http\Request;


class VersionLogController extends Controller
{
    public function index(Request $request)
    {
        $id_language = strtolower($request->id_language ?? $request->query('lang') ?? "pt");

        $params = Params::all();
        $version = $request->query('version') ?? $request->query('versao') ?? $params[$id_language . "_version"];

        $version_array = explode(".", $version);
        $version_software = $version_array[0] . "." . $version_array[1];

        $url = 'https://api.github.com/repos/louvorja/desktop/releases/tags/v' . $version_software;

        $response = \Illuminate\Support\Facades\Http::get($url);
        $api = json_decode($response->getBody()->getContents(), true);

        if (array_key_exists("status", $api) && $api["status"] == 404) {
            $api["body"] = "Não foi possivel encontrar informações sobre a versão $version!";
        }

        $html = "<html>";
        $html .= "<head>";
        $html .= "<style>body { padding: 20px; font-family: Arial, sans-serif; color: #666; }</style>";
        $html .= "</head>";
        $html .= "<body>";
        $html .= "<h1>$version</h1>";
        $html .= nl2br($api["body"]);
        $html .= "</body></html>";

        return $html;
    }
}



================================================
FILE: app/Http/Middleware/AccessMiddleware.php
================================================
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AccessMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next, $access = null)
    {
        if (!Auth::user()->is_admin) {
            $method = $request->getMethod();
            $permission = $access . ($method == "POST" ? ".insert" : ($method == "PUT" ? ".update" : ($method == "DELETE" ? ".delete" : "")));

            if (!in_array($permission, Auth::user()->permissions ?? [])) {
                return response()->json(['error' => 'Você não tem permissão para executar esta ação. Permissão necessária: "' . $permission . '"'], 401);
            }
        }

        return $next($request);
    }
}



================================================
FILE: app/Http/Middleware/ApiMiddleware.php
================================================
<?php

namespace App\Http\Middleware;

use Closure;

class ApiMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        $debug = env('APP_DEBUG', false);

        if (!$debug) {
            if (!$request->header('Api-Token')) {
                return response()->json(['error' => "Token de API não informado!"], 401);
            }
            if ($request->header('Api-Token') != env('API_TOKEN')) {
                return response()->json(['error' => "Token de API inválido!"], 401);
            }
        }

        $request->request->add(['limit' => ($request->limit ? (int) $request->limit : 100)]);
        if ($request->limit <= 0) {
            $request->request->add(['limit' => 999999]);
        }

        return $next($request);
    }
}



================================================
FILE: app/Http/Middleware/Authenticate.php
================================================
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Auth\Factory as Auth;

class Authenticate
{
    /**
     * The authentication guard factory instance.
     *
     * @var \Illuminate\Contracts\Auth\Factory
     */
    protected $auth;

    /**
     * Create a new middleware instance.
     *
     * @param  \Illuminate\Contracts\Auth\Factory  $auth
     * @return void
     */
    public function __construct(Auth $auth)
    {
        $this->auth = $auth;
    }

    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string|null  $guard
     * @return mixed
     */
    public function handle($request, Closure $next, $guard = null)
    {
        if ($this->auth->guard($guard)->guest()) {
            return response()->json([
                'error' => 'Token inválido ou expirado.',
                'code' => 401
            ], 401);
        }

        return $next($request);
    }
}



================================================
FILE: app/Http/Middleware/ConfirmedPasswordMiddleware.php
================================================
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ConfirmedPasswordMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        if (Auth::check() && Auth::user()->is_temporary_password) {
            return response()->json(['error' => "Necessário alterar sua senha para executar esta ação!"], 401);
        }

        return $next($request);
    }
}



================================================
FILE: app/Http/Middleware/CorsMiddleware.php
================================================
<?php

namespace App\Http\Middleware;

use Closure;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CorsMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        $headers = [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'POST, GET, OPTIONS, PUT, DELETE',
            'Access-Control-Allow-Credentials' => 'true',
            'Access-Control-Max-Age' => '86400',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With, Api-Token',
        ];

        if ($request->isMethod('OPTIONS')) {
            return response()->json('{"method":"OPTIONS"}', 200, $headers);
        }

        $response = $next($request);

        // Adiciona headers de forma compatível com todos os tipos de resposta
        foreach ($headers as $key => $value) {
            // Usa o método correto para cada tipo de resposta
            $response->headers->set($key, $value);
        }

        return $response;
    }
}



================================================
FILE: app/Http/Middleware/GeneralMiddleware.php
================================================
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class GeneralMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $userAgent = $request->header('User-Agent');
        if (str_contains($userAgent, 'bot') || str_contains($userAgent, 'crawler')) {
            return response('Access denied for bots', 403);
        }

        $host = $request->getHost();
        $path = $request->path();

        $host_parts = explode(".", $host);
        $subdomain = $host_parts[0];
        if ($subdomain === 'www') {
            array_shift($host_parts);
            $subdomain = $host_parts[0];
        }

        // Verifica a requisição da url
        if ($subdomain !== 'api' && $subdomain !== 'localhost') {
            $locale = 'pt'; // Idioma padrão

            // Verifica se a URL contém um segmento de idioma (ex: /es)
            if (preg_match('/^es(\/|$)/', $path)) {
                $locale = 'es';
            }

            // Redireciona para a URL correta na API
            return redirect("https://api.louvorja.com.br/{$locale}/{$subdomain}");
        }

        return $next($request);
    }
}



================================================
FILE: app/Http/Middleware/LangMiddleware.php
================================================
<?php

namespace App\Http\Middleware;

use App\Models\Language;
use Cache;
use Closure;

class LangMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        list($lang) = explode("/", $request->path());

        $cache = env('APP_CACHE', true);

        if ($lang != "") {
            if (!$cache || Cache::store('file')->get("lang_{$lang}") != true) {
                //error_log("*** Localiza idioma ***");
                if (!Language::find($lang)) {
                    return response()->json(['error' => "Idioma '$lang' não encontrado."], 401);
                }

                if ($cache) {
                    // Armazena a verificação em cache, por 24 horas
                    // para não precisar repetir consulta no BD
                    //error_log("*** Armazena em cache (lang_{$lang}) ***");
                    Cache::store('file')->put("lang_{$lang}", true, 60 * 60 * 24);
                }
            }
        }

        $request->id_language = $lang;

        return $next($request);
    }
}



================================================
FILE: app/Jobs/ExampleJob.php
================================================
<?php

namespace App\Jobs;

class ExampleJob extends Job
{
    /**
     * Create a new job instance.
     *
     * @return void
     */
    public function __construct()
    {
        //
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        //
    }
}



================================================
FILE: app/Jobs/Job.php
================================================
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

abstract class Job implements ShouldQueue
{
    /*
    |--------------------------------------------------------------------------
    | Queueable Jobs
    |--------------------------------------------------------------------------
    |
    | This job base class provides a central location to place any logic that
    | is shared across all of your jobs. The trait included with the class
    | provides access to the "queueOn" and "delay" queue helper methods.
    |
    */

    use InteractsWithQueue, Queueable, SerializesModels;
}



================================================
FILE: app/Listeners/ExampleListener.php
================================================
<?php

namespace App\Listeners;

use App\Events\ExampleEvent;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class ExampleListener
{
    /**
     * Create the event listener.
     *
     * @return void
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     *
     * @param  \App\Events\ExampleEvent  $event
     * @return void
     */
    public function handle(ExampleEvent $event)
    {
        //
    }
}



================================================
FILE: app/Models/Album.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class Album extends BaseModel
{
    protected $primaryKey = 'id_album';
    protected $fillable = [
        'name',
        'id_file_image',
        'id_language',
        'color',
    ];

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'categories_albums', 'id_album', 'id_category')->withPivot(['name', 'order']);
    }

    public function musics()
    {
        return $this->belongsToMany(Music::class, 'albums_musics', 'id_album', 'id_music')->withPivot(['track']);
    }
}



================================================
FILE: app/Models/AlbumMusic.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class AlbumMusic extends BaseModel
{
    protected $table = 'albums_musics';
    protected $primaryKey = 'id_album_music';
    public $incrementing = false;
    protected $fillable = [
        'id_album',
        'id_music',
        'track',
        'id_language',
    ];


    public function music()
    {
        return $this->belongsTo(Music::class, 'id_music', 'id_music');
    }

    public function album()
    {
        return $this->belongsTo(Album::class, 'id_album', 'id_album');
    }
}



================================================
FILE: app/Models/BaseModel.php
================================================
<?php

namespace App\Models;

use App\Models\Log;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use App\Services\TelegramService;

class BaseModel extends Model
{
    public static function boot()
    {
        parent::boot();

        static::created(function ($model) {
            self::logChanges($model, 'insert', [], $model->getAttributes());
        });

        static::updated(function ($model) {
            $oldValues = $model->getOriginal();
            $newValues = $model->getAttributes();
            self::logChanges($model, 'update', $oldValues, $newValues);
        });

        static::deleted(function ($model) {
            self::logChanges($model, 'delete', $model->getAttributes(), []);
        });
    }

    private static function logChanges($model, $action, $oldValues, $newValues)
    {
        if ($model->getTable() == "configs") {
            return;
        }

        $telegram_log = "";
        if ($action === 'update') {
            $changedValues = [];
            $changedOldValues = [];

            foreach ($newValues as $key => $newValue) {
                if (array_key_exists($key, $oldValues) && $oldValues[$key] !== $newValue) {
                    $changedValues[$key] = $newValue;
                    $changedOldValues[$key] = $oldValues[$key];

                    $telegram_log .= "🟡 <b>{$key}</b>\n";
                    $telegram_log .= "<blockquote><s>{$oldValues[$key]}</s></blockquote>\n";
                    $telegram_log .= "<blockquote>{$newValue}</blockquote>\n";
                } else {
                    $telegram_log .= "⚪ <b>{$key}</b>\n";
                    $telegram_log .= "<blockquote>{$newValue}</blockquote>\n";
                }
                $telegram_log .= "\n";
            }

            if (empty($changedValues)) {
                return;
            }

            $oldValues = $changedOldValues;
            $newValues = $changedValues;
        } elseif ($action === 'insert') {
            foreach ($newValues as $key => $value) {
                $telegram_log .= "✔️ <b>{$key}</b>\n";
                $telegram_log .= "<blockquote>{$value}</blockquote>\n\n";
            }
        } else {
            foreach ($oldValues as $key => $value) {
                $telegram_log .=  "❌ <b>{$key}</b>\n";
                $telegram_log .= "<blockquote>{$value}</blockquote>\n\n";
            }
        }

        Log::create([
            'table' => $model->getTable(),
            'action' => $action,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'user_id' => Auth::check() ? Auth::user()->id : null,
            'user' => Auth::check() ? Auth::user() : null,
        ]);


        $telegramService = new TelegramService();

        $message = "";
        $message .= "<b>" . ($action == "insert"
            ? "🟩🟩🟩 Novo Registro 🟩🟩🟩"
            : (
                $action == "update"
                ? "🟨🟨🟨 Registro Alterado 🟨🟨🟨"
                : "🟥🟥🟥 Registro Removido 🟥🟥🟥"
            )
        ) . "</b>\n";
        $message .= "\n";
        $message .= "🏷️ {$model->getTable()}\n";
        $message .= ($action == "insert" ? "🟢" : ($action == "update" ? "🟡" : "🔴")) . " {$action}\n";
        $message .= "👤 " . (Auth::check() ? Auth::user()->name : 'Desconhecido') . "\n";
        $message .= "\n";
        $message .= "{$telegram_log}\n";
        $message .= "<b>Resumo:</b>\n";
        $message .= "Antes: <pre>" . json_encode($oldValues, JSON_PRETTY_PRINT) . "</pre>\n\n";
        $message .= "Depois: <pre>" . json_encode($newValues, JSON_PRETTY_PRINT) . "</pre>\n\n";
        $message .= "Usuário: <pre>" . json_encode(Auth::user(), JSON_PRETTY_PRINT) . "</pre>\n\n";

        $telegramService->sendMessage($message);
    }
}



================================================
FILE: app/Models/BibleBook.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class BibleBook extends BaseModel
{
    protected $table = 'bible_book';
    protected $primaryKey = 'id_bible_book';
    protected $fillable = [
        'book_number',
        'name',
        'testament',
        'keywords',
        'abbreviation',
        'id_language',
    ];
}



================================================
FILE: app/Models/BibleVerse.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class BibleVerse extends BaseModel
{
    protected $table = 'bible_verse';
    protected $primaryKey = 'id_bible_verse';
    protected $fillable = [
        'id_bible_version',
        'id_bible_book',
        'chapter',
        'verse',
        'text',
        'id_language',
    ];
}



================================================
FILE: app/Models/BibleVersion.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class BibleVersion extends BaseModel
{
    protected $table = 'bible_version';
    protected $primaryKey = 'id_bible_version';
    protected $fillable = [
        'name',
        'abbreviation',
        'id_language',
    ];
}



================================================
FILE: app/Models/Category.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class Category extends BaseModel
{
    protected $primaryKey = 'id_category';
    protected $fillable = [
        'name',
        'slug',
        'order',
        'type',
        'id_language',
    ];

    public function albums()
    {
        return $this->belongsToMany(Album::class, 'categories_albums', 'id_category', 'id_album')->withPivot(['name', 'order']);
    }
}



================================================
FILE: app/Models/CategoryAlbum.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class CategoryAlbum extends BaseModel
{
    protected $table = 'categories_albums';
    protected $primaryKey = 'id_category_album';
    public $incrementing = false;
    protected $fillable = [
        'id_category',
        'id_album',
        'name',
        'order',
        'id_language',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class, 'id_category', 'id_category');
    }

    public function album()
    {
        return $this->belongsTo(Album::class, 'id_album', 'id_album');
    }
}



================================================
FILE: app/Models/Config.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class Config extends BaseModel
{
    protected $primaryKey = 'id_category';
    protected $fillable = [
        'id_config',
        'key',
        'type',
        'value',
        'details',
    ];

    protected $casts = [
        'details' => 'array',
    ];
}



================================================
FILE: app/Models/DownloadLog.php
================================================
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DownloadLog extends Model
{
    protected $primaryKey = 'id_downalod_log';
    protected $fillable = [
        'version',
        'id_language',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($query) {
            $query->ip = request()->ip();
            $query->http_client_ip = request()->server('HTTP_CLIENT_IP');
            $query->http_x_forwarded_for = request()->server('HTTP_X_FORWARDED_FOR');
            $query->remote_addr = request()->server('REMOTE_ADDR');
            $query->browser = request()->userAgent();
        });
    }
}



================================================
FILE: app/Models/File.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class File extends BaseModel
{
    protected $primaryKey = 'id_file';
    protected $fillable = [
        'name',
        'type',
        'size',
        'base_dir',
        'base_url',
        'subdirectory',
        'file_name',
        'image_position',
        'version',
    ];

    protected $appends = [
        'url',
    ];

    public function getUrlAttribute()
    {
        return env("FILES_URL") . $this->dir . "/" . $this->file_name;
    }
}



================================================
FILE: app/Models/Ftp.php
================================================
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ftp extends Model
{
    protected $table = 'ftp';
    protected $primaryKey = 'id_ftp';
    protected $fillable = [
        'active',
        'data',
        'id_language',
    ];

    protected $casts = [
        'data' => 'array',
    ];
}



================================================
FILE: app/Models/FtpLog.php
================================================
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FtpLog extends Model
{
    protected $table = 'ftp_logs';
    protected $primaryKey = 'id_ftp_log';
    protected $fillable = [
        'id_ftp',
        'version',
        'bin_version',
        'datetime',
        'directory',
        'pc_name',
        'local_ip',
        'ip',
        'http_client_ip',
        'http_x_forwarded_for',
        'remote_addr',
        'browser',
        'request',
        'error',
        'id_language'
    ];

    protected $casts = [
        'request' => 'array',
        'error' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($query) {
            $query->ip = request()->ip();
            $query->http_client_ip = request()->server('HTTP_CLIENT_IP');
            $query->http_x_forwarded_for = request()->server('HTTP_X_FORWARDED_FOR');
            $query->remote_addr = request()->server('REMOTE_ADDR');
            $query->browser = request()->userAgent();
        });
    }
}



================================================
FILE: app/Models/Language.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class Language extends BaseModel
{
    protected $primaryKey = 'id_language';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'id_language',
        'language',
    ];

}



================================================
FILE: app/Models/Log.php
================================================
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Log extends Model
{
    protected $primaryKey = 'id_log';
    protected $fillable = [
        'table',
        'action',
        'old_values',
        'new_values',
        'user_id',
        'user',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'user' => 'array',
    ];
}



================================================
FILE: app/Models/Lyric.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class Lyric extends BaseModel
{
    protected $primaryKey = 'id_lyric';
    protected $fillable = [
        'id_music',
        'lyric',
        'aux_lyric',
        'id_file_image',
        'time',
        'instrumental_time',
        'show_slide',
        'order',
        'id_language',
    ];
}



================================================
FILE: app/Models/Music.php
================================================
<?php

namespace App\Models;

use App\Models\BaseModel;

class Music extends BaseModel
{
    protected $table = 'musics';
    protected $primaryKey = 'id_music';
    protected $fillable = [
        'name',
        'id_file_image',
        'id_file_music',
        'id_file_instrumental_music',
        'id_language',
    ];

    public function albums()
    {
        return $this->belongsToMany(Album::class, 'albums_musics', 'id_music', 'id_album')->withPivot('track');
    }

    public function lyric()
    {
        return $this->hasMany(Lyric::class, 'id_music', 'id_music');
    }
}



================================================
FILE: app/Models/OnlineVideo.php
================================================
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnlineVideo extends Model
{
    protected $table = 'online_videos';
    protected $primaryKey = 'id_online_video';
    protected $fillable = [
        'id_online_video_playlist',
        'video_id',
        'title',
        'description',
        'sequence',
        'default_image',
        'medium_image',
        'high_image',
        'standard_image',
        'maxres_image',
        'default_image_base64',
        'error',
        'status',
        'id_language',
    ];

    public function setTitleAttribute($value)
    {
        $maxLength = 100;
        $this->attributes['title'] = substr($value, 0, $maxLength);
    }

    public function playlist()
    {
        return $this->belongsTo(OnlineVideoPlaylist::class, 'id_online_video_playlist', 'id_online_video_playlist');
    }
}



================================================
FILE: app/Models/OnlineVideoChannel.php
================================================
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnlineVideoChannel extends Model
{
    protected $table = 'online_videos_channels';
    protected $primaryKey = 'id_online_video_channel';
    protected $fillable = [
        'channel_id',
        'title',
        'description',
        'custom_url',
        'default_image',
        'medium_image',
        'high_image',
        'default_image_base64',
        'error',
        'status',
        'playlists',
        'id_language',
    ];

    protected $casts = [
        'playlists' => 'array',
    ];

    public function setTitleAttribute($value)
    {
        $maxLength = 100;
        $this->attributes['title'] = substr($value, 0, $maxLength);
    }
}



================================================
FILE: app/Models/OnlineVideoPlaylist.php
================================================
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnlineVideoPlaylist extends Model
{
    protected $table = 'online_videos_playlists';
    protected $primaryKey = 'id_online_video_playlist';
    protected $fillable = [
        'id_online_video_channel',
        'playlist_id',
        'title',
        'description',
        'default_image',
        'medium_image',
        'high_image',
        'standard_image',
        'maxres_image',
        'default_image_base64',
        'error',
        'status',
        'id_language',
    ];

    public function setTitleAttribute($value)
    {
        $maxLength = 100;
        $this->attributes['title'] = substr($value, 0, $maxLength);
    }

    public function channel()
    {
        return $this->belongsTo(OnlineVideoChannel::class, 'id_online_video_channel', 'id_online_video_channel');
    }
}



================================================
FILE: app/Models/User.php
================================================
<?php

namespace App\Models;

use Illuminate\Auth\Authenticatable;
use App\Models\BaseModel;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;

class User extends BaseModel implements AuthenticatableContract, JWTSubject
{
    use Authenticatable;

    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'is_temporary_password',
        'is_admin',
        'phone',
        'permissions',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = [
        'initials',
        'short_name',
    ];

    protected $casts = [
        'permissions' => 'array',
        'is_admin' => 'boolean',
        'is_temporary_password' => 'boolean',
    ];

    public function getInitialsAttribute()
    {
        $names = explode(' ', trim($this->name));

        if (count($names) === 1) {
            return strtoupper(substr($names[0], 0, 1));
        }

        $firstInitial = strtoupper(substr($names[0], 0, 1));
        $lastInitial = strtoupper(substr(end($names), 0, 1));

        return $firstInitial . $lastInitial;
    }

    public function getShortNameAttribute()
    {
        $names = explode(' ', trim($this->name));

        if (count($names) === 1) {
            return $names[0];
        }

        return $names[0] . ' ' . end($names);
    }

    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims()
    {
        return [
            'name' => $this->name,
            'username' => $this->username,
            'id' => $this->id,
        ];
    }
}



================================================
FILE: app/Providers/AppServiceProvider.php
================================================
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }
}



================================================
FILE: app/Providers/AuthServiceProvider.php
================================================
<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }

    /**
     * Boot the authentication services for the application.
     *
     * @return void
     */
    public function boot()
    {
        // Here you may define how you wish users to be authenticated for your Lumen
        // application. The callback which receives the incoming request instance
        // should return either a User instance or null. You're free to obtain
        // the User instance via an API token or any other method necessary.

        $this->app['auth']->viaRequest('api', function ($request) {
            if ($request->input('api_token')) {
                return User::where('api_token', $request->input('api_token'))->first();
            }
        });
    }
}



================================================
FILE: app/Providers/EventServiceProvider.php
================================================
<?php

namespace App\Providers;

use Laravel\Lumen\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * The event listener mappings for the application.
     *
     * @var array
     */
    protected $listen = [
        \App\Events\ExampleEvent::class => [
            \App\Listeners\ExampleListener::class,
        ],
    ];
}



================================================
FILE: app/Services/TelegramService.php
================================================
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class TelegramService
{
    protected $botToken;
    protected $chatId;

    public function __construct()
    {
        $this->botToken = env('TELEGRAM_BOT_TOKEN');
        $this->chatId = env('TELEGRAM_CHAT_ID');
    }

    public function sendMessage($message)
    {
        $url = "https://api.telegram.org/bot{$this->botToken}/sendMessage";
        $data = [
            'chat_id' => $this->chatId,
            'text' => $message,
            'parse_mode' => 'HTML'
        ];

        Http::withOptions([
            'verify' => env('SSL_VERIFY', false),
        ])->post($url, $data);
    }
}



================================================
FILE: app/Services/YoutubeService.php
================================================
<?php

namespace App\Services;

use GuzzleHttp\Client;

class YoutubeService
{
    protected $key;
    protected $isLocalhost;

    public function __construct()
    {
        $this->key = env('YOUTUBE_KEY');
        $this->isLocalhost = (request()->getHost() === 'localhost' || request()->getHost() === '127.0.0.1');
    }

    public function channel($id)
    {
        $client = new Client();

        try {
            $response = $client->get("https://www.googleapis.com/youtube/v3/channels", [
                'query' => [
                    'part' => 'snippet',
                    'id' => $id,
                    'key' => $this->key,
                ],
                'verify' => !$this->isLocalhost
            ]);

            $data = json_decode($response->getBody(), true);

            if (empty($data['items'])) {
                return ['error' => 'Canal não encontrado'];
            }

            $info = $data['items'][0];
            return $info;
        } catch (\Exception $e) {
            return ['error' => 'Erro ao buscar dados do canal: ' . $e->getMessage()];
        }
    }

    public function playlist($id)
    {
        $client = new Client();

        try {
            $response = $client->get("https://www.googleapis.com/youtube/v3/playlists", [
                'query' => [
                    'part' => 'snippet',
                    'id' => $id,
                    'key' => $this->key,
                ],
                'verify' => !$this->isLocalhost
            ]);

            $data = json_decode($response->getBody(), true);

            if (empty($data['items'])) {
                return ['error' => 'Playlist não encontrada'];
            }

            $info = $data['items'][0];
            return $info;
        } catch (\Exception $e) {
            return ['error' => 'Erro ao buscar dados do canal: ' . $e->getMessage()];
        }
    }

    public function playlistItems($id)
    {
        $client = new Client();
        $pageToken = null;
        $items = [];

        try {
            do {
                $response = $client->get("https://www.googleapis.com/youtube/v3/playlistItems", [
                    'query' => [
                        'part' => 'snippet',
                        'playlistId' => $id,
                        'key' => $this->key,
                        'maxResults' => 50,
                        'pageToken' => $pageToken,
                    ],
                    'verify' => !$this->isLocalhost
                ]);

                $data = json_decode($response->getBody(), true);

                if (isset($data['items'])) {
                    $items = array_merge($items, $data['items']);
                }

                $pageToken = $data['nextPageToken'] ?? null;
            } while ($pageToken);

            return $items;
        } catch (\Exception $e) {
            return ['error' => 'Erro ao buscar dados do canal: ' . $e->getMessage()];
        }
    }
}



================================================
FILE: bootstrap/app.php
================================================
<?php

require_once __DIR__ . '/../vendor/autoload.php';

(new Laravel\Lumen\Bootstrap\LoadEnvironmentVariables(
    dirname(__DIR__)
))->bootstrap();

date_default_timezone_set(env('APP_TIMEZONE', 'UTC'));

/*
|--------------------------------------------------------------------------
| Create The Application
|--------------------------------------------------------------------------
|
| Here we will load the environment and create the application instance
| that serves as the central piece of this framework. We'll use this
| application as an "IoC" container and router for this framework.
|
 */

$app = new Laravel\Lumen\Application(
    dirname(__DIR__)
);

$app->withFacades();

$app->withEloquent();

/*
|--------------------------------------------------------------------------
| Register Container Bindings
|--------------------------------------------------------------------------
|
| Now we will register a few bindings in the service container. We will
| register the exception handler and the console kernel. You may add
| your own bindings here if you like or you can make another file.
|
 */

$app->singleton(
    Illuminate\Contracts\Debug\ExceptionHandler::class,
    App\Exceptions\Handler::class
);

$app->singleton(
    Illuminate\Contracts\Console\Kernel::class,
    App\Console\Kernel::class
);

/*
|--------------------------------------------------------------------------
| Register Config Files
|--------------------------------------------------------------------------
|
| Now we will register the "app" configuration file. If the file exists in
| your configuration directory it will be loaded; otherwise, we'll load
| the default version. You may register other files below as needed.
|
 */

$app->configure('app');
$app->configure('auth');

/*
|--------------------------------------------------------------------------
| Register Middleware
|--------------------------------------------------------------------------
|
| Next, we will register the middleware with the application. These can
| be global middleware that run before and after each request into a
| route or middleware that'll be assigned to some specific routes.
|
 */

$app->middleware([
    App\Http\Middleware\CorsMiddleware::class,
]);

$app->routeMiddleware([
    'api' => App\Http\Middleware\ApiMiddleware::class,
    'lang' => App\Http\Middleware\LangMiddleware::class,
    'auth' => App\Http\Middleware\Authenticate::class,
    'confirmed_pwd' => App\Http\Middleware\ConfirmedPasswordMiddleware::class,
    'access' => App\Http\Middleware\AccessMiddleware::class,
    'general' => \App\Http\Middleware\GeneralMiddleware::class,
]);

/*
|--------------------------------------------------------------------------
| Register Service Providers
|--------------------------------------------------------------------------
|
| Here we will register all of the application's service providers which
| are used to bind services into the container. Service providers are
| totally optional, so you are not required to uncomment this line.
|
 */

// $app->register(App\Providers\AppServiceProvider::class);
// $app->register(App\Providers\AuthServiceProvider::class);
// $app->register(App\Providers\EventServiceProvider::class);
$app->register(PHPOpenSourceSaver\JWTAuth\Providers\LumenServiceProvider::class);
$app->register(Illuminate\Filesystem\FilesystemServiceProvider::class);

/*
|--------------------------------------------------------------------------
| Load The Application Routes
|--------------------------------------------------------------------------
|
| Next we will include the routes file so that they can all be added to
| the application. This will provide all of the URLs the application
| can respond to, as well as the controllers that may handle them.
|
 */

$app->router->group([
    'namespace' => 'App\Http\Controllers',
], function ($router) {
    require __DIR__ . '/../routes/web.php';
});

return $app;



================================================
FILE: config/auth.php
================================================
<?php

return [
    'defaults' => [
        'guard' => 'api',
        'passwords' => 'users',
    ],

    'guards' => [
        'api' => [
            'driver' => 'jwt',
            'provider' => 'users',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => App\Models\User::class,
        ],
    ],

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => 'password_resets',
            'expire' => 60,
        ],
    ],
];



================================================
FILE: config/database.php
================================================
<?php

return [
    'default' => env('DB_CONNECTION', 'mysql'),

    'connections' => [
        'mysql' => [
            'driver' => 'mysql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', 3306),
            'database' => env('DB_DATABASE', 'forge'),
            'username' => env('DB_USERNAME', 'forge'),
            'password' => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => env('DB_CHARSET', 'utf8mb4'),
            'collation' => env('DB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => env('DB_PREFIX', ''),
            'strict' => env('DB_STRICT_MODE', true),
            'engine' => env('DB_ENGINE', null),
            'timezone' => env('DB_TIMEZONE', '+00:00'),
        ],

        'sqlite' => [
            'driver' => 'sqlite',
            'database' => env('DB_SQLITE_DATABASE', database_path('database.sqlite')),
            'prefix' => env('DB_SQLITE_PREFIX', ''),
        ],

    ],
    'migrations' => 'migrations',

];



================================================
FILE: config/jwt.php
================================================
<?php

return [
    /*
    |--------------------------------------------------------------------------
    | JWT Authentication Secret
    |--------------------------------------------------------------------------
    |
    | This key is used by the JWT library to sign tokens. It should be a
    | random string of at least 32 characters, stored in your .env file.
    |
    */
    'secret' => env('JWT_SECRET'),

    /*
    |--------------------------------------------------------------------------
    | JWT time to live
    |--------------------------------------------------------------------------
    |
    | Specify the length of time (in minutes) that the token will be valid for.
    | Defaults to 1 hour.
    |
    */
    'ttl' => env('JWT_TTL', 60),

    /*
    |--------------------------------------------------------------------------
    | Refresh time to live
    |--------------------------------------------------------------------------
    |
    | Specify the length of time (in minutes) that the token can be refreshed
    | within. Defaults to 2 weeks.
    |
    */
    'refresh_ttl' => env('JWT_REFRESH_TTL', 20160),

    /*
    |--------------------------------------------------------------------------
    | JWT hashing algorithm
    |--------------------------------------------------------------------------
    |
    | Specify the hashing algorithm that will be used to sign the token.
    |
    | See here: https://github.com/namshi/jose/tree/master/src/Namshi/JOSE/Signer/OpenSSL
    | for possible values.
    |
    */
    'algo' => env('JWT_ALGO', 'HS256'),

    /*
    |--------------------------------------------------------------------------
    | Required claims
    |--------------------------------------------------------------------------
    |
    | Specify the required claims that must exist in any token.
    | A TokenInvalidException will be thrown if any of these claims are not
    | present in the payload.
    |
    */
    'required_claims' => [
        'iss',
        'iat',
        'exp',
        'nbf',
        'sub',
        'jti'
    ],

    /*
    |--------------------------------------------------------------------------
    | Persistent claims
    |--------------------------------------------------------------------------
    |
    | Specify the claim keys to be persisted when refreshing a token.
    | `sub` and `iat` will automatically be persisted, in
    | addition to the these claims.
    |
    | Note: If a claim does not exist then it will be ignored.
    |
    */
    'persistent_claims' => [
        // 'foo',
        // 'bar',
    ],

    /*
    |--------------------------------------------------------------------------
    | Lock subject
    |--------------------------------------------------------------------------
    |
    | This will determine whether a `prv` claim is automatically added to
    | the token. The purpose of this is to ensure that if you have multiple
    | authentication models e.g. `App\User` & `App\OtherPerson`, then we
    | should prevent one authentication request from impersonating another,
    | if 2 tokens happen to have the same id across the 2 different models.
    |
    */
    'lock_subject' => true,

    /*
    |--------------------------------------------------------------------------
    | Leeway
    |--------------------------------------------------------------------------
    |
    | This property gives the jwt timestamp claims some "leeway".
    | Meaning that if you have any unavoidable slight clock skew on
    | any of your servers then this will afford you some level of cushioning.
    |
    | This applies to the claims `iat`, `nbf` and `exp`.
    |
    | Specify in seconds - only if you know you need it.
    |
    */
    'leeway' => env('JWT_LEEWAY', 0),

    /*
    |--------------------------------------------------------------------------
    | Blacklist Enabled
    |--------------------------------------------------------------------------
    |
    | In order to invalidate tokens, you must have the blacklist enabled.
    | If you do not want or need this functionality, then set this to false.
    |
    */
    'blacklist_enabled' => env('JWT_BLACKLIST_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Blacklist Grace Period
    |--------------------------------------------------------------------------
    |
    | When multiple concurrent requests are made with the same JWT,
    | it is possible that some of them fail, due to token regeneration
    | on every request.
    |
    | Set grace period in seconds to prevent parallel request failure.
    |
    */
    'blacklist_grace_period' => env('JWT_BLACKLIST_GRACE_PERIOD', 0),

    /*
    |--------------------------------------------------------------------------
    | Encryption key
    |--------------------------------------------------------------------------
    |
    | Encryption key used to encrypt the token.
    |
    */
    'encrypt' => env('JWT_ENCRYPT', false),

    'keys' => [
        /*
        |--------------------------------------------------------------------------
        | Public key
        |--------------------------------------------------------------------------
        |
        | A path or resource to your public key.
        |
        | E.g. 'file://path/to/public/key'
        |
        */
        'public' => env('JWT_PUBLIC_KEY'),

        /*
        |--------------------------------------------------------------------------
        | Private key
        |--------------------------------------------------------------------------
        |
        | A path or resource to your private key.
        |
        | E.g. 'file://path/to/private/key'
        |
        */
        'private' => env('JWT_PRIVATE_KEY'),

        /*
        |--------------------------------------------------------------------------
        | Passphrase
        |--------------------------------------------------------------------------
        |
        | The passphrase for your private key. Can be null if none set.
        |
        */
        'passphrase' => env('JWT_PASSPHRASE'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Show blacklisted token option
    |--------------------------------------------------------------------------
    |
    | Specify if you want to show black listed token exception message.
    |
    */
    'show_black_list_exception' => env('JWT_SHOW_BLACK_LIST_EXCEPTION', true),
];



================================================
FILE: database/factories/UserFactory.php
================================================
<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class UserFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = User::class;

    /**
     * Define the model's default state.
     *
     * @return array
     */
    public function definition()
    {
        return [
            'name' => $this->faker->name,
            'email' => $this->faker->unique()->safeEmail,
        ];
    }
}



================================================
FILE: database/migrations/2022_07_17_232239_create_languages_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateLanguagesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('languages', function (Blueprint $table) {
            $table->string('id_language', 5)->primary();
            $table->string('language')->nullable();
            $table->timestamps();
        });

        DB::table('languages')->insert(
            array(
                'id_language' => 'pt',
                'language' => 'Português',
                'created_at' => date('Y-m-d H:i'),
                'updated_at' => date('Y-m-d H:i'),
            )
        );
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('languages');
    }
}



================================================
FILE: database/migrations/2022_07_17_232242_create_files_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateFilesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('files', function (Blueprint $table) {
            $table->increments('id_file');
            $table->string('name', 100);
            $table->string('type');
            $table->integer('size');
            $table->string('dir', 100);
            $table->string('file_name', 100);
            $table->integer('image_position')->nullable();
            $table->time('duration')->nullable();
            $table->integer('version');
            $table->timestamps();

            $table->unique(['dir', 'file_name']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('files');
    }
}



================================================
FILE: database/migrations/2022_07_17_232541_create_albums_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateAlbumsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('albums', function (Blueprint $table) {
            $table->increments('id_album');
            $table->string('name')->nullable();
            $table->unsignedInteger('id_file_image')->nullable();
            $table->string('color', 7);
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_language')->references('id_language')->on('languages');
            $table->foreign('id_file_image')->references('id_file')->on('files');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('albums');
    }
}



================================================
FILE: database/migrations/2022_07_17_233541_create_categories_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCategoriesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->increments('id_category');
            $table->string('name')->nullable();
            $table->string('slug',20)->nullable();
            $table->integer('order');
            $table->string('type',20)->nullable();
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_language')->references('id_language')->on('languages');
            $table->unique(['slug', 'id_language']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('categories');
    }
}



================================================
FILE: database/migrations/2022_07_17_234427_create_musics_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMusicsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('musics', function (Blueprint $table) {
            $table->increments('id_music');
            $table->string('name')->nullable();
            $table->unsignedInteger('id_file_image')->nullable();
            $table->unsignedInteger('id_file_music')->nullable();
            $table->unsignedInteger('id_file_instrumental_music')->nullable();
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_language')->references('id_language')->on('languages');
            $table->foreign('id_file_image')->references('id_file')->on('files');
            $table->foreign('id_file_music')->references('id_file')->on('files');
            $table->foreign('id_file_instrumental_music')->references('id_file')->on('files');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('musics');
    }
}



================================================
FILE: database/migrations/2022_07_17_235106_create_lyrics_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateLyricsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('lyrics', function (Blueprint $table) {
            $table->increments('id_lyric');
            $table->unsignedInteger('id_music');
            $table->string('lyric');
            $table->string('aux_lyric')->nullable();
            $table->unsignedInteger('id_file_image')->nullable();
            $table->time('time');
            $table->time('instrumental_time');
            $table->boolean('show_slide');
            $table->integer('order');
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_music')->references('id_music')->on('musics');
            $table->foreign('id_language')->references('id_language')->on('languages');
            $table->foreign('id_file_image')->references('id_file')->on('files');
            $table->unique(['id_music', 'order']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('lyrics');
    }
}



================================================
FILE: database/migrations/2022_07_17_235826_create_albums_musics_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateAlbumsMusicsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('albums_musics', function (Blueprint $table) {
            $table->increments('id_album_music');
            $table->unsignedInteger('id_album');
            $table->unsignedInteger('id_music');
            $table->integer('track');
            $table->string('id_language', 5);
            $table->timestamps();

            $table->unique(['id_album', 'id_music']);
            $table->foreign('id_album')->references('id_album')->on('albums');
            $table->foreign('id_music')->references('id_music')->on('musics');
            $table->foreign('id_language')->references('id_language')->on('languages');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('albums_musics');
    }
}



================================================
FILE: database/migrations/2022_07_18_000254_create_categories_albums_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCategoriesAlbumsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('categories_albums', function (Blueprint $table) {
            $table->increments('id_category_album');
            $table->unsignedInteger('id_category');
            $table->unsignedInteger('id_album');
            $table->string('name');
            $table->integer('order');
            $table->string('id_language', 5);
            $table->timestamps();

            $table->unique(['id_category', 'id_album']);
            $table->foreign('id_category')->references('id_category')->on('categories');
            $table->foreign('id_album')->references('id_album')->on('albums');
            $table->foreign('id_language')->references('id_language')->on('languages');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('categories_albums');
    }
}



================================================
FILE: database/migrations/2023_01_06_005513_create_configs_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateConfigsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('configs', function (Blueprint $table) {
            $table->string('key');
            $table->enum('type', ['string', 'json', 'number', 'date', 'time', 'datetime']);
            $table->text('value')->nullable();
            $table->json('details')->nullable();
            $table->timestamps();

            $table->primary('key');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('configs');
    }
}



================================================
FILE: database/migrations/2023_10_14_231224_create_bible_book_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateBibleBookTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('bible_book', function (Blueprint $table) {
            $table->increments('id_bible_book');
            $table->integer('book_number');
            $table->string('name');
            $table->integer('chapters');
            $table->tinyInteger('testament');
            $table->string('keywords')->nullable();
            $table->string('abbreviation', 5);
            $table->string('color', 10);
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_language')->references('id_language')->on('languages');
            $table->unique(['book_number', 'id_language']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('bible_book');
    }
}



================================================
FILE: database/migrations/2023_10_14_234620_create_bible_version_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateBibleVersionTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('bible_version', function (Blueprint $table) {
            $table->increments('id_bible_version');
            $table->string('name');
            $table->string('abbreviation');
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_language')->references('id_language')->on('languages');
            $table->unique(['abbreviation', 'id_language']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('bible_version');
    }
}



================================================
FILE: database/migrations/2023_10_15_144259_create_bible_verse_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateBibleVerseTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('bible_verse', function (Blueprint $table) {
            $table->increments('id_bible_verse');
            $table->unsignedInteger('id_bible_version');
            $table->unsignedInteger('id_bible_book');
            $table->integer('chapter');
            $table->integer('verse');
            $table->text('text');
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_bible_version')->references('id_bible_version')->on('bible_version');
            $table->foreign('id_bible_book')->references('id_bible_book')->on('bible_book');
            $table->foreign('id_language')->references('id_language')->on('languages');

            $table->unique(['id_bible_version', 'id_bible_book', 'chapter', 'verse']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('bible_verse');
    }
}



================================================
FILE: database/migrations/2024_08_07_162923_create_users_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUsersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('password');
            $table->boolean('is_temporary_password')->default(true);
            $table->boolean('is_admin')->default(false);
            $table->string('phone')->nullable();
            $table->json('permissions')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('users');
    }
}



================================================
FILE: database/migrations/2024_08_07_164953_add_admin_user_to_users_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AddAdminUserToUsersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::table('users')->insert([
            'name' => 'admin',
            'username' => 'admin',
            'email' => 'admin@louvorja.com.br',
            'is_admin' => true,
            'password' => Hash::make('admin'),
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]);
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        DB::table('users')->where('username', 'admin')->delete();
    }
}



================================================
FILE: database/migrations/2024_09_19_120917_create_logs_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateLogsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('logs', function (Blueprint $table) {
            $table->increments('id_log');
            $table->string('table');
            $table->string('action');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->json('user')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('logs');
    }
}



================================================
FILE: database/migrations/2025_03_08_221253_create_download_logs_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDownloadLogsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('download_logs', function (Blueprint $table) {
            $table->increments('id_download_log');
            $table->string('version', 20);
            $table->string('ip', 50)->nullable();
            $table->string('http_client_ip', 50)->nullable();
            $table->string('http_x_forwarded_for', 50)->nullable();
            $table->string('remote_addr', 50)->nullable();
            $table->string('browser', 255)->nullable();
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_language')->references('id_language')->on('languages');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('download_logs');
    }
}



================================================
FILE: database/migrations/2025_03_13_143424_create_ftp_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateFtpTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('ftp', function (Blueprint $table) {
            $table->increments('id_ftp');
            $table->boolean('active')->default(true);
            $table->json('data')->nullable();
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_language')->references('id_language')->on('languages');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('ftp');
    }
}



================================================
FILE: database/migrations/2025_03_13_185423_create_ftp_logs_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateFtpLogsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('ftp_logs', function (Blueprint $table) {
            $table->increments('id_ftp_logs');
            $table->unsignedInteger('id_ftp')->nullable();
            $table->string('version', 20)->nullable();
            $table->string('bin_version', 20)->nullable();
            $table->datetime('datetime')->nullable();
            $table->string('directory')->nullable();
            $table->string('pc_name', 100)->nullable();
            $table->string('local_ip', 20)->nullable();
            $table->string('ip', 50)->nullable();
            $table->string('http_client_ip', 50)->nullable();
            $table->string('http_x_forwarded_for', 50)->nullable();
            $table->string('remote_addr', 50)->nullable();
            $table->string('browser', 255)->nullable();
            $table->json('request')->nullable();
            $table->json('error')->nullable();
            $table->string('id_language', 5)->nullable();
            $table->timestamps();

            $table->foreign('id_ftp')->references('id_ftp')->on('ftp');
            $table->foreign('id_language')->references('id_language')->on('languages');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('ftp_logs');
    }
}



================================================
FILE: database/migrations/2025_03_16_165612_create_online_videos_channels_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateOnlineVideosChannelsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('online_videos_channels', function (Blueprint $table) {
            $table->increments('id_online_video_channel');
            $table->string('channel_id', 50)->unique();
            $table->string('title', 100)->nullable();
            $table->text('description')->nullable();
            $table->string('custom_url', 50)->nullable();
            $table->string('default_image', 200)->nullable();
            $table->string('medium_image', 200)->nullable();
            $table->string('high_image', 200)->nullable();
            $table->text('default_image_base64')->nullable();
            $table->string('error')->nullable();
            $table->enum('status', ['pending', 'validated', 'error'])->default('pending');
            $table->json('playlists');
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_language')->references('id_language')->on('languages');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('online_videos_channels');
    }
}



================================================
FILE: database/migrations/2025_03_17_132956_create_online_videos_playlists_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateOnlineVideosPlaylistsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('online_videos_playlists', function (Blueprint $table) {
            $table->increments('id_online_video_playlist');
            $table->unsignedInteger('id_online_video_channel');
            $table->string('playlist_id', 50)->unique();
            $table->string('title', 100)->nullable();
            $table->text('description')->nullable();
            $table->string('default_image', 200)->nullable();
            $table->string('medium_image', 200)->nullable();
            $table->string('high_image', 200)->nullable();
            $table->string('standard_image', 200)->nullable();
            $table->string('maxres_image', 200)->nullable();
            $table->text('default_image_base64')->nullable();
            $table->string('error')->nullable();
            $table->enum('status', ['pending', 'validated', 'error'])->default('pending');
            $table->string('id_language', 5);
            $table->timestamps();

            $table->foreign('id_online_video_channel')->references('id_online_video_channel')->on('online_videos_channels')->onUpdate('cascade')->onDelete('cascade');
            $table->foreign('id_language')->references('id_language')->on('languages');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('online_videos_playlists');
    }
}



================================================
FILE: database/migrations/2025_03_17_153425_create_online_videos_table.php
================================================
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateOnlineVideosTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('online_videos', function (Blueprint $table) {
            $table->increments('id_online_video');
            $table->unsignedInteger('id_online_video_playlist');
            $table->string('video_id', 50);
            $table->string('title', 100)->nullable();
            $table->text('description')->nullable();
            $table->integer('sequence')->nullable();
            $table->string('default_image', 200)->nullable();
            $table->string('medium_image', 200)->nullable();
            $table->string('high_image', 200)->nullable();
            $table->string('standard_image', 200)->nullable();
            $table->string('maxres_image', 200)->nullable();
            $table->text('default_image_base64')->nullable();
            $table->string('error')->nullable();
            $table->enum('status', ['pending', 'validated', 'error'])->default('pending');
            $table->string('id_language', 5);
            $table->timestamps();

            $table->unique(['id_online_video_playlist', 'video_id']);

            $table->foreign('id_online_video_playlist')->references('id_online_video_playlist')->on('online_videos_playlists')->onUpdate('cascade')->onDelete('cascade');
            $table->foreign('id_language')->references('id_language')->on('languages');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('online_videos');
    }
}



================================================
FILE: database/migrations/.gitkeep
================================================
--EXECUTAR MIGRATE
php artisan migrate

--EXECUTAR SEED / SEED ESPECÍFICA
php artisan db:seed
php artisan db:seed --class=PeopleSeeder

--DESAFAZER MIGRATE
php artisan migrate:rollback --step=1

--REFAZER DB
php artisan migrate:fresh

--REFAZER E EXECUTAR TODAS AS SEEDS
php artisan migrate:fresh --seed

--ADD MIGRATE
php artisan make:migration create_flights_table


================================================
FILE: database/seeders/DatabaseSeeder.php
================================================
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        // $this->call('UsersTableSeeder');
    }
}



================================================
FILE: database/seeders/TaskControllerSeeder.php
================================================
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Http\Controllers\TaskController;

class TaskControllerSeeder extends Seeder
{
    public function run()
    {
        (new TaskController())->export_database();
        $this->command->info('Database export completed.');
    }
}



================================================
FILE: database/seeders/UsersTableSeeder.php
================================================
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use Faker\Factory as Faker;

class UsersTableSeeder extends Seeder
{
    public function run()
    {
        $faker = Faker::create();

        for ($i = 0; $i < 100; $i++) {
            User::create([
                'name' => $faker->name,
                'username' => $faker->unique()->userName,
                'email' => $faker->unique()->safeEmail,
                'password' => Hash::make('password'),
                'is_temporary_password' => $faker->boolean,
                'is_admin' => 0,
                'phone' => $faker->phoneNumber,
            ]);
        }
    }
}



================================================
FILE: public/index.php
================================================
<?php

/*
|--------------------------------------------------------------------------
| Create The Application
|--------------------------------------------------------------------------
|
| First we need to get an application instance. This creates an instance
| of the application / container and bootstraps the application so it
| is ready to receive HTTP / Console requests from the environment.
|
*/

$app = require __DIR__.'/../bootstrap/app.php';

/*
|--------------------------------------------------------------------------
| Run The Application
|--------------------------------------------------------------------------
|
| Once we have the application, we can handle the incoming request
| through the kernel, and send the associated response back to
| the client's browser allowing them to enjoy the creative
| and wonderful application we have prepared for them.
|
*/

$app->run();



================================================
FILE: public/robots.txt
================================================
User-agent: *
Disallow: /


================================================
FILE: public/.htaccess
================================================
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Redirecionar HTTP para HTTPS
    RewriteCond %{HTTPS} off
    RewriteRule (.*) https://%{HTTP_HOST}%{REQUEST_URI} [R,L]

    # Bloquear acesso ao diretório .git
    RewriteRule ^\.git - [F,L]

    # Handle Authorization Header
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Redirect Trailing Slashes If Not A Folder...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # Handle Front Controller...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]

    # Bloqueia acesso direto a qualquer arquivo PHP, exceto os necessários
    RewriteCond %{THE_REQUEST} \.php [NC]
    RewriteCond %{REQUEST_URI} !/(index)\.php$ [NC]
    RewriteRule ^ - [F,L]
</IfModule>


# Páginas de erro personalizadas
ErrorDocument 403 /403.shtml
ErrorDocument 404 /404.shtml
ErrorDocument 500 /500.shtml


================================================
FILE: resources/views/.gitkeep
================================================
[Empty file]


================================================
FILE: routes/web.php
================================================
<?php

/** @var \Laravel\Lumen\Routing\Router $router */

/*
|--------------------------------------------------------------------------
| Application Routes
|--------------------------------------------------------------------------
|
| Here is where you can register all of the routes for an application.
| It is a breeze. Simply tell Lumen the URIs it should respond to
| and give it the Closure to call when that URI is requested.
|
 */

$router->group(['middleware' => 'general'], function () use ($router) {

    $router->get('/', function () {
        return [];
    });
    $router->get('/player', 'PlayerController@index');

    $router->get('/json_db/{file}', 'DatabaseJsonController@index');

    $router->get('/download', 'DownloadController@index');
    $router->get('/version_log', 'VersionLogController@index');

    $router->group(['middleware' => 'api'], function () use ($router) {

        $router->get('/params', 'ParamsController@index');
        $router->get('/ftp', 'FtpController@index');
        $router->get('/onlinevideos', 'OnlineVideosController@index');

        $router->group(['prefix' => 'auth'], function () use ($router) {
            $router->post('/login', 'AuthController@login');

            $router->group(['middleware' => 'auth'], function () use ($router) {
                $router->post('/refresh-token', 'AuthController@refreshToken');
                $router->post('/refresh_token', 'AuthController@refreshToken');
                $router->get('/me', 'AuthController@me');
                $router->post('/logout', 'AuthController@logout');
                $router->post('/change-password',  'AuthController@changePassword');
            });
        });


        $router->group(['prefix' => 'admin', 'middleware' => ['auth', 'confirmed_pwd']], function () use ($router) {
            $router->group(['middleware' => 'access:users'], function () use ($router) {
                $router->get('/users', 'UserController@index');
                $router->post('/users', 'UserController@store');
                $router->get('/users/{id}', 'UserController@show');
                $router->put('/users/{id}', 'UserController@update');
                $router->delete('/users/{id}', 'UserController@destroy');
            });

            $router->get('/categories', 'CategoryController@index');
            $router->get('/categories/{id}', 'CategoryController@show');
            $router->group(['middleware' => 'access:categories'], function () use ($router) {
                $router->post('/categories', 'CategoryController@store');
                $router->put('/categories/{id}', 'CategoryController@update');
                $router->delete('/categories/{id}', 'CategoryController@destroy');
            });
            $router->get('/categories_albums', 'CategoryAlbumController@index');
            $router->get('/categories_albums/{id}', 'CategoryAlbumController@show');
            $router->group(['middleware' => 'access:categories_albums'], function () use ($router) {
                $router->post('/categories_albums', 'CategoryAlbumController@store');
                $router->put('/categories_albums/{id}', 'CategoryAlbumController@update');
                $router->delete('/categories_albums/{id}', 'CategoryAlbumController@destroy');
            });
            $router->get('/albums', 'AlbumController@index');
            $router->get('/albums/{id}', 'AlbumController@show');
            $router->group(['middleware' => 'access:albums'], function () use ($router) {
                $router->post('/albums', 'AlbumController@store');
                $router->put('/albums/{id}', 'AlbumController@update');
                $router->delete('/albums/{id}', 'AlbumController@destroy');
            });
            $router->get('/musics', 'MusicController@index');
            $router->get('/musics/{id}', 'MusicController@show');
            $router->group(['middleware' => 'access:musics'], function () use ($router) {
                $router->post('/musics', 'MusicController@store');
                $router->put('/musics/{id}', 'MusicController@update');
                $router->delete('/musics/{id}', 'MusicController@destroy');
            });
            $router->get('/albums_musics', 'AlbumMusicController@index');
            $router->get('/albums_musics/{id}', 'AlbumMusicController@show');
            $router->group(['middleware' => 'access:albums_musics'], function () use ($router) {
                $router->post('/albums_musics', 'AlbumMusicController@store');
                $router->put('/albums_musics/{id}', 'AlbumMusicController@update');
                $router->delete('/albums_musics/{id}', 'AlbumMusicController@destroy');
            });
            $router->get('/lyrics', 'LyricController@index');
            $router->get('/lyrics/{id}', 'LyricController@show');
            $router->group(['middleware' => 'access:lyrics'], function () use ($router) {
                $router->post('/lyrics', 'LyricController@store');
                $router->put('/lyrics/{id}', 'LyricController@update');
                $router->delete('/lyrics/{id}', 'LyricController@destroy');
            });
            $router->get('/files', 'FileController@index');
            $router->get('/files/{id}', 'FileController@show');
            /*   $router->group(['middleware' => 'access:files'], function () use ($router) {
            $router->post('/files', 'AlbumController@store');
            $router->put('/files/{id}', 'AlbumController@update');
            $router->delete('/files/{id}', 'AlbumController@destroy');
        });*/
        });


        $router->group(['prefix' => 'tasks'], function () use ($router) {
            $router->get('/', 'TaskController@index');
            $router->get('/refresh_configs', 'TaskController@refresh_configs');
            $router->get('/export_database', 'TaskController@export_database');
            $router->get('/refresh_files_size', 'TaskController@refresh_files_size');
            $router->get('/refresh_files_duration', 'TaskController@refresh_files_duration');
            $router->get('/refresh_online_videos', 'TaskController@refresh_online_videos');
            $router->get('/import_slides', 'TaskController@import_slides');
            $router->get('/export_database_json', 'TaskController@export_database_json');
        });

        $router->group(['prefix' => '{lang}', 'middleware' =>  'lang'], function () use ($router) {

            $router->get('/', function () {
                return [];
            });

            $router->get('/languages', 'LanguageController@index');

            $router->get('/config', 'ConfigController@index');
            $router->get('/configs', 'ConfigController@index');

            $router->get('/musics', 'MusicController@index');
            $router->get('/musics/{id}', 'MusicController@show');
            $router->get('/music/{id}', 'MusicController@show');

            $router->get('/categories', 'CategoryController@index');

            $router->get('/categories_albums', 'CategoryAlbumController@index');

            $router->get('/albums', 'AlbumController@index');
            $router->get('/albums/{id}', 'AlbumController@show');
            $router->get('/album/{id}', 'AlbumController@show');

            $router->get('/albums_musics', 'AlbumMusicController@index');

            $router->get('/lyrics', 'LyricController@index');

            $router->get('/hymnal', 'HymnalController@index');

            $router->get('/files', 'FileController@index');

            $router->get('/ftp', 'FtpController@index');
        });
    });

    $router->group(['prefix' => '{lang}', 'middleware' =>  'lang'], function () use ($router) {
        $router->get('/download', 'DownloadController@index');
    });
});


$router->get('/file/{path:.*}', 'FileController@open');



================================================
FILE: tests/ExampleTest.php
================================================
<?php

use Laravel\Lumen\Testing\DatabaseMigrations;
use Laravel\Lumen\Testing\DatabaseTransactions;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     *
     * @return void
     */
    public function testExample()
    {
        $this->get('/');

        $this->assertEquals(
            $this->app->version(), $this->response->getContent()
        );
    }
}



================================================
FILE: tests/TestCase.php
================================================
<?php

use Laravel\Lumen\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Creates the application.
     *
     * @return \Laravel\Lumen\Application
     */
    public function createApplication()
    {
        return require __DIR__.'/../bootstrap/app.php';
    }
}


