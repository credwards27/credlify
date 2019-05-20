#!/usr/bin/env node

/* credify
    
    A simple scaffolding helper for node projects.
*/

"use strict";

// Dependencies.
const minimist = require("minimist"),
    minimistOpts = require("minimist-options"),
    prompt = require("prompt"),
    fs = require("fs"),
    path = require("path"),
    
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
        }
    };

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
    data - User input data for project configuration.
*/
function createProject(rootPath, data) {
    rootPath = "/" + sanitizeRelPath(rootPath);
    
    // Copy template files with custom user data
    for (let i=0, l=TEMPLATES.length; i<l; ++i) {
        ((file) => {
            let tplFile = TPL_PATH + "/" + file;
            
            // Copy template file into project
            fs.readFile(tplFile, { encoding: "utf8" }, (err, data) => {
                let destFile = rootPath + "/" + file;
                
                fs.writeFile(
                    destFile,
                    data,
                    {
                        encoding: "utf8",
                        mode: 0o644,
                        flag: "wx"
                    },
                    (err) => {
                        // Show error message if file could not be copied
                        if (err) {
                            let msg;
                            
                            switch (err.code) {
                                case "EEXIST":
                                msg = "File at '" + destFile + "' already " +
                                    "exists";
                                break;
                                
                                default:
                                msg = "Could not create file at '" + destFile +
                                    "'";
                            }
                            
                            console.error(msg);
                        }
                    })
            });
        })(TEMPLATES[i]);
    }
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
                    
                    prompt.get(userInput, (err, results) => {
                        if (err) {
                            console.error("An unknown error occurred");
                            return;
                        }
                        
                        createProject(rootPath, results);
                    });
                }
            });
        })(TEMPLATES[i]);
    }
})();
