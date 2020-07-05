#!/usr/bin/env node

/* credify
    
    A simple scaffolding helper for node projects.
*/

"use strict";

// Dependencies.
const minimist = require("minimist"),
    minimistOpts = require("minimist-options"),
    prompt = require("prompt"),
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
    
    PACKAGE = require(process.cwd() + "/package.json"),
    
    // Template directory path.
    TPL_PATH = __dirname + "/tpl",
    
    // Template file paths.
    TEMPLATES = fs.readdirSync(TPL_PATH).map((file) => {
        return sanitizeRelPath(file);
    }),
    
    // Captured template file strings from template files named with 2 leading
    // underscores, keyed by unprefixed file name. These must be output
    // manually.
    CAPTURED_TEMPLATES = {},
    
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
    ARG_OPTS = {},
    
    // Parsed CLI arguments.
    ARGS = Object.freeze(
        minimist(process.argv.slice(2), minimistOpts(ARG_OPTS))
    ),
    
    // User input configuration.
    userInput = {
        fields: {},
        properties: {
            src: {
                description: "Source directory (relative to project root)",
                type: "string",
                default: "src",
                pattern: /^[^\\:*?"<>|\n]+$/,
                message: "Path may not contain any of the following " +
                    "characters: \\:*?\"<>| or newlines",
                required: true,
                before: sanitizeRelPath
            },
            
            dest: {
                description: "Destination directory (relative to project root)",
                type: "string",
                default: "dist",
                pattern: /^[^\\:*?"<>|\n]+$/,
                message: "Path may not contain any of the following " +
                    "characters: \\:*?\"<>| or newlines",
                required: true,
                before: sanitizeRelPath
            },
            
            srcJs: {
                description: "JavaScript source directory (relative to source)",
                type: "string",
                default: "js",
                pattern: /^[^\\:*?"<>|\n]+$/,
                message: "Path may not contain any of the following " +
                    "characters: \\:*?\"<>| or newlines",
                required: true,
                before: sanitizeRelPath
            },
            
            destJs: {
                description: "JavaScript bundle destination directory " +
                    "(relative to destination)",
                type: "string",
                default: "assets/js",
                pattern: /^[^\\:*?"<>|\n]+$/,
                message: "Path may not contain any of the following " +
                    "characters: \\:*?\"<>| or newlines",
                required: true,
                before: sanitizeRelPath
            },
            
            srcSass: {
                description: "SASS source directory (relative to source)",
                type: "string",
                default: "sass",
                pattern: /^[^\\:*?"<>|\n]+$/,
                message: "Path may not contain any of the following " +
                    "characters: \\:*?\"<>| or newlines",
                required: true,
                before: sanitizeRelPath
            },
            
            destSass: {
                description: "Stylesheet bundle destination directory " +
                    "(relative to destination)",
                type: "string",
                default: "assets/css",
                pattern: /^[^\\:*?"<>|\n]+$/,
                message: "Path may not contain any of the following " +
                    "characters: \\:*?\"<>| or newlines",
                required: true,
                before: sanitizeRelPath
            },
            
            serverTask: {
                description: "Add optional live server gulp task ('yes' or " +
                    "'no')",
                type: "string",
                default: "yes",
                pattern: /^(y|n|yes|no)$/i,
                message: "Choose 'yes' or 'no'"
            }
        }
    };

// Config data module (required at runtime).
var CONFIG = null;

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
    try {
        await copyTemplateFiles(rootPath, input);
    }
    catch (e) {
        console.error("Template file creation failed");
        process.exit();
    }
    
    try {
        await createStructure(rootPath, CONFIG, input);
    }
    catch (e) {
        console.error("Project structure generation failed");
        process.exit();
    }
    
    try {
        await installDeps();
    }
    catch (e) {
        console.error("Dependency installation failed");
        process.exit();
    }
}

/* Copies template files into the project.
    
    rootPath - See createProject().
    input - See createProject().
*/
async function copyTemplateFiles(rootPath, input) {
    // Copy template files with custom user data
    console.log("Creating build pipeline files...");
    
    for (let i=0, l=TEMPLATES.length; i<l; ++i) {
        let file = TEMPLATES[i],
            tplFile = TPL_PATH + "/" + file,
            destFile, data;
        
        // Read the template file
        try {
            data = await readFileAsync(
                tplFile, { encoding: "utf8" }
            );
        }
        catch (e) {
            // Skip file if a read error occurred
            console.error("Template file '" + file + "' could not be copied");
            continue;
        }
        
        data = replaceValues(data, input);
        
        // Capture the file to output later if specified by template file name
        // (double underscore prefix)
        if (file.match(/^__/)) {
            CAPTURED_TEMPLATES[file.replace(/^__/, "")] = data;
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
                msg = "File at '" + destFile + "' already exists";
                break;
                
                default:
                msg = "Could not create file at '" + destFile + "'";
            }
            
            console.error(msg);
        }
        
        // Create temporary config file to load for this script
        if ("config.js" === file) {
            let uuidConfig = rootPath + "/config-" + uuid() + ".js";
            
            try {
                await writeFileAsync(uuidConfig, data, {
                    encoding: "utf8",
                    mode: 0o644,
                    flag: "wx"
                });
                
                CONFIG = require(uuidConfig);
            }
            catch (e) {
                // Temporary config file could not be written
                let msg;
                
                switch (e.code) {
                    case "EEXIST":
                    msg = "File at '" + uuidConfig + "' already exists (the " +
                        "chances of this are monumentally small, try running " +
                        "the script again)";
                    break;
                    
                    default:
                    msg = "Could not create temporary config file at '" +
                        uuidConfig + "'";
                    
                    console.error(msg);
                }
            }
            
            try {
                await unlinkAsync(uuidConfig);
            }
            catch (e) {
                console.error("Temporary config file at '" + uuidConfig +
                    "' could not be deleted, and must be removed manually");
            }
        }
    }
}

/* Creates the base project structure.
    
    rootPath - See createProject().
    config - Project config data.
    input - See createProject().
*/
async function createStructure(rootPath, config, input) {
    console.log("Creating source/destination directories...");
    rootPath = "/" + sanitizeRelPath(rootPath) + "/";
    
    let srcPaths = config.PATH.SRC,
        destPaths = config.PATH.DEST,
        srcDir = rootPath + srcPaths.ROOT,
        destDir = rootPath + destPaths.ROOT,
        srcJs = rootPath + srcPaths.JS,
        srcJsModules = srcJs + "/node_modules/app",
        srcSass = rootPath + srcPaths.SASS,
        destJs = rootPath + destPaths.JS,
        destSass = rootPath + destPaths.SASS,
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
                    mkdirAsync(srcJsModules, opts),
                    mkdirAsync(srcSass, opts),
                    mkdirAsync(destJs, opts),
                    mkdirAsync(destSass, opts)
                ].map(catchAll)
            );
        })
        .then(() => {
            // Add additional project files
            return Promise.allSettled([
                writeFileAsync(srcJs + "/index.js", "", writeOpts),
                writeFileAsync(srcSass + "/index.scss", "", writeOpts),
                writeFileAsync(
                    srcJsModules + "/.gitkeep",
                    CAPTURED_TEMPLATES[".gitkeep"],
                    writeOpts
                ),
                writeFileAsync(
                    destDir + "/index.html",
                    CAPTURED_TEMPLATES["index.html"],
                    writeOpts
                ),
                
                (async () => {
                    // Add license file
                    let licenseText;
                    
                    try {
                        licenseText = await osl.getLicenseText(
                            osl.getNearestLicense());
                    }
                    catch (e) {
                        console.log("No valid OSI license ID found in " +
                            "package.json; license file was not generated\n" +
                            "See https://opensource.org/licenses/alphabetical");
                        
                        return;
                    }
                    
                    return writeFileAsync(
                        process.cwd() + "/LICENSE.md",
                        `${licenseText}\n`,
                        writeOpts
                    );
                })()
            ].map(catchAll));
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

//
// Main script entry point
//

(() => {
    if (!fs.existsSync(process.cwd() + "/package.json")) {
        console.error("This isn't an npm package, run 'npm init' first");
        process.exit();
    }
    
    let rootPath = process.cwd(),
        numFiles = TEMPLATES.length,
        checked = 0,
        exists = [];
    
    // Make sure no existing files will be overwritten
    for (let i=0, l=TEMPLATES.length; i<l; ++i) {
        ((file) => {
            fs.lstat(file, (err) => {
                if (!err) {
                    // Stat succeeded, file exists
                    exists.push(file);
                }
                
                if (++checked >= numFiles) {
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
                    
                    // Get user input
                    prompt.message = "";
                    
                    prompt.start();
                    
                    prompt.get(userInput, async (err, results) => {
                        if (err) {
                            console.error("An unknown error occurred");
                            return;
                        }
                        
                        // Convert server task input to actual task string
                        switch (results.serverTask.toLowerCase()) {
                            case "y":
                            case "yes":
                            results.serverImport = "import liveServer from " +
                                "\"live-server\";";
                            
                            results.serverTask =
                                require("./modules/server-task");
                            
                            results.serverTaskName = ", \"server\"";
                            break;
                            
                            case "n":
                            case "no":
                            results.serverTask = "";
                            break;
                        }
                        
                        results.serverTask = replaceValues(
                            results.serverTask,
                            results
                        );
                        
                        // Add custom fields
                        results.appName = PACKAGE.name;
                        results.description = PACKAGE.description;
                        results.license = PACKAGE.license;
                        
                        // Capture input results in the user input config object
                        for (let k in results) {
                            if (!results.hasOwnProperty(k)) { continue; }
                            
                            userInput.fields[k] = results[k];
                        }
                        
                        // Create the project
                        try {
                            await createProject(
                                "/" + sanitizeRelPath(rootPath),
                                results
                            );
                        }
                        catch (e) {
                            console.error("An unknown error occurred");
                            process.exit();
                        }
                    });
                }
            });
        })(TEMPLATES[i]);
    }
})();
