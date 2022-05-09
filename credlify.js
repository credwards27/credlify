#!/usr/bin/env node

/* credlify.js
    
    A simple scaffolding helper for node projects.
*/

"use strict";

// Dependencies.
import minimist from "minimist";
import minimistOpts from "minimist-options";
import prompts from "prompts";
import { v4 as uuid } from "uuid";
import osl from "oslicense";
import path from "path";
import { spawn } from "child_process";
import { URL } from "url";
import { readFileSync, readdirSync, existsSync } from "fs";
import {
    readFile,
    writeFile,
    mkdir,
    unlink,
    stat,
    lstat
} from "fs/promises";

// ES6 module __dirname.
const __dirname = new URL(".", import.meta.url).pathname.replace(/\/+$/, ""),
    
    // Template directory path.
    TPL_PATH = __dirname + "/tpl",
    
    // Template file paths.
    TEMPLATES = readdirSync(TPL_PATH).map((file) => {
        return sanitizeRelPath(file);
    }),
    
    // NPM development dependencies to install.
    PACKAGES = {
        deps: [
            "@babel/runtime"
        ],
        
        devDeps: [
            "@babel/core",
            "@babel/plugin-proposal-class-properties",
            "@babel/plugin-proposal-export-default-from",
            "@babel/plugin-proposal-object-rest-spread",
            "@babel/plugin-syntax-dynamic-import",
            "@babel/plugin-transform-async-to-generator",
            "@babel/plugin-transform-runtime",
            "@babel/preset-env",
            "@babel/register",
            "babel-loader",
            "del",
            "gulp",
            "gulp-clean-css",
            "gulp-load-plugins",
            "gulp-plumber",
            "gulp-dart-sass",
            "gulp-sourcemaps",
            "live-server",
            "minimist",
            "minimist-options",
            "terser-webpack-plugin",
            "webpack",
            "webpack-stream"
        ]
    },
    
    // Required config properties for package.json.
    PACKAGE_CONFIG = {
        type: "module",
        imports: {
            "#app/*": "./src/js/*.js",
            "#root/*": "./*.js"
        }
    },
    
    // CLI argument configuration.
    ARG_OPTS = {
        help: {
            type: "boolean",
            alias: "h"
        },
        
        // Shows the package version.
        version: {
            type: "boolean",
            alias: "v"
        },
        
        dirs: {
            type: "boolean",
            default: true
        },
        
        files: {
            type: "boolean",
            default: true
        },
        
        deps: {
            type: "boolean",
            default: true
        },
        
        package: {
            type: "boolean",
            default: true
        },
        
        indent: {
            type: "number",
            default: 0
        },
        
        "indent-type": {
            type: "string",
            default: ""
        }
    },
    
    // Parsed CLI arguments.
    ARGS = Object.freeze(
        minimist(process.argv.slice(2), minimistOpts(ARG_OPTS))
    ),
    
    // User input validation error messages.
    INPUT_ERRORS = {
        path: "Path may not contain any of the following characters: " +
            "\\:*?\"<>| or newlines",
        
        yesNo: "Choose 'yes' or 'no'"
    },
    
    // User input prompt configuration.
    INPUT_PROMPTS = [
        {
            name: "src",
            type: "text",
            message: "Source directory (relative to project root)",
            initial: "src",
            validate: validatePath(INPUT_ERRORS.path)
        },
        
        {
            name: "dest",
            type: "text",
            message: "Destination directory (relative to project root)",
            initial: "dist",
            validate: validatePath(INPUT_ERRORS.path)
        },
        
        {
            name: "srcJs",
            type: "text",
            message: "JavaScript source directory (relative to source)",
            initial: "js",
            validate: validatePath(INPUT_ERRORS.path)
        },
        
        {
            name: "destJs",
            type: "text",
            message: "JavaScript bundle destination directory (relative to " +
                "destination)",
            initial: "assets/js",
            validate: validatePath(INPUT_ERRORS.path)
        },
        
        {
            name: "srcSass",
            type: "text",
            message: "SASS source directory (relative to source)",
            initial: "sass",
            validate: validatePath(INPUT_ERRORS.path)
        },
        
        {
            name: "destSass",
            type: "text",
            message: "Stylesheet bundle destination directory (relative to " +
                "destination)",
            initial: "assets/css",
            validate: validatePath(INPUT_ERRORS.path)
        },
        
        {
            name: "serverTask",
            type: "text",
            message: "Add optional live server gulp task ('yes' or 'no')",
            initial: "yes",
            validate: (val) => {
                return /^(y|n|yes|no)$/i.test(val) || INPUT_ERRORS.yesNo
            }
        },
    ];

/* Sanitizes a relative path string.
    
    path - Path string to sanitize.
    
    Returns the path with leading and trailing slashes and whitespace removed.
*/
function sanitizeRelPath(path) {
    if (typeof path !== "string") {
        return "";
    }
    
    return path.replace(/^[\/\s]+|[\/\s]+$/g, "");
}

/* Creates the directory structure for the project.
    
    rootPath - Root project directory path.
    input - User input data for project configuration.
*/
async function createProject(rootPath, input) {
    let pkgMessages, config, structure;
    
    // Modify package.json for generated project and to load config file
    if (ARGS["package"]) {
        let char = "";
        
        switch (ARGS["indent-type"].trim().toLowerCase()) {
            case "spaces":
            case "space":
                char = " ";
                break;
            
            case "tabs":
            case "tab":
                char = "\t";
                break;
        }
        
        try {
            await configurePackage(ARGS["indent"], char);
        }
        catch (e) {
            console.error("Project package.json modification failed");
        }
    }
    else {
        console.log("Skipped project package.json modification");
    }
    
    if (ARGS["dirs"] || ARGS["files"]) {
        // Validate package.json in order to continue
        pkgMessages = validatePackage();
        
        if (pkgMessages.length) {
            console.error("Project package.json is not configured properly " +
                "for project generation:\n");
            
            console.error(pkgMessages.join("\n\n"));
            process.exit();
        }
        
        // Get config for provided input arguments and sanitize root path for
        // subtasks
        try {
            config = await getConfigData(rootPath, input);
        }
        catch (e) {
            throw e;
        }
        
        rootPath = `/${sanitizeRelPath(rootPath)}/`;
    }
    
    // Generate project structure directories
    try {
        if (ARGS["dirs"]) {
            await createStructure(rootPath, input, config);
            structure = true;
        }
        else {
            console.log("Skipped project structure generation");
        }
    }
    catch (e) {
        console.error("Project structure generation failed");
        process.exit();
    }
    
    // Copy bootstrap files
    try {
        if (ARGS["files"]) {
            await copyTemplateFiles(rootPath, input, config, structure);
        }
        else {
            console.log("Skipped template file creation");
        }
    }
    catch (e) {
        console.error("Template file creation failed");
        process.exit();
    }
    
    // Installed dependencies for build configuration
    try {
        if (ARGS["deps"]) {
            await installDeps();
        }
        else {
            console.log("Skipped dependency installation");
        }
    }
    catch (e) {
        console.error("Dependency installation failed");
        process.exit();
    }
}

/* Updates the package.json file in the target project to add required config
    properties.
    
    indent - Number of characters of type to indent. If falsy or a negative
        number, this will attempt to detect indentation from the package.json
        file.
    
    char - Indentation character string (must be a space or a tab character. If
        multiple characters are provided, the first character will be used. If
        falsy or an invalid character, this will attempt to detect the
        indentation character from the package.json file.
*/
async function configurePackage(indent, char) {
    switch (true) {
        case !indent:
        case typeof indent !== "number":
        case indent < 0:
            indent = 0;
            break;
    }
    
    char = (char && typeof char === "string") ? char[0] : "";
    char = / |\t/.test(char) ? char : "";
    
    let pkgPath = getNearestPkg(true),
        pkg = getNearestPkg(),
        hasImports = pkg.hasOwnProperty("imports"),
        newPkg = {},
        mode;
    
    // Detect current file mode of package.json
    try {
        mode = await stat(pkgPath);
        mode = (mode.mode & parseInt("777", 8));
    }
    catch (e) {
        mode = 0o644;
    }
    
    // Detect indentation amount and character
    if (!indent || !char) {
        let indentation = detectIndentation(pkgPath);
        
        indent = indent || indentation.indent || 4;
        char = char || indent.char || " ";
    }
    
    // Add/check required package.json properties
    for (let k in pkg) {
        if (!pkg.hasOwnProperty(k)) { continue; }
        
        newPkg[k] = pkg[k];
        
        switch (k) {
            case "description":
                if (!pkg.hasOwnProperty("type")) {
                    newPkg.type = PACKAGE_CONFIG.type;
                }
                
                break;
            
            case "main":
                let imports = pkg.imports || {};
                
                if (imports && typeof imports === "object") {
                    let configImports = PACKAGE_CONFIG.imports;
                    
                    for (let p in configImports) {
                        if (!configImports.hasOwnProperty(p)) { continue; }
                        imports[p] = configImports[p];
                    }
                }
                
                newPkg.imports = imports;
                break;
        }
    }
    
    // Save the file
    newPkg = JSON.stringify(newPkg, null, (" " === char ? indent : char));
    newPkg = newPkg.trim() + "\n";
    
    try {
        await writeFile(pkgPath, newPkg, {
            encoding: "utf8",
            mode: mode,
            flag: "w"
        });
    }
    catch (e) {}
}

/* Validates the project package.json file.
*/
function validatePackage() {
    let pkg = getNearestPkg(),
        configImports = PACKAGE_CONFIG.imports,
        errors = [];
    
    if (pkg.type !== PACKAGE_CONFIG.type) {
        errors.push(`Package "type" property must be "${PACKAGE_CONFIG.type}"`);
    }
    
    let imports = pkg.imports || {};
    
    imports = typeof imports === "object" ? imports : {};
    
    for (let k in configImports) {
        if (!configImports.hasOwnProperty(k)) { continue; }
        
        if (!imports[k]) {
            let msg = [
                "When running this script, the package \"imports\" must be " +
                    "an object with the following key/value pairs:\n"
            ];
            
            for (let p in configImports) {
                if (!configImports.hasOwnProperty(p)) { continue; }
                
                msg.push(`    "${p}": "${configImports[p]}"`);
            }
            
            errors.push(msg.join("\n"));
            break;
        }
    }
    
    return errors;
}

/* Copies template files into the project.
    
    rootPath - See createProject().
    input - See createProject().
    config - See createProject().
    structure - True to include template files that depend on directory
        structure, false otherwise. Defaults to false.
*/
async function copyTemplateFiles(rootPath, input, config, structure) {
    // Copy template files with custom user data
    console.log("Creating build pipeline files...");
    
    let capturedTemplates = {};
    
    // Get license text if possible
    input.licenseText = "";
    
    if (input.license) {
        let text = "";
        
        try {
            text = await osl.getLicenseText(input.license);
            input.licenseText = text;
        }
        catch (e) {}
        
        if (!input.licenseText) {
            console.error("\nNo valid OSI license ID found in package.json; " +
                "an empty license file was generated\n" +
                "See https://opensource.org/licenses/alphabetical\n");
        }
    }
    
    for (let i=0, l=TEMPLATES.length; i<l; ++i) {
        let file = TEMPLATES[i],
            tplFile = `${TPL_PATH}/${file}`,
            destFile, data;
        
        // Read the template file
        try {
            data = await readFile(tplFile, { encoding: "utf8" });
        }
        catch (e) {
            // Skip file if a read error occurred
            console.error(`Template file '${file}' could not be copied`);
            continue;
        }
        
        data = replaceValues(data, input);
        
        // Capture the file to output later if specified by template file name
        // (double underscore prefix)
        if (file.match(/^__/)) {
            capturedTemplates[file.replace(/^__/, "")] = data;
            continue;
        }
        
        // Copy the modified template file into the project
        try {
            file = file.replace(/^_/, "");
            destFile = rootPath + "/" + file;
            
            await writeFile(destFile, data, {
                encoding: "utf8",
                mode: 0o644,
                flag: "wx"
            });
        }
        catch (e) {
            // File could not be written
            let msg;
            
            switch (e.code) {
                case "EEXIST":
                msg = `File at '${destFile}' already exists`;
                break;
                
                default:
                msg = `Could not create file at '${destFile}'`;
            }
            
            console.error(msg);
        }
    }
    
    // Add additional project files
    if (structure) {
        let srcPaths = config.PATH.SRC,
            destPaths = config.PATH.DEST,
            srcJs = rootPath + srcPaths.JS,
            opts = {
                encoding: "utf8",
                mode: 0o644,
                flag: "wx"
            };
        
        return Promise.allSettled(
            [
                writeFile(`${srcJs}/index.js`, "", opts),
                
                writeFile(`${rootPath}${srcPaths.SASS}/index.scss`, "",
                    opts),
                
                writeFile(
                    `${srcJs}/node_modules/app/.gitkeep`,
                    capturedTemplates[".gitkeep"],
                    opts
                ),
                
                writeFile(
                    `${rootPath}${destPaths.ROOT}/index.html`,
                    capturedTemplates["index.html"],
                    opts
                )
            ].map((p) => {
                return p.catch((e) => {
                    errors.push(e);
                });
            })
        );
    }
}

/* Creates the base project structure.
    
    rootPath - See createProject().
    input - See createProject().
    config - See createProject().
*/
async function createStructure(rootPath, input, config) {
    console.log("Creating source/destination directories...");
    
    let srcPaths = config.PATH.SRC,
        destPaths = config.PATH.DEST,
        srcDir = rootPath + srcPaths.ROOT,
        destDir = rootPath + destPaths.ROOT,
        opts = { recursive: true, mode: 0o755 },
        errors = [],
        catchAll = (p) => {
            return p.catch((e) => {
                errors.push(e);
            });
        },
        writeOpts = {
            encoding: "utf8",
            mode: 0o644,
            flag: "wx"
        };
    
    if (existsSync(srcDir)) {
        console.error("Source directory already exists, exiting to avoid " +
            "breaking anything");
        
        process.exit();
    }
    else if (existsSync(destDir)) {
        console.error("Destination directory already exists, exiting to " +
            "avoid breaking anything");
        
        process.exit();
    }
    
    // Create source and destination root directories
    return Promise.allSettled(
        [
            mkdir(srcDir, opts),
            mkdir(destDir, opts)
        ].map(catchAll)
    )
        .then(() => {
            // Create file type-specific directories
            return Promise.allSettled([
                    mkdir(`${rootPath}${srcPaths.JS}`, opts),
                    mkdir(`${rootPath}${srcPaths.SASS}`, opts),
                    mkdir(`${rootPath}${destPaths.JS}`, opts),
                    mkdir(`${rootPath}${destPaths.SASS}`, opts)
                ].map(catchAll)
            );
        })
        .then(() => {
            if (errors.length) {
                for (let i=0, l=errors.length; i<l; ++i) {
                    console.error(errors[i]);
                }
                
                process.exit();
            }
        })
}

/* Installs package dependencies.
*/
async function installDeps() {
    console.log("Installing dependencies...");
    
    await doInstall(PACKAGES.deps);
    await doInstall(PACKAGES.devDeps, true);
}

/* Performs a single NPM install action.
    
    packages - Package name string or an array of name strings to install. Any
        strings containing whitespace will be skipped (leading and trailing
        whitespace is okay). If no valid packages are provided, no install
        action will be performed.
    
    dev - True to install as 'devDependencies', false to install as
        'dependencies'. Defaults to false.
*/
async function doInstall(packages, dev) {
    // Filter out invalid package name arguments
    packages = packages instanceof Array ? packages : [ packages ];
    
    packages = packages.map((item) => {
        item = typeof item === "string" ? item.trim() : "";
        
        if (!item || item.match(/\s/)) {
            return null;
        }
        
        return item;
    }).filter(item => !!item);
    
    // Exit if no valid packages
    if (!packages.length) {
        return;
    }
    
    // Build command
    let args = [
        "install",
        dev ? "--save-dev" : "--save"
    ].concat(packages);
    
    return new Promise((res, rej) => {
        // Run the install command
        let command = spawn(
            "win32" === process.platform ? "npm.cmd" : "npm",
            args,
            {
                stdio: [
                    process.stdin,
                    process.stdout,
                    process.stderr
                ]
            }
        );
        
        command.on("close", (code) => {
            res(code);
        });
    });
}

/* Loads and returns config.js template file for use in this script.
    
    rootPath - Root project directory path.
    input - User input data for project configuration.
    
    Returns loaded template file data. If data load fails for any reason, this
    will return an empty object.
*/
async function getConfigData(rootPath, input) {
    let uuidConfig = `${rootPath}/config-` + uuid() + ".js",
        data;
    
    try {
        data = await readFile(`${TPL_PATH}/config.js`, {
            encoding: "utf8"
        });
    }
    catch (e) {
        // Skip file if a read error occurred
        console.error("Config data could not be loaded");
        return {};
    }
    
    data = replaceValues(data, input);
    
    try {
        await writeFile(uuidConfig, data, {
            encoding: "utf8",
            mode: 0o644,
            flag: "wx"
        });
        
        data = await import(uuidConfig);
        data = data.default;
    }
    catch (e) {
        // Temporary config file could not be written
        let msg;
        
        switch (e.code) {
            case "EEXIST":
            msg = `File at '${uuidConfig}' already exists (the chances of ` +
                "this are monumentally small, try running the script again)";
            break;
            
            default:
            msg = `Could not create temporary config file at '${uuidConfig}'`;
            
            console.error(msg);
        }
    }
    
    // Clean up
    try {
        await unlink(uuidConfig);
    }
    catch (e) {
        console.error(`Temporary config file at '${uuidConfig}' could not be ` +
            "deleted, and must be removed manually");
    }
    
    return data;
}

/* Detects indentation from a file.
    
    Indentation is determined by the length of leading whitespace in the first
    line containing both leading whitespace and at least one non-whitespace
    character.
    
    path - File path.
    
    Returns an object in the following format:
        
        indent - Number of characters per indentation. If not detected, indent
            will be 0.
        
        char - Detected indentation character. If not detected, char will be an
            empty string.
*/
function detectIndentation(path) {
    let lines = readFileSync(path, { encoding: "utf8" });
    
    lines = lines.split(/\r\n?|\n/);
    
    for (let i=0, l=lines.length; i<l; ++i) {
        let line = lines[i],
            indentation = line.match(/^(\s+)\S/);
        
        indentation = indentation ? indentation[1] : null;
        
        if (!indentation) {
            continue;
        }
        
        return {
            indent: indentation.length,
            char: indentation[0]
        };
    }
    
    return {
        indent: 0,
        char: ""
    };
}

/* Replaces special placeholders in a string with given values.
    
    str - String containing placeholders. Placeholders must be in the following
        format: '%%[placeholderName]%%'. Placeholder names may only contain
        letters, number, underscores, hyphens, and periods, and are case
        sensitive.
    
    values - Replacement values, keyed by placeholder names.
    
    Returns the string with replaced values.
*/
function replaceValues(str, values) {
    str = str.replace(/%%\[([A-Za-z0-9._-]+)\]%%/g, (match, placeholder) => {
        return values.hasOwnProperty(placeholder) ? values[placeholder] : match;
    });
    
    return str;
}

/* Gets package data or path for the nearest package.json file.
    
    NOTE: This will check for a package.json file in the following order:
        
        - In the current working directory
        - In the current working directory path's ancestor chain, starting with
          the parent directory
    
    filePath - True to return the file path to the found package.json file,
        instead of the parsed package data, false to return parsed data.
        Defaults to false.
    
    dir - Alternate directory path to check for the package.json file. If
        specified, the package file lookup will start in 'dir' instead of the
        current working directory.
    
    Returns the package data or file path of the nearest package.json file,
    relative to the current working directory. If no package.json file is found,
    this will return undefined.
*/
function getNearestPkg(filePath, dir) {
    dir = (dir && typeof dir === "string") ? dir : process.cwd();
    
    // Attempt to get license type from local package.json
    let sep = path.sep,
        dirs = dir.split(sep);
    
    while (dirs.length) {
        let pkg = dirs.join(sep) + `${sep}package.json`;
        
        if (existsSync(pkg)) {
            if (filePath) {
                return pkg;
            }
            
            pkg = readFileSync(pkg, { encoding: "utf8" });
            return JSON.parse(pkg);
        }
        
        dirs.pop();
    }
}

/* Validation function generator for user input path values.
    
    msg - Message to display when input value is invalid. If omitted or not a
        string, the default validation error message will be used.
    
    Returns a validation function for a prompt object.
*/
function validatePath(msg) {
    return (val) => {
        if (/^[^\\:*?"<>|\n]+$/.test(val)) {
            return true;
        }
        
        return typeof msg === "string" ? msg : false;
    };
}

/* Shows help text and exits.
*/
function showHelp() {
    let text = readFileSync(__dirname + "/help.txt", {
        encoding: "utf8"
    });
    
    console.log(text.trim());
    process.exit();
}

//
// Main script entry point
//

(async () => {
    if (ARGS.help) {
        showHelp();
    }
    
    if (ARGS.version) {
        let pkg = getNearestPkg(false, __dirname);
        
        console.log(pkg.version);
        process.exit();
    }
    
    let projectPkg = getNearestPkg(),
        numFiles = TEMPLATES.length,
        checked = 0,
        exists = [],
        input;
    
    if (!projectPkg) {
        console.error("No package.json file found, run 'npm init' first");
        process.exit();
    }
    
    // Get user input
    try {
        input = await prompts(INPUT_PROMPTS, {
            onCancel: () => {
                process.exit();
            }
        });
    }
    catch (e) {}
    
    // Convert server task input to actual task string
    switch (input.serverTask.toLowerCase()) {
        case "y":
        case "yes":
        input.serverImport = "\nimport liveServer from \"live-server\";";
        
        input.serverTask = readFileSync(__dirname + "/tpl/__server-task.js", {
            encoding: "utf8"
        });
        
        input.serverTaskName = "\"server\", ";
        break;
        
        case "n":
        case "no":
        input.serverImport = "";
        input.serverTask = "";
        input.serverTaskName = "";
        break;
    }
    
    input.serverTask = replaceValues(input.serverTask, input);
    
    // Add custom fields
    input.appName = projectPkg.name;
    input.description = projectPkg.description;
    input.license = osl.getNearestLicense();
    
    // Make sure no existing files will be overwritten
    for (let i=0, l=TEMPLATES.length; i<l; ++i) {
        (async (file) => {
            try {
                await lstat(file);
                exists.push(file);
            }
            catch (e) {}
            
            if (++checked < numFiles) {
                // More files to check
                return;
            }
            
            // All template files checked
            if (ARGS["dirs"] || ARGS["files"]) {
                if (exists.length) {
                    let msg = [
                        "The following files already exist:\n",
                        exists.join("\n"),
                        "\nExiting to avoid breaking anything"
                    ].join("\n");
                    
                    console.error(msg);
                    process.exit();
                }
            }
            
            // Create the project
            try {
                await createProject(process.cwd(), input);
            }
            catch (e) {
                console.error("An unknown error occurred");
                process.exit();
            }
        })(TEMPLATES[i]);
    }
})();
