/* gulpfile.babel.js
    
    Gulp configuration.
*/

"use strict";

// Gulp dependencies
import gulp from "gulp";
import plugins from "gulp-load-plugins";

import webpack from "webpack";
import webpackStream from "webpack-stream";

import del from "del";

import CONFIG from "./config";
import CONFIG_WEBPACK from "./webpack.config";

import getArg from "./args";

// Environment paths.
const PATH = CONFIG.PATH,
    
    // Gulp plugins collection.
    PLUGINS = plugins(),
    
    // Collection of task handler functions.
    tasks = {
        /* Watches the project for changes and recompiles.
        */
        watch: function(done) {
            gulp.watch(PATH.SRC.SASS + "/**/*.scss", tasks.sass);
            gulp.watch(PATH.SRC.JS + "/**/*.js", tasks.js);
        },
        
        /* Clears the build destination directories for a clean build.
        */
        clean: function() {
            return del([
                PATH.DEST.SASS + "/**/*",
                PATH.DEST.JS + "/**/*"
            ]);
        },
        
        /* SASS build task.
        */
        sass: function(done) {
            let action = gulp.src(PATH.SRC.SASS + "/index.scss"),
                sass = PLUGINS.sass,
                sourcemaps = PLUGINS.sourcemaps,
                production = getArg("production");
            
            if (!production) {
                action = action.pipe(sourcemaps.init());
            }
            
            action = action.pipe(sass().on("error", sass.logError))
                .pipe(PLUGINS.cleanCss());
            
            if (!production) {
                action = action.pipe(sourcemaps.write());
            }
            
            action = action.pipe(gulp.dest(PATH.DEST.SASS));
            
            return action;
        },
        
        /* JS build task.
        */
        js: function(done) {
            let action;
            
            action = gulp.src(PATH.SRC.JS + "/index.js")
                .pipe(PLUGINS.plumber({
                    errorHandler: function(err) {
                        console.log(err);
                        this.emit("end");
                    }
                }))
                .pipe(webpackStream(CONFIG_WEBPACK, webpack))
                .pipe(gulp.dest(PATH.DEST.JS));
            
            return action;
        },
        
        // Complete build task.
        build: {
            series: [ "clean" ],
            parallel: [ "sass", "js" ]
        },
        
        //
        // Aliases
        //
        
        w: "watch",
        
        // Default gulp task.
        default: {
            series: [ "build", "watch" ]
        }
    };

// Link tasks with handlers
(() => {
    for (let k in tasks) {
        if (tasks.hasOwnProperty(k)) {
            let curr = tasks[k],
                task;
            
            // Skip if invalid
            if (!curr) {
                continue;
            }
            
            // Normalize task definition
            if (typeof curr === "string") {
                curr = tasks[curr];
            }
            
            if (typeof curr === "function") {
                // Simple task function
                task = curr;
            }
            else {
                if (curr instanceof Array) {
                    curr = { parallel: curr };
                }
                
                // Generate task sequence accordingly
                let parallel = curr.parallel,
                    series = curr.series,
                    parallelValid, seriesValid;
                
                // Normalize parallel and series groups
                parallel = typeof parallel === "string" ?
                    [ parallel ] : parallel;
                
                series = typeof series === "string" ? [ series ] : series;
                
                parallelValid = (parallel instanceof Array && parallel.length);
                seriesValid = (series instanceof Array && series.length);
                
                // Generate task sequence
                if (parallelValid && seriesValid) {
                    task = gulp.series(
                        ...series,
                        gulp.parallel(...parallel)
                    );
                }
                else if (parallelValid) {
                    task = gulp.parallel(...parallel);
                }
                else if (seriesValid) {
                    task = gulp.series(...series);
                }
                else {
                    // No valid parallel or series group, skip
                    continue;
                }
            }
            
            // Register task.
            gulp.task(k, task);
        }
    }
})();
