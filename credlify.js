#!/usr/bin/env node

/* credlify.js
    
    A simple scaffolding helper for node projects.
*/

"use strict";

// Dependencies.
const minimist = require("minimist"),
    minimistOpts = require("minimist-options"),
    prompts = require("prompts"),
    uuid = require("uuid").v4,
    osl = require("oslicense"),
    fs = require("fs"),
    path = require("path"),
    spawn = require("child_process").spawn,
    promisify = require("util").promisify,
    
    readFileAsync = promisify(fs.readFile),
    writeFileAsync = promisify(fs.writeFile),
    mkdirAsync = promisify(fs.mkdir),
    unlinkAsync = promisify(fs.unlink),
    
    // Template directory path.
    TPL_PATH = __dirname + "/tpl",
    
    // Template file paths.
    TEMPLATES = fs.readdirSync(TPL_PATH).map((file) => {
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
            "babel-minify-webpack-plugin",
            "del",
            "gulp",
            "gulp-clean-css",
            "gulp-load-plugins",
            "gulp-plumber",
            "gulp-sass",
            "gulp-sourcemaps",
            "live-server",
            "minimist",
            "minimist-options",
            "webpack",
            "webpack-stream"
        ]
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
    config - Project config data from the config.js template file. See
        getConfigData().
*/
async function createProject(rootPath, input, config) {
    let structure;
    
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
            data = await readFileAsync(tplFile, { encoding: "utf8" });
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
            
            await writeFileAsync(destFile, data, {
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
                writeFileAsync(`${srcJs}/index.js`, "", opts),
                
                writeFileAsync(`${rootPath}${srcPaths.SASS}/index.scss`, "",
                    opts),
                
                writeFileAsync(
                    `${srcJs}/node_modules/app/.gitkeep`,
                    capturedTemplates[".gitkeep"],
                    opts
                ),
                
                writeFileAsync(
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
    
    if (fs.existsSync(srcDir)) {
        console.error("Source directory already exists, exiting to avoid " +
            "breaking anything");
        
        process.exit();
    }
    else if (fs.existsSync(destDir)) {
        console.error("Destination directory already exists, exiting to " +
            "avoid breaking anything");
        
        process.exit();
    }
    
    // Create source and destination root directories
    return Promise.allSettled(
        [
            mkdirAsync(srcDir, opts),
            mkdirAsync(destDir, opts)
        ].map(catchAll)
    )
        .then(() => {
            // Create file type-specific directories
            return Promise.allSettled([
                    mkdirAsync(`${rootPath}${srcPaths.JS}/node_modules/app`,
                        opts),
                    mkdirAsync(`${rootPath}${srcPaths.SASS}`, opts),
                    mkdirAsync(`${rootPath}${destPaths.JS}`, opts),
                    mkdirAsync(`${rootPath}${destPaths.SASS}`, opts)
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
    
    let promise;
    
    for (let k in PACKAGES) {
        if (!PACKAGES.hasOwnProperty(k)) { continue; }
        
        let packages = PACKAGES[k],
            args = [ "install" ],
            command, handler;
        
        // Build arguments array
        args.push("devDeps" === k ? "--save-dev" : "--save");
        args = args.concat(packages);
        
        // Run the install command
        command = spawn(
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
        
        // Set up promise handler
        handler = (res) => {
            command.on("close", (code) => {
                res(code);
            });
        };
        
        // Cache or chain the promise
        if (!promise) {
            promise = new Promise(handler);
        }
        else {
            promise.then(() => {
                return new Promise(handler);
            });
        }
    }
    
    return promise;
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
        data = await readFileAsync(`${TPL_PATH}/config.js`, {
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
        await writeFileAsync(uuidConfig, data, {
            encoding: "utf8",
            mode: 0o644,
            flag: "wx"
        });
        
        data = require(uuidConfig);
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
        await unlinkAsync(uuidConfig);
    }
    catch (e) {
        console.error(`Temporary config file at '${uuidConfig}' could not be ` +
            "deleted, and must be removed manually");
    }
    
    return data;
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
    
    Returns the package data or file path of the nearest package.json file,
    relative to the current working directory. If no package.json file is found,
    this will return undefined.
*/
function getNearestPkg(filePath) {
    // Attempt to get license type from local package.json
    let sep = path.sep,
        dirs = process.cwd().split(sep);
    
    while (dirs.length) {
        let pkg = dirs.join(sep) + `${sep}package.json`;
        
        if (fs.existsSync(pkg)) {
            return filePath ? pkg : require(pkg);
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
    let text = fs.readFileSync(__dirname + "/help.txt", {
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
        let pkg = require("./package.json");
        
        console.log(pkg.version);
        process.exit();
    }
    
    let rootPath = process.cwd(),
        projectPkg = getNearestPkg(),
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
        input.serverImport = "import liveServer from \"live-server\";";
        input.serverTask = require("./modules/server-task");
        input.serverTaskName = ", \"server\"";
        break;
        
        case "n":
        case "no":
        input.serverTask = "";
        break;
    }
    
    input.serverTask = replaceValues(input.serverTask, input);
    
    // Add custom fields
    input.appName = projectPkg.name;
    input.description = projectPkg.description;
    input.license = osl.getNearestLicense();
    
    // Make sure no existing files will be overwritten
    for (let i=0, l=TEMPLATES.length; i<l; ++i) {
        ((file) => {
            fs.lstat(file, async (err) => {
                if (!err) {
                    // Stat succeeded, file exists
                    exists.push(file);
                }
                
                if (++checked < numFiles) {
                    // More files to check
                    return;
                }
                
                // All template files checked
                if (exists.length) {
                    let msg = [
                        "The following files already exist:\n",
                        exists.join("\n"),
                        "\nExiting to avoid breaking anything"
                    ].join("\n");
                    
                    console.error(msg);
                    process.exit();
                }
                
                // Create the project
                try {
                    let config = await getConfigData(rootPath, input);
                    
                    await createProject(
                        "/" + sanitizeRelPath(rootPath) + "/",
                        input,
                        config
                    );
                }
                catch (e) {
                    console.error("An unknown error occurred");
                    process.exit();
                }
            });
        })(TEMPLATES[i]);
    }
})();
