/* gulpfile.babel.js
    
    Gulp configuration.
*/

"use strict";

// Gulp dependencies
import gulp from "gulp";

import cleanCss from "gulp-clean-css";
import dartSass from "gulp-dart-sass";
import sourcemaps from "gulp-sourcemaps";
import plumber from "gulp-plumber";

import webpack from "webpack";
import webpackStream from "webpack-stream";

import del from "del";%%[serverImport]%%

import CONFIG from "#root/config";
import CONFIG_WEBPACK from "#root/webpack.config";

import getArg from "#root/args";

// Environment paths.
const PATH = CONFIG.PATH,
    
    // Gulp plugins collection.
    PLUGINS = {
        cleanCss,
        dartSass,
        sourcemaps,
        plumber
    };

//
// TASKS
//

// Watches the project for changes and recompiles.
gulp.task("watch", (done) => {
    gulp.watch(`${PATH.SRC.SASS}/**/*.scss`, gulp.series("sass"));
    gulp.watch(`${PATH.SRC.JS}/**/*.js`, gulp.series("js"));
    
    done();
});

// Clears the build destination directories for a clean build.
gulp.task("clean", () => {
    return del([
        `${PATH.DEST.SASS}/**/*`,
        `${PATH.DEST.JS}/**/*`
    ]);
});

// SASS build task.
gulp.task("sass", () => {
    let action = gulp.src(`${PATH.SRC.SASS}/index.scss`),
        sass = PLUGINS.dartSass,
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
});

// JS build task.
gulp.task("js", () => {
    let action;
    
    action = gulp.src(`${PATH.SRC.JS}/index.js`)
        .pipe(PLUGINS.plumber({
            errorHandler: function(err) {
                console.log(err);
                this.emit("end");
            }
        }))
        .pipe(webpackStream(CONFIG_WEBPACK, webpack))
        .pipe(gulp.dest(PATH.DEST.JS));
    
    return action;
});
%%[serverTask]%%
// Complete build task.
gulp.task(
    "build",
    gulp.series(
        "clean",
        gulp.parallel("sass", "js")
    )
);

//
// Aliases
//

gulp.task("w", gulp.parallel("watch"));

// Default gulp task.
gulp.task("default", gulp.series("build", "watch"%%[serverTaskName]%%));
