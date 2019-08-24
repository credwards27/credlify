#!/usr/bin/env node

/* credify
    
    A simple scaffolding helper for node projects.
*/

"use strict";

// Dependencies.
const minimist = require("minimist"),
    minimistOpts = require("minimist-options"),
    prompt = require("prompt"),
    uuid = require("uuid/v4"),
    fs = require("fs"),
    path = require("path"),
    promisify = require("util").promisify,
    
    readFileAsync = promisify(fs.readFile),
    writeFileAsync = promisify(fs.writeFile),
    unlinkAsync = promisify(fs.unlink),
    
    // Template directory path.
    TPL_PATH = __dirname + "/tpl",
    
    // Template file paths.
    TEMPLATES = fs.readdirSync(TPL_PATH).map((file) => {
        return sanitizeRelPath(file);
    }),
    
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
    await copyTemplateFiles(rootPath, input);
    await createStructure(rootPath, input);
    await installDeps();
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
            destFile = rootPath + "/" + file,
            data;
        
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
        
        // Copy the modified template file into the project
        try {
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
    input - See createProject().
*/
async function createStructure(rootPath, input) {
}

/* Installs package dependencies.
*/
async function installDeps() {
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
                            results.serverTask =
                                require("./modules/server-task");
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
                        
                        // Capture input results in the user input config object
                        for (let k in results) {
                            if (!results.hasOwnProperty(k)) { continue; }
                            
                            userInput.fields[k] = results[k];
                        }
                        
                        // Create the project
                        await createProject(
                            "/" + sanitizeRelPath(rootPath),
                            results
                        );
                    });
                }
            });
        })(TEMPLATES[i]);
    }
})();
