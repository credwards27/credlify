/* webpack.config.js
    
    Webpack configuration.
*/

import MinifyPlugin from "terser-webpack-plugin";
import path from "path";
import { URL } from "url";
import getArg from "#root/args";
import CONFIG from "#root/config";

// ES6 module __dirname.
const __dirname = new URL(".", import.meta.url).pathname.replace(/\/+$/, ""),
    
    // Webpack config object.
    wp = {
        module: {
            rules: [
                {
                    test: /\.js$/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            configFile: path.resolve(
                                __dirname,
                                "babel.config.js"
                            )
                        }
                    }
                }
            ]
        },
        
        plugins: [],
        
        entry: {
            main: `./${CONFIG.PATH.SRC.JS}/index.js`
        },
        
        output: {
            filename: "[name].bundle.js",
            chunkFilename: "[name].bundle.js"
        },
        
        externals: {
            // Place external script references like:
            // moduleName: "globalName"
        },
        
        mode: "development",
        devtool: "source-map"
    };

// Initialize
(() => {
    if (getArg("production")) {
        wp.mode = "production";
        
        wp.optimization = {
            minimize: true,
            minimizer: [ new MinifyPlugin() ]
        };
        
        delete wp.devtool;
    }
})();

export default wp;
